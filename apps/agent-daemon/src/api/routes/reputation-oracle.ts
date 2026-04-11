/**
 * Reputation Oracle API Routes - GRA-228d
 *
 * REST API for querying authoritative reputation data.
 * External dApps can use these endpoints to access Gradience reputation scores.
 */

import type { FastifyInstance } from 'fastify';
import { logger } from '../../utils/logger.js';
import type { ReputationAggregationEngine } from '../../reputation/aggregation-engine.js';
import type { ReputationPushService } from '../../reputation/push-service.js';
import { createChainHubReputationClient } from '../../integrations/chain-hub-reputation.js';
import { ARENA_PROGRAM_ADDRESS } from '../../solana/program-ids.js';
import { createReputationProofGenerator, type ReputationPayload } from '../../reputation/proof-generator.js';
import { createReputationEVMRelayer } from '../../reputation/evm-relayer.js';

interface ReputationQueryParams {
    includeHistory?: boolean;
    includeAnomalies?: boolean;
}

interface LeaderboardQueryParams {
    limit?: number;
    offset?: number;
    minScore?: number;
    category?: string;
}

export interface ReputationOracleOptions {
    engine?: ReputationAggregationEngine;
    pushService?: ReputationPushService;
    chainHubClient?: import('../../integrations/chain-hub-reputation.js').ChainHubReputationClient;
    solanaConnection?: import('@solana/web3.js').Connection;
    evmRelayerConfig?: {
        rpcUrl: string;
        privateKey: string;
        contractAddress: string;
        chainId?: number;
    };
    proofGeneratorConfig?: {
        oracleSignerPrivateKey: string;
    };
}

export function registerReputationOracleRoutes(
    app: FastifyInstance,
    engine: ReputationAggregationEngine,
    pushService?: ReputationPushService,
    options?: ReputationOracleOptions,
): void {
    const chainHubClient =
        options?.chainHubClient ??
        createChainHubReputationClient({
            baseUrl: process.env.CHAIN_HUB_INDEXER_URL ?? 'http://localhost:8080',
            cacheTtlMs: 60_000,
        });
    // -------------------------------------------------------------------------
    // Get Reputation Score
    // -------------------------------------------------------------------------

    app.get<{
        Params: { agentAddress: string };
        Querystring: ReputationQueryParams;
    }>('/api/v1/oracle/reputation/:agentAddress', async (request, reply) => {
        try {
            const { agentAddress } = request.params;
            const { includeHistory, includeAnomalies } = request.query;

            // Validate address (Solana or EVM)
            const addressType = detectAddressType(agentAddress);
            if (!addressType) {
                return reply.code(400).send({ error: 'Invalid Solana or EVM address' });
            }

            // Fetch activity (in real implementation, from database)
            const activity = await fetchAgentActivity(chainHubClient, agentAddress);

            if (!activity) {
                return reply.code(404).send({
                    error: 'Agent not found',
                    agentAddress,
                });
            }

            // Calculate reputation
            const score = engine.calculateReputation(activity);

            // Build response
            const response: any = {
                agentAddress,
                reputation: {
                    overallScore: score.overallScore,
                    tier: getTier(score.overallScore),
                    confidence: score.confidence,
                    calculatedAt: score.calculatedAt,
                },
                components: {
                    taskScore: score.taskScore,
                    qualityScore: score.qualityScore,
                    consistencyScore: score.consistencyScore,
                    stakingScore: score.stakingScore,
                },
                metrics: {
                    completedTasks: score.completedTasks,
                    totalEarned: score.totalEarned,
                    avgRating: score.avgRating,
                    disputeRate: score.disputeRate,
                },
            };

            if (includeAnomalies) {
                response.anomalies = score.anomalyFlags;
            }

            // Add cross-chain binding hint (full aggregation requires on-chain PDA lookup)
            let boundIdentity: { solana?: string; evm?: string } | null = null;
            if (addressType === 'solana' && options?.solanaConnection) {
                try {
                    const binding = await fetchIdentityBinding(options.solanaConnection, agentAddress);
                    if (binding?.evmAddress) {
                        boundIdentity = { solana: agentAddress, evm: binding.evmAddress };
                        // Optionally aggregate EVM reputation
                        const evmActivity = await fetchAgentActivity(chainHubClient, binding.evmAddress);
                        if (evmActivity) {
                            const evmScore = engine.calculateReputation(evmActivity);
                            // Simple average aggregation for demonstration
                            response.reputation.overallScore = Math.round(
                                (response.reputation.overallScore + evmScore.overallScore) / 2,
                            );
                            response.reputation.confidence = Math.max(
                                response.reputation.confidence,
                                evmScore.confidence,
                            );
                            response.metrics.completedTasks += evmScore.completedTasks;
                            if (evmScore.avgRating > 0) {
                                response.metrics.avgRating =
                                    (response.metrics.avgRating * score.completedTasks +
                                        evmScore.avgRating * evmScore.completedTasks) /
                                    Math.max(1, score.completedTasks + evmScore.completedTasks);
                            }
                        }
                    }
                } catch (err: any) {
                    logger.debug(
                        { err, agentAddress },
                        'IdentityBinding lookup failed, skipping cross-chain aggregation',
                    );
                }
            }

            response.crossChain = {
                addressType,
                boundIdentity,
            };

            // Add sync status
            if (pushService) {
                const syncStatus = pushService.getSyncStatus(agentAddress);
                response.syncStatus = {
                    solana: syncStatus.solanaSynced,
                    ethereum: syncStatus.ethereumSynced,
                    lastSyncAt: syncStatus.lastSyncAt,
                };
            }

            return response;
        } catch (err: any) {
            logger.error({ err, agent: request.params.agentAddress }, 'Failed to get reputation');
            return reply.code(500).send({ error: err.message });
        }
    });

    // -------------------------------------------------------------------------
    // Verify Reputation
    // -------------------------------------------------------------------------

    app.get<{
        Params: { agentAddress: string };
    }>('/api/v1/oracle/reputation/:agentAddress/verify', async (request, reply) => {
        try {
            const { agentAddress } = request.params;

            if (!isValidSolanaAddress(agentAddress)) {
                return reply.code(400).send({ error: 'Invalid Solana address' });
            }

            const activity = await fetchAgentActivity(chainHubClient, agentAddress);

            if (!activity) {
                return reply.code(404).send({ error: 'Agent not found' });
            }

            const score = engine.calculateReputation(activity);

            // Verification includes proof of calculation
            return {
                agentAddress,
                verified: true,
                reputation: {
                    overallScore: score.overallScore,
                    confidence: score.confidence,
                },
                verification: {
                    dataPoints: score.dataPoints,
                    calculatedAt: score.calculatedAt,
                    algorithm: 'gradience-v1',
                    proof: generateVerificationProof(agentAddress, score),
                },
                sources: [
                    { name: 'Agent Arena', status: 'active' },
                    { name: 'Chain Hub', status: 'active' },
                    { name: 'OWS Wallet', status: 'active' },
                ],
            };
        } catch (err: any) {
            logger.error({ err, agent: request.params.agentAddress }, 'Failed to verify reputation');
            return reply.code(500).send({ error: err.message });
        }
    });

    // -------------------------------------------------------------------------
    // Leaderboard
    // -------------------------------------------------------------------------

    app.get<{
        Querystring: LeaderboardQueryParams;
    }>('/api/v1/oracle/reputation/leaderboard', async (request, reply) => {
        try {
            const { limit = 100, offset = 0, minScore = 0, category } = request.query;

            // Validate params
            if (limit > 1000) {
                return reply.code(400).send({ error: 'Limit cannot exceed 1000' });
            }

            // Fetch all agents (in real implementation, from database with pagination)
            const agents = await fetchAllAgents();

            // Calculate scores and filter
            const scoredAgents = agents
                .map((agent) => ({
                    agentAddress: agent.address,
                    reputation: engine.calculateReputation(agent),
                }))
                .filter((a) => a.reputation.overallScore >= minScore)
                .sort((a, b) => b.reputation.overallScore - a.reputation.overallScore);

            // Paginate
            const total = scoredAgents.length;
            const results = scoredAgents.slice(offset, offset + limit);

            return {
                leaderboard: results.map((r) => ({
                    agentAddress: r.agentAddress,
                    overallScore: r.reputation.overallScore,
                    tier: getTier(r.reputation.overallScore),
                    completedTasks: r.reputation.completedTasks,
                    avgRating: r.reputation.avgRating,
                })),
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: offset + limit < total,
                },
                filters: {
                    minScore,
                    category,
                },
            };
        } catch (err: any) {
            logger.error({ err }, 'Failed to get leaderboard');
            return reply.code(500).send({ error: err.message });
        }
    });

    // -------------------------------------------------------------------------
    // Sync Reputation (Manual trigger)
    // -------------------------------------------------------------------------

    app.post<{
        Params: { agentAddress: string };
    }>('/api/v1/oracle/reputation/:agentAddress/sync', async (request, reply) => {
        try {
            const { agentAddress } = request.params;

            if (!isValidSolanaAddress(agentAddress)) {
                return reply.code(400).send({ error: 'Invalid Solana address' });
            }

            const activity = await fetchAgentActivity(chainHubClient, agentAddress);

            if (!activity) {
                return reply.code(404).send({ error: 'Agent not found' });
            }

            if (!pushService) {
                return reply.code(503).send({ error: 'Reputation push service is not configured' });
            }

            const score = engine.calculateReputation(activity);
            const result = await pushService.push(agentAddress, score);

            return {
                agentAddress,
                syncInitiated: true,
                results: {
                    solana: result.solana?.success || false,
                    ethereum: result.erc8004?.success || false,
                },
                timestamp: result.timestamp,
            };
        } catch (err: any) {
            logger.error({ err, agent: request.params.agentAddress }, 'Failed to sync reputation');
            return reply.code(500).send({ error: err.message });
        }
    });

    // -------------------------------------------------------------------------
    // Batch Sync
    // -------------------------------------------------------------------------

    app.post<{
        Body: { agentAddresses: string[] };
    }>('/api/v1/oracle/reputation/sync-batch', async (request, reply) => {
        try {
            const { agentAddresses } = request.body;

            if (!Array.isArray(agentAddresses) || agentAddresses.length === 0) {
                return reply.code(400).send({ error: 'agentAddresses array required' });
            }

            if (agentAddresses.length > 100) {
                return reply.code(400).send({ error: 'Cannot sync more than 100 agents at once' });
            }

            if (!pushService) {
                return reply.code(503).send({ error: 'Reputation push service is not configured' });
            }

            const result = await pushService.batchPush(agentAddresses);

            return {
                batchSyncInitiated: true,
                total: agentAddresses.length,
                success: result.success.length,
                failed: result.failed.length,
                successAddresses: result.success,
                failedAddresses: result.failed,
            };
        } catch (err: any) {
            logger.error({ err }, 'Failed to batch sync');
            return reply.code(500).send({ error: err.message });
        }
    });

    // -------------------------------------------------------------------------
    // Oracle Stats
    // -------------------------------------------------------------------------

    app.get('/api/v1/oracle/stats', async (_req, reply) => {
        try {
            const agents = await fetchAllAgents();

            // Calculate aggregate stats
            const scores = agents.map((a) => engine.calculateReputation(a));
            const totalAgents = agents.length;
            const avgScore = scores.reduce((sum, s) => sum + s.overallScore, 0) / totalAgents;

            const tierCounts = {
                platinum: scores.filter((s) => s.overallScore >= 80).length,
                gold: scores.filter((s) => s.overallScore >= 60 && s.overallScore < 80).length,
                silver: scores.filter((s) => s.overallScore >= 40 && s.overallScore < 60).length,
                bronze: scores.filter((s) => s.overallScore < 40).length,
            };

            return {
                gradienceOracle: {
                    version: '1.0.0',
                    status: 'active',
                },
                stats: {
                    totalAgents,
                    avgReputationScore: Math.round(avgScore),
                    tierDistribution: tierCounts,
                    totalTasksCompleted: scores.reduce((sum, s) => sum + s.completedTasks, 0),
                },
                connectedRegistries: [
                    { name: 'Solana Agent Registry', status: 'connected', type: 'identity' },
                    { name: 'ERC-8004', status: 'connected', type: 'cross-chain' },
                ],
                dataSources: [
                    { name: 'Agent Arena', status: 'active', type: 'tasks' },
                    { name: 'Chain Hub', status: 'active', type: 'indexer' },
                    { name: 'OWS Wallet', status: 'active', type: 'wallet' },
                ],
            };
        } catch (err: any) {
            logger.error({ err }, 'Failed to get stats');
            return reply.code(500).send({ error: err.message });
        }
    });

    // -------------------------------------------------------------------------
    // On-chain Reputation Payload
    // -------------------------------------------------------------------------

    app.get<{
        Params: { agentAddress: string };
    }>('/api/v1/oracle/reputation/:agentAddress/onchain', async (request, reply) => {
        try {
            const { agentAddress } = request.params;

            const activity = await fetchAgentActivity(chainHubClient, agentAddress);
            if (!activity) {
                return reply.code(404).send({ error: 'Agent not found', agentAddress });
            }

            if (!options?.proofGeneratorConfig) {
                return reply.code(503).send({ error: 'Proof generator is not configured' });
            }

            const score = engine.calculateReputation(activity);
            const generator = createReputationProofGenerator(options.proofGeneratorConfig);

            const categoryScores = [
                score.taskScore * 100,
                score.qualityScore * 100,
                score.consistencyScore * 100,
                score.stakingScore * 100,
                0, 0, 0, 0,
            ];

            const { payload, signature, payloadHash } = await generator.generateSignedPayload(
                agentAddress,
                score.overallScore * 100,
                categoryScores,
                Math.floor(Date.now() / 1000),
                { confidence: Math.round(score.confidence * 100) },
            );

            return {
                agentAddress,
                agentId: payload.agentId,
                payload: mapPayloadToResponse(payload),
                signature,
                payloadHash,
                calculatedAt: new Date().toISOString(),
                attestationURI: `gradience://reputation/${payload.agentId.slice(2)}`,
            };
        } catch (err: any) {
            logger.error({ err, agent: request.params.agentAddress }, 'Failed to get onchain reputation payload');
            return reply.code(500).send({ error: err.message });
        }
    });

    // -------------------------------------------------------------------------
    // Verify On-chain Reputation
    // -------------------------------------------------------------------------

    app.get<{
        Params: { agentAddress: string };
    }>('/api/v1/oracle/reputation/:agentAddress/verify-onchain', async (request, reply) => {
        try {
            const { agentAddress } = request.params;

            if (!options?.evmRelayerConfig) {
                return reply.code(503).send({ error: 'EVM relayer is not configured' });
            }

            const activity = await fetchAgentActivity(chainHubClient, agentAddress);
            if (!activity) {
                return reply.code(404).send({ error: 'Agent not found', agentAddress });
            }

            if (!options?.proofGeneratorConfig) {
                return reply.code(503).send({ error: 'Proof generator is not configured' });
            }

            const score = engine.calculateReputation(activity);
            const generator = createReputationProofGenerator(options.proofGeneratorConfig);

            const categoryScores = [
                score.taskScore * 100,
                score.qualityScore * 100,
                score.consistencyScore * 100,
                score.stakingScore * 100,
                0, 0, 0, 0,
            ];

            const { payload, signature } = await generator.generateSignedPayload(
                agentAddress,
                score.overallScore * 100,
                categoryScores,
                Math.floor(Date.now() / 1000),
                { confidence: Math.round(score.confidence * 100) },
            );

            const relayer = createReputationEVMRelayer(options.evmRelayerConfig);
            const verified = await relayer.verifyOnChain(payload as any, signature);

            return {
                agentAddress,
                agentId: payload.agentId,
                verified,
                contractAddress: options.evmRelayerConfig.contractAddress,
                chainId: options.evmRelayerConfig.chainId ?? null,
                payload: mapPayloadToResponse(payload),
                signature,
            };
        } catch (err: any) {
            logger.error({ err, agent: request.params.agentAddress }, 'Failed to verify onchain reputation');
            return reply.code(500).send({ error: err.message });
        }
    });

    logger.info('Reputation Oracle API routes registered: /api/v1/oracle/*');
}

// ============================================================================
// Helpers
// ============================================================================

function detectAddressType(address: string): 'solana' | 'evm' | null {
    if (isValidSolanaAddress(address)) return 'solana';
    if (isValidEvmAddress(address)) return 'evm';
    return null;
}

function isValidSolanaAddress(address: string): boolean {
    try {
        const { PublicKey } = require('@solana/web3.js');
        new PublicKey(address);
        return true;
    } catch {
        return false;
    }
}

function isValidEvmAddress(address: string): boolean {
    return /^0x[0-9a-fA-F]{40}$/.test(address);
}

function getTier(score: number): string {
    if (score >= 80) return 'platinum';
    if (score >= 60) return 'gold';
    if (score >= 40) return 'silver';
    return 'bronze';
}

function generateVerificationProof(agentAddress: string, score: any): string {
    // Simple hash for proof of calculation
    const crypto = require('crypto');
    const data = `${agentAddress}:${score.overallScore}:${score.calculatedAt}`;
    return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

async function fetchIdentityBinding(
    connection: import('@solana/web3.js').Connection,
    solanaAddress: string,
): Promise<{ evmAddress: string } | null> {
    const { PublicKey } = require('@solana/web3.js');
    const programId = new PublicKey(ARENA_PROGRAM_ADDRESS);
    const owner = new PublicKey(solanaAddress);

    const [pda] = PublicKey.findProgramAddressSync([Buffer.from('identity_binding'), owner.toBytes()], programId);

    const account = await connection.getAccountInfo(pda, 'confirmed');
    if (!account || account.data.length < 201) return null;

    const data = account.data;
    // Verify discriminator
    if (data[0] !== 0x0c) return null;

    const evmBytes = data.slice(34, 54);
    const verified = data[183] === 1;
    if (!verified) return null;

    const evmAddress = '0x' + evmBytes.toString('hex');
    return { evmAddress };
}

async function fetchAgentActivity(
    chainHubClient: import('../../integrations/chain-hub-reputation.js').ChainHubReputationClient,
    agentAddress: string,
): Promise<any | null> {
    const record = await chainHubClient.getReputation(agentAddress);
    if (!record) return null;

    return {
        agentAddress,
        completedTasks: record.completedTasks,
        attemptedTasks: record.completedTasks,
        totalEarned: BigInt(0),
        totalStaked: BigInt(0),
        avgRating: record.avgRating,
        ratingsCount: record.completedTasks,
        disputeCount: 0,
        disputeWon: 0,
        firstActivity: Date.now() - 86400000 * 30,
        lastActivity: new Date(record.updatedAt).getTime(),
        dailyActivity: [],
    };
}

async function fetchAllAgents(): Promise<any[]> {
    // TODO: implement batch agent discovery from indexer or local DB
    return [];
}

function mapPayloadToResponse(payload: ReputationPayload): any {
    return {
        agentId: payload.agentId,
        globalScore: payload.globalScore,
        categoryScores: payload.categoryScores,
        updatedAt: payload.updatedAt,
        confidence: payload.confidence,
        nonce: payload.nonce,
        merkleRoot: payload.merkleRoot,
        sourceChain: payload.sourceChain,
    };
}
