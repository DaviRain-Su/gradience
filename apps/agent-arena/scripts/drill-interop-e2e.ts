import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
    buildInteropPublisherFromEnv,
    type ReputationInteropSignal,
} from '../judge-daemon/src/interop.js';

function requireEnv(name: string, env: NodeJS.ProcessEnv): string {
    const value = env[name];
    if (!value) {
        throw new Error(`${name} is required`);
    }
    return value;
}

function inferStatusEndpoint(endpoint: string, suffix: string, replacement: string): string {
    return endpoint.endsWith(suffix)
        ? `${endpoint.slice(0, -suffix.length)}${replacement}`
        : endpoint;
}

async function fetchJson(url: string): Promise<unknown> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`request failed ${response.status} ${url}`);
    }
    return response.json();
}

export async function runInteropDrill(
    env: NodeJS.ProcessEnv = process.env,
): Promise<{ agent: string; taskId: number }> {
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
    const signal: ReputationInteropSignal = {
        taskId: Number(env.DRILL_TASK_ID ?? 999001),
        category: Number(env.DRILL_CATEGORY ?? 1),
        winner: agent,
        poster: env.DRILL_POSTER ?? '11111111111111111111111111111111',
        judge: env.DRILL_JUDGE ?? '11111111111111111111111111111111',
        score: Number(env.DRILL_SCORE ?? 85),
        reward: Number(env.DRILL_REWARD ?? 1_000_000),
        reasonRef: env.DRILL_REASON_REF ?? 'cid://drill-reason',
        chainTx: env.DRILL_CHAIN_TX ?? `drill-${Date.now()}`,
        judgedAt: Math.floor(Date.now() / 1000),
        judgeMode: env.DRILL_JUDGE_MODE ?? 'designated',
    };

    await publisher.onTaskJudged(signal);

    if (publisher.flushOutbox) {
        const drained = await publisher.flushOutbox();
        if (drained.remaining > 0) {
            throw new Error(
                `interop outbox still has remaining entries: ${drained.remaining}`,
            );
        }
    }

    const evmRelayEndpoint = requireEnv('JUDGE_DAEMON_EVM_REPUTATION_RELAY_ENDPOINT', env);
    const relayStatusEndpoint =
        env.EVM_RELAY_STATUS_ENDPOINT ??
        inferStatusEndpoint(evmRelayEndpoint, '/relay/submit-reputation', '/status');
    const relayStatus = (await fetchJson(relayStatusEndpoint)) as {
        success?: number;
        failed?: number;
    };
    if ((relayStatus.success ?? 0) < 1) {
        throw new Error(`relay success counter not incremented: ${JSON.stringify(relayStatus)}`);
    }

    const agentImEventsEndpoint = requireEnv('JUDGE_DAEMON_AGENT_IM_INTEROP_ENDPOINT', env);
    const agentImStatusEndpoint =
        env.AGENT_IM_INTEROP_STATUS_ENDPOINT ??
        `${inferStatusEndpoint(agentImEventsEndpoint, '/interop/events', '/interop/status')}?agent=${encodeURIComponent(
            agent,
        )}`;
    const agentImStatus = (await fetchJson(agentImStatusEndpoint)) as {
        status?: { evmReputationCount?: number; identityRegistered?: boolean };
    };
    if ((agentImStatus.status?.evmReputationCount ?? 0) < 1) {
        throw new Error(
            `agent-im evmReputationCount not incremented: ${JSON.stringify(agentImStatus)}`,
        );
    }

    return { agent, taskId: signal.taskId };
}

const isMainEntry =
    typeof process.argv[1] === 'string' &&
    fileURLToPath(import.meta.url) === process.argv[1];

if (isMainEntry) {
    runInteropDrill(process.env)
        .then(({ agent, taskId }) => {
            process.stdout.write(
                `[drill] interop e2e passed for agent=${agent} taskId=${taskId}\n`,
            );
        })
        .catch((error) => {
            process.stderr.write(
                `${error instanceof Error ? error.message : String(error)}\n`,
            );
            process.exit(1);
        });
}
