/**
 * Bridge Module - On-chain Settlement Integration
 *
 * Unified bridge integration for Agent Daemon.
 * Bridges off-chain evaluation results to on-chain Chain Hub settlement.
 * Uses Triton Cascade for high-performance transaction delivery.
 *
 * @module bridge
 */

import type { KeyManager } from '../keys/key-manager.js';
import type { TransactionManager } from '../solana/transaction-manager.js';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';

// Import bridge components
import {
  SettlementBridge,
  createSettlementBridge,
  type SettlementRequest,
  type SettlementResult,
  type EvaluationProof,
  type BridgeConfig,
  type SettlementStatus,
  type BridgeOptions,
} from './settlement-bridge.js';
import {
  ExternalEvaluationManager,
  type ExternalEvaluationParams,
  type ExternalEvaluationResult,
} from './external-evaluation-stub.js';
import { KeyManager as BridgeKeyManager, getKeyManager, initializeKeyManager } from './key-manager.js';
import type { EvaluationResult } from '../evaluator/runtime.js';
import type { PaymentConfirmation } from '../../shared/a2a-payment-types.js';

// Re-export types
export {
  type SettlementRequest,
  type SettlementResult,
  type EvaluationProof,
  type BridgeConfig,
  type SettlementStatus,
  type BridgeOptions,
  type ExternalEvaluationParams,
  type ExternalEvaluationResult,
  BridgeKeyManager,
  getKeyManager,
  initializeKeyManager,
};

// ============================================================================
// Bridge Manager Configuration
// ============================================================================

export interface BridgeManagerConfig {
  /** Solana RPC endpoint */
  rpcEndpoint: string;
  /** Chain Hub program ID */
  chainHubProgramId: string;
  /** Triton API token for Cascade (optional) */
  tritonApiToken?: string;
  /** Key directory for evaluator keys */
  keyDir: string;
  /** Key password for encrypted keys */
  keyPassword?: string;
  /** Enable bridge settlement */
  enabled: boolean;
  /** Auto-settle on evaluation complete */
  autoSettle: boolean;
  /** Settlement retry configuration */
  retry: {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };
  /** Transaction confirmation configuration */
  confirmation: {
    commitment: 'processed' | 'confirmed' | 'finalized';
    maxRetries: number;
    timeoutMs: number;
  };
  /** Revenue distribution percentages (in basis points) */
  distribution: {
    agentBps: number;
    judgeBps: number;
    protocolBps: number;
  };
}

// ============================================================================
// Unified Bridge Manager
// ============================================================================

export class BridgeManager {
  private config: BridgeManagerConfig;
  private connection: Connection;
  private keyManager: KeyManager;
  private transactionManager: TransactionManager;

  // Sub-managers
  private settlementBridge?: SettlementBridge;
  private externalEvaluator?: ExternalEvaluationManager;

  // Track initialization state
  private initialized = false;

  constructor(
    config: Partial<BridgeManagerConfig>,
    keyManager: KeyManager,
    transactionManager: TransactionManager
  ) {
    this.config = {
      rpcEndpoint: config.rpcEndpoint || 'https://api.devnet.solana.com',
      chainHubProgramId: config.chainHubProgramId || '6G39W7JGQz7A6L5dAvotFuRP9UbFdCJg2BqDuj6WJWec',
      tritonApiToken: config.tritonApiToken,
      keyDir: config.keyDir || './keys',
      keyPassword: config.keyPassword,
      enabled: config.enabled ?? true,
      autoSettle: config.autoSettle ?? false,
      retry: {
        maxAttempts: config.retry?.maxAttempts ?? 3,
        baseDelayMs: config.retry?.baseDelayMs ?? 1000,
        maxDelayMs: config.retry?.maxDelayMs ?? 30000,
      },
      confirmation: {
        commitment: config.confirmation?.commitment ?? 'confirmed',
        maxRetries: config.confirmation?.maxRetries ?? 3,
        timeoutMs: config.confirmation?.timeoutMs ?? 60000,
      },
      distribution: {
        agentBps: config.distribution?.agentBps ?? 9500,
        judgeBps: config.distribution?.judgeBps ?? 300,
        protocolBps: config.distribution?.protocolBps ?? 200,
      },
    };

    this.connection = new Connection(this.config.rpcEndpoint, 'confirmed');
    this.keyManager = keyManager;
    this.transactionManager = transactionManager;
  }

  /**
   * Initialize bridge components
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!this.config.enabled) {
      logger.info('Bridge settlement disabled');
      return;
    }

    // Initialize settlement bridge
    this.settlementBridge = await createSettlementBridge({
      chainHubProgramId: this.config.chainHubProgramId,
      rpcEndpoint: this.config.rpcEndpoint,
      tritonApiToken: this.config.tritonApiToken,
      keyDir: this.config.keyDir,
      keyPassword: this.config.keyPassword,
      maxRetries: this.config.retry.maxAttempts,
    });

    // Initialize external evaluation manager
    this.externalEvaluator = new ExternalEvaluationManager(this.config.chainHubProgramId);
    
    // Register this daemon's evaluator
    const evaluatorPubkey = this.settlementBridge.getEvaluatorPublicKey();
    this.externalEvaluator.addAuthorizedEvaluator(evaluatorPubkey);

    this.initialized = true;
    logger.info(
      { evaluatorPubkey, autoSettle: this.config.autoSettle },
      'BridgeManager initialized'
    );
  }

  // ============================================================================
  // Settlement Operations
  // ============================================================================

  /**
   * Submit a settlement for evaluation result
   */
  async settle(request: SettlementRequest): Promise<SettlementResult> {
    this.ensureInitialized();

    logger.info(
      { 
        evaluationId: request.evaluationId,
        taskId: request.taskId,
        agentId: request.agentId,
        score: request.evaluationResult.score 
      },
      'Initiating settlement via BridgeManager'
    );

    const result = await this.settlementBridge!.settle(request);

    logger.info(
      { 
        settlementId: result.settlementId,
        txSignature: result.txSignature,
        status: result.status 
      },
      'Settlement completed via BridgeManager'
    );

    return result;
  }

  /**
   * Settle evaluation result with automatic distribution
   */
  async settleEvaluation(
    evaluationResult: EvaluationResult,
    params: {
      taskId: string;
      paymentId: string;
      agentId: string;
      payerAgentId: string;
      amount: string;
      token: string;
      taskAccount: string;
      escrowAccount: string;
    }
  ): Promise<SettlementResult> {
    this.ensureInitialized();

    const request: SettlementRequest = {
      evaluationId: evaluationResult.evaluationId,
      taskId: params.taskId,
      paymentId: params.paymentId,
      agentId: params.agentId,
      payerAgentId: params.payerAgentId,
      evaluationResult,
      amount: params.amount,
      token: params.token,
      taskAccount: params.taskAccount,
      escrowAccount: params.escrowAccount,
    };

    return this.settle(request);
  }

  /**
   * Get settlement status
   */
  getSettlementStatus(settlementId: string): SettlementStatus | undefined {
    this.ensureInitialized();
    return this.settlementBridge!.getStatus(settlementId);
  }

  /**
   * List pending settlements
   */
  listPendingSettlements(): SettlementStatus[] {
    this.ensureInitialized();
    return this.settlementBridge!.listPending();
  }

  /**
   * Create payment confirmation from settlement result
   */
  createPaymentConfirmation(
    settlementResult: SettlementResult,
    request: SettlementRequest
  ): PaymentConfirmation {
    this.ensureInitialized();
    return this.settlementBridge!.createPaymentConfirmation(settlementResult, request);
  }

  // ============================================================================
  // External Evaluation Operations
  // ============================================================================

  /**
   * Submit external evaluation to Chain Hub
   */
  async submitExternalEvaluation(
    params: ExternalEvaluationParams
  ): Promise<ExternalEvaluationResult> {
    this.ensureInitialized();

    logger.info(
      { taskId: params.taskId, evaluator: params.evaluatorAuthority },
      'Submitting external evaluation'
    );

    const result = await this.externalEvaluator!.submitEvaluation(params);

    if (result.success) {
      logger.info(
        { taskId: params.taskId, txSignature: result.txSignature },
        'External evaluation submitted successfully'
      );
    } else {
      logger.error(
        { taskId: params.taskId, error: result.error },
        'External evaluation submission failed'
      );
    }

    return result;
  }

  /**
   * Check if evaluator is authorized
   */
  isAuthorizedEvaluator(evaluatorAddress: string): boolean {
    this.ensureInitialized();
    return this.externalEvaluator!.isAuthorizedEvaluator(evaluatorAddress);
  }

  /**
   * Add authorized evaluator
   */
  addAuthorizedEvaluator(evaluatorAddress: string): void {
    this.ensureInitialized();
    this.externalEvaluator!.addAuthorizedEvaluator(evaluatorAddress);
    logger.info({ evaluator: evaluatorAddress }, 'Added authorized evaluator');
  }

  /**
   * List authorized evaluators
   */
  listAuthorizedEvaluators(): string[] {
    this.ensureInitialized();
    return this.externalEvaluator!.listAuthorizedEvaluators();
  }

  // ============================================================================
  // On-chain Verification
  // ============================================================================

  /**
   * Verify settlement transaction on-chain
   */
  async verifyOnChain(txSignature: string): Promise<{
    valid: boolean;
    blockTime?: number;
    slot?: number;
    error?: string;
  }> {
    this.ensureInitialized();
    return this.settlementBridge!.verifyOnChain(txSignature);
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
    this.ensureInitialized();
    return this.settlementBridge!.getTransactionDetails(txSignature);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Calculate distribution amounts based on configured percentages
   */
  calculateDistribution(totalAmount: bigint): {
    agent: bigint;
    judge: bigint;
    protocol: bigint;
  } {
    const agentAmount = (totalAmount * BigInt(this.config.distribution.agentBps)) / BigInt(10000);
    const judgeAmount = (totalAmount * BigInt(this.config.distribution.judgeBps)) / BigInt(10000);
    const protocolAmount = (totalAmount * BigInt(this.config.distribution.protocolBps)) / BigInt(10000);

    return { agent: agentAmount, judge: judgeAmount, protocol: protocolAmount };
  }

  /**
   * Get evaluator public key
   */
  getEvaluatorPublicKey(): string {
    this.ensureInitialized();
    return this.settlementBridge!.getEvaluatorPublicKey();
  }

  /**
   * Check if bridge is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Check if auto-settle is enabled
   */
  isAutoSettleEnabled(): boolean {
    return this.config.enabled && this.config.autoSettle;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Close bridge manager and cleanup resources
   */
  async close(): Promise<void> {
    if (this.settlementBridge) {
      await this.settlementBridge.close();
    }

    this.initialized = false;
    logger.info('BridgeManager closed');
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private ensureInitialized(): void {
    if (!this.config.enabled) {
      throw new DaemonError(
        ErrorCodes.INVALID_REQUEST,
        'Bridge settlement not enabled',
        400
      );
    }
    if (!this.initialized) {
      throw new DaemonError(
        ErrorCodes.INVALID_REQUEST,
        'BridgeManager not initialized',
        500
      );
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createBridgeManager(
  config: Partial<BridgeManagerConfig>,
  keyManager: KeyManager,
  transactionManager: TransactionManager
): BridgeManager {
  return new BridgeManager(config, keyManager, transactionManager);
}
