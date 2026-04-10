/**
 * Gateway Domain — EVM-first integration
 *
 * Initializes the Workflow Execution Gateway for automated task execution.
 * Solana path was historically test-only; this domain currently enables
 * Gateway only when defaultChain === 'evm'.
 */

import { GatewayStore } from '../gateway/store.js';
import { DefaultArenaTaskFactory } from '../gateway/arena-factory.js';
import { DefaultWorkflowExecutionGateway, type ExecutionClient } from '../gateway/gateway.js';
import { PollingEvmMarketplaceEventListener } from '../gateway/event-listener-evm.js';
import { type EventCursorStore } from '../gateway/event-listener.js';
import { createEvmArenaTaskClient } from '../gateway/arena-client-evm.js';
import { EvmTransactionManager } from '../evm/transaction-manager.js';
import { logger } from '../utils/logger.js';
import type { DaemonConfig } from '../config.js';

export interface GatewayDomainServices {
    gateway: DefaultWorkflowExecutionGateway | null;
    listener: PollingEvmMarketplaceEventListener | null;
}

function createStubExecutionClient(): ExecutionClient {
    return {
        async runAndSettle(request) {
            logger.info({ taskId: request.taskId, workflowId: request.workflowId }, 'Stub gateway execution completed');
            return '0x';
        },
    };
}

export function initGatewayDomain(
    config: DaemonConfig,
    dbPath: string,
    transactionManager: EvmTransactionManager,
): GatewayDomainServices {
    if (config.defaultChain !== 'evm') {
        logger.info('Gateway domain skipped (Solana gateway not yet integrated into daemon startup)');
        return { gateway: null, listener: null };
    }

    const store = new GatewayStore(dbPath);
    const factory = new DefaultArenaTaskFactory(transactionManager['account'].address);
    const arenaClient = createEvmArenaTaskClient(transactionManager);
    const executionClient = createStubExecutionClient();

    const gateway = new DefaultWorkflowExecutionGateway(store, factory, arenaClient, executionClient, {
        marketplaceProgramId: config.agentArenaEvmAddress ?? '',
        arenaProgramId: config.agentArenaEvmAddress ?? '',
        rpcEndpoint: config.evmRpcUrl ?? '',
        dbPath,
        posterWallet: { publicKey: transactionManager['account'].address, signAndSendTransaction: async () => '' },
        agentWallet: { publicKey: transactionManager['account'].address, signAndSendTransaction: async () => '' },
        defaultJudge: transactionManager['account'].address,
        pollIntervalMs: config.heartbeatInterval || 30_000,
        maxRetries: config.reconnectMaxAttempts || 3,
        retryDelayMs: config.reconnectBaseDelay || 1_000,
    });

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

    const listener = new PollingEvmMarketplaceEventListener({
        rpcEndpoint: config.evmRpcUrl ?? '',
        chainId: config.evmChainId || 84532,
        agentArenaAddress: (config.agentArenaEvmAddress ??
            '0x0000000000000000000000000000000000000000') as `0x${string}`,
        pollIntervalMs: config.heartbeatInterval || 30_000,
    }, cursorStore);

    listener.start(async (event) => {
        try {
            await gateway.processPurchase(event);
        } catch (err) {
            logger.error({ err, purchaseId: event.purchaseId }, 'Gateway failed to process EVM purchase');
        }
    });

    logger.info('Gateway domain initialized for EVM');
    return { gateway, listener };
}

export async function stopGatewayDomain(services: GatewayDomainServices): Promise<void> {
    await services.listener?.stop();
    services.gateway?.stop();
}
