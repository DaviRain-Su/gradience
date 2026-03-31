import process from 'node:process';

export interface EvaluationRequest {
    taskId: number;
    taskDescription: string;
    criteria: Record<string, unknown>;
    result: string;
    trace: string;
    agent: string;
}

export type EvaluationMode = 'type_a' | 'type_b' | 'type_c1';

export interface EvaluationResult {
    score: number;
    reasoning: string;
    dimensionScores: Record<string, number>;
    confidence: number;
    mode: EvaluationMode;
}

export interface ScoreEvaluator {
    evaluate(request: EvaluationRequest): Promise<EvaluationResult>;
}

export interface ManualReviewDecision {
    score: number;
    reasoning: string;
    dimensionScores?: Record<string, number>;
    confidence?: number;
}

export interface ManualReviewProvider {
    getDecision(request: EvaluationRequest): Promise<ManualReviewDecision | null>;
}

export class EnvManualReviewProvider implements ManualReviewProvider {
    constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

    async getDecision(request: EvaluationRequest): Promise<ManualReviewDecision | null> {
        const scoreRaw =
            this.env[`JUDGE_DAEMON_MANUAL_SCORE_TASK_${request.taskId}`] ??
            this.env.JUDGE_DAEMON_MANUAL_SCORE;
        if (!scoreRaw) {
            return null;
        }
        const score = Number(scoreRaw);
        if (!Number.isFinite(score)) {
            throw new Error(`Invalid manual score: ${scoreRaw}`);
        }
        const reasoning =
            this.env[`JUDGE_DAEMON_MANUAL_REASON_TASK_${request.taskId}`] ??
            this.env.JUDGE_DAEMON_MANUAL_REASON ??
            'manual review';
        const confidenceRaw = this.env.JUDGE_DAEMON_MANUAL_CONFIDENCE ?? '1';
        const confidence = Number(confidenceRaw);
        return {
            score,
            reasoning,
            confidence: Number.isFinite(confidence) ? confidence : 1,
            dimensionScores: {},
        };
    }
}

export interface PollingManualEvaluatorOptions {
    provider: ManualReviewProvider;
    pollIntervalMs?: number;
    timeoutMs?: number;
}

export class PollingManualEvaluator implements ScoreEvaluator {
    private readonly pollIntervalMs: number;
    private readonly timeoutMs: number;

    constructor(private readonly options: PollingManualEvaluatorOptions) {
        this.pollIntervalMs = options.pollIntervalMs ?? 1_000;
        this.timeoutMs = options.timeoutMs ?? 300_000;
    }

    async evaluate(request: EvaluationRequest): Promise<EvaluationResult> {
        const startedAt = Date.now();
        while (Date.now() - startedAt <= this.timeoutMs) {
            const decision = await this.options.provider.getDecision(request);
            if (decision) {
                return {
                    score: clampScore(decision.score),
                    reasoning: decision.reasoning,
                    dimensionScores: decision.dimensionScores ?? {},
                    confidence: clampConfidence(decision.confidence ?? 1),
                    mode: 'type_a',
                };
            }
            await sleep(this.pollIntervalMs);
        }
        throw new Error(
            `Manual review timed out for task ${request.taskId} after ${this.timeoutMs}ms`,
        );
    }
}

export interface DspyHttpEvaluatorOptions {
    endpoint: string;
    fetcher?: typeof fetch;
    timeoutMs?: number;
    authToken?: string;
}

export class RateLimitError extends Error {
    readonly status: number;
    readonly retryAfterMs: number | null;

    constructor(message: string, status = 429, retryAfterMs: number | null = null) {
        super(message);
        this.name = 'RateLimitError';
        this.status = status;
        this.retryAfterMs = retryAfterMs;
    }
}

export class DspyHttpEvaluator implements ScoreEvaluator {
    private readonly endpoint: string;
    private readonly fetcher: typeof fetch;
    private readonly timeoutMs: number;
    private readonly authToken: string | null;

    constructor(options: DspyHttpEvaluatorOptions) {
        this.endpoint = options.endpoint.replace(/\/$/, '');
        this.fetcher = options.fetcher ?? fetch;
        this.timeoutMs = options.timeoutMs ?? 20_000;
        this.authToken = options.authToken?.trim() || null;
    }

    async evaluate(request: EvaluationRequest): Promise<EvaluationResult> {
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), this.timeoutMs);
        try {
            const response = await this.fetcher(`${this.endpoint}/evaluate`, {
                method: 'POST',
                headers: this.buildHeaders(),
                body: JSON.stringify({
                    task_desc: request.taskDescription,
                    criteria: request.criteria,
                    result: request.result,
                    trace: request.trace,
                }),
                signal: abort.signal,
            });
            if (response.status === 429) {
                throw new RateLimitError(
                    'DSPy evaluator rate limited',
                    429,
                    parseRetryAfter(response.headers.get('retry-after')),
                );
            }
            if (!response.ok) {
                const body = await response.text();
                throw new Error(`DSPy evaluator failed (${response.status}): ${body}`);
            }
            const payload = (await response.json()) as {
                score: unknown;
                reasoning: unknown;
                dimension_scores?: unknown;
                confidence: unknown;
            };
            return {
                score: clampScore(Number(payload.score)),
                reasoning:
                    typeof payload.reasoning === 'string'
                        ? payload.reasoning
                        : 'evaluation completed',
                dimensionScores: normalizeDimensionScores(payload.dimension_scores),
                confidence: clampConfidence(Number(payload.confidence)),
                mode: 'type_b',
            };
        } catch (error) {
            if (error instanceof RateLimitError) {
                throw error;
            }
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`DSPy evaluator timeout after ${this.timeoutMs}ms`);
            }
            throw error;
        } finally {
            clearTimeout(timer);
        }
    }

    private buildHeaders(): Record<string, string> {
        if (!this.authToken) {
            return { 'content-type': 'application/json' };
        }
        return {
            'content-type': 'application/json',
            authorization: `Bearer ${this.authToken}`,
        };
    }
}

export interface RetryPolicy {
    maxAttempts: number;
    baseDelayMs: number;
}

export async function evaluateWithRetry(
    evaluator: ScoreEvaluator,
    request: EvaluationRequest,
    policy: RetryPolicy,
): Promise<EvaluationResult> {
    let attempt = 0;
    for (;;) {
        attempt += 1;
        try {
            return await evaluator.evaluate(request);
        } catch (error) {
            if (!isRateLimit(error) || attempt >= policy.maxAttempts) {
                throw error;
            }
            const retryAfter = getRetryAfter(error);
            const delayMs =
                retryAfter ??
                policy.baseDelayMs * Math.max(1, 2 ** (attempt - 1));
            await sleep(delayMs);
        }
    }
}

function normalizeDimensionScores(value: unknown): Record<string, number> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, score]) => Number.isFinite(Number(score)))
        .map(([dimension, score]) => [dimension, Number(score)] as const);
    return Object.fromEntries(entries);
}

function parseRetryAfter(header: string | null): number | null {
    if (!header) {
        return null;
    }
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.floor(seconds * 1000);
    }
    return null;
}

function isRateLimit(error: unknown): boolean {
    if (error instanceof RateLimitError) {
        return true;
    }
    return error instanceof Error && /429|rate limit/i.test(error.message);
}

function getRetryAfter(error: unknown): number | null {
    if (error instanceof RateLimitError) {
        return error.retryAfterMs;
    }
    return null;
}

function clampScore(score: number): number {
    if (!Number.isFinite(score)) {
        return 0;
    }
    return Math.max(0, Math.min(100, Math.round(score)));
}

function clampConfidence(confidence: number): number {
    if (!Number.isFinite(confidence)) {
        return 0;
    }
    return Math.max(0, Math.min(1, confidence));
}

async function sleep(ms: number): Promise<void> {
    if (ms <= 0) {
        return;
    }
    await new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
}
