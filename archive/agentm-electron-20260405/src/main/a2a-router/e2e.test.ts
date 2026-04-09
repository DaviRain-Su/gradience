/**
 * A2A Multi-Protocol E2E Tests
 *
 * End-to-end tests for A2A communication flow
 *
 * @module a2a-router/e2e.test
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { A2ARouter } from './router.js';
import { NostrAdapter } from './adapters/nostr-adapter.js';

describe('A2A E2E', () => {
    let router1: A2ARouter;
    let router2: A2ARouter;

    beforeEach(async () => {
        // Create two routers for testing
        router1 = new A2ARouter({
            enableNostr: false, // Disable to avoid network
        });

        router2 = new A2ARouter({
            enableNostr: false,
        });

        // Initialize both routers
        await router1.initialize();
        await router2.initialize();
    });

    afterEach(async () => {
        await router1.shutdown();
        await router2.shutdown();
    });

    describe('Router Lifecycle', () => {
        it('should initialize both routers', () => {
            assert.strictEqual(router1.isInitialized(), true);
            assert.strictEqual(router2.isInitialized(), true);
        });

        it('should report health status', () => {
            const health1 = router1.health();
            const health2 = router2.health();

            assert.strictEqual(health1.initialized, true);
            assert.strictEqual(health2.initialized, true);
        });
    });

    describe('Message Flow', () => {
        it('should handle message send with no protocol available', async () => {
            // Since we disabled nostr and XMTP, sending should fail gracefully
            const result = await router1.send({
                to: 'test-recipient',
                type: 'direct_message',
                payload: { content: 'test' },
            });

            assert.strictEqual(result.success, false);
            assert.ok(result.error);
        });
    });

    describe('Discovery', () => {
        it('should return empty agents when no protocols available', async () => {
            const agents = await router1.discoverAgents();
            assert.deepStrictEqual(agents, []);
        });
    });

    describe('Protocol Adapters', () => {
        it('should create NostrAdapter', () => {
            const adapter = new NostrAdapter({
                relays: [],
            });
            assert.ok(adapter);
            assert.strictEqual(adapter.protocol, 'nostr');
        });
    });
});

describe('A2A Integration', () => {
    it('should work with useA2A hook structure', async () => {
        // Verify the hook can be imported
        const module = await import('../../renderer/hooks/useA2A.js');
        assert.ok(module.useA2A);
    });

    it('should work with DiscoverView integration', async () => {
        // Verify types are compatible
        const module = await import('../../renderer/views/DiscoverView.tsx');
        assert.ok(module.DiscoverView);
    });

    it('should work with ChatView integration', async () => {
        // Verify types are compatible
        const module = await import('../../renderer/views/ChatView.tsx');
        assert.ok(module.ChatView);
    });
});
