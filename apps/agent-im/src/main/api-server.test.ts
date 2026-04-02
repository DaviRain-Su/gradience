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
import type { SubmissionApi, TaskApi } from '../renderer/lib/indexer-api.ts';

const MOCK_TASKS: TaskApi[] = [
    {
        task_id: 11,
        poster: 'my-pubkey',
        judge: 'judge-a',
        reward: 1000,
        state: 'open',
        category: 0,
        deadline: '100',
        submission_count: 1,
        winner: null,
        created_at: '90',
    },
    {
        task_id: 12,
        poster: 'alice',
        judge: 'judge-b',
        reward: 2000,
        state: 'completed',
        category: 1,
        deadline: '120',
        submission_count: 2,
        winner: 'my-pubkey',
        created_at: '110',
    },
    {
        task_id: 13,
        poster: 'bob',
        judge: 'judge-c',
        reward: 1500,
        state: 'open',
        category: 3,
        deadline: '130',
        submission_count: 1,
        winner: null,
        created_at: '115',
    },
];

const MOCK_SUBMISSIONS: Record<number, SubmissionApi[]> = {
    11: [
        {
            task_id: 11,
            agent: 'my-pubkey',
            result_ref: 'result-11-old',
            trace_ref: 'trace-11-old',
            runtime_provider: null,
            runtime_model: null,
            runtime_runtime: null,
            runtime_version: null,
            submission_slot: 900,
            submitted_at: '900',
        },
        {
            task_id: 11,
            agent: 'my-pubkey',
            result_ref: 'result-11',
            trace_ref: 'trace-11',
            runtime_provider: null,
            runtime_model: null,
            runtime_runtime: null,
            runtime_version: null,
            submission_slot: 1001,
            submitted_at: '1001',
        },
    ],
    12: [
        {
            task_id: 12,
            agent: 'my-pubkey',
            result_ref: 'result-12',
            trace_ref: 'trace-12',
            runtime_provider: null,
            runtime_model: null,
            runtime_runtime: null,
            runtime_version: null,
            submission_slot: 1002,
            submitted_at: '1002',
        },
    ],
    13: [
        {
            task_id: 13,
            agent: 'another-agent',
            result_ref: 'result-13',
            trace_ref: 'trace-13',
            runtime_provider: null,
            runtime_model: null,
            runtime_runtime: null,
            runtime_version: null,
            submission_slot: 1003,
            submitted_at: '1003',
        },
    ],
};

let port: number;
let api: ReturnType<typeof createApiServer>;
let store: ReturnType<typeof createAppStore>;

before(async () => {
    store = createAppStore();
    const hub = new InMemoryMagicBlockHub({ latencyMs: 5 });
    const transport = new InMemoryMagicBlockTransport(hub);
    const agent = new MagicBlockA2AAgent('test-agent', transport);
    agent.start();

    const indexer = {
        getReputation: async (address: string) => {
            if (address === 'unknown') return null;
            return {
                global_avg_score: 91,
                global_completed: 7,
                global_total_applied: 9,
                win_rate: 0.77,
                by_category: {},
            };
        },
        getTasks: async (params?: {
            status?: string;
            poster?: string;
            category?: number;
            limit?: number;
            offset?: number;
        }) => {
            const filtered = MOCK_TASKS.filter((task) => {
                if (params?.poster && task.poster !== params.poster) return false;
                if (params?.status && task.state !== params.status) return false;
                return true;
            });
            const offset = params?.offset ?? 0;
            const limit = params?.limit ?? filtered.length;
            return filtered.slice(offset, offset + limit);
        },
        getTaskById: async (taskId: number) => MOCK_TASKS.find((task) => task.task_id === taskId) ?? null,
        getTaskSubmissions: async (taskId: number) => MOCK_SUBMISSIONS[taskId] ?? [],
    };

    api = createApiServer({ store, a2aAgent: agent, indexer }, { port: 0 });
    port = await api.start();
});

after(async () => {
    await api.stop();
});

function url(path: string) {
    return `http://127.0.0.1:${port}${path}`;
}

describe('API Server', () => {
    it('POST /auth/demo-login sets session', async () => {
        const res = await fetch(url('/auth/demo-login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                publicKey: 'demo-pubkey',
                email: 'demo@agent.im',
                privyUserId: 'privy-demo-user',
            }),
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.ok, true);
        assert.equal(data.auth.authenticated, true);
        assert.equal(data.auth.publicKey, 'demo-pubkey');
    });

    it('GET /auth/session returns current auth state', async () => {
        const res = await fetch(url('/auth/session'));
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.auth.authenticated, true);
        assert.equal(data.auth.publicKey, 'demo-pubkey');
    });

    it('POST /auth/demo-login rejects binding conflict on same privy user', async () => {
        const res = await fetch(url('/auth/demo-login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                publicKey: 'another-wallet',
                email: 'demo@agent.im',
                privyUserId: 'privy-demo-user',
            }),
        });
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.ok(String(data.error).includes('already bound'));
    });

    it('POST /auth/demo-login rejects binding conflict on same wallet', async () => {
        const res = await fetch(url('/auth/demo-login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                publicKey: 'demo-pubkey',
                email: 'demo@agent.im',
                privyUserId: 'privy-different-user',
            }),
        });
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.ok(String(data.error).includes('already bound'));
    });

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
        store.getState().setAuth({
            authenticated: false,
            publicKey: null,
            email: null,
            privyUserId: null,
        });
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
        assert.equal(data.reputation.global_avg_score, 91);
    });

    it('GET /me — returns bound session profile', async () => {
        store.getState().setIdentityRegistrationStatus({
            agent: 'my-pubkey',
            state: 'registered',
            agentId: '11',
            txHash: '0x11',
            error: null,
            updatedAt: Date.now(),
        });
        const res = await fetch(url('/me'));
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.agentId, 'my-pubkey');
        assert.equal(data.auth.privyUserId, 'p1');
        assert.equal(data.reputation.global_completed, 7);
        assert.equal(data.identityRegistration.state, 'registered');
        assert.equal(data.identityRegistration.agentId, '11');
    });

    it('GET /me — returns 401 for unbound session', async () => {
        store.getState().setAuth({
            authenticated: true,
            publicKey: 'my-pubkey',
            email: 'test@gmail.com',
            privyUserId: null,
        });
        const res = await fetch(url('/me'));
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.equal(data.error, 'Session is not bound to both wallet and privy user');

        store.getState().setAuth({
            authenticated: true,
            publicKey: 'my-pubkey',
            email: 'test@gmail.com',
            privyUserId: 'p1',
        });
    });

    it('GET /me/tasks — returns poster + participant tasks', async () => {
        const res = await fetch(url('/me/tasks?role=all&limit=10&offset=0'));
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.total, 2);
        assert.equal(data.items[0].task.task_id, 12);
        assert.equal(data.items[0].role, 'participant');
        assert.equal(data.items[1].task.task_id, 11);
        assert.equal(data.items[1].role, 'both');
        assert.equal(data.items[1].latestSubmission.submission_slot, 1001);
    });

    it('GET /me/tasks — rejects invalid pagination', async () => {
        const res = await fetch(url('/me/tasks?limit=0'));
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Invalid limit: expected 1..100');
    });

    it('GET /me/tasks — rejects invalid status', async () => {
        const res = await fetch(url('/me/tasks?status=invalid'));
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Invalid status: expected open|completed|refunded');
    });

    it('GET /me/tasks — supports ascending sort', async () => {
        const res = await fetch(url('/me/tasks?sort=task_id_asc&limit=10&offset=0'));
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.items[0].task.task_id, 11);
        assert.equal(data.items[1].task.task_id, 12);
    });

    it('GET /me/submissions — returns paginated submissions', async () => {
        const res = await fetch(url('/me/submissions?limit=1&offset=0'));
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.total, 3);
        assert.equal(data.items.length, 1);
        assert.equal(data.items[0].task_id, 12);
        assert.equal(data.hasMore, true);
    });

    it('GET /me/submissions — rejects invalid sort', async () => {
        const res = await fetch(url('/me/submissions?sort=bad_order'));
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(
            data.error,
            'Invalid sort: expected submission_slot_desc|submission_slot_asc',
        );
    });

    it('POST /me/tasks/:id/apply + /submit share task flow with GUI store', async () => {
        await fetch(url('/me/tasks?role=all&limit=10&offset=0'));

        const applyRes = await fetch(url('/me/tasks/11/apply'), { method: 'POST' });
        assert.equal(applyRes.status, 200);
        const applyBody = await applyRes.json();
        assert.equal(applyBody.status, 'applied');

        const submitRes = await fetch(url('/me/tasks/11/submit'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resultRef: 'ipfs://result-11', traceRef: 'ipfs://trace-11' }),
        });
        assert.equal(submitRes.status, 200);

        const flowRes = await fetch(url('/me/task-flow'));
        assert.equal(flowRes.status, 200);
        const flowBody = await flowRes.json();
        const flow = flowBody.items.find((item: { taskId: number }) => item.taskId === 11);
        assert.ok(flow);
        assert.equal(flow.status, 'submitted');

        const localFlow = store.getState().taskFlow.get(11);
        assert.equal(localFlow?.status, 'submitted');
        assert.equal(localFlow?.resultRef, 'ipfs://result-11');
    });

    it('POST /me/tasks/:id/submit validates resultRef', async () => {
        const res = await fetch(url('/me/tasks/11/submit'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ traceRef: 'ipfs://trace-only' }),
        });
        assert.equal(res.status, 400);
    });

    it('GET /status — returns version and uptime', async () => {
        const res = await fetch(url('/status'));
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.version, '0.1.0');
        assert.ok(data.uptime > 0);
        assert.equal(data.authenticated, true); // from previous test
        assert.ok(data.authBindings.totalPrivyBindings >= 1);
    });

    it('GET /me rejects mismatched privy-wallet binding and exposes counters in /status', async () => {
        store.getState().setAuth({
            authenticated: true,
            publicKey: 'demo-pubkey',
            email: 'demo@agent.im',
            privyUserId: 'privy-forged-user',
        });

        const meRes = await fetch(url('/me'));
        assert.equal(meRes.status, 401);
        const meBody = await meRes.json();
        assert.ok(String(meBody.error).includes('already bound'));

        const statusRes = await fetch(url('/status'));
        assert.equal(statusRes.status, 200);
        const status = await statusRes.json();
        assert.ok(status.authBindings.rejectedSessionTotal >= 1);
        assert.ok(status.authBindings.lastError);

        store.getState().setAuth({
            authenticated: true,
            publicKey: 'demo-pubkey',
            email: 'demo@agent.im',
            privyUserId: 'privy-demo-user',
        });
    });

    it('GET /identity/registration returns unknown snapshot when absent', async () => {
        const res = await fetch(url('/identity/registration?agent=agent-unknown'));
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.status.state, 'unknown');
        assert.equal(data.status.agentId, null);
    });

    it('POST /auth/logout clears auth state', async () => {
        const res = await fetch(url('/auth/logout'), { method: 'POST' });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.ok, true);
        assert.equal(data.auth.authenticated, false);

        const reputationRes = await fetch(url('/me/reputation'));
        assert.equal(reputationRes.status, 401);
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
        assert.equal(data.snapshot.evmReputationCount, 0);
    });

    it('GET /interop/status returns stored snapshot', async () => {
        const res = await fetch(url('/interop/status?agent=agent-x'));
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.status.agent, 'agent-x');
        assert.equal(data.status.identityRegistered, true);
        assert.equal(data.status.evmReputationCount, 0);
        assert.equal(data.status.istranaFeedbackCount, 1);
    });

    it('GET /interop/dashboard renders html summary', async () => {
        const res = await fetch(url('/interop/dashboard?agent=agent-x'));
        assert.equal(res.status, 200);
        const html = await res.text();
        assert.ok(html.includes('Agent.im Interop Dashboard'));
        assert.ok(html.includes('agent-x'));
        assert.ok(html.includes('EVM Reputation Relay Count'));
    });
});

describe('API Server production guard', () => {
    it('POST /auth/demo-login returns 403 when NODE_ENV=production', async () => {
        const origEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        try {
            const res = await fetch(url('/auth/demo-login'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ publicKey: 'hacker' }),
            });
            assert.equal(res.status, 403);
            const data = await res.json();
            assert.equal(data.error, 'Demo login is disabled in production');
        } finally {
            process.env.NODE_ENV = origEnv;
        }
    });

    it('POST /auth/demo-login returns 403 when AGENT_IM_DISABLE_DEMO_LOGIN=1', async () => {
        const origFlag = process.env.AGENT_IM_DISABLE_DEMO_LOGIN;
        process.env.AGENT_IM_DISABLE_DEMO_LOGIN = '1';
        try {
            const res = await fetch(url('/auth/demo-login'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ publicKey: 'blocked' }),
            });
            assert.equal(res.status, 403);
        } finally {
            if (origFlag === undefined) {
                delete process.env.AGENT_IM_DISABLE_DEMO_LOGIN;
            } else {
                process.env.AGENT_IM_DISABLE_DEMO_LOGIN = origFlag;
            }
        }
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
