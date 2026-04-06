/**
 * XMTP + OWS Payment Integration Service
 *
 * End-to-end payment flow:
 * 1. Agent A (payer) creates PaymentRequest → sends via XMTP to Agent B
 * 2. Agent B accepts, completes service
 * 3. Evaluator verifies quality (off-chain)
 * 4. Chain Hub settles payment (on-chain)
 * 5. Agent A sends PaymentConfirmation via XMTP
 * 6. Agent B verifies, sends Receipt
 * 7. Both parties have cryptographic proof
 *
 * @module services/payment-service
 */

import type { A2ARouter } from '../a2a-router/router.js';
import type { OWSWalletManager } from '../wallet/ows-wallet-manager.js';
import type { BridgeManager } from '../bridge/index.js';
import type {
  PaymentRequest,
  PaymentConfirmation,
  PaymentReceipt,
  PaymentDispute,
} from '../../shared/a2a-payment-types.js';
import {
  validatePaymentRequest,
  validatePaymentConfirmation,
  validatePaymentReceipt,
  generatePaymentId,
} from '../../shared/a2a-payment-types.js';
import type { EvaluatorRuntime, EvaluationTask, EvaluationResult } from '../evaluator/index.js';
import type { CheckType } from '../evaluator/runtime.js';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';

// ============================================================================
// Types
// ============================================================================

export interface PaymentSession {
  /** Unique payment ID */
  paymentId: string;
  /** Associated task ID */
  taskId: string;
  /** Payer Agent ID */
  payerAgentId: string;
  /** Payee Agent ID */
  payeeAgentId: string;
  /** Payment request details */
  request: PaymentRequest;
  /** Current status */
  status: PaymentStatus;
  /** Confirmation (when settled) */
  confirmation?: PaymentConfirmation;
  /** Receipt (when acknowledged) */
  receipt?: PaymentReceipt;
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
  /** Timeout timestamp */
  timeoutAt: number;
}

export type PaymentStatus =
  | 'pending_request'      // Request sent, waiting for acceptance
  | 'accepted'             // Payee accepted
  | 'service_in_progress'  // Service being performed
  | 'pending_evaluation'   // Waiting for evaluator
  | 'pending_settlement'   // Waiting for Chain Hub settlement
  | 'settled'              // On-chain settlement complete
  | 'confirmed'            // Both parties confirmed
  | 'disputed'             // Dispute raised
  | 'refunded'             // Payment refunded
  | 'expired'              // Payment expired
  | 'failed';              // Payment failed

export interface PaymentServiceOptions {
  /** Default payment timeout (ms) */
  defaultTimeoutMs: number;
  /** Evaluator threshold for auto-approval (0-100) */
  autoApproveThreshold: number;
  /** Chain Hub program ID */
  chainHubProgramId: string;
  /** RPC endpoint */
  rpcEndpoint: string;
}

export const DEFAULT_PAYMENT_OPTIONS: PaymentServiceOptions = {
  defaultTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
  autoApproveThreshold: 80,
  chainHubProgramId: '6G39W7JGQz7A6L5dAvotFuRP9UbFdCJg2BqDuj6WJWec',
  rpcEndpoint: 'https://api.devnet.solana.com',
};

// ============================================================================
// Payment Service
// ============================================================================

export class PaymentService {
  private sessions: Map<string, PaymentSession> = new Map();
  private options: PaymentServiceOptions;

  constructor(
    private readonly a2aRouter: A2ARouter,
    private readonly walletManager: OWSWalletManager,
    private readonly evaluator: EvaluatorRuntime,
    private readonly bridgeManager: BridgeManager,
    options: Partial<PaymentServiceOptions> = {}
  ) {
    this.options = { ...DEFAULT_PAYMENT_OPTIONS, ...options };
    this.initializeMessageHandlers();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Initiate a payment request
   */
  async requestPayment(params: {
    payerAgentId: string;
    payeeAgentId: string;
    taskId: string;
    amount: string;
    token: string;
    tokenSymbol: string;
    decimals: number;
    description: string;
    evaluation?: PaymentRequest['evaluation'];
  }): Promise<PaymentSession> {
    // Get payer wallet
    const payerWallet = this.walletManager.getWallet(params.payerAgentId);
    if (!payerWallet) {
      throw new DaemonError(
        ErrorCodes.WALLET_NOT_FOUND,
        `Payer wallet not found for agent ${params.payerAgentId}`,
        404
      );
    }

    // Check payer has sufficient funds/policy
    const check = this.walletManager.checkTransactionLimits(
      payerWallet,
      parseInt(params.amount) / 10 ** params.decimals * 100, // Convert to USD cents
      'solana',
      params.tokenSymbol
    );

    if (!check.allowed) {
      throw new DaemonError(
        ErrorCodes.PAYMENT_NOT_ALLOWED,
        check.reason ?? 'Payment not allowed by policy',
        403
      );
    }

    // Create payment request
    const paymentId = generatePaymentId();
    const request: PaymentRequest = {
      paymentId,
      taskId: params.taskId,
      payer: payerWallet.address,
      payee: '', // Will be filled when payee accepts
      amount: params.amount,
      token: params.token,
      tokenSymbol: params.tokenSymbol,
      decimals: params.decimals,
      displayAmount: `${parseInt(params.amount) / 10 ** params.decimals} ${params.tokenSymbol}`,
      deadline: Date.now() + this.options.defaultTimeoutMs,
      description: params.description,
      evaluation: params.evaluation,
    };

    // Create session
    const session: PaymentSession = {
      paymentId,
      taskId: params.taskId,
      payerAgentId: params.payerAgentId,
      payeeAgentId: params.payeeAgentId,
      request,
      status: 'pending_request',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      timeoutAt: Date.now() + this.options.defaultTimeoutMs,
    };

    this.sessions.set(paymentId, session);

    // Send via XMTP
    await this.sendPaymentRequest(session);

    logger.info(
      { paymentId, payer: params.payerAgentId, payee: params.payeeAgentId, amount: params.amount },
      'Payment request created'
    );

    return session;
  }

  /**
   * Accept a payment request (called by payee)
   */
  async acceptPayment(paymentId: string, payeeAgentId: string): Promise<PaymentSession> {
    const session = this.sessions.get(paymentId);
    if (!session) {
      throw new DaemonError(ErrorCodes.PAYMENT_NOT_FOUND, 'Payment session not found', 404);
    }

    if (session.status !== 'pending_request') {
      throw new DaemonError(
        ErrorCodes.PAYMENT_INVALID_STATE,
        `Cannot accept payment in state: ${session.status}`,
        400
      );
    }

    if (session.payeeAgentId !== payeeAgentId) {
      throw new DaemonError(
        ErrorCodes.PAYMENT_UNAUTHORIZED,
        'Agent is not the designated payee',
        403
      );
    }

    // Get payee wallet
    const payeeWallet = this.walletManager.getWallet(payeeAgentId);
    if (!payeeWallet) {
      throw new DaemonError(
        ErrorCodes.WALLET_NOT_FOUND,
        `Payee wallet not found for agent ${payeeAgentId}`,
        404
      );
    }

    // Update request with payee address
    session.request.payee = payeeWallet.address;
    session.status = 'accepted';
    session.updatedAt = Date.now();

    // Send acceptance notification
    await this.sendPaymentAccepted(session);

    logger.info({ paymentId, payee: payeeAgentId }, 'Payment request accepted');

    return session;
  }

  /**
   * Mark service as complete (called by payee)
   */
  async markServiceComplete(paymentId: string, payeeAgentId: string): Promise<PaymentSession> {
    const session = this.sessions.get(paymentId);
    if (!session) {
      throw new DaemonError(ErrorCodes.PAYMENT_NOT_FOUND, 'Payment session not found', 404);
    }

    if (session.payeeAgentId !== payeeAgentId) {
      throw new DaemonError(ErrorCodes.PAYMENT_UNAUTHORIZED, 'Unauthorized', 403);
    }

    if (session.status !== 'accepted' && session.status !== 'service_in_progress') {
      throw new DaemonError(
        ErrorCodes.PAYMENT_INVALID_STATE,
        `Cannot complete service in state: ${session.status}`,
        400
      );
    }

    session.status = 'pending_evaluation';
    session.updatedAt = Date.now();

    logger.info({ paymentId }, 'Service marked complete, pending evaluation');

    // Trigger evaluation (async)
    this.evaluateAndSettle(session);

    return session;
  }

  /**
   * Get payment session
   */
  getSession(paymentId: string): PaymentSession | undefined {
    return this.sessions.get(paymentId);
  }

  /**
   * List sessions for an agent
   */
  listSessions(agentId: string): PaymentSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.payerAgentId === agentId || s.payeeAgentId === agentId
    );
  }

  /**
   * Raise a dispute
   */
  async raiseDispute(
    paymentId: string,
    agentId: string,
    dispute: Omit<PaymentDispute, 'paymentId' | 'taskId' | 'disputedAt'>
  ): Promise<PaymentSession> {
    const session = this.sessions.get(paymentId);
    if (!session) {
      throw new DaemonError(ErrorCodes.PAYMENT_NOT_FOUND, 'Payment session not found', 404);
    }

    if (session.payerAgentId !== agentId && session.payeeAgentId !== agentId) {
      throw new DaemonError(ErrorCodes.PAYMENT_UNAUTHORIZED, 'Unauthorized', 403);
    }

    session.status = 'disputed';
    session.updatedAt = Date.now();

    // Send dispute notification
    await this.sendDisputeNotification(session, {
      ...dispute,
      paymentId,
      taskId: session.taskId,
      disputedAt: Date.now(),
    });

    logger.info({ paymentId, agentId, reason: dispute.reason }, 'Payment disputed');

    return session;
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  private initializeMessageHandlers(): void {
    // Subscribe to XMTP messages
    this.a2aRouter.subscribe(async (message) => {
      if (message.protocol !== 'xmtp') return;

      try {
        const payload = message.payload as { type: string; data: unknown };

        switch (payload.type) {
          case 'payment_request':
            await this.handleIncomingPaymentRequest(
              message.from,
              payload.data as PaymentRequest
            );
            break;
          case 'payment_confirmation':
            await this.handlePaymentConfirmation(
              message.from,
              payload.data as PaymentConfirmation
            );
            break;
          case 'payment_receipt':
            await this.handlePaymentReceipt(message.from, payload.data as PaymentReceipt);
            break;
        }
      } catch (error) {
        logger.error({ error, messageId: message.id }, 'Failed to handle payment message');
      }
    });
  }

  private async sendPaymentRequest(session: PaymentSession): Promise<void> {
    await this.a2aRouter.send({
      to: session.payeeAgentId,
      type: 'payment_request',
      payload: {
        type: 'payment_request',
        data: session.request,
      },
      preferredProtocol: 'xmtp',
    });
  }

  private async sendPaymentAccepted(session: PaymentSession): Promise<void> {
    await this.a2aRouter.send({
      to: session.payerAgentId,
      type: 'task_accept',
      payload: {
        type: 'payment_accepted',
        paymentId: session.paymentId,
        payeeAddress: session.request.payee,
      },
      preferredProtocol: 'xmtp',
    });
  }

  private async sendPaymentConfirmation(session: PaymentSession): Promise<void> {
    if (!session.confirmation) return;

    await this.a2aRouter.send({
      to: session.payeeAgentId,
      type: 'payment_confirm',
      payload: {
        type: 'payment_confirmation',
        data: session.confirmation,
      },
      preferredProtocol: 'xmtp',
    });
  }

  private async sendDisputeNotification(
    session: PaymentSession,
    dispute: PaymentDispute
  ): Promise<void> {
    const recipient =
      session.payerAgentId === dispute.initiator ? session.payeeAgentId : session.payerAgentId;

    await this.a2aRouter.send({
      to: recipient,
      type: 'direct_message',
      payload: {
        type: 'payment_dispute',
        data: dispute,
      },
      preferredProtocol: 'xmtp',
    });
  }

  private async handleIncomingPaymentRequest(
    from: string,
    request: PaymentRequest
  ): Promise<void> {
    // Validate request
    validatePaymentRequest(request);

    logger.info(
      { paymentId: request.paymentId, from, amount: request.amount },
      'Received payment request'
    );

    // Store session (payee side)
    const session: PaymentSession = {
      paymentId: request.paymentId,
      taskId: request.taskId,
      payerAgentId: from,
      payeeAgentId: 'self', // Would be resolved from wallet
      request,
      status: 'pending_request',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      timeoutAt: request.deadline,
    };

    this.sessions.set(request.paymentId, session);

    // TODO: Notify UI or auto-accept based on policy
  }

  private async handlePaymentConfirmation(
    from: string,
    confirmation: PaymentConfirmation
  ): Promise<void> {
    validatePaymentConfirmation(confirmation);

    const session = this.sessions.get(confirmation.paymentId);
    if (!session) {
      logger.warn({ paymentId: confirmation.paymentId }, 'Confirmation for unknown payment');
      return;
    }

    session.confirmation = confirmation;
    session.status = 'settled';
    session.updatedAt = Date.now();

    // Record transaction
    await this.walletManager.recordTransaction({
      walletId: this.walletManager.getWallet(session.payeeAgentId)?.id ?? '',
      agentId: session.payeeAgentId,
      type: 'incoming',
      amount: confirmation.amount,
      token: confirmation.token,
      txHash: confirmation.txHash,
    });

    // Send receipt
    const receipt: PaymentReceipt = {
      paymentId: confirmation.paymentId,
      taskId: confirmation.taskId,
      txHash: confirmation.txHash,
      status: 'confirmed',
      confirmedAt: Date.now(),
      signature: '', // Would be signed by payee
    };

    await this.a2aRouter.send({
      to: session.payerAgentId,
      type: 'payment_confirm',
      payload: {
        type: 'payment_receipt',
        data: receipt,
      },
      preferredProtocol: 'xmtp',
    });

    session.receipt = receipt;
    session.status = 'confirmed';

    logger.info({ paymentId: confirmation.paymentId }, 'Payment confirmed and receipt sent');
  }

  private async handlePaymentReceipt(from: string, receipt: PaymentReceipt): Promise<void> {
    validatePaymentReceipt(receipt);

    const session = this.sessions.get(receipt.paymentId);
    if (!session) return;

    session.receipt = receipt;
    session.status = 'confirmed';
    session.updatedAt = Date.now();

    logger.info({ paymentId: receipt.paymentId }, 'Payment receipt received');
  }

  private async evaluateAndSettle(session: PaymentSession): Promise<void> {
    try {
      session.status = 'pending_evaluation';
      session.updatedAt = Date.now();

      // Build evaluation task from payment session
      const evaluationTask: EvaluationTask = {
        id: `eval-${session.paymentId}`,
        taskId: session.taskId,
        agentId: session.payeeAgentId,
        type: this.determineEvaluationType(session),
        submission: {
          type: 'url',
          source: session.request.submissionUrl || '',
          metadata: {
            paymentId: session.paymentId,
            description: session.request.description,
            evaluationCriteria: session.request.evaluation,
          },
        },
        criteria: this.buildEvaluationCriteria(session),
        budget: {
          maxCostUsd: 0.5,
          maxTimeSeconds: 300, // 5 minutes
          maxMemoryMb: 512,
          contextWindowSize: 128000,
        },
        createdAt: Date.now(),
        timeoutAt: Date.now() + 5 * 60 * 1000,
      };

      logger.info(
        { paymentId: session.paymentId, taskId: session.taskId },
        'Starting evaluation for payment'
      );

      // Run evaluation - submit and wait for result
      const evaluationId = await this.evaluator.submit({
        taskId: session.taskId,
        agentId: session.payeeAgentId,
        type: evaluationTask.type,
        submission: evaluationTask.submission,
        criteria: evaluationTask.criteria,
        budget: evaluationTask.budget,
      });
      
      // Wait for evaluation result via event
      const result = await new Promise<EvaluationResult>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Evaluation timeout'));
        }, 5 * 60 * 1000); // 5 minutes

        const onCompleted = (completedResult: EvaluationResult) => {
          if (completedResult.evaluationId === evaluationId) {
            clearTimeout(timeout);
            this.evaluator.off('completed', onCompleted);
            this.evaluator.off('error', onError);
            resolve(completedResult);
          }
        };

        const onError = (error: { evaluationId: string; error: Error }) => {
          if (error.evaluationId === evaluationId) {
            clearTimeout(timeout);
            this.evaluator.off('completed', onCompleted);
            this.evaluator.off('error', onError);
            reject(error.error);
          }
        };

        this.evaluator.on('completed', onCompleted);
        this.evaluator.on('error', onError);
      });

      // Calculate overall score from evaluation result
      const overallScore = this.calculateOverallScore(result);

      logger.info(
        {
          paymentId: session.paymentId,
          score: overallScore,
          passed: result.passed,
          cost: result.actualCost.usd,
        },
        'Evaluation completed'
      );

      if (overallScore >= this.options.autoApproveThreshold && result.passed) {
        session.status = 'pending_settlement';

        // Call Chain Hub to settle (or mock for now)
        const confirmation = await this.settlePayment(session, overallScore, result);

        session.confirmation = confirmation;
        session.status = 'settled';
        session.updatedAt = Date.now();

        // Send confirmation to payee
        await this.sendPaymentConfirmation(session);

        logger.info(
          { paymentId: session.paymentId, txHash: confirmation.txHash, score: overallScore },
          'Payment settled with evaluation score'
        );
      } else {
        // Below threshold or failed checks, requires manual review
        session.status = 'pending_settlement'; // Keep in pending for manual review
        logger.info(
          {
            paymentId: session.paymentId,
            score: overallScore,
            passed: result.passed,
            threshold: this.options.autoApproveThreshold,
          },
          'Payment requires manual review - score below threshold or checks failed'
        );

        // TODO: Queue for manual review
        // For now, we'll still settle but with a flag
        const confirmation = await this.settlePayment(session, overallScore, result, true);
        session.confirmation = confirmation;
        session.status = 'settled';
        session.updatedAt = Date.now();
        await this.sendPaymentConfirmation(session);
      }
    } catch (error) {
      logger.error({ error, paymentId: session.paymentId }, 'Evaluation or settlement failed');
      session.status = 'failed';
      session.updatedAt = Date.now();

      // TODO: Queue for manual review on evaluation failure
    }
  }

  /**
   * Determine evaluation type from payment request
   */
  private determineEvaluationType(session: PaymentSession): EvaluationTask['type'] {
    const evaluationType = session.request.evaluation?.type;
    
    switch (evaluationType) {
      case 'code_review':
        return 'code';
      case 'ui_ux':
        return 'ui';
      case 'api_testing':
        return 'api';
      case 'content_quality':
        return 'content';
      default:
        // Default to content evaluation for general tasks
        return 'content';
    }
  }

  /**
   * Build evaluation criteria from payment request
   */
  private buildEvaluationCriteria(session: PaymentSession): EvaluationTask['criteria'] {
    const customCriteria = session.request.evaluation?.criteria;

    return {
      minScore: this.options.autoApproveThreshold,
      rubric: {
        maxScore: 100,
        categories: [
          {
            name: 'quality',
            description: 'Overall quality of work',
            weight: 0.4,
            criteria: ['code_quality', 'best_practices'],
          },
          {
            name: 'completeness',
            description: 'Task completion level',
            weight: 0.3,
            criteria: ['requirements_met', 'edge_cases_handled'],
          },
          {
            name: 'timeliness',
            description: 'Delivered on time',
            weight: 0.2,
            criteria: ['on_schedule', 'responsive'],
          },
          {
            name: 'communication',
            description: 'Clear communication',
            weight: 0.1,
            criteria: ['documentation', 'clarity'],
          },
        ],
      },
      requiredChecks: (customCriteria?.requiredChecks as CheckType[]) || ['no_secrets'],
      optionalChecks: (customCriteria?.optionalChecks as CheckType[]) || [],
    };
  }

  /**
   * Calculate overall score from evaluation result
   */
  private calculateOverallScore(result: EvaluationResult): number {
    // Use the overall score from the evaluator
    return result.score;
  }

  /**
   * Settle payment on-chain using BridgeManager
   */
  private async settlePayment(
    session: PaymentSession,
    score: number,
    evaluationResult: EvaluationResult,
    requiresReview = false
  ): Promise<PaymentConfirmation> {
    // Check if bridge settlement is available
    if (!this.bridgeManager.isEnabled()) {
      logger.warn({ paymentId: session.paymentId }, 'Bridge settlement disabled, using mock confirmation');
      return this.createMockConfirmation(session, score, evaluationResult, requiresReview);
    }

    // Validate required accounts for on-chain settlement
    if (!session.request.taskAccount || !session.request.escrowAccount) {
      logger.warn(
        { paymentId: session.paymentId, taskAccount: session.request.taskAccount, escrowAccount: session.request.escrowAccount },
        'Missing task/escrow accounts for on-chain settlement, using mock confirmation'
      );
      return this.createMockConfirmation(session, score, evaluationResult, requiresReview);
    }

    try {
      logger.info(
        { paymentId: session.paymentId, taskId: session.taskId, score },
        'Initiating on-chain settlement via BridgeManager'
      );

      // Build evaluation result for settlement
      const evalResultForSettlement: EvaluationResult = {
        evaluationId: `eval-${session.paymentId}`,
        score,
        passed: !requiresReview && evaluationResult.passed,
        categoryScores: [],
        checkResults: [],
        verificationHash: this.generateVerificationHash(session, score),
        executionLog: {
          sandboxType: 'git_worktree',
          steps: [],
          stdout: '',
          stderr: '',
        },
        driftStatus: {
          driftDetected: false,
          contextWindowUsage: 0,
        },
        actualCost: {
          usd: evaluationResult.actualCost?.usd ?? 0,
          timeSeconds: 0,
          peakMemoryMb: 0,
        },
        completedAt: Date.now(),
      };

      // Submit settlement via BridgeManager
      const settlementResult = await this.bridgeManager.settleEvaluation(evalResultForSettlement, {
        taskId: session.taskId,
        taskIdOnChain: session.taskId,
        paymentId: session.paymentId,
        agentId: session.payeeAgentId,
        payerAgentId: session.payerAgentId,
        amount: session.request.amount,
        token: session.request.token,
        taskAccount: session.request.taskAccount,
        escrowAccount: session.request.escrowAccount,
        poster: session.request.payer,
        reasonRef: session.request.reasonRef,
        losers: session.request.losers,
      });

      if (settlementResult.status !== 'confirmed') {
        throw new DaemonError(
          ErrorCodes.SETTLEMENT_FAILED,
          `Settlement failed: ${settlementResult.error || 'Unknown error'}`,
          500
        );
      }

      logger.info(
        {
          paymentId: session.paymentId,
          txSignature: settlementResult.txSignature,
          blockTime: settlementResult.blockTime,
          slot: settlementResult.slot,
        },
        'On-chain settlement completed successfully'
      );

      // Create payment confirmation from settlement result
      return {
        paymentId: session.paymentId,
        taskId: session.taskId,
        txHash: settlementResult.txSignature,
        blockTime: settlementResult.blockTime,
        slot: settlementResult.slot,
        amount: session.request.amount,
        token: session.request.token,
        payer: session.request.payer,
        payee: session.request.payee,
        instructionIndex: 0,
        evaluatorScore: score,
        settledAt: Date.now(),
        status: requiresReview ? 'pending_review' : 'confirmed',
      };
    } catch (error) {
      logger.error(
        { error, paymentId: session.paymentId },
        'On-chain settlement failed, falling back to mock confirmation'
      );
      return this.createMockConfirmation(session, score, evaluationResult, requiresReview);
    }
  }

  /**
   * Create mock confirmation for testing or when settlement is unavailable
   */
  private createMockConfirmation(
    session: PaymentSession,
    score: number,
    _evaluationResult: EvaluationResult,
    requiresReview = false
  ): PaymentConfirmation {
    const txHash = requiresReview
      ? `pending-review-${Date.now()}`
      : `evaluated-${Date.now()}-${score}`;

    return {
      paymentId: session.paymentId,
      taskId: session.taskId,
      txHash,
      blockTime: Date.now(),
      slot: 123456789,
      amount: session.request.amount,
      token: session.request.token,
      payer: session.request.payer,
      payee: session.request.payee,
      instructionIndex: 0,
      evaluatorScore: score,
      settledAt: Date.now(),
      status: requiresReview ? 'pending_review' : 'mock_confirmed',
    };
  }

  /**
   * Generate verification hash for settlement proof
   */
  private generateVerificationHash(session: PaymentSession, score: number): string {
    const crypto = require('crypto');
    const data = {
      paymentId: session.paymentId,
      taskId: session.taskId,
      payer: session.request.payer,
      payee: session.request.payee,
      amount: session.request.amount,
      score,
      timestamp: Date.now(),
    };
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [paymentId, session] of this.sessions) {
      if (session.timeoutAt < now && session.status === 'pending_request') {
        session.status = 'expired';
        cleaned++;
        logger.info({ paymentId }, 'Payment session expired');
      }
    }

    return cleaned;
  }

  /**
   * Clean up all resources
   */
  async cleanup(): Promise<void> {
    // Clean up expired sessions one final time
    const cleaned = this.cleanupExpiredSessions();
    if (cleaned > 0) {
      logger.info({ cleaned }, 'Cleaned up expired payment sessions');
    }
    
    // Clear all sessions
    this.sessions.clear();
    
    logger.info('PaymentService cleaned up');
  }
}
