import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { buildInteropPublisherFromEnv, type ReputationInteropSignal } from '../judge-daemon/src/interop.js';

type InteropRole = 'winner' | 'poster' | 'judge' | 'loser';

interface FeedbackDispatchExpectation {
    role: InteropRole;
    agent: string;
}

interface AgentInteropStatus {
    identityRegistered?: boolean;
    erc8004FeedbackCount?: number;
    evmReputationCount?: number;
    istranaFeedbackCount?: number;
}

export interface InteropDrillResult {
    agent: string;
    taskId: number;
    participants: string[];
    identityRecipients: string[];
    feedbackDispatches: FeedbackDispatchExpectation[];
    relayStatus: {
        success: number;
        failed: number;
    };
    erc8004Status: {
        identitySuccess: number;
        feedbackSuccess: number;
        knownAgents: number;
    } | null;
    agentImStatusByAgent: Record<string, AgentInteropStatus>;
}

function requireEnv(name: string, env: NodeJS.ProcessEnv): string {
    const value = env[name];
    if (!value) {
        throw new Error(`${name} is required`);
    }
    return value;
}

function inferStatusEndpoint(endpoint: string, suffix: string, replacement: string): string {
    return endpoint.endsWith(suffix) ? `${endpoint.slice(0, -suffix.length)}${replacement}` : endpoint;
}

async function fetchJson(url: string): Promise<unknown> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`request failed ${response.status} ${url}`);
    }
    return response.json();
}

export async function runInteropDrill(env: NodeJS.ProcessEnv = process.env): Promise<InteropDrillResult> {
    requireEnv('JUDGE_DAEMON_EVM_REPUTATION_RELAY_ENDPOINT', env);
    requireEnv('JUDGE_DAEMON_AGENT_IM_INTEROP_ENDPOINT', env);

    const publisher = buildInteropPublisherFromEnv(env, {
        retryPolicy: { maxAttempts: 2, baseDelayMs: 200 },
        logger: console,
    });
    if (!publisher) {
        throw new Error('interop publisher is not configured');
    }

    const agent = env.DRILL_AGENT ?? '11111111111111111111111111111111';
    const poster = env.DRILL_POSTER ?? '22222222222222222222222222222222';
    const judge = env.DRILL_JUDGE ?? '33333333333333333333333333333333';
    const participants = resolveParticipants(agent, env);
    const signal: ReputationInteropSignal = {
        taskId: Number(env.DRILL_TASK_ID ?? 999001),
        category: Number(env.DRILL_CATEGORY ?? 1),
        winner: agent,
        poster,
        judge,
        score: Number(env.DRILL_SCORE ?? 85),
        reward: Number(env.DRILL_REWARD ?? 1_000_000),
        reasonRef: env.DRILL_REASON_REF ?? 'cid://drill-reason',
        chainTx: env.DRILL_CHAIN_TX ?? `drill-${Date.now()}`,
        judgedAt: Math.floor(Date.now() / 1000),
        judgeMode: env.DRILL_JUDGE_MODE ?? 'designated',
        participants,
    };
    const identityRecipients = uniqueAgents([
        signal.winner,
        signal.poster,
        signal.judge,
        ...participants.filter(participant => participant !== signal.winner),
    ]);
    const feedbackDispatches = buildFeedbackDispatches(signal);

    await publisher.onTaskJudged(signal);

    if (publisher.flushOutbox) {
        const drained = await publisher.flushOutbox();
        if (drained.remaining > 0) {
            throw new Error(`interop outbox still has remaining entries: ${drained.remaining}`);
        }
    }

    const evmRelayEndpoint = requireEnv('JUDGE_DAEMON_EVM_REPUTATION_RELAY_ENDPOINT', env);
    const relayStatusEndpoint =
        env.EVM_RELAY_STATUS_ENDPOINT ?? inferStatusEndpoint(evmRelayEndpoint, '/relay/submit-reputation', '/status');
    const relayStatus = (await fetchJson(relayStatusEndpoint)) as {
        success?: number;
        failed?: number;
    };
    const expectedRelaySuccess = feedbackDispatches.length;
    if ((relayStatus.success ?? 0) < expectedRelaySuccess) {
        throw new Error(`relay success counter not incremented: ${JSON.stringify(relayStatus)}`);
    }

    const erc8004FeedbackEndpoint = env.JUDGE_DAEMON_ERC8004_FEEDBACK_ENDPOINT;
    const erc8004IdentityEndpoint = env.JUDGE_DAEMON_ERC8004_IDENTITY_ENDPOINT;
    const istranaEndpoint = env.JUDGE_DAEMON_ISTRANA_FEEDBACK_ENDPOINT;
    let erc8004StatusSummary: InteropDrillResult['erc8004Status'] = null;
    if (erc8004FeedbackEndpoint || erc8004IdentityEndpoint) {
        const erc8004StatusEndpoint =
            env.ERC8004_RELAY_STATUS_ENDPOINT ??
            inferStatusEndpoint(
                erc8004FeedbackEndpoint ?? erc8004IdentityEndpoint ?? '',
                '/relay/erc8004/give-feedback',
                '/status',
            );
        const erc8004Status = (await fetchJson(erc8004StatusEndpoint)) as {
            erc8004?: {
                identity?: { success?: number; failed?: number };
                feedback?: { success?: number; failed?: number };
                knownAgents?: number;
            };
        };
        const expectedIdentitySuccess = erc8004IdentityEndpoint ? identityRecipients.length : 0;
        const expectedFeedbackSuccess = erc8004FeedbackEndpoint ? feedbackDispatches.length : 0;
        if (erc8004IdentityEndpoint && (erc8004Status.erc8004?.identity?.success ?? 0) < expectedIdentitySuccess) {
            throw new Error(`erc8004 identity success counter not incremented: ${JSON.stringify(erc8004Status)}`);
        }
        if (erc8004FeedbackEndpoint && (erc8004Status.erc8004?.feedback?.success ?? 0) < expectedFeedbackSuccess) {
            throw new Error(`erc8004 feedback success counter not incremented: ${JSON.stringify(erc8004Status)}`);
        }
        if (erc8004IdentityEndpoint && (erc8004Status.erc8004?.knownAgents ?? 0) < identityRecipients.length) {
            throw new Error(`erc8004 knownAgents below expected recipients: ${JSON.stringify(erc8004Status)}`);
        }
        erc8004StatusSummary = {
            identitySuccess: erc8004Status.erc8004?.identity?.success ?? 0,
            feedbackSuccess: erc8004Status.erc8004?.feedback?.success ?? 0,
            knownAgents: erc8004Status.erc8004?.knownAgents ?? 0,
        };
    }

    const agentImEventsEndpoint = requireEnv('JUDGE_DAEMON_AGENT_IM_INTEROP_ENDPOINT', env);
    const agentImStatusBase =
        env.AGENT_IM_INTEROP_STATUS_ENDPOINT ??
        inferStatusEndpoint(agentImEventsEndpoint, '/interop/events', '/interop/status');
    const agentImStatusByAgent: Record<string, AgentInteropStatus> = {};
    const agentsToAudit = uniqueAgents([...identityRecipients, ...feedbackDispatches.map(dispatch => dispatch.agent)]);
    for (const targetAgent of agentsToAudit) {
        const status = await fetchAgentImStatus(agentImStatusBase, targetAgent);
        agentImStatusByAgent[targetAgent] = status;
        const expectedIdentity = !!erc8004IdentityEndpoint && identityRecipients.includes(targetAgent);
        const expectedErc8004 = erc8004FeedbackEndpoint ? countFeedbackDispatches(feedbackDispatches, targetAgent) : 0;
        const expectedEvm = countFeedbackDispatches(feedbackDispatches, targetAgent);
        const expectedIstrana = istranaEndpoint ? countFeedbackDispatches(feedbackDispatches, targetAgent) : 0;
        if (expectedIdentity && !status.identityRegistered) {
            throw new Error(`agent-im identity status not updated for ${targetAgent}: ${JSON.stringify(status)}`);
        }
        if ((status.erc8004FeedbackCount ?? 0) < expectedErc8004) {
            throw new Error(
                `agent-im erc8004FeedbackCount too low for ${targetAgent}: expected>=${expectedErc8004}, got=${status.erc8004FeedbackCount ?? 0}`,
            );
        }
        if ((status.evmReputationCount ?? 0) < expectedEvm) {
            throw new Error(
                `agent-im evmReputationCount too low for ${targetAgent}: expected>=${expectedEvm}, got=${status.evmReputationCount ?? 0}`,
            );
        }
        if ((status.istranaFeedbackCount ?? 0) < expectedIstrana) {
            throw new Error(
                `agent-im istranaFeedbackCount too low for ${targetAgent}: expected>=${expectedIstrana}, got=${status.istranaFeedbackCount ?? 0}`,
            );
        }
    }

    return {
        agent,
        taskId: signal.taskId,
        participants,
        identityRecipients,
        feedbackDispatches,
        relayStatus: {
            success: relayStatus.success ?? 0,
            failed: relayStatus.failed ?? 0,
        },
        erc8004Status: erc8004StatusSummary,
        agentImStatusByAgent,
    };
}

async function fetchAgentImStatus(statusEndpoint: string, agent: string): Promise<AgentInteropStatus> {
    const statusUrl = new URL(statusEndpoint);
    statusUrl.searchParams.set('agent', agent);
    const payload = (await fetchJson(statusUrl.toString())) as {
        status?: AgentInteropStatus;
    };
    return payload.status ?? {};
}

function resolveParticipants(winner: string, env: NodeJS.ProcessEnv): string[] {
    const explicitParticipants = parseCsvList(env.DRILL_PARTICIPANTS);
    if (explicitParticipants.length > 0) {
        return uniqueAgents([winner, ...explicitParticipants]);
    }
    const losers = parseCsvList(env.DRILL_LOSERS);
    return uniqueAgents([winner, ...losers]);
}

function parseCsvList(value: string | undefined): string[] {
    if (!value) {
        return [];
    }
    return value
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
}

function uniqueAgents(values: string[]): string[] {
    const seen = new Set<string>();
    const output: string[] = [];
    for (const value of values) {
        const normalized = value.trim();
        if (!normalized || seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        output.push(normalized);
    }
    return output;
}

function buildFeedbackDispatches(signal: ReputationInteropSignal): FeedbackDispatchExpectation[] {
    const seen = new Set<string>();
    const dispatches: FeedbackDispatchExpectation[] = [];
    const append = (role: InteropRole, agent: string) => {
        const normalized = agent.trim();
        if (!normalized) {
            return;
        }
        const key = `${role}:${normalized}`;
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        dispatches.push({ role, agent: normalized });
    };

    append('winner', signal.winner);
    append('poster', signal.poster);
    append('judge', signal.judge);
    for (const participant of signal.participants ?? []) {
        if (participant === signal.winner) {
            continue;
        }
        append('loser', participant);
    }
    return dispatches;
}

function countFeedbackDispatches(dispatches: FeedbackDispatchExpectation[], agent: string): number {
    return dispatches.filter(dispatch => dispatch.agent === agent).length;
}

const isMainEntry = typeof process.argv[1] === 'string' && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainEntry) {
    runInteropDrill(process.env)
        .then(result => {
            process.stdout.write(
                `[drill] interop e2e passed for agent=${result.agent} taskId=${result.taskId} recipients=${result.identityRecipients.length}\n`,
            );
        })
        .catch(error => {
            process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
            process.exit(1);
        });
}
