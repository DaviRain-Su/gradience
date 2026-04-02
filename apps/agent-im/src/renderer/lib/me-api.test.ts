import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { AgentImApiClient } from './me-api.ts';

let mockPort: number;
let mockServer: ReturnType<typeof createServer>;

before(async () => {
    mockServer = createServer(async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');

        if (req.method === 'GET' && url.pathname === '/me/tasks') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(
                JSON.stringify({
                    items: [
                        {
                            task: {
                                task_id: 11,
                                poster: 'poster-a',
                                judge: 'judge-a',
                                reward: 1000,
                                state: 'open',
                                category: 1,
                                deadline: '123',
                                submission_count: 1,
                                winner: null,
                                created_at: '100',
                            },
                            role: 'participant',
                            latestSubmission: {
                                agent: 'agent-a',
                                result_ref: 'ipfs://result-11',
                                trace_ref: 'ipfs://trace-11',
                                submission_slot: 1001,
                                submitted_at: '1001',
                            },
                        },
                    ],
                    total: 1,
                    limit: 20,
                    offset: 0,
                    hasMore: false,
                }),
            );
            return;
        }

        if (req.method === 'POST' && url.pathname === '/me/tasks/11/apply') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: true, taskId: 11, status: 'applied' }));
            return;
        }

        if (req.method === 'POST' && url.pathname === '/me/tasks/11/submit') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: true, taskId: 11, status: 'submitted' }));
            return;
        }

        if (req.method === 'POST' && url.pathname === '/me/tasks/99/apply') {
            res.writeHead(400, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Only open tasks can be applied' }));
            return;
        }

        res.writeHead(404).end();
    });

    await new Promise<void>((resolve) => {
        mockServer.listen(0, '127.0.0.1', () => {
            const addr = mockServer.address();
            mockPort = typeof addr === 'object' && addr ? addr.port : 0;
            resolve();
        });
    });
});

after(async () => {
    await new Promise<void>((resolve) => {
        mockServer.close(() => resolve());
    });
});

describe('AgentImApiClient', () => {
    it('getMeTasks returns typed payload', async () => {
        const client = new AgentImApiClient(`http://127.0.0.1:${mockPort}`);
        const tasks = await client.getMeTasks({ role: 'all', limit: 20, offset: 0 });
        assert.equal(tasks.total, 1);
        assert.equal(tasks.items[0]?.task.task_id, 11);
        assert.equal(tasks.items[0]?.latestSubmission?.result_ref, 'ipfs://result-11');
    });

    it('applyToTask and submitTask return success payload', async () => {
        const client = new AgentImApiClient(`http://127.0.0.1:${mockPort}`);
        const applied = await client.applyToTask(11);
        assert.equal(applied.ok, true);
        assert.equal(applied.status, 'applied');

        const submitted = await client.submitTask(11, { resultRef: 'ipfs://result-11' });
        assert.equal(submitted.ok, true);
        assert.equal(submitted.status, 'submitted');
    });

    it('request errors include API error body', async () => {
        const client = new AgentImApiClient(`http://127.0.0.1:${mockPort}`);
        await assert.rejects(
            () => client.applyToTask(99),
            /Only open tasks can be applied/,
        );
    });
});
