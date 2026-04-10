import Database from 'better-sqlite3';
import type { DatabaseInstance } from '../types/database.js';
import { mkdirSync, existsSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { logger } from '../utils/logger.js';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tasks (
    id            TEXT PRIMARY KEY,
    type          TEXT NOT NULL,
    payload       TEXT NOT NULL,
    priority      INTEGER NOT NULL DEFAULT 0,
    state         TEXT NOT NULL DEFAULT 'queued',
    retries       INTEGER NOT NULL DEFAULT 0,
    max_retries   INTEGER NOT NULL DEFAULT 3,
    result        TEXT,
    error         TEXT,
    assigned_agent TEXT,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    completed_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks(state);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority DESC, created_at ASC);

CREATE TABLE IF NOT EXISTS messages (
    id            TEXT PRIMARY KEY,
    direction     TEXT NOT NULL,
    from_addr     TEXT NOT NULL,
    to_addr       TEXT NOT NULL,
    type          TEXT NOT NULL,
    payload       TEXT NOT NULL,
    protocol      TEXT,
    created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

CREATE TABLE IF NOT EXISTS agents (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    command       TEXT NOT NULL,
    args          TEXT NOT NULL DEFAULT '[]',
    cwd           TEXT,
    env           TEXT NOT NULL DEFAULT '{}',
    auto_start    INTEGER NOT NULL DEFAULT 0,
    max_restarts  INTEGER NOT NULL DEFAULT 3,
    cpu_limit     REAL,
    memory_limit  INTEGER,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cache (
    key           TEXT PRIMARY KEY,
    value         TEXT NOT NULL,
    expires_at    INTEGER
);

CREATE TABLE IF NOT EXISTS wallet_authorizations (
    agent_wallet  TEXT PRIMARY KEY,
    master_wallet TEXT NOT NULL,
    authorized    INTEGER NOT NULL DEFAULT 0,
    policy        TEXT NOT NULL,
    authorized_at INTEGER NOT NULL,
    expires_at    INTEGER
);

CREATE TABLE IF NOT EXISTS wallet_challenges (
    challenge     TEXT PRIMARY KEY,
    created_at    INTEGER NOT NULL,
    expires_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS wallet_spend_log (
    id              TEXT PRIMARY KEY,
    amount_lamports INTEGER NOT NULL,
    program         TEXT NOT NULL,
    tx_signature    TEXT NOT NULL,
    created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spend_log_created ON wallet_spend_log(created_at);

CREATE TABLE IF NOT EXISTS evaluations (
    id            TEXT PRIMARY KEY,
    task_id       TEXT NOT NULL,
    agent_id      TEXT NOT NULL,
    type          TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    score         REAL,
    passed        INTEGER,
    reasoning     TEXT,
    result        TEXT,
    created_at    INTEGER NOT NULL,
    completed_at  INTEGER,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evaluations_task_id ON evaluations(task_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluations(status);
CREATE INDEX IF NOT EXISTS idx_evaluations_created_at ON evaluations(created_at DESC);

CREATE TABLE IF NOT EXISTS revenue_distributions (
    id                TEXT PRIMARY KEY,
    task_id           TEXT NOT NULL,
    payment_id        TEXT NOT NULL,
    agent_address     TEXT NOT NULL,
    judge_address     TEXT NOT NULL,
    token_mint        TEXT NOT NULL,
    total_amount      TEXT NOT NULL,
    agent_amount      TEXT NOT NULL,
    judge_amount      TEXT NOT NULL,
    protocol_amount   TEXT NOT NULL,
    agent_percentage  INTEGER NOT NULL DEFAULT 9500,
    judge_percentage  INTEGER NOT NULL DEFAULT 300,
    protocol_percentage INTEGER NOT NULL DEFAULT 200,
    escrow_account    TEXT NOT NULL,
    tx_signature      TEXT,
    status            TEXT NOT NULL DEFAULT 'pending',
    error             TEXT,
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL,
    confirmed_at      INTEGER,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_revenue_task_id ON revenue_distributions(task_id);
CREATE INDEX IF NOT EXISTS idx_revenue_status ON revenue_distributions(status);
CREATE INDEX IF NOT EXISTS idx_revenue_created_at ON revenue_distributions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_tx_signature ON revenue_distributions(tx_signature);
`;

export function initDatabase(dbPath: string): DatabaseInstance {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    const db = new Database(dbPath);

    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');

    db.exec(SCHEMA_SQL);

    try {
        chmodSync(dbPath, 0o600);
    } catch {
        // may fail on Windows
    }

    logger.info({ dbPath }, 'Database initialized');
    return db;
}

CREATE TABLE IF NOT EXISTS task_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    agent_id TEXT,
    observation TEXT NOT NULL,
    importance INTEGER NOT NULL DEFAULT 3,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_memory_task_id ON task_memory(task_id);
CREATE INDEX IF NOT EXISTS idx_task_memory_importance ON task_memory(importance);
