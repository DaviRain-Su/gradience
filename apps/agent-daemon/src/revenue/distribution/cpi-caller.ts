/**
 * CPI Caller Module
 *
 * Handles executing CPI (Cross-Program Invocation) calls for revenue distributions.
 * Provides methods for native SOL and SPL token distributions.
 *
 * @module revenue/distribution/cpi-caller
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  type Signer,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
} from '@solana/spl-token';
import { logger } from '../../utils/logger.js';
import { DaemonError, ErrorCodes } from '../../utils/errors.js';
import type {
  DistributionRequest,
  DistributionResult,
  DistributionConfig,
} from './types.js';

/**
 * Calculate distribution breakdown based on percentages
 */
function calculateBreakdown(
  totalAmount: bigint,
  agentAddress: PublicKey,
  judgeAddress: PublicKey,
  protocolTreasury: PublicKey,
  percentages: { agent: number; judge: number; protocol: number }
): {
  agent: { address: PublicKey; amount: bigint };
  judge: { address: PublicKey; amount: bigint };
  protocol: { address: PublicKey; amount: bigint };
} {
  const agentAmount = (totalAmount * BigInt(percentages.agent)) / 10000n;
  const judgeAmount = (totalAmount * BigInt(percentages.judge)) / 10000n;
  const protocolAmount = (totalAmount * BigInt(percentages.protocol)) / 10000n;

  // Handle rounding - give remainder to agent
  const distributed = agentAmount + judgeAmount + protocolAmount;
  const remainder = totalAmount - distributed;

  return {
    agent: { address: agentAddress, amount: agentAmount + remainder },
    judge: { address: judgeAddress, amount: judgeAmount },
    protocol: { address: protocolTreasury, amount: protocolAmount },
  };
}

/**
 * Distribute native SOL from escrow to recipients
 *
 * @param connection - Solana connection
 * @param config - Distribution configuration
 * @param request - Distribution request details
 * @param signer - Transaction signer
 * @returns Distribution result
 */
export async function distribute(
  connection: Connection,
  config: DistributionConfig,
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
    'Starting native SOL distribution'
  );

  try {
    // Calculate amounts
    const breakdown = calculateBreakdown(
      request.totalAmount,
      request.agentAddress,
      request.judgeAddress,
      config.protocolTreasury,
      config.percentages
    );

    // Build transfer instructions for native SOL
    const transaction = new Transaction();

    // Transfer to agent (95%)
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: request.escrowAuthority,
        toPubkey: breakdown.agent.address,
        lamports: breakdown.agent.amount,
      })
    );

    // Transfer to judge (3%)
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: request.escrowAuthority,
        toPubkey: breakdown.judge.address,
        lamports: breakdown.judge.amount,
      })
    );

    // Transfer to protocol (2%)
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: request.escrowAuthority,
        toPubkey: breakdown.protocol.address,
        lamports: breakdown.protocol.amount,
      })
    );

    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = signer.publicKey;

    // Sign and send
    transaction.sign(signer);
    const txSignature = await connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      }
    );

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(
      { signature: txSignature, blockhash, lastValidBlockHeight },
      'confirmed'
    );

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    // Get block time
    const tx = await connection.getTransaction(txSignature, {
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
      'Native SOL distribution completed'
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
    logger.error({ error, distributionId }, 'Native SOL distribution failed');

    return {
      distributionId,
      txSignature: '',
      blockTime: 0,
      slot: 0,
      breakdown: {
        agent: { address: request.agentAddress.toBase58(), amount: 0n },
        judge: { address: request.judgeAddress.toBase58(), amount: 0n },
        protocol: { address: config.protocolTreasury.toBase58(), amount: 0n },
      },
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Distribute SPL tokens using CPI
 *
 * @param connection - Solana connection
 * @param config - Distribution configuration
 * @param request - Distribution request details
 * @param signer - Transaction signer
 * @returns Distribution result
 */
export async function distributeTokens(
  connection: Connection,
  config: DistributionConfig,
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
    const breakdown = calculateBreakdown(
      request.totalAmount,
      request.agentAddress,
      request.judgeAddress,
      config.protocolTreasury,
      config.percentages
    );

    // Get associated token accounts
    const { getAssociatedTokenAddress } = await import('@solana/spl-token');

    const [escrowATA, agentATA, judgeATA, protocolATA] = await Promise.all([
      getAssociatedTokenAddress(request.tokenMint, request.escrowAuthority),
      getAssociatedTokenAddress(request.tokenMint, breakdown.agent.address),
      getAssociatedTokenAddress(request.tokenMint, breakdown.judge.address),
      getAssociatedTokenAddress(request.tokenMint, breakdown.protocol.address),
    ]);

    // Build token transfer instructions
    const transaction = new Transaction();

    // Transfer to agent (95%)
    transaction.add(
      createTransferInstruction(
        escrowATA,
        agentATA,
        request.escrowAuthority,
        breakdown.agent.amount
      )
    );

    // Transfer to judge (3%)
    transaction.add(
      createTransferInstruction(
        escrowATA,
        judgeATA,
        request.escrowAuthority,
        breakdown.judge.amount
      )
    );

    // Transfer to protocol (2%)
    transaction.add(
      createTransferInstruction(
        escrowATA,
        protocolATA,
        request.escrowAuthority,
        breakdown.protocol.amount
      )
    );

    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = signer.publicKey;

    // Sign and send
    transaction.sign(signer);
    const txSignature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false, preflightCommitment: 'confirmed' }
    );

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(
      { signature: txSignature, blockhash, lastValidBlockHeight },
      'confirmed'
    );

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    // Get block time
    const tx = await connection.getTransaction(txSignature, {
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
