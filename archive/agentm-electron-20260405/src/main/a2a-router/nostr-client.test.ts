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
            relays: NOSTR_CONFIG.DEFAULT_RELAYS.slice(0, 2),
        });
    });

    afterEach(async () => {
        await client.disconnect();
    });

    describe('constructor', () => {
        it('should generate a new keypair if not provided', () => {
            const c = new NostrClient();
            assert.ok(c.getPublicKey());
            assert.strictEqual(c.getPublicKey().length, 64);
        });

        it('should use provided private key', () => {
            const privateKey = 'a'.repeat(64);
            const c = new NostrClient({ privateKey });
            assert.ok(c.getPublicKey());
        });

        it('should use default relays if not provided', () => {
            const c = new NostrClient();
            assert.ok(c['relays'].length > 0);
        });

        it('should use provided relays', () => {
            const relays = ['wss://custom.relay.io'];
            const c = new NostrClient({ relays });
            assert.deepStrictEqual(c['relays'], relays);
        });
    });

    describe('connect', () => {
        it('should establish connection to relays', async () => {
            await client.connect();
            assert.strictEqual(client.isConnected(), true);
        });

        it('should track relay status', async () => {
            await client.connect();
            const health = client.health();
            assert.ok(health.relays.length > 0);
        });
    });

    describe('disconnect', () => {
        it('should close all connections', async () => {
            await client.connect();
            assert.strictEqual(client.isConnected(), true);

            await client.disconnect();
            assert.strictEqual(client.isConnected(), false);
        });
    });

    describe('getPublicKey', () => {
        it('should return consistent pubkey', () => {
            const pk1 = client.getPublicKey();
            const pk2 = client.getPublicKey();
            assert.strictEqual(pk1, pk2);
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

            await assert.rejects(client.publishPresence(content), /Not connected/);
        });
    });

    // sendDM tests removed — DM functionality migrated to XMTP

    describe('health', () => {
        it('should return disconnected status before connect', () => {
            const health = client.health();
            assert.strictEqual(health.connected, false);
            assert.strictEqual(health.relayCount, 0);
        });

        it('should return connected status after connect', async () => {
            await client.connect();
            const health = client.health();
            assert.strictEqual(health.connected, true);
        });
    });
});
