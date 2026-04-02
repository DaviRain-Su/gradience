/**
 * Agent.im API server — localhost:3939
 * Agents interact through this API with the same effect as GUI users.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ChatMessage } from '../shared/types.ts';
import {
    MagicBlockA2AAgent,
} from '../renderer/lib/a2a-client.ts';
import { sortAndFilterAgents } from '../renderer/lib/ranking.ts';
import type { InteropSyncEvent } from '../shared/types.ts';

export interface ApiServerOptions {
    port?: number;
    host?: string;
    apiToken?: string;
    interopSigningSecret?: string;
}

export interface ApiServerDeps {
    store: ReturnType<typeof import('../renderer/lib/store.ts').createAppStore>;
    a2aAgent: MagicBlockA2AAgent;
}

function json(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}

function html(res: ServerResponse, status: number, body: string) {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(body);
}

async function readBody(req: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString();
}

export function createApiServer(deps: ApiServerDeps, options: ApiServerOptions = {}) {
    const { store, a2aAgent } = deps;
    const apiToken = options.apiToken;
    const interopSigningSecret = options.interopSigningSecret;

    const server = createServer(async (req, res) => {
        // Optional token auth
        if (apiToken) {
            const auth = req.headers['authorization'];
            if (auth !== `Bearer ${apiToken}`) {
                return json(res, 401, { error: 'Unauthorized' });
            }
        }

        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        const path = url.pathname;
        const method = req.method ?? 'GET';

        try {
            // POST /a2a/send
            if (method === 'POST' && path === '/a2a/send') {
                const body = JSON.parse(await readBody(req));
                if (!body.to || !body.topic || !body.message) {
                    return json(res, 400, { error: 'Missing required fields: to, topic, message' });
                }
                const envelope = a2aAgent.sendInvite({
                    to: body.to,
                    topic: body.topic,
                    message: body.message,
                });
                // Also add to local store
                const chatMsg: ChatMessage = {
                    id: envelope.id,
                    peerAddress: envelope.to,
                    direction: 'outgoing',
                    topic: envelope.topic,
                    message: envelope.message,
                    paymentMicrolamports: envelope.paymentMicrolamports,
                    status: 'sent',
                    createdAt: envelope.createdAt,
                };
                store.getState().addMessage(chatMsg);
                return json(res, 200, { ok: true, envelope });
            }

            // GET /a2a/messages?peer=addr&limit=50
            if (method === 'GET' && path === '/a2a/messages') {
                const peer = url.searchParams.get('peer');
                if (!peer) return json(res, 400, { error: 'Missing query param: peer' });
                const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
                const allMsgs = store.getState().messages.get(peer) ?? [];
                const msgs = allMsgs.slice(-limit);
                return json(res, 200, { messages: msgs, hasMore: allMsgs.length > limit });
            }

            // GET /discover/agents?category=0&query=
            if (method === 'GET' && path === '/discover/agents') {
                const query = url.searchParams.get('query') ?? '';
                const rows = store.getState().discoveryRows;
                const filtered = sortAndFilterAgents(rows, query);
                return json(res, 200, { agents: filtered });
            }

            // GET /me/reputation
            if (method === 'GET' && path === '/me/reputation') {
                const { auth } = store.getState();
                if (!auth.authenticated) {
                    return json(res, 401, { error: 'Not authenticated' });
                }
                return json(res, 200, { publicKey: auth.publicKey, reputation: null });
            }

            // GET /status
            if (method === 'GET' && path === '/status') {
                return json(res, 200, {
                    version: '0.1.0',
                    authenticated: store.getState().auth.authenticated,
                    publicKey: store.getState().auth.publicKey,
                    a2aConnected: true,
                    uptime: process.uptime(),
                });
            }

            // POST /interop/events (ingest signed events from judge-daemon)
            if (method === 'POST' && path === '/interop/events') {
                const bodyText = await readBody(req);
                if (
                    interopSigningSecret &&
                    !verifyInteroperabilitySignature(
                        bodyText,
                        req.headers['x-gradience-signature-ts'],
                        req.headers['x-gradience-signature'],
                        interopSigningSecret,
                    )
                ) {
                    return json(res, 401, { error: 'Invalid interoperability signature' });
                }
                const payload = JSON.parse(bodyText) as InteropSyncEvent;
                if (!isInteropSyncEvent(payload)) {
                    return json(res, 400, { error: 'Invalid interop payload' });
                }
                const snapshot = store.getState().applyInteropSyncEvent(payload);
                return json(res, 200, { ok: true, snapshot });
            }

            // GET /interop/status?agent=<address>
            if (method === 'GET' && path === '/interop/status') {
                const agent = url.searchParams.get('agent');
                if (!agent) {
                    return json(res, 400, { error: 'Missing query param: agent' });
                }
                const snapshot = store.getState().getInteropStatus(agent);
                return json(res, 200, {
                    agent,
                    status:
                        snapshot ??
                        {
                            agent,
                            identityRegistered: false,
                            erc8004FeedbackCount: 0,
                            evmReputationCount: 0,
                            istranaFeedbackCount: 0,
                            attestationCount: 0,
                            lastTaskId: null,
                            lastScore: null,
                            lastChainTx: null,
                            updatedAt: 0,
                        },
                });
            }

            // GET /interop/dashboard?agent=<address>
            if (method === 'GET' && path === '/interop/dashboard') {
                const agent = url.searchParams.get('agent');
                if (!agent) {
                    return html(res, 400, '<h1>Missing query param: agent</h1>');
                }
                const snapshot = store.getState().getInteropStatus(agent);
                const data = snapshot ?? {
                    agent,
                    identityRegistered: false,
                    erc8004FeedbackCount: 0,
                    evmReputationCount: 0,
                    istranaFeedbackCount: 0,
                    attestationCount: 0,
                    lastTaskId: null,
                    lastScore: null,
                    lastChainTx: null,
                    updatedAt: 0,
                };
                return html(
                    res,
                    200,
                    renderInteropDashboard(agent, data),
                );
            }

            json(res, 404, { error: 'Not found' });
        } catch (err) {
            json(res, 500, { error: err instanceof Error ? err.message : 'Internal error' });
        }
    });

    const host = options.host ?? '127.0.0.1';
    const port = options.port ?? 3939;

    return {
        start: () => new Promise<number>((resolve) => {
            server.listen(port, host, () => {
                const addr = server.address();
                const actualPort = typeof addr === 'object' && addr ? addr.port : port;
                resolve(actualPort);
            });
        }),
        stop: () => new Promise<void>((resolve) => {
            server.close(() => resolve());
        }),
        server,
    };
}

function renderInteropDashboard(
    agent: string,
    data: {
        identityRegistered: boolean;
        erc8004FeedbackCount: number;
        evmReputationCount: number;
        istranaFeedbackCount: number;
        attestationCount: number;
        lastTaskId: number | null;
        lastScore: number | null;
        lastChainTx: string | null;
        updatedAt: number;
    },
): string {
    const updated = data.updatedAt > 0 ? new Date(data.updatedAt).toISOString() : 'N/A';
    const score = data.lastScore ?? 'N/A';
    const lastTask = data.lastTaskId ?? 'N/A';
    const chainTx = data.lastChainTx ?? 'N/A';
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Agent.im Interop Dashboard</title>
  </head>
  <body>
    <h1>Agent.im Interop Dashboard</h1>
    <p><strong>Agent:</strong> ${escapeHtml(agent)}</p>
    <ul>
      <li><strong>Identity Registered:</strong> ${data.identityRegistered ? 'Yes' : 'No'}</li>
      <li><strong>ERC-8004 Feedback Count:</strong> ${data.erc8004FeedbackCount}</li>
      <li><strong>EVM Reputation Relay Count:</strong> ${data.evmReputationCount}</li>
      <li><strong>Istrana Feedback Count:</strong> ${data.istranaFeedbackCount}</li>
      <li><strong>TaskCompletion Attestations:</strong> ${data.attestationCount}</li>
      <li><strong>Last Task:</strong> ${lastTask}</li>
      <li><strong>Last Score:</strong> ${score}</li>
      <li><strong>Last Chain Tx:</strong> ${escapeHtml(chainTx)}</li>
      <li><strong>Updated At:</strong> ${updated}</li>
    </ul>
  </body>
</html>`;
}

function isInteropSyncEvent(value: unknown): value is InteropSyncEvent {
    if (!value || typeof value !== 'object') return false;
    const event = value as Partial<InteropSyncEvent>;
    return (
        event.type === 'interop_sync' &&
        typeof event.winner === 'string' &&
        typeof event.taskId === 'number' &&
        typeof event.score === 'number' &&
        typeof event.category === 'number' &&
        typeof event.chainTx === 'string' &&
        typeof event.judgedAt === 'number' &&
        typeof event.identityRegistered === 'boolean' &&
        Array.isArray(event.feedbackTargets) &&
        typeof event.erc8004FeedbackPublished === 'boolean' &&
        (typeof event.evmReputationPublished === 'undefined' ||
            typeof event.evmReputationPublished === 'boolean') &&
        typeof event.istranaFeedbackPublished === 'boolean' &&
        typeof event.attestationPublished === 'boolean'
    );
}

function verifyInteroperabilitySignature(
    body: string,
    timestampHeader: string | string[] | undefined,
    signatureHeader: string | string[] | undefined,
    secret: string,
): boolean {
    const timestamp = Array.isArray(timestampHeader) ? timestampHeader[0] : timestampHeader;
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!timestamp || !signature) return false;
    const expected = createHmac('sha256', secret)
        .update(`${timestamp}.${body}`)
        .digest('hex');
    try {
        return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
        return false;
    }
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
