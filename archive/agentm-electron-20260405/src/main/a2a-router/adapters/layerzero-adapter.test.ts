/**
 * LayerZero Adapter Unit Tests
 *
 * @module a2a-router/adapters/layerzero-adapter.test
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { LayerZeroAdapter } from './layerzero-adapter.js';

describe('LayerZeroAdapter', () => {
  let adapter: LayerZeroAdapter;

  beforeEach(() => {
    adapter = new LayerZeroAdapter({
      solanaAgentId: 'test-agent-solana-address',
      sourceChain: 'ethereum',
      sourceEid: 30101, // Ethereum mainnet
      solanaEid: 30168, // Solana mainnet
      sourceAgentAddress: '0x1234567890abcdef1234567890abcdef12345678',
      endpointAddress: '0x1a44076050125825900e736c501f859c50fE728c',
      rpcUrl: 'https://ethereum.publicnode.com',
    });
  });

  afterEach(async () => {
    if (adapter.isAvailable()) {
      await adapter.shutdown();
    }
  });

  describe('Lifecycle', () => {
    it('should create adapter with correct protocol', () => {
      assert.strictEqual(adapter.protocol, 'layerzero');
    });

    it('should initialize successfully', async () => {
      await adapter.initialize();
      assert.strictEqual(adapter.isAvailable(), true);
    });

    it('should shutdown successfully', async () => {
      await adapter.initialize();
      assert.strictEqual(adapter.isAvailable(), true);

      await adapter.shutdown();
      assert.strictEqual(adapter.isAvailable(), false);
    });
  });

  describe('Messaging', () => {
    it('should fail to send when not initialized', async () => {
      const result = await adapter.send({
        id: 'test-1',
        from: 'sender',
        to: 'recipient',
        type: 'direct_message',
        timestamp: Date.now(),
        payload: { content: 'test' },
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    it('should send message when initialized', async () => {
      await adapter.initialize();

      const result = await adapter.send({
        id: 'test-1',
        from: 'sender',
        to: 'recipient',
        type: 'direct_message',
        timestamp: Date.now(),
        payload: { content: 'test' },
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.protocol, 'layerzero');
    });
  });

  describe('Reputation Sync', () => {
    it('should sync reputation to Soul chain', async () => {
      await adapter.initialize();

      const result = await adapter.syncReputation({
        taskCompletions: [
          {
            taskId: 'task-1',
            taskType: 'coding',
            completedAt: Date.now(),
            score: 85,
            reward: '1000000000',
            evaluator: 'evaluator-1',
            metadata: 'ipfs-hash-1',
          },
        ],
        attestations: [
          {
            attestationType: 'skill',
            attester: 'attester-1',
            value: 90,
            timestamp: Date.now(),
            expiresAt: Date.now() + 86400000 * 30,
          },
        ],
        scores: [
          {
            chain: 'ethereum',
            value: 85,
            weight: 1,
            updatedAt: Date.now(),
          },
        ],
      });

      assert.strictEqual(result.status, 'pending');
      assert.ok(result.txHash);
      assert.ok(result.messageId);
      assert.strictEqual(result.estimatedTime, 120);
    });

    it('should check message status', async () => {
      await adapter.initialize();

      const result = await adapter.syncReputation({
        taskCompletions: [],
        attestations: [],
        scores: [],
      });

      // Should return pending status immediately
      const status = await adapter.checkMessageStatus(result.messageId);
      assert.ok(status);
      assert.strictEqual(status?.messageId, result.messageId);
      assert.strictEqual(status?.status, 'pending');
    });
  });

  describe('Fee Estimation', () => {
    it('should estimate fees for message', async () => {
      await adapter.initialize();

      const fees = await adapter.estimateFees('test-payload-data');

      assert.ok(fees.nativeFee > BigInt(0));
      assert.ok(fees.lzTokenFee >= BigInt(0));
    });
  });

  describe('Health', () => {
    it('should report health when not initialized', () => {
      const health = adapter.health();
      assert.strictEqual(health.available, false);
      assert.strictEqual(health.peerCount, 0);
    });

    it('should report health when initialized', async () => {
      await adapter.initialize();
      const health = adapter.health();
      assert.strictEqual(health.available, true);
    });
  });

  describe('Broadcast Capabilities', () => {
    it('should broadcast agent capabilities', async () => {
      await adapter.initialize();

      await assert.doesNotReject(async () => {
        await adapter.broadcastCapabilities({
          address: 'test-agent',
          displayName: 'Test Agent',
          capabilities: ['coding', 'audit'],
          reputationScore: 0.85,
          available: true,
          discoveredVia: 'layerzero',
          lastSeenAt: Date.now(),
        });
      });
    });
  });
});
