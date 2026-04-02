/**
 * Agent.im API server — localhost:3939
 * Agents interact through this API with the same effect as GUI users.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type {
    AgentProfile,
    ArenaTaskSummary,
    ChatMessage,
    ProfilePublishMode,
} from '../shared/types.ts';
import { EMPTY_AUTH } from '../shared/types.ts';
import { createWebEntryRuntime } from './web-entry/runtime.ts';
import type { WebEntryConfig } from './web-entry/state.ts';
import {
    MagicBlockA2AAgent,
} from '../renderer/lib/a2a-client.ts';
import { sortAndFilterAgents } from '../renderer/lib/ranking.ts';
import type { InteropSyncEvent } from '../shared/types.ts';
import { getIndexerClient, type IndexerClient, type SubmissionApi, type TaskApi } from '../renderer/lib/indexer-api.ts';

export interface ApiServerOptions {
    port?: number;
    host?: string;
    apiToken?: string;
    interopSigningSecret?: string;
    profileSyncSigningSecret?: string;
    signatureMaxSkewSec?: number;
    profileSyncAllowedSources?: string[];
    profileSyncAllowedOrganizations?: string[];
    webEntry?: Partial<WebEntryConfig>;
}

export interface ApiServerDeps {
    store: ReturnType<typeof import('../renderer/lib/store.ts').createAppStore>;
    a2aAgent: MagicBlockA2AAgent;
    indexer?: Pick<IndexerClient, 'getReputation' | 'getTasks' | 'getTaskById' | 'getTaskSubmissions'>;
    profilePublisher?: AgentProfilePublisher;
}

export interface AgentProfilePublisher {
    publish(input: {
        agent: string;
        mode: ProfilePublishMode;
        contentRef: string;
        profile: AgentProfile;
    }): Promise<{ onchainRef: string; tx: string }>;
}

interface AuthBindingState {
    byPrivyUserId: Map<string, string>;
    byWallet: Map<string, string>;
    rejectedDemoLoginTotal: number;
    rejectedSessionTotal: number;
    demoLoginDisabledTotal: number;
    lastError: string | null;
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
    const indexer = deps.indexer ?? getIndexerClient();
    const profilePublisher = deps.profilePublisher ?? createLocalProfilePublisher();
    const apiToken = options.apiToken;
    const interopSigningSecret = options.interopSigningSecret;
    const profileSyncSigningSecret = options.profileSyncSigningSecret;
    const signatureMaxSkewSec = options.signatureMaxSkewSec ?? 300;
    const profileSyncAllowedSources = normalizeAllowlist(options.profileSyncAllowedSources);
    const profileSyncAllowedOrganizations = normalizeAllowlist(
        options.profileSyncAllowedOrganizations,
    );
    const authBindings = createAuthBindingState();
    const webEntry = createWebEntryRuntime(
        {
            requireSession: () => requireBoundSession(store.getState().auth, authBindings),
        },
        options.webEntry,
    );

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
            // POST /auth/demo-login (development/test only)
            if (method === 'POST' && path === '/auth/demo-login') {
                if (
                    process.env.NODE_ENV === 'production' ||
                    process.env.AGENT_IM_DISABLE_DEMO_LOGIN === '1'
                ) {
                    authBindings.demoLoginDisabledTotal += 1;
                    authBindings.lastError = 'Demo login is disabled in production';
                    return json(res, 403, { error: 'Demo login is disabled in production' });
                }
                const body = JSON.parse(await readBody(req) || '{}') as {
                    publicKey?: string;
                    email?: string;
                    privyUserId?: string;
                };
                const auth = {
                    authenticated: true,
                    publicKey: body.publicKey ?? 'DEMO_AGENT_IM',
                    email: body.email ?? 'demo@agent.im',
                    privyUserId: body.privyUserId ?? `demo-${Date.now()}`,
                };
                const bindingError = registerAuthBinding(
                    authBindings,
                    auth.publicKey,
                    auth.privyUserId,
                );
                if (bindingError) {
                    authBindings.rejectedDemoLoginTotal += 1;
                    authBindings.lastError = bindingError;
                    return json(res, 409, { error: bindingError });
                }
                store.getState().setAuth(auth);
                return json(res, 200, { ok: true, auth });
            }

            // POST /auth/logout
            if (method === 'POST' && path === '/auth/logout') {
                store.getState().setAuth(EMPTY_AUTH);
                return json(res, 200, { ok: true, auth: store.getState().auth });
            }

            // GET /auth/session
            if (method === 'GET' && path === '/auth/session') {
                return json(res, 200, { auth: store.getState().auth });
            }

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

            // GET/PUT /api/agents/:agent/profile
            const profileMatch = path.match(/^\/api\/agents\/([^/]+)\/profile$/);
            if (profileMatch && profileMatch[1]) {
                const agent = decodeURIComponent(profileMatch[1]);
                if (method === 'GET') {
                    const profile = store.getState().getAgentProfile(agent);
                    return json(res, 200, {
                        profile: profile ? toProfileApi(profile) : null,
                    });
                }
                if (method === 'PUT') {
                    const session = requireBoundSession(store.getState().auth, authBindings);
                    if ('error' in session) {
                        return json(res, 401, { error: session.error });
                    }
                    if (session.publicKey !== agent) {
                        return json(res, 403, { error: 'Profile updates are only allowed for your own agent' });
                    }
                    const payload = JSON.parse(await readBody(req) || '{}') as Record<string, unknown>;
                    const parsed = parseProfileUpsertPayload(payload);
                    if ('error' in parsed) {
                        return json(res, 400, { error: parsed.error });
                    }
                    const current = store.getState().getAgentProfile(agent);
                    const profile: AgentProfile = {
                        agent,
                        displayName: parsed.displayName,
                        bio: parsed.bio,
                        links: parsed.links,
                        onchainRef: current?.onchainRef ?? null,
                        publishMode: parsed.publishMode ?? current?.publishMode ?? 'manual',
                        updatedAt: Date.now(),
                    };
                    store.getState().setAgentProfile(profile);
                    return json(res, 200, { profile: toProfileApi(profile) });
                }
            }

            // POST /api/agents/:agent/profile/publish
            const publishMatch = path.match(/^\/api\/agents\/([^/]+)\/profile\/publish$/);
            if (method === 'POST' && publishMatch && publishMatch[1]) {
                const agent = decodeURIComponent(publishMatch[1]);
                const session = requireBoundSession(store.getState().auth, authBindings);
                if ('error' in session) {
                    return json(res, 401, { error: session.error });
                }
                if (session.publicKey !== agent) {
                    return json(res, 403, { error: 'Profile publishing is only allowed for your own agent' });
                }
                const current = store.getState().getAgentProfile(agent);
                if (!current) {
                    return json(res, 404, { error: `Profile not found for agent ${agent}` });
                }
                const payload = JSON.parse(await readBody(req) || '{}') as Record<string, unknown>;
                const parsed = parseProfilePublishPayload(payload);
                if ('error' in parsed) {
                    return json(res, 400, { error: parsed.error });
                }
                const contentRef =
                    parsed.contentRef ??
                    `sha256:${sha256Hex(JSON.stringify(toProfileApi(current)))}`;
                const publishMode = parsed.publishMode ?? current.publishMode;
                const published = await profilePublisher.publish({
                    agent,
                    mode: publishMode,
                    contentRef,
                    profile: current,
                });
                const profile: AgentProfile = {
                    ...current,
                    onchainRef: published.onchainRef,
                    publishMode,
                    updatedAt: Date.now(),
                };
                store.getState().setAgentProfile(profile);
                return json(res, 200, {
                    ok: true,
                    onchain_tx: published.tx,
                    profile: toProfileApi(profile),
                });
            }

            // POST /webhooks/profile/git-sync
            if (method === 'POST' && path === '/webhooks/profile/git-sync') {
                const bodyText = await readBody(req);
                if (
                    profileSyncSigningSecret &&
                    !verifySignedPayload(
                        bodyText,
                        req.headers['x-gradience-signature-ts'],
                        req.headers['x-gradience-signature'],
                        profileSyncSigningSecret,
                        signatureMaxSkewSec,
                    )
                ) {
                    return json(res, 401, { error: 'Invalid profile sync signature' });
                }
                const payload = parseJsonObject(bodyText);
                if ('error' in payload) {
                    return json(res, 400, { error: payload.error });
                }
                const parsed = parseGitSyncWebhookPayload(payload);
                if ('error' in parsed) {
                    return json(res, 400, { error: parsed.error });
                }
                if (!isAllowedProfileSyncSource(parsed.source, profileSyncAllowedSources)) {
                    return json(res, 403, { error: 'Profile sync source is not allowed' });
                }
                if (
                    !isAllowedProfileSyncOrganization(
                        parsed.repository,
                        profileSyncAllowedOrganizations,
                    )
                ) {
                    return json(res, 403, { error: 'Profile sync organization is not allowed' });
                }
                const existing = store.getState().getAgentProfile(parsed.agent);
                const draftProfile: AgentProfile = {
                    agent: parsed.agent,
                    displayName: parsed.displayName,
                    bio: parsed.bio,
                    links: parsed.links,
                    onchainRef: existing?.onchainRef ?? null,
                    publishMode: 'git-sync',
                    updatedAt: Date.now(),
                };
                const contentRef =
                    parsed.contentRef ??
                    `sha256:${sha256Hex(JSON.stringify(toProfileApi(draftProfile)))}`;
                const published = await profilePublisher.publish({
                    agent: parsed.agent,
                    mode: 'git-sync',
                    contentRef,
                    profile: draftProfile,
                });
                const profile: AgentProfile = {
                    ...draftProfile,
                    onchainRef: published.onchainRef,
                    publishMode: 'git-sync',
                    updatedAt: Date.now(),
                };
                store.getState().setAgentProfile(profile);
                return json(res, 200, {
                    ok: true,
                    source: parsed.source,
                    repository: parsed.repository,
                    commit_sha: parsed.commitSha,
                    onchain_tx: published.tx,
                    profile: toProfileApi(profile),
                });
            }

            // GET /me
            if (method === 'GET' && path === '/me') {
                const session = requireBoundSession(store.getState().auth, authBindings);
                if ('error' in session) {
                    return json(res, 401, { error: session.error });
                }
                const reputation = await indexer.getReputation(session.publicKey);
                const interopStatus = store.getState().getInteropStatus(session.agentId);
                const identityRegistration = store
                    .getState()
                    .getIdentityRegistrationStatus(session.agentId);
                const profile = store.getState().getAgentProfile(session.agentId);
                return json(res, 200, {
                    agentId: session.agentId,
                    auth: {
                        publicKey: session.publicKey,
                        email: session.email,
                        privyUserId: session.privyUserId,
                    },
                    reputation,
                    interopStatus,
                    identityRegistration,
                    profile: profile ? toProfileApi(profile) : null,
                });
            }

            // GET /me/reputation
            if (method === 'GET' && path === '/me/reputation') {
                const session = requireBoundSession(store.getState().auth, authBindings);
                if ('error' in session) {
                    return json(res, 401, { error: session.error });
                }
                const reputation = await indexer.getReputation(session.publicKey);
                return json(res, 200, { publicKey: session.publicKey, reputation });
            }

            // GET /me/tasks?status=open&role=all|poster|participant&limit=20&offset=0&sort=task_id_desc
            if (method === 'GET' && path === '/me/tasks') {
                const session = requireBoundSession(store.getState().auth, authBindings);
                if ('error' in session) {
                    return json(res, 401, { error: session.error });
                }
                const pagination = parsePagination(url);
                if ('error' in pagination) {
                    return json(res, 400, { error: pagination.error });
                }
                const role = url.searchParams.get('role') ?? 'all';
                if (!['all', 'poster', 'participant'].includes(role)) {
                    return json(res, 400, { error: 'Invalid role: expected all|poster|participant' });
                }
                const sort = url.searchParams.get('sort') ?? 'task_id_desc';
                if (!['task_id_desc', 'task_id_asc'].includes(sort)) {
                    return json(res, 400, { error: 'Invalid sort: expected task_id_desc|task_id_asc' });
                }
                const parsedStatus = parseTaskStatus(url.searchParams.get('status'));
                if ('error' in parsedStatus) {
                    return json(res, 400, { error: parsedStatus.error });
                }
                const tasks = await getMeTasks(indexer, session.publicKey, {
                    role: role as 'all' | 'poster' | 'participant',
                    status: parsedStatus.status,
                    sort: sort as 'task_id_desc' | 'task_id_asc',
                    limit: pagination.limit,
                    offset: pagination.offset,
                });
                store.getState().trackTasks(tasks.items.map((item) => mapTaskToSummary(item.task)));
                return json(res, 200, tasks);
            }

            // GET /me/task-flow
            if (method === 'GET' && path === '/me/task-flow') {
                const session = requireBoundSession(store.getState().auth, authBindings);
                if ('error' in session) {
                    return json(res, 401, { error: session.error });
                }
                const history = store.getState().getTaskFlowHistory();
                return json(res, 200, { items: history });
            }

            const applyMatch = path.match(/^\/me\/tasks\/(\d+)\/apply$/);
            if (method === 'POST' && applyMatch && applyMatch[1]) {
                const session = requireBoundSession(store.getState().auth, authBindings);
                if ('error' in session) {
                    return json(res, 401, { error: session.error });
                }
                const taskId = Number.parseInt(applyMatch[1], 10);
                if (!Number.isFinite(taskId)) {
                    return json(res, 400, { error: 'Invalid task id' });
                }
                const task = await resolveTaskForMutation(indexer, store, taskId);
                if (!task) {
                    return json(res, 404, { error: `Task ${taskId} not found` });
                }
                if (task.state !== 'open') {
                    return json(res, 400, { error: 'Only open tasks can be applied' });
                }
                store.getState().applyToTask(task);
                return json(res, 200, { ok: true, taskId, status: 'applied' });
            }

            const submitMatch = path.match(/^\/me\/tasks\/(\d+)\/submit$/);
            if (method === 'POST' && submitMatch && submitMatch[1]) {
                const session = requireBoundSession(store.getState().auth, authBindings);
                if ('error' in session) {
                    return json(res, 401, { error: session.error });
                }
                const taskId = Number.parseInt(submitMatch[1], 10);
                if (!Number.isFinite(taskId)) {
                    return json(res, 400, { error: 'Invalid task id' });
                }
                const body = JSON.parse(await readBody(req) || '{}') as {
                    resultRef?: string;
                    traceRef?: string | null;
                };
                const resultRef = body.resultRef?.trim();
                if (!resultRef) {
                    return json(res, 400, { error: 'Missing required field: resultRef' });
                }
                const task = await resolveTaskForMutation(indexer, store, taskId);
                if (!task) {
                    return json(res, 404, { error: `Task ${taskId} not found` });
                }
                store.getState().submitTaskResult(taskId, resultRef, body.traceRef?.trim() || null);
                return json(res, 200, { ok: true, taskId, status: 'submitted' });
            }

            // GET /me/submissions?limit=20&offset=0&sort=submission_slot_desc
            if (method === 'GET' && path === '/me/submissions') {
                const session = requireBoundSession(store.getState().auth, authBindings);
                if ('error' in session) {
                    return json(res, 401, { error: session.error });
                }
                const pagination = parsePagination(url);
                if ('error' in pagination) {
                    return json(res, 400, { error: pagination.error });
                }
                const sort = url.searchParams.get('sort') ?? 'submission_slot_desc';
                if (!['submission_slot_desc', 'submission_slot_asc'].includes(sort)) {
                    return json(res, 400, { error: 'Invalid sort: expected submission_slot_desc|submission_slot_asc' });
                }
                const taskScanLimitRaw = url.searchParams.get('task_scan_limit');
                const taskScanLimit = taskScanLimitRaw ? Number.parseInt(taskScanLimitRaw, 10) : 50;
                if (!Number.isFinite(taskScanLimit) || taskScanLimit < 1 || taskScanLimit > 100) {
                    return json(res, 400, { error: 'Invalid task_scan_limit: expected 1..100' });
                }
                const submissions = await getMeSubmissions(indexer, session.publicKey, {
                    sort: sort as 'submission_slot_desc' | 'submission_slot_asc',
                    limit: pagination.limit,
                    offset: pagination.offset,
                    taskScanLimit,
                });
                return json(res, 200, submissions);
            }

            // GET /me/attestations?limit=20&offset=0
            if (method === 'GET' && path === '/me/attestations') {
                const session = requireBoundSession(store.getState().auth, authBindings);
                if ('error' in session) {
                    return json(res, 401, { error: session.error });
                }
                const pagination = parsePagination(url);
                if ('error' in pagination) {
                    return json(res, 400, { error: pagination.error });
                }
                const attestations = await getAttestations(
                    session.publicKey,
                    pagination.limit,
                    pagination.offset,
                );
                return json(res, 200, attestations);
            }

            // GET /status
            if (method === 'GET' && path === '/status') {
                return json(res, 200, {
                    version: '0.1.0',
                    authenticated: store.getState().auth.authenticated,
                    publicKey: store.getState().auth.publicKey,
                    a2aConnected: true,
                    uptime: process.uptime(),
                    authBindings: {
                        totalPrivyBindings: authBindings.byPrivyUserId.size,
                        totalWalletBindings: authBindings.byWallet.size,
                        rejectedDemoLoginTotal: authBindings.rejectedDemoLoginTotal,
                        rejectedSessionTotal: authBindings.rejectedSessionTotal,
                        demoLoginDisabledTotal: authBindings.demoLoginDisabledTotal,
                        lastError: authBindings.lastError,
                    },
                    webEntry: webEntry.getStatus(),
                });
            }

            // GET /identity/registration?agent=<address>
            if (method === 'GET' && path === '/identity/registration') {
                const agent = url.searchParams.get('agent');
                if (!agent) {
                    return json(res, 400, { error: 'Missing query param: agent' });
                }
                const registration = store.getState().getIdentityRegistrationStatus(agent);
                return json(res, 200, {
                    agent,
                    status:
                        registration ?? {
                            agent,
                            state: 'unknown',
                            agentId: null,
                            txHash: null,
                            error: null,
                            updatedAt: 0,
                        },
                });
            }

            // POST /interop/events (ingest signed events from judge-daemon)
            if (method === 'POST' && path === '/interop/events') {
                const bodyText = await readBody(req);
                if (
                    interopSigningSecret &&
                    !verifySignedPayload(
                        bodyText,
                        req.headers['x-gradience-signature-ts'],
                        req.headers['x-gradience-signature'],
                        interopSigningSecret,
                        signatureMaxSkewSec,
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
                    status: snapshot ?? createEmptyInteropStatusSnapshot(agent),
                });
            }

            // GET /interop/dashboard?agent=<address>
            if (method === 'GET' && path === '/interop/dashboard') {
                const agent = url.searchParams.get('agent');
                if (!agent) {
                    return html(res, 400, '<h1>Missing query param: agent</h1>');
                }
                const snapshot = store.getState().getInteropStatus(agent);
                const data = snapshot ?? createEmptyInteropStatusSnapshot(agent);
                return html(
                    res,
                    200,
                    renderInteropDashboard(agent, data),
                );
            }

            if (await webEntry.handleHttp(req, res, method, path, url)) {
                return;
            }

            json(res, 404, { error: 'Not found' });
        } catch (err) {
            json(res, 500, { error: err instanceof Error ? err.message : 'Internal error' });
        }
    });

    server.on('upgrade', (req, socket, head) => {
        if (webEntry.handleUpgrade(req, socket, head)) {
            return;
        }
        socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
        socket.destroy();
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
            webEntry.dispose();
            server.close(() => resolve());
        }),
        server,
    };
}

function requireBoundSession(auth: {
    authenticated: boolean;
    publicKey: string | null;
    email: string | null;
    privyUserId: string | null;
}, bindings: AuthBindingState) {
    if (!auth.authenticated) {
        bindings.rejectedSessionTotal += 1;
        bindings.lastError = 'Not authenticated';
        return { error: 'Not authenticated' } as const;
    }
    if (!auth.publicKey || !auth.privyUserId) {
        bindings.rejectedSessionTotal += 1;
        bindings.lastError = 'Session is not bound to both wallet and privy user';
        return { error: 'Session is not bound to both wallet and privy user' } as const;
    }
    const bindingError = registerAuthBinding(bindings, auth.publicKey, auth.privyUserId);
    if (bindingError) {
        bindings.rejectedSessionTotal += 1;
        bindings.lastError = bindingError;
        return { error: bindingError } as const;
    }
    return {
        agentId: auth.publicKey,
        publicKey: auth.publicKey,
        email: auth.email,
        privyUserId: auth.privyUserId,
    } as const;
}

function createAuthBindingState(): AuthBindingState {
    return {
        byPrivyUserId: new Map<string, string>(),
        byWallet: new Map<string, string>(),
        rejectedDemoLoginTotal: 0,
        rejectedSessionTotal: 0,
        demoLoginDisabledTotal: 0,
        lastError: null,
    };
}

function registerAuthBinding(
    state: AuthBindingState,
    wallet: string,
    privyUserId: string,
): string | null {
    const existingWallet = state.byPrivyUserId.get(privyUserId);
    if (existingWallet && existingWallet !== wallet) {
        return `Privy user ${privyUserId} is already bound to wallet ${existingWallet}`;
    }
    const existingPrivy = state.byWallet.get(wallet);
    if (existingPrivy && existingPrivy !== privyUserId) {
        return `Wallet ${wallet} is already bound to privy user ${existingPrivy}`;
    }
    state.byPrivyUserId.set(privyUserId, wallet);
    state.byWallet.set(wallet, privyUserId);
    return null;
}

interface AgentProfileApi {
    agent: string;
    display_name: string;
    bio: string;
    links: {
        website?: string;
        github?: string;
        x?: string;
    };
    onchain_ref: string | null;
    publish_mode: ProfilePublishMode;
    updated_at: number;
}

type ParseError = { error: string };

interface ParsedProfileUpsertPayload {
    displayName: string;
    bio: string;
    links: {
        website?: string;
        github?: string;
        x?: string;
    };
    publishMode: ProfilePublishMode | undefined;
}

interface ParsedProfilePublishPayload {
    publishMode: ProfilePublishMode | undefined;
    contentRef: string | null;
}

interface ParsedGitSyncWebhookPayload {
    source: string;
    repository: string | null;
    commitSha: string | null;
    contentRef: string | null;
    agent: string;
    displayName: string;
    bio: string;
    links: {
        website?: string;
        github?: string;
        x?: string;
    };
}

function toProfileApi(profile: AgentProfile): AgentProfileApi {
    return {
        agent: profile.agent,
        display_name: profile.displayName,
        bio: profile.bio,
        links: profile.links,
        onchain_ref: profile.onchainRef,
        publish_mode: profile.publishMode,
        updated_at: profile.updatedAt,
    };
}

function parseProfileUpsertPayload(
    payload: Record<string, unknown>,
): ParsedProfileUpsertPayload | ParseError {
    const displayNameRaw = typeof payload.display_name === 'string' ? payload.display_name.trim() : '';
    if (!displayNameRaw) {
        return { error: 'Missing required field: display_name' };
    }
    if (displayNameRaw.length > 64) {
        return { error: 'Invalid display_name: expected length <= 64' };
    }
    const bioRaw = typeof payload.bio === 'string' ? payload.bio.trim() : '';
    if (!bioRaw) {
        return { error: 'Missing required field: bio' };
    }
    if (bioRaw.length > 280) {
        return { error: 'Invalid bio: expected length <= 280' };
    }
    const links = parseProfileLinks(payload.links);
    if ('error' in links) {
        return links;
    }
    const publishMode = parseProfilePublishMode(payload.publish_mode);
    if (publishMode && typeof publishMode === 'object' && 'error' in publishMode) {
        return publishMode;
    }
    return {
        displayName: displayNameRaw,
        bio: bioRaw,
        links,
        publishMode,
    };
}

function parseProfilePublishPayload(
    payload: Record<string, unknown>,
): ParsedProfilePublishPayload | ParseError {
    const publishMode = parseProfilePublishMode(payload.publish_mode);
    if (publishMode && typeof publishMode === 'object' && 'error' in publishMode) {
        return publishMode;
    }
    if (typeof payload.content_ref !== 'undefined' && typeof payload.content_ref !== 'string') {
        return { error: 'Invalid content_ref: expected string' };
    }
    const contentRef = typeof payload.content_ref === 'string'
        ? payload.content_ref.trim()
        : null;
    if (contentRef !== null && contentRef.length === 0) {
        return { error: 'Invalid content_ref: expected non-empty string' };
    }
    return {
        publishMode,
        contentRef,
    };
}

function parseJsonObject(text: string): Record<string, unknown> | { error: string } {
    try {
        const parsed = JSON.parse(text) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return { error: 'Invalid payload: expected object' };
        }
        return parsed as Record<string, unknown>;
    } catch {
        return { error: 'Invalid JSON payload' };
    }
}

function parseGitSyncWebhookPayload(
    payload: Record<string, unknown>,
): ParsedGitSyncWebhookPayload | ParseError {
    const agentRaw = typeof payload.agent === 'string' ? payload.agent.trim() : '';
    if (!agentRaw) {
        return { error: 'Missing required field: agent' };
    }
    if (!payload.profile || typeof payload.profile !== 'object' || Array.isArray(payload.profile)) {
        return { error: 'Missing required field: profile' };
    }
    const profilePayload = payload.profile as Record<string, unknown>;
    const parsedProfile = parseProfileUpsertPayload({
        display_name: profilePayload.display_name,
        bio: profilePayload.bio,
        links: profilePayload.links,
        publish_mode: 'git-sync',
    });
    if ('error' in parsedProfile) {
        return parsedProfile;
    }
    if (typeof payload.content_ref !== 'undefined' && typeof payload.content_ref !== 'string') {
        return { error: 'Invalid content_ref: expected string' };
    }
    const contentRef =
        typeof payload.content_ref === 'string' ? payload.content_ref.trim() : null;
    if (contentRef !== null && contentRef.length === 0) {
        return { error: 'Invalid content_ref: expected non-empty string' };
    }
    const source = typeof payload.source === 'string' && payload.source.trim().length > 0
        ? payload.source.trim()
        : 'git';
    const repository = typeof payload.repository === 'string' && payload.repository.trim().length > 0
        ? payload.repository.trim()
        : null;
    const commitSha = typeof payload.commit_sha === 'string' && payload.commit_sha.trim().length > 0
        ? payload.commit_sha.trim()
        : null;
    return {
        source,
        repository,
        commitSha,
        contentRef,
        agent: agentRaw,
        displayName: parsedProfile.displayName,
        bio: parsedProfile.bio,
        links: parsedProfile.links,
    };
}

function parseProfilePublishMode(
    publishMode: unknown,
): ProfilePublishMode | { error: string } | undefined {
    if (typeof publishMode === 'undefined') {
        return undefined;
    }
    if (publishMode === 'manual' || publishMode === 'git-sync') {
        return publishMode;
    }
    return { error: 'Invalid publish_mode: expected manual|git-sync' };
}

function parseProfileLinks(input: unknown): { website?: string; github?: string; x?: string } | { error: string } {
    if (typeof input === 'undefined' || input === null) {
        return {};
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return { error: 'Invalid links: expected object' };
    }
    const raw = input as Record<string, unknown>;
    const website = normalizeProfileLink(raw.website, 'website');
    if ('error' in website) return website;
    const github = normalizeProfileLink(raw.github, 'github');
    if ('error' in github) return github;
    const x = normalizeProfileLink(raw.x, 'x');
    if ('error' in x) return x;
    return {
        ...(website.value ? { website: website.value } : {}),
        ...(github.value ? { github: github.value } : {}),
        ...(x.value ? { x: x.value } : {}),
    };
}

function normalizeProfileLink(
    value: unknown,
    field: 'website' | 'github' | 'x',
): { value: string | null } | { error: string } {
    if (typeof value === 'undefined' || value === null) {
        return { value: null };
    }
    if (typeof value !== 'string') {
        return { error: `Invalid ${field}: expected string URL` };
    }
    const normalized = value.trim();
    if (!normalized) {
        return { value: null };
    }
    if (!isHttpUrl(normalized)) {
        return { error: `Invalid ${field}: expected http(s) URL` };
    }
    return { value: normalized };
}

function isHttpUrl(value: string): boolean {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function createLocalProfilePublisher(): AgentProfilePublisher {
    return {
        publish: async (input) => {
            const onchainRef = input.contentRef;
            const tx = `sim-${sha256Hex(`${input.agent}:${input.mode}:${onchainRef}:${Date.now()}`).slice(0, 16)}`;
            return { onchainRef, tx };
        },
    };
}

function sha256Hex(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

function parsePagination(url: URL) {
    const limit = Number.parseInt(url.searchParams.get('limit') ?? '20', 10);
    const offset = Number.parseInt(url.searchParams.get('offset') ?? '0', 10);
    if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
        return { error: 'Invalid limit: expected 1..100' } as const;
    }
    if (!Number.isFinite(offset) || offset < 0) {
        return { error: 'Invalid offset: expected >= 0' } as const;
    }
    return { limit, offset } as const;
}

function parseTaskStatus(
    value: string | null,
): { status?: 'open' | 'completed' | 'refunded' } | { error: string } {
    if (value === null || value === '') {
        return { status: undefined };
    }
    if (value === 'open' || value === 'completed' || value === 'refunded') {
        return { status: value };
    }
    return { error: 'Invalid status: expected open|completed|refunded' };
}

async function getMeTasks(
    indexer: Pick<IndexerClient, 'getTasks' | 'getTaskSubmissions'>,
    agent: string,
    options: {
        role: 'all' | 'poster' | 'participant';
        status?: 'open' | 'completed' | 'refunded';
        sort: 'task_id_desc' | 'task_id_asc';
        limit: number;
        offset: number;
    },
) {
    const { role, status, sort, limit, offset } = options;

    const postedTasksPromise = role === 'participant'
        ? Promise.resolve([] as TaskApi[])
        : indexer.getTasks({ status, poster: agent, limit: 100, offset: 0 });
    const candidateTasksPromise = role === 'poster'
        ? Promise.resolve([] as TaskApi[])
        : indexer.getTasks({ status, limit: 100, offset: 0 });

    const [postedTasks, candidateTasks] = await Promise.all([postedTasksPromise, candidateTasksPromise]);

    const postedIds = new Set(postedTasks.map((task) => task.task_id));
    const participationRecords = role === 'poster'
        ? new Map<number, SubmissionApi>()
        : await getLatestSubmissionByTask(indexer, candidateTasks, agent);

    const combined = new Map<number, {
        task: TaskApi;
        role: 'poster' | 'participant' | 'both';
        latestSubmission: SubmissionApi | null;
    }>();

    for (const task of postedTasks) {
        combined.set(task.task_id, {
            task,
            role: 'poster',
            latestSubmission: participationRecords.get(task.task_id) ?? null,
        });
    }

    for (const task of candidateTasks) {
        const latestSubmission = participationRecords.get(task.task_id);
        if (!latestSubmission) continue;
        const existing = combined.get(task.task_id);
        if (existing) {
            combined.set(task.task_id, {
                task: existing.task,
                role: 'both',
                latestSubmission,
            });
            continue;
        }
        combined.set(task.task_id, {
            task,
            role: postedIds.has(task.task_id) ? 'both' : 'participant',
            latestSubmission,
        });
    }

    const rows = Array.from(combined.values())
        .filter((row) => {
            if (role === 'all') return true;
            if (role === 'participant') return row.role === 'participant' || row.role === 'both';
            if (role === 'poster') return row.role === 'poster' || row.role === 'both';
            return false;
        })
        .sort((a, b) => (sort === 'task_id_desc' ? b.task.task_id - a.task.task_id : a.task.task_id - b.task.task_id));

    const items = rows.slice(offset, offset + limit).map((row) => ({
        task: row.task,
        role: row.role,
        latestSubmission: row.latestSubmission
            ? {
                agent: row.latestSubmission.agent,
                result_ref: row.latestSubmission.result_ref,
                trace_ref: row.latestSubmission.trace_ref,
                submission_slot: row.latestSubmission.submission_slot,
                submitted_at: row.latestSubmission.submitted_at,
            }
            : null,
    }));

    return {
        items,
        total: rows.length,
        limit,
        offset,
        hasMore: offset + items.length < rows.length,
    };
}

async function getMeSubmissions(
    indexer: Pick<IndexerClient, 'getTasks' | 'getTaskSubmissions'>,
    agent: string,
    options: {
        sort: 'submission_slot_desc' | 'submission_slot_asc';
        limit: number;
        offset: number;
        taskScanLimit: number;
    },
) {
    const tasks = await indexer.getTasks({ limit: options.taskScanLimit, offset: 0 });
    const records: Array<{
        taskId: number;
        taskState: string;
        taskPoster: string;
        submission: SubmissionApi;
    }> = [];

    for (const task of tasks) {
        const submissions = await indexer.getTaskSubmissions(task.task_id, { sort: 'slot' });
        for (const submission of submissions) {
            if (submission.agent !== agent) continue;
            records.push({
                taskId: task.task_id,
                taskState: task.state,
                taskPoster: task.poster,
                submission,
            });
        }
    }

    records.sort((a, b) =>
        options.sort === 'submission_slot_desc'
            ? b.submission.submission_slot - a.submission.submission_slot
            : a.submission.submission_slot - b.submission.submission_slot,
    );

    const items = records.slice(options.offset, options.offset + options.limit).map((entry) => ({
        task_id: entry.taskId,
        task_state: entry.taskState,
        poster: entry.taskPoster,
        submission: {
            result_ref: entry.submission.result_ref,
            trace_ref: entry.submission.trace_ref,
            submission_slot: entry.submission.submission_slot,
            submitted_at: entry.submission.submitted_at,
        },
    }));

    return {
        items,
        total: records.length,
        limit: options.limit,
        offset: options.offset,
        hasMore: options.offset + items.length < records.length,
    };
}

async function getLatestSubmissionByTask(
    indexer: Pick<IndexerClient, 'getTaskSubmissions'>,
    tasks: TaskApi[],
    agent: string,
) {
    const latestByTask = new Map<number, SubmissionApi>();
    for (const task of tasks) {
        const submissions = await indexer.getTaskSubmissions(task.task_id, { sort: 'slot' });
        const latestForAgent = submissions
            .filter((item) => item.agent === agent)
            .reduce<SubmissionApi | null>((latest, current) => {
                if (!latest || current.submission_slot > latest.submission_slot) {
                    return current;
                }
                return latest;
            }, null);
        if (latestForAgent) {
            latestByTask.set(task.task_id, latestForAgent);
        }
    }
    return latestByTask;
}

function mapTaskToSummary(task: TaskApi): ArenaTaskSummary {
    return {
        taskId: task.task_id,
        poster: task.poster,
        judge: task.judge,
        reward: task.reward,
        state: task.state,
        category: task.category,
        deadline: task.deadline,
        submissionCount: task.submission_count,
        winner: task.winner,
    };
}

async function resolveTaskForMutation(
    indexer: Pick<IndexerClient, 'getTaskById'>,
    store: ApiServerDeps['store'],
    taskId: number,
): Promise<ArenaTaskSummary | null> {
    const tracked = store.getState().trackedTasks.get(taskId);
    if (tracked) return tracked;
    const task = await indexer.getTaskById(taskId);
    if (!task) return null;
    const summary = mapTaskToSummary(task);
    store.getState().trackTasks([summary]);
    return summary;
}

function createEmptyInteropStatusSnapshot(agent: string) {
    return {
        agent,
        identityRegistered: false,
        erc8004FeedbackCount: 0,
        evmReputationCount: 0,
        istranaFeedbackCount: 0,
        attestationCount: 0,
        identityRoleCounts: {
            winner: 0,
            poster: 0,
            judge: 0,
            loser: 0,
        },
        feedbackRoleCounts: {
            winner: 0,
            poster: 0,
            judge: 0,
            loser: 0,
        },
        lastTaskId: null,
        lastScore: null,
        lastChainTx: null,
        updatedAt: 0,
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
        identityRoleCounts: {
            winner: number;
            poster: number;
            judge: number;
            loser: number;
        };
        feedbackRoleCounts: {
            winner: number;
            poster: number;
            judge: number;
            loser: number;
        };
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
      <li><strong>Identity Roles:</strong> winner=${data.identityRoleCounts.winner}, poster=${data.identityRoleCounts.poster}, judge=${data.identityRoleCounts.judge}, loser=${data.identityRoleCounts.loser}</li>
      <li><strong>Feedback Roles:</strong> winner=${data.feedbackRoleCounts.winner}, poster=${data.feedbackRoleCounts.poster}, judge=${data.feedbackRoleCounts.judge}, loser=${data.feedbackRoleCounts.loser}</li>
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
    const feedbackRecipientsValid =
        typeof event.feedbackRecipients === 'undefined' ||
        (Array.isArray(event.feedbackRecipients) &&
            event.feedbackRecipients.every(
                (entry) =>
                    !!entry &&
                    typeof entry === 'object' &&
                    (entry as { sink?: unknown }).sink !== undefined &&
                    typeof (entry as { sink?: unknown }).sink === 'string' &&
                    typeof (entry as { role?: unknown }).role === 'string' &&
                    typeof (entry as { agent?: unknown }).agent === 'string',
            ));
    const identityRecipientsValid =
        typeof event.identityRecipients === 'undefined' ||
        (Array.isArray(event.identityRecipients) &&
            event.identityRecipients.every((item) => typeof item === 'string'));
    const identityDispatchesValid =
        typeof event.identityDispatches === 'undefined' ||
        (Array.isArray(event.identityDispatches) &&
            event.identityDispatches.every(
                (entry) =>
                    !!entry &&
                    typeof entry === 'object' &&
                    typeof (entry as { role?: unknown }).role === 'string' &&
                    typeof (entry as { agent?: unknown }).agent === 'string',
            ));
    const participantsValid =
        typeof event.participants === 'undefined' ||
        (Array.isArray(event.participants) &&
            event.participants.every((item) => typeof item === 'string'));
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
        typeof event.attestationPublished === 'boolean' &&
        (typeof event.feedbackPublishedCount === 'undefined' ||
            typeof event.feedbackPublishedCount === 'number') &&
        feedbackRecipientsValid &&
        identityRecipientsValid &&
        identityDispatchesValid &&
        participantsValid
    );
}

function verifySignedPayload(
    body: string,
    timestampHeader: string | string[] | undefined,
    signatureHeader: string | string[] | undefined,
    secret: string,
    maxSkewSec: number,
): boolean {
    const timestamp = Array.isArray(timestampHeader) ? timestampHeader[0] : timestampHeader;
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!timestamp || !signature) return false;
    const ts = Number.parseInt(timestamp, 10);
    if (!Number.isFinite(ts)) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - ts) > maxSkewSec) return false;
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

export interface AttestationSummary {
    taskId: number;
    score: number;
    category: number;
    completedAt: number;
    credential: string;
    schema: string;
}

async function getAttestations(
    agent: string,
    limit: number,
    offset: number,
): Promise<{ attestations: AttestationSummary[]; total: number }> {
    const baseUrl = process.env.VITE_INDEXER_BASE_URL ?? 'http://127.0.0.1:3001';
    const path = `/api/agents/${encodeURIComponent(agent)}/attestations`;
    try {
        const response = await fetch(`${baseUrl}${path}`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
            return { attestations: [], total: 0 };
        }
        const raw: Array<{
            task_id: number;
            score: number;
            task_category: number;
            completed_at: number;
            credential: string;
            schema: string;
        }> = await response.json();
        const all: AttestationSummary[] = raw.map((r) => ({
            taskId: r.task_id,
            score: r.score,
            category: r.task_category,
            completedAt: r.completed_at,
            credential: r.credential,
            schema: r.schema,
        }));
        return {
            attestations: all.slice(offset, offset + limit),
            total: all.length,
        };
    } catch {
        return { attestations: [], total: 0 };
    }
}
