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
        private readonly taskTimeoutMs = 60_000,
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
            const result = await this.waitForResult(task, agent.config.id, this.taskTimeoutMs);

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

    private waitForResult(task: Task, agentId: string, timeoutMs: number): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                clearTimeout(timer);
                this.processManager.off('agent.output', onOutput);
                this.processManager.off('agent.crashed', onAgentGone);
                this.processManager.off('agent.failed', onAgentGone);
                this.processManager.off('agent.stopped', onAgentGone);
            };

            const timer = setTimeout(() => {
                cleanup();
                reject(new Error('Task execution timeout'));
            }, timeoutMs);

            const onOutput = ({ agentId: aid, message }: { agentId: string; message: unknown }) => {
                if (aid !== agentId) return;
                const msg = message as Record<string, unknown>;
                if (msg.taskId !== task.id) return;

                if (msg.type === 'result') {
                    cleanup();
                    resolve(msg.result);
                } else if (msg.type === 'error') {
                    cleanup();
                    reject(new Error(typeof msg.error === 'string' ? msg.error : 'Agent reported error'));
                } else if (msg.type === 'progress') {
                    this.emit('task.progress', { taskId: task.id, agentId, progress: msg.progress });
                }
            };

            const onAgentGone = ({ agentId: aid }: { agentId: string }) => {
                if (aid !== agentId) return;
                cleanup();
                reject(new Error(`Agent '${agentId}' exited during task execution`));
            };

            this.processManager.on('agent.output', onOutput);
            this.processManager.on('agent.crashed', onAgentGone);
            this.processManager.on('agent.failed', onAgentGone);
            this.processManager.on('agent.stopped', onAgentGone);

            try {
                this.processManager.sendToAgent(agentId, {
                    type: 'task',
                    taskId: task.id,
                    payload: task.payload,
                });
            } catch (err) {
                cleanup();
                reject(err);
            }
        });
    }
}
