/**
 * Multi-Party Payment (MPP) Handler
 *
 * @deprecated Use the modular exports from ./mpp/ instead
 * This file is kept for backward compatibility.
 *
 * @module payments/mpp-handler
 */

import { EventEmitter } from 'node:events';
import { Connection, type Signer } from '@solana/web3.js';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';

// Import modular components
import {
  type MPPPayment,
  type MPPParticipant,
  type MPPJudge,
  type MPPReleaseCondition,
  type MPPMilestone,
  type MPPStatus,
  type MPPVote,
  type MPPClaim,
  type MPPConfig,
} from './mpp/types.js';
import { MPPPaymentManager } from './mpp/payment-manager.js';
import { MPPVoting } from './mpp/voting.js';
import { MPPRefund } from './mpp/refund.js';

// Re-export types for backward compatibility
export type {
  MPPPayment,
  MPPParticipant,
  MPPJudge,
  MPPReleaseCondition,
  MPPMilestone,
  MPPStatus,
  MPPVote,
  MPPClaim,
  MPPConfig,
};

// ============================================================================
// MPPHandler - Backward Compatible Wrapper
// ============================================================================

/**
 * Multi-Party Payment Handler
 *
 * @deprecated Use MPPPaymentManager, MPPVoting, MPPRefund from ./mpp/ instead
 */
export class MPPHandler extends EventEmitter {
  private paymentManager: MPPPaymentManager;
  private voting: MPPVoting;
  private refund: MPPRefund;
  private payments: Map<string, MPPPayment>;
  private config: Required<MPPConfig>;

  constructor(config: Partial<MPPConfig> = {}) {
    super();

    this.config = {
      rpcEndpoint: config.rpcEndpoint ?? 'https://api.devnet.solana.com',
      programId: config.programId ?? 'MPP1111111111111111111111111111111111111111',
      defaultTimeout: config.defaultTimeout ?? 30000,
      maxJudges: config.maxJudges ?? 5,
      maxParticipants: config.maxParticipants ?? 10,
    };

    this.payments = new Map();
    this.paymentManager = new MPPPaymentManager(this.config);
    this.voting = new MPPVoting();
    this.refund = new MPPRefund(this.config.rpcEndpoint);

    // Forward events from sub-modules
    this.paymentManager.on('paymentCreated', (p) => {
      this.payments.set(p.paymentId, p);
      this.emit('paymentCreated', p);
    });

    this.voting.on('voteCast', (data) => this.emit('voteCast', data));
    this.voting.on('paymentApproved', (data) => this.emit('paymentApproved', data));
    this.refund.on('fundsReleased', (data) => this.emit('fundsReleased', data));
    this.refund.on('fundsClaimed', (data) => this.emit('fundsClaimed', data));
    this.refund.on('refunded', (data) => this.emit('refunded', data));
  }

  // ============================================================================
  // Payment Management
  // ============================================================================

  async createPayment(params: {
    taskId: string;
    totalAmount: bigint;
    token: string;
    tokenSymbol: string;
    decimals: number;
    payer: string;
    escrow: string;
    participants: Omit<MPPParticipant, 'allocatedAmount' | 'releasedAmount' | 'hasClaimed'>[];
    judges: Omit<MPPJudge, 'hasVoted' | 'vote'>[];
    releaseConditions: MPPReleaseCondition;
    expiresAt: number;
  }): Promise<MPPPayment> {
    const payment = await this.paymentManager.createPayment(params);
    this.payments.set(payment.paymentId, payment);
    return payment;
  }

  async fundEscrow(paymentId: string, amount: bigint, signer: Signer): Promise<void> {
    const payment = this.getPaymentOrThrow(paymentId);
    await this.paymentManager.fundEscrow(payment, amount, signer);
  }

  // ============================================================================
  // Voting
  // ============================================================================

  async castVote(
    paymentId: string,
    judgeAddress: string,
    vote: 'approve' | 'reject' | 'abstain'
  ): Promise<void> {
    const payment = this.getPaymentOrThrow(paymentId);
    await this.voting.castVote(payment, judgeAddress, vote);

    // Check if payment should be approved
    if (this.voting.checkReleaseConditions(payment)) {
      this.emit('paymentApproved', { paymentId, payment });
    }
  }

  // ============================================================================
  // Milestones
  // ============================================================================

  async completeMilestone(
    paymentId: string,
    milestoneIndex: number,
    proof?: string
  ): Promise<void> {
    const payment = this.getPaymentOrThrow(paymentId);
    await this.voting.completeMilestone(payment, milestoneIndex, proof);
  }

  async approveMilestone(
    paymentId: string,
    judgeAddress: string,
    milestoneIndex: number
  ): Promise<void> {
    const payment = this.getPaymentOrThrow(paymentId);
    await this.voting.approveMilestone(payment, judgeAddress, milestoneIndex);
  }

  // ============================================================================
  // Fund Release & Claims
  // ============================================================================

  async releaseFunds(paymentId: string, signer: Signer): Promise<void> {
    const payment = this.getPaymentOrThrow(paymentId);
    await this.refund.releaseFunds(payment, signer);
  }

  async claimFunds(paymentId: string, participantAddress: string, signer: Signer): Promise<void> {
    const payment = this.getPaymentOrThrow(paymentId);
    await this.refund.claimFunds(payment, participantAddress, signer);
  }

  // ============================================================================
  // Refund
  // ============================================================================

  async refund(paymentId: string, signer: Signer): Promise<void> {
    const payment = this.getPaymentOrThrow(paymentId);
    await this.refund.refund(payment, signer);
  }

  // ============================================================================
  // Queries
  // ============================================================================

  getPayment(paymentId: string): MPPPayment | undefined {
    return this.payments.get(paymentId) ?? this.paymentManager.getPayment(paymentId);
  }

  getVotes(paymentId: string): MPPVote[] {
    const payment = this.getPayment(paymentId);
    if (!payment) return [];
    return this.voting.getVotes?.(payment) ?? [];
  }

  listPayments(filters?: { status?: MPPStatus; payer?: string }): MPPPayment[] {
    return this.paymentManager.listPayments(filters);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  cleanupExpiredPayments(): number {
    return this.paymentManager.cleanupExpiredPayments(this.payments);
  }

  close(): void {
    this.paymentManager.close();
    this.voting.removeAllListeners();
    this.refund.removeAllListeners();
    this.removeAllListeners();
    this.payments.clear();
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private getPaymentOrThrow(paymentId: string): MPPPayment {
    const payment = this.getPayment(paymentId);
    if (!payment) {
      throw new DaemonError(ErrorCodes.PAYMENT_NOT_FOUND, `Payment ${paymentId} not found`);
    }
    return payment;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create MPP handler instance
 * @deprecated Use individual modules from ./mpp/ instead
 */
export function createMPPHandler(config?: Partial<MPPConfig>): MPPHandler {
  return new MPPHandler(config);
}
