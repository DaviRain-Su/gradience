import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { runInteropDrill, type InteropDrillResult } from './drill-interop-e2e.ts';

export interface T58AuditCheck {
    id: string;
    success: boolean;
    detail: string;
}

export interface T58InteropAuditReport {
    generatedAt: string;
    repoRoot: string;
    ok: boolean;
    checks: T58AuditCheck[];
    failures: string[];
    drill: InteropDrillResult | null;
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ARENA_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(ARENA_ROOT, '..', '..');
const DEFAULT_OUTPUT = path.join(ARENA_ROOT, '.baselines/t58-interop-audit.json');

function requireEnv(name: string, env: NodeJS.ProcessEnv): string {
    const value = env[name];
    if (!value) {
        throw new Error(`${name} is required`);
    }
    return value;
}

function asMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

function normalizeOutputPath(argv: string[], fallback: string): string {
    const outputArg = argv.find(arg => arg.startsWith('--output='));
    if (outputArg) {
        return path.resolve(REPO_ROOT, outputArg.slice('--output='.length));
    }
    const outputIndex = argv.findIndex(arg => arg === '--output');
    if (outputIndex >= 0 && argv[outputIndex + 1]) {
        return path.resolve(REPO_ROOT, argv[outputIndex + 1]);
    }
    return fallback;
}

export function evaluateT58InteropAudit(drill: InteropDrillResult): T58AuditCheck[] {
    const checks: T58AuditCheck[] = [];

    const roles = new Set(drill.feedbackDispatches.map(entry => entry.role));
    const requiresLoser = drill.participants.some(entry => entry !== drill.agent);
    const roleCoverageOk =
        roles.has('winner') && roles.has('poster') && roles.has('judge') && (!requiresLoser || roles.has('loser'));
    checks.push({
        id: 'role_coverage',
        success: roleCoverageOk,
        detail: `roles=${[...roles].sort().join(',')}`,
    });

    const relayCounterOk =
        drill.relayStatus.failed === 0 && drill.relayStatus.success >= drill.feedbackDispatches.length;
    checks.push({
        id: 'relay_status',
        success: relayCounterOk,
        detail: `success=${drill.relayStatus.success}, failed=${drill.relayStatus.failed}, expected>=${drill.feedbackDispatches.length}`,
    });

    const erc8004Configured = !!drill.erc8004Status;
    const erc8004StatusOk =
        !!drill.erc8004Status &&
        drill.erc8004Status.identitySuccess >= drill.identityRecipients.length &&
        drill.erc8004Status.feedbackSuccess >= drill.feedbackDispatches.length &&
        drill.erc8004Status.knownAgents >= drill.identityRecipients.length;
    checks.push({
        id: 'erc8004_status',
        success: erc8004Configured && erc8004StatusOk,
        detail: erc8004Configured
            ? `identity=${drill.erc8004Status?.identitySuccess}, feedback=${drill.erc8004Status?.feedbackSuccess}, knownAgents=${drill.erc8004Status?.knownAgents}`
            : 'erc8004 status missing',
    });

    const agentStatusSyncOk = drill.identityRecipients.every(agent => {
        const status = drill.agentImStatusByAgent[agent];
        const expectedFeedbackCount = drill.feedbackDispatches.filter(entry => entry.agent === agent).length;
        return (
            !!status &&
            status.identityRegistered === true &&
            (status.erc8004FeedbackCount ?? 0) >= expectedFeedbackCount &&
            (status.evmReputationCount ?? 0) >= expectedFeedbackCount
        );
    });
    checks.push({
        id: 'agent_im_sync',
        success: agentStatusSyncOk,
        detail: `auditedAgents=${drill.identityRecipients.length}`,
    });

    return checks;
}

export async function runT58InteropAudit(env: NodeJS.ProcessEnv = process.env): Promise<T58InteropAuditReport> {
    requireEnv('JUDGE_DAEMON_EVM_REPUTATION_RELAY_ENDPOINT', env);
    requireEnv('JUDGE_DAEMON_AGENT_IM_INTEROP_ENDPOINT', env);
    requireEnv('JUDGE_DAEMON_ERC8004_IDENTITY_ENDPOINT', env);
    requireEnv('JUDGE_DAEMON_ERC8004_FEEDBACK_ENDPOINT', env);

    try {
        const drill = await runInteropDrill(env);
        const checks = evaluateT58InteropAudit(drill);
        const failures = checks.filter(entry => !entry.success).map(entry => `${entry.id}: ${entry.detail}`);
        return {
            generatedAt: new Date().toISOString(),
            repoRoot: REPO_ROOT,
            ok: failures.length === 0,
            checks,
            failures,
            drill,
        };
    } catch (error) {
        return {
            generatedAt: new Date().toISOString(),
            repoRoot: REPO_ROOT,
            ok: false,
            checks: [],
            failures: [asMessage(error)],
            drill: null,
        };
    }
}

const isMainEntry = typeof process.argv[1] === 'string' && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainEntry) {
    const outputPath = normalizeOutputPath(process.argv.slice(2), DEFAULT_OUTPUT);
    runT58InteropAudit(process.env)
        .then(async report => {
            await mkdir(path.dirname(outputPath), { recursive: true });
            await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
            process.stdout.write(
                `[T58] report generated: ${outputPath}\n[T58] ok=${report.ok} checks=${report.checks.length}\n`,
            );
            if (!report.ok) {
                process.stderr.write(`[T58] failures:\n- ${report.failures.join('\n- ')}\n`);
                process.exit(1);
            }
        })
        .catch(error => {
            process.stderr.write(`${asMessage(error)}\n`);
            process.exit(1);
        });
}
