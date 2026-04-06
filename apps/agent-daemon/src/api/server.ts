import Fastify from 'fastify';
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
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
import { registerNetworkRoutes } from './routes/network.js';
import { registerSessionRoutes } from './routes/session.js';
// A2A routes loaded dynamically to avoid hard dependency on nostr-tools
import { registerDomainRoutes } from './routes/domains.js';
import { registerOWSRoutes } from './routes/ows.js';
import { registerEvaluatorRoutes } from './routes/evaluator.js';
import { registerCoordinatorRoutes } from './routes/coordinator.js';
import { SessionManager } from '../auth/session-manager.js';
import { IndexerSyncService } from '../storage/indexer-sync.js';
import indexerRoutes from './routes/indexer-cache.js';
import type { ConnectionManager } from '../connection/connection-manager.js';
import type { TaskQueue } from '../tasks/task-queue.js';
import type { ProcessManager } from '../agents/process-manager.js';
import type { MessageRouter } from '../messages/message-router.js';
import type { KeyManager } from '../keys/key-manager.js';
import type { AuthorizationManager } from '../wallet/authorization.js';
import type { TransactionManager } from '../solana/transaction-manager.js';
import type { A2ARouter } from '../a2a-router/router.js';

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
    a2aRouter: A2ARouter | null;
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
            'http://localhost:5200',
            'http://localhost:5201',
        ],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    });

    // Register rate limiting - global 10 requests per minute per IP
    // Skip rate limiting in test environment
    if (process.env.NODE_ENV !== 'test') {
        await app.register(rateLimit, {
            max: 120,
            timeWindow: '1 minute',
            keyGenerator: (request) => request.ip,
            errorResponseBuilder: (request, context) => {
                return {
                    statusCode: 429,
                    error: 'Too Many Requests',
                    message: `Rate limit exceeded. Try again in ${context.after}`,
                    retryAfter: context.after,
                };
            },
        });
    }

    const sessionManager = new SessionManager(deps.database);

    app.addHook('onRequest', createAuthHook(deps.authToken, sessionManager));

    // Cache headers for GET endpoints
    app.addHook('onSend', async (request, reply, payload) => {
        if (request.method === 'GET') {
            const path = request.url.split('?')[0];
            if (path.startsWith('/api/feed') || path.startsWith('/api/profile/') ||
                path.startsWith('/api/followers/') || path.startsWith('/api/following/') ||
                path.startsWith('/api/discover') || path.startsWith('/api/matches')) {
                reply.header('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
            } else if (path.startsWith('/api/v1/domains')) {
                reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
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
        a2aRouter: deps.a2aRouter,
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
    registerNetworkRoutes(app, deps.database);
    registerDomainRoutes(app);
    registerOWSRoutes(app);
    registerEvaluatorRoutes(app, deps.database);
    registerCoordinatorRoutes(app);

    // Initialize indexer sync service for local caching
    const syncService = new IndexerSyncService(deps.database);
    await syncService.start();
    await app.register(indexerRoutes, { syncService });
    logger.info('Indexer sync service started');
    if (deps.a2aRouter) {
        try {
            const { registerA2ARoutes } = await import('./routes/a2a.js');
            registerA2ARoutes(app, deps.a2aRouter, deps.messageRouter);
        } catch (err) {
            logger.warn({ err }, 'A2A routes not available (missing dependencies)');
        }
    }

    await app.listen({ host: deps.host, port: deps.port });
    logger.info({ host: deps.host, port: deps.port }, 'API server listening');

    return app;
}
