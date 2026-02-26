import initSqlJs from "sql.js";
import path from "node:path";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import type { StrategySpec } from "../strategy/compiler.js";

export type StrategyRow = {
  id: string;
  template: string;
  spec: StrategySpec;
  createdAt: string;
  updatedAt: string;
  status: string;
};

export type ExecutionRow = {
  id: string;
  strategyId: string;
  mode: string;
  status: string;
  payload: Record<string, unknown>;
  createdAt: string;
  evidence: Record<string, unknown> | null;
};

export type DbHandle = {
  db: any;
  persist: () => void;
};

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "strategies.sqlite");

const WASM_PATH = path.join(
  process.cwd(),
  "node_modules",
  "sql.js",
  "dist",
  "sql-wasm.wasm",
);

export async function openDb(dbPath = DEFAULT_DB_PATH): Promise<DbHandle> {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const SQL = await initSqlJs({ locateFile: () => WASM_PATH });
  const db = existsSync(dbPath) ? new SQL.Database(readFileSync(dbPath)) : new SQL.Database();
  db.exec(`
    CREATE TABLE IF NOT EXISTS strategies (
      id TEXT PRIMARY KEY,
      template TEXT NOT NULL,
      spec_json TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      strategy_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  try {
    const columns = queryAll({ db, persist: () => undefined }, "PRAGMA table_info(executions)");
    const hasEvidence = columns.some((col: any) => col.name === "evidence_json");
    if (!hasEvidence) {
      db.exec("ALTER TABLE executions ADD COLUMN evidence_json TEXT NOT NULL DEFAULT '{}' ");
    }
  } catch {
    // ignore migration errors for fresh DB
  }
  const persist = () => {
    const data = db.export();
    writeFileSync(dbPath, Buffer.from(data));
  };
  return { db, persist };
}

function queryAll(dbHandle: DbHandle, sql: string, params: unknown[] = []) {
  const stmt = dbHandle.db.prepare(sql);
  stmt.bind(params);
  const rows = [] as Array<Record<string, unknown>>;
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export function saveStrategy(dbHandle: DbHandle, spec: StrategySpec) {
  const now = new Date().toISOString();
  const template = spec.metadata.template;
  const stmt = dbHandle.db.prepare(
    `INSERT INTO strategies (id, template, spec_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  stmt.run([spec.id, template, JSON.stringify(spec), "active", now, now]);
  stmt.free();
  dbHandle.persist();
}

export function listStrategies(dbHandle: DbHandle): StrategyRow[] {
  const rows = queryAll(
    dbHandle,
    `SELECT id, template, spec_json, status, created_at, updated_at
     FROM strategies ORDER BY created_at DESC`,
  );
  return rows.map((row: any) => ({
    id: row.id,
    template: row.template,
    spec: JSON.parse(row.spec_json),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getStrategy(dbHandle: DbHandle, id: string): StrategyRow | null {
  const rows = queryAll(
    dbHandle,
    `SELECT id, template, spec_json, status, created_at, updated_at
     FROM strategies WHERE id = ?`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    template: String(row.template),
    spec: JSON.parse(String(row.spec_json)),
    status: String(row.status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function addExecution(
  dbHandle: DbHandle,
  input: Omit<ExecutionRow, "createdAt">,
) {
  const createdAt = new Date().toISOString();
  const stmt = dbHandle.db.prepare(
    `INSERT INTO executions (id, strategy_id, mode, status, payload_json, evidence_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  stmt.run([
    input.id,
    input.strategyId,
    input.mode,
    input.status,
    JSON.stringify(input.payload),
    JSON.stringify(input.evidence || {}),
    createdAt,
  ]);
  stmt.free();
  dbHandle.persist();
}

export function listExecutions(dbHandle: DbHandle): ExecutionRow[] {
  const rows = queryAll(
    dbHandle,
    `SELECT id, strategy_id, mode, status, payload_json, evidence_json, created_at
     FROM executions ORDER BY created_at DESC`,
  );
  return rows.map((row: any) => ({
    id: row.id,
    strategyId: row.strategy_id,
    mode: row.mode,
    status: row.status,
    payload: JSON.parse(row.payload_json),
    evidence: row.evidence_json ? JSON.parse(row.evidence_json) : null,
    createdAt: row.created_at,
  }));
}

export function getExecution(dbHandle: DbHandle, id: string): ExecutionRow | null {
  const rows = queryAll(
    dbHandle,
    `SELECT id, strategy_id, mode, status, payload_json, evidence_json, created_at
     FROM executions WHERE id = ?`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    strategyId: String(row.strategy_id),
    mode: String(row.mode),
    status: String(row.status),
    payload: JSON.parse(String(row.payload_json)),
    evidence: row.evidence_json ? JSON.parse(String(row.evidence_json)) : null,
    createdAt: String(row.created_at),
  };
}
