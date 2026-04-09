/**
 * E2E Test Utilities for Solana Devnet
 *
 * Provides test wallet creation, airdrop, and SDK initialization
 */

import { Keypair } from '@solana/web3.js';
import { createSolanaRpc, createKeyPairSignerFromBytes } from '@solana/kit';
import { GradienceSDK } from '@gradiences/arena-sdk';
import { KeypairAdapter } from '@gradiences/arena-sdk';

const DEVNET_RPC = 'https://api.devnet.solana.com';

export interface TestWallet {
    keypair: Keypair;
    address: string;
    sdk: GradienceSDK;
    adapter: Promise<KeypairAdapter>;
}

/**
 * Create a new test wallet for devnet
 */
export async function createTestWallet(): Promise<TestWallet> {
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();

    const sdk = new GradienceSDK({
        indexerEndpoint: process.env.GRADIENCE_INDEXER_ENDPOINT || 'https://api.gradiences.xyz/indexer/',
        rpcEndpoint: DEVNET_RPC,
    });

    const adapter = (async () => {
        const signer = await createKeyPairSignerFromBytes(keypair.secretKey);
        return new KeypairAdapter({
            signer,
            rpcEndpoint: DEVNET_RPC,
        });
    })();

    return {
        keypair,
        address,
        sdk,
        adapter,
    };
}

/**
 * Request airdrop on devnet (1 SOL by default)
 */
export async function airdrop(address: string, solAmount: number = 1): Promise<string> {
    const rpc = createSolanaRpc(DEVNET_RPC);

    const response = await fetch(DEVNET_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'requestAirdrop',
            params: [address, solAmount * 1e9], // Convert to lamports
        }),
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(`Airdrop failed: ${data.error.message}`);
    }

    // Wait for confirmation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return data.result;
}

/**
 * Wait for task state to reach expected value
 */
export async function waitForTaskState(
    sdk: GradienceSDK,
    taskId: number,
    expectedState: string,
    timeoutMs: number = 30000,
): Promise<boolean> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        const task = await sdk.getTask(taskId);
        if (task?.state === expectedState) {
            return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return false;
}

/**
 * Retry wrapper for async operations
 */
export async function retry<T>(fn: () => Promise<T>, retries: number = 3, delayMs: number = 1000): Promise<T> {
    let lastError;

    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (i < retries - 1) {
                await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
            }
        }
    }

    throw lastError;
}
