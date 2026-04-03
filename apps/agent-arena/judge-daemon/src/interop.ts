import { createHmac } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { address, createSolanaRpc, type Address } from '@solana/kit';

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
    participants?: string[];
}

type InteropRole = 'winner' | 'poster' | 'judge' | 'loser';

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

interface IdentityDispatch {
    signal: ReputationInteropSignal;
    role: InteropRole;
    agent: string;
}

interface FeedbackDispatch {
    signal: ReputationInteropSignal;
    role: InteropRole;
    agent: string;
    roleScore: number;
}

export interface SasOnChainAttestationOptions {
    wallet: OnChainAttestationWallet;
    rpcEndpoint: string;
    credentialPda: Address;
    schemaPda: Address;
    moduleName?: string;
    idempotent?: boolean;
}

export interface OnChainAttestationWallet {
    signer: unknown;
    signAndSendTransaction(instructions: readonly unknown[]): Promise<string>;
}

interface SasLibLike {
    fetchSchema: (rpc: unknown, schema: Address) => Promise<{ data?: unknown } | unknown>;
    fetchMaybeAttestation?: (rpc: unknown, attestation: Address) => Promise<{ exists?: boolean } | null>;
    serializeAttestationData: (schema: unknown, data: Record<string, unknown>) => Uint8Array;
    deriveAttestationPda: (input: {
        credential: Address;
        schema: Address;
        nonce: Address;
    }) => Promise<readonly [Address, number]> | readonly [Address, number];
    getCreateAttestationInstruction: (input: {
        payer: OnChainAttestationWallet['signer'];
        authority: OnChainAttestationWallet['signer'];
        credential: Address;
        schema: Address;
        attestation: Address;
        nonce: Address;
        data: Uint8Array;
        expiry: bigint;
    }) => unknown;
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
            headers['x-gradience-signature'] = signPayload(this.options.signatureSecret, timestamp, body);
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
                throw new Error(`${this.options.name} returned ${response.status}: ${message}`);
            }
        } finally {
            clearTimeout(timeout);
        }
    }
}

export class MappedInteropSink implements InteropSink {
    constructor(
        private readonly sink: InteropSink,
        private readonly mapper: (payload: unknown) => unknown | unknown[],
        private readonly validator?: (payload: unknown) => boolean,
    ) {}

    async publish(payload: unknown): Promise<void> {
        if (this.validator && !this.validator(payload)) {
            throw new Error('invalid interop payload');
        }
        const mapped = this.mapper(payload);
        if (Array.isArray(mapped)) {
            for (const entry of mapped) {
                await this.sink.publish(entry);
            }
            return;
        }
        await this.sink.publish(mapped);
    }
}

export class SasOnChainAttestationSink implements InteropSink {
    private readonly rpc: ReturnType<typeof createSolanaRpc>;
    private readonly moduleName: string;
    private readonly idempotent: boolean;
    private modulePromise: Promise<SasLibLike> | null = null;

    constructor(private readonly options: SasOnChainAttestationOptions) {
        this.rpc = createSolanaRpc(options.rpcEndpoint as unknown as Parameters<typeof createSolanaRpc>[0]);
        this.moduleName = options.moduleName ?? 'sas-lib';
        this.idempotent = options.idempotent ?? true;
    }

    async publish(payload: unknown): Promise<void> {
        if (!isReputationInteropSignal(payload)) {
            throw new Error('invalid attestation payload');
        }
        const signal = payload;
        const sas = await this.loadSasModule();
        const schemaAccount = await sas.fetchSchema(this.rpc, this.options.schemaPda);
        const schemaData = (schemaAccount as { data?: unknown })?.data ?? schemaAccount;
        const nonce = address(signal.winner);
        const [attestationPda] = await Promise.resolve(
            sas.deriveAttestationPda({
                credential: this.options.credentialPda,
                schema: this.options.schemaPda,
                nonce,
            }),
        );

        if (this.idempotent && sas.fetchMaybeAttestation) {
            const maybe = await sas.fetchMaybeAttestation(this.rpc, attestationPda);
            if (maybe && (maybe as { exists?: boolean }).exists) {
                return;
            }
        }

        const serializedData = sas.serializeAttestationData(schemaData, {
            taskId: BigInt(signal.taskId),
            taskCategory: signal.category,
            judgeMethod: judgeMethodToCode(signal.judgeMode),
            score: clampScore(signal.score),
            rewardAmount: BigInt(Math.max(0, Math.round(signal.reward))),
            completedAt: BigInt(signal.judgedAt),
        });

        const instruction = sas.getCreateAttestationInstruction({
            payer: this.options.wallet.signer,
            authority: this.options.wallet.signer,
            credential: this.options.credentialPda,
            schema: this.options.schemaPda,
            attestation: attestationPda,
            nonce,
            data: serializedData,
            expiry: 0n,
        });
        await this.options.wallet.signAndSendTransaction([instruction]);
    }

    private async loadSasModule(): Promise<SasLibLike> {
        if (!this.modulePromise) {
            this.modulePromise = import(this.moduleName).then(mod => {
                const required = [
                    'fetchSchema',
                    'serializeAttestationData',
                    'deriveAttestationPda',
                    'getCreateAttestationInstruction',
                ] as const;
                for (const key of required) {
                    if (typeof (mod as Record<string, unknown>)[key] !== 'function') {
                        throw new Error(`sas module missing required export: ${key}`);
                    }
                }
                return mod as unknown as SasLibLike;
            });
        }
        return this.modulePromise;
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

export function buildInteropPublisherFromEnv(
    env: NodeJS.ProcessEnv,
    options: {
        retryPolicy?: RetryPolicy;
        logger?: Pick<Console, 'warn' | 'error'>;
        sasOnChain?: {
            wallet: WalletAdapter;
            rpcEndpoint: string;
        };
    } = {},
): InteropPublisher | null {
    const token = env.JUDGE_DAEMON_INTEROP_AUTH_TOKEN;
    const signatureSecret = env.JUDGE_DAEMON_INTEROP_SIGNING_SECRET;
    const outboxFilePath = env.JUDGE_DAEMON_INTEROP_OUTBOX_FILE;
    const identityEndpoint = env.JUDGE_DAEMON_ERC8004_IDENTITY_ENDPOINT;
    const feedback804Endpoint = env.JUDGE_DAEMON_ERC8004_FEEDBACK_ENDPOINT;
    const evmReputationRelayEndpoint = env.JUDGE_DAEMON_EVM_REPUTATION_RELAY_ENDPOINT;
    const istranaEndpoint = env.JUDGE_DAEMON_ISTRANA_FEEDBACK_ENDPOINT;
    const attestationEndpoint = env.JUDGE_DAEMON_SAS_ATTESTATION_ENDPOINT;
    const attestationMode = env.JUDGE_DAEMON_SAS_ATTESTATION_MODE ?? 'http';
    const sasCredentialPda = env.JUDGE_DAEMON_SAS_CREDENTIAL_PDA;
    const sasSchemaPda = env.JUDGE_DAEMON_SAS_SCHEMA_PDA;
    const sasModuleName = env.JUDGE_DAEMON_SAS_MODULE;
    const agentImInteropEndpoint = env.JUDGE_DAEMON_AGENT_IM_INTEROP_ENDPOINT;
    const feedbackSinks: Array<{ name: string; sink: InteropSink }> = [];

    if (feedback804Endpoint) {
        feedbackSinks.push({
            name: 'erc8004_feedback',
            sink: new MappedInteropSink(
                new HttpJsonSink({
                    endpoint: feedback804Endpoint,
                    name: 'erc8004_feedback',
                    authToken: token,
                    signatureSecret,
                }),
                toErc8004FeedbackPayload,
                isFeedbackDispatch,
            ),
        });
    }
    if (istranaEndpoint) {
        feedbackSinks.push({
            name: 'istrana_feedback',
            sink: new MappedInteropSink(
                new HttpJsonSink({
                    endpoint: istranaEndpoint,
                    name: 'istrana_feedback',
                    authToken: token,
                    signatureSecret,
                }),
                toIstranaFeedbackPayload,
                isFeedbackDispatch,
            ),
        });
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
                isFeedbackDispatch,
            ),
        });
    }

    const shouldUseOnChainAttestation =
        attestationMode === 'onchain' && !!sasCredentialPda && !!sasSchemaPda && !!options.sasOnChain;

    if (
        !identityEndpoint &&
        feedbackSinks.length === 0 &&
        !attestationEndpoint &&
        !shouldUseOnChainAttestation &&
        !agentImInteropEndpoint
    ) {
        return null;
    }

    const attestationSink = shouldUseOnChainAttestation
        ? new SasOnChainAttestationSink({
              wallet: options.sasOnChain!.wallet,
              rpcEndpoint: options.sasOnChain!.rpcEndpoint,
              credentialPda: address(sasCredentialPda!),
              schemaPda: address(sasSchemaPda!),
              moduleName: sasModuleName,
              idempotent: parseBoolEnv(env.JUDGE_DAEMON_SAS_ATTESTATION_IDEMPOTENT, true),
          })
        : attestationEndpoint
          ? new MappedInteropSink(
                new HttpJsonSink({
                    endpoint: attestationEndpoint,
                    name: 'sas_attestation',
                    authToken: token,
                    signatureSecret,
                }),
                payload => toTaskCompletionAttestationPayload(payload as ReputationInteropSignal),
                isReputationInteropSignal,
            )
          : undefined;

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
                  isIdentityDispatch,
              )
            : undefined,
        feedbackSinks,
        attestationSink,
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
    return new Promise(resolve => setTimeout(resolve, ms));
}

function signPayload(secret: string, timestamp: string, body: string): string {
    const value = `${timestamp}.${body}`;
    return createHmac('sha256', secret).update(value).digest('hex');
}

function toErc8004RegistrationPayload(payload: unknown): unknown {
    if (!isIdentityDispatch(payload)) {
        throw new Error('invalid identity dispatch payload');
    }
    const { signal, role, agent } = payload;
    return {
        type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
        agentPubkey: agent,
        name: agent,
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
                agentId: agent,
                agentRegistry: 'solana:101:metaplex',
            },
        ],
        gradience: {
            role,
            firstTaskId: signal.taskId,
            firstJudgeTx: signal.chainTx,
        },
    };
}

function toErc8004FeedbackPayload(payload: unknown): unknown {
    if (!isFeedbackDispatch(payload)) {
        throw new Error('invalid feedback dispatch payload');
    }
    const { signal, role, agent, roleScore } = payload;
    return {
        agentPubkey: agent,
        tag1: 'taskScore',
        tag2: `category-${signal.category}`,
        tag3: `role-${role}`,
        value: roleScore,
        valueDecimals: 0,
        endpoint: 'solana:gradience',
        feedbackURI: signal.reasonRef,
        gradience: {
            taskId: signal.taskId,
            feedbackRole: role,
            feedbackAgent: agent,
            winner: signal.winner,
            poster: signal.poster,
            judge: signal.judge,
            participants: signal.participants ?? [],
            reward: signal.reward,
            reasonRef: signal.reasonRef,
            chainTx: signal.chainTx,
            judgedAt: signal.judgedAt,
        },
    };
}

function toIstranaFeedbackPayload(payload: unknown): unknown {
    if (!isFeedbackDispatch(payload)) {
        throw new Error('invalid feedback dispatch payload');
    }
    const { signal, role, agent, roleScore } = payload;
    return {
        protocol: 'gradience',
        event: 'task_judged',
        taskId: signal.taskId,
        category: signal.category,
        score: roleScore,
        role,
        agent,
        winner: signal.winner,
        poster: signal.poster,
        judge: signal.judge,
        participants: signal.participants ?? [],
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

function toEvmReputationRelayPayload(payload: unknown): unknown {
    if (!isFeedbackDispatch(payload)) {
        throw new Error('invalid feedback dispatch payload');
    }
    const { signal, role, agent, roleScore } = payload;
    const categoryScores = [0, 0, 0, 0, 0, 0, 0, 0];
    if (signal.category >= 0 && signal.category < categoryScores.length) {
        categoryScores[signal.category] = clampScore(roleScore);
    }
    return {
        protocol: 'gradience',
        event: 'submit_reputation',
        payload: {
            agentPubkey: agent,
            role,
            globalScore: clampScore(roleScore),
            categoryScores,
            sourceChain: 'solana',
            timestamp: signal.judgedAt,
        },
        gradience: {
            taskId: signal.taskId,
            reasonRef: signal.reasonRef,
            txSignature: signal.chainTx,
            feedbackRole: role,
            feedbackAgent: agent,
            judge: signal.judge,
        },
    };
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

function isIdentityDispatch(value: unknown): value is IdentityDispatch {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const dispatch = value as Partial<IdentityDispatch>;
    return (
        isReputationInteropSignal(dispatch.signal) && isInteropRole(dispatch.role) && typeof dispatch.agent === 'string'
    );
}

function isFeedbackDispatch(value: unknown): value is FeedbackDispatch {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const dispatch = value as Partial<FeedbackDispatch>;
    return (
        isReputationInteropSignal(dispatch.signal) &&
        isInteropRole(dispatch.role) &&
        typeof dispatch.agent === 'string' &&
        typeof dispatch.roleScore === 'number'
    );
}

function isInteropRole(value: unknown): value is InteropRole {
    return value === 'winner' || value === 'poster' || value === 'judge' || value === 'loser';
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

function parseBoolEnv(value: string | undefined, fallback: boolean): boolean {
    if (!value) {
        return fallback;
    }
    return !['0', 'false', 'False', 'FALSE', 'no', 'off'].includes(value);
}

function judgeMethodToCode(judgeMode: string): number {
    if (judgeMode === 'pool') {
        return 1;
    }
    return 0;
}

function clampScore(score: number): number {
    if (!Number.isFinite(score)) {
        return 0;
    }
    return Math.max(0, Math.min(100, Math.round(score)));
}
