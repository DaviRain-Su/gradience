/**
 * Distribution Builder
 *
 * Handles building distribution instructions and calculating amounts.
 *
 * @module revenue/distribution/builder
 */

import {
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { logger } from '../../utils/logger.js';
import { DaemonError, ErrorCodes } from '../../utils/errors.js';
import {
  DistributionConfig,
  DistributionRequest,
  TokenAccounts,
  DistributionBreakdown,
} from './types.js';

// ============================================================================
// Distribution Builder
// ============================================================================

export class DistributionBuilder {
  private config: DistributionConfig;

  constructor(options: { config: DistributionConfig }) {
    this.config = options.config;

    // Validate percentages sum to 10000 (100%)
    const total =
      options.config.percentages.agent +
      options.config.percentages.judge +
      options.config.percentages.protocol;
    if (total !== 10000) {
      throw new DaemonError(
        ErrorCodes.INVALID_CONFIG,
        `Distribution percentages must sum to 10000 (100%), got ${total}`,
        400
      );
    }
  }

  // -------------------------------------------------------------------------
  // Amount Calculation
  // -------------------------------------------------------------------------

  /**
   * Calculate distribution amounts for each recipient
   */
  calculateBreakdown(
    totalAmount: bigint,
    agentAddress: PublicKey,
    judgeAddress: PublicKey
  ): DistributionBreakdown {
    const agentAmount =
      (totalAmount * BigInt(this.config.percentages.agent)) / 10000n;
    const judgeAmount =
      (totalAmount * BigInt(this.config.percentages.judge)) / 10000n;
    const protocolAmount =
      (totalAmount * BigInt(this.config.percentages.protocol)) / 10000n;

    // Handle rounding - give remainder to agent
    const distributed = agentAmount + judgeAmount + protocolAmount;
    const remainder = totalAmount - distributed;

    return {
      agent: { address: agentAddress, amount: agentAmount + remainder },
      judge: { address: judgeAddress, amount: judgeAmount },
      protocol: { address: this.config.protocolTreasury, amount: protocolAmount },
    };
  }

  // -------------------------------------------------------------------------
  // Token Account Resolution
  // -------------------------------------------------------------------------

  /**
   * Get or create token accounts for distribution
   */
  async getOrCreateTokenAccounts(
    request: DistributionRequest,
    payer: { publicKey: PublicKey }
  ): Promise<TokenAccounts> {
    // For native SOL, use wallet addresses directly
    if (request.tokenMint.equals(SystemProgram.programId)) {
      return {
        escrow: request.escrowAccount,
        agent: request.agentAddress,
        judge: request.judgeAddress,
        protocol: this.config.protocolTreasury,
      };
    }

    // For SPL tokens, get associated token addresses
    const [escrowATA, agentATA, judgeATA, protocolATA] = await Promise.all([
      getAssociatedTokenAddress(request.tokenMint, request.escrowAuthority),
      getAssociatedTokenAddress(request.tokenMint, request.agentAddress),
      getAssociatedTokenAddress(request.tokenMint, request.judgeAddress),
      getAssociatedTokenAddress(
        request.tokenMint,
        this.config.protocolTreasury
      ),
    ]);

    return {
      escrow: escrowATA,
      agent: agentATA,
      judge: judgeATA,
      protocol: protocolATA,
    };
  }

  // -------------------------------------------------------------------------
  // Instruction Building
  // -------------------------------------------------------------------------

  /**
   * Build Chain Hub CPI distribution instruction
   */
  async buildDistributionInstruction(
    request: DistributionRequest,
    tokenAccounts: TokenAccounts,
    breakdown: DistributionBreakdown
  ): Promise<TransactionInstruction> {
    // Build Chain Hub CPI instruction
    // This would be generated from the Chain Hub IDL

    const instructionData = Buffer.alloc(200);

    // Discriminator for distribute_revenue instruction
    const discriminator = Buffer.from([
      213, 74, 217, 238, 155, 234, 174, 197,
    ]);
    discriminator.copy(instructionData, 0);

    // Encode amounts (8 bytes each, little-endian)
    const agentAmountBuf = Buffer.alloc(8);
    agentAmountBuf.writeBigUInt64LE(breakdown.agent.amount, 0);
    agentAmountBuf.copy(instructionData, 8);

    const judgeAmountBuf = Buffer.alloc(8);
    judgeAmountBuf.writeBigUInt64LE(breakdown.judge.amount, 0);
    judgeAmountBuf.copy(instructionData, 16);

    const protocolAmountBuf = Buffer.alloc(8);
    protocolAmountBuf.writeBigUInt64LE(breakdown.protocol.amount, 0);
    protocolAmountBuf.copy(instructionData, 24);

    // Encode payment ID (32 bytes)
    const paymentIdBuf = Buffer.from(
      request.paymentId.slice(0, 32).padEnd(32, '\0')
    );
    paymentIdBuf.copy(instructionData, 32);

    return new TransactionInstruction({
      keys: [
        // Escrow account (writable)
        { pubkey: tokenAccounts.escrow, isSigner: false, isWritable: true },
        // Agent token account (writable)
        { pubkey: tokenAccounts.agent, isSigner: false, isWritable: true },
        // Judge token account (writable)
        { pubkey: tokenAccounts.judge, isSigner: false, isWritable: true },
        // Protocol treasury (writable)
        { pubkey: tokenAccounts.protocol, isSigner: false, isWritable: true },
        // Escrow authority (signer)
        {
          pubkey: request.escrowAuthority,
          isSigner: true,
          isWritable: false,
        },
        // Token program
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        // System program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.config.chainHubProgramId,
      data: instructionData,
    });
  }
}

// ============================================================================
// Factory
// ============================================================================

export interface DistributionBuilderFactoryOptions {
  chainHubProgramId: PublicKey;
  protocolTreasury: PublicKey;
  judgePool: PublicKey;
  percentages?: {
    agent: number;
    judge: number;
    protocol: number;
  };
}

export function createDistributionBuilder(
  options: DistributionBuilderFactoryOptions
): DistributionBuilder {
  const config: DistributionConfig = {
    chainHubProgramId: options.chainHubProgramId,
    protocolTreasury: options.protocolTreasury,
    judgePool: options.judgePool,
    percentages: options.percentages || {
      agent: 9500, // 95%
      judge: 300, // 3%
      protocol: 200, // 2%
    },
  };

  return new DistributionBuilder({ config });
}
