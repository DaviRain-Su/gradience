/**
 * Trading Types
 *
 * Type definitions for trading/DeFi operations
 */
import type { ActionHandler, ExecutionContext } from '../../engine/step-executor.js';
import type { SupportedChain } from '../../schema/types.js';
import type { Signer } from '@solana/web3.js';

// Jupiter API types
export interface JupiterQuote {
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    otherAmountThreshold: string;
    swapMode: string;
    slippageBps: number;
    platformFee: null | { amount: string; feeBps: number };
    priceImpactPct: string;
    routePlan: Array<{
        swapInfo: {
            ammKey: string;
            label: string;
            inputMint: string;
            outputMint: string;
            inAmount: string;
            outAmount: string;
            feeAmount: string;
            feeMint: string;
        };
        percent: number;
    }>;
}

export interface JupiterSwapResponse {
    swapTransaction: string;
    lastValidBlockHeight: number;
    prioritizationFeeLamports?: number;
}

// Trading params types
export interface SwapParams {
    from: string;
    to: string;
    amount: string;
    slippage?: number;
    signer: Signer;
    useJitoBundle?: boolean;
}

export interface BridgeParams {
    fromChain: SupportedChain;
    toChain: SupportedChain;
    token: string;
    amount: string;
    recipient?: string;
    signer: Signer;
}

export interface TransferParams {
    token: string;
    to: string;
    amount: string;
    signer: Signer;
    useJitoBundle?: boolean;
}

export interface StakeParams {
    validator?: string;
    amount: string;
    signer: Signer;
}

export interface UnstakeParams {
    stakeAccount: string;
    amount?: string;
    signer: Signer;
}

export interface YieldFarmParams {
    pool: string;
    tokenA: string;
    tokenB: string;
    amountA: string;
    amountB: string;
    signer: Signer;
}

export interface BorrowParams {
    token: string;
    amount: string;
    collateral?: string;
    signer: Signer;
}

export interface RepayParams {
    token: string;
    amount: string;
    signer: Signer;
}

// Handler config types
export interface TradingHandlerConfig {
    connection?: import('@solana/web3.js').Connection;
    jupiterApiUrl?: string;
    useTritonCascade?: boolean;
}

export interface TransferHandlerConfig {
    connection?: import('@solana/web3.js').Connection;
    useTritonCascade?: boolean;
}
