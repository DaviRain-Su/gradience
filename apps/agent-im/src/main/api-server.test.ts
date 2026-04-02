import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createApiServer } from './api-server.ts';
import { createAppStore } from '../renderer/lib/store.ts';
import {
    InMemoryMagicBlockHub,
    InMemoryMagicBlockTransport,
    MagicBlockA2AAgent,
} from '../renderer/lib/a2a-client.ts';

let port: number;
let api: ReturnType<typeof createApiServer>;
let store: ReturnType<typeof createAppStore>;

before(async () => {
    store = createAppStore();
    const hub = new InMemoryMagicBlockHub({ latencyMs: 5 });
    const transport = new InMemoryMagicBlockTransport(hub);
    const agent = new MagicBlockA2AAgent('test-agent', transport);
    agent.start();

    api = createApiServer({ store, a2aAgent: agent }, { port: 0 });
    port = await api.start();
});

after(async () => {
    await api.stop();
});

function url(path: string) {
    return `http://127.0.0.1:${port}${path}`;
}

describe('API Server', () => {
    it('POST /a2a/send — valid request', async () => {
        const res = await fetch(url('/a2a/send'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: 'bob', topic: 'test', message: 'hello' }),
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.ok, true);
        assert.equal(data.envelope.from, 'test-agent');
        assert.equal(data.envelope.to, 'bob');
        assert.ok(data.envelope.paymentMicrolamports > 0);
    });

    it('POST /a2a/send — missing to field → 400', async () => {
        const res = await fetch(url('/a2a/send'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: 'test', message: 'hello' }),
        });
        assert.equal(res.status, 400);
    });

    it('GET /a2a/messages?peer=bob — returns messages', async () => {
        const res = await fetch(url('/a2a/messages?peer=bob'));
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.ok(Array.isArray(data.messages));
        // Should have at least the message from the previous test
        assert.ok(data.messages.length >= 1);
    });

    it('GET /discover/agents — returns ranked list', async () => {
        store.getState().setDiscoveryRows([
            { agent: 'alice', weight: 100, reputation: { global_avg_score: 90, global_completed: 10, global_total_applied: 12, win_rate: 0.83 } },
            { agent: 'bob', weight: 50, reputation: null },
        ]);

        const res = await fetch(url('/discover/agents'));
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.agents[0].agent, 'alice');
        assert.equal(data.agents[1].agent, 'bob');
    });

    it('GET /me/reputation — not authenticated → 401', async () => {
        const res = await fetch(url('/me/reputation'));
        assert.equal(res.status, 401);
    });

    it('GET /me/reputation — authenticated → 200', async () => {
        store.getState().setAuth({
            authenticated: true,
            publicKey: 'my-pubkey',
            email: 'test@gmail.com',
            privyUserId: 'p1',
        });

        const res = await fetch(url('/me/reputation'));
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.publicKey, 'my-pubkey');
    });

    it('GET /status — returns version and uptime', async () => {
        const res = await fetch(url('/status'));
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.version, '0.1.0');
        assert.ok(data.uptime > 0);
        assert.equal(data.authenticated, true); // from previous test
    });

    it('POST /interop/events stores interoperability status', async () => {
        const payload = {
            type: 'interop_sync',
            winner: 'agent-x',
            taskId: 21,
            score: 93,
            category: 2,
            chainTx: 'sig-x',
            judgedAt: Date.now(),
            identityRegistered: true,
            feedbackTargets: ['erc8004_feedback', 'istrana_feedback'],
            erc8004FeedbackPublished: true,
            istranaFeedbackPublished: true,
            attestationPublished: true,
        };
        const res = await fetch(url('/interop/events'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.ok, true);
        assert.equal(data.snapshot.agent, 'agent-x');
        assert.equal(data.snapshot.erc8004FeedbackCount, 1);
    });

    it('GET /interop/status returns stored snapshot', async () => {
        const res = await fetch(url('/interop/status?agent=agent-x'));
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.status.agent, 'agent-x');
        assert.equal(data.status.identityRegistered, true);
        assert.equal(data.status.istranaFeedbackCount, 1);
    });

    it('GET /interop/dashboard renders html summary', async () => {
        const res = await fetch(url('/interop/dashboard?agent=agent-x'));
        assert.equal(res.status, 200);
        const html = await res.text();
        assert.ok(html.includes('Agent.im Interop Dashboard'));
        assert.ok(html.includes('agent-x'));
    });
});

describe('API Server interop signature verification', () => {
    it('rejects interop event with invalid signature', async () => {
        const signedStore = createAppStore();
        const hub = new InMemoryMagicBlockHub({ latencyMs: 5 });
        const transport = new InMemoryMagicBlockTransport(hub);
        const agent = new MagicBlockA2AAgent('sig-agent', transport);
        agent.start();
        const signedApi = createApiServer(
            { store: signedStore, a2aAgent: agent },
            { port: 0, interopSigningSecret: 'secret-interop' },
        );
        const signedPort = await signedApi.start();

        try {
            const payload = JSON.stringify({
                type: 'interop_sync',
                winner: 'agent-sig',
                taskId: 1,
                score: 80,
                category: 1,
                chainTx: 'sig',
                judgedAt: Date.now(),
                identityRegistered: true,
                feedbackTargets: [],
                erc8004FeedbackPublished: false,
                istranaFeedbackPublished: false,
                attestationPublished: false,
            });

            const badRes = await fetch(`http://127.0.0.1:${signedPort}/interop/events`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-gradience-signature-ts': '123',
                    'x-gradience-signature': 'bad',
                },
                body: payload,
            });
            assert.equal(badRes.status, 401);

            const ts = String(Math.floor(Date.now() / 1000));
            const signature = createHmac('sha256', 'secret-interop')
                .update(`${ts}.${payload}`)
                .digest('hex');
            const okRes = await fetch(`http://127.0.0.1:${signedPort}/interop/events`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-gradience-signature-ts': ts,
                    'x-gradience-signature': signature,
                },
                body: payload,
            });
            assert.equal(okRes.status, 200);
        } finally {
            await signedApi.stop();
        }
    });
});
