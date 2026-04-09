import type { DaemonConfig } from '../config.js';
import { ConnectionManager } from '../connection/connection-manager.js';
import { MessageRouter } from '../messages/message-router.js';
import { logger } from '../utils/logger.js';
import type { KeyManager } from '../keys/key-manager.js';
import type { TaskQueue } from '../tasks/task-queue.js';
import type Database from 'better-sqlite3';

// A2ARouter loaded dynamically to avoid hard dependency on nostr-tools
type A2ARouterType = import('../a2a-router/router.js').A2ARouter;

export interface NetworkDomainServices {
    connectionManager: ConnectionManager;
    messageRouter: MessageRouter;
    a2aRouter: A2ARouterType | null;
}

export function initNetworkDomain(
    config: DaemonConfig,
    db: Database.Database,
    taskQueue: TaskQueue,
): { connectionManager: ConnectionManager; messageRouter: MessageRouter } {
    const connectionManager = new ConnectionManager(config);
    const messageRouter = new MessageRouter(db, connectionManager, taskQueue);
    return { connectionManager, messageRouter };
}

export async function initA2ARouter(config: DaemonConfig, keyManager: KeyManager): Promise<A2ARouterType | null> {
    if (!config.a2aEnabled) return null;
    try {
        const { A2ARouter } = await import('../a2a-router/router.js');
        const a2aRouter = new A2ARouter({
            enableNostr: true,
            nostrRelays: config.nostrRelays,
            nostrPrivateKey: config.nostrPrivateKey,
            enableXMTP: config.xmtpEnabled,
            agentId: keyManager.getPublicKey(),
            enableCircuitBreaker: true,
            enableRateLimiting: true,
            enableRetry: true,
            enableValidation: true,
            enableMetrics: true,
            enableHealthMonitor: true,
        });
        await a2aRouter.initialize();
        logger.info(
            'A2ARouter configured with production-grade features (circuit breaker, rate limiter, health monitor, metrics)',
        );
        return a2aRouter;
    } catch (err) {
        logger.warn({ err }, 'A2A Router not available (missing dependencies), continuing without A2A');
        return null;
    }
}

export async function startNetworkDomain(
    services: Pick<NetworkDomainServices, 'connectionManager' | 'a2aRouter' | 'messageRouter'>,
    keyManager: KeyManager,
): Promise<void> {
    services.connectionManager.setAgentPubkey(keyManager.getPublicKey());
    await services.connectionManager.connect();

    if (services.a2aRouter) {
        try {
            await services.a2aRouter.initialize();
            await services.a2aRouter.subscribe((message: any) => {
                services.messageRouter.send({
                    from: message.from,
                    to: message.to,
                    type: message.type,
                    payload: message.payload,
                });
            });
            logger.info('A2ARouter initialized and wired to MessageRouter');
        } catch (err) {
            logger.warn({ err }, 'A2ARouter initialization failed, continuing without A2A');
        }
    }
}

export async function stopNetworkDomain(services: NetworkDomainServices): Promise<void> {
    await services.a2aRouter?.shutdown();
    await services.connectionManager.disconnect();
}
