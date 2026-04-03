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
    const statusMap = new Map<
        string,
        {
            identityRegistered: boolean;
            erc8004FeedbackCount: number;
            evmReputationCount: number;
            istranaFeedbackCount: number;
        }
    >();
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
                identityRecipients?: string[];
                feedbackRecipients?: Array<{ sink: string; agent: string }>;
                feedbackPublishedCount?: number;
                erc8004FeedbackPublished?: boolean;
                evmReputationPublished?: boolean;
                istranaFeedbackPublished?: boolean;
            };
            const feedbackRecipients =
                payload.feedbackRecipients?.length && Array.isArray(payload.feedbackRecipients)
                    ? payload.feedbackRecipients
                    : [
                          {
                              sink: 'evm_reputation_relay',
                              agent: payload.winner,
                          },
                      ];
            const identityRecipients = payload.identityRecipients ?? [];
            const agents = new Set<string>([
                payload.winner,
                ...identityRecipients,
                ...feedbackRecipients.map(entry => entry.agent),
            ]);

            for (const agent of agents) {
                const current = statusMap.get(agent) ?? {
                    identityRegistered: false,
                    erc8004FeedbackCount: 0,
                    evmReputationCount: 0,
                    istranaFeedbackCount: 0,
                };
                const next = {
                    identityRegistered: current.identityRegistered || identityRecipients.includes(agent),
                    erc8004FeedbackCount:
                        current.erc8004FeedbackCount +
                        feedbackRecipients.filter(entry => entry.agent === agent && entry.sink === 'erc8004_feedback')
                            .length +
                        (payload.erc8004FeedbackPublished &&
                        (!payload.feedbackRecipients || payload.feedbackRecipients.length === 0) &&
                        agent === payload.winner
                            ? (payload.feedbackPublishedCount ?? 1)
                            : 0),
                    evmReputationCount:
                        current.evmReputationCount +
                        feedbackRecipients.filter(
                            entry => entry.agent === agent && entry.sink === 'evm_reputation_relay',
                        ).length +
                        (payload.evmReputationPublished &&
                        (!payload.feedbackRecipients || payload.feedbackRecipients.length === 0) &&
                        agent === payload.winner
                            ? (payload.feedbackPublishedCount ?? 1)
                            : 0),
                    istranaFeedbackCount:
                        current.istranaFeedbackCount +
                        feedbackRecipients.filter(entry => entry.agent === agent && entry.sink === 'istrana_feedback')
                            .length +
                        (payload.istranaFeedbackPublished &&
                        (!payload.feedbackRecipients || payload.feedbackRecipients.length === 0) &&
                        agent === payload.winner
                            ? (payload.feedbackPublishedCount ?? 1)
                            : 0),
                };
                statusMap.set(agent, next);
            }
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
        }
        if (req.method === 'GET' && url.pathname === '/interop/status') {
            const agent = url.searchParams.get('agent') ?? '';
            const status = statusMap.get(agent) ?? {
                identityRegistered: false,
                erc8004FeedbackCount: 0,
                evmReputationCount: 0,
                istranaFeedbackCount: 0,
            };
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ status: { agent, ...status } }));
            return;
        }
        res.writeHead(404).end();
    });
    return { server };
}

function createErc8004RelayMock(authToken: string) {
    const knownAgents = new Set<string>();
    let identitySuccess = 0;
    let feedbackSuccess = 0;
    const server = createServer(async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        if (
            req.method === 'POST' &&
            (url.pathname === '/relay/erc8004/register-identity' || url.pathname === '/relay/erc8004/give-feedback')
        ) {
            if (req.headers.authorization !== `Bearer ${authToken}`) {
                res.writeHead(401).end();
                return;
            }
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
                chunks.push(chunk as Buffer);
            }
            const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
                agentPubkey?: string;
                registrations?: Array<{ agentId?: string }>;
            };
            const agent = payload.agentPubkey ?? payload.registrations?.[0]?.agentId ?? 'unknown-agent';
            knownAgents.add(agent);
            if (url.pathname === '/relay/erc8004/register-identity') {
                identitySuccess += 1;
            } else {
                feedbackSuccess += 1;
            }
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
        }
        if (req.method === 'GET' && url.pathname === '/status') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(
                JSON.stringify({
                    erc8004: {
                        identity: { success: identitySuccess, failed: 0 },
                        feedback: { success: feedbackSuccess, failed: 0 },
                        knownAgents: knownAgents.size,
                    },
                }),
            );
            return;
        }
        res.writeHead(404).end();
    });
    return { server };
}

test('runInteropDrill publishes multi-role feedback and audits relay/agent-im status', async () => {
    const authToken = 'token-interop';
    const relay = createRelayMock(authToken);
    const agentIm = createAgentImMock(authToken);
    const erc8004 = createErc8004RelayMock(authToken);
    relay.server.listen(0, '127.0.0.1');
    agentIm.server.listen(0, '127.0.0.1');
    erc8004.server.listen(0, '127.0.0.1');
    await Promise.all([
        once(relay.server, 'listening'),
        once(agentIm.server, 'listening'),
        once(erc8004.server, 'listening'),
    ]);

    const relayAddress = relay.server.address();
    const agentImAddress = agentIm.server.address();
    const erc8004Address = erc8004.server.address();
    assert.ok(relayAddress && typeof relayAddress === 'object');
    assert.ok(agentImAddress && typeof agentImAddress === 'object');
    assert.ok(erc8004Address && typeof erc8004Address === 'object');

    const relayEndpoint = `http://127.0.0.1:${relayAddress.port}/relay/submit-reputation`;
    const agentImEventsEndpoint = `http://127.0.0.1:${agentImAddress.port}/interop/events`;
    const erc8004IdentityEndpoint = `http://127.0.0.1:${erc8004Address.port}/relay/erc8004/register-identity`;
    const erc8004FeedbackEndpoint = `http://127.0.0.1:${erc8004Address.port}/relay/erc8004/give-feedback`;
    const env: NodeJS.ProcessEnv = {
        JUDGE_DAEMON_EVM_REPUTATION_RELAY_ENDPOINT: relayEndpoint,
        JUDGE_DAEMON_AGENT_IM_INTEROP_ENDPOINT: agentImEventsEndpoint,
        JUDGE_DAEMON_ERC8004_IDENTITY_ENDPOINT: erc8004IdentityEndpoint,
        JUDGE_DAEMON_ERC8004_FEEDBACK_ENDPOINT: erc8004FeedbackEndpoint,
        JUDGE_DAEMON_INTEROP_AUTH_TOKEN: authToken,
        DRILL_AGENT: '11111111111111111111111111111111',
        DRILL_POSTER: '22222222222222222222222222222222',
        DRILL_JUDGE: '33333333333333333333333333333333',
        DRILL_LOSERS: '44444444444444444444444444444444',
    };

    try {
        const result = await runInteropDrill(env);
        assert.equal(result.agent, '11111111111111111111111111111111');
        assert.ok(result.taskId > 0);
        assert.equal(result.identityRecipients.length, 4);
        assert.equal(result.feedbackDispatches.length, 4);
        assert.equal(result.relayStatus.success, 4);
        assert.equal(result.erc8004Status?.identitySuccess, 4);
        assert.equal(result.erc8004Status?.feedbackSuccess, 4);
        assert.equal(result.agentImStatusByAgent['44444444444444444444444444444444']?.evmReputationCount, 1);
    } finally {
        relay.server.close();
        agentIm.server.close();
        erc8004.server.close();
    }
});
