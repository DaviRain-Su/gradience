/**
 * Multi-Party Payment (MPP) Handler
 *
 * Handles complex payment scenarios with multiple participants:
 * - Escrow with multiple judges
 * - Milestone-based payments
 * - Revenue sharing among multiple parties
 * - Conditional releases based on voting
 *
 * @module payments/mpp-handler
 */

import { EventEmitter } from 'node:events';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  type Signer,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createTransferInstruction,
} from '@solana/spl-token';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';

// ============================================================================
// Types
// ============================================================================

export interface MPPPayment {
  /** Payment ID */
  paymentId: string;
  /** Task ID */
  taskId: string;
  /** Total amount */
  totalAmount: bigint;
  /** Token mint */
  token: string;
  /** Token symbol */
  tokenSymbol: string;
  /** Decimals */
  decimals: number;
  /** Payer address */
  payer: string;
  /** Escrow account */
  escrow: string;
  /** Participants and their shares */
  participants: MPPParticipant[];
  /** Judges for dispute resolution */
  judges: MPPJudge[];
  /** Release conditions */
  releaseConditions: MPPReleaseCondition;
  /** Payment status */
  status: MPPStatus;
  /** Created timestamp */
  createdAt: number;
  /** Expires at */
  expiresAt: number;
}

export interface MPPParticipant {
  /** Participant address */
  address: string;
  /** Share in basis points (10000 = 100%) */
  shareBps: number;
  /** Participant role */
  role: 'agent' | 'provider' | 'contributor' | 'stakeholder';
  /** Amount allocated */
  allocatedAmount: bigint;
  /** Amount released */
  releasedAmount: bigint;
  /** Whether they have claimed */
  hasClaimed: boolean;
}

export interface MPPJudge {
  /** Judge address */
  address: string;
  /** Judge weight in voting (default: 1) */
  weight: number;
  /** Whether judge has voted */
  hasVoted: boolean;
  /** Judge's vote */
  vote?: 'approve' | 'reject' | 'abstain';
}

export interface MPPReleaseCondition {
  /** Type of release condition */
  type: 'unanimous' | 'majority' | 'threshold' | 'milestone' | 'time';
  /** Required approval threshold (for threshold type) */
  thresholdBps?: number;
  /** Required number of judges (for majority type) */
  requiredJudges?: number;
  /** Milestones for milestone-based release */
  milestones?: MPPMilestone[];
  /** Release time (for time-based) */
  releaseTime?: number;
}

export interface MPPMilestone {
  /** Milestone ID */
  id: string;
  /** Description */
  description: string;
  /** Amount to release */
  amount: bigint;
  /** Whether completed */
  completed: boolean;
  /** Completion proof */
  proof?: string;
  /** Approved by judges */
  approved: boolean;
}

export type MPPStatus =
  | 'pending_funding'      // Waiting for payer to fund escrow
  | 'funded'               // Escrow funded, work can begin
  | 'in_progress'          // Work in progress
  | 'pending_judgment'     // Waiting for judge votes
  | 'approved'             // Approved for release
  | 'rejected'             // Rejected, refund to payer
  | 'partially_released'   // Some funds released
  | 'fully_released'       // All funds released
  | 'disputed'             // Under dispute
  | 'refunded'             // Refunded to payer
  | 'expired';             // Payment expired

export interface MPPVote {
  /** Payment ID */
  paymentId: string;
  /** Judge address */
  judgeAddress: string;
  /** Vote */
  vote: 'approve' | 'reject' | 'abstain';
  /** Reason */
  reason?: string;
  /** Timestamp */
  timestamp: number;
  /** Signature */
  signature: string;
}

export interface MPPClaim {
  /** Payment ID */
  paymentId: string;
  /** Participant address */
  participantAddress: string;
  /** Amount to claim */
  amount: bigint;
  /** Timestamp */
  timestamp: number;
  /** Transaction signature */
  txSignature?: string;
}

export interface MPPConfig {
  /** Solana RPC endpoint */
  rpcEndpoint: string;
  /** Maximum number of participants */
  maxParticipants: number;
  /** Maximum number of judges */
  maxJudges: number;
  /** Default timeout (ms) */
  defaultTimeoutMs: number;
  /** Minimum judge threshold (basis points) */
  minJudgeThresholdBps: number;
}

// ============================================================================
// MPP Handler
// ============================================================================

export class MPPHandler extends EventEmitter {
  private payments: Map<string, MPPPayment> = new Map();
  private votes: Map<string, MPPVote[]> = new Map();
  private connection: Connection;
  private config: MPPConfig;

  constructor(config: Partial<MPPConfig> = {}) {
    super();
    
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
      escrow: '', // Will be set when funded
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

    this.emit('payment_created', { payment });

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

    this.emit('escrow_funded', { paymentId, txSignature, escrowAddress });

    return { txSignature };
  }

  // -------------------------------------------------------------------------
  // Judge Voting
  // -------------------------------------------------------------------------

  /**
   * Cast a vote as a judge
   */
  async castVote(
    paymentId: string,
    judgeAddress: string,
    vote: 'approve' | 'reject' | 'abstain',
    reason?: string
  ): Promise<MPPPayment> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new DaemonError(ErrorCodes.PAYMENT_NOT_FOUND, 'Payment not found', 404);
    }

    // Verify judge
    const judge = payment.judges.find(j => j.address === judgeAddress);
    if (!judge) {
      throw new DaemonError(ErrorCodes.MPP_NOT_A_JUDGE, 'Not an authorized judge', 403);
    }

    if (judge.hasVoted) {
      throw new DaemonError(ErrorCodes.MPP_ALREADY_VOTED, 'Judge already voted', 400);
    }

    // Record vote
    judge.hasVoted = true;
    judge.vote = vote;

    const voteRecord: MPPVote = {
      paymentId,
      judgeAddress,
      vote,
      reason,
      timestamp: Date.now(),
      signature: '', // Would be signed
    };

    const votes = this.votes.get(paymentId) || [];
    votes.push(voteRecord);
    this.votes.set(paymentId, votes);

    logger.info({ paymentId, judge: judgeAddress, vote }, 'Judge voted');

    this.emit('vote_cast', { paymentId, judgeAddress, vote });

    // Check if release conditions are met
    await this.checkReleaseConditions(paymentId);

    return payment;
  }

  /**
   * Check if release conditions are met
   */
  private async checkReleaseConditions(paymentId: string): Promise<void> {
    const payment = this.payments.get(paymentId);
    if (!payment) return;

    const condition = payment.releaseConditions;
    const votes = this.votes.get(paymentId) || [];

    let shouldRelease = false;

    switch (condition.type) {
      case 'unanimous':
        shouldRelease = payment.judges.every(j => j.hasVoted && j.vote === 'approve');
        break;

      case 'majority':
        const approveCount = votes.filter(v => v.vote === 'approve').length;
        const required = condition.requiredJudges || Math.ceil(payment.judges.length / 2);
        shouldRelease = approveCount >= required;
        break;

      case 'threshold':
        const totalWeight = payment.judges.reduce((sum, j) => sum + j.weight, 0);
        const approveWeight = votes
          .filter(v => v.vote === 'approve')
          .reduce((sum, v) => {
            const judge = payment.judges.find(j => j.address === v.judgeAddress);
            return sum + (judge?.weight || 0);
          }, 0);
        const threshold = condition.thresholdBps || this.config.minJudgeThresholdBps;
        shouldRelease = (approveWeight * 10000) / totalWeight >= threshold;
        break;

      case 'milestone':
        shouldRelease = condition.milestones?.every(m => m.approved) || false;
        break;

      case 'time':
        shouldRelease = Date.now() >= (condition.releaseTime || 0);
        break;
    }

    if (shouldRelease && payment.status === 'in_progress') {
      payment.status = 'approved';
      this.emit('payment_approved', { paymentId });
      logger.info({ paymentId }, 'MPP payment approved for release');
    }
  }

  // -------------------------------------------------------------------------
  // Fund Release
  // -------------------------------------------------------------------------

  /**
   * Release funds to participants
   */
  async releaseFunds(
    paymentId: string,
    signer: Signer
  ): Promise<{ txSignatures: string[] }> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new DaemonError(ErrorCodes.PAYMENT_NOT_FOUND, 'Payment not found', 404);
    }

    if (payment.status !== 'approved' && payment.status !== 'partially_released') {
      throw new DaemonError(
        ErrorCodes.PAYMENT_INVALID_STATE,
        `Cannot release in state: ${payment.status}`,
        400
      );
    }

    const txSignatures: string[] = [];

    // Release to each participant who hasn't claimed
    for (const participant of payment.participants) {
      if (participant.hasClaimed || participant.releasedAmount >= participant.allocatedAmount) {
        continue;
      }

      const releaseAmount = participant.allocatedAmount - participant.releasedAmount;

      try {
        const transaction = new Transaction();
        
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(payment.escrow),
            toPubkey: new PublicKey(participant.address),
            lamports: releaseAmount,
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

        participant.releasedAmount = releaseAmount;
        participant.hasClaimed = true;
        txSignatures.push(txSignature);

        logger.info(
          { paymentId, participant: participant.address, amount: releaseAmount.toString() },
          'Funds released to participant'
        );
      } catch (error) {
        logger.error(
          { error, paymentId, participant: participant.address },
          'Failed to release funds'
        );
      }
    }

    // Update payment status
    const allReleased = payment.participants.every(
      p => p.releasedAmount >= p.allocatedAmount
    );
    payment.status = allReleased ? 'fully_released' : 'partially_released';

    this.emit('funds_released', { paymentId, txSignatures });

    return { txSignatures };
  }

  /**
   * Claim funds as a participant
   */
  async claimFunds(
    paymentId: string,
    participantAddress: string,
    signer: Signer
  ): Promise<{ txSignature: string; amount: bigint }> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new DaemonError(ErrorCodes.PAYMENT_NOT_FOUND, 'Payment not found', 404);
    }

    if (payment.status !== 'approved' && payment.status !== 'partially_released') {
      throw new DaemonError(
        ErrorCodes.PAYMENT_INVALID_STATE,
        `Cannot claim in state: ${payment.status}`,
        400
      );
    }

    const participant = payment.participants.find(p => p.address === participantAddress);
    if (!participant) {
      throw new DaemonError(ErrorCodes.MPP_NOT_A_PARTICIPANT, 'Not a participant', 403);
    }

    if (participant.hasClaimed) {
      throw new DaemonError(ErrorCodes.MPP_ALREADY_CLAIMED, 'Already claimed', 400);
    }

    const claimAmount = participant.allocatedAmount - participant.releasedAmount;

    const transaction = new Transaction();
    
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(payment.escrow),
        toPubkey: new PublicKey(participant.address),
        lamports: claimAmount,
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

    participant.releasedAmount = claimAmount;
    participant.hasClaimed = true;

    // Check if all claimed
    const allClaimed = payment.participants.every(p => p.hasClaimed);
    if (allClaimed) {
      payment.status = 'fully_released';
    } else if (payment.status === 'approved') {
      payment.status = 'partially_released';
    }

    logger.info(
      { paymentId, participant: participantAddress, amount: claimAmount.toString() },
      'Participant claimed funds'
    );

    this.emit('funds_claimed', { paymentId, participantAddress, amount: claimAmount });

    return { txSignature, amount: claimAmount };
  }

  // -------------------------------------------------------------------------
  // Milestone Management
  // -------------------------------------------------------------------------

  /**
   * Complete a milestone
   */
  async completeMilestone(
    paymentId: string,
    milestoneId: string,
    proof?: string
  ): Promise<MPPPayment> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new DaemonError(ErrorCodes.PAYMENT_NOT_FOUND, 'Payment not found', 404);
    }

    const milestone = payment.releaseConditions.milestones?.find(m => m.id === milestoneId);
    if (!milestone) {
      throw new DaemonError(ErrorCodes.MPP_MILESTONE_NOT_FOUND, 'Milestone not found', 404);
    }

    milestone.completed = true;
    milestone.proof = proof;

    logger.info({ paymentId, milestoneId }, 'Milestone completed');

    this.emit('milestone_completed', { paymentId, milestoneId, proof });

    return payment;
  }

  /**
   * Approve a milestone (by judge)
   */
  async approveMilestone(
    paymentId: string,
    milestoneId: string,
    judgeAddress: string
  ): Promise<MPPPayment> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new DaemonError(ErrorCodes.PAYMENT_NOT_FOUND, 'Payment not found', 404);
    }

    // Verify judge
    const judge = payment.judges.find(j => j.address === judgeAddress);
    if (!judge) {
      throw new DaemonError(ErrorCodes.MPP_NOT_A_JUDGE, 'Not an authorized judge', 403);
    }

    const milestone = payment.releaseConditions.milestones?.find(m => m.id === milestoneId);
    if (!milestone) {
      throw new DaemonError(ErrorCodes.MPP_MILESTONE_NOT_FOUND, 'Milestone not found', 404);
    }

    milestone.approved = true;

    logger.info({ paymentId, milestoneId, judge: judgeAddress }, 'Milestone approved');

    this.emit('milestone_approved', { paymentId, milestoneId, judgeAddress });

    // Check if all milestones approved
    await this.checkReleaseConditions(paymentId);

    return payment;
  }

  // -------------------------------------------------------------------------
  // Refund
  // -------------------------------------------------------------------------

  /**
   * Refund to payer (if payment rejected or expired)
   */
  async refund(
    paymentId: string,
    signer: Signer
  ): Promise<{ txSignature: string }> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new DaemonError(ErrorCodes.PAYMENT_NOT_FOUND, 'Payment not found', 404);
    }

    if (payment.status !== 'rejected' && payment.status !== 'expired') {
      throw new DaemonError(
        ErrorCodes.PAYMENT_INVALID_STATE,
        `Cannot refund in state: ${payment.status}`,
        400
      );
    }

    // Calculate remaining funds in escrow
    const releasedTotal = payment.participants.reduce(
      (sum, p) => sum + p.releasedAmount,
      0n
    );
    const refundAmount = payment.totalAmount - releasedTotal;

    const transaction = new Transaction();
    
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(payment.escrow),
        toPubkey: new PublicKey(payment.payer),
        lamports: refundAmount,
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

    payment.status = 'refunded';

    logger.info({ paymentId, amount: refundAmount.toString() }, 'Payment refunded');

    this.emit('payment_refunded', { paymentId, txSignature, amount: refundAmount });

    return { txSignature };
  }

  // -------------------------------------------------------------------------
  // Query Methods
  // -------------------------------------------------------------------------

  getPayment(paymentId: string): MPPPayment | undefined {
    return this.payments.get(paymentId);
  }

  getVotes(paymentId: string): MPPVote[] {
    return this.votes.get(paymentId) || [];
  }

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
  // Cleanup
  // -------------------------------------------------------------------------

  /**
   * Clean up expired payments
   */
  cleanupExpiredPayments(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [paymentId, payment] of this.payments) {
      if (now > payment.expiresAt && payment.status === 'pending_funding') {
        payment.status = 'expired';
        cleaned++;
        this.emit('payment_expired', { paymentId });
      }
    }

    return cleaned;
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  private generatePaymentId(): string {
    return `mpp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Close handler and cleanup
   */
  async close(): Promise<void> {
    this.payments.clear();
    this.votes.clear();
    this.removeAllListeners();
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createMPPHandler(config?: Partial<MPPConfig>): MPPHandler {
  return new MPPHandler(config);
}
