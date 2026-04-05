import type { FastifyInstance } from 'fastify';
import type { ConnectionManager } from '../../connection/connection-manager.js';
import type { TaskQueue } from '../../tasks/task-queue.js';
import type { ProcessManager } from '../../agents/process-manager.js';
import type { A2ARouter } from '../../a2a-router/router.js';

interface StatusDeps {
    connectionManager: ConnectionManager;
    taskQueue: TaskQueue;
    processManager: ProcessManager;
    a2aRouter?: A2ARouter | null;
    startedAt: number;
    version: string;
}

export function registerStatusRoutes(app: FastifyInstance, deps: StatusDeps): void {
    app.get('/health', async () => {
        const baseHealth = {
            status: 'ok',
            uptime: Date.now() - deps.startedAt,
            version: deps.version,
        };

        // Include A2A health if available
        if (deps.a2aRouter?.isInitialized()) {
            const a2aHealth = deps.a2aRouter.health();
            const systemHealth = deps.a2aRouter.getSystemHealth();
            return {
                ...baseHealth,
                a2a: {
                    initialized: a2aHealth.initialized,
                    availableProtocols: a2aHealth.availableProtocols,
                    totalPeers: a2aHealth.totalPeers,
                    activeSubscriptions: a2aHealth.activeSubscriptions,
                    systemStatus: systemHealth.status,
                    circuits: Object.keys(systemHealth.circuits).reduce((acc, key) => {
                        acc[key] = systemHealth.circuits[key]?.state ?? 'unknown';
                        return acc;
                    }, {} as Record<string, string>),
                },
            };
        }

        return baseHealth;
    });

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
