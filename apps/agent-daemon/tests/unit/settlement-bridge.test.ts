/**
 * Settlement Bridge Tests
 *
 * @module bridge/settlement-bridge.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock @solana/web3.js to prevent actual network requests
vi.mock('@solana/web3.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@solana/web3.js')>();
  
  // Create mock Keypair class
  const MockKeypair = vi.fn().mockImplementation(() => ({
    publicKey: {
      toBase58: () => 'MockPublicKey12345678901234567890123456789012',
      toBuffer: () => Buffer.alloc(32),
      toBytes: () => new Uint8Array(32),
    },
    secretKey: new Uint8Array(64),
  })) as unknown as typeof actual.Keypair;
  
  MockKeypair.generate = vi.fn().mockReturnValue({
    publicKey: {
      toBase58: () => 'MockPublicKey12345678901234567890123456789012',
      toBuffer: () => Buffer.alloc(32),
      toBytes: () => new Uint8Array(32),
    },
    secretKey: new Uint8Array(64),
  });
  
  MockKeypair.fromSecretKey = vi.fn().mockReturnValue({
    publicKey: {
      toBase58: () => 'MockPublicKey12345678901234567890123456789012',
      toBuffer: () => Buffer.alloc(32),
      toBytes: () => new Uint8Array(32),
    },
    secretKey: new Uint8Array(64),
  });
  
  return {
    ...actual,
    Keypair: MockKeypair,
    Connection: vi.fn().mockImplementation(() => ({
      getLatestBlockhash: vi.fn().mockResolvedValue({ blockhash: 'mock-blockhash' }),
      sendRawTransaction: vi.fn().mockResolvedValue('2nBr3UHQZf1K5WwVWBnV6dKtX5VHBdQJNZmQW1RmzZzZqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQ'),
      confirmTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
      getSignatureStatus: vi.fn().mockResolvedValue({ value: { err: null } }),
      getTransaction: vi.fn().mockResolvedValue({
        blockTime: Date.now(),
        slot: 12345,
        meta: { err: null, logMessages: [] },
      }),
    })),
    PublicKey: vi.fn().mockImplementation((key: string) => ({
      toBase58: () => key,
      toBuffer: () => Buffer.alloc(32),
      toBytes: () => new Uint8Array(32),
    })),
    Transaction: vi.fn().mockImplementation(() => ({
      add: vi.fn().mockReturnThis(),
      serialize: vi.fn().mockReturnValue(Buffer.alloc(100)),
      recentBlockhash: '',
      feePayer: null,
    })),
    TransactionInstruction: vi.fn().mockImplementation((data) => data),
    SystemProgram: {
      programId: '11111111111111111111111111111111',
    },
  };
});

import { SettlementBridge, createSettlementBridge } from '../../src/bridge/settlement-bridge.js';
import type { EvaluationResult } from '../../src/evaluator/runtime.js';

// Valid Solana public keys for testing
const VALID_PUBKEYS = {
  taskAccount: '11111111111111111111111111111111',
  escrowAccount: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  agentId: 'So11111111111111111111111111111111111111112',
  payerAgentId: '9WzDXwN4wH91k8ZRJDE2hb5EbegTxSyk2X4z2wdr4RMM',
  token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};

describe('SettlementBridge', () => {
  let bridge: SettlementBridge;

  beforeEach(async () => {
    bridge = await createSettlementBridge({
      chainHubProgramId: '5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs',
      rpcEndpoint: 'https://mock.rpc',
      maxRetries: 2,
    });
  });

  describe('settlement', () => {
    it('should settle evaluation result', async () => {
      const mockEvaluationResult: EvaluationResult = {
        evaluationId: 'eval-123',
        score: 85,
        passed: true,
        categoryScores: [
          { name: 'Functionality', score: 90, maxScore: 100, weight: 0.5, feedback: [] },
        ],
        checkResults: [{ type: 'tests_pass', passed: true, score: 100, details: '', durationMs: 1000 }],
        verificationHash: 'hash-123',
        executionLog: {
          sandboxType: 'docker',
          steps: [],
          stdout: '',
          stderr: '',
        },
        driftStatus: { driftDetected: false, contextWindowUsage: 0.3 },
        actualCost: { usd: 0.5, timeSeconds: 10, peakMemoryMb: 512 },
        completedAt: Date.now(),
      };

      const result = await bridge.settle({
        evaluationId: 'eval-123',
        taskId: 'task-456',
        taskIdOnChain: '456',
        paymentId: 'payment-789',
        agentId: VALID_PUBKEYS.agentId,
        payerAgentId: VALID_PUBKEYS.payerAgentId,
        evaluationResult: mockEvaluationResult,
        amount: '1000000',
        token: VALID_PUBKEYS.token,
        taskAccount: VALID_PUBKEYS.taskAccount,
        escrowAccount: VALID_PUBKEYS.escrowAccount,
        poster: VALID_PUBKEYS.payerAgentId,
      });

      expect(result.status).toBe('confirmed');
      expect(result.txSignature).toBeDefined();
      expect(result.distribution.agent).toBeDefined();
      expect(result.distribution.judge).toBeDefined();
      expect(result.distribution.protocol).toBeDefined();

      // Verify distribution (95% / 3% / 2%)
      const total = BigInt(result.amount);
      const agentAmount = BigInt(result.distribution.agent);
      const judgeAmount = BigInt(result.distribution.judge);
      const protocolAmount = BigInt(result.distribution.protocol);

      expect(agentAmount).toBe((total * BigInt(95)) / BigInt(100));
      expect(judgeAmount).toBe((total * BigInt(3)) / BigInt(100));
      expect(protocolAmount).toBe((total * BigInt(2)) / BigInt(100));
    });

    it('should track settlement status', async () => {
      const mockEvaluationResult: EvaluationResult = {
        evaluationId: 'eval-status',
        score: 75,
        passed: true,
        categoryScores: [],
        checkResults: [],
        verificationHash: 'hash',
        executionLog: { sandboxType: 'docker', steps: [], stdout: '', stderr: '' },
        driftStatus: { driftDetected: false, contextWindowUsage: 0 },
        actualCost: { usd: 0, timeSeconds: 0, peakMemoryMb: 0 },
        completedAt: Date.now(),
      };

      const settlePromise = bridge.settle({
        evaluationId: 'eval-status',
        taskId: 'task-1',
        taskIdOnChain: '1',
        paymentId: 'payment-1',
        agentId: VALID_PUBKEYS.agentId,
        payerAgentId: VALID_PUBKEYS.payerAgentId,
        evaluationResult: mockEvaluationResult,
        amount: '1000000',
        token: 'USDC',
        taskAccount: VALID_PUBKEYS.taskAccount,
        escrowAccount: VALID_PUBKEYS.escrowAccount,
        poster: VALID_PUBKEYS.payerAgentId,
      });

      // Check status during settlement
      const pendingStatuses = bridge.listPending();
      expect(pendingStatuses.length).toBeGreaterThan(0);

      await settlePromise;
    });
  });

  describe('proof generation', () => {
    it('should generate valid proof', async () => {
      const mockEvaluationResult: EvaluationResult = {
        evaluationId: 'eval-proof',
        score: 90,
        passed: true,
        categoryScores: [],
        checkResults: [],
        verificationHash: 'eval-hash',
        executionLog: { sandboxType: 'docker', steps: [], stdout: '', stderr: '' },
        driftStatus: { driftDetected: false, contextWindowUsage: 0 },
        actualCost: { usd: 0, timeSeconds: 0, peakMemoryMb: 0 },
        completedAt: Date.now(),
      };

      const result = await bridge.settle({
        evaluationId: 'eval-proof',
        taskId: 'task-1',
        taskIdOnChain: '1',
        paymentId: 'payment-1',
        agentId: VALID_PUBKEYS.agentId,
        payerAgentId: VALID_PUBKEYS.payerAgentId,
        evaluationResult: mockEvaluationResult,
        amount: '1000000',
        token: 'USDC',
        taskAccount: VALID_PUBKEYS.taskAccount,
        escrowAccount: VALID_PUBKEYS.escrowAccount,
        poster: VALID_PUBKEYS.payerAgentId,
      });

      expect(result.status).toBe('confirmed');
    });
  });

  describe('payment confirmation', () => {
    it('should create payment confirmation', async () => {
      const mockEvaluationResult: EvaluationResult = {
        evaluationId: 'eval-confirm',
        score: 80,
        passed: true,
        categoryScores: [],
        checkResults: [],
        verificationHash: 'hash',
        executionLog: { sandboxType: 'docker', steps: [], stdout: '', stderr: '' },
        driftStatus: { driftDetected: false, contextWindowUsage: 0 },
        actualCost: { usd: 0, timeSeconds: 0, peakMemoryMb: 0 },
        completedAt: Date.now(),
      };

      const settlementResult = await bridge.settle({
        evaluationId: 'eval-confirm',
        taskId: 'task-1',
        taskIdOnChain: '1',
        paymentId: 'payment-1',
        agentId: VALID_PUBKEYS.agentId,
        payerAgentId: VALID_PUBKEYS.payerAgentId,
        evaluationResult: mockEvaluationResult,
        amount: '1000000',
        token: 'USDC',
        taskAccount: VALID_PUBKEYS.taskAccount,
        escrowAccount: VALID_PUBKEYS.escrowAccount,
        poster: VALID_PUBKEYS.payerAgentId,
      });

      const confirmation = bridge.createPaymentConfirmation(settlementResult, {
        evaluationId: 'eval-confirm',
        taskId: 'task-1',
        taskIdOnChain: '1',
        paymentId: 'payment-1',
        agentId: VALID_PUBKEYS.agentId,
        payerAgentId: VALID_PUBKEYS.payerAgentId,
        evaluationResult: mockEvaluationResult,
        amount: '1000000',
        token: VALID_PUBKEYS.token,
        taskAccount: VALID_PUBKEYS.taskAccount,
        escrowAccount: VALID_PUBKEYS.escrowAccount,
        poster: VALID_PUBKEYS.payerAgentId,
      });

      expect(confirmation.paymentId).toBe('payment-1');
      expect(confirmation.txHash).toBe(settlementResult.txSignature);
      expect(confirmation.evaluatorScore).toBe(80);
    });
  });

  describe('events', () => {
    it('should emit settled event', async () => {
      const settledEvents: string[] = [];
      bridge.on('settled', (data) => {
        settledEvents.push(data.settlementId);
      });

      const mockEvaluationResult: EvaluationResult = {
        evaluationId: 'eval-event',
        score: 85,
        passed: true,
        categoryScores: [],
        checkResults: [],
        verificationHash: 'hash',
        executionLog: { sandboxType: 'docker', steps: [], stdout: '', stderr: '' },
        driftStatus: { driftDetected: false, contextWindowUsage: 0 },
        actualCost: { usd: 0, timeSeconds: 0, peakMemoryMb: 0 },
        completedAt: Date.now(),
      };

      await bridge.settle({
        evaluationId: 'eval-event',
        taskId: 'task-1',
        taskIdOnChain: '1',
        paymentId: 'payment-1',
        agentId: VALID_PUBKEYS.agentId,
        payerAgentId: VALID_PUBKEYS.payerAgentId,
        evaluationResult: mockEvaluationResult,
        amount: '1000000',
        token: 'USDC',
        taskAccount: VALID_PUBKEYS.taskAccount,
        escrowAccount: VALID_PUBKEYS.escrowAccount,
        poster: VALID_PUBKEYS.payerAgentId,
      });

      expect(settledEvents.length).toBe(1);
    });
  });

  describe('factory', () => {
    it('should create bridge with default options', async () => {
      const defaultBridge = await createSettlementBridge();
      expect(defaultBridge).toBeDefined();
    });

    it('should create bridge with custom options', async () => {
      const customBridge = await createSettlementBridge({
        chainHubProgramId: '5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs',
        rpcEndpoint: 'https://custom.rpc',
        maxRetries: 5,
      });
      expect(customBridge).toBeDefined();
    });
  });
});
