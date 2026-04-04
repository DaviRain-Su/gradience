import { randomBytes } from 'node:crypto';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { DaemonConfig } from './config.js';
import { getDataDir } from './config.js';
import { initDatabase } from './storage/database.js';
import { ConnectionManager } from './connection/connection-manager.js';
import { TaskQueue } from './tasks/task-queue.js';
import { TaskExecutor } from './tasks/task-executor.js';
import { ProcessManager } from './agents/process-manager.js';
import { MessageRouter } from './messages/message-router.js';
import { FileKeyManager } from './keys/key-manager.js';
import { AuthorizationManager } from './wallet/authorization.js';
import { TransactionManager } from './solana/transaction-manager.js';
import { createAPIServer } from './api/server.js';
import { A2ARouter } from './a2a-router/router.js';
import { logger } from './utils/logger.js';

const VERSION = '0.1.0';

export class Daemon {
    private readonly config: DaemonConfig;
    private readonly authToken: string;
    private readonly startedAt: number;
    private server: Awaited<ReturnType<typeof createAPIServer>> | null = null;
    private connectionManager: ConnectionManager | null = null;
    private taskQueue: TaskQueue | null = null;
    private taskExecutor: TaskExecutor | null = null;
    private processManager: ProcessManager | null = null;
    private messageRouter: MessageRouter | null = null;
    private keyManager: FileKeyManager | null = null;
    private authorizationManager: AuthorizationManager | null = null;
    private transactionManager: TransactionManager | null = null;
    private a2aRouter: A2ARouter | null = null;

    constructor(config: DaemonConfig) {
        this.config = config;
        this.authToken = randomBytes(32).toString('hex');
        this.startedAt = Date.now();
    }

    async start(): Promise<void> {
        logger.info({ version: VERSION }, 'Starting Agent Daemon');

        const dataDir = getDataDir();
        if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true });
        }

        const tokenPath = join(dataDir, 'auth-token');
        writeFileSync(tokenPath, this.authToken, { mode: 0o600 });
        logger.info({ tokenPath }, 'Auth token written');

        const db = initDatabase(this.config.dbPath);

        this.keyManager = new FileKeyManager(join(dataDir, 'keypair'));
        await this.keyManager.initialize();
        logger.info({ publicKey: this.keyManager.getPublicKey() }, 'KeyManager initialized');

        this.authorizationManager = new AuthorizationManager(db, this.keyManager.getPublicKey());
        logger.info(
            { authorized: this.authorizationManager.authorized, masterWallet: this.authorizationManager.masterWallet },
            'AuthorizationManager initialized',
        );

        this.connectionManager = new ConnectionManager(this.config);
        this.taskQueue = new TaskQueue(db);
        this.processManager = new ProcessManager(db, this.config.maxAgentProcesses);
        this.messageRouter = new MessageRouter(db, this.connectionManager, this.taskQueue);
        this.taskExecutor = new TaskExecutor(this.taskQueue, this.processManager);
        this.transactionManager = new TransactionManager(this.config.solanaRpcUrl, this.keyManager);

        // A2A Router (Nostr + XMTP)
        if (this.config.a2aEnabled) {
            this.a2aRouter = new A2ARouter({
                enableNostr: true,
                nostrRelays: this.config.nostrRelays,
                nostrPrivateKey: this.config.nostrPrivateKey,
                enableXMTP: this.config.xmtpEnabled,
                agentId: this.keyManager.getPublicKey(),
            });
        }

        const recovered = this.taskQueue.recoverOnStartup();
        if (recovered > 0) {
            logger.info({ recovered }, 'Recovered interrupted tasks from previous session');
        }

        await this.processManager.initialize();

        this.connectionManager.on('error', (err: Error) => {
            logger.warn({ err }, 'ConnectionManager error (handled)');
        });

        this.connectionManager.on('state-changed', (peerId: string, state: string) => {
            logger.info({ peerId, connectionState: state }, 'Connection state changed');
        });

        // Wire task events from ConnectionManager to TaskQueue
        this.connectionManager.on('task-event', (taskEvent: any) => {
            logger.debug({ taskId: taskEvent.id, taskType: taskEvent.type }, 'Received task event from connection');
            this.taskQueue!.enqueue(
                taskEvent.id,
                taskEvent.type,
                taskEvent.payload,
                Math.min(Math.max(taskEvent.priority, 0), 2) as 0 | 1 | 2
            );
        });

        // Wire health metrics and fallback mode events
        if (this.config.connectionHealthMetrics) {
            this.connectionManager.on('health-metrics', (peerId: string, metrics: any) => {
                logger.debug({ peerId, metrics }, 'Connection health metrics');
            });
        }

        this.connectionManager.on('fallback-mode', (enabled: boolean) => {
            logger.info({ fallbackMode: enabled }, 'REST API fallback mode changed');
        });

        // Set the agent public key for subscriptions
        this.connectionManager.setAgentPubkey(this.keyManager.getPublicKey());

        this.server = await createAPIServer({
            host: this.config.host,
            port: this.config.port,
            authToken: this.authToken,
            connectionManager: this.connectionManager,
            taskQueue: this.taskQueue,
            processManager: this.processManager,
            messageRouter: this.messageRouter,
            keyManager: this.keyManager,
            authorizationManager: this.authorizationManager,
            transactionManager: this.transactionManager,
            a2aRouter: this.a2aRouter,
            database: db,
            startedAt: this.startedAt,
            version: VERSION,
        });

        await this.connectionManager.connect();

        // Initialize A2A Router (connects to Nostr relays)
        if (this.a2aRouter) {
            try {
                await this.a2aRouter.initialize();
                // Wire inbound A2A messages to MessageRouter
                await this.a2aRouter.subscribe((message) => {
                    this.messageRouter!.send({
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

        this.taskExecutor.start();

        logger.info(
            {
                port: this.config.port,
                chainHub: this.config.chainHubUrl,
                publicKey: this.keyManager.getPublicKey(),
                a2a: this.a2aRouter?.isInitialized() ? 'enabled' : 'disabled',
            },
            'Agent Daemon started',
        );
    }

    async stop(): Promise<void> {
        logger.info('Stopping Agent Daemon');

        this.taskExecutor?.stop();
        await this.a2aRouter?.shutdown();
        await this.connectionManager?.disconnect();
        await this.processManager?.shutdown();
        await this.server?.close();

        logger.info('Agent Daemon stopped');
    }

    getAuthToken(): string {
        return this.authToken;
    }
}
