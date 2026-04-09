/**
 * Trading Utilities
 *
 * Shared utility functions for trading handlers
 */
import { Connection } from '@solana/web3.js';
import { ExecutionContext } from '../../engine/step-executor.js';
import { TritonCascadeClient } from '../../triton-cascade/index.js';
import type { Signer } from '@solana/web3.js';

/**
 * Get Solana connection (legacy - kept for backward compatibility)
 * @deprecated Use getCascadeClient instead
 */
export function getConnection(): Connection {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    return new Connection(rpcUrl, 'confirmed');
}

/**
 * Get Triton Cascade client for high-performance transaction delivery
 */
export function getCascadeClient(): TritonCascadeClient {
    return new TritonCascadeClient({
        rpcEndpoint: process.env.TRITON_RPC_ENDPOINT || 'https://api.triton.one/rpc',
        apiToken: process.env.TRITON_API_TOKEN,
        network: (process.env.SOLANA_NETWORK as 'mainnet' | 'devnet') || 'devnet',
        connectionTimeoutMs: 10000,
        confirmationTimeoutMs: 60000,
        maxRetries: 3,
        enableJitoBundle: process.env.ENABLE_JITO_BUNDLE === 'true',
        priorityFeeStrategy: 'auto',
    });
}

/**
 * Get signer from context or environment
 */
export async function getSigner(context: ExecutionContext): Promise<Signer> {
    // In real implementation, this would come from wallet adapter
    // For now, we'll need to implement a proper key management system
    throw new Error('Signer not provided. Please set up wallet connection.');
}
