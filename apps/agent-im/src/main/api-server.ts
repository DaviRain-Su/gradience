/**
 * Agent.im API server — localhost:3939
 * Agents interact through this API with the same effect as GUI users.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AppStore } from '../renderer/lib/store.ts';
import type { ChatMessage } from '../shared/types.ts';
import {
    MagicBlockA2AAgent,
    estimateMicropayment,
} from '../renderer/lib/a2a-client.ts';
import { sortAndFilterAgents } from '../renderer/lib/ranking.ts';

export interface ApiServerOptions {
    port?: number;
    host?: string;
    apiToken?: string;
}

export interface ApiServerDeps {
    store: ReturnType<typeof import('../renderer/lib/store.ts').createAppStore>;
    a2aAgent: MagicBlockA2AAgent;
}

function json(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString();
}

export function createApiServer(deps: ApiServerDeps, options: ApiServerOptions = {}) {
    const { store, a2aAgent } = deps;
    const apiToken = options.apiToken;

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
