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
import { createLocalWorkflowResolver } from '../gateway/resolvers/local-resolver.js';
import { createVelWorkflowExecutionClient } from '../gateway/execution-client.js';
import { DefaultVelOrchestrator } from '../vel/orchestrator.js';
import { DefaultTeeExecutionEngine } from '../vel/tee-execution-engine.js';
import { AttestationVerifier } from '../vel/attestation-verifier.js';
import { TeeProviderFactory } from '../vel/tee-execution-engine.js';
import { createSettlementBridge } from '../bridge/settlement-bridge.js';

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

    // Build real VEL-backed execution client
    const workflowResolver = createLocalWorkflowResolver();
    const provider = TeeProviderFactory.create(config.teeProvider ?? 'gramine-local');
    const engine = new DefaultTeeExecutionEngine(provider);
    const verifier = new AttestationVerifier(provider);

    // Settlement bridge for on-chain judge_and_pay
    const bridge = createSettlementBridge({
        chainHubProgramId: config.chainHubProgramId ?? ARENA_PROGRAM_ADDRESS,
        rpcEndpoint: config.solanaRpcUrl ?? 'https://api.devnet.solana.com',
    });

    const velConfig = {
        bridge: {
            judgeAndPay: async (args: { taskId: number; winner: string; score: number; reasonRef: string }) => {
                const result = await (await bridge).settleWithReasonRef(
                    {
                        evaluationId: `vel-${args.taskId}`,
                        taskId: String(args.taskId),
                        taskIdOnChain: String(args.taskId),
                        paymentId: `vel-payment-${args.taskId}`,
                        agentId: args.winner,
                        payerAgentId: args.winner,
                        evaluationResult: { score: args.score, passed: args.score >= 60, verificationHash: '', details: [] },
                        amount: '0',
                        token: 'SOL',
                        poster: defaultJudge,
                        reasonRef: args.reasonRef,
                    } as any,
                    args.score,
                    args.reasonRef,
                );
                return result.txSignature;
            },
        },
        keyManager: {
            getSeedForTask: async () => crypto.getRandomValues(new Uint8Array(32)),
        },
        storage: {
            upload: async (bundle: any) => {
                const fs = await import('node:fs/promises');
                const { join } = await import('node:path');
                const dir = join(dbPath, '..', 'vel-attestations');
                await fs.mkdir(dir, { recursive: true });
                const path = join(dir, `${bundle.taskId}.json`);
                await fs.writeFile(path, JSON.stringify(bundle, null, 2));
                return `file://${path}`;
            },
        },
        defaultProvider: config.teeProvider ?? 'gramine-local',
    };

    const orchestrator = new DefaultVelOrchestrator(engine, verifier, velConfig);
    const executionClient = createVelWorkflowExecutionClient(orchestrator, workflowResolver);

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
