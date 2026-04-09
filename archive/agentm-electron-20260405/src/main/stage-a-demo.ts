import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import type { AgentDiscoveryRow, InteropSyncEvent } from '../shared/types.ts';
import { createApiServer } from './api-server.ts';
import { createAppStore } from '../renderer/lib/store.ts';
import { InMemoryMagicBlockHub, InMemoryMagicBlockTransport, MagicBlockA2AAgent } from '../renderer/lib/a2a-client.ts';

export interface StageADemoStep {
    name: string;
    command: string;
    expected: string;
    actual: string;
}

export interface StageADemoResult {
    apiBaseUrl: string;
    steps: StageADemoStep[];
}

const DEFAULT_DISCOVERY_ROWS: AgentDiscoveryRow[] = [
    {
        agent: 'Alice_DeFi_Oracle',
        weight: 1500,
        reputation: {
            global_avg_score: 92.5,
            global_completed: 47,
            global_total_applied: 50,
            win_rate: 0.94,
        },
    },
    {
        agent: 'Bob_Code_Auditor',
        weight: 800,
        reputation: {
            global_avg_score: 85,
            global_completed: 23,
            global_total_applied: 28,
            win_rate: 0.82,
        },
    },
    {
        agent: 'Charlie_DataSci',
        weight: 600,
        reputation: {
            global_avg_score: 78,
            global_completed: 12,
            global_total_applied: 15,
            win_rate: 0.8,
        },
    },
];

export async function runStageADemo(env: NodeJS.ProcessEnv = process.env): Promise<StageADemoResult> {
    const store = createAppStore();
    store.getState().setDiscoveryRows(DEFAULT_DISCOVERY_ROWS);

    const demoAgent = env.AGENT_IM_DEMO_AGENT ?? 'StageADemoAgent11111111111111111111111111111';
    const interopSigningSecret = env.AGENT_IM_INTEROP_SIGNING_SECRET;
    const indexerBaseUrl = env.AGENT_IM_DEMO_INDEXER_BASE_URL ?? 'http://127.0.0.1:3001';
    const requireIndexer = env.AGENT_IM_DEMO_REQUIRE_INDEXER !== '0';

    const hub = new InMemoryMagicBlockHub({ latencyMs: 5 });
    const transport = new InMemoryMagicBlockTransport(hub);
    const a2aAgent = new MagicBlockA2AAgent('demo-controller', transport);
    a2aAgent.start();

    const api = createApiServer({ store, a2aAgent }, { port: 0, interopSigningSecret });
    const apiPort = await api.start();
    const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
    const steps: StageADemoStep[] = [];

    try {
        const authRes = await postJson(apiBaseUrl, '/auth/demo-login', {
            publicKey: demoAgent,
            email: 'demo@agent.im',
            privyUserId: 'stage-a-demo-user',
        });
        assert.equal(authRes.status, 200);
        const authBody = authRes.json as { ok: boolean; auth: { authenticated: boolean; publicKey: string } };
        assert.equal(authBody.ok, true);
        assert.equal(authBody.auth.authenticated, true);
        assert.equal(authBody.auth.publicKey, demoAgent);
        steps.push({
            name: 'Login',
            command: `curl -s -X POST "${apiBaseUrl}/auth/demo-login" -H "content-type: application/json" -d '{"publicKey":"${demoAgent}","email":"demo@agent.im","privyUserId":"stage-a-demo-user"}'`,
            expected: 'HTTP 200, auth.authenticated=true, auth.publicKey=<demoAgent>',
            actual: `HTTP ${authRes.status}, authenticated=${String(authBody.auth.authenticated)}, publicKey=${authBody.auth.publicKey}`,
        });

        const discoverRes = await getJson(apiBaseUrl, '/discover/agents');
        assert.equal(discoverRes.status, 200);
        const discoverBody = discoverRes.json as { agents: AgentDiscoveryRow[] };
        assert.ok(Array.isArray(discoverBody.agents));
        assert.ok(discoverBody.agents.length > 0);
        steps.push({
            name: 'Discover',
            command: `curl -s "${apiBaseUrl}/discover/agents"`,
            expected: 'HTTP 200, agents.length > 0',
            actual: `HTTP ${discoverRes.status}, agents=${discoverBody.agents.length}`,
        });

        const meRes = await getJson(apiBaseUrl, '/me/reputation');
        assert.equal(meRes.status, 200);
        const meBody = meRes.json as { publicKey: string | null };
        assert.equal(meBody.publicKey, demoAgent);
        steps.push({
            name: 'Reputation (session)',
            command: `curl -s "${apiBaseUrl}/me/reputation"`,
            expected: 'HTTP 200, publicKey equals logged-in agent',
            actual: `HTTP ${meRes.status}, publicKey=${meBody.publicKey}`,
        });

        const interopEvent: InteropSyncEvent = {
            type: 'interop_sync',
            winner: demoAgent,
            taskId: 7001,
            score: 88,
            category: 1,
            chainTx: `stage-a-demo-${Date.now()}`,
            judgedAt: Math.floor(Date.now() / 1000),
            identityRegistered: true,
            feedbackTargets: ['erc8004_feedback', 'istrana_feedback', 'evm_reputation'],
            erc8004FeedbackPublished: true,
            evmReputationPublished: true,
            istranaFeedbackPublished: true,
            attestationPublished: true,
        };
        const interopPayload = JSON.stringify(interopEvent);
        const interopHeaders = buildInteropHeaders(interopPayload, interopSigningSecret);
        const interopRes = await postRaw(apiBaseUrl, '/interop/events', interopPayload, interopHeaders);
        assert.equal(interopRes.status, 200);
        steps.push({
            name: 'Interop ingest',
            command: `curl -s -X POST "${apiBaseUrl}/interop/events" -H "content-type: application/json" -d '${interopPayload}'`,
            expected: 'HTTP 200, interoperability snapshot updated',
            actual: `HTTP ${interopRes.status}`,
        });

        const interopStatusRes = await getJson(apiBaseUrl, `/interop/status?agent=${encodeURIComponent(demoAgent)}`);
        assert.equal(interopStatusRes.status, 200);
        const interopStatusBody = interopStatusRes.json as {
            status: { evmReputationCount: number; erc8004FeedbackCount: number; identityRegistered: boolean };
        };
        assert.equal(interopStatusBody.status.identityRegistered, true);
        assert.ok(interopStatusBody.status.evmReputationCount >= 1);
        assert.ok(interopStatusBody.status.erc8004FeedbackCount >= 1);
        steps.push({
            name: 'Interop status',
            command: `curl -s "${apiBaseUrl}/interop/status?agent=${encodeURIComponent(demoAgent)}"`,
            expected: 'HTTP 200, identityRegistered=true, evmReputationCount>=1',
            actual: `HTTP ${interopStatusRes.status}, identityRegistered=${String(
                interopStatusBody.status.identityRegistered,
            )}, evmReputationCount=${interopStatusBody.status.evmReputationCount}`,
        });

        const dashboardRes = await getText(apiBaseUrl, `/interop/dashboard?agent=${encodeURIComponent(demoAgent)}`);
        assert.equal(dashboardRes.status, 200);
        assert.ok(dashboardRes.text.includes('AgentM Interop Dashboard'));
        steps.push({
            name: 'Interop dashboard',
            command: `curl -s "${apiBaseUrl}/interop/dashboard?agent=${encodeURIComponent(demoAgent)}"`,
            expected: 'HTTP 200, HTML contains "AgentM Interop Dashboard"',
            actual: `HTTP ${dashboardRes.status}, containsDashboardTitle=${String(
                dashboardRes.text.includes('AgentM Interop Dashboard'),
            )}`,
        });

        const indexerStep = await validateIndexerTaskAndReputation(indexerBaseUrl, demoAgent);
        steps.push(indexerStep);
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('indexer:') && !requireIndexer) {
            steps.push({
                name: 'Task/Reputation (Indexer)',
                command: `curl -s "${indexerBaseUrl}/api/tasks?limit=3"`,
                expected: 'HTTP 200 from indexer (optional when AGENT_IM_DEMO_REQUIRE_INDEXER=0)',
                actual: `SKIPPED (${error.message})`,
            });
        } else {
            throw error;
        }
    } finally {
        await api.stop();
    }

    return { apiBaseUrl, steps };
}

async function validateIndexerTaskAndReputation(
    indexerBaseUrl: string,
    fallbackAgent: string,
): Promise<StageADemoStep> {
    const tasksRes = await fetch(`${indexerBaseUrl}/api/tasks?limit=3`, {
        signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (!tasksRes || !tasksRes.ok) {
        throw new Error(`indexer: unavailable at ${indexerBaseUrl}`);
    }
    const tasks = (await tasksRes.json()) as Array<{ judge?: string }>;
    const agent = tasks.find((task) => typeof task.judge === 'string')?.judge ?? fallbackAgent;

    const reputationRes = await fetch(`${indexerBaseUrl}/api/reputation/${encodeURIComponent(agent)}`, {
        signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (!reputationRes || !reputationRes.ok) {
        throw new Error(`indexer: reputation endpoint unavailable for ${agent}`);
    }

    const reputation = (await reputationRes.json()) as { global_avg_score?: number };
    return {
        name: 'Task/Reputation (Indexer)',
        command: `curl -s "${indexerBaseUrl}/api/tasks?limit=3" && curl -s "${indexerBaseUrl}/api/reputation/${agent}"`,
        expected: 'HTTP 200 for tasks and reputation endpoints',
        actual: `tasks=${tasks.length}, reputation.global_avg_score=${String(reputation.global_avg_score ?? 'N/A')}`,
    };
}

function buildInteropHeaders(payload: string, secret: string | undefined): Record<string, string> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (!secret) return headers;
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', secret).update(`${ts}.${payload}`).digest('hex');
    headers['x-gradience-signature-ts'] = ts;
    headers['x-gradience-signature'] = signature;
    return headers;
}

async function postJson(apiBaseUrl: string, path: string, body: unknown): Promise<{ status: number; json: unknown }> {
    return postRaw(apiBaseUrl, path, JSON.stringify(body), { 'content-type': 'application/json' });
}

async function postRaw(
    apiBaseUrl: string,
    path: string,
    rawBody: string,
    headers: Record<string, string>,
): Promise<{ status: number; json: unknown }> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
        method: 'POST',
        headers,
        body: rawBody,
    });
    return { status: response.status, json: await response.json() };
}

async function getJson(apiBaseUrl: string, path: string): Promise<{ status: number; json: unknown }> {
    const response = await fetch(`${apiBaseUrl}${path}`);
    return { status: response.status, json: await response.json() };
}

async function getText(apiBaseUrl: string, path: string): Promise<{ status: number; text: string }> {
    const response = await fetch(`${apiBaseUrl}${path}`);
    return { status: response.status, text: await response.text() };
}

const isMainEntry = typeof process.argv[1] === 'string' && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainEntry) {
    runStageADemo(process.env)
        .then((result) => {
            process.stdout.write(`Stage A demo passed (api=${result.apiBaseUrl})\n`);
            for (const [index, step] of result.steps.entries()) {
                process.stdout.write(
                    `${index + 1}. ${step.name}\n   command: ${step.command}\n   expected: ${step.expected}\n   actual: ${step.actual}\n`,
                );
            }
        })
        .catch((error) => {
            process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
            process.exit(1);
        });
}
