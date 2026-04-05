import { randomBytes } from 'node:crypto';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { DaemonConfig } from './config.js';
import { getDataDir, getUnifiedLLMConfig, getEvaluatorLLMConfig } from './config.js';
import { initDatabase } from './storage/database.js';
import { ConnectionManager } from './connection/connection-manager.js';
import { TaskQueue } from './tasks/task-queue.js';
import { TaskExecutor } from './tasks/task-executor.js';
import { TaskService } from './tasks/task-service.js';
import { ProcessManager } from './agents/process-manager.js';
import { MessageRouter } from './messages/message-router.js';
import { FileKeyManager } from './keys/key-manager.js';
import { AuthorizationManager } from './wallet/authorization.js';
import { TransactionManager } from './solana/transaction-manager.js';
import { PaymentManager, type PaymentsConfig } from './payments/index.js';
import { PaymentService } from './services/payment-service.js';
import { BridgeManager, createBridgeManager } from './bridge/index.js';
import { createAPIServer } from './api/server.js';
import { OWSWalletManager } from './wallet/ows-wallet-manager.js';
import { EvaluatorRuntime } from './evaluator/runtime.js';
// A2ARouter loaded dynamically to avoid hard dependency on nostr-tools
type A2ARouterType = import('./a2a-router/router.js').A2ARouter;
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
    private paymentManager: PaymentManager | null = null;
    private paymentService: PaymentService | null = null;
    private bridgeManager: BridgeManager | null = null;
    private owsWalletManager: OWSWalletManager | null = null;
    private evaluatorRuntime: EvaluatorRuntime | null = null;
    private a2aRouter: A2ARouterType | null = null;

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

        // Get unified LLM configuration
        const unifiedLLMConfig = getUnifiedLLMConfig(this.config);
        const evaluatorLLMConfig = getEvaluatorLLMConfig(this.config);

        this.taskQueue = new TaskService(db, {
            autoJudge: this.config.autoJudge,
            judgeProvider: evaluatorLLMConfig.provider,
            judgeModel: evaluatorLLMConfig.model,
            judgeConfidenceThreshold: this.config.judgeConfidenceThreshold,
            llmConfig: unifiedLLMConfig,
            revenueSharingEnabled: this.config.revenueSharingEnabled,
            revenueAutoSettle: this.config.revenueAutoSettle,
        });
        this.processManager = new ProcessManager(db, this.config.maxAgentProcesses);
        this.messageRouter = new MessageRouter(db, this.connectionManager, this.taskQueue);
        this.taskExecutor = new TaskExecutor(this.taskQueue, this.processManager);
        this.transactionManager = new TransactionManager(this.config.solanaRpcUrl, this.keyManager);

        // Initialize Payment Manager (MPP + X402)
        this.paymentManager = new PaymentManager(
            {
                rpcEndpoint: this.config.solanaRpcUrl,
                mppEnabled: this.config.paymentsMppEnabled,
                x402Enabled: this.config.paymentsX402Enabled,
                defaultTimeoutMs: this.config.paymentsTimeoutMs,
                autoConfirm: this.config.paymentsAutoConfirm,
            },
            this.keyManager,
            this.transactionManager
        );
        await this.paymentManager.initialize();
        logger.info('PaymentManager initialized (MPP + X402)');

        // Initialize Bridge Manager (Settlement Bridge)
        this.bridgeManager = createBridgeManager(
            {
                rpcEndpoint: this.config.solanaRpcUrl,
                chainHubProgramId: this.config.bridgeProgramId,
                tritonApiToken: this.config.bridgeTritonApiToken,
                keyDir: this.config.bridgeKeyDir,
                enabled: this.config.bridgeEnabled,
                autoSettle: this.config.bridgeAutoSettle,
                retry: {
                    maxAttempts: this.config.bridgeRetryMaxAttempts,
                    baseDelayMs: this.config.bridgeRetryBaseDelayMs,
                    maxDelayMs: this.config.bridgeRetryMaxDelayMs,
                },
                confirmation: {
                    commitment: this.config.bridgeConfirmationCommitment,
                    maxRetries: 3,
                    timeoutMs: 60000,
                },
                distribution: {
                    agentBps: this.config.bridgeDistributionAgentBps,
                    judgeBps: this.config.bridgeDistributionJudgeBps,
                    protocolBps: this.config.bridgeDistributionProtocolBps,
                },
            },
            this.keyManager,
            this.transactionManager
        );
        await this.bridgeManager.initialize();
        logger.info('BridgeManager initialized (Settlement Bridge)');

        // Initialize OWS Wallet Manager
        this.owsWalletManager = new OWSWalletManager(db);
        logger.info('OWSWalletManager initialized');

        // Initialize Evaluator Runtime
        this.evaluatorRuntime = new EvaluatorRuntime({
            defaultBudget: {
                maxCostUsd: 1.0,
                maxTimeSeconds: 600,
                maxMemoryMb: 512,
                contextWindowSize: 128000,
            },
            sandbox: {
                type: 'git_worktree',
                resources: {
                    cpu: '1',
                    memory: '1g',
                    timeout: 600,
                },
                networkAccess: false,
            },
            scoringModel: {
                provider: unifiedLLMConfig.provider === 'claude' ? 'anthropic' : 'openai',
                model: unifiedLLMConfig.model,
                temperature: 0.1,
                maxTokens: 4096,
            },
            driftDetection: {
                enabled: true,
                threshold: 0.8,
                resetStrategy: 'sprint_boundary',
                checkpointIntervalMs: 60000,
            },
        });
        logger.info('EvaluatorRuntime initialized');

        // A2A Router (Nostr + XMTP) -- loaded dynamically with production-grade features
        if (this.config.a2aEnabled) {
            try {
                const { A2ARouter } = await import('./a2a-router/router.js');
                this.a2aRouter = new A2ARouter({
                    enableNostr: true,
                    nostrRelays: this.config.nostrRelays,
                    nostrPrivateKey: this.config.nostrPrivateKey,
                    enableXMTP: this.config.xmtpEnabled,
                    agentId: this.keyManager.getPublicKey(),
                    // Production-grade features - all enabled by default
                    enableCircuitBreaker: true,
                    enableRateLimiting: true,
                    enableRetry: true,
                    enableValidation: true,
                    enableMetrics: true,
                    enableHealthMonitor: true,
                });
                await this.a2aRouter.initialize();
                logger.info('A2ARouter configured with production-grade features (circuit breaker, rate limiter, health monitor, metrics)');
            } catch (err) {
                logger.warn({ err }, 'A2A Router not available (missing dependencies), continuing without A2A');
            }
        }

        // Initialize Payment Service (A2A + Bridge Settlement)
        if (this.config.a2aEnabled && this.a2aRouter) {
            try {
                const { PaymentService } = await import('./services/payment-service.js');
                
                this.paymentService = new PaymentService(
                    this.a2aRouter,
                    this.owsWalletManager,
                    this.evaluatorRuntime,
                    this.bridgeManager,
                    {
                        defaultTimeoutMs: this.config.paymentsTimeoutMs,
                        autoApproveThreshold: this.config.judgeConfidenceThreshold,
                        chainHubProgramId: this.config.bridgeProgramId,
                        rpcEndpoint: this.config.solanaRpcUrl,
                    }
                );
                logger.info('PaymentService initialized (A2A + Bridge Settlement)');
            } catch (err) {
                logger.warn({ err }, 'PaymentService initialization failed, continuing without A2A payments');
            }
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
                payments: {
                    mpp: this.config.paymentsMppEnabled ? 'enabled' : 'disabled',
                    x402: this.config.paymentsX402Enabled ? 'enabled' : 'disabled',
                    a2a: this.paymentService ? 'enabled' : 'disabled',
                },
                bridge: {
                    enabled: this.config.bridgeEnabled ? 'enabled' : 'disabled',
                    autoSettle: this.config.bridgeAutoSettle ? 'enabled' : 'disabled',
                    evaluator: this.bridgeManager?.getEvaluatorPublicKey(),
                },
            },
            'Agent Daemon started',
        );
    }

    async stop(): Promise<void> {
        logger.info('Stopping Agent Daemon');

        this.taskExecutor?.stop();
        await this.paymentService?.cleanup?.();
        await this.bridgeManager?.close();
        await this.paymentManager?.close();
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
