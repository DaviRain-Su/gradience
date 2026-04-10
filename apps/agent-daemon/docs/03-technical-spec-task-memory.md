# Phase 3: Technical Spec — Task Memory Service

> **Scope**: `apps/agent-daemon/src/storage/` SQLite memory layer
> **Date**: 2026-04-10
> **Task**: GRA-255

## 3.1 数据结构

### `TaskMemoryRecord`
```typescript
interface TaskMemoryRecord {
    id: number;
    taskId: string;
    agentId: string | null;
    observation: string;
    importance: number; // 1-5
    createdAt: string;
}
```

## 3.2 数据库 Schema

```sql
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
```

## 3.3 接口定义

```typescript
export interface TaskMemoryService {
    record(taskId: string, agentId: string | null, observation: string, importance?: number): void;
    retrieve(taskId: string, limit?: number): string[];
    retrieveTop(taskId: string, limit?: number): string[];
}
```

## 3.4 集成策略

- `TaskExecutor` calls `memory.record()` after each step completion with `summary` field
- Before LLM calls in `soul-engine`, `evaluator`, `arena-auto-judge`, inject retrieved observations into system prompt under `## Task Context (from memory)`
- Default `limit` for injection: 5 most important + 5 most recent observations

## 3.5 边界条件

1. Empty memory for a taskId → no context injection, no error
2. Very long observation (>2000 chars) → truncate with ellipsis
3. Daemon restart → memory persists in SQLite
