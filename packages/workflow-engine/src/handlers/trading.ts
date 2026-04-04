/**
 * Action Handlers — Trading/DeFi Operations
 * 
 * Handlers:
 * - swap: DEX token swap (Jupiter, Orca)
 * - bridge: Cross-chain bridge (Wormhole, LI.FI)
 * - transfer: Token transfer
 * - yieldFarm: Liquidity provision
 * - stake: Staking
 * - unstake: Unstaking
 * - borrow: Lending borrow
 * - repay: Lending repay
 */
import type { ActionHandler, ExecutionContext } from '../engine/step-executor.js';
import type { SupportedChain } from '../schema/types.js';

// Re-export real implementations from trading-real.ts
export {
  createRealSwapHandler as createSwapHandler,
  createRealBridgeHandler as createBridgeHandler,
  createRealTransferHandler as createTransferHandler,
  createRealStakeHandler as createStakeHandler,
  createRealTradingHandlers,
} from './trading-real.js';

// Keep mock implementations for handlers not yet fully implemented
export function createUnstakeHandler(): ActionHandler {
  return {
    async execute(
      chain: SupportedChain,
      params: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<Record<string, unknown>> {
      const { amount } = params as { amount: string };

      if (chain !== 'solana') {
        throw new Error(`Unstaking on ${chain} not yet implemented`);
      }

      console.log(`[Unstake] ${amount} SOL`);

      return {
        txHash: 'mock-unstake-tx-' + Date.now(),
        amount,
        cooldownEpochs: 2,
      };
    },
  };
}

export function createYieldFarmHandler(): ActionHandler {
  return {
    async execute(
      chain: SupportedChain,
      params: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<Record<string, unknown>> {
      const { pool, tokenA, tokenB, amountA, amountB } = params as {
        pool: string;
        tokenA: string;
        tokenB: string;
        amountA: string;
        amountB: string;
      };

      console.log(`[YieldFarm] Add liquidity: ${amountA} ${tokenA} + ${amountB} ${tokenB} to ${pool}`);

      return {
        txHash: 'mock-lp-tx-' + Date.now(),
        pool,
        lpTokens: String(Math.min(Number(amountA), Number(amountB)) / 1000),
      };
    },
  };
}

export function createBorrowHandler(): ActionHandler {
  return {
    async execute(
      chain: SupportedChain,
      params: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<Record<string, unknown>> {
      const { token, amount, collateral } = params as {
        token: string;
        amount: string;
        collateral?: string;
      };

      console.log(`[Borrow] ${amount} ${token} (collateral: ${collateral || 'auto'})`);

      return {
        txHash: 'mock-borrow-tx-' + Date.now(),
        token,
        amount,
        collateral,
        healthFactor: '1.5',
      };
    },
  };
}

export function createRepayHandler(): ActionHandler {
  return {
    async execute(
      chain: SupportedChain,
      params: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<Record<string, unknown>> {
      const { token, amount } = params as { token: string; amount: string };

      console.log(`[Repay] ${amount} ${token}`);

      return {
        txHash: 'mock-repay-tx-' + Date.now(),
        token,
        amount,
        remainingDebt: '0',
      };
    },
  };
}

/**
 * Create all trading handlers as a map
 * Uses real implementations for swap/bridge/transfer/stake
 * Uses mock implementations for yieldFarm/borrow/repay/unstake
 */
export function createTradingHandlers(config?: {
  jupiterApiUrl?: string;
  wormholeApiUrl?: string;
  useTritonCascade?: boolean;
}): Map<string, ActionHandler> {
  const { createRealSwapHandler, createRealBridgeHandler, createRealTransferHandler, createRealStakeHandler } = require('./trading-real.js');
  
  return new Map([
    ['swap', createRealSwapHandler(config)],
    ['bridge', createRealBridgeHandler(config)],
    ['transfer', createRealTransferHandler(config)],
    ['stake', createRealStakeHandler(config)],
    ['unstake', createUnstakeHandler()],
    ['yieldFarm', createYieldFarmHandler()],
    ['borrow', createBorrowHandler()],
    ['repay', createRepayHandler()],
  ]);
}

// Export types
export type { SwapParams, BridgeParams, TransferParams, StakeParams } from './trading-real.js';
