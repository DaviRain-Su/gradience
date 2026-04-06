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

// ============================================================================
// Constants
// ============================================================================

export const TEXT_ENCODER = new TextEncoder();

export const MAX_CATEGORIES = 8;

export const STAKE_DISCRIMINATOR = 0x06;

export const PROGRAM_CONFIG_DISCRIMINATOR = 0x09;

export const CATEGORY_NAME_TO_ID = new Map<string, number>([
    ['ml', 0],
    ['llm', 1],
    ['vision', 2],
    ['nlp', 3],
    ['robotics', 4],
    ['game', 5],
    ['data', 6],
    ['other', 7],
]);

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse command-line flags from tokens
 */
export function parseFlags(tokens: string[]): Map<string, string> {
    const flags = new Map<string, string>();
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token?.startsWith('--')) {
            const key = token.slice(2);
            const value = tokens[i + 1];
            if (value && !value.startsWith('--')) {
                flags.set(key, value);
                i++;
            }
        }
    }
    return flags;
}

/**
 * Parse a required flag value
 */
export function requiredFlag(flags: Map<string, string>, key: string): string {
    const value = flags.get(key);
    if (value === undefined) {
        throw new CliError('MISSING_FLAG', `Missing required flag: --${key}`);
    }
    return value;
}

/**
 * Parse a u64 value from string
 */
export function parseU64(value: string | undefined, name: string): bigint {
    if (value === undefined || value === '') {
        throw new CliError('INVALID_ARGUMENT', `${name} is required`);
    }
    try {
        const num = BigInt(value);
        if (num < 0n) {
            throw new CliError('INVALID_ARGUMENT', `${name} must be non-negative`);
        }
        return num;
    } catch {
        throw new CliError('INVALID_ARGUMENT', `${name} must be a valid number`);
    }
}

/**
 * Parse a Solana address from string
 */
export function parseAddress(value: string | undefined, name: string): Address {
    if (value === undefined || value === '') {
        throw new CliError('INVALID_ARGUMENT', `${name} is required`);
    }
    return value as Address;
}

/**
 * Convert task state to CLI display format
 */
export function toCliTaskState(value: string): string {
    return value.toLowerCase().replace(/_/g, '-');
}

/**
 * Check if value is a valid task command
 */
export function isTaskCommand(value: string): value is TaskCommand {
    return ['post', 'apply', 'submit', 'status', 'judge', 'cancel', 'refund'].includes(value);
}

/**
 * Check if value is a valid judge command
 */
export function isJudgeCommand(value: string): value is JudgeCommand {
    return ['register', 'unstake'].includes(value);
}

/**
 * Check if value is a valid profile command
 */
export function isProfileCommand(value: string): value is ProfileCommand {
    return ['show', 'update', 'publish'].includes(value);
}

/**
 * Check if mock task mode is enabled
 */
export function isMockTaskMode(env: NodeJS.ProcessEnv): boolean {
    return env.GRADIENCE_CLI_MOCK_TASK === 'true';
}

/**
 * Parse category string into array of category IDs
 */
export function parseCategories(raw: string): number[] {
    if (!raw) return [];
    const parts = raw.split(',').map((p) => p.trim().toLowerCase());
    const ids: number[] = [];
    for (const part of parts) {
        const id = CATEGORY_NAME_TO_ID.get(part) ?? parseInt(part, 10);
        if (Number.isNaN(id) || id < 0 || id >= MAX_CATEGORIES) {
            throw new CliError('INVALID_ARGUMENT', `Invalid category: ${part}`);
        }
        ids.push(id);
    }
    return ids;
}

/**
 * Append remaining accounts to an instruction
 */
export function appendRemainingAccounts(
    instruction: InstructionLike,
    remaining: AccountMeta[],
): InstructionLike {
    return {
        ...instruction,
        accounts: [...instruction.accounts, ...remaining],
    };
}

// ============================================================================
// SDK Helper Functions (moved from gradience.ts during refactor)
// ============================================================================

import type { GradienceSDK } from '@gradiences/arena-sdk';
import { GRADIENCE_PROGRAM_ADDRESS } from '@gradiences/arena-sdk';
import { getProgramDerivedAddress } from '@solana/kit';

/**
 * Fetch poster address for a task
 */
export async function fetchPosterAddress(sdk: GradienceSDK, taskId: number): Promise<Address> {
    const task = await sdk.getTask(taskId);
    if (!task) {
        throw new CliError('NOT_FOUND', `Task ${taskId} not found`);
    }
    return parseAddress(task.poster, 'poster');
}

/**
 * Find Config PDA
 */
export async function findConfigPda(): Promise<readonly [Address, number]> {
    const { address } = await import('@solana/kit');
    return getProgramDerivedAddress({
        programAddress: GRADIENCE_PROGRAM_ADDRESS,
        seeds: [TEXT_ENCODER.encode('config')],
    });
}

/**
 * Find Stake PDA for a judge
 */
export async function findStakePda(judge: Address): Promise<readonly [Address, number]> {
    const { getAddressEncoder } = await import('@solana/kit');
    return getProgramDerivedAddress({
        programAddress: GRADIENCE_PROGRAM_ADDRESS,
        seeds: [TEXT_ENCODER.encode('stake'), getAddressEncoder().encode(judge)],
    });
}

/**
 * Find Reputation PDA for an agent
 */
export async function findReputationPda(agent: Address): Promise<readonly [Address, number]> {
    const { getAddressEncoder } = await import('@solana/kit');
    return getProgramDerivedAddress({
        programAddress: GRADIENCE_PROGRAM_ADDRESS,
        seeds: [TEXT_ENCODER.encode('reputation'), getAddressEncoder().encode(agent)],
    });
}

/**
 * Find Judge Pool PDA for a category
 */
export async function findJudgePoolPda(categoryId: number): Promise<readonly [Address, number]> {
    const { getAddressEncoder, address } = await import('@solana/kit');
    const categoryBytes = new Uint8Array(1);
    categoryBytes[0] = categoryId;
    return getProgramDerivedAddress({
        programAddress: GRADIENCE_PROGRAM_ADDRESS,
        seeds: [TEXT_ENCODER.encode('judge_pool'), categoryBytes],
    });
}

/**
 * Fetch minimum judge stake from program config
 */
export async function fetchMinJudgeStake(): Promise<bigint> {
    // Default value - should be fetched from on-chain config
    return 100000000n; // 0.1 SOL in lamports
}

/**
 * Fetch stake categories
 */
export async function fetchStakeCategories(): Promise<number[]> {
    // Default categories - should be fetched from on-chain config
    return [0, 1, 2, 3, 4, 5, 6, 7];
}
