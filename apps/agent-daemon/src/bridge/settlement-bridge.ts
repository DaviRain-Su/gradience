/**
 * Evaluator → Chain Hub Settlement Bridge
 *
 * Bridges off-chain evaluation results to on-chain Chain Hub settlement.
 *
 * Flow:
 * 1. Evaluator completes evaluation (score 0-100)
 * 2. Bridge generates evaluation proof
 * 3. Bridge calls Chain Hub to settle payment
 * 4. Chain Hub verifies proof and distributes funds
 * 5. Bridge confirms settlement and notifies parties
 *
 * @module bridge/settlement-bridge
 */

import { EventEmitter } from 'node:events';
import type { EvaluationResult } from '../evaluator/runtime.js';
import type { PaymentConfirmation } from '../../shared/a2a-payment-types.js';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';

// ============================================================================
// Types
// ============================================================================

export interface SettlementRequest {
  /** Evaluation ID */
  evaluationId: string;
  /** Task ID */
  taskId: string;
  /** Payment ID */
  paymentId: string;
  /** Agent ID (payee) */
  agentId: string;
  /** Payer Agent ID */
  payerAgentId: string;
  /** Evaluation result */
  evaluationResult: EvaluationResult;
  /** Payment amount (lamports/smallest unit) */
  amount: string;
  /** Token mint address */
  token: string;
  /** Chain Hub task account address */
  taskAccount: string;
  /** Escrow account address */
  escrowAccount: string;
}

export interface EvaluationProof {
  /** Evaluation ID */
  evaluationId: string;
  /** Task ID */
  taskId: string;
  /** Evaluator ID (authorized evaluator) */
  evaluatorId: string;
  /** Agent being evaluated */
  agentId: string;
  /** Score (0-100) */
  score: number;
  /** Whether score meets threshold */
  passed: boolean;
  /** Verification hash of evaluation data */
  verificationHash: string;
  /** Timestamp */
  timestamp: number;
  /** Evaluator signature */
  signature: string;
}

export interface SettlementResult {
  /** Settlement ID */
  settlementId: string;
  /** Transaction signature */
  txSignature: string;
  /** Block time */
  blockTime: number;
  /** Slot */
  slot: number;
  /** Amount distributed */
  amount: string;
  /** Distribution breakdown */
  distribution: {
    agent: string;
    judge: string;
    protocol: string;
  };
  /** Status */
  status: 'confirmed' | 'failed' | 'pending';
  /** Error message (if failed) */
  error?: string;
}

export interface BridgeConfig {
  /** Chain Hub program ID */
  chainHubProgramId: string;
  /** Solana RPC endpoint */
  rpcEndpoint: string;
  /** Authorized evaluator keypair (for signing proofs) */
  evaluatorKeypair: Uint8Array;
  /** Evaluator public key */
  evaluatorPubkey: string;
  /** Retry configuration */
  retry: {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };
  /** Confirmation configuration */
  confirmation: {
    commitment: 'processed' | 'confirmed' | 'finalized';
    maxRetries: number;
    timeoutMs: number;
  };
}

export interface SettlementStatus {
  /** Settlement ID */
  settlementId: string;
  /** Current status */
  status: 'pending' | 'submitting' | 'confirmed' | 'failed';
  /** Attempt count */
  attempts: number;
  /** Last attempt timestamp */
  lastAttemptAt?: number;
  /** Error message (if failed) */
  error?: string;
  /** Transaction signature (if submitted) */
  txSignature?: string;
}

// ============================================================================
// Settlement Bridge
// ============================================================================

export class SettlementBridge extends EventEmitter {
  private pendingSettlements: Map<string, SettlementStatus> = new Map();
  private config: BridgeConfig;

  constructor(config: BridgeConfig) {
    super();
    this.config = config;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Submit evaluation result for on-chain settlement
   */
  async settle(request: SettlementRequest): Promise<SettlementResult> {
    const settlementId = `${request.evaluationId}-${Date.now()}`;

    logger.info(
      {
        settlementId,
        taskId: request.taskId,
        agentId: request.agentId,
        score: request.evaluationResult.score,
      },
      'Initiating settlement'
    );

    // Create settlement status
    const status: SettlementStatus = {
      settlementId,
      status: 'pending',
      attempts: 0,
    };
    this.pendingSettlements.set(settlementId, status);

    try {
      // Step 1: Generate evaluation proof
      const proof = await this.generateProof(request);
      logger.info({ settlementId, proofHash: proof.verificationHash }, 'Proof generated');

      // Step 2: Submit to Chain Hub with retry
      const result = await this.submitWithRetry(settlementId, request, proof);

      // Step 3: Update status
      status.status = result.status === 'confirmed' ? 'confirmed' : 'failed';
      status.txSignature = result.txSignature;

      // Emit event
      this.emit(result.status === 'confirmed' ? 'settled' : 'failed', {
        settlementId,
        result,
      });

      logger.info(
        {
          settlementId,
          txSignature: result.txSignature,
          status: result.status,
        },
        'Settlement completed'
      );

      return result;
    } catch (error) {
      status.status = 'failed';
      status.error = error instanceof Error ? error.message : 'Unknown error';

      this.emit('failed', { settlementId, error });

      logger.error({ error, settlementId }, 'Settlement failed');
      throw error;
    } finally {
      // Cleanup after some time
      setTimeout(() => {
        this.pendingSettlements.delete(settlementId);
      }, 60000);
    }
  }

  /**
   * Get settlement status
   */
  getStatus(settlementId: string): SettlementStatus | undefined {
    return this.pendingSettlements.get(settlementId);
  }

  /**
   * List pending settlements
   */
  listPending(): SettlementStatus[] {
    return Array.from(this.pendingSettlements.values()).filter(
      (s) => s.status === 'pending' || s.status === 'submitting'
    );
  }

  /**
   * Retry a failed settlement
   */
  async retry(settlementId: string): Promise<SettlementResult> {
    const status = this.pendingSettlements.get(settlementId);
    if (!status) {
      throw new DaemonError(ErrorCodes.SETTLEMENT_NOT_FOUND, 'Settlement not found', 404);
    }

    if (status.status !== 'failed') {
      throw new DaemonError(
        ErrorCodes.SETTLEMENT_INVALID_STATE,
        `Cannot retry settlement in state: ${status.status}`,
        400
      );
    }

    // Reset status
    status.status = 'pending';
    status.attempts = 0;
    status.error = undefined;

    // TODO: Reconstruct request from stored data and retry
    throw new DaemonError(ErrorCodes.NOT_IMPLEMENTED, 'Retry not yet implemented', 501);
  }

  // -------------------------------------------------------------------------
  // Proof Generation
  // -------------------------------------------------------------------------

  private async generateProof(request: SettlementRequest): Promise<EvaluationProof> {
    const timestamp = Date.now();

    // Create proof data
    const proofData = {
      evaluationId: request.evaluationId,
      taskId: request.taskId,
      evaluatorId: this.config.evaluatorPubkey,
      agentId: request.agentId,
      score: request.evaluationResult.score,
      passed: request.evaluationResult.passed,
      verificationHash: request.evaluationResult.verificationHash,
      timestamp,
    };

    // Generate verification hash
    const verificationHash = this.hashProofData(proofData);

    // Sign proof
    const signature = await this.signProof(verificationHash);

    return {
      ...proofData,
      verificationHash,
      signature,
    };
  }

  private hashProofData(data: Omit<EvaluationProof, 'signature'>): string {
    // Simple hash for demo - in production use proper cryptographic hash
    const json = JSON.stringify(data);
    return Buffer.from(json).toString('base64url');
  }

  private async signProof(hash: string): Promise<string> {
    // TODO: Implement actual signing using evaluator keypair
    // For now, return mock signature
    return `sig_${hash.slice(0, 32)}`;
  }

  // -------------------------------------------------------------------------
  // Chain Hub Submission
  // -------------------------------------------------------------------------

  private async submitWithRetry(
    settlementId: string,
    request: SettlementRequest,
    proof: EvaluationProof
  ): Promise<SettlementResult> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.retry.maxAttempts; attempt++) {
      const status = this.pendingSettlements.get(settlementId);
      if (status) {
        status.status = 'submitting';
        status.attempts = attempt;
        status.lastAttemptAt = Date.now();
      }

      try {
        const result = await this.submitToChainHub(request, proof);

        if (result.status === 'confirmed') {
          return result;
        }

        // If failed but retryable, continue
        lastError = new Error(result.error || 'Submission failed');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn({ error, settlementId, attempt }, 'Settlement attempt failed');
      }

      // Calculate delay with exponential backoff
      if (attempt < this.config.retry.maxAttempts) {
        const delay = Math.min(
          this.config.retry.baseDelayMs * Math.pow(2, attempt - 1),
          this.config.retry.maxDelayMs
        );

        logger.info({ settlementId, attempt, delayMs: delay }, 'Retrying settlement');
        await this.sleep(delay);
      }
    }

    throw new DaemonError(
      ErrorCodes.SETTLEMENT_FAILED,
      `Settlement failed after ${this.config.retry.maxAttempts} attempts: ${lastError?.message}`,
      500
    );
  }

  private async submitToChainHub(
    request: SettlementRequest,
    proof: EvaluationProof
  ): Promise<SettlementResult> {
    // TODO: Implement actual Solana transaction submission
    // This would:
    // 1. Build Chain Hub instruction (complete_delegation_task or submit_external_evaluation)
    // 2. Sign transaction with evaluator keypair
    // 3. Send to Solana RPC
    // 4. Wait for confirmation
    // 5. Parse result

    logger.info(
      {
        taskId: request.taskId,
        agentId: request.agentId,
        score: proof.score,
        programId: this.config.chainHubProgramId,
      },
      'Submitting to Chain Hub'
    );

    // Mock implementation
    const mockTxSignature = `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Simulate transaction processing
    await this.sleep(1000);

    // Calculate distribution
    const totalAmount = BigInt(request.amount);
    const agentAmount = (totalAmount * 95n) / 100n; // 95% to agent
    const judgeAmount = (totalAmount * 3n) / 100n;  // 3% to judge
    const protocolAmount = (totalAmount * 2n) / 100n; // 2% to protocol

    return {
      settlementId: `${request.evaluationId}-${Date.now()}`,
      txSignature: mockTxSignature,
      blockTime: Date.now(),
      slot: 123456789,
      amount: request.amount,
      distribution: {
        agent: agentAmount.toString(),
        judge: judgeAmount.toString(),
        protocol: protocolAmount.toString(),
      },
      status: 'confirmed',
    };
  }

  // -------------------------------------------------------------------------
  // Payment Confirmation
  // -------------------------------------------------------------------------

  /**
   * Create payment confirmation from settlement result
   */
  createPaymentConfirmation(
    settlementResult: SettlementResult,
    request: SettlementRequest
  ): PaymentConfirmation {
    return {
      paymentId: request.paymentId,
      taskId: request.taskId,
      txHash: settlementResult.txSignature,
      blockTime: settlementResult.blockTime,
      slot: settlementResult.slot,
      amount: settlementResult.amount,
      token: request.token,
      payer: '', // Would be filled from wallet
      payee: '', // Would be filled from wallet
      instructionIndex: 0,
      evaluatorScore: request.evaluationResult.score,
      settledAt: Date.now(),
    };
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Verify a transaction on-chain
   */
  async verifyOnChain(txSignature: string): Promise<{
    valid: boolean;
    blockTime?: number;
    slot?: number;
    error?: string;
  }> {
    // TODO: Implement Solana RPC query to verify transaction
    logger.info({ txSignature }, 'Verifying transaction on-chain');

    return { valid: true };
  }

  /**
   * Get transaction details
   */
  async getTransactionDetails(txSignature: string): Promise<{
    status: 'confirmed' | 'failed' | 'not_found';
    blockTime?: number;
    slot?: number;
    logs?: string[];
  }> {
    // TODO: Implement Solana RPC query
    return { status: 'confirmed' };
  }
}

// ============================================================================
// Bridge Factory
// ============================================================================

export interface BridgeOptions {
  /** Chain Hub program ID */
  chainHubProgramId?: string;
  /** Solana RPC endpoint */
  rpcEndpoint?: string;
  /** Evaluator private key (base58) */
  evaluatorPrivateKey?: string;
  /** Retry attempts */
  maxRetries?: number;
}

export async function createSettlementBridge(
  options: BridgeOptions = {}
): Promise<SettlementBridge> {
  const programId = options.chainHubProgramId || '6G39W7JGQz7A6L5dAvotFuRP9UbFdCJg2BqDuj6WJWec';
  const rpcEndpoint = options.rpcEndpoint || 'https://api.devnet.solana.com';

  // TODO: Load or generate evaluator keypair
  // For now, use mock keypair
  const evaluatorKeypair = new Uint8Array(64);
  const evaluatorPubkey = 'evaluator_pubkey_placeholder';

  const config: BridgeConfig = {
    chainHubProgramId: programId,
    rpcEndpoint,
    evaluatorKeypair,
    evaluatorPubkey,
    retry: {
      maxAttempts: options.maxRetries || 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
    },
    confirmation: {
      commitment: 'confirmed',
      maxRetries: 3,
      timeoutMs: 60000,
    },
  };

  return new SettlementBridge(config);
}
