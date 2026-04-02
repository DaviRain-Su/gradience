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

    const profilePublisher = {
        publish: async (input: {
            agent: string;
            mode: 'manual' | 'git-sync';
            contentRef: string;
            profile: unknown;
        }) => ({
            onchainRef: input.contentRef,
            tx: 'sim-profile-tx',
        }),
    };

    api = createApiServer({ store, a2aAgent: agent, indexer, profilePublisher }, { port: 0 });
    port = await api.start();
});

after(async () => {
    await api.stop();
});

function url(path: string) {
    return `http://127.0.0.1:${port}${path}`;
}

async function openWebSocket(wsUrl: string) {
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
        ws.addEventListener('open', () => resolve(), { once: true });
        ws.addEventListener('error', () => reject(new Error(`Failed to connect websocket: ${wsUrl}`)), {
            once: true,
        });
    });
    return ws;
}

async function waitForWebSocketMessage(
    ws: WebSocket,
    timeoutMs = 1000,
): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('Timed out waiting for websocket message'));
        }, timeoutMs);

        ws.addEventListener(
            'message',
            async (event) => {
                clearTimeout(timer);
                try {
                    const raw =
                        typeof event.data === 'string'
                            ? event.data
                            : 'text' in (event.data as object)
                                ? await (event.data as { text: () => Promise<string> }).text()
                                : String(event.data);
                    resolve(JSON.parse(raw) as Record<string, unknown>);
                } catch (error) {
                    reject(error);
                }
            },
            { once: true },
        );
        ws.addEventListener(
            'error',
            () => {
                clearTimeout(timer);
                reject(new Error('Websocket message wait failed'));
            },
            { once: true },
        );
    });
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

    it('GET /api/agents/:agent/profile returns null when profile is missing', async () => {
        const res = await fetch(url('/api/agents/my-pubkey/profile'));
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.profile, null);
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

    it('PUT /api/agents/:agent/profile stores profile for bound session wallet', async () => {
        const res = await fetch(url('/api/agents/my-pubkey/profile'), {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                display_name: 'My Agent',
                bio: 'Building autonomous workflows',
                links: {
                    website: 'https://agent.im',
                    github: 'https://github.com/agent-im',
                },
                publish_mode: 'manual',
            }),
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.profile.display_name, 'My Agent');
        assert.equal(data.profile.bio, 'Building autonomous workflows');

        const getRes = await fetch(url('/api/agents/my-pubkey/profile'));
        assert.equal(getRes.status, 200);
        const getData = await getRes.json();
        assert.equal(getData.profile.display_name, 'My Agent');
        assert.equal(getData.profile.links.website, 'https://agent.im');
        assert.equal(getData.profile.onchain_ref, null);
    });

    it('PUT /api/agents/:agent/profile rejects cross-wallet profile updates', async () => {
        const res = await fetch(url('/api/agents/not-my-wallet/profile'), {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                display_name: 'Invalid',
                bio: 'Should fail',
            }),
        });
        assert.equal(res.status, 403);
    });

    it('POST /api/agents/:agent/profile/publish updates onchain_ref', async () => {
        const res = await fetch(url('/api/agents/my-pubkey/profile/publish'), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                publish_mode: 'manual',
            }),
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.ok, true);
        assert.equal(data.onchain_tx, 'sim-profile-tx');
        assert.ok(String(data.profile.onchain_ref).startsWith('sha256:'));
    });

    it('POST /api/agents/:agent/profile/publish supports git-sync mode + explicit content_ref', async () => {
        const res = await fetch(url('/api/agents/my-pubkey/profile/publish'), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                publish_mode: 'git-sync',
                content_ref: 'sha256:git-sync-ref',
            }),
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.ok, true);
        assert.equal(data.profile.publish_mode, 'git-sync');
        assert.equal(data.profile.onchain_ref, 'sha256:git-sync-ref');
    });

    it('POST /webhooks/profile/git-sync stores profile and updates onchain_ref automatically', async () => {
        const res = await fetch(url('/webhooks/profile/git-sync'), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                source: 'github',
                repository: 'github.com/gradience/agent-profile',
                commit_sha: 'abc123',
                content_ref: 'sha256:profile-from-git',
                agent: 'sync-agent',
                profile: {
                    display_name: 'Sync Agent',
                    bio: 'Profile updated by git webhook',
                    links: {
                        github: 'https://github.com/sync-agent',
                    },
                },
            }),
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.ok, true);
        assert.equal(data.source, 'github');
        assert.equal(data.profile.agent, 'sync-agent');
        assert.equal(data.profile.publish_mode, 'git-sync');
        assert.equal(data.profile.onchain_ref, 'sha256:profile-from-git');

        const profileRes = await fetch(url('/api/agents/sync-agent/profile'));
        assert.equal(profileRes.status, 200);
        const profileData = await profileRes.json();
        assert.equal(profileData.profile.display_name, 'Sync Agent');
        assert.equal(profileData.profile.links.github, 'https://github.com/sync-agent');
    });

    it('POST /webhooks/profile/git-sync validates required payload fields', async () => {
        const res = await fetch(url('/webhooks/profile/git-sync'), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                source: 'github',
                profile: {
                    display_name: 'Missing Agent',
                    bio: 'Should fail',
                },
            }),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Missing required field: agent');
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
        assert.equal(typeof data.webEntry.pairCodeIssuedTotal, 'number');
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

describe('API Server web-entry (W1-W6)', () => {
    it('POST /web/session/pair requires auth', async () => {
        store.getState().setAuth({
            authenticated: false,
            publicKey: null,
            email: null,
            privyUserId: null,
        });
        const res = await fetch(url('/web/session/pair'), { method: 'POST' });
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.equal(data.code, 'WB-1001');
    });

    it('POST /web/session/pair + /local/bridge/attach consumes pair code once', async () => {
        store.getState().setAuth({
            authenticated: true,
            publicKey: 'my-pubkey',
            email: 'test@gmail.com',
            privyUserId: 'p1',
        });

        const pairRes = await fetch(url('/web/session/pair'), { method: 'POST' });
        assert.equal(pairRes.status, 200);
        const pairBody = await pairRes.json();
        assert.equal(typeof pairBody.pairCode, 'string');
        assert.equal(pairBody.pairCode.length, 8);
        assert.ok(pairBody.expiresAt > Date.now());

        const attachRes = await fetch(url('/local/bridge/attach'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pairCode: pairBody.pairCode,
                machineName: 'test-machine',
                bridgeVersion: '0.1.0',
            }),
        });
        assert.equal(attachRes.status, 200);
        const attachBody = await attachRes.json();
        assert.equal(typeof attachBody.bridgeId, 'string');
        assert.equal(typeof attachBody.bridgeToken, 'string');
        assert.equal(attachBody.userId, 'p1');
        assert.equal(attachBody.sessionId, 'p1');

        const attachAgainRes = await fetch(url('/local/bridge/attach'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pairCode: pairBody.pairCode,
                machineName: 'test-machine',
            }),
        });
        assert.equal(attachAgainRes.status, 409);
        const attachAgainBody = await attachAgainRes.json();
        assert.equal(attachAgainBody.code, 'WB-1004');
    });

    it('GET /web/agents returns 404 when bridge is not connected', async () => {
        store.getState().setAuth({
            authenticated: true,
            publicKey: 'web-pubkey-404',
            email: 'test@gmail.com',
            privyUserId: 'web-user-404',
        });
        const res = await fetch(url('/web/agents'));
        assert.equal(res.status, 404);
        const body = await res.json();
        assert.equal(body.code, 'WB-1005');
    });

    it('bridge realtime websocket heartbeat + presence updates /web/agents', async () => {
        store.getState().setAuth({
            authenticated: true,
            publicKey: 'web-pubkey-ws',
            email: 'test@gmail.com',
            privyUserId: 'web-user-ws',
        });

        const pairRes = await fetch(url('/web/session/pair'), { method: 'POST' });
        const pairBody = await pairRes.json();
        const attachRes = await fetch(url('/local/bridge/attach'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pairCode: pairBody.pairCode,
                machineName: 'test-machine-2',
            }),
        });
        const attachBody = await attachRes.json();
        const ws = await openWebSocket(
            `ws://127.0.0.1:${port}/bridge/realtime?token=${attachBody.bridgeToken}`,
        );

        ws.send(JSON.stringify({ type: 'bridge.heartbeat' }));
        ws.send(
            JSON.stringify({
                type: 'bridge.agent.presence',
                agents: [
                    {
                        agentId: 'local-agent-1',
                        displayName: 'Local Agent 1',
                        status: 'idle',
                        capabilities: ['text', 'voice'],
                    },
                    {
                        agentId: 'local-agent-2',
                        displayName: 'Local Agent 2',
                        status: 'busy',
                        capabilities: ['text'],
                    },
                ],
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 40));

        const agentsRes = await fetch(url('/web/agents'));
        assert.equal(agentsRes.status, 200);
        const agentsBody = await agentsRes.json();
        assert.equal(agentsBody.items.length, 2);
        assert.equal(agentsBody.items[0].bridgeId, attachBody.bridgeId);
        assert.ok(
            agentsBody.items.some(
                (item: { agentId: string; capabilities: string[] }) =>
                    item.agentId === 'local-agent-1' && item.capabilities.includes('voice'),
            ),
        );

        ws.close();
        await new Promise((resolve) => setTimeout(resolve, 40));

        const afterCloseRes = await fetch(url('/web/agents'));
        assert.equal(afterCloseRes.status, 404);
    });

    it('web chat websocket relays messages through bridge realtime channel', async () => {
        store.getState().setAuth({
            authenticated: true,
            publicKey: 'web-chat-pubkey',
            email: 'chat@test.im',
            privyUserId: 'web-chat-user',
        });

        const pairRes = await fetch(url('/web/session/pair'), { method: 'POST' });
        const pairBody = await pairRes.json();
        const attachRes = await fetch(url('/local/bridge/attach'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pairCode: pairBody.pairCode,
                machineName: 'chat-machine',
            }),
        });
        const attachBody = await attachRes.json();

        const bridgeWs = await openWebSocket(
            `ws://127.0.0.1:${port}/bridge/realtime?token=${attachBody.bridgeToken}`,
        );
        bridgeWs.send(
            JSON.stringify({
                type: 'bridge.agent.presence',
                agents: [
                    {
                        agentId: 'local-chat-agent',
                        displayName: 'Local Chat Agent',
                        status: 'idle',
                        capabilities: ['text'],
                    },
                ],
            }),
        );
        await new Promise((resolve) => setTimeout(resolve, 30));

        const webWs = await openWebSocket(
            `ws://127.0.0.1:${port}/web/chat/local-chat-agent`,
        );
        webWs.send(JSON.stringify({ type: 'chat.message.send', text: 'hello bridge' }));

        const ackEvent = await waitForWebSocketMessage(webWs);
        assert.equal(ackEvent.type, 'chat.message.ack');
        const requestId = String(
            (ackEvent.payload as { messageId?: string } | undefined)?.messageId,
        );
        assert.ok(requestId.length > 0);
        assert.equal(
            (ackEvent.payload as { messageId?: string } | undefined)?.messageId,
            requestId,
        );

        bridgeWs.send(
            JSON.stringify({
                type: 'bridge.chat.result',
                requestId,
                agentId: 'local-chat-agent',
                delta: 'partial',
            }),
        );
        const deltaEvent = await waitForWebSocketMessage(webWs);
        assert.equal(deltaEvent.type, 'chat.message.delta');
        assert.equal(
            (deltaEvent.payload as { delta?: string } | undefined)?.delta,
            'partial',
        );

        bridgeWs.send(
            JSON.stringify({
                type: 'bridge.chat.result',
                requestId,
                agentId: 'local-chat-agent',
                text: 'final reply',
                done: true,
            }),
        );
        const finalEvent = await waitForWebSocketMessage(webWs);
        assert.equal(finalEvent.type, 'chat.message.final');
        assert.equal(
            (finalEvent.payload as { text?: string } | undefined)?.text,
            'final reply',
        );

        bridgeWs.close();
        webWs.close();
    });

    it('web voice events relay through bridge realtime and return transcript/tts events', async () => {
        store.getState().setAuth({
            authenticated: true,
            publicKey: 'web-voice-pubkey',
            email: 'voice@test.im',
            privyUserId: 'web-voice-user',
        });

        const pairRes = await fetch(url('/web/session/pair'), { method: 'POST' });
        const pairBody = await pairRes.json();
        const attachRes = await fetch(url('/local/bridge/attach'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pairCode: pairBody.pairCode,
                machineName: 'voice-machine',
            }),
        });
        const attachBody = await attachRes.json();
        const bridgeWs = await openWebSocket(
            `ws://127.0.0.1:${port}/bridge/realtime?token=${attachBody.bridgeToken}`,
        );
        bridgeWs.send(
            JSON.stringify({
                type: 'bridge.agent.presence',
                agents: [
                    {
                        agentId: 'local-voice-agent',
                        displayName: 'Local Voice Agent',
                        status: 'idle',
                        capabilities: ['text', 'voice'],
                    },
                ],
            }),
        );
        await new Promise((resolve) => setTimeout(resolve, 30));

        const webWs = await openWebSocket(`ws://127.0.0.1:${port}/web/chat/local-voice-agent`);
        webWs.send(
            JSON.stringify({
                type: 'voice.start',
                requestId: 'voice-req-1',
                codec: 'text-transcript',
            }),
        );

        const bridgeStart = await waitForWebSocketMessage(bridgeWs);
        assert.equal(bridgeStart.type, 'bridge.voice.request');
        assert.equal(bridgeStart.event, 'start');
        assert.equal(bridgeStart.requestId, 'voice-req-1');

        webWs.send(
            JSON.stringify({
                type: 'voice.chunk',
                requestId: 'voice-req-1',
                seq: 0,
                dataBase64: 'aGVsbG8=',
            }),
        );
        const bridgeChunk = await waitForWebSocketMessage(bridgeWs);
        assert.equal(bridgeChunk.type, 'bridge.voice.request');
        assert.equal(bridgeChunk.event, 'chunk');
        assert.equal(bridgeChunk.dataBase64, 'aGVsbG8=');

        webWs.send(JSON.stringify({ type: 'voice.stop', requestId: 'voice-req-1' }));
        const bridgeStop = await waitForWebSocketMessage(bridgeWs);
        assert.equal(bridgeStop.type, 'bridge.voice.request');
        assert.equal(bridgeStop.event, 'stop');

        bridgeWs.send(
            JSON.stringify({
                type: 'bridge.voice.result',
                requestId: 'voice-req-1',
                agentId: 'local-voice-agent',
                transcriptPartial: 'hel',
            }),
        );
        const partial = await waitForWebSocketMessage(webWs);
        assert.equal(partial.type, 'voice.transcript.partial');
        assert.equal(
            (partial.payload as { text?: string } | undefined)?.text,
            'hel',
        );

        bridgeWs.send(
            JSON.stringify({
                type: 'bridge.voice.result',
                requestId: 'voice-req-1',
                agentId: 'local-voice-agent',
                transcriptFinal: 'hello',
                done: true,
            }),
        );
        const final = await waitForWebSocketMessage(webWs);
        assert.equal(final.type, 'voice.transcript.final');
        assert.equal(
            (final.payload as { text?: string } | undefined)?.text,
            'hello',
        );

        const statusRes = await fetch(url('/status'));
        assert.equal(statusRes.status, 200);
        const statusBody = await statusRes.json();
        assert.ok(statusBody.webEntry.voiceRequestsTotal >= 1);
        assert.ok(statusBody.webEntry.voiceChunksTotal >= 1);
        assert.ok(statusBody.webEntry.voiceResultsTotal >= 2);

        bridgeWs.close();
        webWs.close();
    });

    it('pair code expires when ttl window passed', async () => {
        const localStore = createAppStore();
        localStore.getState().setAuth({
            authenticated: true,
            publicKey: 'ttl-pubkey',
            email: 'ttl@agent.im',
            privyUserId: 'ttl-user',
        });
        const hub = new InMemoryMagicBlockHub({ latencyMs: 1 });
        const transport = new InMemoryMagicBlockTransport(hub);
        const localAgent = new MagicBlockA2AAgent('ttl-agent', transport);
        localAgent.start();

        const localApi = createApiServer(
            { store: localStore, a2aAgent: localAgent },
            { port: 0, webEntry: { pairCodeTtlMs: 10 } },
        );
        const localPort = await localApi.start();
        try {
            const pairRes = await fetch(`http://127.0.0.1:${localPort}/web/session/pair`, {
                method: 'POST',
            });
            assert.equal(pairRes.status, 200);
            const pairBody = await pairRes.json();
            await new Promise((resolve) => setTimeout(resolve, 20));

            const attachRes = await fetch(`http://127.0.0.1:${localPort}/local/bridge/attach`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pairCode: pairBody.pairCode,
                    machineName: 'ttl-machine',
                }),
            });
            assert.equal(attachRes.status, 410);
            const attachBody = await attachRes.json();
            assert.equal(attachBody.code, 'WB-1003');
        } finally {
            await localApi.stop();
        }
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

describe('API Server profile git-sync webhook signature verification', () => {
    it('rejects git-sync webhook with invalid signature', async () => {
        const signedStore = createAppStore();
        const hub = new InMemoryMagicBlockHub({ latencyMs: 5 });
        const transport = new InMemoryMagicBlockTransport(hub);
        const agent = new MagicBlockA2AAgent('profile-sig-agent', transport);
        agent.start();
        const signedApi = createApiServer(
            { store: signedStore, a2aAgent: agent },
            { port: 0, profileSyncSigningSecret: 'secret-profile' },
        );
        const signedPort = await signedApi.start();

        try {
            const payload = JSON.stringify({
                source: 'github',
                repository: 'github.com/gradience/agent-profile',
                commit_sha: 'cafe1234',
                agent: 'profile-signed-agent',
                profile: {
                    display_name: 'Signed Agent',
                    bio: 'Signed payload profile',
                    links: {},
                },
            });

            const badRes = await fetch(`http://127.0.0.1:${signedPort}/webhooks/profile/git-sync`, {
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
            const signature = createHmac('sha256', 'secret-profile')
                .update(`${ts}.${payload}`)
                .digest('hex');
            const okRes = await fetch(`http://127.0.0.1:${signedPort}/webhooks/profile/git-sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-gradience-signature-ts': ts,
                    'x-gradience-signature': signature,
                },
                body: payload,
            });
            assert.equal(okRes.status, 200);
            const okData = await okRes.json();
            assert.equal(okData.profile.agent, 'profile-signed-agent');
            assert.equal(okData.profile.publish_mode, 'git-sync');
        } finally {
            await signedApi.stop();
        }
    });
});
