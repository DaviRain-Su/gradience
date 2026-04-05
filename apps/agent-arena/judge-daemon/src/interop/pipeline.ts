import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { RetryPolicy } from '../evaluators.js';

import type {
    ReputationInteropSignal,
    InteropRole,
    InteropPublisher,
    InteropOutboxDrainResult,
    InteropOutboxEntry,
    IdentityDispatch,
    FeedbackDispatch,
    InteropSink,
} from './types.js';

export class InteropPipeline implements InteropPublisher {
    private readonly retryPolicy: RetryPolicy;
    private readonly minScoreForAttestation: number;
    private readonly logger: Pick<Console, 'warn' | 'error'>;
    private readonly outboxFilePath: string | null;

    constructor(
        private readonly options: {
            identitySink?: InteropSink;
            feedbackSinks?: Array<{ name: string; sink: InteropSink }>;
            attestationSink?: InteropSink;
            statusSink?: InteropSink;
            outboxFilePath?: string;
            retryPolicy?: RetryPolicy;
            minScoreForAttestation?: number;
            logger?: Pick<Console, 'warn' | 'error'>;
        },
    ) {
        this.retryPolicy = options.retryPolicy ?? { maxAttempts: 3, baseDelayMs: 500 };
        this.minScoreForAttestation = options.minScoreForAttestation ?? 60;
        this.logger = options.logger ?? console;
        this.outboxFilePath = options.outboxFilePath ?? null;
    }

    async onTaskJudged(signal: ReputationInteropSignal): Promise<void> {
        try {
            await this.publishSignal(signal);
        } catch (error) {
            await this.enqueueOutbox(signal, asMessage(error));
            throw error;
        }
    }

    async flushOutbox(): Promise<InteropOutboxDrainResult> {
        const entries = await this.readOutboxEntries();
        if (entries.length === 0) {
            return { processed: 0, failed: 0, remaining: 0 };
        }

        const remaining: InteropOutboxEntry[] = [];
        let processed = 0;
        let failed = 0;
        for (const entry of entries) {
            try {
                await this.publishSignal(entry.signal);
                processed += 1;
            } catch (error) {
                failed += 1;
                remaining.push({
                    ...entry,
                    attempts: entry.attempts + 1,
                    lastError: asMessage(error),
                });
            }
        }
        await this.writeOutboxEntries(remaining);
        return { processed, failed, remaining: remaining.length };
    }

    private async publishSignal(signal: ReputationInteropSignal): Promise<void> {
        let identityPublished = false;
        let attestationPublished = false;
        const identityRecipients: string[] = [];
        const identityDispatches: Array<{ role: InteropRole; agent: string }> = [];
        const feedbackTargets = new Set<string>();
        const feedbackRecipients: Array<{ sink: string; role: InteropRole; agent: string }> = [];

        if (this.options.identitySink) {
            for (const dispatch of buildIdentityDispatches(signal)) {
                await this.withRetry('identity_sink', () => this.options.identitySink?.publish(dispatch));
                identityRecipients.push(dispatch.agent);
                identityDispatches.push({
                    role: dispatch.role,
                    agent: dispatch.agent,
                });
                identityPublished = true;
            }
        }

        const feedbackSinks = this.options.feedbackSinks ?? [];
        const feedbackDispatches = buildFeedbackDispatches(signal);
        for (const feedbackSink of feedbackSinks) {
            for (const dispatch of feedbackDispatches) {
                await this.withRetry(`feedback_sink:${feedbackSink.name}`, () => feedbackSink.sink.publish(dispatch));
                feedbackTargets.add(feedbackSink.name);
                feedbackRecipients.push({
                    sink: feedbackSink.name,
                    role: dispatch.role,
                    agent: dispatch.agent,
                });
            }
        }

        if (this.options.attestationSink && signal.score >= this.minScoreForAttestation) {
            await this.withRetry('attestation_sink', () => this.options.attestationSink?.publish(signal));
            attestationPublished = true;
        }

        if (this.options.statusSink) {
            await this.withRetry('status_sink', () =>
                this.options.statusSink?.publish({
                    type: 'interop_sync',
                    winner: signal.winner,
                    taskId: signal.taskId,
                    score: signal.score,
                    category: signal.category,
                    chainTx: signal.chainTx,
                    judgedAt: signal.judgedAt,
                    participants: signal.participants ?? [],
                    identityRegistered: identityPublished,
                    identityRecipients,
                    identityDispatches,
                    feedbackTargets: [...feedbackTargets],
                    feedbackRecipients,
                    feedbackPublishedCount: feedbackRecipients.length,
                    erc8004FeedbackPublished: feedbackTargets.has('erc8004_feedback'),
                    istranaFeedbackPublished: feedbackTargets.has('istrana_feedback'),
                    evmReputationPublished: feedbackTargets.has('evm_reputation_relay'),
                    attestationPublished,
                }),
            );
        }
    }

    private async enqueueOutbox(signal: ReputationInteropSignal, reason: string): Promise<void> {
        if (!this.outboxFilePath) {
            return;
        }
        const entries = await this.readOutboxEntries();
        entries.push({
            signal,
            attempts: 0,
            lastError: reason,
            queuedAt: Date.now(),
        });
        await this.writeOutboxEntries(entries);
    }

    private async readOutboxEntries(): Promise<InteropOutboxEntry[]> {
        if (!this.outboxFilePath) {
            return [];
        }
        try {
            await stat(this.outboxFilePath);
        } catch {
            return [];
        }
        const raw = await readFile(this.outboxFilePath, 'utf8');
        if (!raw.trim()) {
            return [];
        }
        const lines = raw
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        const entries: InteropOutboxEntry[] = [];
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line) as InteropOutboxEntry;
                if (isOutboxEntry(parsed)) {
                    entries.push(parsed);
                }
            } catch {
                continue;
            }
        }
        return entries;
    }

    private async writeOutboxEntries(entries: InteropOutboxEntry[]): Promise<void> {
        if (!this.outboxFilePath) {
            return;
        }
        await mkdir(path.dirname(this.outboxFilePath), { recursive: true });
        const tempPath = `${this.outboxFilePath}.tmp`;
        const body = entries.length === 0 ? '' : `${entries.map(entry => JSON.stringify(entry)).join('\n')}\n`;
        await writeFile(tempPath, body, 'utf8');
        await rename(tempPath, this.outboxFilePath);
    }

    private async withRetry(name: string, fn: () => Promise<void> | undefined): Promise<void> {
        const maxAttempts = Math.max(1, this.retryPolicy.maxAttempts);
        const baseDelayMs = Math.max(1, this.retryPolicy.baseDelayMs);
        let lastError: unknown = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                const result = fn();
                if (result) {
                    await result;
                }
                return;
            } catch (error) {
                lastError = error;
                if (attempt >= maxAttempts) {
                    break;
                }
                const delayMs = baseDelayMs * 2 ** (attempt - 1);
                this.logger.warn(`${name} failed on attempt ${attempt}, retrying in ${delayMs}ms: ${asMessage(error)}`);
                await wait(delayMs);
            }
        }

        throw new Error(`${name} failed after ${maxAttempts} attempts: ${asMessage(lastError)}`);
    }
}

function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function buildIdentityDispatches(signal: ReputationInteropSignal): IdentityDispatch[] {
    const dispatches: IdentityDispatch[] = [];
    const seen = new Set<string>();
    const append = (role: InteropRole, agent: string) => {
        const normalized = agent.trim();
        if (!normalized) {
            return;
        }
        if (seen.has(normalized)) {
            return;
        }
        seen.add(normalized);
        dispatches.push({ signal, role, agent: normalized });
    };

    append('winner', signal.winner);
    append('poster', signal.poster);
    append('judge', signal.judge);
    for (const participant of signal.participants ?? []) {
        if (participant === signal.winner) {
            continue;
        }
        append('loser', participant);
    }

    return dispatches;
}

function buildFeedbackDispatches(signal: ReputationInteropSignal): FeedbackDispatch[] {
    const dispatches: FeedbackDispatch[] = [];
    const seen = new Set<string>();
    const append = (role: InteropRole, agent: string, roleScore: number) => {
        const normalized = agent.trim();
        if (!normalized) {
            return;
        }
        const key = `${role}:${normalized}`;
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        dispatches.push({
            signal,
            role,
            agent: normalized,
            roleScore: clampScore(roleScore),
        });
    };

    append('winner', signal.winner, signal.score);
    append('poster', signal.poster, signal.score);
    append('judge', signal.judge, signal.score);
    for (const participant of signal.participants ?? []) {
        if (participant === signal.winner) {
            continue;
        }
        append('loser', participant, 0);
    }

    return dispatches;
}

function isOutboxEntry(value: unknown): value is InteropOutboxEntry {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const entry = value as Partial<InteropOutboxEntry>;
    return (
        typeof entry.signal === 'object' &&
        isReputationInteropSignal(entry.signal) &&
        typeof entry.attempts === 'number' &&
        Number.isFinite(entry.attempts) &&
        entry.attempts >= 0 &&
        typeof entry.lastError === 'string' &&
        typeof entry.queuedAt === 'number' &&
        Number.isFinite(entry.queuedAt)
    );
}

function isReputationInteropSignal(value: unknown): value is ReputationInteropSignal {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const signal = value as Partial<ReputationInteropSignal>;
    return (
        typeof signal.taskId === 'number' &&
        typeof signal.category === 'number' &&
        typeof signal.winner === 'string' &&
        typeof signal.poster === 'string' &&
        typeof signal.judge === 'string' &&
        typeof signal.score === 'number' &&
        typeof signal.reward === 'number' &&
        typeof signal.reasonRef === 'string' &&
        typeof signal.chainTx === 'string' &&
        typeof signal.judgedAt === 'number' &&
        typeof signal.judgeMode === 'string' &&
        (typeof signal.participants === 'undefined' ||
            (Array.isArray(signal.participants) && signal.participants.every(value => typeof value === 'string')))
    );
}

function asMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

function clampScore(score: number): number {
    if (!Number.isFinite(score)) {
        return 0;
    }
    return Math.max(0, Math.min(100, Math.round(score)));
}
