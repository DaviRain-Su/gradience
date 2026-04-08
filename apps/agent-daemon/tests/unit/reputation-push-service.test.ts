import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReputationPushService } from '../../src/reputation/push-service.js';
import { createReputationAggregationEngine } from '../../src/reputation/aggregation-engine.js';

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function createMockSolanaClient() {
  return {
    isRegistered: vi.fn().mockResolvedValue(true),
    registerAgent: vi.fn().mockResolvedValue(''),
    submitReputation: vi.fn().mockResolvedValue('tx-sig'),
  } as unknown as import('../../src/integrations/solana-agent-registry.js').SolanaAgentRegistryClient;
}

function createMockERC8004Client() {
  return {
    isRegistered: vi.fn().mockResolvedValue(false),
    registerAgent: vi.fn().mockResolvedValue({ agentId: 'erc-1' }),
    getAgentId: vi.fn().mockResolvedValue('erc-1'),
    giveFeedback: vi.fn().mockResolvedValue({ txHash: '0xabc' }),
  } as unknown as import('../../src/integrations/erc8004-client.js').ERC8004Client;
}

function createMockChainHubClient(record: any) {
  return {
    getReputation: vi.fn().mockResolvedValue(record),
    getReputationsByMaster: vi.fn().mockResolvedValue([]),
    getAggregateReputation: vi.fn().mockResolvedValue(null),
    batchGetReputations: vi.fn().mockResolvedValue(new Map()),
    clearCache: vi.fn(),
    getCacheStats: vi.fn().mockReturnValue({ size: 0, oldestEntry: null, newestEntry: null }),
  } as unknown as import('../../src/integrations/chain-hub-reputation.js').ChainHubReputationClient;
}

function createScore(overrides: any = {}) {
  return {
    overallScore: 72,
    taskScore: 80,
    qualityScore: 70,
    consistencyScore: 60,
    stakingScore: 50,
    completedTasks: 10,
    totalEarned: '1000',
    avgRating: 4.2,
    disputeRate: 0,
    recencyWeight: 1.0,
    anomalyFlags: [],
    confidence: 0.75,
    calculatedAt: Date.now(),
    dataPoints: 5,
    ...overrides,
  };
}

describe('ReputationPushService', () => {
  let solanaClient: ReturnType<typeof createMockSolanaClient>;
  let erc8004Client: ReturnType<typeof createMockERC8004Client>;
  let engine: ReturnType<typeof createReputationAggregationEngine>;

  beforeEach(() => {
    solanaClient = createMockSolanaClient();
    erc8004Client = createMockERC8004Client();
    engine = createReputationAggregationEngine();
  });

  it('should push successfully to both registries', async () => {
    const service = new ReputationPushService({
      solanaClient,
      erc8004Client,
      engine,
      enableRealtime: true,
      enableBatch: false,
      batchIntervalMs: 60000,
      retryAttempts: 3,
      retryDelayMs: 1000,
    });

    const result = await service.push('agent-1', createScore());

    expect(result.solana?.success).toBe(true);
    expect(result.erc8004?.success).toBe(true);
    expect(result.agentAddress).toBe('agent-1');
    expect(solanaClient.submitReputation).toHaveBeenCalled();
    expect(erc8004Client.giveFeedback).toHaveBeenCalled();
  });

  it('should auto-register on Solana when not registered', async () => {
    solanaClient.isRegistered.mockResolvedValue(false);
    const service = new ReputationPushService({
      solanaClient,
      erc8004Client,
      engine,
      enableRealtime: true,
      enableBatch: false,
      batchIntervalMs: 60000,
      retryAttempts: 3,
      retryDelayMs: 1000,
    });

    const validSolanaAddress = 'So11111111111111111111111111111111111111112';
    await service.push(validSolanaAddress, createScore());

    expect(solanaClient.registerAgent).toHaveBeenCalled();
    expect(solanaClient.submitReputation).toHaveBeenCalled();
  });

  it('should auto-register on ERC-8004 when not registered', async () => {
    erc8004Client.isRegistered.mockResolvedValue(false);
    const service = new ReputationPushService({
      solanaClient,
      erc8004Client,
      engine,
      enableRealtime: true,
      enableBatch: false,
      batchIntervalMs: 60000,
      retryAttempts: 3,
      retryDelayMs: 1000,
    });

    await service.push('agent-3', createScore());

    expect(erc8004Client.registerAgent).toHaveBeenCalled();
    expect(erc8004Client.giveFeedback).toHaveBeenCalled();
  });

  it('should record sync status after push', async () => {
    const service = new ReputationPushService({
      solanaClient,
      erc8004Client,
      engine,
      enableRealtime: true,
      enableBatch: false,
      batchIntervalMs: 60000,
      retryAttempts: 3,
      retryDelayMs: 1000,
    });

    await service.push('agent-4', createScore());
    const status = service.getSyncStatus('agent-4');

    expect(status.solanaSynced).toBe(true);
    expect(status.ethereumSynced).toBe(true);
    expect(status.pendingSync).toBe(false);
    expect(status.lastSyncAt).toBeDefined();
  });

  it('should mark pendingSync when push partially fails', async () => {
    solanaClient.submitReputation.mockRejectedValue(new Error('Solana RPC error'));
    const service = new ReputationPushService({
      solanaClient,
      erc8004Client,
      engine,
      enableRealtime: true,
      enableBatch: false,
      batchIntervalMs: 60000,
      retryAttempts: 1,
      retryDelayMs: 100,
    });

    const result = await service.push('agent-5', createScore());
    expect(result.solana?.success).toBe(false);
    expect(result.erc8004?.success).toBe(true);

    const status = service.getSyncStatus('agent-5');
    expect(status.pendingSync).toBe(true);
  });

  it('should batch push multiple agents', async () => {
    const chainHubClient = createMockChainHubClient({
      score: 70,
      completedTasks: 8,
      avgRating: 4.0,
      updatedAt: new Date().toISOString(),
    });
    const service = new ReputationPushService({
      solanaClient,
      erc8004Client,
      engine,
      chainHubClient,
      enableRealtime: false,
      enableBatch: false,
      batchIntervalMs: 60000,
      retryAttempts: 3,
      retryDelayMs: 1000,
    });

    const result = await service.batchPush(['agent-a', 'agent-b']);
    expect(result.results.length).toBe(2);
    expect(result.success.length).toBe(2);
    expect(result.failed.length).toBe(0);
  });

  it('should stop cleanly', () => {
    const service = new ReputationPushService({
      solanaClient,
      erc8004Client,
      engine,
      enableRealtime: true,
      enableBatch: true,
      batchIntervalMs: 60000,
      retryAttempts: 3,
      retryDelayMs: 1000,
    });

    service.stop();
    expect(() => service.stop()).not.toThrow();
  });
});
