import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { TaskQueue } from '../../src/tasks/task-queue.js';
import { DaemonError } from '../../src/utils/errors.js';

describe('TaskQueue', () => {
    let db: Database.Database;
    let queue: TaskQueue;

    beforeEach(() => {
        db = new Database(':memory:');
        db.exec(`
            CREATE TABLE tasks (
                id TEXT PRIMARY KEY, type TEXT NOT NULL, payload TEXT NOT NULL,
                priority INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'queued',
                retries INTEGER NOT NULL DEFAULT 0, max_retries INTEGER NOT NULL DEFAULT 3,
                result TEXT, error TEXT, assigned_agent TEXT,
                created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, completed_at INTEGER
            );
            CREATE INDEX idx_tasks_state ON tasks(state);
            CREATE INDEX idx_tasks_priority ON tasks(priority DESC, created_at ASC);
        `);
        queue = new TaskQueue(db);
    });

    afterEach(() => {
        db.close();
    });

    // Happy Path
    it('H1: should enqueue a new task', () => {
        const task = queue.enqueue('t1', 'task_proposal', { data: 'test' });
        expect(task).not.toBeNull();
        expect(task!.id).toBe('t1');
        expect(task!.state).toBe('queued');
        expect(task!.priority).toBe(0);
    });

    it('H2: should dequeue by priority then FIFO', () => {
        queue.enqueue('low1', 'task', {}, 0);
        queue.enqueue('high1', 'task', {}, 2);
        queue.enqueue('mid1', 'task', {}, 1);

        const first = queue.dequeue();
        expect(first!.id).toBe('high1');

        const second = queue.dequeue();
        expect(second!.id).toBe('mid1');

        const third = queue.dequeue();
        expect(third!.id).toBe('low1');
    });

    it('H3: should update task state', () => {
        queue.enqueue('t1', 'task', {});
        queue.updateState('t1', 'running', { assignedAgent: 'agent-1' });
        const task = queue.get('t1');
        expect(task!.state).toBe('running');
        expect(task!.assignedAgent).toBe('agent-1');
    });

    it('H4: should cancel a queued task', () => {
        queue.enqueue('t1', 'task', {});
        queue.cancel('t1');
        const task = queue.get('t1');
        expect(task!.state).toBe('cancelled');
    });

    it('H5: should list tasks filtered by state', () => {
        queue.enqueue('t1', 'task', {});
        queue.enqueue('t2', 'task', {});
        queue.cancel('t2');

        const queued = queue.list(['queued']);
        expect(queued).toHaveLength(1);
        expect(queued[0].id).toBe('t1');
    });

    it('H6: should return correct counts', () => {
        queue.enqueue('t1', 'task', {});
        queue.enqueue('t2', 'task', {});
        queue.updateState('t2', 'completed');

        const counts = queue.counts();
        expect(counts.queued).toBe(1);
        expect(counts.completed).toBe(1);
        expect(counts.total).toBe(2);
    });

    // Boundary
    it('B1: should return null on empty queue dequeue', () => {
        const task = queue.dequeue();
        expect(task).toBeNull();
    });

    it('B2: should reject cancel on completed task', () => {
        queue.enqueue('t1', 'task', {});
        queue.updateState('t1', 'completed');
        expect(() => queue.cancel('t1')).toThrow(DaemonError);
    });

    it('B3: should handle duplicate task ID idempotently', () => {
        const first = queue.enqueue('t1', 'task', { v: 1 });
        const second = queue.enqueue('t1', 'task', { v: 2 });
        expect(first).not.toBeNull();
        expect(second).toBeNull();
        expect(queue.get('t1')!.payload).toEqual({ v: 1 });
    });

    // Error
    it('E1: should throw TASK_NOT_FOUND for non-existent task', () => {
        expect(() => queue.updateState('nonexistent', 'running')).toThrow(DaemonError);
    });

    // Recovery
    it('should recover interrupted tasks on startup', () => {
        queue.enqueue('t1', 'task', {});
        queue.enqueue('t2', 'task', {});
        queue.updateState('t1', 'running');
        queue.updateState('t2', 'assigned');

        const recovered = queue.recoverOnStartup();
        expect(recovered).toBe(2);
        expect(queue.get('t1')!.state).toBe('queued');
        expect(queue.get('t2')!.state).toBe('queued');
    });
});
