import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

import type { EnqueueWorkflowInput, WorkflowRecord, WorkflowStatus } from './types.js';

export interface WorkflowStore {
    init(): Promise<void>;
    enqueue(input: EnqueueWorkflowInput): Promise<WorkflowRecord>;
    listPending(limit?: number): Promise<WorkflowRecord[]>;
    claimPending(id: string): Promise<boolean>;
    updateStatus(id: string, status: WorkflowStatus, error?: string | null): Promise<void>;
    close(): Promise<void>;
}

export class InMemoryWorkflowStore implements WorkflowStore {
    private readonly records = new Map<string, WorkflowRecord>();
    private readonly idByDedupe = new Map<string, string>();

    async init(): Promise<void> {}

    async enqueue(input: EnqueueWorkflowInput): Promise<WorkflowRecord> {
        const existingId = this.idByDedupe.get(input.dedupeKey);
        if (existingId) {
            return this.records.get(existingId)!;
        }

        const now = new Date().toISOString();
        const record: WorkflowRecord = {
            id: randomUUID(),
            taskId: input.taskId,
            trigger: input.trigger,
            slot: input.slot,
            timestamp: input.timestamp,
            agent: input.agent,
            status: 'pending',
            dedupeKey: input.dedupeKey,
            error: null,
            createdAt: now,
            updatedAt: now,
        };
        this.records.set(record.id, record);
        this.idByDedupe.set(record.dedupeKey, record.id);
        return record;
    }

    async listPending(limit = 100): Promise<WorkflowRecord[]> {
        const pending = [...this.records.values()]
            .filter(record => record.status === 'pending')
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return pending.slice(0, limit);
    }

    async claimPending(id: string): Promise<boolean> {
        const current = this.records.get(id);
        if (!current || current.status !== 'pending') {
            return false;
        }
        this.records.set(id, {
            ...current,
            status: 'running',
            updatedAt: new Date().toISOString(),
        });
        return true;
    }

    async updateStatus(id: string, status: WorkflowStatus, error: string | null = null): Promise<void> {
        const current = this.records.get(id);
        if (!current) {
            return;
        }
        this.records.set(id, {
            ...current,
            status,
            error,
            updatedAt: new Date().toISOString(),
        });
    }

    async close(): Promise<void> {}

    getById(id: string): WorkflowRecord | null {
        return this.records.get(id) ?? null;
    }
}

export interface PostgresWorkflowStoreOptions {
    databaseUrl: string;
    tableName?: string;
}

export class PostgresWorkflowStore implements WorkflowStore {
    private readonly client: Client;
    private readonly tableName: string;

    constructor(options: PostgresWorkflowStoreOptions) {
        this.client = new Client({ connectionString: options.databaseUrl });
        this.tableName = options.tableName ?? 'judge_daemon_workflows';
    }

    async init(): Promise<void> {
        await this.client.connect();
        await this.client.query(`
            CREATE TABLE IF NOT EXISTS ${this.tableName} (
                id TEXT PRIMARY KEY,
                task_id BIGINT NOT NULL,
                trigger TEXT NOT NULL,
                slot BIGINT NOT NULL,
                event_timestamp BIGINT NOT NULL,
                agent TEXT NULL,
                status TEXT NOT NULL,
                dedupe_key TEXT NOT NULL UNIQUE,
                error TEXT NULL,
                created_at TIMESTAMPTZ NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL
            );
        `);
        await this.client.query(
            `CREATE INDEX IF NOT EXISTS ${this.tableName}_pending_idx ON ${this.tableName} (status, created_at);`,
        );
    }

    async enqueue(input: EnqueueWorkflowInput): Promise<WorkflowRecord> {
        const now = new Date().toISOString();
        const id = randomUUID();
        await this.client.query(
            `
            INSERT INTO ${this.tableName}
                (id, task_id, trigger, slot, event_timestamp, agent, status, dedupe_key, error, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5, $6, 'pending', $7, NULL, $8, $8)
            ON CONFLICT (dedupe_key) DO NOTHING;
        `,
            [id, input.taskId, input.trigger, input.slot, input.timestamp, input.agent, input.dedupeKey, now],
        );

        const row = await this.client.query(
            `
            SELECT id, task_id, trigger, slot, event_timestamp, agent, status, dedupe_key, error, created_at, updated_at
            FROM ${this.tableName}
            WHERE dedupe_key = $1
            LIMIT 1;
            `,
            [input.dedupeKey],
        );
        return toWorkflowRecord(row.rows[0]);
    }

    async listPending(limit = 100): Promise<WorkflowRecord[]> {
        const rows = await this.client.query(
            `
            SELECT id, task_id, trigger, slot, event_timestamp, agent, status, dedupe_key, error, created_at, updated_at
            FROM ${this.tableName}
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT $1;
            `,
            [limit],
        );
        return rows.rows.map(toWorkflowRecord);
    }

    async claimPending(id: string): Promise<boolean> {
        const result = await this.client.query(
            `
            UPDATE ${this.tableName}
            SET status = 'running', updated_at = NOW()
            WHERE id = $1 AND status = 'pending';
            `,
            [id],
        );
        return (result.rowCount ?? 0) > 0;
    }

    async updateStatus(id: string, status: WorkflowStatus, error: string | null = null): Promise<void> {
        await this.client.query(
            `
            UPDATE ${this.tableName}
            SET status = $2, error = $3, updated_at = NOW()
            WHERE id = $1;
            `,
            [id, status, error],
        );
    }

    async close(): Promise<void> {
        await this.client.end();
    }
}

function toWorkflowRecord(row: {
    id: string;
    task_id: number;
    trigger: string;
    slot: number;
    event_timestamp: number;
    agent: string | null;
    status: WorkflowStatus;
    dedupe_key: string;
    error: string | null;
    created_at: Date | string;
    updated_at: Date | string;
}): WorkflowRecord {
    return {
        id: row.id,
        taskId: Number(row.task_id),
        trigger: row.trigger as WorkflowRecord['trigger'],
        slot: Number(row.slot),
        timestamp: Number(row.event_timestamp),
        agent: row.agent,
        status: row.status,
        dedupeKey: row.dedupe_key,
        error: row.error,
        createdAt: toIsoString(row.created_at),
        updatedAt: toIsoString(row.updated_at),
    };
}

function toIsoString(value: Date | string): string {
    if (typeof value === 'string') {
        return value;
    }
    return value.toISOString();
}
