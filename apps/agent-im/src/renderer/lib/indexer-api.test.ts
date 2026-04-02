import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { IndexerClient } from './indexer-api.ts';

// Mock Indexer server
let mockPort: number;
let mockServer: ReturnType<typeof createServer>;

before(async () => {
    mockServer = createServer((req, res) => {
        const url = new URL(req.url ?? '/', `http://localhost`);

        if (url.pathname === '/api/reputation/alice') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                global_avg_score: 92.5,
                global_completed: 47,
                global_total_applied: 50,
                win_rate: 0.94,
                by_category: {},
            }));
            return;
        }

        if (url.pathname === '/api/reputation/unknown') {
            res.writeHead(404);
            res.end();
            return;
        }

        if (url.pathname === '/api/tasks') {
            const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify([
                { task_id: 1, poster: 'alice', state: 'open', reward: 1000, submission_count: 2 },
            ]));
            return;
        }

        if (url.pathname === '/api/judge-pool/0') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify([
                { judge: 'alice', stake: 5000, weight: 1500 },
                { judge: 'bob', stake: 2000, weight: 800 },
            ]));
            return;
        }

        res.writeHead(404);
        res.end();
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
    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
});

describe('IndexerClient', () => {
    it('getReputation returns data for known address', async () => {
        const client = new IndexerClient(`http://127.0.0.1:${mockPort}`);
        const rep = await client.getReputation('alice');
        assert.ok(rep);
        assert.equal(rep.global_avg_score, 92.5);
        assert.equal(rep.global_completed, 47);
    });

    it('getReputation returns null for unknown address', async () => {
        const client = new IndexerClient(`http://127.0.0.1:${mockPort}`);
        const rep = await client.getReputation('unknown');
        assert.equal(rep, null);
    });

    it('getTasks returns array', async () => {
        const client = new IndexerClient(`http://127.0.0.1:${mockPort}`);
        const tasks = await client.getTasks({ status: 'open' });
        assert.ok(Array.isArray(tasks));
        assert.equal(tasks.length, 1);
        assert.equal(tasks[0].task_id, 1);
    });

    it('offline indexer returns null/empty without crashing', async () => {
        const client = new IndexerClient('http://127.0.0.1:1'); // port 1 = unreachable
        const rep = await client.getReputation('alice');
        assert.equal(rep, null);
        const tasks = await client.getTasks();
        assert.deepEqual(tasks, []);
    });
});
