import Database from 'better-sqlite3';

const CREATE_MEMORY_TABLE_SQL = `
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
`;

export interface TaskMemoryRecord {
    id: number;
    taskId: string;
    agentId: string | null;
    observation: string;
    importance: number;
    createdAt: string;
}

export interface TaskMemoryService {
    record(taskId: string, agentId: string | null, observation: string, importance?: number): void;
    retrieve(taskId: string, limit?: number): string[];
    retrieveTop(taskId: string, limit?: number): string[];
}

export class SQLiteTaskMemoryService implements TaskMemoryService {
    private db: Database.Database;

    constructor(dbPath: string) {
        this.db = new Database(dbPath);
        this.db.exec(CREATE_MEMORY_TABLE_SQL);
    }

    record(taskId: string, agentId: string | null, observation: string, importance = 3): void {
        const sql = `INSERT INTO task_memory (task_id, agent_id, observation, importance, created_at) VALUES (?, ?, ?, ?, ?)`;
        this.db.prepare(sql).run(taskId, agentId ?? null, observation, Math.max(1, Math.min(5, importance)), new Date().toISOString());
    }

    retrieve(taskId: string, limit = 5): string[] {
        const rows = this.db.prepare('SELECT observation FROM task_memory WHERE task_id = ? ORDER BY created_at DESC LIMIT ?').all(taskId, limit) as { observation: string }[];
        return rows.map((r) => r.observation);
    }

    retrieveTop(taskId: string, limit = 5): string[] {
        const rows = this.db.prepare('SELECT observation FROM task_memory WHERE task_id = ? ORDER BY importance DESC, created_at DESC LIMIT ?').all(taskId, limit) as { observation: string }[];
        return rows.map((r) => r.observation);
    }

    formatForPrompt(taskId: string, limit = 5): string {
        const observations = this.retrieveTop(taskId, limit);
        if (observations.length === 0) return '';
        return '## Task Context (from memory)\n' + observations.map((o) => `- ${o}`).join('\n');
    }
}
