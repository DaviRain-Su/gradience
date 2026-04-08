import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { RevenueSharingEngine, createRevenueSharingEngine } from '../revenue-engine.js';

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('RevenueSharingEngine', () => {
  let db: Database.Database;
  let engine: RevenueSharingEngine;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'revenue-test-'));
    db = new Database(join(tmpDir, 'test.db'));
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'open'
      );
    `);
    db.prepare("INSERT INTO tasks (id) VALUES ('task-1')").run();
    engine = new RevenueSharingEngine(db, { autoSettle: false });
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('calculateRevenue', () => {
    it('should calculate correct distribution for 10000 lamports', () => {
      const result = engine.calculateRevenue(BigInt(10000));

      expect(result.totalAmount).toBe(BigInt(10000));
      expect(result.agentAmount).toBe(BigInt(9500));
      expect(result.judgeAmount).toBe(BigInt(300));
      expect(result.protocolAmount).toBe(BigInt(200));
    });

    it('should give rounding remainder to agent', () => {
      const result = engine.calculateRevenue(BigInt(100));
      const sum = result.agentAmount + result.judgeAmount + result.protocolAmount;
      expect(sum).toBe(BigInt(100));
      // Agent gets 95 + remainder because 100*9500/10000 = 95 exactly
      expect(result.agentAmount).toBe(BigInt(95));
      expect(result.judgeAmount).toBe(BigInt(3));
      expect(result.protocolAmount).toBe(BigInt(2));
    });

    it('should handle large amounts without overflow', () => {
      const amount = BigInt(1_000_000_000_000);
      const result = engine.calculateRevenue(amount);
      const sum = result.agentAmount + result.judgeAmount + result.protocolAmount;
      expect(sum).toBe(amount);
    });
  });

  describe('recordTaskDistribution', () => {
    it('should record a distribution and return an ID', () => {
      const taskInfo = {
        taskId: 'task-1',
        paymentId: 'pay-1',
        agentAddress: 'agent-addr',
        judgeAddress: 'judge-addr',
        tokenMint: 'SOL',
        totalAmount: BigInt(10000),
        escrowAccount: 'escrow-1',
      };

      const result = engine.recordTaskDistribution(taskInfo);

      expect(result.distributionId).toMatch(/^rev-task-1-/);
      expect(result.calculation.agentAmount).toBe(BigInt(9500));
      expect(result.calculation.judgeAmount).toBe(BigInt(300));
      expect(result.calculation.protocolAmount).toBe(BigInt(200));

      const record = engine.getDistribution(result.distributionId);
      expect(record).not.toBeNull();
      expect(record?.agentAmount).toBe('9500');
    });
  });

  describe('percentage validation', () => {
    it('should reject invalid percentages at construction', () => {
      expect(() => {
        new RevenueSharingEngine(db, {
          autoSettle: false,
          percentages: { agent: 9000, judge: 300, protocol: 200 }, // 9500 != 10000
        });
      }).toThrow();
    });
  });

  describe('createRevenueSharingEngine', () => {
    it('should create engine with factory', () => {
      const e = createRevenueSharingEngine(db, { autoSettle: false });
      const result = e.calculateRevenue(BigInt(10000));
      expect(result.agentAmount).toBe(BigInt(9500));
    });
  });
});
