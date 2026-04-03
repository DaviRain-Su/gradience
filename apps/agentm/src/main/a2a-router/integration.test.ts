/**
 * A2A Integration Tests
 *
 * End-to-end tests for A2A multi-protocol communication
 *
 * @module a2a-router/integration.test
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { A2ARouter } from './router.js';
import type { A2AMessage, AgentInfo } from '../../shared/a2a-router-types.js';

describe('A2A Integration', () => {
  // Test routers
  let routerA: A2ARouter;
  let routerB: A2ARouter;

  beforeEach(async () => {
    // Create two routers for testing
    routerA = new A2ARouter({
      enableNostr: false, // Disable for local testing
      enableLibp2p: false,
      enableMagicBlock: true,
      agentId: 'agent-a-solana-address',
    });

    routerB = new A2ARouter({
      enableNostr: false,
      enableLibp2p: false,
      enableMagicBlock: true,
      agentId: 'agent-b-solana-address',
    });

    // Initialize both
    await routerA.initialize();
    await routerB.initialize();
  });

  afterEach(async () => {
    await routerA.shutdown();
    await routerB.shutdown();
  });

  describe('Message Flow', () => {
    it('should send message from A to B via MagicBlock', async () => {
      // Send from A to B
      const result = await routerA.send({
        to: 'agent-b-solana-address',
        type: 'direct_message',
        payload: { content: 'Hello from A!' },
        preferredProtocol: 'magicblock',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.protocol, 'magicblock');
    });

    it('should support bidirectional messaging', async () => {
      // A sends to B
      const resultA = await routerA.send({
        to: 'agent-b-solana-address',
        type: 'direct_message',
        payload: { content: 'Hello B!' },
        preferredProtocol: 'magicblock',
      });

      // B sends to A
      const resultB = await routerB.send({
        to: 'agent-a-solana-address',
        type: 'direct_message',
        payload: { content: 'Hello A!' },
        preferredProtocol: 'magicblock',
      });

      assert.strictEqual(resultA.success, true);
      assert.strictEqual(resultB.success, true);
    });
  });

  describe('Health Monitoring', () => {
    it('should report health status', () => {
      const healthA = routerA.health();
      const healthB = routerB.health();

      assert.strictEqual(healthA.initialized, true);
      assert.strictEqual(healthB.initialized, true);

      assert.ok(healthA.availableProtocols.includes('magicblock'));
      assert.ok(healthB.availableProtocols.includes('magicblock'));
    });
  });

  describe('Protocol Fallback', () => {
    it('should use preferred protocol when available', async () => {
      const result = await routerA.send({
        to: 'recipient',
        type: 'direct_message',
        payload: { content: 'test' },
        preferredProtocol: 'magicblock',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.protocol, 'magicblock');
    });

    it('should fail when preferred protocol not available', async () => {
      // Try to use Nostr when not enabled
      const result = await routerA.send({
        to: 'recipient',
        type: 'direct_message',
        payload: { content: 'test' },
        preferredProtocol: 'nostr',
      });

      // Should fail because Nostr is not available
      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });
  });
});
