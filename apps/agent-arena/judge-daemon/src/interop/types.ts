import type { Address } from '@solana/kit';

/**
 * Signal representing a task judgment for reputation interop.
 * Contains all relevant data about the judged task and its outcome.
 */
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

/**
 * Role of an agent in the interop system.
 */
export type InteropRole = 'winner' | 'poster' | 'judge' | 'loser';

/**
 * Publisher interface for handling task judgment events.
 * Implementations can publish signals to various sinks.
 */
export interface InteropPublisher {
    onTaskJudged(signal: ReputationInteropSignal): Promise<void>;
    flushOutbox?(): Promise<InteropOutboxDrainResult>;
}

/**
 * Result of draining the outbox queue.
 */
export interface InteropOutboxDrainResult {
    processed: number;
    failed: number;
    remaining: number;
}

/**
 * Entry in the outbox queue for retrying failed signals.
 */
export interface InteropOutboxEntry {
    signal: ReputationInteropSignal;
    attempts: number;
    lastError: string;
    queuedAt: number;
}

/**
 * Dispatch payload for identity registration.
 */
export interface IdentityDispatch {
    signal: ReputationInteropSignal;
    role: InteropRole;
    agent: string;
}

/**
 * Dispatch payload for feedback delivery.
 */
export interface FeedbackDispatch {
    signal: ReputationInteropSignal;
    role: InteropRole;
    agent: string;
    roleScore: number;
}

/**
 * Options for configuring on-chain attestation via SAS (Solana Attestation Service).
 */
export interface SasOnChainAttestationOptions {
    wallet: OnChainAttestationWallet;
    rpcEndpoint: string;
    credentialPda: Address;
    schemaPda: Address;
    moduleName?: string;
    idempotent?: boolean;
}

/**
 * Wallet interface for signing and sending on-chain attestation transactions.
 */
export interface OnChainAttestationWallet {
    signer: unknown;
    signAndSendTransaction(instructions: readonly unknown[]): Promise<string>;
}

/**
 * Interface representing the SAS library functionality.
 * Used for type-safe interaction with the SAS module.
 */
export interface SasLibLike {
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

/**
 * Sink interface for publishing interop payloads.
 * Implementations handle delivery to various destinations (HTTP, on-chain, etc.).
 */
export interface InteropSink {
    publish(payload: unknown): Promise<void>;
}
