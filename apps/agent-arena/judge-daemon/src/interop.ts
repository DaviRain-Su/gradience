import { createHmac } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { RetryPolicy } from './evaluators.js';

export interface ReputationInteropSignal {
    taskId: number;
    category: number;
    winner: string;
    poster: string;
    judge: string;
    score: number;
    reward: number;
    reasonRef: string;
    chainTx: string;
    judgedAt: number;
    judgeMode: string;
}

export interface InteropPublisher {
    onTaskJudged(signal: ReputationInteropSignal): Promise<void>;
    flushOutbox?(): Promise<InteropOutboxDrainResult>;
}

export interface InteropOutboxDrainResult {
    processed: number;
    failed: number;
    remaining: number;
}

interface InteropOutboxEntry {
    signal: ReputationInteropSignal;
    attempts: number;
    lastError: string;
    queuedAt: number;
}

export interface InteropSink {
    publish(payload: unknown): Promise<void>;
}

export class HttpJsonSink implements InteropSink {
    private readonly timeoutMs: number;

    constructor(
        private readonly options: {
            endpoint: string;
            name: string;
            authToken?: string;
            signatureSecret?: string;
            timeoutMs?: number;
            extraHeaders?: Record<string, string>;
        },
    ) {
        this.timeoutMs = options.timeoutMs ?? 8_000;
    }

    async publish(payload: unknown): Promise<void> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        const body = JSON.stringify(payload);
        const headers: Record<string, string> = {
            'content-type': 'application/json',
            ...this.options.extraHeaders,
        };
        if (this.options.authToken) {
            headers.authorization = `Bearer ${this.options.authToken}`;
        }
        if (this.options.signatureSecret) {
            const timestamp = String(Math.floor(Date.now() / 1000));
            headers['x-gradience-signature-ts'] = timestamp;
            headers['x-gradience-signature'] = signPayload(
                this.options.signatureSecret,
                timestamp,
                body,
            );
        }

        try {
            const response = await fetch(this.options.endpoint, {
                method: 'POST',
                headers,
                body,
                signal: controller.signal,
            });

            if (!response.ok) {
                const message = await response.text();
                throw new Error(
                    `${this.options.name} returned ${response.status}: ${message}`,
                );
            }
        } finally {
            clearTimeout(timeout);
        }
    }
}

export class MappedInteropSink implements InteropSink {
    constructor(
        private readonly sink: InteropSink,
        private readonly mapper: (signal: ReputationInteropSignal) => unknown,
    ) {}

    async publish(payload: unknown): Promise<void> {
        if (!isReputationInteropSignal(payload)) {
            throw new Error('invalid interop payload');
        }
        await this.sink.publish(this.mapper(payload));
    }
}

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
        const feedbackTargets: string[] = [];

        if (this.options.identitySink) {
            await this.withRetry('identity_sink', () =>
                this.options.identitySink?.publish(signal),
            );
            identityPublished = true;
        }

        const feedbackSinks = this.options.feedbackSinks ?? [];
        for (const feedbackSink of feedbackSinks) {
            await this.withRetry(`feedback_sink:${feedbackSink.name}`, () =>
                feedbackSink.sink.publish(signal),
            );
            feedbackTargets.push(feedbackSink.name);
        }

        if (
            this.options.attestationSink &&
            signal.score >= this.minScoreForAttestation
        ) {
            await this.withRetry('attestation_sink', () =>
                this.options.attestationSink?.publish(signal),
            );
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
                    identityRegistered: identityPublished,
                    feedbackTargets,
                    erc8004FeedbackPublished: feedbackTargets.includes('erc8004_feedback'),
                    istranaFeedbackPublished: feedbackTargets.includes('istrana_feedback'),
                    evmReputationPublished: feedbackTargets.includes(
                        'evm_reputation_relay',
                    ),
                    attestationPublished,
                }),
            );
        }
    }

    private async enqueueOutbox(
        signal: ReputationInteropSignal,
        reason: string,
    ): Promise<void> {
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
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
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
        const body =
            entries.length === 0
                ? ''
                : `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`;
        await writeFile(tempPath, body, 'utf8');
        await rename(tempPath, this.outboxFilePath);
    }

    private async withRetry(
        name: string,
        fn: () => Promise<void> | undefined,
    ): Promise<void> {
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
                this.logger.warn(
                    `${name} failed on attempt ${attempt}, retrying in ${delayMs}ms: ${asMessage(
                        error,
                    )}`,
                );
                await wait(delayMs);
            }
        }

        throw new Error(`${name} failed after ${maxAttempts} attempts: ${asMessage(lastError)}`);
    }
}

export function buildInteropPublisherFromEnv(
    env: NodeJS.ProcessEnv,
    options: {
        retryPolicy?: RetryPolicy;
        logger?: Pick<Console, 'warn' | 'error'>;
    } = {},
): InteropPublisher | null {
    const token = env.JUDGE_DAEMON_INTEROP_AUTH_TOKEN;
    const signatureSecret = env.JUDGE_DAEMON_INTEROP_SIGNING_SECRET;
    const outboxFilePath = env.JUDGE_DAEMON_INTEROP_OUTBOX_FILE;
    const identityEndpoint = env.JUDGE_DAEMON_ERC8004_IDENTITY_ENDPOINT;
    const feedback804Endpoint = env.JUDGE_DAEMON_ERC8004_FEEDBACK_ENDPOINT;
    const evmReputationRelayEndpoint =
        env.JUDGE_DAEMON_EVM_REPUTATION_RELAY_ENDPOINT;
    const istranaEndpoint = env.JUDGE_DAEMON_ISTRANA_FEEDBACK_ENDPOINT;
    const attestationEndpoint = env.JUDGE_DAEMON_SAS_ATTESTATION_ENDPOINT;
    const agentImInteropEndpoint = env.JUDGE_DAEMON_AGENT_IM_INTEROP_ENDPOINT;
    const feedbackSinks: Array<{ name: string; sink: InteropSink }> = [];

    if (feedback804Endpoint) {
        feedbackSinks.push(
            {
                name: 'erc8004_feedback',
                sink: new MappedInteropSink(
                    new HttpJsonSink({
                        endpoint: feedback804Endpoint,
                        name: 'erc8004_feedback',
                        authToken: token,
                        signatureSecret,
                    }),
                    toErc8004FeedbackPayload,
                ),
            },
        );
    }
    if (istranaEndpoint) {
        feedbackSinks.push(
            {
                name: 'istrana_feedback',
                sink: new MappedInteropSink(
                    new HttpJsonSink({
                        endpoint: istranaEndpoint,
                        name: 'istrana_feedback',
                        authToken: token,
                        signatureSecret,
                    }),
                    toIstranaFeedbackPayload,
                ),
            },
        );
    }
    if (evmReputationRelayEndpoint) {
        feedbackSinks.push({
            name: 'evm_reputation_relay',
            sink: new MappedInteropSink(
                new HttpJsonSink({
                    endpoint: evmReputationRelayEndpoint,
                    name: 'evm_reputation_relay',
                    authToken: token,
                    signatureSecret,
                }),
                toEvmReputationRelayPayload,
            ),
        });
    }

    if (
        !identityEndpoint &&
        feedbackSinks.length === 0 &&
        !attestationEndpoint &&
        !agentImInteropEndpoint
    ) {
        return null;
    }

    return new InteropPipeline({
        identitySink: identityEndpoint
            ? new MappedInteropSink(
                  new HttpJsonSink({
                      endpoint: identityEndpoint,
                      name: 'erc8004_identity',
                      authToken: token,
                      signatureSecret,
                  }),
                  toErc8004RegistrationPayload,
              )
            : undefined,
        feedbackSinks,
        attestationSink: attestationEndpoint
            ? new MappedInteropSink(
                  new HttpJsonSink({
                      endpoint: attestationEndpoint,
                      name: 'sas_attestation',
                      authToken: token,
                      signatureSecret,
                  }),
                  toTaskCompletionAttestationPayload,
              )
            : undefined,
        statusSink: agentImInteropEndpoint
            ? new HttpJsonSink({
                  endpoint: agentImInteropEndpoint,
                  name: 'agent_im_interop_status',
                  authToken: token,
                  signatureSecret,
              })
            : undefined,
        outboxFilePath,
        retryPolicy: options.retryPolicy,
        logger: options.logger,
    });
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function signPayload(secret: string, timestamp: string, body: string): string {
    const value = `${timestamp}.${body}`;
    return createHmac('sha256', secret).update(value).digest('hex');
}

function toErc8004RegistrationPayload(signal: ReputationInteropSignal): unknown {
    return {
        type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
        name: signal.winner,
        description: 'Agent participating in Gradience Protocol',
        services: [
            {
                name: 'gradience',
                endpoint: 'solana:gradience',
                version: '0.3',
            },
            {
                name: 'a2a',
                endpoint: 'a2a:gradience',
                version: '0.1',
            },
        ],
        supportedTrust: ['reputation', 'crypto-economic'],
        registrations: [
            {
                agentId: signal.winner,
                agentRegistry: 'solana:101:metaplex',
            },
        ],
        gradience: {
            firstTaskId: signal.taskId,
            firstJudgeTx: signal.chainTx,
        },
    };
}

function toErc8004FeedbackPayload(signal: ReputationInteropSignal): unknown {
    return {
        tag1: 'taskScore',
        tag2: `category-${signal.category}`,
        value: signal.score,
        valueDecimals: 0,
        endpoint: 'solana:gradience',
        gradience: {
            taskId: signal.taskId,
            winner: signal.winner,
            poster: signal.poster,
            judge: signal.judge,
            reward: signal.reward,
            reasonRef: signal.reasonRef,
            chainTx: signal.chainTx,
            judgedAt: signal.judgedAt,
        },
    };
}

function toIstranaFeedbackPayload(signal: ReputationInteropSignal): unknown {
    return {
        protocol: 'gradience',
        event: 'task_judged',
        taskId: signal.taskId,
        category: signal.category,
        score: signal.score,
        winner: signal.winner,
        poster: signal.poster,
        judge: signal.judge,
        reward: signal.reward,
        txSignature: signal.chainTx,
        judgedAt: signal.judgedAt,
        reasonRef: signal.reasonRef,
    };
}

function toTaskCompletionAttestationPayload(signal: ReputationInteropSignal): unknown {
    return {
        schema: 'TaskCompletion',
        data: {
            taskId: signal.taskId,
            taskCategory: signal.category,
            judgeMethod: signal.judgeMode,
            score: signal.score,
            rewardAmount: signal.reward,
            completedAt: signal.judgedAt,
            winner: signal.winner,
            reasonRef: signal.reasonRef,
            chainTx: signal.chainTx,
        },
    };
}

function toEvmReputationRelayPayload(signal: ReputationInteropSignal): unknown {
    const categoryScores = [0, 0, 0, 0, 0, 0, 0, 0];
    if (signal.category >= 0 && signal.category < categoryScores.length) {
        categoryScores[signal.category] = clampScore(signal.score);
    }
    return {
        protocol: 'gradience',
        event: 'submit_reputation',
        payload: {
            agentPubkey: signal.winner,
            globalScore: clampScore(signal.score),
            categoryScores,
            sourceChain: 'solana',
            timestamp: signal.judgedAt,
        },
        gradience: {
            taskId: signal.taskId,
            reasonRef: signal.reasonRef,
            txSignature: signal.chainTx,
            judge: signal.judge,
        },
    };
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
        typeof signal.judgeMode === 'string'
    );
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
