/**
 * Wormhole Adapter Unit Tests
 *
 * @module a2a-router/adapters/wormhole-adapter.test
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { WormholeAdapter } from './wormhole-adapter.js';

describe('WormholeAdapter', () => {
    let adapter: WormholeAdapter;

    beforeEach(() => {
        adapter = new WormholeAdapter({
            solanaAgentId: 'SolanaAgentAddress111111111111111111111',
            sourceChain: 'ethereum',
            sourceChainId: 2, // Wormhole Ethereum chain ID
            solanaChainId: 1, // Wormhole Solana chain ID
            sourceAgentAddress: '0x1234567890abcdef1234567890abcdef12345678',
            coreBridgeAddress: '0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B',
            rpcUrl: 'https://ethereum.publicnode.com',
        });
    });

    afterEach(async () => {
        if (adapter.isAvailable()) {
            await adapter.shutdown();
        }
    });

    describe('Lifecycle', () => {
        it('should create adapter with correct protocol', () => {
            assert.strictEqual(adapter.protocol, 'wormhole');
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

        it('should send message when initialized', async () => {
            await adapter.initialize();

            const result = await adapter.send({
                id: 'test-1',
                from: 'sender',
                to: 'recipient',
                type: 'direct_message',
                timestamp: Date.now(),
                payload: { content: 'test' },
            });

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.protocol, 'wormhole');
        });
    });

    describe('Reputation Sync', () => {
        it('should sync reputation to Solana', async () => {
            await adapter.initialize();

            const result = await adapter.syncReputation({
                taskCompletions: [
                    {
                        taskId: 'task-1',
                        taskType: 'coding',
                        completedAt: Date.now(),
                        score: 90,
                        reward: '2000000000',
                        evaluator: 'evaluator-1',
                        metadata: 'ipfs-hash-1',
                    },
                ],
                attestations: [
                    {
                        attestationType: 'skill',
                        attester: 'attester-1',
                        value: 95,
                        timestamp: Date.now(),
                        expiresAt: Date.now() + 86400000 * 30,
                    },
                ],
                scores: [
                    {
                        chain: 'ethereum',
                        value: 90,
                        weight: 1,
                        updatedAt: Date.now(),
                    },
                ],
            });

            assert.strictEqual(result.status, 'pending');
            assert.ok(result.txHash);
            assert.ok(result.messageId);
            assert.ok(result.vaa);
            assert.strictEqual(result.estimatedTime, 900); // 15 minutes
        });

        it('should check message status', async () => {
            await adapter.initialize();

            const result = await adapter.syncReputation({
                taskCompletions: [],
                attestations: [],
                scores: [],
            });

            const status = await adapter.checkMessageStatus(result.messageId);
            assert.ok(status);
            assert.strictEqual(status?.messageId, result.messageId);
        });
    });

    describe('VAA Handling', () => {
        it('should redeem VAA on Solana', async () => {
            await adapter.initialize();

            const mockVAA = {
                version: 1,
                guardianSetIndex: 3,
                signatures: [{ guardianIndex: 0, signature: 'sig-0' }],
                timestamp: Math.floor(Date.now() / 1000),
                nonce: 123,
                emitterChain: 2,
                emitterAddress: '0x1234...',
                sequence: BigInt(1),
                consistencyLevel: 15,
                payload: 'test-payload',
                hash: 'vaa-test-hash',
            };

            const redeemResult = await adapter.redeemOnSolana(mockVAA);
            assert.ok(redeemResult.txHash);
        });
    });

    describe('Health', () => {
        it('should report health when not initialized', () => {
            const health = adapter.health();
            assert.strictEqual(health.available, false);
            assert.strictEqual(health.peerCount, 0);
        });

        it('should report health when initialized', async () => {
            await adapter.initialize();
            const health = adapter.health();
            assert.strictEqual(health.available, true);
        });
    });

    describe('Broadcast Capabilities', () => {
        it('should broadcast agent capabilities', async () => {
            await adapter.initialize();

            await assert.doesNotReject(async () => {
                await adapter.broadcastCapabilities({
                    address: 'test-agent',
                    displayName: 'Test Agent',
                    capabilities: ['coding', 'audit'],
                    reputationScore: 0.9,
                    available: true,
                    discoveredVia: 'wormhole',
                    lastSeenAt: Date.now(),
                });
            });
        });
    });
});
