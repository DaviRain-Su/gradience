/**
 * Settlement Bridge Tests
 *
 * @module bridge/settlement-bridge.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
      chainHubProgramId: '6G39W7JGQz7A6L5dAvotFuRP9UbFdCJg2BqDuj6WJWec',
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
        paymentId: 'payment-789',
        agentId: VALID_PUBKEYS.agentId,
        payerAgentId: VALID_PUBKEYS.payerAgentId,
        evaluationResult: mockEvaluationResult,
        amount: '1000000',
        token: VALID_PUBKEYS.token,
        taskAccount: VALID_PUBKEYS.taskAccount,
        escrowAccount: VALID_PUBKEYS.escrowAccount,
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
        paymentId: 'payment-1',
        agentId: VALID_PUBKEYS.agentId,
        payerAgentId: VALID_PUBKEYS.payerAgentId,
        evaluationResult: mockEvaluationResult,
        amount: '1000000',
        token: 'USDC',
        taskAccount: VALID_PUBKEYS.taskAccount,
        escrowAccount: VALID_PUBKEYS.escrowAccount,
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
        paymentId: 'payment-1',
        agentId: VALID_PUBKEYS.agentId,
        payerAgentId: VALID_PUBKEYS.payerAgentId,
        evaluationResult: mockEvaluationResult,
        amount: '1000000',
        token: 'USDC',
        taskAccount: VALID_PUBKEYS.taskAccount,
        escrowAccount: VALID_PUBKEYS.escrowAccount,
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
        paymentId: 'payment-1',
        agentId: VALID_PUBKEYS.agentId,
        payerAgentId: VALID_PUBKEYS.payerAgentId,
        evaluationResult: mockEvaluationResult,
        amount: '1000000',
        token: 'USDC',
        taskAccount: VALID_PUBKEYS.taskAccount,
        escrowAccount: VALID_PUBKEYS.escrowAccount,
      });

      const confirmation = bridge.createPaymentConfirmation(settlementResult, {
        evaluationId: 'eval-confirm',
        taskId: 'task-1',
        paymentId: 'payment-1',
        agentId: VALID_PUBKEYS.agentId,
        payerAgentId: VALID_PUBKEYS.payerAgentId,
        evaluationResult: mockEvaluationResult,
        amount: '1000000',
        token: VALID_PUBKEYS.token,
        taskAccount: VALID_PUBKEYS.taskAccount,
        escrowAccount: VALID_PUBKEYS.escrowAccount,
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
        paymentId: 'payment-1',
        agentId: VALID_PUBKEYS.agentId,
        payerAgentId: VALID_PUBKEYS.payerAgentId,
        evaluationResult: mockEvaluationResult,
        amount: '1000000',
        token: 'USDC',
        taskAccount: VALID_PUBKEYS.taskAccount,
        escrowAccount: VALID_PUBKEYS.escrowAccount,
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
        chainHubProgramId: '6G39W7JGQz7A6L5dAvotFuRP9UbFdCJg2BqDuj6WJWec',
        rpcEndpoint: 'https://custom.rpc',
        maxRetries: 5,
      });
      expect(customBridge).toBeDefined();
    });
  });
});
