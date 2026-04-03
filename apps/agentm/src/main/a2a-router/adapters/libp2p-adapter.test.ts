/**
 * Libp2pAdapter Unit Tests
 *
 * @module a2a-router/adapters/libp2p-adapter.test
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Libp2pAdapter } from './libp2p-adapter.js';

describe('Libp2pAdapter', () => {
    let adapter: Libp2pAdapter;

    beforeEach(() => {
        adapter = new Libp2pAdapter({
            bootstrapList: [], // Empty to avoid network
        } as any);
    });

    afterEach(async () => {
        if (adapter.isAvailable()) {
            await adapter.shutdown();
        }
    });

    describe('Lifecycle', () => {
        it('should create adapter with correct protocol', () => {
            assert.strictEqual(adapter.protocol, 'libp2p');
        });

        it('should throw if bootstrap list is empty', async () => {
            // Libp2p requires bootstrap nodes
            await assert.rejects(
                async () => await adapter.initialize(),
                /Bootstrap requires/
            );
        });
    });

    describe('Health', () => {
        it('should report unavailable when not initialized', () => {
            const health = adapter.health();
            assert.strictEqual(health.available, false);
            assert.strictEqual(health.peerCount, 0);
        });
    });

    describe('Messaging (not initialized)', () => {
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
                /Not started/
            );
        });
    });

    describe('Discovery (not initialized)', () => {
        it('should return empty agents when not initialized', async () => {
            const agents = await adapter.discoverAgents();
            assert.deepStrictEqual(agents, []);
        });
    });
});

describe('Libp2pAdapter options', () => {
    it('should accept custom options', () => {
        const adapter = new Libp2pAdapter({
            bootstrapList: ['/ip4/127.0.0.1/tcp/4001/p2p/QmTest'],
            topics: ['test-topic'],
            dhtClientMode: true,
            maxConnections: 10,
        } as any);

        assert.strictEqual(adapter.protocol, 'libp2p');
    });
});
