/**
 * A2ARouter Unit Tests
 *
 * @module a2a-router/router.test
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { A2ARouter } from './router.js';

describe('A2ARouter', () => {
    let router: A2ARouter;

    beforeEach(() => {
        router = new A2ARouter({
            enableNostr: true,
            nostrOptions: {
                relays: [], // Empty to avoid network
            },
        });
    });

    afterEach(async () => {
        if (router.isInitialized()) {
            await router.shutdown();
        }
    });

    describe('Lifecycle', () => {
        it('should create router', () => {
            assert.ok(router);
            assert.strictEqual(router.isInitialized(), false);
        });

        it('should initialize successfully', async () => {
            await router.initialize();
            assert.strictEqual(router.isInitialized(), true);
        });

        it('should shutdown successfully', async () => {
            await router.initialize();
            assert.strictEqual(router.isInitialized(), true);

            await router.shutdown();
            assert.strictEqual(router.isInitialized(), false);
        });

        it('should throw if initialized twice', async () => {
            await router.initialize();
            await assert.rejects(
                async () => await router.initialize(),
                /Already initialized/
            );
        });

        it('should allow shutdown when not initialized', async () => {
            await assert.doesNotReject(async () => {
                await router.shutdown();
            });
        });
    });

    describe('Health', () => {
        it('should report health when initialized', async () => {
            await router.initialize();
            const health = router.health();

            assert.strictEqual(health.initialized, true);
            assert.ok(Array.isArray(health.availableProtocols));
            assert.ok(health.protocolStatus.nostr);
            assert.ok(health.protocolStatus.xmtp);
        });

        it('should report not initialized when not started', () => {
            const health = router.health();
            assert.strictEqual(health.initialized, false);
        });
    });

    describe('Messaging', () => {
        it('should throw when sending without initialization', async () => {
            await assert.rejects(
                async () => await router.send({
                    to: 'recipient',
                    type: 'direct_message',
                    payload: { content: 'test' },
                }),
                /Not initialized/
            );
        });

        it('should handle send with no available protocol', async () => {
            // Create router with all protocols disabled
            const emptyRouter = new A2ARouter({
                enableNostr: false,
            });
            await emptyRouter.initialize();

            const result = await emptyRouter.send({
                to: 'recipient',
                type: 'direct_message',
                payload: { content: 'test' },
            });

            assert.strictEqual(result.success, false);
            assert.ok(result.error);

            await emptyRouter.shutdown();
        });
    });

    describe('Subscribe', () => {
        it('should throw when subscribing without initialization', async () => {
            await assert.rejects(
                async () => await router.subscribe(() => {}),
                /Not initialized/
            );
        });

        it('should subscribe successfully when initialized', async () => {
            await router.initialize();

            const unsubscribe = await router.subscribe((message) => {
                console.log(message);
            });

            assert.ok(typeof unsubscribe === 'function');

            // Cleanup
            await unsubscribe();
        });
    });

    describe('Discovery', () => {
        it('should throw when discovering without initialization', async () => {
            await assert.rejects(
                async () => await router.discoverAgents(),
                /Not initialized/
            );
        });

        it('should return empty array when initialized', async () => {
            await router.initialize();
            const agents = await router.discoverAgents();
            assert.deepStrictEqual(agents, []);
        });
    });

    describe('Broadcast', () => {
        it('should throw when broadcasting without initialization', async () => {
            await assert.rejects(
                async () => await router.broadcastCapabilities({
                    address: 'test',
                    displayName: 'Test',
                    capabilities: [],
                    reputationScore: 0,
                    available: true,
                    discoveredVia: 'nostr',
                    lastSeenAt: Date.now(),
                }),
                /Not initialized/
            );
        });

        it('should broadcast when initialized', async () => {
            await router.initialize();

            await assert.doesNotReject(async () => {
                await router.broadcastCapabilities({
                    address: 'test-address',
                    displayName: 'Test',
                    capabilities: ['test'],
                    reputationScore: 0.5,
                    available: true,
                    discoveredVia: 'nostr',
                    lastSeenAt: Date.now(),
                });
            });
        });
    });

    describe('Protocol Priority', () => {
        it('should use custom protocol priority', async () => {
            const customRouter = new A2ARouter({
                enableNostr: true,
                protocolPriority: {
                    broadcast: ['nostr'],
                    discovery: ['nostr'],
                    direct_message: ['nostr'],
                    task_negotiation: ['nostr'],
                    interop: ['nostr'],
                },
                nostrOptions: { relays: [] },
            });

            await customRouter.initialize();
            const health = customRouter.health();
            assert.strictEqual(health.initialized, true);

            await customRouter.shutdown();
        });
    });
});
