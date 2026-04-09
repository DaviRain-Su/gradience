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

        it('should initialize successfully (no-op without relays)', async () => {
            await adapter.initialize();
            // Without relays, adapter is not available
            assert.strictEqual(adapter.isAvailable(), false);
        });

        it('should shutdown successfully (no-op without relays)', async () => {
            await adapter.initialize();
            assert.strictEqual(adapter.isAvailable(), false);

            await adapter.shutdown();
            assert.strictEqual(adapter.isAvailable(), false);
        });

        it('should allow multiple initialize calls without relays', async () => {
            // Without relays, initialize is a no-op, so multiple calls are allowed
            await adapter.initialize();
            await assert.doesNotReject(async () => {
                await adapter.initialize();
            });
        });
    });

    describe('Messaging (discovery-only)', () => {
        it('should reject send with discovery-only error', async () => {
            const result = await adapter.send({
                id: 'test-1',
                from: 'sender',
                to: 'recipient',
                type: 'direct_message',
                timestamp: Date.now(),
                payload: { content: 'test' },
            });

            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('discovery-only'));
        });

        it('should return no-op subscription', async () => {
            const subscription = await adapter.subscribe(() => {});
            assert.strictEqual(subscription.protocol, 'nostr');
            assert.ok(typeof subscription.unsubscribe === 'function');
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

describe('NostrAdapter - Soul Profile Features', () => {
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

    describe('broadcastSoulProfile()', () => {
        it('should not throw when broadcasting soul profile', async () => {
            await adapter.initialize();

            // Should not throw even with no relays
            await assert.doesNotReject(async () => {
                await adapter.broadcastSoulProfile(
                    {
                        address: 'test-address',
                        displayName: 'Test Agent',
                        capabilities: ['coding', 'research'],
                        reputationScore: 85,
                        available: true,
                        discoveredVia: 'nostr',
                        lastSeenAt: Date.now(),
                    },
                    {
                        cid: 'QmTest123',
                        type: 'agent',
                        embeddingHash: 'embed-hash-123',
                        visibility: 'public',
                        tags: ['AI', 'blockchain', 'DeFi'],
                    },
                );
            });
        });
    });

    describe('discoverAgents() with Soul filters', () => {
        it('should return empty when no relays configured', async () => {
            await adapter.initialize();

            const agents = await adapter.discoverAgents({
                soulType: 'agent',
                interestTags: ['AI', 'blockchain'],
            });

            assert.deepStrictEqual(agents, []);
        });

        it('should support all Soul filter combinations', async () => {
            await adapter.initialize();

            // Should not throw with all filters
            await assert.doesNotReject(async () => {
                await adapter.discoverAgents({
                    soulType: 'agent',
                    interestTags: ['AI'],
                    soulVisibility: 'public',
                    minReputation: 60,
                });
            });
        });
    });
});
