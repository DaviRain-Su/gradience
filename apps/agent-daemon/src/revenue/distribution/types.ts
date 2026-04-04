/**
 * Distribution Types
 *
 * Type definitions for revenue distribution module.
 */

import { PublicKey } from '@solana/web3.js';

// ============================================================================
// Configuration Types
// ============================================================================

export interface DistributionConfig {
  /** Chain Hub program ID */
  chainHubProgramId: PublicKey;
  /** Protocol treasury address */
  protocolTreasury: PublicKey;
  /** Judge pool address */
  judgePool: PublicKey;
  /** Distribution percentages (basis points: 10000 = 100%) */
  percentages: {
    agent: number;    // 9500 = 95%
    judge: number;    // 300 = 3%
    protocol: number; // 200 = 2%
  };
}

// ============================================================================
// Request/Result Types
// ============================================================================

export interface DistributionRequest {
  /** Payment ID */
  paymentId: string;
  /** Task ID */
  taskId: string;
  /** Agent receiving payment */
  agentAddress: PublicKey;
  /** Judge receiving evaluation fee */
  judgeAddress: PublicKey;
  /** Token mint (USDC, SOL, etc.) */
  tokenMint: PublicKey;
  /** Total amount in smallest unit */
  totalAmount: bigint;
  /** Escrow account holding funds */
  escrowAccount: PublicKey;
  /** Authority that can release escrow */
  escrowAuthority: PublicKey;
}

export interface DistributionResult {
  /** Distribution ID */
  distributionId: string;
  /** Transaction signature */
  txSignature: string;
  /** Block time */
  blockTime: number;
  /** Slot */
  slot: number;
  /** Distribution breakdown */
  breakdown: {
    agent: { address: string; amount: bigint };
    judge: { address: string; amount: bigint };
    protocol: { address: string; amount: bigint };
  };
  /** Status */
  status: 'confirmed' | 'failed';
  /** Error message (if failed) */
  error?: string;
}

// ============================================================================
// Token Account Types
// ============================================================================

export interface TokenAccountInfo {
  address: PublicKey;
  mint: PublicKey;
  owner: PublicKey;
  balance: bigint;
}

export interface TokenAccounts {
  escrow: PublicKey;
  agent: PublicKey;
  judge: PublicKey;
  protocol: PublicKey;
}

// ============================================================================
// Distribution Breakdown Types
// ============================================================================

export interface DistributionBreakdown {
  agent: { address: PublicKey; amount: bigint };
  judge: { address: PublicKey; amount: bigint };
  protocol: { address: PublicKey; amount: bigint };
}

// ============================================================================
// Builder Options
// ============================================================================

export interface DistributionBuilderOptions {
  config: DistributionConfig;
}
