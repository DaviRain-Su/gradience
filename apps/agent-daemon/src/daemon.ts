import { randomBytes } from 'node:crypto';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { DaemonConfig } from './config.js';
import { getDataDir, getUnifiedLLMConfig, getEvaluatorLLMConfig } from './config.js';
import { initDatabase } from './storage/database.js';
import { TransactionManager as SolanaTransactionManager } from './solana/transaction-manager.js';
import type { ITransactionManager } from './shared/transaction-manager.js';
import { createAPIServer } from './api/server.js';
import { logger } from './utils/logger.js';
import { initIdentityDomain, stopIdentityDomain, type IdentityDomainServices } from './daemon/identity-domain.js';
import {
    initCoordinatorDomain,
    startCoordinatorDomain,
    stopCoordinatorDomain,
    type CoordinatorDomainServices,
} from './daemon/coordinator-domain.js';
import {
    initNetworkDomain,
    initA2ARouter,
    startNetworkDomain,
    stopNetworkDomain,
    type NetworkDomainServices,
} from './daemon/network-domain.js';
import {
    initSettlementDomain,
    initPaymentService,
    stopSettlementDomain,
    type SettlementDomainServices,
} from './daemon/settlement-domain.js';
import {
    initEvaluationDomain,
    stopEvaluationDomain,
    type EvaluationDomainServices,
} from './daemon/evaluation-domain.js';
import { initGatewayDomain, stopGatewayDomain, type GatewayDomainServices } from './daemon/gateway-domain.js';
import { ArenaAutoJudgeService } from './services/arena-auto-judge.js';
import { runPaymentsHealthCheck } from './health/payments-health.js';

const VERSION = '0.1.0';

export class Daemon {
    private readonly config: DaemonConfig;
    private readonly authToken: string;
    private readonly startedAt: number;
    private server: Awaited<ReturnType<typeof createAPIServer>> | null = null;
    private transactionManager: ITransactionManager | null = null;
    private identity: IdentityDomainServices | null = null;
    private coordinator: CoordinatorDomainServices | null = null;
    private network: NetworkDomainServices | null = null;
    private settlement: SettlementDomainServices | null = null;
    private evaluation: EvaluationDomainServices | null = null;
    private gateway: GatewayDomainServices | null = null;
    private arenaAutoJudge: ArenaAutoJudgeService | null = null;

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

        const unifiedLLMConfig = getUnifiedLLMConfig(this.config);
        const evaluatorLLMConfig = getEvaluatorLLMConfig(this.config);

        // 1. Identity Domain
        this.identity = await initIdentityDomain(this.config, dataDir, db);

        // 2. Coordinator Domain
        this.coordinator = initCoordinatorDomain(this.config, db, unifiedLLMConfig, evaluatorLLMConfig);

        // 3. Network Domain (base)
        const { connectionManager, messageRouter } = initNetworkDomain(this.config, db, this.coordinator.taskQueue);
        this.network = { connectionManager, messageRouter, a2aRouter: null };

        // 4. Transaction Manager (Solana-only core protocol)
        this.transactionManager = new SolanaTransactionManager(this.config.solanaRpcUrl, this.identity.keyManager);
        logger.info('Using Solana transaction manager');

        // 4.5 Lightweight Payments Health Check (no gas)
        await runPaymentsHealthCheck(this.config);

        // 5. Evaluation Domain
        this.evaluation = initEvaluationDomain(unifiedLLMConfig);

        // 6. Settlement Domain (base)
        const { paymentManager, bridgeManager } = await initSettlementDomain(
            this.config,
            this.identity.keyManager,
            this.transactionManager,
        );
        this.settlement = { paymentManager, bridgeManager, paymentService: null };

        // 7. Network Domain (advanced: A2A)
        this.network.a2aRouter = await initA2ARouter(this.config, this.identity.keyManager);

        // 8. Settlement Domain (advanced: PaymentService)
        this.settlement.paymentService = await initPaymentService(this.config, {
            a2aRouter: this.network.a2aRouter,
            owsWalletManager: this.identity.owsWalletManager,
            evaluatorRuntime: this.evaluation.evaluatorRuntime,
            bridgeManager: this.settlement.bridgeManager,
        });

        // 8.5 Arena Auto Judge Service
        this.arenaAutoJudge = new ArenaAutoJudgeService(
            this.settlement.bridgeManager,
            this.evaluation.evaluatorRuntime,
            this.config.chainHubUrl.replace(/\/ws$/, '').replace(/^wss?:\/\//, 'https://') + '/indexer',
            {
                enabled: this.config.arenaAutoJudgeEnabled,
                intervalMs: this.config.arenaAutoJudgeIntervalMs,
                minSubmissions: this.config.arenaAutoJudgeMinSubmissions,
                perEnabled: this.config.arenaAutoJudgePerEnabled,
            },
            this.identity.keyManager.getPublicKey(),
        );
        this.arenaAutoJudge.start();

        // 9. Gateway Domain (placeholder — Solana gateway integration pending)
        this.gateway = initGatewayDomain(this.config, this.config.dbPath, this.transactionManager);

        // 10. Wire cross-domain events on ConnectionManager
        this.wireConnectionEvents();

        // 10. Start API Server
        this.server = await createAPIServer({
            host: this.config.host,
            port: this.config.port,
            authToken: this.authToken,
            connectionManager: this.network.connectionManager,
            taskQueue: this.coordinator.taskQueue,
            processManager: this.coordinator.processManager,
            messageRouter: this.network.messageRouter,
            keyManager: this.identity.keyManager,
            authorizationManager: this.identity.authorizationManager,
            transactionManager: this.transactionManager,
            a2aRouter: this.network.a2aRouter,
            bridgeManager: this.settlement.bridgeManager,
            gateway: this.gateway?.gateway ?? undefined,
            database: db,
            startedAt: this.startedAt,
            version: VERSION,
        });

        // 11. Start Network connections
        await startNetworkDomain(this.network, this.identity.keyManager);

        // 12. Start Coordinator execution
        await startCoordinatorDomain(this.coordinator);

        logger.info(
            {
                port: this.config.port,
                chainHub: this.config.chainHubUrl,
                publicKey: this.identity.keyManager.getPublicKey(),
                a2a: this.network.a2aRouter?.isInitialized() ? 'enabled' : 'disabled',
                payments: {
                    mpp: this.config.paymentsMppEnabled ? 'enabled' : 'disabled',
                    x402: this.config.paymentsX402Enabled ? 'enabled' : 'disabled',
                    a2a: this.settlement.paymentService ? 'enabled' : 'disabled',
                },
                bridge: {
                    enabled: this.config.bridgeEnabled ? 'enabled' : 'disabled',
                    autoSettle: this.config.bridgeAutoSettle ? 'enabled' : 'disabled',
                    evaluator: this.settlement.bridgeManager.getEvaluatorPublicKey(),
                },
            },
            'Agent Daemon started',
        );
    }

    async stop(): Promise<void> {
        logger.info('Stopping Agent Daemon');

        if (this.arenaAutoJudge) this.arenaAutoJudge.stop();
        if (this.gateway) await stopGatewayDomain(this.gateway);
        if (this.coordinator) await stopCoordinatorDomain(this.coordinator);
        if (this.settlement) await stopSettlementDomain(this.settlement);
        if (this.network) await stopNetworkDomain(this.network);
        if (this.evaluation) await stopEvaluationDomain(this.evaluation);
        if (this.identity) await stopIdentityDomain(this.identity);
        await this.server?.close();

        logger.info('Agent Daemon stopped');
    }

    getAuthToken(): string {
        return this.authToken;
    }

    private wireConnectionEvents(): void {
        if (!this.network || !this.coordinator) return;
        const { connectionManager } = this.network;
        const { taskQueue } = this.coordinator;

        connectionManager.on('error', (err: Error) => {
            logger.warn({ err }, 'ConnectionManager error (handled)');
        });

        connectionManager.on('state-changed', (peerId: string, state: string) => {
            logger.info({ peerId, connectionState: state }, 'Connection state changed');
        });

        connectionManager.on('task-event', (taskEvent: any) => {
            logger.debug({ taskId: taskEvent.id, taskType: taskEvent.type }, 'Received task event from connection');
            taskQueue.enqueue(
                taskEvent.id,
                taskEvent.type,
                taskEvent.payload,
                Math.min(Math.max(taskEvent.priority, 0), 2) as 0 | 1 | 2,
            );
        });

        if (this.config.connectionHealthMetrics) {
            connectionManager.on('health-metrics', (peerId: string, metrics: any) => {
                logger.debug({ peerId, metrics }, 'Connection health metrics');
            });
        }

        connectionManager.on('fallback-mode', (enabled: boolean) => {
            logger.info({ fallbackMode: enabled }, 'REST API fallback mode changed');
        });
    }
}
