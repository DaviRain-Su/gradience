/**
 * Gateway Domain — Solana-native Gateway assembly
 */

import { logger } from '../utils/logger.js';
import type { DaemonConfig } from '../config.js';
import type { ITransactionManager } from '../shared/transaction-manager.js';
import { TransactionManager } from '../solana/transaction-manager.js';
import { WORKFLOW_MARKETPLACE_PROGRAM_ADDRESS, ARENA_PROGRAM_ADDRESS } from '../solana/program-ids.js';
import { createSolanaArenaTaskClient } from '../gateway/solana-arena-client.js';
import {
    GatewayStore,
    DefaultWorkflowExecutionGateway,
    PollingMarketplaceEventListener,
    DefaultArenaTaskFactory,
    type EventCursorStore,
} from '../gateway/index.js';

export interface GatewayDomainServices {
    gateway: DefaultWorkflowExecutionGateway | null;
    listener: PollingMarketplaceEventListener | null;
}

export function initGatewayDomain(
    config: DaemonConfig,
    dbPath: string,
    transactionManager: ITransactionManager,
): GatewayDomainServices {
    logger.info('Initializing Solana gateway domain');

    // Gateway only runs on Solana; cast to concrete Solana TransactionManager
    const solanaTxManager = transactionManager as unknown as TransactionManager;

    const store = new GatewayStore(dbPath);

    const defaultJudge =
        (solanaTxManager as any)['publicKey']?.toBase58?.() ??
        (solanaTxManager as any)['publicKey'] ??
        '';

    const factory = new DefaultArenaTaskFactory(defaultJudge);

    const arenaClient = createSolanaArenaTaskClient(solanaTxManager);

    const executionClient = {
        async runAndSettle(request: {
            taskId: number;
            workflowId: string;
            workflowDefinition: { version: '1.0'; name: string; steps: any[] };
            inputs: Record<string, unknown>;
            executorAddress: string;
            timeoutMs: number;
        }) {
            logger.info({ taskId: request.taskId, workflowId: request.workflowId }, 'Stub execution completed');
            return 'stub-tx-sig';
        },
    };

    const gatewayConfig = {
        marketplaceProgramId: WORKFLOW_MARKETPLACE_PROGRAM_ADDRESS,
        arenaProgramId: ARENA_PROGRAM_ADDRESS,
        rpcEndpoint: config.solanaRpcUrl ?? 'https://api.devnet.solana.com',
        dbPath,
        posterWallet: { publicKey: defaultJudge, signAndSendTransaction: async () => '' },
        agentWallet: { publicKey: defaultJudge, signAndSendTransaction: async () => '' },
        defaultJudge,
        pollIntervalMs: config.heartbeatInterval ?? 30_000,
        maxRetries: config.reconnectMaxAttempts || 3,
        retryDelayMs: config.reconnectBaseDelay || 1_000,
    };

    const gateway = new DefaultWorkflowExecutionGateway(
        store,
        factory,
        arenaClient,
        executionClient,
        gatewayConfig,
    );

    const cursorStore: EventCursorStore = {
        getCursor: () => ({
            lastSignature: store.getMeta('last_signature'),
            lastBlockTime: Number(store.getMeta('last_block_time') ?? '0'),
        }),
        setCursor: (sig, block) => {
            store.setMeta('last_signature', sig);
            store.setMeta('last_block_time', String(block));
        },
    };

    const listener = new PollingMarketplaceEventListener(
        {
            rpcEndpoint: gatewayConfig.rpcEndpoint,
            marketplaceProgramId: WORKFLOW_MARKETPLACE_PROGRAM_ADDRESS,
            pollIntervalMs: gatewayConfig.pollIntervalMs,
        },
        cursorStore,
    );

    listener.start(async (event) => {
        try {
            await gateway.processPurchase(event);
        } catch (err) {
            logger.error({ err, purchaseId: event.purchaseId }, 'Gateway failed to process purchase');
        }
    });

    return { gateway, listener };
}

export async function stopGatewayDomain(services: GatewayDomainServices): Promise<void> {
    if (services.listener) {
        await services.listener.stop();
    }
    if (services.gateway) {
        services.gateway.stop();
    }
}
