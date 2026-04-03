import { EventEmitter } from 'node:events';
import type { TaskQueue, Task } from './task-queue.js';
import type { ProcessManager } from '../agents/process-manager.js';
import { logger } from '../utils/logger.js';

export class TaskExecutor extends EventEmitter {
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private running = false;

    constructor(
        private readonly taskQueue: TaskQueue,
        private readonly processManager: ProcessManager,
        private readonly pollInterval = 1_000,
    ) {
        super();
    }

    start(): void {
        if (this.running) return;
        this.running = true;
        this.pollTimer = setInterval(() => this.poll(), this.pollInterval);
        logger.info('TaskExecutor started');
    }

    stop(): void {
        this.running = false;
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        logger.info('TaskExecutor stopped');
    }

    private poll(): void {
        const task = this.taskQueue.dequeue();
        if (!task) return;

        this.executeTask(task).catch((err) => {
            logger.error({ err, taskId: task.id }, 'Task execution failed');
        });
    }

    private async executeTask(task: Task): Promise<void> {
        const agents = this.processManager.list().filter((a) => a.state === 'running');
        if (agents.length === 0) {
            logger.warn({ taskId: task.id }, 'No running agents, re-queuing task');
            this.taskQueue.updateState(task.id, 'queued');
            return;
        }

        const agent = agents[0];
        this.taskQueue.updateState(task.id, 'running', { assignedAgent: agent.config.id });

        this.emit('task.started', { taskId: task.id, agentId: agent.config.id });
        logger.info({ taskId: task.id, agentId: agent.config.id }, 'Task assigned to agent');

        try {
            // For MVP: the task payload is sent to the agent via a simple mechanism.
            // Future: proper IPC / stdin protocol with the agent process.
            const result = await this.waitForResult(task, 60_000);

            this.taskQueue.updateState(task.id, 'completed', { result });
            this.emit('task.completed', this.taskQueue.get(task.id));
            logger.info({ taskId: task.id }, 'Task completed');
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            const currentTask = this.taskQueue.get(task.id);
            if (!currentTask) return;

            if (currentTask.retries < currentTask.maxRetries) {
                this.taskQueue.updateState(task.id, 'queued', { error: errorMsg });
                const retryStmt = this.taskQueue['db'].prepare('UPDATE tasks SET retries = retries + 1 WHERE id = ?');
                retryStmt.run(task.id);
                logger.warn({ taskId: task.id, retries: currentTask.retries + 1 }, 'Task failed, re-queuing');
                this.emit('task.failed', this.taskQueue.get(task.id));
            } else {
                this.taskQueue.updateState(task.id, 'dead', { error: errorMsg });
                logger.error({ taskId: task.id }, 'Task dead after max retries');
                this.emit('task.failed', this.taskQueue.get(task.id));
            }
        }
    }

    private waitForResult(_task: Task, timeoutMs: number): Promise<unknown> {
        // MVP: simulate task completion. In production, this will communicate
        // with the agent process via IPC and wait for a result message.
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Task execution timeout'));
            }, timeoutMs);

            // For now, resolve immediately with an acknowledgement.
            // Real implementation will hook into agent IPC.
            clearTimeout(timer);
            resolve({ status: 'acknowledged', timestamp: Date.now() });
        });
    }
}
