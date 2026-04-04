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

export function registerReputationOracleRoutes(
  app: FastifyInstance,
  engine: ReputationAggregationEngine,
  pushService: ReputationPushService
): void {
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

      // Validate address
      if (!isValidSolanaAddress(agentAddress)) {
        return reply.code(400).send({ error: 'Invalid Solana address' });
      }

      // Fetch activity (in real implementation, from database)
      const activity = await fetchAgentActivity(agentAddress);
      
      if (!activity) {
        return reply.code(404).send({ 
          error: 'Agent not found',
          agentAddress 
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

      // Add sync status
      const syncStatus = pushService.getSyncStatus(agentAddress);
      response.syncStatus = {
        solana: syncStatus.solanaSynced,
        ethereum: syncStatus.ethereumSynced,
        lastSyncAt: syncStatus.lastSyncAt,
      };

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

      const activity = await fetchAgentActivity(agentAddress);
      
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
      const { 
        limit = 100, 
        offset = 0, 
        minScore = 0,
        category 
      } = request.query;

      // Validate params
      if (limit > 1000) {
        return reply.code(400).send({ error: 'Limit cannot exceed 1000' });
      }

      // Fetch all agents (in real implementation, from database with pagination)
      const agents = await fetchAllAgents();
      
      // Calculate scores and filter
      const scoredAgents = agents
        .map(agent => ({
          agentAddress: agent.address,
          reputation: engine.calculateReputation(agent),
        }))
        .filter(a => a.reputation.overallScore >= minScore)
        .sort((a, b) => b.reputation.overallScore - a.reputation.overallScore);

      // Paginate
      const total = scoredAgents.length;
      const results = scoredAgents.slice(offset, offset + limit);

      return {
        leaderboard: results.map(r => ({
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

      const activity = await fetchAgentActivity(agentAddress);
      
      if (!activity) {
        return reply.code(404).send({ error: 'Agent not found' });
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
      const scores = agents.map(a => engine.calculateReputation(a));
      const totalAgents = agents.length;
      const avgScore = scores.reduce((sum, s) => sum + s.overallScore, 0) / totalAgents;
      
      const tierCounts = {
        platinum: scores.filter(s => s.overallScore >= 80).length,
        gold: scores.filter(s => s.overallScore >= 60 && s.overallScore < 80).length,
        silver: scores.filter(s => s.overallScore >= 40 && s.overallScore < 60).length,
        bronze: scores.filter(s => s.overallScore < 40).length,
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

  logger.info('Reputation Oracle API routes registered: /api/v1/oracle/*');
}

// ============================================================================
// Helpers
// ============================================================================

function isValidSolanaAddress(address: string): boolean {
  try {
    const { PublicKey } = require('@solana/web3.js');
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
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

// Placeholder functions - replace with actual database queries
async function fetchAgentActivity(agentAddress: string): Promise<any | null> {
  // In real implementation, fetch from database
  // For now, return mock data
  return {
    agentAddress,
    completedTasks: 10,
    attemptedTasks: 12,
    totalEarned: BigInt(1000000000),
    totalStaked: BigInt(500000000),
    avgRating: 4.5,
    ratingsCount: 8,
    disputeCount: 1,
    disputeWon: 1,
    firstActivity: Date.now() - 86400000 * 30,
    lastActivity: Date.now(),
    dailyActivity: [],
  };
}

async function fetchAllAgents(): Promise<any[]> {
  // In real implementation, fetch from database
  return [];
}
