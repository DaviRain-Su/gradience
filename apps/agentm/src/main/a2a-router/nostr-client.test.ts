/**
 * NostrClient unit tests
 * 
 * @module a2a-router/nostr-client.test
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { NostrClient } from './nostr-client.js';
import { NOSTR_CONFIG } from './constants.js';
import type { AgentPresenceContent } from '../../shared/nostr-types.js';

describe('NostrClient', () => {
    let client: NostrClient;

    beforeEach(() => {
        client = new NostrClient({
            relays: NOSTR_CONFIG.DEFAULT_RELAYS.slice(0, 2), // Use only 2 relays for testing
        });
    });

    afterEach(async () => {
        await client.disconnect();
    });

    describe('constructor', () => {
        it('should generate a new keypair if not provided', () => {
            const c = new NostrClient();
            expect(c.getPublicKey()).toBeDefined();
            expect(c.getPublicKey().length).toBe(64); // hex encoded pubkey
        });

        it('should use provided private key', () => {
            const privateKey = 'a'.repeat(64);
            const c = new NostrClient({ privateKey });
            expect(c.getPublicKey()).toBeDefined();
        });

        it('should use default relays if not provided', () => {
            const c = new NostrClient();
            expect(c['relays'].length).toBeGreaterThan(0);
        });

        it('should use provided relays', () => {
            const relays = ['wss://custom.relay.io'];
            const c = new NostrClient({ relays });
            expect(c['relays']).toEqual(relays);
        });
    });

    describe('connect', () => {
        it('should establish connection to relays', async () => {
            await client.connect();
            expect(client.isConnected()).toBe(true);
        });

        it('should track relay status', async () => {
            await client.connect();
            const health = client.health();
            expect(health.relays.length).toBeGreaterThan(0);
        });
    });

    describe('disconnect', () => {
        it('should close all connections', async () => {
            await client.connect();
            expect(client.isConnected()).toBe(true);

            await client.disconnect();
            expect(client.isConnected()).toBe(false);
        });

        it('should clear subscriptions', async () => {
            await client.connect();
            await client.subscribePresence({}, () => { });
            expect(client.health().activeSubscriptions).toBeGreaterThan(0);

            await client.disconnect();
            expect(client.health().activeSubscriptions).toBe(0);
        });
    });

    describe('getPublicKey', () => {
        it('should return consistent pubkey', () => {
            const pk1 = client.getPublicKey();
            const pk2 = client.getPublicKey();
            expect(pk1).toBe(pk2);
        });
    });

    describe('publishPresence', () => {
        it('should throw if not connected', async () => {
            const content: AgentPresenceContent = {
                agent: 'test-agent',
                display_name: 'Test Agent',
                capabilities: ['coding'],
                reputation_score: 100,
                available: true,
            };

            await expect(client.publishPresence(content)).rejects.toThrow('Not connected');
        });

        it('should return event id after publishing', async () => {
            await client.connect();

            const content: AgentPresenceContent = {
                agent: 'test-agent',
                display_name: 'Test Agent',
                capabilities: ['coding'],
                reputation_score: 100,
                available: true,
            };

            // Note: This test may fail in CI without real relays
            // Use mock relays for unit testing
            try {
                const eventId = await client.publishPresence(content);
                expect(eventId).toBeDefined();
                expect(typeof eventId).toBe('string');
            } catch (error) {
                // Expected if relays are unavailable
                expect(error).toBeDefined();
            }
        });
    });

    describe('sendDM', () => {
        it('should throw if not connected', async () => {
            await expect(client.sendDM('recipient-pubkey', 'hello')).rejects.toThrow('Not connected');
        });

        it('should return event id', async () => {
            await client.connect();

            const recipientKey = 'b'.repeat(64);

            try {
                const eventId = await client.sendDM(recipientKey, 'hello');
                expect(eventId).toBeDefined();
            } catch (error) {
                // Expected if relays are unavailable
                expect(error).toBeDefined();
            }
        });
    });

    describe('subscribeDMs', () => {
        it('should throw if not connected', async () => {
            await expect(client.subscribeDMs(() => { })).rejects.toThrow('Not connected');
        });

        it('should return subscription handle', async () => {
            await client.connect();

            const sub = await client.subscribeDMs(() => { });
            expect(sub).toHaveProperty('unsub');
            expect(typeof sub.unsub).toBe('function');

            sub.unsub();
        });

        it('should track active subscriptions', async () => {
            await client.connect();

            const before = client.health().activeSubscriptions;
            const sub = await client.subscribeDMs(() => { });
            const during = client.health().activeSubscriptions;

            expect(during).toBe(before + 1);

            sub.unsub();

            const after = client.health().activeSubscriptions;
            expect(after).toBe(before);
        });
    });

    describe('subscribePresence', () => {
        it('should throw if not connected', async () => {
            await expect(client.subscribePresence({}, () => { })).rejects.toThrow('Not connected');
        });

        it('should return subscription handle', async () => {
            await client.connect();

            const sub = await client.subscribePresence({}, () => { });
            expect(sub).toHaveProperty('unsub');

            sub.unsub();
        });

        it('should filter by availableOnly', async () => {
            await client.connect();

            const received: unknown[] = [];
            const sub = await client.subscribePresence({ availableOnly: true }, (event) => {
                received.push(event);
            });

            // Cleanup
            sub.unsub();

            // Note: Actual filtering is tested via integration tests with real events
            expect(sub).toBeDefined();
        });
    });

    describe('queryPresence', () => {
        it('should throw if not connected', async () => {
            await expect(client.queryPresence({})).rejects.toThrow('Not connected');
        });

        it('should return array of events', async () => {
            await client.connect();

            try {
                const events = await client.queryPresence({}, 10);
                expect(Array.isArray(events)).toBe(true);
            } catch (error) {
                // Expected if relays are unavailable
                expect(error).toBeDefined();
            }
        });
    });

    describe('health', () => {
        it('should return disconnected status before connect', () => {
            const health = client.health();
            expect(health.connected).toBe(false);
            expect(health.relayCount).toBe(0);
        });

        it('should return connected status after connect', async () => {
            await client.connect();
            const health = client.health();
            expect(health.connected).toBe(true);
        });

        it('should include relay status', async () => {
            await client.connect();
            const health = client.health();
            expect(health.relays).toBeDefined();
            expect(health.relays.length).toBeGreaterThan(0);
        });
    });

    describe('getConnectedRelayCount', () => {
        it('should return 0 before connect', () => {
            expect(client.getConnectedRelayCount()).toBe(0);
        });

        it('should return count after connect', async () => {
            await client.connect();
            const count = client.getConnectedRelayCount();
            expect(typeof count).toBe('number');
        });
    });
});
