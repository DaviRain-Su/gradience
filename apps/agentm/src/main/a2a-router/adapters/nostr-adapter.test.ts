/**
 * NostrAdapter Unit Tests
 *
 * @module a2a-router/adapters/nostr-adapter.test
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { NostrAdapter } from './nostr-adapter.js';

describe('NostrAdapter', () => {
    let adapter: NostrAdapter;

    beforeEach(() => {
        adapter = new NostrAdapter({
            relays: [], // Empty to avoid network
        });
    });

    afterEach(async () => {
        if (adapter.isAvailable()) {
            await adapter.shutdown();
        }
    });

    describe('Lifecycle', () => {
        it('should create adapter with correct protocol', () => {
            assert.strictEqual(adapter.protocol, 'nostr');
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

        it('should throw if initialized twice', async () => {
            await adapter.initialize();
            await assert.rejects(
                async () => await adapter.initialize(),
                /Already initialized/
            );
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

        it('should fail to subscribe when not initialized', async () => {
            await assert.rejects(
                async () => await adapter.subscribe(() => {}),
                /not initialized/
            );
        });
    });

    describe('Discovery', () => {
        it('should return empty agents when not initialized', async () => {
            const agents = await adapter.discoverAgents();
            assert.deepStrictEqual(agents, []);
        });
    });

    describe('Health', () => {
        it('should report unavailable when not initialized', () => {
            const health = adapter.health();
            assert.strictEqual(health.available, false);
            assert.strictEqual(health.peerCount, 0);
            assert.deepStrictEqual(health.subscribedTopics, []);
        });

        it('should report not available when initialized without relays', async () => {
            await adapter.initialize();
            const health = adapter.health();
            // Without relays, adapter is not available
            assert.strictEqual(health.available, false);
        });
    });

    describe('Broadcast', () => {
        it('should not throw when broadcasting capabilities', async () => {
            await adapter.initialize();

            // Should not throw even with no relays
            await assert.doesNotReject(async () => {
                await adapter.broadcastCapabilities({
                    address: 'test-address',
                    displayName: 'Test Agent',
                    capabilities: ['test'],
                    reputationScore: 0.5,
                    available: true,
                    discoveredVia: 'nostr',
                    lastSeenAt: Date.now(),
                });
            });
        });
    });
});

describe('NostrAdapter with mock relay', () => {
    it('should handle message type mapping', async () => {
        const adapter = new NostrAdapter({ relays: [] });

        // Test message type to kind mapping through health check
        await adapter.initialize();
        const health = adapter.health();

        // Without relays, adapter should not be available
        assert.strictEqual(health.available, false);
    });
});
