import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import Database from 'better-sqlite3';
import { TaskQueue } from '../../src/tasks/task-queue.js';
import { TaskExecutor } from '../../src/tasks/task-executor.js';
import type { ProcessManager } from '../../src/agents/process-manager.js';

const AGENT_ID = 'agent-1';
const POLL_MS = 100;
const TIMEOUT_MS = 500;

// Minimal fake ProcessManager that acts as an EventEmitter with controllable sendToAgent
function makeFakeProcessManager(agentRunning = true) {
    const emitter = new EventEmitter() as EventEmitter & {
        list: () => { config: { id: string }; state: string }[];
        sendToAgent: (id: string, data: unknown) => void;
        sentMessages: { id: string; data: unknown }[];
    };

    emitter.sentMessages = [];
    emitter.list = () =>
        agentRunning ? [{ config: { id: AGENT_ID }, state: 'running' }] : [];
    emitter.sendToAgent = (id: string, data: unknown) => {
        emitter.sentMessages.push({ id, data });
    };

    return emitter;
}

function makeDb() {
    const db = new Database(':memory:');
    db.exec(`
        CREATE TABLE tasks (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            payload TEXT NOT NULL DEFAULT '{}',
            priority INTEGER NOT NULL DEFAULT 0,
            state TEXT NOT NULL DEFAULT 'queued',
            retries INTEGER NOT NULL DEFAULT 0,
            max_retries INTEGER NOT NULL DEFAULT 3,
            result TEXT,
            error TEXT,
            assigned_agent TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            completed_at INTEGER
        );
    `);
    return db;
}

describe('TaskExecutor IPC protocol', () => {
    let db: Database.Database;
    let queue: TaskQueue;
    let fakepm: ReturnType<typeof makeFakeProcessManager>;
    let executor: TaskExecutor;

    beforeEach(() => {
        vi.useFakeTimers();
        db = makeDb();
        queue = new TaskQueue(db);
        fakepm = makeFakeProcessManager();
        executor = new TaskExecutor(
            queue,
            fakepm as unknown as ProcessManager,
            POLL_MS,
            TIMEOUT_MS,
        );
    });

    afterEach(() => {
        executor.stop();
        vi.useRealTimers();
        db.close();
    });

    // Helper: advance time by `ms` and flush microtasks
    async function tick(ms = POLL_MS + 10) {
        await vi.advanceTimersByTimeAsync(ms);
    }

    it('sends task payload to agent via sendToAgent', async () => {
        const taskId = 'task-send-1';
        queue.enqueue(taskId, 'test', { foo: 'bar' });

        executor.start();
        await tick(); // trigger first poll

        expect(fakepm.sentMessages).toHaveLength(1);
        const sent = fakepm.sentMessages[0] as { id: string; data: Record<string, unknown> };
        expect(sent.id).toBe(AGENT_ID);
        expect(sent.data.type).toBe('task');
        expect(sent.data.taskId).toBe(taskId);
        expect((sent.data.payload as Record<string, unknown>).foo).toBe('bar');
    });

    it('completes task when agent sends result', async () => {
        const taskId = 'task-result-1';
        queue.enqueue(taskId, 'test', {});

        const completed = new Promise<unknown>((resolve) => {
            executor.on('task.completed', resolve);
        });

        executor.start();
        await tick();

        // Agent responds with a result
        fakepm.emit('agent.output', {
            agentId: AGENT_ID,
            message: { type: 'result', taskId, result: { answer: 42 } },
        });

        await completed;

        const finalTask = queue.get(taskId);
        expect(finalTask?.state).toBe('completed');
        expect((finalTask?.result as Record<string, unknown>).answer).toBe(42);
    });

    it('fails task when agent reports an error message', async () => {
        const taskId = 'task-err-1';
        queue.enqueue(taskId, 'test', {}, 0, 0); // maxRetries=0 → goes dead

        const failed = new Promise<void>((resolve) => {
            executor.on('task.failed', () => resolve());
        });

        executor.start();
        await tick();

        fakepm.emit('agent.output', {
            agentId: AGENT_ID,
            message: { type: 'error', taskId, error: 'something went wrong' },
        });

        await failed;

        const finalTask = queue.get(taskId);
        expect(finalTask?.state).toBe('dead');
        expect(finalTask?.error).toContain('something went wrong');
    });

    it('fails task when agent crashes during execution', async () => {
        const taskId = 'task-crash-1';
        queue.enqueue(taskId, 'test', {}, 0, 0);

        const failed = new Promise<void>((resolve) => {
            executor.on('task.failed', () => resolve());
        });

        executor.start();
        await tick();

        fakepm.emit('agent.crashed', { agentId: AGENT_ID });

        await failed;

        const finalTask = queue.get(taskId);
        expect(finalTask?.state).toBe('dead');
        expect(finalTask?.error).toContain('exited');
    });

    it('retries then marks dead when agent never responds (timeout)', async () => {
        const taskId = 'task-timeout-1';
        queue.enqueue(taskId, 'test', {}, 0, 1); // maxRetries=1 → 2 attempts then dead

        const failed = new Promise<void>((resolve) => {
            executor.on('task.failed', () => resolve());
        });

        executor.start();

        // First attempt: poll → send → timeout
        await tick(); // poll fires, task assigned, sendToAgent called
        expect(fakepm.sentMessages).toHaveLength(1);

        await tick(TIMEOUT_MS + 50); // task timeout fires, re-queued with retry

        // Second attempt: poll again → send again → timeout again → dead
        await tick(POLL_MS + 10);
        expect(fakepm.sentMessages).toHaveLength(2);

        await tick(TIMEOUT_MS + 50);

        await failed;

        const finalTask = queue.get(taskId);
        expect(finalTask?.state).toBe('dead');
        expect(finalTask?.error).toContain('timeout');
    });

    it('ignores output messages for different taskId or agentId', async () => {
        const taskId = 'task-ignore-1';
        queue.enqueue(taskId, 'test', {});

        const completed = new Promise<void>((resolve) => {
            executor.on('task.completed', resolve);
        });

        executor.start();
        await tick();

        // Wrong task ID — should be ignored
        fakepm.emit('agent.output', {
            agentId: AGENT_ID,
            message: { type: 'result', taskId: 'other-task', result: {} },
        });

        // Wrong agent ID — should be ignored
        fakepm.emit('agent.output', {
            agentId: 'other-agent',
            message: { type: 'result', taskId, result: {} },
        });

        // Task should still be running
        expect(queue.get(taskId)?.state).toBe('running');

        // Now the correct message
        fakepm.emit('agent.output', {
            agentId: AGENT_ID,
            message: { type: 'result', taskId, result: { ok: true } },
        });

        await completed;
        expect(queue.get(taskId)?.state).toBe('completed');
    });

    it('emits task.progress for progress messages without completing', async () => {
        const taskId = 'task-progress-1';
        queue.enqueue(taskId, 'test', {});

        const progressValues: number[] = [];
        executor.on('task.progress', ({ progress }: { taskId: string; progress: number }) => {
            progressValues.push(progress);
        });

        executor.start();
        await tick();

        fakepm.emit('agent.output', {
            agentId: AGENT_ID,
            message: { type: 'progress', taskId, progress: 25 },
        });
        fakepm.emit('agent.output', {
            agentId: AGENT_ID,
            message: { type: 'progress', taskId, progress: 75 },
        });

        // Task should still be running (not completed yet)
        expect(queue.get(taskId)?.state).toBe('running');
        expect(progressValues).toEqual([25, 75]);

        // Complete it
        fakepm.emit('agent.output', {
            agentId: AGENT_ID,
            message: { type: 'result', taskId, result: {} },
        });

        await new Promise<void>((r) => executor.once('task.completed', r));
        expect(queue.get(taskId)?.state).toBe('completed');
    });

    it('re-queues task when no agents are running', async () => {
        const noAgentPm = makeFakeProcessManager(false);
        const ex2 = new TaskExecutor(
            queue,
            noAgentPm as unknown as ProcessManager,
            POLL_MS,
            TIMEOUT_MS,
        );

        const taskId = 'task-noagent-1';
        queue.enqueue(taskId, 'test', {});

        ex2.start();
        await tick();

        // Task should remain queued (re-queued because no running agents)
        expect(queue.get(taskId)?.state).toBe('queued');
        expect(noAgentPm.sentMessages).toHaveLength(0);

        ex2.stop();
    });
});
