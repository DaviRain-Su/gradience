/**
 * Lightweight Payments Health Check
 *
 * Runs during daemon startup to verify RPC connectivity and payment
 * configuration without spending gas.
 */

import { Connection } from '@solana/web3.js';
import { createPublicClient, http } from 'viem';
import type { DaemonConfig } from '../config.js';
import { logger } from '../utils/logger.js';

export interface PaymentsHealthResult {
    solana: { ok: boolean; error?: string };
    evm: { ok: boolean; error?: string };
    x402: { ok: boolean; missing: string[] };
}

export async function runPaymentsHealthCheck(config: DaemonConfig): Promise<PaymentsHealthResult> {
    const result: PaymentsHealthResult = {
        solana: { ok: false },
        evm: { ok: false },
        x402: { ok: false, missing: [] },
    };

    // 1. Solana RPC check
    try {
        const connection = new Connection(config.solanaRpcUrl, 'confirmed');
        const version = await connection.getVersion();
        result.solana.ok = true;
        logger.info({ solanaRpc: config.solanaRpcUrl, version: version['solana-core'] }, 'Solana RPC healthy');
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.solana.error = message;
        logger.warn({ error: message, solanaRpc: config.solanaRpcUrl }, 'Solana RPC health check failed');
    }

    // 2. EVM RPC check
    if (config.evmRpcUrl) {
        try {
            const publicClient = createPublicClient({
                transport: http(config.evmRpcUrl),
            });
            const chainId = await publicClient.getChainId();
            result.evm.ok = true;
            logger.info({ evmRpc: config.evmRpcUrl, chainId }, 'EVM RPC healthy');
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            result.evm.error = message;
            logger.warn({ error: message, evmRpc: config.evmRpcUrl }, 'EVM RPC health check failed');
        }
    } else {
        result.evm.ok = true; // not configured, so no issue
        logger.info('EVM RPC not configured, skipping EVM health check');
    }

    // 3. X402 config check
    const missing: string[] = [];
    if (!config.x402EvmSettlementAddress) missing.push('x402EvmSettlementAddress');
    if (!config.x402EvmPrivateKey) missing.push('x402EvmPrivateKey');
    result.x402 = { ok: missing.length === 0, missing };
    if (missing.length > 0) {
        logger.warn({ missing }, 'X402 EVM configuration incomplete');
    } else {
        logger.info('X402 EVM configuration complete');
    }

    return result;
}
