import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    buildIdentityRegistrationPayload,
    registerIdentity,
} from './identity-registration.ts';

test('buildIdentityRegistrationPayload uses metaplex registry shape', () => {
    const payload = buildIdentityRegistrationPayload({
        agent: 'agent-1',
        email: 'agent@example.com',
        now: () => 1_700_000_000_000,
    });
    assert.equal(payload.agentPubkey, 'agent-1');
    assert.equal(payload.registrations[0]?.agentRegistry, 'solana:101:metaplex');
    assert.equal(payload.services[0]?.name, 'a2a');
    assert.equal(payload.timestamp, 1_700_000_000);
});

test('registerIdentity returns disabled when endpoint is not configured', async () => {
    const result = await registerIdentity({
        agent: 'agent-2',
        endpoint: null,
        now: () => 123,
    });
    assert.equal(result.state, 'disabled');
    assert.equal(result.updatedAt, 123);
});

test('registerIdentity returns registered on successful relay response', async () => {
    const result = await registerIdentity({
        agent: 'agent-3',
        endpoint: 'https://relay.example.com/register',
        now: () => 999,
        fetchImpl: async () =>
            new Response(
                JSON.stringify({
                    ok: true,
                    agentId: '42',
                    txHash: '0xabc',
                    reused: false,
                }),
                { status: 200 },
            ),
    });
    assert.equal(result.state, 'registered');
    assert.equal(result.agentId, '42');
    assert.equal(result.txHash, '0xabc');
});

test('registerIdentity returns failed on non-2xx response', async () => {
    const result = await registerIdentity({
        agent: 'agent-4',
        endpoint: 'https://relay.example.com/register',
        fetchImpl: async () => new Response('boom', { status: 500 }),
    });
    assert.equal(result.state, 'failed');
    assert.ok(result.error?.includes('identity relay 500'));
});
