/**
 * Type definitions for Gradience CLI
 * Extracted from gradience.ts
 */

import type { Instruction, AccountMeta, Address } from '@solana/kit';

/** Supported configuration keys */
export type ConfigKey = 'rpc' | 'keypair';

/** CLI configuration structure */
export interface GradienceConfig {
    rpc?: string;
    keypair?: string;
    updatedAt?: string;
}

/** Available task commands */
export type TaskCommand = 'post' | 'apply' | 'submit' | 'status' | 'judge' | 'cancel' | 'refund';

/** Available judge commands */
export type JudgeCommand = 'register' | 'unstake';

/** Available profile commands */
export type ProfileCommand = 'show' | 'update' | 'publish';

/** Instruction-like type with required accounts */
export type InstructionLike = Instruction & { accounts: readonly AccountMeta[] };

/** CLI error structure */
export interface CliErrorLike {
    code: string;
    message: string;
}

/** Agent profile API response structure */
export interface AgentProfileApiResponse {
    agent: string;
    display_name: string;
    bio: string;
    links: {
        website?: string;
        github?: string;
        x?: string;
    };
    onchain_ref: string | null;
    publish_mode: 'manual' | 'git-sync';
    updated_at: number;
}

/** Byte reader utility for parsing account data */
export declare class ByteReader {
    private readonly data: Uint8Array;
    private readonly view: DataView;
    private offset: number;

    constructor(data: Uint8Array);
    readU8(): number;
    readU64(): bigint;
    skip(count: number): void;
    readFixedArray(size: number): Uint8Array;
}

/** CLI error class */
export class CliError extends Error {
    readonly code: string;

    constructor(code: string, message: string) {
        super(message);
        this.code = code;
    }
}

/** Profile publish mode */
export type ProfilePublishMode = 'manual' | 'git-sync';
