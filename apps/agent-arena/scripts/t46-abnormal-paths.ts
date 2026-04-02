import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export type AssetPath = 'sol' | 'spl' | 'token2022';
export type AbnormalScenario =
    | 'cancel_task'
    | 'refund_expired'
    | 'force_refund'
    | 'low_score_refund'
    | 'mint_extension_guard';

export interface DrillCase {
    id: string;
    scenario: AbnormalScenario;
    asset: AssetPath;
    description: string;
    command: string;
    required: boolean;
}

export interface DrillCaseResult {
    id: string;
    scenario: AbnormalScenario;
    asset: AssetPath;
    description: string;
    command: string;
    required: boolean;
    success: boolean;
    exitCode: number;
    durationMs: number;
}

export interface CoverageCell {
    asset: AssetPath;
    status: 'pass' | 'fail' | 'not_implemented';
    required: boolean;
    caseIds: string[];
}

export interface ScenarioCoverage {
    scenario: AbnormalScenario;
    cells: CoverageCell[];
    overall: 'pass' | 'fail' | 'partial';
}

export interface T46DrillReport {
    generatedAt: string;
    repoRoot: string;
    ok: boolean;
    passRate: number;
    requiredTotal: number;
    requiredPassed: number;
    cases: DrillCaseResult[];
    coverage: ScenarioCoverage[];
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ARENA_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(ARENA_ROOT, '..', '..');
const INTEGRATION_MANIFEST = path.join(ARENA_ROOT, 'tests/integration-tests/Cargo.toml');

const DRILL_CASES: DrillCase[] = [
    {
        id: 'sol-low-score-refund',
        scenario: 'low_score_refund',
        asset: 'sol',
        description: 'SOL low-score path refunds poster and stakes',
        command: `cargo test --manifest-path "${INTEGRATION_MANIFEST}" t56_judge_low_score_refunds_poster`,
        required: true,
    },
    {
        id: 'sol-cancel-task',
        scenario: 'cancel_task',
        asset: 'sol',
        description: 'SOL cancel_task returns stakes and applies fee split',
        command: `cargo test --manifest-path "${INTEGRATION_MANIFEST}" t19c_cancel_task_with_applicants`,
        required: true,
    },
    {
        id: 'sol-refund-expired',
        scenario: 'refund_expired',
        asset: 'sol',
        description: 'SOL refund_expired refunds poster and applicants',
        command: `cargo test --manifest-path "${INTEGRATION_MANIFEST}" t19c_refund_expired_with_stake_refund`,
        required: true,
    },
    {
        id: 'sol-force-refund',
        scenario: 'force_refund',
        asset: 'sol',
        description: 'SOL force_refund executes slash path with settlement split',
        command: `cargo test --manifest-path "${INTEGRATION_MANIFEST}" t19d_force_refund_judge_kept_in_pool_when_stake_sufficient`,
        required: true,
    },
    {
        id: 'spl-low-score-refund',
        scenario: 'low_score_refund',
        asset: 'spl',
        description: 'SPL low-score path refunds reward and stakes',
        command: `cargo test --manifest-path "${INTEGRATION_MANIFEST}" t56_spl_low_score_refunds_poster_and_stakes`,
        required: true,
    },
    {
        id: 'token2022-unsupported-extension',
        scenario: 'mint_extension_guard',
        asset: 'token2022',
        description: 'Token-2022 TransferHook mint is rejected',
        command: `cargo test --manifest-path "${INTEGRATION_MANIFEST}" t56_post_task_rejects_token2022_unsupported_extension`,
        required: true,
    },
    {
        id: 'events-low-score-reason',
        scenario: 'low_score_refund',
        asset: 'sol',
        description: 'TaskRefunded event reason=LowScore',
        command: `cargo test --manifest-path "${INTEGRATION_MANIFEST}" t56_event_parsing_task_refunded_low_score`,
        required: true,
    },
    {
        id: 'events-cancel-reason',
        scenario: 'cancel_task',
        asset: 'sol',
        description: 'TaskRefunded event reason=Cancelled',
        command: `cargo test --manifest-path "${INTEGRATION_MANIFEST}" t56_event_parsing_task_refunded_cancelled_reason`,
        required: true,
    },
    {
        id: 'events-expired-reason',
        scenario: 'refund_expired',
        asset: 'sol',
        description: 'TaskRefunded event reason=Expired',
        command: `cargo test --manifest-path "${INTEGRATION_MANIFEST}" t56_event_parsing_task_refunded_expired_reason`,
        required: true,
    },
    {
        id: 'events-force-reason',
        scenario: 'force_refund',
        asset: 'sol',
        description: 'TaskRefunded event reason=ForceRefund',
        command: `cargo test --manifest-path "${INTEGRATION_MANIFEST}" t56_event_parsing_task_refunded_force_refund_reason`,
        required: true,
    },
];

async function runCase(testCase: DrillCase): Promise<DrillCaseResult> {
    const startedAt = Date.now();
    return await new Promise(resolve => {
        const child = spawn(testCase.command, {
            shell: true,
            cwd: REPO_ROOT,
            env: process.env,
        });

        child.stdout.on('data', chunk => {
            process.stdout.write(String(chunk));
        });
        child.stderr.on('data', chunk => {
            process.stderr.write(String(chunk));
        });

        child.on('close', code => {
            const exitCode = typeof code === 'number' ? code : 1;
            resolve({
                id: testCase.id,
                scenario: testCase.scenario,
                asset: testCase.asset,
                description: testCase.description,
                command: testCase.command,
                required: testCase.required,
                success: exitCode === 0,
                exitCode,
                durationMs: Date.now() - startedAt,
            });
        });
    });
}

export function buildCoverage(cases: DrillCase[], results: DrillCaseResult[]): ScenarioCoverage[] {
    const scenarios: AbnormalScenario[] = [
        'cancel_task',
        'refund_expired',
        'force_refund',
        'low_score_refund',
        'mint_extension_guard',
    ];
    const assets: AssetPath[] = ['sol', 'spl', 'token2022'];

    return scenarios.map(scenario => {
        const cells = assets.map(asset => {
            const matchedCases = cases.filter(entry => entry.scenario === scenario && entry.asset === asset);
            if (matchedCases.length === 0) {
                return {
                    asset,
                    status: 'not_implemented' as const,
                    required: false,
                    caseIds: [],
                };
            }
            const matchedResults = results.filter(entry => matchedCases.some(testCase => testCase.id === entry.id));
            const required = matchedCases.some(entry => entry.required);
            const success = matchedResults.length > 0 && matchedResults.every(entry => entry.success);
            return {
                asset,
                status: success ? ('pass' as const) : ('fail' as const),
                required,
                caseIds: matchedCases.map(entry => entry.id),
            };
        });

        const requiredCells = cells.filter(cell => cell.required);
        let overall: ScenarioCoverage['overall'] = 'partial';
        if (requiredCells.length > 0) {
            overall = requiredCells.every(cell => cell.status === 'pass') ? 'pass' : 'fail';
        }
        return { scenario, cells, overall };
    });
}

export async function runT46AbnormalPathDrill(cases: DrillCase[] = DRILL_CASES): Promise<T46DrillReport> {
    const results: DrillCaseResult[] = [];
    for (const testCase of cases) {
        process.stdout.write(`\n[T46] ${testCase.id}\n`);
        results.push(await runCase(testCase));
    }

    const requiredResults = results.filter(entry => entry.required);
    const requiredPassed = requiredResults.filter(entry => entry.success).length;
    const requiredTotal = requiredResults.length;
    const passRate = requiredTotal === 0 ? 1 : Math.round((requiredPassed / requiredTotal) * 10_000) / 10_000;
    const coverage = buildCoverage(cases, results);

    return {
        generatedAt: new Date().toISOString(),
        repoRoot: REPO_ROOT,
        ok: requiredPassed === requiredTotal,
        passRate,
        requiredTotal,
        requiredPassed,
        cases: results,
        coverage,
    };
}

const isMainEntry = typeof process.argv[1] === 'string' && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainEntry) {
    runT46AbnormalPathDrill()
        .then(report => {
            process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
            if (!report.ok) {
                process.exit(1);
            }
        })
        .catch(error => {
            process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
            process.exit(1);
        });
}
