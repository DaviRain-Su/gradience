/**
 * SDK utilities for Gradience CLI
 * Extracted from gradience.ts
 */

import { readFile } from 'node:fs/promises';
import { createKeyPairSignerFromBytes, createSolanaRpc } from '@solana/kit';
import { GradienceSDK, KeypairAdapter } from '@gradiences/arena-sdk';
import { CliError } from '../types.js';

/**
 * Creates a Gradience SDK instance
 * @param env - Process environment variables
 * @returns Configured GradienceSDK instance
 */
export function createSdk(env: NodeJS.ProcessEnv): GradienceSDK {
    return new GradienceSDK({
        indexerEndpoint: env.GRADIENCE_INDEXER_ENDPOINT,
    });
}

/**
 * Creates a Solana RPC client
 * @param rpcEndpoint - RPC endpoint URL
 * @returns Solana RPC client
 */
export function createRpcClient(rpcEndpoint: string) {
    return createSolanaRpc(rpcEndpoint as Parameters<typeof createSolanaRpc>[0]);
}

/**
 * Loads a keypair signer from a file path
 * @param keypairPath - Path to the keypair JSON file
 * @returns Keypair signer
 * @throws {CliError} If the keypair file is invalid or cannot be read
 */
export async function loadKeypairSigner(keypairPath: string) {
    let raw: string;
    try {
        raw = await readFile(keypairPath, 'utf8');
    } catch {
        throw new CliError('CONFIG_MISSING', `Unable to read keypair file: ${keypairPath}`);
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new CliError('INVALID_ARGUMENT', `Invalid keypair json: ${keypairPath}`);
    }
    if (!Array.isArray(parsed) || parsed.length !== 64 || parsed.some(value => !isByte(value))) {
        throw new CliError('INVALID_ARGUMENT', 'Keypair file must be a 64-element array of byte values');
    }

    const bytes = Uint8Array.from(parsed as number[]);
    return createKeyPairSignerFromBytes(bytes);
}

/**
 * Creates a keypair adapter for wallet operations
 * @param rpcEndpoint - RPC endpoint URL
 * @param keypairPath - Path to keypair file
 * @returns KeypairAdapter instance
 */
export async function createKeypairAdapter(rpcEndpoint: string, keypairPath: string): Promise<KeypairAdapter> {
    const signer = await loadKeypairSigner(keypairPath);
    return new KeypairAdapter({
        signer,
        rpcEndpoint,
    });
}

/**
 * Checks if a value is a valid byte (0-255)
 * @param value - Value to check
 * @returns True if the value is a valid byte
 */
function isByte(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255;
}
