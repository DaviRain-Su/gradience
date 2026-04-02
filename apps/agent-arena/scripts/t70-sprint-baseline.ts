import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

interface CommandSpec {
    id: string;
    command: string;
}

interface SprintSpec {
    name: string;
    tasks: string[];
    commands: CommandSpec[];
}

interface CommandResult {
    id: string;
    command: string;
    success: boolean;
    exitCode: number;
    durationMs: number;
    stdout: string;
    stderr: string;
}

interface InstructionBaseline {
    instruction: string;
    computeUnits: number;
    txSizeBytes: number;
    latencyMs: number;
}

interface SprintReport {
    name: string;
    tasks: string[];
    passRate: number;
    latencyMs: {
        avg: number;
        p95: number;
        max: number;
    };
    commands: Array<{
        id: string;
        success: boolean;
        exitCode: number;
        durationMs: number;
    }>;
}

interface BaselineReport {
    generatedAt: string;
    repoRoot: string;
    sprintReports: SprintReport[];
    instructionBaselines: InstructionBaseline[];
    overall: {
        passRate: number;
        latencyMs: {
            avg: number;
            p95: number;
            max: number;
        };
    };
}

const BASELINE_LINE_REGEX = /T70_BASELINE\|instruction=([a-z_]+)\|cu=(\d+)\|tx_size_bytes=(\d+)\|latency_ms=(\d+)/g;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ARENA_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(ARENA_ROOT, '..', '..');
const INTEGRATION_MANIFEST = path.join(ARENA_ROOT, 'tests/integration-tests/Cargo.toml');
const INDEXER_MANIFEST = path.join(ARENA_ROOT, 'indexer/Cargo.toml');

const DEFAULT_OUTPUT = path.join(ARENA_ROOT, '.baselines/t70-sprint-baseline.json');

const SPRINTS: SprintSpec[] = [
    {
        name: 'Sprint 1',
        tasks: ['T61', 'T62', 'T65'],
        commands: [
            {
                id: 'agent-im-api',
                command: `pnpm --dir "${path.join(REPO_ROOT, 'apps/agent-im')}" test:api`,
            },
            {
                id: 'arena-t65',
                command: `cargo test --manifest-path "${INTEGRATION_MANIFEST}" t65_`,
            },
        ],
    },
    {
        name: 'Sprint 2',
        tasks: ['T63', 'T64', 'T66', 'T67'],
        commands: [
            {
                id: 'agent-im-full',
                command: `pnpm --dir "${path.join(REPO_ROOT, 'apps/agent-im')}" test`,
            },
            {
                id: 'arena-t66',
                command: `cargo test --manifest-path "${INTEGRATION_MANIFEST}" t66_`,
            },
            {
                id: 'arena-t67',
                command: `cargo test --manifest-path "${INTEGRATION_MANIFEST}" t67_`,
            },
        ],
    },
    {
        name: 'Sprint 3',
        tasks: ['T68', 'T69', 'T70'],
        commands: [
            {
                id: 'arena-sdk-tests',
                command: `pnpm --dir "${ARENA_ROOT}" test:sdk`,
            },
            {
                id: 'arena-judge-daemon-tests',
                command: `pnpm --dir "${ARENA_ROOT}" test:judge-daemon`,
            },
            {
                id: 'arena-indexer-tests',
                command: `cargo test --manifest-path "${INDEXER_MANIFEST}"`,
            },
            {
                id: 'arena-t70-baseline',
                command: `cargo test --manifest-path "${INTEGRATION_MANIFEST}" t70_ -- --nocapture`,
            },
        ],
    },
];

async function runCommand(spec: CommandSpec): Promise<CommandResult> {
    const startedAt = Date.now();
    return await new Promise(resolve => {
        const child = spawn(spec.command, {
            shell: true,
            cwd: REPO_ROOT,
            env: process.env,
        });
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', chunk => {
            const text = String(chunk);
            stdout += text;
            process.stdout.write(text);
        });
        child.stderr.on('data', chunk => {
            const text = String(chunk);
            stderr += text;
            process.stderr.write(text);
        });

        child.on('close', code => {
            const exitCode = typeof code === 'number' ? code : 1;
            resolve({
                id: spec.id,
                command: spec.command,
                success: exitCode === 0,
                exitCode,
                durationMs: Date.now() - startedAt,
                stdout,
                stderr,
            });
        });
    });
}

function percentile(values: number[], p: number): number {
    if (values.length === 0) {
        return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[index] ?? 0;
}

function summarizeLatency(values: number[]): { avg: number; p95: number; max: number } {
    if (values.length === 0) {
        return { avg: 0, p95: 0, max: 0 };
    }
    const total = values.reduce((sum, next) => sum + next, 0);
    return {
        avg: Math.round((total / values.length) * 100) / 100,
        p95: percentile(values, 95),
        max: Math.max(...values),
    };
}

function parseInstructionBaselines(output: string): InstructionBaseline[] {
    const baselines: InstructionBaseline[] = [];
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

function normalizeOutputPath(argv: string[]): string {
    const outputArg = argv.find(arg => arg.startsWith('--output='));
    if (outputArg) {
        return path.resolve(REPO_ROOT, outputArg.slice('--output='.length));
    }
    const outputIndex = argv.findIndex(arg => arg === '--output');
    if (outputIndex >= 0 && argv[outputIndex + 1]) {
        return path.resolve(REPO_ROOT, argv[outputIndex + 1]);
    }
    return DEFAULT_OUTPUT;
}

export async function runT70SprintBaseline(outputPath = DEFAULT_OUTPUT): Promise<BaselineReport> {
    const sprintReports: SprintReport[] = [];
    const allCommandResults: CommandResult[] = [];
    const instructionBaselines: InstructionBaseline[] = [];

    for (const sprint of SPRINTS) {
        const sprintResults: CommandResult[] = [];
        for (const command of sprint.commands) {
            process.stdout.write(`\n[T70] ${sprint.name} -> ${command.id}\n`);
            const result = await runCommand(command);
            sprintResults.push(result);
            allCommandResults.push(result);
            instructionBaselines.push(...parseInstructionBaselines(`${result.stdout}\n${result.stderr}`));
        }

        const passed = sprintResults.filter(result => result.success).length;
        const passRate = sprintResults.length === 0 ? 0 : Math.round((passed / sprintResults.length) * 10_000) / 10_000;
        sprintReports.push({
            name: sprint.name,
            tasks: sprint.tasks,
            passRate,
            latencyMs: summarizeLatency(sprintResults.map(result => result.durationMs)),
            commands: sprintResults.map(result => ({
                id: result.id,
                success: result.success,
                exitCode: result.exitCode,
                durationMs: result.durationMs,
            })),
        });
    }

    const allPassRate =
        allCommandResults.length === 0
            ? 0
            : Math.round(
                  (allCommandResults.filter(result => result.success).length / allCommandResults.length) * 10_000,
              ) / 10_000;

    const report: BaselineReport = {
        generatedAt: new Date().toISOString(),
        repoRoot: REPO_ROOT,
        sprintReports,
        instructionBaselines,
        overall: {
            passRate: allPassRate,
            latencyMs: summarizeLatency(allCommandResults.map(result => result.durationMs)),
        },
    };

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return report;
}

const isMainEntry = typeof process.argv[1] === 'string' && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainEntry) {
    const outputPath = normalizeOutputPath(process.argv.slice(2));
    runT70SprintBaseline(outputPath)
        .then(report => {
            process.stdout.write(
                `[T70] baseline generated: ${outputPath}\n[T70] overall passRate=${report.overall.passRate}\n`,
            );
            if (report.instructionBaselines.length === 0) {
                process.stderr.write('[T70] warning: no instruction baseline lines captured\n');
            }
        })
        .catch(error => {
            process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
            process.exit(1);
        });
}
