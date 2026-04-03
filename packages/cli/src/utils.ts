import { readFile } from 'node:fs/promises';
import { createKeyPairSignerFromBytes } from '@solana/kit';
import type { Address } from '@solana/kit';
import chalk from 'chalk';

// Solana base58 address regex (32-44 chars)
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Check if a string is a valid Solana address format
 */
export function isValidSolanaAddress(value: string): boolean {
    return SOLANA_ADDRESS_REGEX.test(value);
}

export function isNoJsonMode(): boolean {
    const value = process.env.NO_DNA;
    if (!value) {
        return false;
    }
    return !['0', 'false', 'False', 'FALSE'].includes(value);
}

export function isMockMode(): boolean {
    const value = process.env.GRADIENCE_CLI_MOCK;
    if (!value) {
        return false;
    }
    return !['0', 'false', 'False', 'FALSE'].includes(value);
}

export async function loadKeypairSigner(keypairPath: string) {
    let raw: string;
    try {
        raw = await readFile(keypairPath, 'utf8');
    } catch {
        throw new Error(`Unable to read keypair file: ${keypairPath}`);
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error(`Invalid keypair json: ${keypairPath}`);
    }
    
    if (!Array.isArray(parsed) || parsed.length !== 64 || parsed.some(value => !isByte(value))) {
        throw new Error('Keypair file must be a 64-element array of byte values');
    }

    const bytes = Uint8Array.from(parsed as number[]);
    return createKeyPairSignerFromBytes(bytes);
}

function isByte(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255;
}

export function parseU64(value: string | undefined, name: string): bigint {
    if (!value) {
        throw new Error(`Missing required value: ${name}`);
    }
    let parsed: bigint;
    try {
        parsed = BigInt(value);
    } catch {
        throw new Error(`Invalid integer for ${name}: ${value}`);
    }
    if (parsed < 0n) {
        throw new Error(`${name} must be non-negative`);
    }
    return parsed;
}

export function parseAddress(value: string | undefined, name: string): Address {
    if (!value) {
        throw new Error(`Missing address value for ${name}`);
    }
    if (!isValidSolanaAddress(value)) {
        throw new Error(`Invalid Solana address format for ${name}: ${value}`);
    }
    return value as Address;
}

export function outputResult(result: unknown): void {
    if (isNoJsonMode()) {
        console.log(JSON.stringify(result));
    } else {
        console.log(chalk.green('✓'), 'Success');
        if (typeof result === 'object' && result !== null) {
            for (const [key, value] of Object.entries(result)) {
                if (key !== 'ok') {
                    console.log(`  ${key}: ${value}`);
                }
            }
        }
    }
}

export function outputError(error: unknown, code: string = 'UNKNOWN_ERROR'): void {
    const message = error instanceof Error ? error.message : String(error);
    
    if (isNoJsonMode()) {
        console.error(JSON.stringify({
            ok: false,
            timestamp: new Date().toISOString(),
            error: { code, message },
        }));
    } else {
        console.error(chalk.red('Error:'), message);
    }
}

export interface ParsedFlags {
    get(key: string): string | undefined;
}

export function parseFlags(args: string[]): ParsedFlags {
    const flags = new Map<string, string>();
    
    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (!arg || !arg.startsWith('--')) {
            continue;
        }
        
        const key = arg.slice(2);
        const value = args[i + 1];
        
        if (!value || value.startsWith('--')) {
            throw new Error(`Missing value for --${key}`);
        }
        
        flags.set(key, value);
        i += 1; // Skip the value
    }
    
    return {
        get: (key: string) => flags.get(key),
    };
}