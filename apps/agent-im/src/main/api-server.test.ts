import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
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
});
