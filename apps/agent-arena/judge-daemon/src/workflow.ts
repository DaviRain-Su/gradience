import { address, type Address } from '@solana/kit';

import {
    GradienceSDK,
    type SubmissionApi,
    type TaskApi,
    type WalletAdapter,
} from '../../clients/typescript/src/index.js';
import { AbsurdWorkflowEngine } from './engine.js';
import {
    type EvaluationRequest,
    type EvaluationResult,
    type RetryPolicy,
    type ScoreEvaluator,
    evaluateWithRetry,
} from './evaluators.js';
import type { InteropPublisher, ReputationInteropSignal } from './interop.js';
import { RefResolver } from './refs.js';
import type { WorkflowRecord } from './types.js';

export interface JudgeChainClient {
    getTask(taskId: number): Promise<TaskApi | null>;
    getTaskSubmissions(taskId: number): Promise<SubmissionApi[] | null>;
    judge(request: {
        taskId: number;
        winner: Address;
        poster: Address;
        score: number;
        reasonRef: string;
    }): Promise<string>;
}

export interface ReferenceClient {
    fetchText(reference: string): Promise<string>;
    publishReason(payload: unknown): Promise<string>;
}

export class SdkJudgeChainClient implements JudgeChainClient {
    constructor(
        private readonly sdk: GradienceSDK,
        private readonly wallet: WalletAdapter,
    ) {}

    getTask(taskId: number): Promise<TaskApi | null> {
        return this.sdk.getTask(taskId);
    }

    getTaskSubmissions(taskId: number): Promise<SubmissionApi[] | null> {
        return this.sdk.getTaskSubmissions(taskId, { sort: 'slot' });
    }

    judge(request: {
        taskId: number;
        winner: Address;
        poster: Address;
        score: number;
        reasonRef: string;
    }): Promise<string> {
        return this.sdk.task.judge(this.wallet, {
            taskId: request.taskId,
            winner: request.winner,
            poster: request.poster,
            score: request.score,
            reasonRef: request.reasonRef,
        });
    }
}

export type JudgeMode = 'type_a' | 'type_b' | 'type_c1' | 'auto';

export interface JudgeWorkflowRunnerOptions {
    mode?: JudgeMode;
    minConfidence?: number;
    retryPolicy?: RetryPolicy;
    typeAEvaluator: ScoreEvaluator;
    typeBEvaluator: ScoreEvaluator;
    typeCEvaluator: ScoreEvaluator;
    refResolver: ReferenceClient;
    chainClient: JudgeChainClient;
    interopPublisher?: InteropPublisher;
    logger?: Pick<Console, 'info' | 'warn' | 'error'>;
}

export class JudgeWorkflowRunner {
    private readonly mode: JudgeMode;
    private readonly minConfidence: number;
    private readonly retryPolicy: RetryPolicy;
    private readonly logger: Pick<Console, 'info' | 'warn' | 'error'>;

    constructor(
        private readonly engine: AbsurdWorkflowEngine,
        private readonly options: JudgeWorkflowRunnerOptions,
    ) {
        this.mode = options.mode ?? 'type_b';
        this.minConfidence = options.minConfidence ?? 0.7;
        this.retryPolicy = options.retryPolicy ?? { maxAttempts: 5, baseDelayMs: 500 };
        this.logger = options.logger ?? console;
    }

    async process(workflow: WorkflowRecord): Promise<void> {
        const claimed = await this.engine.markRunning(workflow.id);
        if (!claimed) {
            this.logger.info(
                `Workflow ${workflow.id} already claimed by another worker; skipping`,
            );
            return;
        }

        if (workflow.trigger === 'task_created') {
            await this.engine.markCompleted(workflow.id);
            return;
        }

        try {
            const task = await this.options.chainClient.getTask(workflow.taskId);
            if (!task) {
                throw new Error(`Task ${workflow.taskId} not found`);
            }
            const submissions = await this.options.chainClient.getTaskSubmissions(workflow.taskId);
            const submission = pickSubmission(submissions, workflow.agent);
            if (!submission) {
                throw new Error(`No submission found for task ${workflow.taskId}`);
            }

            const criteriaRaw = await this.options.refResolver.fetchText(task.eval_ref);
            const criteriaDoc = parseCriteria(criteriaRaw);
            const result = await this.options.refResolver.fetchText(submission.result_ref);
            const trace = await this.options.refResolver.fetchText(submission.trace_ref);

            const request: EvaluationRequest = {
                taskId: workflow.taskId,
                taskDescription: criteriaDoc.taskDescription ?? `Task ${workflow.taskId}`,
                criteria: criteriaDoc.criteria,
                result,
                trace,
                agent: submission.agent,
            };

            const threshold =
                criteriaDoc.minConfidence !== null
                    ? criteriaDoc.minConfidence
                    : this.minConfidence;

            const judged = await this.evaluate(
                request,
                threshold,
                criteriaDoc.evaluationType,
            );
            const reasonRef = await this.options.refResolver.publishReason({
                task_id: workflow.taskId,
                winner: submission.agent,
                score: judged.score,
                confidence: judged.confidence,
                reasoning: judged.reasoning,
                dimension_scores: judged.dimensionScores,
                mode: judged.mode,
                ts: Math.floor(Date.now() / 1000),
            });

            const chainTx = await this.options.chainClient.judge({
                taskId: workflow.taskId,
                winner: toAddress(submission.agent),
                poster: toAddress(task.poster),
                score: judged.score,
                reasonRef,
            });
            await this.publishInterop({
                taskId: workflow.taskId,
                category: task.category,
                winner: submission.agent,
                poster: task.poster,
                judge: task.judge,
                score: judged.score,
                reward: task.reward,
                reasonRef,
                chainTx,
                judgedAt: Math.floor(Date.now() / 1000),
                judgeMode: task.judge_mode,
            });
            await this.engine.markCompleted(workflow.id);
            this.logger.info(
                `Workflow ${workflow.id} judged task ${workflow.taskId} with ${judged.mode} score=${judged.score}`,
            );
        } catch (error) {
            await this.engine.markFailed(workflow.id, asMessage(error));
            this.logger.error(
                `Workflow ${workflow.id} failed for task ${workflow.taskId}: ${asMessage(error)}`,
            );
        }
    }

    private async evaluate(
        request: EvaluationRequest,
        minConfidence: number,
        evaluationType: string | null,
    ): Promise<EvaluationResult> {
        if (this.mode === 'type_a') {
            return this.options.typeAEvaluator.evaluate(request);
        }
        if (this.mode === 'type_c1') {
            return this.options.typeCEvaluator.evaluate(request);
        }

        if (this.mode === 'auto' && evaluationType === 'test_cases') {
            return this.options.typeCEvaluator.evaluate(request);
        }

        const automated = await evaluateWithRetry(
            this.options.typeBEvaluator,
            request,
            this.retryPolicy,
        );
        if (automated.confidence >= minConfidence) {
            return automated;
        }
        this.logger.warn(
            `Task ${request.taskId} confidence ${automated.confidence.toFixed(2)} < ${minConfidence}, fallback to Type A`,
        );
        return this.options.typeAEvaluator.evaluate(request);
    }

    private async publishInterop(signal: ReputationInteropSignal): Promise<void> {
        const publisher = this.options.interopPublisher;
        if (!publisher) {
            return;
        }
        try {
            await publisher.onTaskJudged(signal);
        } catch (error) {
            this.logger.error(
                `Interop publish failed for task ${signal.taskId}: ${asMessage(error)}`,
            );
        }
    }
}

export class RefResolverClient implements ReferenceClient {
    constructor(private readonly resolver: RefResolver) {}

    fetchText(reference: string): Promise<string> {
        return this.resolver.fetchText(reference);
    }

    publishReason(payload: unknown): Promise<string> {
        return this.resolver.publishReason(payload);
    }
}

function pickSubmission(
    submissions: SubmissionApi[] | null,
    preferredAgent: string | null,
): SubmissionApi | null {
    if (!submissions || submissions.length === 0) {
        return null;
    }
    const filtered = preferredAgent
        ? submissions.filter((item) => item.agent === preferredAgent)
        : submissions;
    if (filtered.length === 0) {
        return null;
    }
    return filtered.reduce((latest, current) =>
        current.submission_slot > latest.submission_slot ? current : latest,
    );
}

function parseCriteria(raw: string): {
    taskDescription: string | null;
    evaluationType: string | null;
    minConfidence: number | null;
    criteria: Record<string, unknown>;
} {
    try {
        const json = JSON.parse(raw) as Record<string, unknown>;
        return {
            taskDescription:
                asString(json.task_description) ??
                asString(json.task_desc) ??
                asString(json.description) ??
                null,
            evaluationType: asString(json.type),
            minConfidence: toConfidence(json.min_confidence),
            criteria: json,
        };
    } catch {
        return {
            taskDescription: null,
            evaluationType: null,
            minConfidence: null,
            criteria: { raw_text: raw },
        };
    }
}

function toAddress(value: string): Address {
    return address(value);
}

function toConfidence(value: unknown): number | null {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return null;
    }
    if (value < 0 || value > 1) {
        return null;
    }
    return value;
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function asMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
