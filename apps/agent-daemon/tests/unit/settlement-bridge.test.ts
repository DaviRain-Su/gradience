/**
 * Settlement Bridge Tests
 *
 * @module bridge/settlement-bridge.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SettlementBridge, createSettlementBridge } from '../../src/bridge/settlement-bridge.js';
import type { EvaluationResult } from '../../src/evaluator/runtime.js';

describe('SettlementBridge', () => {
  let bridge: SettlementBridge;

  beforeEach(async () => {
    bridge = await createSettlementBridge({
      chainHubProgramId: 'mock-program-id',
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
        agentId: 'agent-abc',
        payerAgentId: 'agent-payer',
        evaluationResult: mockEvaluationResult,
        amount: '1000000',
        token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        taskAccount: 'task-account-address',
        escrowAccount: 'escrow-account-address',
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
        agentId: 'agent-1',
        payerAgentId: 'agent-payer',
        evaluationResult: mockEvaluationResult,
        amount: '1000000',
        token: 'USDC',
        taskAccount: 'task',
        escrowAccount: 'escrow',
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
        agentId: 'agent-1',
        payerAgentId: 'agent-payer',
        evaluationResult: mockEvaluationResult,
        amount: '1000000',
        token: 'USDC',
        taskAccount: 'task',
        escrowAccount: 'escrow',
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
        agentId: 'agent-1',
        payerAgentId: 'agent-payer',
        evaluationResult: mockEvaluationResult,
        amount: '1000000',
        token: 'USDC',
        taskAccount: 'task',
        escrowAccount: 'escrow',
      });

      const confirmation = bridge.createPaymentConfirmation(settlementResult, {
        evaluationId: 'eval-confirm',
        taskId: 'task-1',
        paymentId: 'payment-1',
        agentId: 'agent-1',
        payerAgentId: 'agent-payer',
        evaluationResult: mockEvaluationResult,
        amount: '1000000',
        token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        taskAccount: 'task',
        escrowAccount: 'escrow',
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
        agentId: 'agent-1',
        payerAgentId: 'agent-payer',
        evaluationResult: mockEvaluationResult,
        amount: '1000000',
        token: 'USDC',
        taskAccount: 'task',
        escrowAccount: 'escrow',
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
        chainHubProgramId: 'custom-program',
        rpcEndpoint: 'https://custom.rpc',
        maxRetries: 5,
      });
      expect(customBridge).toBeDefined();
    });
  });
});
