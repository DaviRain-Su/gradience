import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getRequestListener } from '@hono/node-server';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { TaskApi, SubmissionApi, ReputationApi, AgentProfileApi, JudgePoolEntryApi, AgentRowApi } from './types';
import { createTasksRouter } from './routes/tasks';
import { createAgentsRouter } from './routes/agents';
import {
    SEED_TASKS,
    SEED_SUBMISSIONS,
    SEED_REPUTATION,
    SEED_PROFILES,
    SEED_JUDGE_POOLS,
    SEED_AGENT_ROWS,
} from './data/seed';

const PORT = Number(process.env.PORT ?? 3001);

// In-memory stores
const tasks = new Map<number, TaskApi>(SEED_TASKS.map((t) => [t.task_id, t]));
const submissions = new Map<number, SubmissionApi[]>();
Object.entries(SEED_SUBMISSIONS).forEach(([taskId, list]) => {
    submissions.set(Number(taskId), list);
});
const reputation = new Map<string, ReputationApi>(SEED_REPUTATION.map((r) => [r.agent, r]));
const profiles = new Map<string, AgentProfileApi>(SEED_PROFILES.map((p) => [p.agent, p]));
const judgePools = new Map<number, JudgePoolEntryApi[]>();
Object.entries(SEED_JUDGE_POOLS).forEach(([category, list]) => {
    judgePools.set(Number(category), list);
});
const agentRows = new Map<string, AgentRowApi>(SEED_AGENT_ROWS.map((a) => [a.agent, a]));

// WebSocket clients
const wsClients = new Set<WebSocket>();

function broadcast(event: string, payload: unknown) {
    const message = JSON.stringify({ event, payload, timestamp: Date.now() });
    wsClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

const app = new Hono();

// CORS for all origins - supports frontend development on any port
app.use(
    '*',
    cors({
        origin: '*',
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        credentials: false, // Must be false when origin is '*'
    })
);

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: '@gradiences/indexer-mock', port: PORT }));

// Routes
app.route('/api/tasks', createTasksRouter(tasks, submissions, broadcast));
app.route('/api/agents', createAgentsRouter(reputation, profiles));

// GET /api/judge-pool/:pool - Returns agents list for DiscoverView
// Note: This returns agents (not judges) as expected by the frontend DiscoverView
app.get('/api/judge-pool/:pool', (c) => {
    // Return all agent rows with reputation data
    const agents = Array.from(agentRows.values());
    return c.json(agents);
});

// GET /api/agents/discover/:pool - Returns agents with reputation for DiscoverView
app.get('/api/agents/discover/:pool', (c) => {
    const pool = Number(c.req.param('pool'));
    // Return all agent rows (pool parameter is for future filtering)
    const agents = Array.from(agentRows.values());
    return c.json(agents);
});

// GET /api/discover/:pool - Alternative endpoint for DiscoverView (matches frontend pattern)
app.get('/api/discover/:pool', (c) => {
    const agents = Array.from(agentRows.values());
    return c.json(agents);
});

// Stats endpoint (convenience)
app.get('/api/stats', (c) => {
    const openTasks = Array.from(tasks.values()).filter((t) => t.state === 'open').length;
    const completedTasks = Array.from(tasks.values()).filter((t) => t.state === 'completed').length;
    const totalAgents = reputation.size;

    return c.json({
        tasks_total: tasks.size,
        tasks_open: openTasks,
        tasks_completed: completedTasks,
        agents_total: totalAgents,
        total_rewards_lamports: Array.from(tasks.values()).reduce((sum, t) => sum + t.reward, 0),
    });
});

// 404 handler
app.notFound((c) => c.json({ error: 'Not found', path: c.req.path }, 404));

// Global error handler
app.onError((err, c) => {
    console.error('Indexer error:', err);
    return c.json({ error: 'Internal server error', message: err.message }, 500);
});

const server = createServer(getRequestListener(app.fetch));

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
    wsClients.add(ws);
    ws.send(JSON.stringify({ event: 'connected', payload: { message: 'Indexer mock WS ready' }, timestamp: Date.now() }));

    ws.on('close', () => {
        wsClients.delete(ws);
    });

    ws.on('error', (err) => {
        console.error('WS error:', err);
    });
});

server.listen(PORT, () => {
    console.log(`[@gradiences/indexer-mock] Server running on http://127.0.0.1:${PORT}`);
    console.log(`[@gradiences/indexer-mock] WebSocket ready on ws://127.0.0.1:${PORT}/ws`);
    console.log(`[@gradiences/indexer-mock] Tasks: ${tasks.size}, Agents: ${reputation.size}`);
});
