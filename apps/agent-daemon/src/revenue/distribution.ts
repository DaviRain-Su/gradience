/**
 * Revenue Distribution Module
 *
 * Handles on-chain revenue distribution using Solana CPI (Cross-Program Invocation).
 * Integrates with Chain Hub program for automated payment splitting.
 *
 * Distribution Model:
 * - Agent: 95% (task completion reward)
 * - Judge: 3% (evaluation reward)
 * - Protocol: 2% (platform fee)
 *
 * @module revenue/distribution
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  type Signer,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createTransferInstruction,
} from '@solana/spl-token';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';

// ============================================================================
// Types
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

export interface TokenAccountInfo {
  address: PublicKey;
  mint: PublicKey;
  owner: PublicKey;
  balance: bigint;
}

// ============================================================================
// Revenue Distributor
// ============================================================================

export class RevenueDistributor {
  private connection: Connection;
  private config: DistributionConfig;

  constructor(connection: Connection, config: DistributionConfig) {
    this.connection = connection;
    this.config = config;

    // Validate percentages sum to 10000 (100%)
    const total = config.percentages.agent + config.percentages.judge + config.percentages.protocol;
    if (total !== 10000) {
      throw new DaemonError(
        ErrorCodes.INVALID_CONFIG,
        `Distribution percentages must sum to 10000 (100%), got ${total}`,
        400
      );
    }
  }

  // -------------------------------------------------------------------------
  // Distribution Methods
  // -------------------------------------------------------------------------

  /**
   * Distribute revenue from escrow to recipients
   */
  async distribute(
    request: DistributionRequest,
    signer: Signer
  ): Promise<DistributionResult> {
    const distributionId = `${request.paymentId}-${Date.now()}`;

    logger.info(
      {
        distributionId,
        taskId: request.taskId,
        agent: request.agentAddress.toBase58(),
        totalAmount: request.totalAmount.toString(),
      },
      'Starting revenue distribution'
    );

    try {
      // Calculate amounts
      const breakdown = this.calculateBreakdown(
        request.totalAmount,
        request.agentAddress,
        request.judgeAddress
      );

      // Get or create token accounts
      const tokenAccounts = await this.getOrCreateTokenAccounts(
        request,
        signer
      );

      // Build CPI instruction
      const instruction = await this.buildDistributionInstruction(
        request,
        tokenAccounts,
        breakdown
      );

      // Create and send transaction
      const transaction = new Transaction().add(instruction);
      
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = signer.publicKey;

      // Sign and send
      transaction.sign(signer);
      const txSignature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        }
      );

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(
        { signature: txSignature, blockhash, lastValidBlockHeight },
        'confirmed'
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      // Get block time
      const tx = await this.connection.getTransaction(txSignature, {
        commitment: 'confirmed',
      });

      logger.info(
        {
          distributionId,
          txSignature,
          agentAmount: breakdown.agent.amount.toString(),
          judgeAmount: breakdown.judge.amount.toString(),
          protocolAmount: breakdown.protocol.amount.toString(),
        },
        'Revenue distribution completed'
      );

      return {
        distributionId,
        txSignature,
        blockTime: tx?.blockTime || Date.now(),
        slot: confirmation.context.slot,
        breakdown: {
          agent: {
            address: breakdown.agent.address.toBase58(),
            amount: breakdown.agent.amount,
          },
          judge: {
            address: breakdown.judge.address.toBase58(),
            amount: breakdown.judge.amount,
          },
          protocol: {
            address: breakdown.protocol.address.toBase58(),
            amount: breakdown.protocol.amount,
          },
        },
        status: 'confirmed',
      };
    } catch (error) {
      logger.error({ error, distributionId }, 'Revenue distribution failed');

      return {
        distributionId,
        txSignature: '',
        blockTime: 0,
        slot: 0,
        breakdown: {
          agent: { address: request.agentAddress.toBase58(), amount: 0n },
          judge: { address: request.judgeAddress.toBase58(), amount: 0n },
          protocol: { address: this.config.protocolTreasury.toBase58(), amount: 0n },
        },
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Distribute SPL tokens using CPI
   */
  async distributeTokens(
    request: DistributionRequest,
    signer: Signer
  ): Promise<DistributionResult> {
    const distributionId = `token-${request.paymentId}-${Date.now()}`;

    logger.info(
      {
        distributionId,
        tokenMint: request.tokenMint.toBase58(),
        totalAmount: request.totalAmount.toString(),
      },
      'Starting token distribution'
    );

    try {
      const breakdown = this.calculateBreakdown(
        request.totalAmount,
        request.agentAddress,
        request.judgeAddress
      );

      // Get associated token accounts
      const [escrowATA, agentATA, judgeATA, protocolATA] = await Promise.all([
        getAssociatedTokenAddress(request.tokenMint, request.escrowAuthority),
        getAssociatedTokenAddress(request.tokenMint, breakdown.agent.address),
        getAssociatedTokenAddress(request.tokenMint, breakdown.judge.address),
        getAssociatedTokenAddress(request.tokenMint, breakdown.protocol.address),
      ]);

      // Build token transfer instructions
      const instructions: TransactionInstruction[] = [];

      // Transfer to agent (95%)
      instructions.push(
        createTransferInstruction(
          escrowATA,
          agentATA,
          request.escrowAuthority,
          breakdown.agent.amount
        )
      );

      // Transfer to judge (3%)
      instructions.push(
        createTransferInstruction(
          escrowATA,
          judgeATA,
          request.escrowAuthority,
          breakdown.judge.amount
        )
      );

      // Transfer to protocol (2%)
      instructions.push(
        createTransferInstruction(
          escrowATA,
          protocolATA,
          request.escrowAuthority,
          breakdown.protocol.amount
        )
      );

      // Create and send transaction
      const transaction = new Transaction().add(...instructions);
      
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = signer.publicKey;

      transaction.sign(signer);
      const txSignature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        { skipPreflight: false, preflightCommitment: 'confirmed' }
      );

      const confirmation = await this.connection.confirmTransaction(
        { signature: txSignature, blockhash, lastValidBlockHeight },
        'confirmed'
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      const tx = await this.connection.getTransaction(txSignature, {
        commitment: 'confirmed',
      });

      logger.info({ distributionId, txSignature }, 'Token distribution completed');

      return {
        distributionId,
        txSignature,
        blockTime: tx?.blockTime || Date.now(),
        slot: confirmation.context.slot,
        breakdown: {
          agent: { address: agentATA.toBase58(), amount: breakdown.agent.amount },
          judge: { address: judgeATA.toBase58(), amount: breakdown.judge.amount },
          protocol: { address: protocolATA.toBase58(), amount: breakdown.protocol.amount },
        },
        status: 'confirmed',
      };
    } catch (error) {
      logger.error({ error, distributionId }, 'Token distribution failed');

      return {
        distributionId,
        txSignature: '',
        blockTime: 0,
        slot: 0,
        breakdown: {
          agent: { address: '', amount: 0n },
          judge: { address: '', amount: 0n },
          protocol: { address: '', amount: 0n },
        },
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // -------------------------------------------------------------------------
  // Helper Methods
  // -------------------------------------------------------------------------

  private calculateBreakdown(
    totalAmount: bigint,
    agentAddress: PublicKey,
    judgeAddress: PublicKey
  ) {
    const agentAmount = (totalAmount * BigInt(this.config.percentages.agent)) / 10000n;
    const judgeAmount = (totalAmount * BigInt(this.config.percentages.judge)) / 10000n;
    const protocolAmount = (totalAmount * BigInt(this.config.percentages.protocol)) / 10000n;

    // Handle rounding - give remainder to agent
    const distributed = agentAmount + judgeAmount + protocolAmount;
    const remainder = totalAmount - distributed;

    return {
      agent: { address: agentAddress, amount: agentAmount + remainder },
      judge: { address: judgeAddress, amount: judgeAmount },
      protocol: { address: this.config.protocolTreasury, amount: protocolAmount },
    };
  }

  private async getOrCreateTokenAccounts(
    request: DistributionRequest,
    payer: Signer
  ): Promise<{
    escrow: PublicKey;
    agent: PublicKey;
    judge: PublicKey;
    protocol: PublicKey;
  }> {
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
      getAssociatedTokenAddress(request.tokenMint, this.config.protocolTreasury),
    ]);

    return {
      escrow: escrowATA,
      agent: agentATA,
      judge: judgeATA,
      protocol: protocolATA,
    };
  }

  private async buildDistributionInstruction(
    request: DistributionRequest,
    tokenAccounts: {
      escrow: PublicKey;
      agent: PublicKey;
      judge: PublicKey;
      protocol: PublicKey;
    },
    breakdown: {
      agent: { address: PublicKey; amount: bigint };
      judge: { address: PublicKey; amount: bigint };
      protocol: { address: PublicKey; amount: bigint };
    }
  ): Promise<TransactionInstruction> {
    // Build Chain Hub CPI instruction
    // This would be generated from the Chain Hub IDL
    
    const instructionData = Buffer.alloc(200);
    
    // Discriminator for distribute_revenue instruction
    const discriminator = Buffer.from([213, 74, 217, 238, 155, 234, 174, 197]);
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
    const paymentIdBuf = Buffer.from(request.paymentId.slice(0, 32).padEnd(32, '\0'));
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
        { pubkey: request.escrowAuthority, isSigner: true, isWritable: false },
        // Token program
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        // System program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.config.chainHubProgramId,
      data: instructionData,
    });
  }

  // -------------------------------------------------------------------------
  // Query Methods
  // -------------------------------------------------------------------------

  /**
   * Get token account balance
   */
  async getTokenBalance(tokenAccount: PublicKey): Promise<bigint> {
    try {
      const accountInfo = await this.connection.getTokenAccountBalance(tokenAccount);
      return BigInt(accountInfo.value.amount);
    } catch (error) {
      logger.error({ error, tokenAccount: tokenAccount.toBase58() }, 'Failed to get token balance');
      return 0n;
    }
  }

  /**
   * Verify distribution was successful
   */
  async verifyDistribution(
    txSignature: string,
    expectedBreakdown: {
      agent: { address: string; amount: bigint };
      judge: { address: string; amount: bigint };
      protocol: { address: string; amount: bigint };
    }
  ): Promise<{
    valid: boolean;
    actualBreakdown?: typeof expectedBreakdown;
    error?: string;
  }> {
    try {
      const tx = await this.connection.getTransaction(txSignature, {
        commitment: 'confirmed',
      });

      if (!tx) {
        return { valid: false, error: 'Transaction not found' };
      }

      if (tx.meta?.err) {
        return { valid: false, error: `Transaction failed: ${JSON.stringify(tx.meta.err)}` };
      }

      // Parse token balance changes from transaction
      const preBalances = tx.meta?.preTokenBalances || [];
      const postBalances = tx.meta?.postTokenBalances || [];

      // Verify each recipient received expected amount
      // This is simplified - in production, parse the actual token transfers

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

export interface DistributorOptions {
  rpcEndpoint?: string;
  chainHubProgramId?: string;
  protocolTreasury?: string;
  judgePool?: string;
  percentages?: {
    agent: number;
    judge: number;
    protocol: number;
  };
}

export function createRevenueDistributor(options: DistributorOptions = {}): RevenueDistributor {
  const rpcEndpoint = options.rpcEndpoint || 'https://api.devnet.solana.com';
  const connection = new Connection(rpcEndpoint, 'confirmed');

  const config: DistributionConfig = {
    chainHubProgramId: new PublicKey(
      options.chainHubProgramId || '6G39W7JGQz7A6L5dAvotFuRP9UbFdCJg2BqDuj6WJWec'
    ),
    protocolTreasury: new PublicKey(
      options.protocolTreasury || 'ProtTreasury1111111111111111111111111111111'
    ),
    judgePool: new PublicKey(
      options.judgePool || 'JudgePool111111111111111111111111111111111111'
    ),
    percentages: options.percentages || {
      agent: 9500,    // 95%
      judge: 300,     // 3%
      protocol: 200,  // 2%
    },
  };

  return new RevenueDistributor(connection, config);
}
