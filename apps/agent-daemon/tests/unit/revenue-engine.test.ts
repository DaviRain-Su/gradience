import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { PublicKey, Keypair } from '@solana/web3.js';
import {
  RevenueSharingEngine,
  createRevenueSharingEngine,
  type TaskSettlementInfo,
} from '../../src/revenue/revenue-engine.js';

// Mock the CPI caller to avoid network calls
vi.mock('../../src/revenue/distribution/cpi-caller.js', async () => {
  return {
    distribute: vi.fn().mockResolvedValue({
      distributionId: 'mock-dist',
      txSignature: 'mock-sig-123',
      blockTime: Date.now(),
      slot: 1,
      breakdown: {
        agent: { address: 'agent', amount: 950n },
        judge: { address: 'judge', amount: 30n },
        protocol: { address: 'protocol', amount: 20n },
      },
      status: 'confirmed',
    }),
    distributeTokens: vi.fn().mockResolvedValue({
      distributionId: 'mock-dist-token',
      txSignature: 'mock-sig-456',
      blockTime: Date.now(),
      slot: 2,
      breakdown: {
        agent: { address: 'agent', amount: 950n },
        judge: { address: 'judge', amount: 30n },
        protocol: { address: 'protocol', amount: 20n },
      },
      status: 'confirmed',
    }),
  };
});

// Mock logger to avoid console noise
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('RevenueSharingEngine', () => {
  let db: Database.Database;
  let engine: RevenueSharingEngine;

  beforeEach(() => {
    db = new Database(':memory:');
    // Disable FK enforcement for isolated revenue-engine tests
    db.pragma('foreign_keys = OFF');
    engine = createRevenueSharingEngine(db, {
      rpcEndpoint: 'https://api.devnet.solana.com',
      autoSettle: false,
    });
  });

  afterEach(() => {
    engine.shutdown();
    db.close();
    vi.clearAllMocks();
  });

  describe('calculateRevenue', () => {
    it('should calculate 95/3/2 split correctly', () => {
      const calc = engine.calculateRevenue(1000n);
      expect(calc.totalAmount).toBe(1000n);
      expect(calc.agentAmount).toBe(950n);
      expect(calc.judgeAmount).toBe(30n);
      expect(calc.protocolAmount).toBe(20n);
      expect(calc.agentAmount + calc.judgeAmount + calc.protocolAmount).toBe(1000n);
    });

    it('should handle rounding by giving remainder to agent', () => {
      // 10000n * 9500 / 10000 = 9500n
      // 10000n * 300 / 10000 = 300n
      // 10000n * 200 / 10000 = 200n
      // total = 10000n (no remainder)
      const calc = engine.calculateRevenue(10000n);
      expect(calc.agentAmount).toBe(9500n);
      expect(calc.judgeAmount).toBe(300n);
      expect(calc.protocolAmount).toBe(200n);
    });

    it('should give remainder to agent for non-divisible amounts', () => {
      const calc = engine.calculateRevenue(100n);
      // 100*9500/10000 = 95
      // 100*300/10000 = 3
      // 100*200/10000 = 2
      // total = 100, perfect
      expect(calc.agentAmount).toBe(95n);

      const calc2 = engine.calculateRevenue(7n);
      // 7*9500/10000 = 6 (truncated)
      // 7*300/10000 = 0
      // 7*200/10000 = 0
      // remainder = 1 -> agent gets 7
      expect(calc2.agentAmount).toBe(7n);
      expect(calc2.judgeAmount).toBe(0n);
      expect(calc2.protocolAmount).toBe(0n);
    });
  });

  describe('recordTaskDistribution', () => {
    it('should record a distribution and return calculation', () => {
      const taskInfo: TaskSettlementInfo = {
        taskId: 'task-1',
        paymentId: 'pay-1',
        agentAddress: PublicKey.default.toBase58(),
        judgeAddress: PublicKey.unique().toBase58(),
        tokenMint: PublicKey.default.toBase58(),
        totalAmount: 1000n,
        escrowAccount: PublicKey.unique().toBase58(),
        escrowAuthority: PublicKey.unique().toBase58(),
      };

      const result = engine.recordTaskDistribution(taskInfo);
      expect(result.distributionId).toMatch(/^rev-task-1-/);
      expect(result.calculation.totalAmount).toBe(1000n);
      expect(result.calculation.agentAmount).toBe(950n);

      const fromDb = engine.getDistribution(result.distributionId);
      expect(fromDb).not.toBeNull();
      expect(fromDb!.status).toBe('pending');
    });

    it('should queue for settlement when autoSettle is enabled', () => {
      const autoDb = new Database(':memory:');
      autoDb.pragma('foreign_keys = OFF');
      const autoEngine = createRevenueSharingEngine(autoDb, {
        rpcEndpoint: 'https://api.devnet.solana.com',
        autoSettle: true,
      });

      const taskInfo: TaskSettlementInfo = {
        taskId: 'task-auto',
        paymentId: 'pay-auto',
        agentAddress: PublicKey.default.toBase58(),
        judgeAddress: PublicKey.unique().toBase58(),
        tokenMint: PublicKey.default.toBase58(),
        totalAmount: 500n,
        escrowAccount: PublicKey.unique().toBase58(),
        escrowAuthority: PublicKey.unique().toBase58(),
      };

      autoEngine.recordTaskDistribution(taskInfo);
      expect(autoEngine.getPendingCount()).toBe(1);
      autoEngine.shutdown();
      autoDb.close();
    });
  });

  describe('settleDistribution (native SOL)', () => {
    it('should settle a pending distribution and mark confirmed', async () => {
      const taskInfo: TaskSettlementInfo = {
        taskId: 'task-sol',
        paymentId: 'pay-sol',
        agentAddress: PublicKey.default.toBase58(),
        judgeAddress: PublicKey.unique().toBase58(),
        tokenMint: PublicKey.default.toBase58(),
        totalAmount: 1000n,
        escrowAccount: PublicKey.unique().toBase58(),
        escrowAuthority: PublicKey.unique().toBase58(),
      };

      const { distributionId } = engine.recordTaskDistribution(taskInfo);
      const signer = Keypair.generate();

      const result = await engine.settleDistribution(distributionId, signer);
      expect(result.status).toBe('confirmed');
      expect(result.txSignature).toBe('mock-sig-123');

      const fromDb = engine.getDistribution(distributionId);
      expect(fromDb!.status).toBe('confirmed');
      expect(fromDb!.txSignature).toBe('mock-sig-123');
    });

    it('should skip already confirmed distributions', async () => {
      const taskInfo: TaskSettlementInfo = {
        taskId: 'task-confirmed',
        paymentId: 'pay-confirmed',
        agentAddress: PublicKey.default.toBase58(),
        judgeAddress: PublicKey.unique().toBase58(),
        tokenMint: PublicKey.default.toBase58(),
        totalAmount: 1000n,
        escrowAccount: PublicKey.unique().toBase58(),
        escrowAuthority: PublicKey.unique().toBase58(),
      };

      const { distributionId } = engine.recordTaskDistribution(taskInfo);
      const signer = Keypair.generate();

      await engine.settleDistribution(distributionId, signer);
      const result2 = await engine.settleDistribution(distributionId, signer);
      expect(result2.status).toBe('confirmed');
    });

    it('should throw for missing distribution', async () => {
      const signer = Keypair.generate();
      await expect(engine.settleDistribution('nonexistent', signer)).rejects.toThrow(
        'Distribution nonexistent not found'
      );
    });
  });

  describe('settleDistribution (SPL tokens)', () => {
    it('should settle with distributeTokens for non-native mints', async () => {
      const { distributeTokens } = await import('../../src/revenue/distribution/cpi-caller.js');
      const taskInfo: TaskSettlementInfo = {
        taskId: 'task-spl',
        paymentId: 'pay-spl',
        agentAddress: PublicKey.default.toBase58(),
        judgeAddress: PublicKey.unique().toBase58(),
        tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        totalAmount: 2000n,
        escrowAccount: PublicKey.unique().toBase58(),
        escrowAuthority: PublicKey.unique().toBase58(),
      };

      const { distributionId } = engine.recordTaskDistribution(taskInfo);
      const signer = Keypair.generate();

      const result = await engine.settleDistribution(distributionId, signer);
      expect(result.status).toBe('confirmed');
      expect(distributeTokens).toHaveBeenCalled();
    });
  });

  describe('query methods', () => {
    it('should list distributions with filters', () => {
      const taskInfo: TaskSettlementInfo = {
        taskId: 'task-q1',
        paymentId: 'pay-q1',
        agentAddress: PublicKey.default.toBase58(),
        judgeAddress: PublicKey.unique().toBase58(),
        tokenMint: PublicKey.default.toBase58(),
        totalAmount: 100n,
        escrowAccount: PublicKey.unique().toBase58(),
        escrowAuthority: PublicKey.unique().toBase58(),
      };

      const { distributionId } = engine.recordTaskDistribution(taskInfo);
      const byTask = engine.getDistributionByTask('task-q1');
      expect(byTask!.id).toBe(distributionId);

      const list = engine.listDistributions({ status: 'pending', limit: 10 });
      expect(list.length).toBeGreaterThanOrEqual(1);
    });

    it('should return stats', () => {
      const stats = engine.getStats();
      expect(stats.totalDistributions).toBe(0);
      expect(stats.pendingCount).toBe(0);
      expect(stats.confirmedCount).toBe(0);
    });
  });

  describe('auto settle polling', () => {
    it('should start and stop polling', () => {
      const autoDb = new Database(':memory:');
      autoDb.pragma('foreign_keys = OFF');
      const autoEngine = createRevenueSharingEngine(autoDb, {
        rpcEndpoint: 'https://api.devnet.solana.com',
        autoSettle: true,
        settlementIntervalMs: 100,
      });

      expect(autoEngine['settlementTimer']).not.toBeNull();
      autoEngine.stopSettlementPolling();
      expect(autoEngine['settlementTimer']).toBeNull();
      autoEngine.shutdown();
      autoDb.close();
    });
  });
});
