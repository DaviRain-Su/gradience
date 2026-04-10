/**
 * Gateway Store — SQLite persistence for purchase-task-settlement mapping
 */

import Database from 'better-sqlite3';
import type { GatewayPurchaseRecord, PurchaseStatus } from './types.js';
import { GatewayError, GW_STORE_ERROR } from './errors.js';

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS gateway_purchases (
    purchase_id TEXT PRIMARY KEY,
    buyer TEXT NOT NULL,
    workflow_id TEXT NOT NULL,
    amount TEXT NOT NULL,
    tx_signature TEXT NOT NULL UNIQUE,
    block_time INTEGER NOT NULL,
    preferred_agent TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    task_id TEXT,
    agent_id TEXT,
    result_hash TEXT,
    settlement_tx TEXT,
    score INTEGER,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_status ON gateway_purchases(status);
CREATE INDEX IF NOT EXISTS idx_tx_signature ON gateway_purchases(tx_signature);
CREATE INDEX IF NOT EXISTS idx_task_id ON gateway_purchases(task_id);

CREATE TABLE IF NOT EXISTS gateway_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
`;

export class GatewayStore {
    private db: Database.Database;

    constructor(dbPath: string) {
        try {
            this.db = new Database(dbPath);
            this.db.exec(CREATE_TABLE_SQL);
        } catch (err) {
            throw new GatewayError(
                GW_STORE_ERROR,
                `Failed to initialize gateway store: ${err instanceof Error ? err.message : String(err)}`,
                err,
            );
        }
    }

    insert(record: GatewayPurchaseRecord): void {
        const sql = `
      INSERT INTO gateway_purchases (
        purchase_id, buyer, workflow_id, amount, tx_signature, block_time,
        preferred_agent, status, task_id, agent_id, result_hash, settlement_tx,
        score, attempts, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(purchase_id) DO NOTHING
    `;
        try {
            this.db
                .prepare(sql)
                .run(
                    record.purchaseId,
                    record.buyer,
                    record.workflowId,
                    record.amount,
                    record.txSignature,
                    record.blockTime,
                    record.preferredAgent ?? null,
                    record.status,
                    record.taskId ?? null,
                    record.agentId ?? null,
                    record.resultHash ?? null,
                    record.settlementTx ?? null,
                    record.score ?? null,
                    record.attempts,
                    record.createdAt,
                    record.updatedAt,
                );
        } catch (err) {
            throw new GatewayError(
                GW_STORE_ERROR,
                `Insert failed: ${err instanceof Error ? err.message : String(err)}`,
                err,
            );
        }
    }

    update(purchaseId: string, patch: Partial<GatewayPurchaseRecord>): void {
        const allowedKeys = [
            'buyer',
            'workflowId',
            'amount',
            'txSignature',
            'blockTime',
            'preferredAgent',
            'status',
            'taskId',
            'agentId',
            'resultHash',
            'settlementTx',
            'score',
            'attempts',
            'createdAt',
            'updatedAt',
        ] as const;

        const entries = Object.entries(patch).filter(([k]) => allowedKeys.includes(k as (typeof allowedKeys)[number]));

        if (entries.length === 0) return;

        const setClause = entries.map(([k]) => `${snakeCase(k)} = ?`).join(', ');
        const values = entries.map(([, v]) => (v === undefined ? null : v));

        const sql = `UPDATE gateway_purchases SET ${setClause} WHERE purchase_id = ?`;
        try {
            this.db.prepare(sql).run(...values, purchaseId);
        } catch (err) {
            throw new GatewayError(
                GW_STORE_ERROR,
                `Update failed: ${err instanceof Error ? err.message : String(err)}`,
                err,
            );
        }
    }

    getByPurchaseId(purchaseId: string): GatewayPurchaseRecord | null {
        const row = this.db.prepare('SELECT * FROM gateway_purchases WHERE purchase_id = ?').get(purchaseId) as
            | RawRow
            | undefined;
        return row ? toRecord(row) : null;
    }

    getByTxSignature(txSignature: string): GatewayPurchaseRecord | null {
        const row = this.db.prepare('SELECT * FROM gateway_purchases WHERE tx_signature = ?').get(txSignature) as
            | RawRow
            | undefined;
        return row ? toRecord(row) : null;
    }

    getByTaskId(taskId: string): GatewayPurchaseRecord | null {
        const row = this.db.prepare('SELECT * FROM gateway_purchases WHERE task_id = ?').get(taskId) as
            | RawRow
            | undefined;
        return row ? toRecord(row) : null;
    }

    listByStatus(status: PurchaseStatus, limit = 100): GatewayPurchaseRecord[] {
        const rows = this.db
            .prepare('SELECT * FROM gateway_purchases WHERE status = ? LIMIT ?')
            .all(status, limit) as RawRow[];
        return rows.map(toRecord);
    }

    // ------------------------------------------------------------------
    // Meta / Cursor persistence
    // ------------------------------------------------------------------

    getMeta(key: string): string | null {
        const row = this.db.prepare('SELECT value FROM gateway_meta WHERE key = ?').get(key) as
            | { value: string }
            | undefined;
        return row?.value ?? null;
    }

    setMeta(key: string, value: string): void {
        this.db.prepare('INSERT INTO gateway_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
    }

    close(): void {
        this.db.close();
    }
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function snakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

interface RawRow {
    purchase_id: string;
    buyer: string;
    workflow_id: string;
    amount: string;
    tx_signature: string;
    block_time: number;
    preferred_agent: string | null;
    status: PurchaseStatus;
    task_id: string | null;
    agent_id: string | null;
    result_hash: string | null;
    settlement_tx: string | null;
    score: number | null;
    attempts: number;
    created_at: string;
    updated_at: string;
}

function toRecord(row: RawRow): GatewayPurchaseRecord {
    return {
        purchaseId: row.purchase_id,
        buyer: row.buyer,
        workflowId: row.workflow_id,
        amount: row.amount,
        txSignature: row.tx_signature,
        blockTime: row.block_time,
        preferredAgent: row.preferred_agent ?? undefined,
        status: row.status,
        taskId: row.task_id ?? undefined,
        agentId: row.agent_id ?? undefined,
        resultHash: row.result_hash ?? undefined,
        settlementTx: row.settlement_tx ?? undefined,
        score: row.score ?? undefined,
        attempts: row.attempts,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
