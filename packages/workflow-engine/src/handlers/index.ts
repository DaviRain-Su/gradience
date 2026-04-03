/**
 * Handlers module exports
 */

// Trading/DeFi handlers (mock)
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

// Trading/DeFi handlers (real Solana implementation)
export {
  createRealSwapHandler,
  createRealBridgeHandler,
  createRealTransferHandler,
  createRealStakeHandler,
  createRealTradingHandlers,
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

/**
 * Create all handlers combined
 */
export function createAllHandlers(config?: {
  jupiterApiUrl?: string;
  wormholeApiUrl?: string;
  walletPrivateKey?: string;
  tempoApiUrl?: string;
  teeEndpoint?: string;
  relayEndpoint?: string;
  fetchFn?: typeof fetch;
  logger?: Console;
  defaultTimeout?: number;
}): Map<string, import('../engine/step-executor.js').ActionHandler> {
  const trading = createTradingHandlers(config);
  const payment = createPaymentHandlers(config);
  const utility = createUtilityHandlers(config);

  return new Map([...trading, ...payment, ...utility]);
}

// Need to import for the function above
import { createTradingHandlers } from './trading.js';
import { createPaymentHandlers } from './payment.js';
import { createUtilityHandlers } from './utility.js';
