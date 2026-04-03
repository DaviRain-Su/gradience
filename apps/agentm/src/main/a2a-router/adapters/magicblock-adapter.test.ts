/**
 * MagicBlockAdapter Unit Tests
 *
 * @module a2a-router/adapters/magicblock-adapter.test
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { MagicBlockAdapter } from './magicblock-adapter.js';

describe('MagicBlockAdapter', () => {
    let adapter: MagicBlockAdapter;

    beforeEach(() => {
        adapter = new MagicBlockAdapter({
            agentId: 'test-solana-address',
        });
    });

    afterEach(async () => {
        if (adapter.isAvailable()) {
            await adapter.shutdown();
        }
    });

    describe('Lifecycle', () => {
        it('should create adapter with correct protocol', () => {
            assert.strictEqual(adapter.protocol, 'magicblock');
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

    describe('Micropayment', () => {
        it('should estimate payment correctly', async () => {
            await adapter.initialize();

            const cost = adapter.estimatePayment('test', 'hello');
            // base: 100 + (4+5)*2 = 118
            assert.strictEqual(cost, 118);
        });

        it('should use custom payment policy', () => {
            const customAdapter = new MagicBlockAdapter({
                agentId: 'test',
                paymentPolicy: {
                    baseMicrolamports: 200,
                    perByteMicrolamports: 5,
                },
            });

            const cost = customAdapter.estimatePayment('test', 'hi');
            // base: 200 + (4+2)*5 = 230
            assert.strictEqual(cost, 230);
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

        it('should calculate payment on send', async () => {
            await adapter.initialize();

            const result = await adapter.send({
                id: 'test-1',
                from: 'sender',
                to: 'recipient',
                type: 'direct_message',
                timestamp: Date.now(),
                payload: { content: 'hello world' },
            });

            // Should succeed (in-memory transport)
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.protocol, 'magicblock');
        });
    });

    describe('Discovery', () => {
        it('should return empty agents', async () => {
            await adapter.initialize();
            const agents = await adapter.discoverAgents();
            assert.deepStrictEqual(agents, []);
        });
    });

    describe('Health', () => {
        it('should report unavailable when not initialized', () => {
            const health = adapter.health();
            assert.strictEqual(health.available, false);
        });

        it('should report available when initialized', async () => {
            await adapter.initialize();
            const health = adapter.health();
            assert.strictEqual(health.available, true);
            assert.deepStrictEqual(health.subscribedTopics, ['agent_presence']);
        });
    });

    describe('Getters', () => {
        it('should return agent when initialized', async () => {
            await adapter.initialize();
            const agent = adapter.getAgent();
            assert.ok(agent);
        });

        it('should return null when not initialized', () => {
            const agent = adapter.getAgent();
            assert.strictEqual(agent, null);
        });
    });
});
