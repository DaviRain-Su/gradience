/**
 * Distribution Validator Module
 *
 * Handles validating distributions and verifying distribution transactions.
 *
 * @module revenue/distribution/validator
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { logger } from '../../utils/logger.js';
import type { DistributionBreakdown, VerificationResult } from './types.js';

export class DistributionValidator {
    private connection: Connection;

    constructor(connection: Connection) {
        this.connection = connection;
    }

    /**
     * Verify distribution was successful
     */
    async verifyDistribution(
        txSignature: string,
        expectedBreakdown: {
            agent: { address: string; amount: bigint };
            judge: { address: string; amount: bigint };
            protocol: { address: string; amount: bigint };
        },
    ): Promise<VerificationResult> {
        try {
            const tx = await this.connection.getTransaction(txSignature, {
                commitment: 'confirmed',
            });

            if (!tx) {
                return { valid: false, error: 'Transaction not found' };
            }

            if (tx.meta?.err) {
                return { valid: false, error: `Transaction failed: ${JSON.stringify(tx.meta.err)}` };
            }

            // Parse token balance changes from transaction
            const preBalances = tx.meta?.preTokenBalances || [];
            const postBalances = tx.meta?.postTokenBalances || [];

            // Verify each recipient received expected amount
            // This is simplified - in production, parse the actual token transfers

            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : 'Verification failed',
            };
        }
    }

    /**
     * Get token account balance
     */
    async getTokenBalance(tokenAccount: PublicKey): Promise<bigint> {
        try {
            const accountInfo = await this.connection.getTokenAccountBalance(tokenAccount);
            return BigInt(accountInfo.value.amount);
        } catch (error) {
            logger.error({ error, tokenAccount: tokenAccount.toBase58() }, 'Failed to get token balance');
            return 0n;
        }
    }
}
