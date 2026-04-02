import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { AgentImWebEntryApiClient } from './web-entry-api.ts';

let mockPort: number;
let mockServer: ReturnType<typeof createServer>;

before(async () => {
    mockServer = createServer((req, res) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        if (req.method === 'POST' && url.pathname === '/web/session/pair') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(
                JSON.stringify({
                    pairCode: 'AB12CD34',
                    expiresAt: 1760000000000,
                }),
            );
            return;
        }
        if (req.method === 'GET' && url.pathname === '/web/agents') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(
                JSON.stringify({
                    items: [
                        {
                            agentId: 'local-agent',
                            bridgeId: 'bridge-1',
                            displayName: 'Local Agent',
                            status: 'idle',
                            capabilities: ['text', 'voice'],
                            updatedAt: 1760000000100,
                        },
                    ],
                }),
            );
            return;
        }
        if (req.method === 'GET' && url.pathname === '/fail/web/agents') {
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ code: 'WB-1005', error: 'Bridge not connected' }));
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
    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
});

describe('AgentImWebEntryApiClient', () => {
    it('issuePairCode returns response payload', async () => {
        const client = new AgentImWebEntryApiClient(`http://127.0.0.1:${mockPort}`);
        const pair = await client.issuePairCode();
        assert.equal(pair.pairCode, 'AB12CD34');
        assert.equal(pair.expiresAt, 1760000000000);
    });

    it('listAgents returns online agent items', async () => {
        const client = new AgentImWebEntryApiClient(`http://127.0.0.1:${mockPort}`);
        const agents = await client.listAgents();
        assert.equal(agents.items.length, 1);
        assert.equal(agents.items[0]?.agentId, 'local-agent');
        assert.ok(agents.items[0]?.capabilities.includes('voice'));
    });

    it('error body message is surfaced', async () => {
        const client = new AgentImWebEntryApiClient(`http://127.0.0.1:${mockPort}/fail`);
        await assert.rejects(
            () => client.listAgents(),
            /AgentM API 404: Bridge not connected/,
        );
    });
});
