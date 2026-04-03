import type { FastifyInstance } from 'fastify';
import type { ConnectionManager } from '../../connection/connection-manager.js';
import type { TaskQueue } from '../../tasks/task-queue.js';
import type { ProcessManager } from '../../agents/process-manager.js';

interface StatusDeps {
    connectionManager: ConnectionManager;
    taskQueue: TaskQueue;
    processManager: ProcessManager;
    startedAt: number;
    version: string;
}

export function registerStatusRoutes(app: FastifyInstance, deps: StatusDeps): void {
    app.get('/api/v1/status', async () => {
        const agents = deps.processManager.list();
        const counts = deps.taskQueue.counts();
        return {
            status: 'running',
            connection: deps.connectionManager.getState(),
            uptime: Date.now() - deps.startedAt,
            version: deps.version,
            agents: {
                total: agents.length,
                running: agents.filter((a) => a.state === 'running').length,
            },
            tasks: counts,
        };
    });
}
