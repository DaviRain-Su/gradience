#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { loadConfig } from './config.js';
import { Daemon } from './daemon.js';
import { logger } from './utils/logger.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function getDataDir(): string {
    return join(homedir(), '.agentd');
}

function readAuthToken(): string | null {
    const tokenPath = join(getDataDir(), 'auth-token');
    if (!existsSync(tokenPath)) return null;
    return readFileSync(tokenPath, 'utf-8').trim();
}

function readConfig(): Record<string, unknown> {
    const configPath = join(getDataDir(), 'config.json');
    if (!existsSync(configPath)) return {};
    try {
        return JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
        return {};
    }
}

function writeConfig(data: Record<string, unknown>): void {
    const dir = getDataDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'config.json'), JSON.stringify(data, null, 2), { mode: 0o600 });
}

function getDaemonPort(): number {
    const cfg = readConfig();
    return typeof cfg.port === 'number' ? cfg.port : 7420;
}

async function apiRequest<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
): Promise<T> {
    const token = readAuthToken();
    if (!token) {
        console.error(chalk.red('Daemon is not running (no auth token found).'));
        console.error(chalk.dim('Start it with: agentd start'));
        process.exit(1);
    }

    const port = getDaemonPort();
    const url = `http://127.0.0.1:${port}${path}`;

    let res: Response;
    try {
        res = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch {
        console.error(chalk.red(`Cannot connect to daemon at port ${port}.`));
        console.error(chalk.dim('Start it with: agentd start'));
        process.exit(1);
    }

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = text; }

    if (!res.ok) {
        const err = json as Record<string, unknown>;
        console.error(chalk.red(`API error ${res.status}: ${err?.message ?? text}`));
        process.exit(1);
    }

    return json as T;
}

function formatUptime(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
}

function formatTs(epochMs: number | null): string {
    if (!epochMs) return chalk.dim('—');
    return new Date(epochMs).toLocaleString();
}

// ─── program ────────────────────────────────────────────────────────────────

const program = new Command();

program
    .name('agentd')
    .description('Gradience Agent Daemon CLI')
    .version('0.1.0');

// ── start ────────────────────────────────────────────────────────────────────

program
    .command('start')
    .description('Start the daemon')
    .option('--port <port>', 'API port', String)
    .option('--chain-hub-url <url>', 'Chain Hub WebSocket URL')
    .action(async (opts) => {
        const overrides: Record<string, unknown> = {};
        if (opts.port) overrides.port = Number(opts.port);
        if (opts.chainHubUrl) overrides.chainHubUrl = opts.chainHubUrl;

        const config = loadConfig(overrides);
        const daemon = new Daemon(config);

        const shutdown = async (signal: string) => {
            logger.info({ signal }, 'Received shutdown signal');
            await daemon.stop();
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));

        await daemon.start();
    });

// ── register ─────────────────────────────────────────────────────────────────

program
    .command('register')
    .description('Register this agent with a master wallet')
    .requiredOption('--master-wallet <pubkey>', 'Master wallet public key')
    .action(async (opts) => {
        const dataDir = getDataDir();
        if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

        const keyPath = join(dataDir, 'keypair');
        let keypair: nacl.SignKeyPair;
        let isNew = false;

        if (existsSync(keyPath)) {
            const raw = readFileSync(keyPath, 'utf-8').trim();
            keypair = nacl.sign.keyPair.fromSecretKey(bs58.decode(raw));
        } else {
            keypair = nacl.sign.keyPair();
            writeFileSync(keyPath, bs58.encode(keypair.secretKey), { mode: 0o600 });
            isNew = true;
        }

        const pubkey = bs58.encode(keypair.publicKey);

        // Save master wallet to config
        const cfg = readConfig();
        cfg.masterWallet = opts.masterWallet;
        writeConfig(cfg);

        if (isNew) {
            console.log(chalk.green('✓ Generated new agent keypair'));
        } else {
            console.log(chalk.cyan('ℹ Loaded existing agent keypair'));
        }
        console.log();
        console.log(chalk.bold('Agent Public Key:'), chalk.yellow(pubkey));
        console.log(chalk.bold('Master Wallet:  '), chalk.cyan(opts.masterWallet));
        console.log();
        console.log(chalk.dim(`Config saved to: ${join(dataDir, 'config.json')}`));
    });

// ── status ────────────────────────────────────────────────────────────────────

program
    .command('status')
    .description('Show daemon status')
    .action(async () => {
        const data = await apiRequest<{
            status: string;
            uptime: number;
            version: string;
            connection: { state: string };
            agents: { total: number; running: number };
            tasks: { queued: number; running: number; completed: number; failed: number; total: number };
        }>('GET', '/api/v1/status');

        const statusColor = data.status === 'running' ? chalk.green : chalk.red;

        console.log();
        console.log(chalk.bold('Daemon Status'));
        console.log('─'.repeat(40));
        console.log(`  Status      ${statusColor(data.status)}`);
        console.log(`  Uptime      ${chalk.cyan(formatUptime(data.uptime))}`);
        console.log(`  Version     ${chalk.dim(data.version)}`);
        console.log(`  Connection  ${data.connection.state === 'connected' ? chalk.green(data.connection.state) : chalk.yellow(data.connection.state)}`);
        console.log();
        console.log(chalk.bold('Agents'));
        console.log('─'.repeat(40));
        console.log(`  Total       ${data.agents.total}`);
        console.log(`  Running     ${chalk.green(data.agents.running)}`);
        console.log();
        console.log(chalk.bold('Tasks'));
        console.log('─'.repeat(40));
        console.log(`  Queued      ${chalk.yellow(data.tasks.queued)}`);
        console.log(`  Running     ${chalk.cyan(data.tasks.running)}`);
        console.log(`  Completed   ${chalk.green(data.tasks.completed)}`);
        console.log(`  Failed      ${chalk.red(data.tasks.failed)}`);
        console.log(`  Total       ${data.tasks.total}`);
        console.log();
    });

// ── agents ────────────────────────────────────────────────────────────────────

const agentsCmd = program.command('agents').description('Manage agent processes');

agentsCmd
    .command('list')
    .description('List registered agent processes')
    .action(async () => {
        const data = await apiRequest<{
            agents: Array<{
                config: { id: string; name: string; command: string; args: string[]; autoStart: boolean; maxRestarts: number };
                state: string;
                pid: number | null;
                restartCount: number;
                lastStartedAt: number | null;
                lastExitCode: number | null;
                lastError: string | null;
            }>;
        }>('GET', '/api/v1/agents');

        if (data.agents.length === 0) {
            console.log(chalk.dim('No agents registered.'));
            return;
        }

        console.log();
        console.log(chalk.bold(`${'ID'.padEnd(24)} ${'NAME'.padEnd(20)} ${'STATE'.padEnd(12)} ${'PID'.padEnd(8)} RESTARTS`));
        console.log('─'.repeat(80));
        for (const a of data.agents) {
            const stateColor =
                a.state === 'running' ? chalk.green :
                a.state === 'crashed' || a.state === 'failed' ? chalk.red :
                a.state === 'starting' ? chalk.cyan :
                chalk.dim;
            console.log(
                `${a.config.id.padEnd(24)} ${a.config.name.padEnd(20)} ${stateColor(a.state.padEnd(12))} ${String(a.pid ?? '—').padEnd(8)} ${a.restartCount}`
            );
            if (a.lastError) {
                console.log(chalk.dim(`  └ error: ${a.lastError}`));
            }
        }
        console.log();
    });

agentsCmd
    .command('add')
    .description('Register a new agent process')
    .requiredOption('--name <name>', 'Agent name')
    .requiredOption('--command <cmd>', 'Command to run')
    .option('--args <args...>', 'Command arguments', [])
    .option('--cwd <path>', 'Working directory')
    .option('--auto-start', 'Auto-start when daemon starts', false)
    .option('--max-restarts <n>', 'Max restarts on crash', '3')
    .action(async (opts) => {
        const id = `${opts.name.toLowerCase().replace(/\W+/g, '-')}-${Date.now()}`;
        const agent = await apiRequest<{ id: string; name: string }>('POST', '/api/v1/agents', {
            id,
            name: opts.name,
            command: opts.command,
            args: opts.args ?? [],
            cwd: opts.cwd,
            autoStart: opts.autoStart,
            maxRestarts: Number(opts.maxRestarts),
        });
        console.log(chalk.green('✓ Agent registered'));
        console.log(`  ID:      ${chalk.yellow(agent.id)}`);
        console.log(`  Name:    ${agent.name}`);
    });

agentsCmd
    .command('remove <id>')
    .description('Remove an agent')
    .action(async (id) => {
        await apiRequest('DELETE', `/api/v1/agents/${id}`);
        console.log(chalk.green(`✓ Agent ${chalk.yellow(id)} removed`));
    });

// ── tasks ─────────────────────────────────────────────────────────────────────

const tasksCmd = program.command('tasks').description('Inspect the task queue');

tasksCmd
    .command('list')
    .description('List tasks in queue')
    .option('--state <state>', 'Filter by state (queued,running,completed,failed,cancelled,dead)')
    .option('--limit <n>', 'Max results', '20')
    .action(async (opts) => {
        const qs = new URLSearchParams();
        if (opts.state) qs.set('state', opts.state);
        if (opts.limit) qs.set('limit', opts.limit);

        const data = await apiRequest<{
            tasks: Array<{
                id: string;
                type: string;
                state: string;
                priority: number;
                retries: number;
                assignedAgent: string | null;
                createdAt: number;
                completedAt: number | null;
            }>;
            total: number;
        }>('GET', `/api/v1/tasks?${qs}`);

        console.log(chalk.dim(`Showing ${data.tasks.length} of ${data.total} tasks`));
        if (data.tasks.length === 0) {
            console.log(chalk.dim('No tasks found.'));
            return;
        }

        console.log();
        console.log(chalk.bold(`${'ID'.padEnd(24)} ${'TYPE'.padEnd(20)} ${'STATE'.padEnd(12)} ${'PRI'.padEnd(5)} CREATED`));
        console.log('─'.repeat(85));
        for (const t of data.tasks) {
            const stateColor =
                t.state === 'completed' ? chalk.green :
                t.state === 'running' ? chalk.cyan :
                t.state === 'queued' ? chalk.yellow :
                t.state === 'failed' || t.state === 'dead' ? chalk.red :
                chalk.dim;
            console.log(
                `${t.id.padEnd(24)} ${t.type.padEnd(20)} ${stateColor(t.state.padEnd(12))} ${String(t.priority).padEnd(5)} ${formatTs(t.createdAt)}`
            );
        }
        console.log();
    });

tasksCmd
    .command('stats')
    .description('Task execution statistics')
    .action(async () => {
        const data = await apiRequest<{
            tasks: unknown[];
            total: number;
        }>('GET', '/api/v1/tasks?limit=0');

        // Get full counts from status endpoint
        const status = await apiRequest<{
            tasks: { queued: number; running: number; completed: number; failed: number; total: number };
        }>('GET', '/api/v1/status');

        const t = status.tasks;
        const total = t.total || 1; // avoid division by zero
        const successRate = t.total > 0 ? ((t.completed / total) * 100).toFixed(1) : '0.0';

        console.log();
        console.log(chalk.bold('Task Statistics'));
        console.log('─'.repeat(40));
        console.log(`  Total       ${t.total}`);
        console.log(`  Queued      ${chalk.yellow(t.queued)}`);
        console.log(`  Running     ${chalk.cyan(t.running)}`);
        console.log(`  Completed   ${chalk.green(t.completed)}`);
        console.log(`  Failed      ${chalk.red(t.failed)}`);
        console.log(`  Success rate  ${chalk.bold(successRate + '%')}`);
        console.log();
    });

// ── wallet ────────────────────────────────────────────────────────────────────

program
    .command('wallet')
    .description('Show agent wallet info')
    .action(async () => {
        // Try to get pubkey from running daemon first
        let pubkey: string | null = null;
        const token = readAuthToken();
        if (token) {
            try {
                const data = await apiRequest<{ publicKey: string }>('GET', '/api/v1/keys/public');
                pubkey = data.publicKey;
            } catch {
                // daemon not running, fall through to file
            }
        }

        if (!pubkey) {
            const keyPath = join(getDataDir(), 'keypair');
            if (!existsSync(keyPath)) {
                console.log(chalk.yellow('No agent keypair found. Run: agentd register --master-wallet <pubkey>'));
                return;
            }
            const raw = readFileSync(keyPath, 'utf-8').trim();
            const keypair = nacl.sign.keyPair.fromSecretKey(bs58.decode(raw));
            pubkey = bs58.encode(keypair.publicKey);
        }

        const cfg = readConfig();
        const masterWallet = cfg.masterWallet as string | undefined;

        console.log();
        console.log(chalk.bold('Agent Wallet'));
        console.log('─'.repeat(50));
        console.log(`  Public Key      ${chalk.yellow(pubkey)}`);
        console.log(`  Master Wallet   ${masterWallet ? chalk.cyan(masterWallet) : chalk.dim('not set')}`);
        console.log(`  Balance         ${chalk.dim('(requires Solana RPC — run daemon to fetch)')}`);
        console.log();
    });

// ── logs ──────────────────────────────────────────────────────────────────────

program
    .command('logs')
    .description('Tail the daemon log file')
    .option('-n, --lines <n>', 'Last N lines to show on startup', '50')
    .action(async (opts) => {
        const logPath = join(getDataDir(), 'daemon.log');

        if (!existsSync(logPath)) {
            console.log(chalk.dim(`No log file found at ${logPath}`));
            console.log(chalk.dim('The daemon writes logs to stdout by default when not in production mode.'));
            return;
        }

        const { spawn } = await import('node:child_process');
        const maxLines = Number(opts.lines);

        console.log(chalk.bold(`Tailing ${logPath} (last ${maxLines} lines)\n`));

        const tail = spawn('tail', ['-n', String(maxLines), '-f', logPath], { stdio: 'inherit' });

        tail.on('error', (err) => {
            console.error(chalk.red(`Failed to tail log: ${err.message}`));
            process.exit(1);
        });

        process.on('SIGINT', () => {
            tail.kill();
            process.exit(0);
        });
    });

// ─── parse ───────────────────────────────────────────────────────────────────

program.parseAsync(process.argv).catch((err) => {
    logger.fatal({ err }, 'CLI error');
    process.exit(1);
});
