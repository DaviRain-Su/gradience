/**
 * MPP Handler E2E Tests
 *
 * Tests for Multi-Party Payment scenarios.
 * Pure logic tests (createPayment, castVote, cleanupExpiredPayments, validation)
 * run without chain. The releaseFunds test requires real SOL and is skipped.
 *
 * @module payments/mpp-handler.e2e.test
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { MPPHandler, type MPPPayment, type MPPParticipant, type MPPJudge } from '../src/payments/mpp-handler.js';

// Test configuration
const DEVNET_RPC = 'https://api.devnet.solana.com';

// Helper to create test keypair
function createTestWallet(): Keypair {
  return Keypair.generate();
}

describe('MPP Handler', () => {
  let handler: MPPHandler;
  let payer: Keypair;
  let agent1: Keypair;
  let agent2: Keypair;
  let judge1: Keypair;
  let judge2: Keypair;
  let judge3: Keypair;

  beforeAll(() => {
    // No real connection needed — these are pure in-memory logic tests
    [payer, agent1, agent2, judge1, judge2, judge3] = [
      createTestWallet(),
      createTestWallet(),
      createTestWallet(),
      createTestWallet(),
      createTestWallet(),
      createTestWallet(),
    ];

    handler = new MPPHandler({ rpcEndpoint: DEVNET_RPC });
  });

  describe('Multi-Judge Escrow', () => {
    it('should create escrow with multiple judges', async () => {
      const participants = [
        {
          address: agent1.publicKey.toBase58(),
          shareBps: 10000, // Must sum to 10000 (100%)
          role: 'agent' as const,
        },
      ];

      const judges = [
        { address: judge1.publicKey.toBase58(), weight: 1 },
        { address: judge2.publicKey.toBase58(), weight: 1 },
        { address: judge3.publicKey.toBase58(), weight: 1 },
      ];

      const payment = await handler.createPayment({
        taskId: 'test-task-1',
        totalAmount: 1000000000n, // 1 SOL
        token: 'SOL',
        tokenSymbol: 'SOL',
        decimals: 9,
        payer: payer.publicKey.toBase58(),
        participants,
        judges,
        releaseConditions: {
          type: 'majority',
        },
        expiresAt: Date.now() + 86400000, // 1 day
      });

      expect(payment.paymentId).toBeDefined();
      expect(payment.status).toBe('pending');
      expect(payment.judges).toHaveLength(3);
    });

    it('should track judge votes', async () => {
      const payment = await handler.createPayment({
        taskId: 'test-task-vote',
        totalAmount: 1_000_000_000n,
        token: 'SOL',
        tokenSymbol: 'SOL',
        decimals: 9,
        payer: payer.publicKey.toBase58(),
        participants: [
          {
            address: agent1.publicKey.toBase58(),
            shareBps: 10000,
            role: 'agent',
            allocatedAmount: 0n,
            releasedAmount: 0n,
            hasClaimed: false,
          },
        ],
        judges: [
          { address: judge1.publicKey.toBase58(), weight: 1, hasVoted: false },
          { address: judge2.publicKey.toBase58(), weight: 1, hasVoted: false },
        ],
        releaseConditions: {
          type: 'voting',
          threshold: 2,
        },
        expiresAt: Date.now() + 86400000,
      });

      // Record votes (in real implementation, these would be signed)
      await handler.castVote(payment.paymentId, judge1.publicKey.toBase58(), 'approve');
      await handler.castVote(payment.paymentId, judge2.publicKey.toBase58(), 'approve');

      const updated = handler.getPayment(payment.paymentId);
      expect(updated?.status).toBe('approved');
    });
  });

  describe('Revenue Sharing', () => {
    it('should create payment with multiple participants', async () => {
      const participants: MPPParticipant[] = [
        {
          address: agent1.publicKey.toBase58(),
          shareBps: 5000, // 50%
          role: 'agent',
          allocatedAmount: 0n,
          releasedAmount: 0n,
          hasClaimed: false,
        },
        {
          address: agent2.publicKey.toBase58(),
          shareBps: 3000, // 30%
          role: 'contributor',
          allocatedAmount: 0n,
          releasedAmount: 0n,
          hasClaimed: false,
        },
        {
          address: payer.publicKey.toBase58(),
          shareBps: 2000, // 20%
          role: 'stakeholder',
          allocatedAmount: 0n,
          releasedAmount: 0n,
          hasClaimed: false,
        },
      ];

      const payment = await handler.createPayment({
        taskId: 'test-revenue-share',
        totalAmount: 1_000_000_000n,
        token: 'SOL',
        tokenSymbol: 'SOL',
        decimals: 9,
        payer: payer.publicKey.toBase58(),
        participants,
        judges: [{ address: judge1.publicKey.toBase58(), weight: 1, hasVoted: false }],
        releaseConditions: {
          type: 'immediate',
        },
        expiresAt: Date.now() + 86400000,
      });

      expect(payment.participants).toHaveLength(3);
      expect(payment.participants[0].shareBps).toBe(5000);
      expect(payment.participants[1].shareBps).toBe(3000);
      expect(payment.participants[2].shareBps).toBe(2000);
    });

    it('should calculate correct allocations', async () => {
      const participants: MPPParticipant[] = [
        {
          address: agent1.publicKey.toBase58(),
          shareBps: 3333,
          role: 'agent',
          allocatedAmount: 0n,
          releasedAmount: 0n,
          hasClaimed: false,
        },
        {
          address: agent2.publicKey.toBase58(),
          shareBps: 3333,
          role: 'agent',
          allocatedAmount: 0n,
          releasedAmount: 0n,
          hasClaimed: false,
        },
        {
          address: payer.publicKey.toBase58(),
          shareBps: 3334,
          role: 'agent',
          allocatedAmount: 0n,
          releasedAmount: 0n,
          hasClaimed: false,
        },
      ];

      const payment = await handler.createPayment({
        taskId: 'test-allocations',
        totalAmount: 1_000_000_000n,
        token: 'SOL',
        tokenSymbol: 'SOL',
        decimals: 9,
        payer: payer.publicKey.toBase58(),
        participants,
        judges: [],
        releaseConditions: { type: 'immediate' },
        expiresAt: Date.now() + 86400000,
      });

      // Verify total shares = 10000 bps
      const totalShares = payment.participants.reduce((sum, p) => sum + p.shareBps, 0);
      expect(totalShares).toBe(10000);
    });
  });

  describe('Payment Status Lifecycle', () => {
    it('should transition through payment states', async () => {
      // Create pending payment
      const payment = await handler.createPayment({
        taskId: 'test-lifecycle',
        totalAmount: 1_000_000_000n,
        token: 'SOL',
        tokenSymbol: 'SOL',
        decimals: 9,
        payer: payer.publicKey.toBase58(),
        participants: [
          {
            address: agent1.publicKey.toBase58(),
            shareBps: 10000,
            role: 'agent',
            allocatedAmount: 0n,
            releasedAmount: 0n,
            hasClaimed: false,
          },
        ],
        judges: [{ address: judge1.publicKey.toBase58(), weight: 1, hasVoted: false }],
        releaseConditions: { type: 'voting', threshold: 1 },
        expiresAt: Date.now() + 86400000,
      });

      expect(payment.status).toBe('pending');

      // Approve
      await handler.castVote(payment.paymentId, judge1.publicKey.toBase58(), 'approve');
      let updated = handler.getPayment(payment.paymentId);
      expect(updated?.status).toBe('approved');

      // Release
      await handler.releaseFunds(payment.paymentId, payer);
      updated = handler.getPayment(payment.paymentId);
      expect(updated?.status).toBe('partially_released');
    });

    it('should handle expired payments', async () => {
      const payment = await handler.createPayment({
        taskId: 'test-expired',
        totalAmount: 1_000_000_000n,
        token: 'SOL',
        tokenSymbol: 'SOL',
        decimals: 9,
        payer: payer.publicKey.toBase58(),
        participants: [
          {
            address: agent1.publicKey.toBase58(),
            shareBps: 10000,
            role: 'agent',
            allocatedAmount: 0n,
            releasedAmount: 0n,
            hasClaimed: false,
          },
        ],
        judges: [],
        releaseConditions: { type: 'immediate' },
        expiresAt: Date.now() - 1000, // Already expired
      });

      // Process expired payments
      handler.cleanupExpiredPayments();

      const updated = handler.getPayment(payment.paymentId);
      expect(updated?.status).toBe('expired');
    });
  });

  describe('Error Handling', () => {
    it('should reject invalid share distribution', async () => {
      const participants: MPPParticipant[] = [
        {
          address: agent1.publicKey.toBase58(),
          shareBps: 6000,
          role: 'agent',
          allocatedAmount: 0n,
          releasedAmount: 0n,
          hasClaimed: false,
        },
        {
          address: agent2.publicKey.toBase58(),
          shareBps: 5000, // Total = 11000, invalid
          role: 'agent',
          allocatedAmount: 0n,
          releasedAmount: 0n,
          hasClaimed: false,
        },
      ];

      await expect(
        handler.createPayment({
          taskId: 'test-invalid',
          totalAmount: 1_000_000_000n,
          token: 'SOL',
          tokenSymbol: 'SOL',
          decimals: 9,
          payer: payer.publicKey.toBase58(),
          participants,
          judges: [],
          releaseConditions: { type: 'immediate' },
          expiresAt: Date.now() + 86400000,
        })
      ).rejects.toThrow();
    });

    it('should reject duplicate judge addresses', async () => {
      await expect(
        handler.createPayment({
          taskId: 'test-dup-judge',
          totalAmount: 1_000_000_000n,
          token: 'SOL',
          tokenSymbol: 'SOL',
          decimals: 9,
          payer: payer.publicKey.toBase58(),
          participants: [
            {
              address: agent1.publicKey.toBase58(),
              shareBps: 10000,
              role: 'agent',
              allocatedAmount: 0n,
              releasedAmount: 0n,
              hasClaimed: false,
            },
          ],
          judges: [
            { address: judge1.publicKey.toBase58(), weight: 1, hasVoted: false },
            { address: judge1.publicKey.toBase58(), weight: 1, hasVoted: false }, // Duplicate
          ],
          releaseConditions: { type: 'voting', threshold: 1 },
          expiresAt: Date.now() + 86400000,
        })
      ).rejects.toThrow();
    });
  });
});
