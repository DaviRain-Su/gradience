/**
 * Risk Scorer API Routes — GRA-261
 *
 * On-chain risk assessment for Agent wallet pre-check.
 */

import type { FastifyInstance } from 'fastify';
import { createOnChainRiskScorer } from '../../risk/onchain-risk-scorer.js';
import { logger } from '../../utils/logger.js';

const scorer = createOnChainRiskScorer();

export function registerRiskRoutes(app: FastifyInstance): void {
    // -------------------------------------------------------------------------
    // Assess wallet risk
    // -------------------------------------------------------------------------
    app.post<{
        Body: { wallet: string; chain?: 'solana' | 'ethereum' };
    }>('/api/v1/risk/assess', async (request, reply) => {
        try {
            const { wallet, chain = 'solana' } = request.body;

            if (!wallet || typeof wallet !== 'string') {
                return reply.code(400).send({ error: 'wallet address is required' });
            }

            const result = await scorer.assess(wallet, chain);
            const allowed = scorer.isAllowed(result);

            return {
                wallet: result.wallet,
                overallRisk: result.overallRisk,
                score: result.score,
                signals: result.signals,
                allowed,
                checkedAt: result.checkedAt,
                cacheHit: false,
            };
        } catch (err: any) {
            logger.error({ err }, 'Failed to assess wallet risk');
            return reply.code(500).send({ error: err.message || 'Risk assessment failed' });
        }
    });

    // -------------------------------------------------------------------------
    // Check if wallet is allowed under current policy
    // -------------------------------------------------------------------------
    app.get<{
        Params: { wallet: string };
        Querystring: { chain?: 'solana' | 'ethereum' };
    }>('/api/v1/risk/allowed/:wallet', async (request, reply) => {
        try {
            const { wallet } = request.params;
            const { chain = 'solana' } = request.query;

            const result = await scorer.assess(wallet, chain);
            return {
                wallet: result.wallet,
                allowed: scorer.isAllowed(result),
                score: result.score,
                overallRisk: result.overallRisk,
            };
        } catch (err: any) {
            logger.error({ err, wallet: request.params.wallet }, 'Failed to check risk allowance');
            return reply.code(500).send({ error: err.message || 'Risk check failed' });
        }
    });

    logger.info('Risk scorer API routes registered: /api/v1/risk/*');
}
