import Fastify from 'fastify';
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import { logger } from '../utils/logger.js';
import { createAuthHook } from './auth-middleware.js';
import { registerStatusRoutes } from './routes/status.js';
import { registerTaskRoutes } from './routes/tasks.js';
import { registerAgentRoutes } from './routes/agents.js';
import { registerMessageRoutes } from './routes/messages.js';
import { registerKeyRoutes } from './routes/keys.js';
import { registerWalletRoutes } from './routes/wallet.js';
import { registerSolanaRoutes } from './routes/solana.js';
import { registerSocialRoutes } from './routes/social.js';
import { registerSessionRoutes } from './routes/session.js';
import { SessionManager } from '../auth/session-manager.js';
import type { ConnectionManager } from '../connection/connection-manager.js';
import type { TaskQueue } from '../tasks/task-queue.js';
import type { ProcessManager } from '../agents/process-manager.js';
import type { MessageRouter } from '../messages/message-router.js';
import type { KeyManager } from '../keys/key-manager.js';
import type { AuthorizationManager } from '../wallet/authorization.js';
import type { TransactionManager } from '../solana/transaction-manager.js';

export interface APIServerDeps {
    host: string;
    port: number;
    authToken: string;
    connectionManager: ConnectionManager;
    taskQueue: TaskQueue;
    processManager: ProcessManager;
    messageRouter: MessageRouter;
    keyManager: KeyManager;
    authorizationManager: AuthorizationManager;
    transactionManager: TransactionManager;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    database: any;
    startedAt: number;
    version: string;
}

export async function createAPIServer(deps: APIServerDeps) {
    const app = Fastify({ logger: false });

    await app.register(compress, { global: true });

    await app.register(cors, {
        origin: [
            'https://agentm.gradiences.xyz',
            'https://www.gradiences.xyz',
            'http://localhost:3000',
            'http://localhost:3001',
        ],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    });

    const sessionManager = new SessionManager(deps.database);

    app.addHook('onRequest', createAuthHook(deps.authToken, sessionManager));

    // Cache headers for GET endpoints
    app.addHook('onSend', async (request, reply, payload) => {
        if (request.method === 'GET') {
            const path = request.url.split('?')[0];
            if (path.startsWith('/api/feed') || path.startsWith('/api/profile/') ||
                path.startsWith('/api/followers/') || path.startsWith('/api/following/')) {
                reply.header('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
            } else if (path.startsWith('/api/v1/tasks') || path.startsWith('/api/v1/agents')) {
                reply.header('Cache-Control', 'private, max-age=5, stale-while-revalidate=10');
            } else if (path === '/api/v1/status') {
                reply.header('Cache-Control', 'no-cache');
            }
        }
        return payload;
    });

    registerSessionRoutes(app, sessionManager);

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
    registerWalletRoutes(app, deps.authorizationManager);
    registerSolanaRoutes(app, deps.transactionManager);
    registerSocialRoutes(app, deps.database);

    await app.listen({ host: deps.host, port: deps.port });
    logger.info({ host: deps.host, port: deps.port }, 'API server listening');

    return app;
}
