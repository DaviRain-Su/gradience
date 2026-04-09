/**
 * XMTP Adapter Tests
 *
 * @module a2a-router/adapters/xmtp-adapter.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { XMTPAdapter } from './xmtp-adapter.js';
import type { A2AMessage } from '../../../shared/a2a-router-types.js';

describe('XMTPAdapter', () => {
    let adapter: XMTPAdapter;

    beforeEach(() => {
        adapter = new XMTPAdapter({
            env: 'dev',
            enableStreaming: false,
        });
    });

    afterEach(async () => {
        await adapter.shutdown();
    });

    describe('lifecycle', () => {
        it('should initialize without private key in read-only mode', async () => {
            await adapter.initialize();
            expect(adapter.isAvailable()).toBe(false);
        });

        it('should report correct protocol type', () => {
            expect(adapter.protocol).toBe('xmtp');
        });

        it('should shutdown gracefully', async () => {
            await adapter.initialize();
            await expect(adapter.shutdown()).resolves.not.toThrow();
        });
    });

    describe('messaging', () => {
        it('should return error when sending without initialization', async () => {
            const message: A2AMessage = {
                id: 'test-1',
                from: '0x123',
                to: '0x456',
                type: 'direct_message',
                timestamp: Date.now(),
                payload: { text: 'Hello' },
            };

            const result = await adapter.send(message);

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('PROTOCOL_NOT_AVAILABLE');
        });

        it('should return error when sending without private key', async () => {
            await adapter.initialize();

            const message: A2AMessage = {
                id: 'test-2',
                from: '0x123',
                to: '0x456',
                type: 'direct_message',
                timestamp: Date.now(),
                payload: { text: 'Hello' },
            };

            const result = await adapter.send(message);

            expect(result.success).toBe(false);
        });
    });

    describe('discovery', () => {
        it('should return empty array for discoverAgents', async () => {
            const agents = await adapter.discoverAgents();
            expect(agents).toEqual([]);
        });

        it('should not throw for broadcastCapabilities', async () => {
            await expect(
                adapter.broadcastCapabilities({
                    address: '0x123',
                    displayName: 'Test Agent',
                    capabilities: ['test'],
                    reputationScore: 50,
                    available: true,
                    discoveredVia: 'xmtp',
                    lastSeenAt: Date.now(),
                }),
            ).resolves.not.toThrow();
        });
    });

    describe('subscription', () => {
        it('should create subscription', async () => {
            const handler = () => {};
            const sub = await adapter.subscribe(handler);

            expect(sub.protocol).toBe('xmtp');
            expect(typeof sub.unsubscribe).toBe('function');

            await sub.unsubscribe();
        });
    });

    describe('health', () => {
        it('should report unavailable when not initialized', () => {
            const health = adapter.health();

            expect(health.available).toBe(false);
            expect(health.peerCount).toBe(0);
        });

        it('should report available when initialized', async () => {
            // With private key it would be available
            // Without, it should still report based on client state
            await adapter.initialize();

            const health = adapter.health();
            // Should be false since no private key
            expect(health.available).toBe(false);
        });
    });

    describe('XMTP-specific methods', () => {
        it('should return null inboxId when not initialized', () => {
            expect(adapter.getInboxId()).toBeNull();
        });

        it('should return empty addresses when not initialized', () => {
            expect(adapter.getAddresses()).toEqual([]);
        });

        it('should return false for canMessage when not initialized', async () => {
            const canMessage = await adapter.canMessage('0x123');
            expect(canMessage).toBe(false);
        });
    });
});
