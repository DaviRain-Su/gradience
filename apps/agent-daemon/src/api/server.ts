import Fastify from 'fastify';
import { logger } from '../utils/logger.js';
import { createAuthHook } from './auth-middleware.js';
import { registerStatusRoutes } from './routes/status.js';
import { registerTaskRoutes } from './routes/tasks.js';
import { registerAgentRoutes } from './routes/agents.js';
import { registerMessageRoutes } from './routes/messages.js';
import { registerKeyRoutes } from './routes/keys.js';
import type { ConnectionManager } from '../connection/connection-manager.js';
import type { TaskQueue } from '../tasks/task-queue.js';
import type { ProcessManager } from '../agents/process-manager.js';
import type { MessageRouter } from '../messages/message-router.js';
import type { KeyManager } from '../keys/key-manager.js';

export interface APIServerDeps {
    host: string;
    port: number;
    authToken: string;
    connectionManager: ConnectionManager;
    taskQueue: TaskQueue;
    processManager: ProcessManager;
    messageRouter: MessageRouter;
    keyManager: KeyManager;
    startedAt: number;
    version: string;
}

export async function createAPIServer(deps: APIServerDeps) {
    const app = Fastify({ logger: false });

    app.addHook('onRequest', createAuthHook(deps.authToken));

    registerStatusRoutes(app, {
        connectionManager: deps.connectionManager,
        taskQueue: deps.taskQueue,
        processManager: deps.processManager,
        startedAt: deps.startedAt,
        version: deps.version,
    });
    registerTaskRoutes(app, deps.taskQueue);
    registerAgentRoutes(app, deps.processManager);
    registerMessageRoutes(app, deps.messageRouter);
    registerKeyRoutes(app, deps.keyManager);

    await app.listen({ host: deps.host, port: deps.port });
    logger.info({ host: deps.host, port: deps.port }, 'API server listening');

    return app;
}
