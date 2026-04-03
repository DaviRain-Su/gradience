import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';

export type AgentProcessState = 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed' | 'failed';

export interface AgentConfig {
    id: string;
    name: string;
    command: string;
    args: string[];
    cwd?: string;
    env?: Record<string, string>;
    autoStart: boolean;
    maxRestarts: number;
}

export interface AgentProcess {
    config: AgentConfig;
    state: AgentProcessState;
    pid: number | null;
    restartCount: number;
    lastStartedAt: number | null;
    lastExitCode: number | null;
    lastError: string | null;
}

export class ProcessManager extends EventEmitter {
    private readonly processes = new Map<string, AgentProcess>();
    private readonly childProcesses = new Map<string, ChildProcess>();
    private readonly lineBuffers = new Map<string, string>();
    private readonly maxProcesses: number;
    private healthCheckTimer: ReturnType<typeof setInterval> | null = null;

    constructor(
        private readonly db: Database.Database,
        maxProcesses: number,
    ) {
        super();
        this.maxProcesses = maxProcesses;
    }

    async initialize(): Promise<void> {
        const rows = this.db.prepare('SELECT * FROM agents').all() as Record<string, unknown>[];
        for (const row of rows) {
            const config = this.rowToConfig(row);
            this.processes.set(config.id, {
                config,
                state: 'stopped',
                pid: null,
                restartCount: 0,
                lastStartedAt: null,
                lastExitCode: null,
                lastError: null,
            });
        }

        for (const proc of this.processes.values()) {
            if (proc.config.autoStart) {
                this.start(proc.config.id).catch((err) => {
                    logger.error({ err, agentId: proc.config.id }, 'Auto-start failed');
                });
            }
        }

        this.healthCheckTimer = setInterval(() => this.healthCheck(), 10_000);
    }

    async shutdown(): Promise<void> {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
        const stopPromises = [];
        for (const [id, proc] of this.processes) {
            if (proc.state === 'running' || proc.state === 'starting') {
                stopPromises.push(this.stop(id));
            }
        }
        await Promise.allSettled(stopPromises);
    }

    register(config: AgentConfig): AgentConfig {
        if (this.processes.has(config.id)) {
            throw new DaemonError(ErrorCodes.AGENT_ALREADY_EXISTS, `Agent '${config.id}' already exists`, 409);
        }

        const now = Date.now();
        this.db.prepare(`
            INSERT INTO agents (id, name, command, args, cwd, env, auto_start, max_restarts, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            config.id, config.name, config.command,
            JSON.stringify(config.args), config.cwd ?? null,
            JSON.stringify(config.env ?? {}),
            config.autoStart ? 1 : 0, config.maxRestarts, now, now,
        );

        this.processes.set(config.id, {
            config,
            state: 'stopped',
            pid: null,
            restartCount: 0,
            lastStartedAt: null,
            lastExitCode: null,
            lastError: null,
        });

        logger.info({ agentId: config.id }, 'Agent registered');
        return config;
    }

    async start(id: string): Promise<number> {
        const proc = this.processes.get(id);
        if (!proc) throw new DaemonError(ErrorCodes.AGENT_NOT_FOUND, 'Agent not found', 404);
        if (proc.state === 'running' || proc.state === 'starting') {
            throw new DaemonError(ErrorCodes.AGENT_ALREADY_RUNNING, 'Agent is already running', 409);
        }

        const runningCount = [...this.processes.values()].filter((p) => p.state === 'running' || p.state === 'starting').length;
        if (runningCount >= this.maxProcesses) {
            throw new DaemonError(ErrorCodes.AGENT_LIMIT_REACHED, `Max ${this.maxProcesses} agent processes reached`, 429);
        }

        proc.state = 'starting';
        proc.lastError = null;

        const child = spawn(proc.config.command, proc.config.args, {
            cwd: proc.config.cwd ?? process.cwd(),
            env: { ...process.env, ...proc.config.env },
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        // Wait for the process to confirm it started (pid assigned) or fail
        await new Promise<void>((resolve, reject) => {
            const onError = (err: Error) => {
                child.removeListener('spawn', onSpawn);
                proc.state = 'failed';
                proc.lastError = err.message;
                proc.pid = null;
                this.childProcesses.delete(id);
                logger.error({ err, agentId: id }, 'Agent process error');
                this.emit('agent.failed', { agentId: id, error: err.message });
                reject(err);
            };
            const onSpawn = () => {
                child.removeListener('error', onError);
                resolve();
            };
            child.once('error', onError);
            child.once('spawn', onSpawn);
        });

        if (!child.pid) {
            proc.state = 'failed';
            throw new Error('Failed to spawn process');
        }

        this.childProcesses.set(id, child);
        proc.pid = child.pid;
        proc.state = 'running';
        proc.lastStartedAt = Date.now();

        child.stdout?.on('data', (data: Buffer) => {
            let buf = (this.lineBuffers.get(id) ?? '') + data.toString();
            const lines = buf.split('\n');
            buf = lines.pop() ?? '';
            this.lineBuffers.set(id, buf);
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                    const message = JSON.parse(trimmed);
                    this.emit('agent.output', { agentId: id, message });
                } catch {
                    logger.debug({ agentId: id, line: trimmed }, 'Agent stdout (non-JSON)');
                }
            }
        });

        child.stderr?.on('data', (data: Buffer) => {
            logger.warn({ agentId: id, stderr: data.toString().trim() }, 'Agent stderr');
        });

        child.on('exit', (code, signal) => {
            this.handleExit(id, code, signal);
        });

        child.on('error', (err) => {
            proc.state = 'failed';
            proc.lastError = err.message;
            proc.pid = null;
            this.childProcesses.delete(id);
            logger.error({ err, agentId: id }, 'Agent process error');
            this.emit('agent.failed', { agentId: id, error: err.message });
        });

        logger.info({ agentId: id, pid: child.pid }, 'Agent started');
        this.emit('agent.started', { agentId: id, pid: child.pid });
        return child.pid;
    }

    async stop(id: string): Promise<void> {
        const proc = this.processes.get(id);
        if (!proc) throw new DaemonError(ErrorCodes.AGENT_NOT_FOUND, 'Agent not found', 404);

        const child = this.childProcesses.get(id);
        if (!child || proc.state === 'stopped') return;

        proc.state = 'stopping';
        child.kill('SIGTERM');

        await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                child.kill('SIGKILL');
                resolve();
            }, 5_000);

            child.once('exit', () => {
                clearTimeout(timeout);
                resolve();
            });
        });

        proc.state = 'stopped';
        proc.pid = null;
        this.childProcesses.delete(id);
        logger.info({ agentId: id }, 'Agent stopped');
        this.emit('agent.stopped', { agentId: id });
    }

    sendToAgent(agentId: string, data: unknown): void {
        const child = this.childProcesses.get(agentId);
        const proc = this.processes.get(agentId);
        if (!child || !proc || proc.state !== 'running') {
            throw new DaemonError(ErrorCodes.AGENT_NOT_FOUND, `Agent '${agentId}' is not running`, 409);
        }
        const line = JSON.stringify(data) + '\n';
        child.stdin?.write(line);
    }

    async remove(id: string): Promise<void> {
        const proc = this.processes.get(id);
        if (!proc) throw new DaemonError(ErrorCodes.AGENT_NOT_FOUND, 'Agent not found', 404);

        if (proc.state === 'running' || proc.state === 'starting') {
            await this.stop(id);
        }

        this.db.prepare('DELETE FROM agents WHERE id = ?').run(id);
        this.processes.delete(id);
        logger.info({ agentId: id }, 'Agent removed');
    }

    list(): AgentProcess[] {
        return [...this.processes.values()];
    }

    get(id: string): AgentProcess | undefined {
        return this.processes.get(id);
    }

    private handleExit(id: string, code: number | null, signal: string | null): void {
        const proc = this.processes.get(id);
        if (!proc) return;

        proc.pid = null;
        proc.lastExitCode = code;
        this.childProcesses.delete(id);
        this.lineBuffers.delete(id);

        if (proc.state === 'stopping') {
            proc.state = 'stopped';
            return;
        }

        proc.state = 'crashed';
        logger.warn({ agentId: id, code, signal }, 'Agent crashed');
        this.emit('agent.crashed', { agentId: id, exitCode: code, signal });

        if (proc.restartCount < proc.config.maxRestarts) {
            proc.restartCount++;
            const delay = Math.min(1000 * Math.pow(2, proc.restartCount - 1), 30_000);
            logger.info({ agentId: id, restartCount: proc.restartCount, delay }, 'Scheduling restart');
            setTimeout(() => {
                if (proc.state === 'crashed') {
                    this.start(id).catch((err) => {
                        logger.error({ err, agentId: id }, 'Restart failed');
                    });
                }
            }, delay);
        } else {
            proc.state = 'stopped';
            logger.error({ agentId: id, restartCount: proc.restartCount }, 'Max restarts reached');
        }
    }

    private healthCheck(): void {
        for (const [id, proc] of this.processes) {
            if (proc.state !== 'running') continue;
            const child = this.childProcesses.get(id);
            if (!child || child.exitCode !== null) {
                proc.state = 'crashed';
                proc.pid = null;
                this.childProcesses.delete(id);
            }
        }
    }

    private rowToConfig(row: Record<string, unknown>): AgentConfig {
        return {
            id: row.id as string,
            name: row.name as string,
            command: row.command as string,
            args: JSON.parse(row.args as string),
            cwd: (row.cwd as string) ?? undefined,
            env: JSON.parse(row.env as string),
            autoStart: (row.auto_start as number) === 1,
            maxRestarts: row.max_restarts as number,
        };
    }
}
