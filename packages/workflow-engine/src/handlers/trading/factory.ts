/**
 * Trading Handlers Factory
 *
 * Factory function to create all trading handlers.
 */

import { createRealSwapHandler } from './swap.js';
import { createRealTransferHandler } from './transfer.js';
import { createRealStakeHandler } from './stake.js';
import { createRealUnstakeHandler } from './unstake.js';
import { createRealBridgeHandler } from './bridge.js';
import { createRealYieldFarmHandler } from './yield-farm.js';
import { createRealBorrowHandler } from './borrow.js';
import { createRealRepayHandler } from './repay.js';
import type { ActionHandler } from './types.js';

/**
 * Create all real trading handlers
 */
export function createRealTradingHandlers(): Map<string, ActionHandler> {
  const handlers = new Map<string, ActionHandler>();

  handlers.set('swap', createRealSwapHandler());
  handlers.set('transfer', createRealTransferHandler());
  handlers.set('stake', createRealStakeHandler());
  handlers.set('unstake', createRealUnstakeHandler());
  handlers.set('bridge', createRealBridgeHandler());
  handlers.set('yieldFarm', createRealYieldFarmHandler());
  handlers.set('borrow', createRealBorrowHandler());
  handlers.set('repay', createRealRepayHandler());

  return handlers;
}
