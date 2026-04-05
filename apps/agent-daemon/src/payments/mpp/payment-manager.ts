/**
 * MPP Payment Manager
 *
 * Handles payment creation, escrow funding, and queries for Multi-Party Payments.
 *
 * @module payments/mpp/payment-manager
 */

import { Connection, PublicKey, Transaction, SystemProgram, type Signer } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { logger } from '../../utils/logger.js';
import { DaemonError, ErrorCodes } from '../../utils/errors.js';
import type {
  MPPPayment,
  MPPParticipant,
  MPPJudge,
  MPPReleaseCondition,
  MPPVote,
  MPPConfig,
  MPPStatus,
} from './types.js';

// ============================================================================
// MPP Payment Manager
// ============================================================================

export class MPPPaymentManager {
  private payments: Map<string, MPPPayment> = new Map();
  private votes: Map<string, MPPVote[]> = new Map();
  private connection: Connection;
  private config: MPPConfig;

  constructor(config: Partial<MPPConfig> = {}) {
    this.config = {
      rpcEndpoint: config.rpcEndpoint || 'https://api.devnet.solana.com',
      maxParticipants: config.maxParticipants || 10,
      maxJudges: config.maxJudges || 5,
      defaultTimeoutMs: config.defaultTimeoutMs || 7 * 24 * 60 * 60 * 1000, // 7 days
      minJudgeThresholdBps: config.minJudgeThresholdBps || 5000, // 50%
      ...config,
    };

    this.connection = new Connection(this.config.rpcEndpoint, 'confirmed');
  }

  // -------------------------------------------------------------------------
  // Payment Creation
  // -------------------------------------------------------------------------

  /**
   * Create a new multi-party payment
   */
  async createPayment(params: {
    taskId: string;
    totalAmount: bigint;
    token: string;
    tokenSymbol: string;
    decimals: number;
    payer: string;
    escrow?: string;
    participants: Omit<MPPParticipant, 'allocatedAmount' | 'releasedAmount' | 'hasClaimed'>[];
    judges: Omit<MPPJudge, 'hasVoted' | 'vote'>[];
    releaseConditions: MPPReleaseCondition;
    expiresAt?: number;
  }): Promise<MPPPayment> {
    // Validate participants
    if (params.participants.length > this.config.maxParticipants) {
      throw new DaemonError(
        ErrorCodes.MPP_TOO_MANY_PARTICIPANTS,
        `Maximum ${this.config.maxParticipants} participants allowed`,
        400
      );
    }

    // Validate judges
    if (params.judges.length > this.config.maxJudges) {
      throw new DaemonError(
        ErrorCodes.MPP_TOO_MANY_JUDGES,
        `Maximum ${this.config.maxJudges} judges allowed`,
        400
      );
    }

    // Validate shares sum to 10000 (100%)
    const totalShares = params.participants.reduce((sum, p) => sum + p.shareBps, 0);
    if (totalShares !== 10000) {
      throw new DaemonError(
        ErrorCodes.MPP_INVALID_SHARES,
        `Participant shares must sum to 10000 (100%), got ${totalShares}`,
        400
      );
    }

    // Calculate allocated amounts
    const participants: MPPParticipant[] = params.participants.map(p => ({
      ...p,
      allocatedAmount: (params.totalAmount * BigInt(p.shareBps)) / 10000n,
      releasedAmount: 0n,
      hasClaimed: false,
    }));

    // Initialize judges
    const judges: MPPJudge[] = params.judges.map(j => ({
      ...j,
      hasVoted: false,
    }));

    const payment: MPPPayment = {
      paymentId: this.generatePaymentId(),
      taskId: params.taskId,
      totalAmount: params.totalAmount,
      token: params.token,
      tokenSymbol: params.tokenSymbol,
      decimals: params.decimals,
      payer: params.payer,
      escrow: params.escrow || '', // Set escrow if provided
      participants,
      judges,
      releaseConditions: params.releaseConditions,
      status: 'pending_funding',
      createdAt: Date.now(),
      expiresAt: params.expiresAt || Date.now() + this.config.defaultTimeoutMs,
    };

    this.payments.set(payment.paymentId, payment);
    this.votes.set(payment.paymentId, []);

    logger.info(
      {
        paymentId: payment.paymentId,
        taskId: params.taskId,
        participants: params.participants.length,
        judges: params.judges.length,
      },
      'MPP payment created'
    );

    return payment;
  }

  // -------------------------------------------------------------------------
  // Funding
  // -------------------------------------------------------------------------

  /**
   * Fund the escrow account
   */
  async fundEscrow(
    paymentId: string,
    escrowAddress: string,
    signer: Signer
  ): Promise<{ txSignature: string }> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new DaemonError(ErrorCodes.PAYMENT_NOT_FOUND, 'Payment not found', 404);
    }

    if (payment.status !== 'pending_funding') {
      throw new DaemonError(
        ErrorCodes.PAYMENT_INVALID_STATE,
        `Cannot fund in state: ${payment.status}`,
        400
      );
    }

    // Create funding transaction
    const transaction = new Transaction();

    transaction.add(
      SystemProgram.transfer({
        fromPubkey: signer.publicKey,
        toPubkey: new PublicKey(escrowAddress),
        lamports: payment.totalAmount,
      })
    );

    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = signer.publicKey;

    transaction.sign(signer);

    const txSignature = await this.connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false, preflightCommitment: 'confirmed' }
    );

    await this.connection.confirmTransaction(txSignature, 'confirmed');

    payment.escrow = escrowAddress;
    payment.status = 'funded';

    logger.info({ paymentId, txSignature, escrow: escrowAddress }, 'MPP escrow funded');

    return { txSignature };
  }

  // -------------------------------------------------------------------------
  // Query Methods
  // -------------------------------------------------------------------------

  /**
   * Get a payment by ID
   */
  getPayment(paymentId: string): MPPPayment | undefined {
    return this.payments.get(paymentId);
  }

  /**
   * Get votes for a payment
   */
  getVotes(paymentId: string): MPPVote[] {
    return this.votes.get(paymentId) || [];
  }

  /**
   * List payments with optional filters
   */
  listPayments(filter?: { status?: MPPStatus; payer?: string }): MPPPayment[] {
    let payments = Array.from(this.payments.values());

    if (filter?.status) {
      payments = payments.filter(p => p.status === filter.status);
    }

    if (filter?.payer) {
      payments = payments.filter(p => p.payer === filter.payer);
    }

    return payments;
  }

  // -------------------------------------------------------------------------
  // Utility Methods
  // -------------------------------------------------------------------------

  /**
   * Generate a unique payment ID
   */
  private generatePaymentId(): string {
    return `mpp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Clean up expired payments
   * @returns Number of payments marked as expired
   */
  cleanupExpiredPayments(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [paymentId, payment] of this.payments) {
      if (now > payment.expiresAt && payment.status === 'pending_funding') {
        payment.status = 'expired';
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Close manager and cleanup
   */
  async close(): Promise<void> {
    this.payments.clear();
    this.votes.clear();
  }
}
