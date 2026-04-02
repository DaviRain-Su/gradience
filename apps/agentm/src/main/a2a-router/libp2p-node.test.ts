/**
 * Libp2pNode unit tests
 * 
 * @module a2a-router/libp2p-node.test
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Libp2pNode } from './libp2p-node.js';
import { LIBP2P_CONFIG } from './constants.js';

describe('Libp2pNode', () => {
    let node: Libp2pNode;

    beforeEach(() => {
        // Use empty bootstrap list to avoid network calls in unit tests
        node = new Libp2pNode({
            bootstrapList: [],
            topics: [],
        });
    });

    afterEach(async () => {
        await node.stop();
    });

    describe('constructor', () => {
        it('should create with default options', () => {
            const n = new Libp2pNode();
            assert.ok(n);
        });

        it('should use provided bootstrap list', () => {
            const bootstrapList = ['/dns4/test.libp2p.io/tcp/443/wss/p2p/test'];
            const n = new Libp2pNode({ bootstrapList });
            assert.deepStrictEqual(n['options'].bootstrapList, bootstrapList);
        });

        it('should use provided topics', () => {
            const topics = ['test/topic'];
            const n = new Libp2pNode({ topics });
            assert.deepStrictEqual(n['options'].topics, topics);
        });
    });

    describe('lifecycle', () => {
        it('should not be started initially', () => {
            assert.strictEqual(node.isStarted(), false);
        });

        it('should throw if started twice', async () => {
            // Use a valid bootstrap address for this test
            const nodeWithBootstrap = new Libp2pNode({
                bootstrapList: LIBP2P_CONFIG.BOOTSTRAP_LIST.slice(0, 1),
                topics: [],
            });
            try {
                await nodeWithBootstrap.start();
                await assert.rejects(
                    nodeWithBootstrap.start(),
                    /Already started/
                );
            } finally {
                await nodeWithBootstrap.stop();
            }
        });

        it('should be stoppable even if not started', async () => {
            await node.stop(); // Should not throw
            assert.strictEqual(node.isStarted(), false);
        });
    });

    describe('identity', () => {
        it('should throw getPeerId if not started', () => {
            assert.throws(
                () => node.getPeerId(),
                /Not started/
            );
        });

        it('should throw getMultiaddrs if not started', () => {
            assert.throws(
                () => node.getMultiaddrs(),
                /Not started/
            );
        });
    });

    describe('connection management', () => {
        it('should throw dial if not started', async () => {
            await assert.rejects(
                node.dial('/dns4/test.libp2p.io/tcp/443/wss/p2p/test'),
                /Not started/
            );
        });

        it('should throw hangUp if not started', async () => {
            await assert.rejects(
                node.hangUp('test-peer-id'),
                /Not started/
            );
        });

        it('should throw getPeerCount if not started', () => {
            assert.throws(
                () => node.getPeerCount(),
                /Not started/
            );
        });
    });

    describe('pubsub', () => {
        it('should throw publish if not started', async () => {
            await assert.rejects(
                node.publish('test-topic', { type: 'test', from: 'me', timestamp: Date.now(), payload: {} }),
                /Not started/
            );
        });

        it('should throw subscribe if not started', async () => {
            await assert.rejects(
                node.subscribe('test-topic', () => {}),
                /Not started/
            );
        });

        it('should throw getSubscribedTopics if not started', () => {
            assert.throws(
                () => node.getSubscribedTopics(),
                /Not started/
            );
        });
    });

    describe('discovery', () => {
        it('should throw broadcastCapabilities if not started', async () => {
            await assert.rejects(
                node.broadcastCapabilities({
                    agent: 'test-agent',
                    display_name: 'Test Agent',
                    capabilities: ['test'],
                    reputation_score: 100,
                    available: true,
                    multiaddrs: [],
                }),
                /Not started/
            );
        });

        it('should throw subscribeDiscovery if not started', async () => {
            await assert.rejects(
                node.subscribeDiscovery(() => {}),
                /Not started/
            );
        });

        it('should return empty discovered agents initially', () => {
            assert.deepStrictEqual(node.getDiscoveredAgents(), []);
        });
    });

    describe('direct messaging', () => {
        it('should throw sendDirectMessage if not started', async () => {
            await assert.rejects(
                node.sendDirectMessage('peer-id', 'hello'),
                /Not started/
            );
        });

        it('should throw subscribeDirectMessages if not started', async () => {
            await assert.rejects(
                node.subscribeDirectMessages(() => {}),
                /Not started/
            );
        });
    });

    describe('health', () => {
        it('should return not started health', () => {
            const health = node.health();
            assert.strictEqual(health.started, false);
            assert.strictEqual(health.peerId, '');
            assert.strictEqual(health.peerCount, 0);
        });
    });
});
