/**
 * A2A Load Testing Suite
 *
 * Performance and stress tests for A2A multi-protocol communication
 *
 * @module a2a-router/load.test
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { A2ARouter } from './router.js';

describe('A2A Load Testing', () => {
  const ROUTER_COUNT = 20; // Reduced from 100 for faster testing
  let routers: A2ARouter[] = [];

  beforeEach(async () => {
    // Create multiple routers
    for (let i = 0; i < ROUTER_COUNT; i++) {
      const router = new A2ARouter({
        enableNostr: false,
        enableLibp2p: false,
        enableMagicBlock: true,
        agentId: `agent-${i}`,
      });
      await router.initialize();
      routers.push(router);
    }
  });

  afterEach(async () => {
    // Cleanup all routers
    await Promise.all(routers.map((r) => r.shutdown()));
    routers = [];
  });

  describe('Concurrent Peers', () => {
    it(`should handle ${ROUTER_COUNT} concurrent routers`, async () => {
      // Verify all routers are initialized
      for (const router of routers) {
        assert.strictEqual(router.isInitialized(), true);
      }

      // Check health of all routers
      const healths = routers.map((r) => r.health());
      for (const health of healths) {
        assert.strictEqual(health.initialized, true);
        assert.ok(health.availableProtocols.includes('magicblock'));
      }
    });

    it('should handle message burst from multiple peers', async () => {
      const MESSAGE_COUNT = 50;
      const results: { success: boolean; latency: number }[] = [];

      // Send messages from multiple routers concurrently
      const startTime = Date.now();

      const sendPromises = [];
      for (let i = 0; i < MESSAGE_COUNT; i++) {
        const router = routers[i % routers.length];
        const targetAgent = `agent-${(i + 1) % routers.length}`;

        sendPromises.push(
          router
            .send({
              to: targetAgent,
              type: 'direct_message',
              payload: { content: `Message ${i}`, timestamp: Date.now() },
              preferredProtocol: 'magicblock',
            })
            .then((result) => {
              results.push({
                success: result.success,
                latency: Date.now() - startTime,
              });
            })
        );
      }

      await Promise.all(sendPromises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all messages were sent
      assert.strictEqual(results.length, MESSAGE_COUNT);

      // Calculate success rate
      const successCount = results.filter((r) => r.success).length;
      const successRate = successCount / MESSAGE_COUNT;

      console.log(`\n  Message Burst Results:`);
      console.log(`  - Total messages: ${MESSAGE_COUNT}`);
      console.log(`  - Successful: ${successCount}`);
      console.log(`  - Success rate: ${(successRate * 100).toFixed(2)}%`);
      console.log(`  - Total time: ${totalTime}ms`);
      console.log(`  - Average latency: ${(totalTime / MESSAGE_COUNT).toFixed(2)}ms`);

      // Should have high success rate
      assert.ok(successRate > 0.95, `Success rate ${successRate} too low`);
    });

    it('should handle rapid sequential messages', async () => {
      const MESSAGE_COUNT = 100;
      const router = routers[0];
      const latencies: number[] = [];

      for (let i = 0; i < MESSAGE_COUNT; i++) {
        const start = Date.now();
        await router.send({
          to: 'agent-1',
          type: 'direct_message',
          payload: { seq: i },
          preferredProtocol: 'magicblock',
        });
        latencies.push(Date.now() - start);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);

      console.log(`\n  Sequential Message Results:`);
      console.log(`  - Messages: ${MESSAGE_COUNT}`);
      console.log(`  - Average latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`  - Min latency: ${minLatency}ms`);
      console.log(`  - Max latency: ${maxLatency}ms`);

      // Average latency should be reasonable
      assert.ok(avgLatency < 50, `Average latency ${avgLatency}ms too high`);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory under load', async () => {
      // Get initial memory usage
      const initialMemory = process.memoryUsage();

      // Send many messages
      const MESSAGE_COUNT = 200;
      const router = routers[0];

      for (let i = 0; i < MESSAGE_COUNT; i++) {
        await router.send({
          to: 'agent-1',
          type: 'direct_message',
          payload: { data: 'x'.repeat(1000) }, // 1KB payload
          preferredProtocol: 'magicblock',
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Get final memory usage
      const finalMemory = process.memoryUsage();
      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const heapGrowthMB = heapGrowth / 1024 / 1024;

      console.log(`\n  Memory Usage:`);
      console.log(`  - Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  - Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  - Growth: ${heapGrowthMB.toFixed(2)}MB`);
      console.log(`  - Per message: ${(heapGrowth / MESSAGE_COUNT).toFixed(2)} bytes`);

      // Memory growth should be reasonable (< 10MB for 200 messages)
      assert.ok(heapGrowthMB < 10, `Memory growth ${heapGrowthMB.toFixed(2)}MB too high`);
    });
  });

  describe('Throughput', () => {
    it('should achieve target message throughput', async () => {
      const DURATION_MS = 5000; // 5 seconds
      const TARGET_TPS = 50; // Target: 50 messages per second

      const router = routers[0];
      let messageCount = 0;
      const startTime = Date.now();

      // Send messages as fast as possible for 5 seconds
      while (Date.now() - startTime < DURATION_MS) {
        await router.send({
          to: 'agent-1',
          type: 'direct_message',
          payload: { timestamp: Date.now() },
          preferredProtocol: 'magicblock',
        });
        messageCount++;
      }

      const elapsed = Date.now() - startTime;
      const tps = (messageCount / elapsed) * 1000;

      console.log(`\n  Throughput Results:`);
      console.log(`  - Duration: ${elapsed}ms`);
      console.log(`  - Messages: ${messageCount}`);
      console.log(`  - TPS: ${tps.toFixed(2)}`);
      console.log(`  - Target TPS: ${TARGET_TPS}`);

      // Should achieve target TPS
      assert.ok(tps >= TARGET_TPS, `TPS ${tps.toFixed(2)} below target ${TARGET_TPS}`);
    });
  });

  describe('Subscription Scalability', () => {
    it('should handle multiple subscriptions per router', async () => {
      const SUBSCRIPTION_COUNT = 10;
      const router = routers[0];

      const subscriptions: (() => Promise<void>)[] = [];

      // Create multiple subscriptions
      for (let i = 0; i < SUBSCRIPTION_COUNT; i++) {
        const unsubscribe = await router.subscribe((msg) => {
          // Handler
        });
        subscriptions.push(unsubscribe);
      }

      // Check health
      const health = router.health();
      assert.strictEqual(health.activeSubscriptions, SUBSCRIPTION_COUNT);

      // Cleanup
      await Promise.all(subscriptions.map((unsub) => unsub()));

      // Verify cleanup
      const finalHealth = router.health();
      assert.strictEqual(finalHealth.activeSubscriptions, 0);
    });
  });
});

describe('A2A Benchmark', () => {
  it('should benchmark message latency', async () => {
    const router = new A2ARouter({
      enableMagicBlock: true,
      agentId: 'benchmark-agent',
    });

    await router.initialize();

    const ITERATIONS = 100;
    const latencies: number[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      await router.send({
        to: 'recipient',
        type: 'direct_message',
        payload: { test: i },
        preferredProtocol: 'magicblock',
      });
      latencies.push(performance.now() - start);
    }

    await router.shutdown();

    // Calculate statistics
    const sorted = [...latencies].sort((a, b) => a - b);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    console.log(`\n  Latency Benchmark (${ITERATIONS} iterations):`);
    console.log(`  - Average: ${avg.toFixed(2)}ms`);
    console.log(`  - P50: ${p50.toFixed(2)}ms`);
    console.log(`  - P95: ${p95.toFixed(2)}ms`);
    console.log(`  - P99: ${p99.toFixed(2)}ms`);
    console.log(`  - Min: ${sorted[0].toFixed(2)}ms`);
    console.log(`  - Max: ${sorted[sorted.length - 1].toFixed(2)}ms`);

    // Assert performance targets
    assert.ok(avg < 10, `Average latency ${avg.toFixed(2)}ms too high`);
    assert.ok(p95 < 20, `P95 latency ${p95.toFixed(2)}ms too high`);
  });
});
