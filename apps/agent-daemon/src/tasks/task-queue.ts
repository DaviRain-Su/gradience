import type Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';

export type TaskState = 'queued' | 'assigned' | 'running' | 'completed' | 'failed' | 'dead' | 'cancelled';
export type TaskPriority = 0 | 1 | 2;

export interface Task {
    id: string;
    type: string;
    payload: unknown;
    priority: TaskPriority;
    state: TaskState;
    retries: number;
    maxRetries: number;
    result: unknown | null;
    error: string | null;
    assignedAgent: string | null;
    createdAt: number;
    updatedAt: number;
    completedAt: number | null;
}

const TERMINAL_STATES: ReadonlySet<TaskState> = new Set(['completed', 'dead', 'cancelled']);

export class TaskQueue {
    private readonly stmtInsert;
    private readonly stmtDequeue;
    private readonly stmtUpdate;
    private readonly stmtGet;
    private readonly stmtList;
    private readonly stmtCount;

    constructor(private readonly db: Database.Database) {
        this.stmtInsert = db.prepare(`
            INSERT OR IGNORE INTO tasks (id, type, payload, priority, state, retries, max_retries, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'queued', 0, ?, ?, ?)
        `);

        this.stmtDequeue = db.prepare(`
            UPDATE tasks SET state = 'assigned', updated_at = ?
            WHERE id = (
                SELECT id FROM tasks WHERE state = 'queued'
                ORDER BY priority DESC, created_at ASC LIMIT 1
            )
            RETURNING *
        `);

        this.stmtUpdate = db.prepare(`
            UPDATE tasks SET state = ?, result = ?, error = ?, assigned_agent = ?, updated_at = ?, completed_at = ?
            WHERE id = ?
        `);

        this.stmtGet = db.prepare('SELECT * FROM tasks WHERE id = ?');

        this.stmtList = db.prepare(`
            SELECT * FROM tasks
            WHERE (? IS NULL OR state IN (SELECT value FROM json_each(?)))
            ORDER BY priority DESC, created_at DESC
            LIMIT ? OFFSET ?
        `);

        this.stmtCount = db.prepare(`
            SELECT
                COUNT(*) FILTER (WHERE state = 'queued') as queued,
                COUNT(*) FILTER (WHERE state = 'running') as running,
                COUNT(*) FILTER (WHERE state = 'completed') as completed,
                COUNT(*) FILTER (WHERE state = 'failed') as failed,
                COUNT(*) as total
            FROM tasks
        `);
    }

    enqueue(id: string, type: string, payload: unknown, priority: TaskPriority = 0, maxRetries = 3): Task | null {
        const now = Date.now();
        const info = this.stmtInsert.run(id, type, JSON.stringify(payload), priority, maxRetries, now, now);
        if (info.changes === 0) {
            logger.debug({ id }, 'Task already exists, skipping');
            return null;
        }
        logger.info({ id, type, priority }, 'Task enqueued');
        return this.get(id);
    }

    dequeue(): Task | null {
        const row = this.stmtDequeue.get(Date.now()) as Record<string, unknown> | undefined;
        if (!row) return null;
        return this.rowToTask(row);
    }

    get(id: string): Task | null {
        const row = this.stmtGet.get(id) as Record<string, unknown> | undefined;
        if (!row) return null;
        return this.rowToTask(row);
    }

    list(states?: TaskState[], limit = 50, offset = 0): Task[] {
        const stateFilter = states ? JSON.stringify(states) : null;
        const rows = this.stmtList.all(stateFilter, stateFilter, Math.min(limit, 200), offset) as Record<string, unknown>[];
        return rows.map((r) => this.rowToTask(r));
    }

    counts(): { queued: number; running: number; completed: number; failed: number; total: number } {
        return this.stmtCount.get() as { queued: number; running: number; completed: number; failed: number; total: number };
    }

    updateState(id: string, state: TaskState, extra?: { result?: unknown; error?: string; assignedAgent?: string }): void {
        const task = this.get(id);
        if (!task) throw new DaemonError(ErrorCodes.TASK_NOT_FOUND, 'Task not found', 404);

        const completedAt = TERMINAL_STATES.has(state) ? Date.now() : null;
        this.stmtUpdate.run(
            state,
            extra?.result != null ? JSON.stringify(extra.result) : task.result ? JSON.stringify(task.result) : null,
            extra?.error ?? task.error,
            extra?.assignedAgent ?? task.assignedAgent,
            Date.now(),
            completedAt,
            id,
        );
    }

    cancel(id: string): void {
        const task = this.get(id);
        if (!task) throw new DaemonError(ErrorCodes.TASK_NOT_FOUND, 'Task not found', 404);
        if (TERMINAL_STATES.has(task.state)) {
            throw new DaemonError(
                ErrorCodes.TASK_NOT_CANCELLABLE,
                `Task in state '${task.state}' cannot be cancelled`,
                409,
            );
        }
        this.updateState(id, 'cancelled');
        logger.info({ id }, 'Task cancelled');
    }

    recoverOnStartup(): number {
        const result = this.db.prepare(`
            UPDATE tasks SET state = 'queued', updated_at = ?
            WHERE state IN ('assigned', 'running')
        `).run(Date.now());
        if (result.changes > 0) {
            logger.info({ count: result.changes }, 'Recovered interrupted tasks');
        }
        return result.changes;
    }

    private rowToTask(row: Record<string, unknown>): Task {
        return {
            id: row.id as string,
            type: row.type as string,
            payload: JSON.parse(row.payload as string),
            priority: row.priority as TaskPriority,
            state: row.state as TaskState,
            retries: row.retries as number,
            maxRetries: row.max_retries as number,
            result: row.result ? JSON.parse(row.result as string) : null,
            error: (row.error as string) ?? null,
            assignedAgent: (row.assigned_agent as string) ?? null,
            createdAt: row.created_at as number,
            updatedAt: row.updated_at as number,
            completedAt: (row.completed_at as number) ?? null,
        };
    }
}
