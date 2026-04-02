import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const BASELINE_LINE_REGEX =
    /T70_BASELINE\|instruction=([a-z_]+)\|cu=(\d+)\|tx_size_bytes=(\d+)\|latency_ms=(\d+)/g;

export type T47Scenario =
    | 'pool_settlement'
    | 'pool_capacity'
    | 'alt_switch'
    | 'tx_packet_limit'
    | 'high_load';

export type T47TargetScale = 'n20' | 'n50' | 'n100';

export interface T47DrillCase {
    id: string;
    scenario: T47Scenario;
    scale: T47TargetScale;
    description: string;
    command: string;
    required: boolean;
}

export interface T47DrillResult {
    id: string;
    scenario: T47Scenario;
    scale: T47TargetScale;
    description: string;
    command: string;
    required: boolean;
    success: boolean;
    exitCode: number;
    durationMs: number;
    stdout: string;
    stderr: string;
}

export interface T47InstructionBaseline {
    instruction: string;
    computeUnits: number;
    txSizeBytes: number;
    latencyMs: number;
}

export interface T47CoverageCell {
    scale: T47TargetScale;
    status: 'pass' | 'fail' | 'not_implemented';
    required: boolean;
    caseIds: string[];
}

export interface T47CoverageRow {
    scenario: T47Scenario;
    cells: T47CoverageCell[];
    overall: 'pass' | 'fail' | 'partial';
}

export interface T47DrillReport {
    generatedAt: string;
    repoRoot: string;
    ok: boolean;
    passRate: number;
    requiredTotal: number;
    requiredPassed: number;
    cases: Array<{
        id: string;
        success: boolean;
        exitCode: number;
        durationMs: number;
    }>;
    coverage: T47CoverageRow[];
    instructionBaselines: T47InstructionBaseline[];
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ARENA_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(ARENA_ROOT, '..', '..');
const INTEGRATION_MANIFEST = path.join(
    ARENA_ROOT,
    'tests/integration-tests/Cargo.toml',
);
const SDK_TEST_FILE = path.join(
    ARENA_ROOT,
    'clients/typescript/src/sdk.test.ts',
);

const DRILL_CASES: T47DrillCase[] = [
    {
        id: 'pool-settlement-n20',
        scenario: 'pool_settlement',
        scale: 'n20',
        description: 'pool judge settlement path succeeds with multiple applicants',
        command: `cargo test --manifest-path "${INTEGRATION_MANIFEST}" t65_pool_mode_settlement_with_multiple_applicants`,
        required: true,
    },
    {
        id: 'pool-capacity-n20',
        scenario: 'pool_capacity',
        scale: 'n20',
        description: 'pool registration hard-cap (200) rejects overflow',
        command: `cargo test --manifest-path "${INTEGRATION_MANIFEST}" t65_register_judge_rejects_pool_over_capacity`,
        required: true,
    },
    {
        id: 'alt-switch-versioned-n50',
        scenario: 'alt_switch',
        scale: 'n50',
        description: 'SDK switches to ALT-backed versioned tx when remaining accounts exceed threshold',
        command: `tsx --test "${SDK_TEST_FILE}" --test-name-pattern "task.cancel auto-enables ALT flow when remaining accounts exceed threshold"`,
        required: true,
    },
    {
        id: 'alt-switch-legacy-n20',
        scenario: 'alt_switch',
        scale: 'n20',
        description: 'SDK keeps legacy tx path when remaining accounts are within threshold',
        command: `tsx --test "${SDK_TEST_FILE}" --test-name-pattern "task.cancel keeps legacy flow when remaining accounts stay within threshold"`,
        required: true,
    },
    {
        id: 'tx-packet-limit-n20',
        scenario: 'tx_packet_limit',
        scale: 'n20',
        description: 'transaction baseline remains within packet and CU limits',
        command: `cargo test --manifest-path "${INTEGRATION_MANIFEST}" t70_ -- --nocapture`,
        required: true,
    },
];

async function runCase(testCase: T47DrillCase): Promise<T47DrillResult> {
    const startedAt = Date.now();
    return await new Promise((resolve) => {
        const child = spawn(testCase.command, {
            shell: true,
            cwd: REPO_ROOT,
            env: process.env,
        });
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
            const text = String(chunk);
            stdout += text;
            process.stdout.write(text);
        });
        child.stderr.on('data', (chunk) => {
            const text = String(chunk);
            stderr += text;
            process.stderr.write(text);
        });

        child.on('close', (code) => {
            const exitCode = typeof code === 'number' ? code : 1;
            resolve({
                id: testCase.id,
                scenario: testCase.scenario,
                scale: testCase.scale,
                description: testCase.description,
                command: testCase.command,
                required: testCase.required,
                success: exitCode === 0,
                exitCode,
                durationMs: Date.now() - startedAt,
                stdout,
                stderr,
            });
        });
    });
}

function parseInstructionBaselines(output: string): T47InstructionBaseline[] {
    const baselines: T47InstructionBaseline[] = [];
    for (const match of output.matchAll(BASELINE_LINE_REGEX)) {
        baselines.push({
            instruction: match[1] ?? 'unknown',
            computeUnits: Number(match[2] ?? 0),
            txSizeBytes: Number(match[3] ?? 0),
            latencyMs: Number(match[4] ?? 0),
        });
    }
    return baselines;
}

export function buildCoverage(
    cases: T47DrillCase[],
    results: T47DrillResult[],
): T47CoverageRow[] {
    const scenarios: T47Scenario[] = [
        'pool_settlement',
        'pool_capacity',
        'alt_switch',
        'tx_packet_limit',
        'high_load',
    ];
    const scales: T47TargetScale[] = ['n20', 'n50', 'n100'];

    return scenarios.map((scenario) => {
        const cells = scales.map((scale) => {
            const matchedCases = cases.filter(
                (entry) => entry.scenario === scenario && entry.scale === scale,
            );
            if (matchedCases.length === 0) {
                return {
                    scale,
                    status: 'not_implemented' as const,
                    required: false,
                    caseIds: [],
                };
            }

            const matchedResults = results.filter((entry) =>
                matchedCases.some((testCase) => testCase.id === entry.id),
            );
            const required = matchedCases.some((entry) => entry.required);
            const success = matchedResults.length > 0 && matchedResults.every((entry) => entry.success);

            return {
                scale,
                status: success ? ('pass' as const) : ('fail' as const),
                required,
                caseIds: matchedCases.map((entry) => entry.id),
            };
        });

        const requiredCells = cells.filter((cell) => cell.required);
        let overall: T47CoverageRow['overall'] = 'partial';
        if (requiredCells.length > 0) {
            overall = requiredCells.every((cell) => cell.status === 'pass')
                ? 'pass'
                : 'fail';
        }

        return { scenario, cells, overall };
    });
}

export async function runT47PoolAltDrill(
    cases: T47DrillCase[] = DRILL_CASES,
): Promise<T47DrillReport> {
    const results: T47DrillResult[] = [];
    const baselines: T47InstructionBaseline[] = [];

    for (const testCase of cases) {
        process.stdout.write(`\n[T47] ${testCase.id}\n`);
        const result = await runCase(testCase);
        results.push(result);
        baselines.push(...parseInstructionBaselines(`${result.stdout}\n${result.stderr}`));
    }

    const requiredResults = results.filter((entry) => entry.required);
    const requiredPassed = requiredResults.filter((entry) => entry.success).length;
    const requiredTotal = requiredResults.length;
    const passRate =
        requiredTotal === 0 ? 1 : Math.round((requiredPassed / requiredTotal) * 10_000) / 10_000;

    return {
        generatedAt: new Date().toISOString(),
        repoRoot: REPO_ROOT,
        ok: requiredPassed === requiredTotal,
        passRate,
        requiredTotal,
        requiredPassed,
        cases: results.map((entry) => ({
            id: entry.id,
            success: entry.success,
            exitCode: entry.exitCode,
            durationMs: entry.durationMs,
        })),
        coverage: buildCoverage(cases, results),
        instructionBaselines: baselines,
    };
}

const isMainEntry =
    typeof process.argv[1] === 'string' &&
    fileURLToPath(import.meta.url) === process.argv[1];

if (isMainEntry) {
    runT47PoolAltDrill()
        .then((report) => {
            process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
            if (!report.ok) {
                process.exit(1);
            }
        })
        .catch((error) => {
            process.stderr.write(
                `${error instanceof Error ? error.message : String(error)}\n`,
            );
            process.exit(1);
        });
}
