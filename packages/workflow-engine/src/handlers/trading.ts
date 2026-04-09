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

// ============ Type Definitions ============

export interface SwapParams {
    from: string;
    to: string;
    amount: string;
    slippage?: number;
    signer: import('@solana/web3.js').Signer;
    useJitoBundle?: boolean;
}

export interface BridgeParams {
    fromChain: SupportedChain;
    toChain: SupportedChain;
    token: string;
    amount: string;
    recipient?: string;
    signer: import('@solana/web3.js').Signer;
}

export interface TransferParams {
    token: string;
    to: string;
    amount: string;
    signer: import('@solana/web3.js').Signer;
    useJitoBundle?: boolean;
}

export interface StakeParams {
    validator?: string;
    amount: string;
    signer: import('@solana/web3.js').Signer;
}

export interface UnstakeParams {
    stakeAccount: string;
    amount?: string;
    signer: import('@solana/web3.js').Signer;
}

export interface YieldFarmParams {
    pool: string;
    tokenA: string;
    tokenB: string;
    amountA: string;
    amountB: string;
    signer: import('@solana/web3.js').Signer;
}

export interface BorrowParams {
    token: string;
    amount: string;
    collateral?: string;
    signer: import('@solana/web3.js').Signer;
}

export interface RepayParams {
    token: string;
    amount: string;
    signer: import('@solana/web3.js').Signer;
}

// Re-export real implementations from trading-real.ts
export {
    createRealSwapHandler as createSwapHandler,
    createRealBridgeHandler as createBridgeHandler,
    createRealTransferHandler as createTransferHandler,
    createRealStakeHandler as createStakeHandler,
    createRealUnstakeHandler as createUnstakeHandler,
    createRealYieldFarmHandler as createYieldFarmHandler,
    createRealBorrowHandler as createBorrowHandler,
    createRealRepayHandler as createRepayHandler,
    createRealTradingHandlers as createTradingHandlers,
} from './trading-real.js';
