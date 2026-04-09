/**
 * Handlers module exports
 */

// Trading/DeFi handlers (mock - for testing without blockchain)
export {
    createSwapHandler,
    createBridgeHandler,
    createTransferHandler,
    createStakeHandler,
    createUnstakeHandler,
    createYieldFarmHandler,
    createBorrowHandler,
    createRepayHandler,
    createTradingHandlers,
    type SwapParams,
    type BridgeParams,
    type TransferParams,
    type StakeParams,
} from './trading.js';

// Trading/DeFi handlers (real Solana implementation with Jupiter API)
export {
    createRealSwapHandler,
    createRealBridgeHandler,
    createRealTransferHandler,
    createRealStakeHandler,
    createRealUnstakeHandler,
    createRealYieldFarmHandler,
    createRealBorrowHandler,
    createRealRepayHandler,
    createRealTradingHandlers,
    getSupportedActions,
    type TradingActionMeta,
} from './trading-real.js';

// Payment handlers
export {
    createX402PaymentHandler,
    createMPPStreamRewardHandler,
    createTEEPrivateSettleHandler,
    createZeroGasExecuteHandler,
    createPaymentHandlers,
    type X402PaymentParams,
    type MPPStreamRewardParams,
    type TEEPrivateSettleParams,
    type ZeroGasExecuteParams,
} from './payment.js';

// Utility handlers
export {
    createHTTPRequestHandler,
    createWaitHandler,
    createConditionHandler,
    createParallelHandler,
    createLoopHandler,
    createSetVariableHandler,
    createLogHandler,
    createUtilityHandlers,
    type HTTPRequestParams,
    type WaitParams,
    type ConditionParams,
    type LogParams,
} from './utility.js';

// Handler type
import type { ActionHandler } from '../engine/step-executor.js';

/**
 * Handler creation mode
 */
export type HandlerMode = 'mock' | 'real' | 'auto';

/**
 * Create all handlers combined
 *
 * @param mode - 'mock' for mock handlers, 'real' for Jupiter API integration, 'auto' to detect based on environment
 * @param config - Configuration options
 */
export function createAllHandlers(
    mode: HandlerMode = 'auto',
    config?: {
        jupiterApiUrl?: string;
        wormholeApiUrl?: string;
        walletPrivateKey?: string;
        tempoApiUrl?: string;
        teeEndpoint?: string;
        relayEndpoint?: string;
        fetchFn?: typeof fetch;
        logger?: Console;
        defaultTimeout?: number;
        useTritonCascade?: boolean;
    },
): Map<string, ActionHandler> {
    // Auto-detect mode based on environment
    const effectiveMode =
        mode === 'auto'
            ? process.env.USE_REAL_HANDLERS === 'true' || process.env.SOLANA_RPC_URL
                ? 'real'
                : 'mock'
            : mode;

    console.log(`[Handlers] Creating handlers in '${effectiveMode}' mode`);

    let trading: Map<string, ActionHandler>;

    if (effectiveMode === 'real') {
        // Use real Jupiter API integration
        trading = createRealTradingHandlers({
            jupiterApiUrl: config?.jupiterApiUrl,
            useTritonCascade: config?.useTritonCascade ?? true,
        });
    } else {
        // Use mock handlers for testing
        trading = createMockTradingHandlers(config);
    }

    const payment = createPaymentHandlers(config);
    const utility = createUtilityHandlers(config);

    return new Map([...trading, ...payment, ...utility]);
}

// Need to import for the function above
import { createTradingHandlers as createMockTradingHandlers } from './trading.js';
import { createRealTradingHandlers } from './trading-real.js';
import { createPaymentHandlers } from './payment.js';
import { createUtilityHandlers } from './utility.js';
