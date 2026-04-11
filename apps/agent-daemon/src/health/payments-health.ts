/**
 * Lightweight Payments Health Check
 *
 * Runs during daemon startup to verify RPC connectivity and payment
 * configuration without spending gas.
 */

import { Connection } from '@solana/web3.js';
import type { DaemonConfig } from '../config.js';
import { logger } from '../utils/logger.js';

export interface PaymentsHealthResult {
    solana: { ok: boolean; error?: string };
}

export async function runPaymentsHealthCheck(config: DaemonConfig): Promise<PaymentsHealthResult> {
    const result: PaymentsHealthResult = {
        solana: { ok: false },
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

    return result;
}
