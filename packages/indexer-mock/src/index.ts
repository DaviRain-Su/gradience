import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getRequestListener } from '@hono/node-server';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { TaskApi, AgentProfileApi, AgentReputationResponse, TaskListParams } from './types';
import type { DataStore } from './db/store';
import { InMemoryStore, PgStore } from './db/store';
import { createSocialRouter } from './routes/social';
import { InMemorySocialStore } from './db/social-store';
import {
    SEED_TASKS,
    SEED_SUBMISSIONS,
    SEED_REPUTATION,
    SEED_PROFILES,
    SEED_JUDGE_POOLS,
    SEED_AGENT_ROWS,
} from './data/seed';

const PORT = Number(process.env.PORT ?? 3001);

// u2500u2500 Store initialization u2500u2500

async function createStore(): Promise<DataStore> {
    if (process.env.DATABASE_URL) {
        console.log('[indexer] Using PostgreSQL store');
        const { getPool } = await import('./db/pool');
        return new PgStore(getPool());
    }

    console.log('[indexer] Using in-memory store (set DATABASE_URL for PostgreSQL)');
    const tasks = new Map(SEED_TASKS.map((t) => [t.task_id, t]));
    const submissions = new Map<number, typeof SEED_SUBMISSIONS[keyof typeof SEED_SUBMISSIONS]>();
    Object.entries(SEED_SUBMISSIONS).forEach(([taskId, list]) => {
        submissions.set(Number(taskId), list as any);
    });
    const reputation = new Map(SEED_REPUTATION.map((r) => [r.agent, r]));
    const profiles = new Map(SEED_PROFILES.map((p) => [p.agent, p]));
    const agentRows = new Map(SEED_AGENT_ROWS.map((a) => [a.agent, a]));
    const judgePools = new Map<number, any[]>();
    Object.entries(SEED_JUDGE_POOLS).forEach(([category, list]) => {
        judgePools.set(Number(category), list as any);
    });
    return new InMemoryStore(tasks, submissions, reputation, profiles, agentRows, judgePools);
}

// u2500u2500 WebSocket u2500u2500

const wsClients = new Set<WebSocket>();

function broadcast(event: string, payload: unknown) {
    const message = JSON.stringify({ event, payload, timestamp: Date.now() });
    wsClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// u2500u2500 App u2500u2500

async function main() {
    const store = await createStore();
    const app = new Hono();

    app.use(
        '*',
        cors({
            origin: '*',
            allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowHeaders: ['Content-Type', 'Authorization'],
            credentials: false,
        })
    );

    // Health
    app.get('/health', (c) => c.json({ status: 'ok', service: '@gradiences/indexer-mock', port: PORT }));
    app.get('/healthz', (c) => c.json({ status: 'ok' }));

    // u2500u2500 Tasks u2500u2500

    app.get('/api/tasks', async (c) => {
        const query = c.req.query();
        const params: TaskListParams & { reward_min?: number; reward_max?: number } = {
            status: query.status as TaskListParams['status'],
            state: query.state as TaskListParams['state'],
            category: query.category !== undefined ? Number(query.category) : undefined,
            mint: query.mint,
            poster: query.poster,
            limit: query.limit !== undefined ? Number(query.limit) : undefined,
            offset: query.offset !== undefined ? Number(query.offset) : undefined,
            reward_min: query.reward_min !== undefined ? Number(query.reward_min) : undefined,
            reward_max: query.reward_max !== undefined ? Number(query.reward_max) : undefined,
        };
        const tasks = await store.listTasks(params);
        return c.json(tasks);
    });

    app.get('/api/tasks/:id', async (c) => {
        const id = Number(c.req.param('id'));
        const task = await store.getTask(id);
        if (!task) return c.json({ error: 'Task not found' }, 404);
        return c.json(task);
    });

    app.post('/api/tasks', async (c) => {
        const body = await c.req.json<Partial<TaskApi>>();
        const now = Math.floor(Date.now() / 1000);
        const existing = await store.listTasks({});
        const maxId = existing.reduce((max, t) => Math.max(max, t.task_id), 0);
        const taskId = body.task_id ?? maxId + 1;

        const check = await store.getTask(taskId);
        if (check) return c.json({ error: `Task ${taskId} already exists` }, 409);

        const task: TaskApi = {
            task_id: taskId,
            poster: body.poster ?? '11111111111111111111111111111111',
            judge: body.judge ?? '11111111111111111111111111111111',
            judge_mode: (body.judge_mode as TaskApi['judge_mode']) ?? 'designated',
            reward: body.reward ?? 0,
            mint: body.mint ?? '11111111111111111111111111111112',
            min_stake: body.min_stake ?? 0,
            state: (body.state as TaskApi['state']) ?? 'open',
            category: body.category ?? 0,
            eval_ref: body.eval_ref ?? '',
            deadline: body.deadline ?? now + 86400,
            judge_deadline: body.judge_deadline ?? now + 172800,
            submission_count: body.submission_count ?? 0,
            winner: body.winner ?? null,
            created_at: body.created_at ?? now,
            slot: body.slot ?? 250_000_000 + Math.floor(Math.random() * 1_000_000),
        };

        const created = await store.createTask(task);
        broadcast('task_created', created);
        return c.json(created, 201);
    });

    app.get('/api/tasks/:id/submissions', async (c) => {
        const id = Number(c.req.param('id'));
        const task = await store.getTask(id);
        if (!task) return c.json({ error: 'Task not found' }, 404);
        const subs = await store.getSubmissions(id);
        return c.json(subs);
    });

    // u2500u2500 Agents u2500u2500

    app.get('/api/agents/:pubkey/reputation', async (c) => {
        const pubkey = c.req.param('pubkey');
        const rep = await store.getReputation(pubkey);
        if (!rep) return c.json({ error: 'Agent not found' }, 404);
        const response: AgentReputationResponse = {
            ...rep,
            avg_score: rep.global_avg_score,
            completed: rep.global_completed,
            total_applied: rep.global_total_applied,
            win_rate: rep.global_win_rate,
        };
        return c.json(response);
    });

    app.get('/api/agents/:pubkey/profile', async (c) => {
        const pubkey = c.req.param('pubkey');
        const profile = await store.getProfile(pubkey);
        if (!profile) return c.json({ error: 'Profile not found' }, 404);
        return c.json(profile);
    });

    app.put('/api/agents/:pubkey/profile', async (c) => {
        const pubkey = c.req.param('pubkey');
        const body = await c.req.json<Partial<AgentProfileApi>>();
        await store.upsertProfile(pubkey, body);
        return c.json({ ok: true });
    });

    // u2500u2500 Discovery u2500u2500

    app.get('/api/judge-pool/:pool', async (c) => {
        const agents = await store.getAgentRows();
        return c.json(agents);
    });

    app.get('/api/agents/discover/:pool', async (c) => {
        const agents = await store.getAgentRows();
        return c.json(agents);
    });

    app.get('/api/discover/:pool', async (c) => {
        const agents = await store.getAgentRows();
        return c.json(agents);
    });

    // u2500u2500 Social u2500u2500

    const socialStore = new InMemorySocialStore();
    app.route('/api/social', createSocialRouter(socialStore, broadcast));

    // u2500u2500 Stats u2500u2500

    app.get('/api/stats', async (c) => {
        const stats = await store.getStats();
        return c.json(stats);
    });

    // u2500u2500 Error handling u2500u2500

    app.notFound((c) => c.json({ error: 'Not found', path: c.req.path }, 404));
    app.onError((err, c) => {
        console.error('Indexer error:', err);
        return c.json({ error: 'Internal server error', message: err.message }, 500);
    });

    // u2500u2500 Server u2500u2500

    const server = createServer(getRequestListener(app.fetch));

    const wss = new WebSocketServer({ server, path: '/ws' });
    wss.on('connection', (ws) => {
        wsClients.add(ws);
        ws.send(JSON.stringify({ event: 'connected', payload: { message: 'Indexer ready' }, timestamp: Date.now() }));
        ws.on('close', () => wsClients.delete(ws));
        ws.on('error', (err) => console.error('WS error:', err));
    });

    server.listen(PORT, () => {
        console.log(`[@gradiences/indexer] Running on http://127.0.0.1:${PORT}`);
        console.log(`[@gradiences/indexer] WebSocket on ws://127.0.0.1:${PORT}/ws`);
    });
}

main().catch((err) => {
    console.error('Failed to start indexer:', err);
    process.exit(1);
});
