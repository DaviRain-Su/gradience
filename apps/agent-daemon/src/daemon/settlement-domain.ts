import type { DaemonConfig } from '../config.js';
import type { KeyManager } from '../keys/key-manager.js';
import { PaymentManager } from '../payments/index.js';
import { BridgeManager, createBridgeManager } from '../bridge/index.js';
import { MagicBlockPERClient } from '../settlement/magicblock-per-client.js';
import { logger } from '../utils/logger.js';
import type { ITransactionManager } from '../shared/transaction-manager.js';
import { PublicKey } from '@solana/web3.js';

// A2ARouter loaded dynamically to avoid hard dependency on nostr-tools
type A2ARouterType = import('../a2a-router/router.js').A2ARouter;
type PaymentServiceType = import('../services/payment-service.js').PaymentService;
type EvaluatorRuntimeType = import('../evaluator/runtime.js').EvaluatorRuntime;
type OWSWalletManagerType = import('../wallet/ows-wallet-manager.js').OWSWalletManager;

export interface SettlementDomainServices {
    paymentManager: PaymentManager;
    bridgeManager: BridgeManager;
    paymentService: PaymentServiceType | null;
}

export async function initSettlementDomain(
    config: DaemonConfig,
    keyManager: KeyManager,
    transactionManager: ITransactionManager,
): Promise<Pick<SettlementDomainServices, 'paymentManager' | 'bridgeManager'>> {
    const paymentManager = new PaymentManager(
        {
            rpcEndpoint: config.solanaRpcUrl,
            mppEnabled: config.paymentsMppEnabled,
            x402Enabled: config.paymentsX402Enabled,
            defaultTimeoutMs: config.paymentsTimeoutMs,
            autoConfirm: config.paymentsAutoConfirm,
        },
        keyManager,
        transactionManager,
    );
    await paymentManager.initialize();
    logger.info('PaymentManager initialized (MPP + X402)');

    const perClient = config.magicblockPerEnabled
        ? new MagicBlockPERClient({
              teeValidator: new PublicKey(config.magicblockTeeValidator),
              erRpcUrl: config.magicblockErRpcUrl,
          })
        : undefined;

    const bridgeManager = createBridgeManager(
        {
            rpcEndpoint: config.solanaRpcUrl,
            chainHubProgramId: config.bridgeProgramId,
            tritonApiToken: config.bridgeTritonApiToken,
            keyDir: config.bridgeKeyDir,
            enabled: config.bridgeEnabled,
            autoSettle: config.bridgeAutoSettle,
            retry: {
                maxAttempts: config.bridgeRetryMaxAttempts,
                baseDelayMs: config.bridgeRetryBaseDelayMs,
                maxDelayMs: config.bridgeRetryMaxDelayMs,
            },
            confirmation: {
                commitment: config.bridgeConfirmationCommitment,
                maxRetries: 3,
                timeoutMs: 60000,
            },
            distribution: {
                agentBps: config.bridgeDistributionAgentBps,
                judgeBps: config.bridgeDistributionJudgeBps,
                protocolBps: config.bridgeDistributionProtocolBps,
            },
        },
        keyManager,
        transactionManager,
        perClient,
    );
    await bridgeManager.initialize();
    logger.info('BridgeManager initialized (Settlement Bridge)');

    return { paymentManager, bridgeManager };
}

export async function initPaymentService(
    config: DaemonConfig,
    deps: {
        a2aRouter: A2ARouterType | null;
        owsWalletManager: OWSWalletManagerType;
        evaluatorRuntime: EvaluatorRuntimeType;
        bridgeManager: BridgeManager;
    },
): Promise<PaymentServiceType | null> {
    if (!config.a2aEnabled || !deps.a2aRouter) return null;
    try {
        const { PaymentService } = await import('../services/payment-service.js');
        const paymentService = new PaymentService(
            deps.a2aRouter,
            deps.owsWalletManager,
            deps.evaluatorRuntime,
            deps.bridgeManager,
            {
                defaultTimeoutMs: config.paymentsTimeoutMs,
                autoApproveThreshold: config.judgeConfidenceThreshold,
                chainHubProgramId: config.bridgeProgramId,
                rpcEndpoint: config.solanaRpcUrl,
            },
        );
        logger.info('PaymentService initialized (A2A + Bridge Settlement)');
        return paymentService;
    } catch (err) {
        logger.warn({ err }, 'PaymentService initialization failed, continuing without A2A payments');
        return null;
    }
}

export async function stopSettlementDomain(services: SettlementDomainServices): Promise<void> {
    await services.paymentService?.cleanup?.();
    await services.bridgeManager.close();
    await services.paymentManager.close();
}
