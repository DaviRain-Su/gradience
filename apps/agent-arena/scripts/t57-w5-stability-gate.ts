import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { runT46AbnormalPathDrill, type T46DrillReport } from './t46-abnormal-paths.ts';
import { runT47PoolAltDrill, type T47DrillReport, type T47InstructionBaseline } from './t47-pool-alt.ts';
import { runT48EventLoopDrill, type T48DrillReport } from './t48-event-loop.ts';

type T57PhaseId = 't46' | 't47' | 't48';
type T57ChecklistStatus = 'pass' | 'fail' | 'not_executed';

interface T57RunnableReport {
    ok: boolean;
    passRate: number;
    requiredTotal: number;
    requiredPassed: number;
}

export interface T57PhaseResult {
    id: T57PhaseId;
    label: string;
    required: boolean;
    status: 'pass' | 'fail' | 'skipped';
    passRate: number;
    requiredTotal: number;
    requiredPassed: number;
    durationMs: number;
    error: string | null;
}

export interface T57ChecklistItem {
    id: string;
    status: T57ChecklistStatus;
    detail: string;
}

export interface T57Baselines {
    t47InstructionBaselines: T47InstructionBaseline[];
    t48: {
        activeJudgeMode: string;
        modeClassification: T48DrillReport['modeClassification'];
        wsRound1Sequence: string[];
        wsRound2Sequence: string[];
    } | null;
}

export interface T57StabilityReport {
    generatedAt: string;
    repoRoot: string;
    ok: boolean;
    passRate: number;
    requiredTotal: number;
    requiredPassed: number;
    failures: string[];
    phases: T57PhaseResult[];
    checklist: T57ChecklistItem[];
    baselines: T57Baselines;
}

export interface T57StabilityGateOptions {
    outputPath?: string;
    skipT48?: boolean;
    allowUnknownMode?: boolean;
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ARENA_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(ARENA_ROOT, '..', '..');
const DEFAULT_OUTPUT = path.join(ARENA_ROOT, '.baselines/t57-w5-stability.json');

interface TimedPhaseResult<T> {
    phase: T57PhaseResult;
    report: T | null;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
    if (!value) {
        return fallback;
    }
    return !['0', 'false', 'False', 'FALSE', 'no', 'off'].includes(value);
}

function asMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

async function runPhase<T extends T57RunnableReport>(
    id: T57PhaseId,
    label: string,
    required: boolean,
    runner: () => Promise<T>,
): Promise<TimedPhaseResult<T>> {
    const startedAt = Date.now();
    try {
        const report = await runner();
        return {
            phase: {
                id,
                label,
                required,
                status: report.ok ? 'pass' : 'fail',
                passRate: report.passRate,
                requiredTotal: report.requiredTotal,
                requiredPassed: report.requiredPassed,
                durationMs: Date.now() - startedAt,
                error: null,
            },
            report,
        };
    } catch (error) {
        return {
            phase: {
                id,
                label,
                required,
                status: 'fail',
                passRate: 0,
                requiredTotal: 1,
                requiredPassed: 0,
                durationMs: Date.now() - startedAt,
                error: asMessage(error),
            },
            report: null,
        };
    }
}

function skippedPhase(id: T57PhaseId, label: string): T57PhaseResult {
    return {
        id,
        label,
        required: false,
        status: 'skipped',
        passRate: 0,
        requiredTotal: 0,
        requiredPassed: 0,
        durationMs: 0,
        error: null,
    };
}

function findT48Case(report: T48DrillReport | null, caseId: string): boolean | null {
    if (!report) {
        return null;
    }
    const matched = report.cases.find(entry => entry.id === caseId);
    if (!matched) {
        return null;
    }
    return matched.success;
}

function createChecklistItem(id: string, status: T57ChecklistStatus, detail: string): T57ChecklistItem {
    return { id, status, detail };
}

export function buildChecklist(
    t46Report: T46DrillReport | null,
    t47Report: T47DrillReport | null,
    t48Report: T48DrillReport | null,
): T57ChecklistItem[] {
    const abnormalPathsStatus: T57ChecklistStatus = !t46Report ? 'not_executed' : t46Report.ok ? 'pass' : 'fail';

    const altCoverage = t47Report?.coverage.find(row => row.scenario === 'alt_switch');
    const poolAltStatus: T57ChecklistStatus = !t47Report
        ? 'not_executed'
        : t47Report.ok && altCoverage?.overall === 'pass'
          ? 'pass'
          : 'fail';

    const wsPrimary = findT48Case(t48Report, 'ws-primary-roundtrip');
    const wsReconnect = findT48Case(t48Report, 'ws-reconnect-roundtrip');
    const eventLoopStatus: T57ChecklistStatus =
        wsPrimary === null || wsReconnect === null ? 'not_executed' : wsPrimary && wsReconnect ? 'pass' : 'fail';

    const replayIndexer = findT48Case(t48Report, 'indexer-replay-idempotent');
    const replayJudge = findT48Case(t48Report, 'judge-replay-dedup');
    const replayStatus: T57ChecklistStatus =
        replayIndexer === null || replayJudge === null
            ? 'not_executed'
            : replayIndexer && replayJudge
              ? 'pass'
              : 'fail';

    return [
        createChecklistItem(
            'abnormal_paths',
            abnormalPathsStatus,
            abnormalPathsStatus === 'pass'
                ? `T46 required passed ${t46Report?.requiredPassed ?? 0}/${t46Report?.requiredTotal ?? 0}`
                : 'T46 abnormal path drill not fully passing',
        ),
        createChecklistItem(
            'pool_alt_switch',
            poolAltStatus,
            poolAltStatus === 'pass'
                ? `T47 required passed ${t47Report?.requiredPassed ?? 0}/${t47Report?.requiredTotal ?? 0}`
                : 'T47 pool/ALT coverage or required cases failed',
        ),
        createChecklistItem(
            'event_loop_observability',
            eventLoopStatus,
            eventLoopStatus === 'pass'
                ? `T48 WS roundtrip verified for task ${t48Report?.taskId ?? 'n/a'}`
                : 'T48 WS primary/reconnect roundtrip not fully verified',
        ),
        createChecklistItem(
            'replay_idempotency',
            replayStatus,
            replayStatus === 'pass'
                ? 'T48 indexer/judge replay idempotency checks passed'
                : 'T48 replay idempotency checks failed or not executed',
        ),
    ];
}

export function evaluateT57Gate(input: {
    phases: T57PhaseResult[];
    checklist: T57ChecklistItem[];
    t47Report: T47DrillReport | null;
    t48Report: T48DrillReport | null;
    allowUnknownMode: boolean;
}): string[] {
    const failures: string[] = [];

    for (const phase of input.phases) {
        if (phase.required && phase.status !== 'pass') {
            failures.push(`${phase.id} failed (${phase.status})${phase.error ? `: ${phase.error}` : ''}`);
        }
    }

    for (const item of input.checklist) {
        if (item.status !== 'pass') {
            failures.push(`checklist ${item.id} -> ${item.status}: ${item.detail}`);
        }
    }

    const requiredBaselines = new Set(['post_task', 'judge_and_pay']);
    const availableBaselines = new Set((input.t47Report?.instructionBaselines ?? []).map(item => item.instruction));
    for (const required of requiredBaselines) {
        if (!availableBaselines.has(required)) {
            failures.push(`missing T47 baseline metric for instruction=${required}`);
        }
    }

    if (input.t48Report && !input.allowUnknownMode) {
        if (input.t48Report.modeClassification === 'unknown') {
            failures.push(`unknown T48 judge mode classification: ${input.t48Report.activeJudgeMode}`);
        }
    }

    return failures;
}

function buildBaselines(t47Report: T47DrillReport | null, t48Report: T48DrillReport | null): T57Baselines {
    return {
        t47InstructionBaselines: t47Report?.instructionBaselines ?? [],
        t48: t48Report
            ? {
                  activeJudgeMode: t48Report.activeJudgeMode,
                  modeClassification: t48Report.modeClassification,
                  wsRound1Sequence: t48Report.observations.wsRound1.map(entry => entry.event),
                  wsRound2Sequence: t48Report.observations.wsRound2.map(entry => entry.event),
              }
            : null,
    };
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

export async function runT57W5StabilityGate(options: T57StabilityGateOptions = {}): Promise<T57StabilityReport> {
    const skipT48 = options.skipT48 ?? false;
    const allowUnknownMode = options.allowUnknownMode ?? false;

    process.stdout.write('\n[T57] running T46 abnormal paths\n');
    const t46 = await runPhase('t46', 'T46 abnormal paths', true, () => runT46AbnormalPathDrill());

    process.stdout.write('\n[T57] running T47 pool/ALT\n');
    const t47 = await runPhase('t47', 'T47 pool/ALT', true, () => runT47PoolAltDrill());

    let t48Phase: T57PhaseResult;
    let t48Report: T48DrillReport | null = null;
    if (skipT48) {
        t48Phase = skippedPhase('t48', 'T48 event loop');
    } else {
        process.stdout.write('\n[T57] running T48 event loop\n');
        const t48 = await runPhase('t48', 'T48 event loop', true, () => runT48EventLoopDrill());
        t48Phase = t48.phase;
        t48Report = t48.report;
    }

    const phases = [t46.phase, t47.phase, t48Phase];
    const checklist = buildChecklist(t46.report, t47.report, t48Report);
    const failures = evaluateT57Gate({
        phases,
        checklist,
        t47Report: t47.report,
        t48Report,
        allowUnknownMode,
    });
    const requiredPhases = phases.filter(phase => phase.required);
    const requiredPassed = requiredPhases.filter(phase => phase.status === 'pass').length;
    const requiredTotal = requiredPhases.length;
    const passRate = requiredTotal === 0 ? 1 : Math.round((requiredPassed / requiredTotal) * 10_000) / 10_000;

    return {
        generatedAt: new Date().toISOString(),
        repoRoot: REPO_ROOT,
        ok: failures.length === 0,
        passRate,
        requiredTotal,
        requiredPassed,
        failures,
        phases,
        checklist,
        baselines: buildBaselines(t47.report, t48Report),
    };
}

const isMainEntry = typeof process.argv[1] === 'string' && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainEntry) {
    const argv = process.argv.slice(2);
    const outputPath = normalizeOutputPath(argv, DEFAULT_OUTPUT);
    const skipT48 = argv.includes('--skip-t48') || parseBoolean(process.env.T57_SKIP_T48, false);
    const allowUnknownMode =
        argv.includes('--allow-unknown-mode') || parseBoolean(process.env.T57_ALLOW_UNKNOWN_MODE, false);

    runT57W5StabilityGate({ skipT48, allowUnknownMode })
        .then(async report => {
            await mkdir(path.dirname(outputPath), { recursive: true });
            await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
            process.stdout.write(
                `[T57] report generated: ${outputPath}\n[T57] required ${report.requiredPassed}/${report.requiredTotal}, ok=${report.ok}\n`,
            );
            if (!report.ok) {
                process.stderr.write(`[T57] failures:\n- ${report.failures.join('\n- ')}\n`);
                process.exit(1);
            }
        })
        .catch(error => {
            process.stderr.write(`${asMessage(error)}\n`);
            process.exit(1);
        });
}
