import { address, createSolanaRpc, type Address } from '@solana/kit';

import type { ReputationInteropSignal } from '../types.js';

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
