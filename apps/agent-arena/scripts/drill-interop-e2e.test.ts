import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';

import { runInteropDrill } from './drill-interop-e2e.ts';

function createRelayMock(authToken: string) {
    let success = 0;
    const server = createServer(async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        if (req.method === 'POST' && url.pathname === '/relay/submit-reputation') {
            if (req.headers.authorization !== `Bearer ${authToken}`) {
                res.writeHead(401).end();
                return;
            }
            success += 1;
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
        }
        if (req.method === 'GET' && url.pathname === '/status') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ success, failed: 0 }));
            return;
        }
        res.writeHead(404).end();
    });
    return { server };
}

function createAgentImMock(authToken: string) {
    const statusMap = new Map<string, { evmReputationCount: number }>();
    const server = createServer(async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        if (req.method === 'POST' && url.pathname === '/interop/events') {
            if (req.headers.authorization !== `Bearer ${authToken}`) {
                res.writeHead(401).end();
                return;
            }
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
                chunks.push(chunk as Buffer);
            }
            const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
                winner: string;
                evmReputationPublished?: boolean;
            };
            const current = statusMap.get(payload.winner) ?? { evmReputationCount: 0 };
            statusMap.set(payload.winner, {
                evmReputationCount:
                    current.evmReputationCount + (payload.evmReputationPublished ? 1 : 0),
            });
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
        }
        if (req.method === 'GET' && url.pathname === '/interop/status') {
            const agent = url.searchParams.get('agent') ?? '';
            const status = statusMap.get(agent) ?? { evmReputationCount: 0 };
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ status: { agent, ...status } }));
            return;
        }
        res.writeHead(404).end();
    });
    return { server };
}

test('runInteropDrill publishes to relay and agent-im status', async () => {
    const authToken = 'token-interop';
    const relay = createRelayMock(authToken);
    const agentIm = createAgentImMock(authToken);
    relay.server.listen(0, '127.0.0.1');
    agentIm.server.listen(0, '127.0.0.1');
    await Promise.all([once(relay.server, 'listening'), once(agentIm.server, 'listening')]);

    const relayAddress = relay.server.address();
    const agentImAddress = agentIm.server.address();
    assert.ok(relayAddress && typeof relayAddress === 'object');
    assert.ok(agentImAddress && typeof agentImAddress === 'object');

    const relayEndpoint = `http://127.0.0.1:${relayAddress.port}/relay/submit-reputation`;
    const agentImEventsEndpoint = `http://127.0.0.1:${agentImAddress.port}/interop/events`;
    const env: NodeJS.ProcessEnv = {
        JUDGE_DAEMON_EVM_REPUTATION_RELAY_ENDPOINT: relayEndpoint,
        JUDGE_DAEMON_AGENT_IM_INTEROP_ENDPOINT: agentImEventsEndpoint,
        JUDGE_DAEMON_INTEROP_AUTH_TOKEN: authToken,
        DRILL_AGENT: '11111111111111111111111111111111',
    };

    try {
        const result = await runInteropDrill(env);
        assert.equal(result.agent, '11111111111111111111111111111111');
        assert.ok(result.taskId > 0);
    } finally {
        relay.server.close();
        agentIm.server.close();
    }
});
