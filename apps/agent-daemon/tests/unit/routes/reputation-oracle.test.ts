import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { registerReputationOracleRoutes } from '../../../src/api/routes/reputation-oracle.js';
import { createReputationAggregationEngine } from '../../../src/reputation/aggregation-engine.js';
import { createReputationPushService } from '../../../src/reputation/push-service.js';

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function createMockChainHubClient(record: any) {
  return {
    getReputation: vi.fn().mockResolvedValue(record),
    getReputationsByMaster: vi.fn().mockResolvedValue([]),
    getAggregateReputation: vi.fn().mockResolvedValue(null),
    batchGetReputations: vi.fn().mockResolvedValue(new Map()),
    clearCache: vi.fn(),
    getCacheStats: vi.fn().mockReturnValue({ size: 0, oldestEntry: null, newestEntry: null }),
  } as unknown as import('../../../src/integrations/chain-hub-reputation.js').ChainHubReputationClient;
}

function createMockPushService() {
  return createReputationPushService({
    solanaClient: {
      isRegistered: vi.fn().mockResolvedValue(true),
      registerAgent: vi.fn().mockResolvedValue(''),
      submitReputation: vi.fn().mockResolvedValue(''),
    } as any,
    erc8004Client: {
      isRegistered: vi.fn().mockResolvedValue(false),
      registerAgent: vi.fn().mockResolvedValue({ agentId: '1' }),
      getAgentId: vi.fn().mockResolvedValue('1'),
      giveFeedback: vi.fn().mockResolvedValue({ txHash: '0x123' }),
    } as any,
    engine: createReputationAggregationEngine(),
    enableRealtime: false,
    enableBatch: false,
    batchIntervalMs: 60000,
    retryAttempts: 3,
    retryDelayMs: 1000,
  });
}

describe('Reputation Oracle Routes', () => {
  let app: ReturnType<typeof Fastify>;
  let engine: ReturnType<typeof createReputationAggregationEngine>;
  const validSolanaAddress = '11111111111111111111111111111111';

  beforeEach(() => {
    app = Fastify({ logger: false });
    engine = createReputationAggregationEngine();
  });

  describe('GET /api/v1/oracle/reputation/:agentAddress', () => {
    it('should return 200 with reputation when indexer has data', async () => {
      const mockClient = createMockChainHubClient({
        score: 75,
        completedTasks: 10,
        avgRating: 4.2,
        updatedAt: new Date().toISOString(),
      });
      registerReputationOracleRoutes(app, engine, undefined, { chainHubClient: mockClient });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/oracle/reputation/${validSolanaAddress}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.agentAddress).toBe(validSolanaAddress);
      expect(body.reputation.overallScore).toBeDefined();
      expect(body.components.taskScore).toBeDefined();
      expect(body.metrics.completedTasks).toBe(10);
      expect(body.metrics.avgRating).toBe(4.2);
      expect(mockClient.getReputation).toHaveBeenCalledWith(validSolanaAddress);
    });

    it('should return 400 for invalid Solana address', async () => {
      registerReputationOracleRoutes(app, engine);
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/oracle/reputation/not-an-address',
      });
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid Solana address');
    });

    it('should return 404 when no reputation data exists', async () => {
      const mockClient = createMockChainHubClient(null);
      registerReputationOracleRoutes(app, engine, undefined, { chainHubClient: mockClient });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/oracle/reputation/${validSolanaAddress}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Agent not found');
    });

    it('should include anomalies when requested', async () => {
      const mockClient = createMockChainHubClient({
        score: 75,
        completedTasks: 10,
        avgRating: 4.2,
        updatedAt: new Date().toISOString(),
      });
      registerReputationOracleRoutes(app, engine, undefined, { chainHubClient: mockClient });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/oracle/reputation/${validSolanaAddress}?includeAnomalies=true`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.anomalies)).toBe(true);
    });
  });

  describe('GET /api/v1/oracle/reputation/:agentAddress/verify', () => {
    it('should return verified reputation payload', async () => {
      const mockClient = createMockChainHubClient({
        score: 80,
        completedTasks: 20,
        avgRating: 4.5,
        updatedAt: new Date().toISOString(),
      });
      registerReputationOracleRoutes(app, engine, undefined, { chainHubClient: mockClient });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/oracle/reputation/${validSolanaAddress}/verify`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.verified).toBe(true);
      expect(body.verification.algorithm).toBe('gradience-v1');
      expect(body.sources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Agent Arena', status: 'active' }),
        ])
      );
    });
  });

  describe('GET /api/v1/oracle/reputation/leaderboard', () => {
    it('should return empty leaderboard when no agents exist', async () => {
      registerReputationOracleRoutes(app, engine);
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/oracle/reputation/leaderboard',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.leaderboard).toEqual([]);
      expect(body.pagination.total).toBe(0);
    });
  });

  describe('POST /api/v1/oracle/reputation/:agentAddress/sync', () => {
    it('should return 503 when push service is not configured', async () => {
      const mockClient = createMockChainHubClient({
        score: 75,
        completedTasks: 10,
        avgRating: 4.2,
        updatedAt: new Date().toISOString(),
      });
      registerReputationOracleRoutes(app, engine, undefined, { chainHubClient: mockClient });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/oracle/reputation/${validSolanaAddress}/sync`,
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('push service is not configured');
    });

    it('should initiate sync when push service is available', async () => {
      const mockClient = createMockChainHubClient({
        score: 75,
        completedTasks: 10,
        avgRating: 4.2,
        updatedAt: new Date().toISOString(),
      });
      const pushService = createMockPushService();
      vi.spyOn(pushService, 'push').mockResolvedValue({
        agentAddress: validSolanaAddress,
        timestamp: Date.now(),
        solana: { success: true, signature: 'sig' },
        erc8004: { success: true, txHash: '0xabc' },
      });
      registerReputationOracleRoutes(app, engine, pushService, { chainHubClient: mockClient });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/oracle/reputation/${validSolanaAddress}/sync`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.syncInitiated).toBe(true);
      expect(pushService.push).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/oracle/reputation/sync-batch', () => {
    it('should return 503 when push service is not configured', async () => {
      registerReputationOracleRoutes(app, engine);
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/oracle/reputation/sync-batch',
        payload: { agentAddresses: [validSolanaAddress] },
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('push service is not configured');
    });

    it('should reject more than 100 agents', async () => {
      registerReputationOracleRoutes(app, engine);
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/oracle/reputation/sync-batch',
        payload: { agentAddresses: Array(101).fill(validSolanaAddress) },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Cannot sync more than 100');
    });
  });

  describe('GET /api/v1/oracle/stats', () => {
    it('should return oracle stats', async () => {
      registerReputationOracleRoutes(app, engine);
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/oracle/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.gradienceOracle.version).toBe('1.0.0');
      expect(body.gradienceOracle.status).toBe('active');
      expect(body.stats.totalAgents).toBe(0);
      expect(body.connectedRegistries).toHaveLength(2);
      expect(body.dataSources).toHaveLength(3);
    });
  });
});
