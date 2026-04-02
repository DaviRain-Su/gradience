/**
 * A2A Router unit tests
 *
 * @module a2a-router/router.test
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { A2ARouter } from './router.js';
import { A2A_ERROR_CODES } from './constants.js';

describe('A2ARouter', () => {
    let router: A2ARouter;

    beforeEach(() => {
        // Create router with all protocols disabled for unit tests
        router = new A2ARouter({
            enableNostr: false,
            enableLibp2p: false,
            enableMagicBlock: false,
        });
    });

    afterEach(async () => {
        await router.shutdown();
    });

    describe('constructor', () => {
        it('should create with default options', () => {
            const r = new A2ARouter();
            assert.ok(r);
            assert.strictEqual(r.isInitialized(), false);
        });

        it('should create with custom options', () => {
            const r = new A2ARouter({
                enableNostr: true,
                enableLibp2p: true,
                healthCheckInterval: 60000,
            });
            assert.ok(r);
        });
    });

    describe('lifecycle', () => {
        it('should initialize and shutdown', async () => {
            await router.initialize();
            assert.strictEqual(router.isInitialized(), true);

            await router.shutdown();
            assert.strictEqual(router.isInitialized(), false);
        });

        it('should throw if initialized twice', async () => {
            await router.initialize();
            await assert.rejects(
                router.initialize(),
                /Already initialized/
            );
        });

        it('should be idempotent on shutdown', async () => {
            await router.initialize();
            await router.shutdown();
            await router.shutdown(); // Should not throw
            assert.strictEqual(router.isInitialized(), false);
        });
    });

    describe('messaging', () => {
        it('should throw send if not initialized', async () => {
            await assert.rejects(
                router.send({
                    to: 'recipient-address',
                    type: 'direct_message',
                    payload: { content: 'hello' },
                }),
                /Not initialized/
            );
        });

        it('should throw subscribe if not initialized', async () => {
            await assert.rejects(
                router.subscribe(() => {}),
                /Not initialized/
            );
        });

        it('should return error if no protocol available', async () => {
            await router.initialize();
            const result = await router.send({
                to: 'recipient-address',
                type: 'direct_message',
                payload: { content: 'hello' },
            });

            assert.strictEqual(result.success, false);
            assert.strictEqual(result.errorCode, A2A_ERROR_CODES.ROUTER_NO_PROTOCOL_AVAILABLE);
        });
    });

    describe('discovery', () => {
        it('should throw discoverAgents if not initialized', async () => {
            await assert.rejects(
                router.discoverAgents(),
                /Not initialized/
            );
        });

        it('should throw broadcastCapabilities if not initialized', async () => {
            await assert.rejects(
                router.broadcastCapabilities({
                    address: 'test-address',
                    displayName: 'Test Agent',
                    capabilities: ['test'],
                    reputationScore: 100,
                    available: true,
                    discoveredVia: 'nostr',
                    lastSeenAt: Date.now(),
                }),
                /Not initialized/
            );
        });

        it('should return empty agents when no protocols', async () => {
            await router.initialize();
            const agents = await router.discoverAgents();
            assert.deepStrictEqual(agents, []);
        });
    });

    describe('health', () => {
        it('should return health status', () => {
            const health = router.health();
            assert.strictEqual(health.initialized, false);
            assert.deepStrictEqual(health.availableProtocols, []);
            assert.strictEqual(health.totalPeers, 0);
        });

        it('should return initialized health after init', async () => {
            await router.initialize();
            const health = router.health();
            assert.strictEqual(health.initialized, true);
        });
    });
});
