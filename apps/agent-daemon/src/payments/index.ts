/**
 * Payments Module
 *
 * Unified payments integration for Agent Daemon.
 * Supports MPP (Multi-Party Payment) and X402 protocols with on-chain settlement.
 *
 * @module payments
 */

import type { KeyManager } from '../keys/key-manager.js';
import type { TransactionManager } from '../solana/transaction-manager.js';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';

// Re-export types
export * from './mpp/types.js';
export * from './x402-handler.js';

// Import handlers
import { MPPPaymentManager, MPPVoting, MPPRefund } from './mpp/index.js';
import type { MPPPayment, MPPConfig, MPPParticipant, MPPJudge, MPPReleaseCondition } from './mpp/types.js';
import { X402Handler, type X402Config, type X402PaymentRequirements, type X402Authorization } from './x402-handler.js';

// ============================================================================
// Payment Manager Configuration
// ============================================================================

export interface PaymentsConfig {
  /** Solana RPC endpoint */
  rpcEndpoint: string;
  /** Whether to enable MPP */
  mppEnabled: boolean;
  /** Whether to enable X402 */
  x402Enabled: boolean;
  /** MPP configuration */
  mppConfig?: Partial<MPPConfig>;
  /** X402 configuration */
  x402Config?: Partial<X402Config>;
  /** Default payment timeout (ms) */
  defaultTimeoutMs: number;
  /** Whether to auto-confirm transactions */
  autoConfirm: boolean;
}

// ============================================================================
// Unified Payment Manager
// ============================================================================

export class PaymentManager {
  private config: PaymentsConfig;
  private connection: Connection;
  private keyManager: KeyManager;
  private transactionManager: TransactionManager;

  // Sub-managers
  private mppPaymentManager?: MPPPaymentManager;
  private mppVoting?: MPPVoting;
  private mppRefund?: MPPRefund;
  private x402Handler?: X402Handler;

  // Track initialization state
  private initialized = false;

  constructor(
    config: Partial<PaymentsConfig>,
    keyManager: KeyManager,
    transactionManager: TransactionManager
  ) {
    this.config = {
      rpcEndpoint: config.rpcEndpoint || 'https://api.devnet.solana.com',
      mppEnabled: config.mppEnabled ?? true,
      x402Enabled: config.x402Enabled ?? true,
      defaultTimeoutMs: config.defaultTimeoutMs || 5 * 60 * 1000, // 5 minutes
      autoConfirm: config.autoConfirm ?? true,
      mppConfig: config.mppConfig,
      x402Config: config.x402Config,
    };

    this.connection = new Connection(this.config.rpcEndpoint, 'confirmed');
    this.keyManager = keyManager;
    this.transactionManager = transactionManager;
  }

  /**
   * Initialize payment handlers
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize MPP components
    if (this.config.mppEnabled) {
      this.mppPaymentManager = new MPPPaymentManager({
        rpcEndpoint: this.config.rpcEndpoint,
        ...this.config.mppConfig,
      });

      this.mppVoting = new MPPVoting();

      this.mppRefund = new MPPRefund(this.config.rpcEndpoint);

      logger.info('MPP payment handlers initialized');
    }

    // Initialize X402 handler
    if (this.config.x402Enabled) {
      this.x402Handler = new X402Handler({
        rpcEndpoint: this.config.rpcEndpoint,
        ...this.config.x402Config,
      });

      logger.info('X402 payment handler initialized');
    }

    this.initialized = true;
    logger.info('PaymentManager initialized');
  }

  // ============================================================================
  // MPP Operations
  // ============================================================================

  /**
   * Create a new multi-party payment
   */
  async createMPPPayment(params: {
    taskId: string;
    totalAmount: bigint;
    token: string;
    tokenSymbol: string;
    decimals: number;
    payer?: string;
    participants: Omit<MPPParticipant, 'allocatedAmount' | 'releasedAmount' | 'hasClaimed'>[];
    judges: Omit<MPPJudge, 'hasVoted' | 'vote'>[];
    releaseConditions: MPPReleaseCondition;
    expiresAt?: number;
  }): Promise<MPPPayment> {
    this.ensureMPPInitialized();

    const payer = params.payer || this.keyManager.getPublicKey();

    // Generate escrow address (PDA)
    const escrowSeed = `mpp_escrow_${Date.now()}`;
    const escrowPubkey = await this.deriveEscrowAddress(escrowSeed);

    const payment = await this.mppPaymentManager!.createPayment({
      ...params,
      payer,
      escrow: escrowPubkey.toBase58(),
    });

    logger.info(
      { paymentId: payment.paymentId, taskId: params.taskId, amount: params.totalAmount.toString() },
      'MPP payment created'
    );

    return payment;
  }

  /**
   * Fund an MPP escrow account on-chain
   */
  async fundMPPEscrow(paymentId: string): Promise<{ txSignature: string }> {
    this.ensureMPPInitialized();

    const payment = this.mppPaymentManager!.getPayment(paymentId);
    if (!payment) {
      throw new DaemonError(ErrorCodes.PAYMENT_NOT_FOUND, `Payment ${paymentId} not found`, 404);
    }

    if (payment.status !== 'pending_funding') {
      throw new DaemonError(
        ErrorCodes.PAYMENT_INVALID_STATE,
        `Cannot fund payment in state: ${payment.status}`,
        400
      );
    }

    // Check if payer is the daemon's wallet
    const daemonPubkey = this.keyManager.getPublicKey();
    if (payment.payer !== daemonPubkey) {
      throw new DaemonError(
        ErrorCodes.PAYMENT_UNAUTHORIZED,
        'Only the payer can fund this escrow',
        403
      );
    }

    try {
      // Create and send funding transaction
      const transaction = new Transaction();

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(daemonPubkey),
          toPubkey: new PublicKey(payment.escrow),
          lamports: payment.totalAmount,
        })
      );

      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(daemonPubkey);

      // Sign with key manager
      const message = transaction.serializeMessage();
      const signature = this.keyManager.sign(message);
      transaction.addSignature(new PublicKey(daemonPubkey), Buffer.from(signature));

      // Send transaction
      const txSignature = await this.connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      // Wait for confirmation
      await this.connection.confirmTransaction(txSignature, 'confirmed');

      logger.info(
        { paymentId, txSignature, escrow: payment.escrow, amount: payment.totalAmount.toString() },
        'MPP escrow funded on-chain'
      );

      return { txSignature };
    } catch (error) {
      logger.error({ error, paymentId }, 'Failed to fund MPP escrow');
      throw new DaemonError(
        ErrorCodes.SOLANA_ERROR,
        `Failed to fund escrow: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  }

  /**
   * Cast a vote for an MPP payment
   */
  async castMPPVote(
    paymentId: string,
    judgeAddress: string,
    vote: 'approve' | 'reject' | 'abstain',
    reason?: string
  ): Promise<void> {
    this.ensureMPPInitialized();

    const payment = this.mppPaymentManager!.getPayment(paymentId);
    if (!payment) {
      throw new DaemonError(ErrorCodes.PAYMENT_NOT_FOUND, `Payment ${paymentId} not found`, 404);
    }

    // Check if judge is authorized
    const judge = payment.judges.find(j => j.address === judgeAddress);
    if (!judge) {
      throw new DaemonError(
        ErrorCodes.MPP_NOT_A_JUDGE,
        `Address ${judgeAddress} is not a judge for this payment`,
        403
      );
    }

    // TODO: Add on-chain vote recording when MPP program is deployed
    // For now, just record locally
    await this.mppVoting!.castVote(payment, judgeAddress, vote);

    logger.info({ paymentId, judgeAddress, vote }, 'MPP vote cast');
  }

  /**
   * Release funds from MPP escrow
   * @deprecated On-chain settlement is now handled by BridgeManager via Agent Arena judge_and_pay
   */
  async releaseMPPFunds(_paymentId: string): Promise<{ txSignature: string }> {
    throw new DaemonError(
      ErrorCodes.NOT_IMPLEMENTED,
      'MPP local escrow release is deprecated. Use BridgeManager.settleEvaluation for on-chain settlement via Agent Arena.',
      400
    );
  }

  /**
   * Get MPP payment details
   */
  getMPPPayment(paymentId: string): MPPPayment | undefined {
    this.ensureMPPInitialized();
    return this.mppPaymentManager!.getPayment(paymentId);
  }

  /**
   * List all MPP payments
   */
  listMPPPayments(filter?: { status?: string; payer?: string }): MPPPayment[] {
    this.ensureMPPInitialized();
    // Cast status to any for compatibility with MPPStatus type
    const mppFilter = filter ? { 
      status: filter.status as any, 
      payer: filter.payer 
    } : undefined;
    return this.mppPaymentManager!.listPayments(mppFilter);
  }

  // ============================================================================
  // X402 Operations
  // ============================================================================

  /**
   * Create X402 payment requirements
   */
  createX402Requirements(params: {
    amount: string;
    token: string;
    recipient?: string;
    description: string;
    deadline?: number;
  }): X402PaymentRequirements {
    this.ensureX402Initialized();

    const recipient = params.recipient || this.keyManager.getPublicKey();

    return this.x402Handler!.createPaymentRequirements({
      ...params,
      recipient,
    });
  }

  /**
   * Create X402 payment authorization (client-side)
   */
  async createX402Authorization(
    requirements: X402PaymentRequirements
  ): Promise<X402Authorization> {
    this.ensureX402Initialized();

    // Create a signer wrapper that uses KeyManager
    const keyManagerSigner = this.createKeyManagerSigner();

    return this.x402Handler!.createAuthorization(requirements, keyManagerSigner);
  }

  /**
   * Process X402 payment authorization (server-side)
   */
  async processX402Authorization(
    authorization: X402Authorization
  ): Promise<{ txSignature: string; status: string }> {
    this.ensureX402Initialized();

    const result = await this.x402Handler!.processAuthorization(authorization);

    return {
      txSignature: result.txSignature,
      status: result.status,
    };
  }

  /**
   * Verify X402 payment
   */
  async verifyX402Payment(paymentId: string): Promise<{
    verified: boolean;
    error?: string;
  }> {
    this.ensureX402Initialized();

    return this.x402Handler!.verifyPayment(paymentId);
  }

  /**
   * Get X402 session
   */
  getX402Session(sessionId: string): unknown {
    this.ensureX402Initialized();
    return this.x402Handler!.getSession(sessionId);
  }

  // ============================================================================
  // Direct Transfer (Simple Payment)
  // ============================================================================

  /**
   * Execute a simple direct transfer
   */
  async executeTransfer(params: {
    to: string;
    amount: bigint;
    token?: string; // If not provided, transfers SOL
  }): Promise<{ txSignature: string }> {
    try {
      const fromPubkey = new PublicKey(this.keyManager.getPublicKey());
      const toPubkey = new PublicKey(params.to);

      const transaction = new Transaction();

      if (params.token && params.token !== SystemProgram.programId.toBase58()) {
        // SPL token transfer - would need token program integration
        throw new DaemonError(
          ErrorCodes.NOT_IMPLEMENTED,
          'SPL token transfers not yet implemented',
          400
        );
      } else {
        // SOL transfer
        transaction.add(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: params.amount,
          })
        );
      }

      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      // Sign with key manager
      const message = transaction.serializeMessage();
      const signature = this.keyManager.sign(message);
      transaction.addSignature(fromPubkey, Buffer.from(signature));

      const txSignature = await this.connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      await this.connection.confirmTransaction(txSignature, 'confirmed');

      logger.info(
        { txSignature, to: params.to, amount: params.amount.toString() },
        'Direct transfer executed'
      );

      return { txSignature };
    } catch (error) {
      logger.error({ error, params }, 'Failed to execute transfer');
      throw new DaemonError(
        ErrorCodes.SOLANA_ERROR,
        `Transfer failed: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Close payment manager and cleanup resources
   */
  async close(): Promise<void> {
    if (this.mppPaymentManager) {
      await this.mppPaymentManager.close();
    }
    if (this.x402Handler) {
      await this.x402Handler.close();
    }

    this.initialized = false;
    logger.info('PaymentManager closed');
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private ensureMPPInitialized(): void {
    if (!this.initialized) {
      throw new DaemonError(
        ErrorCodes.INVALID_REQUEST,
        'PaymentManager not initialized',
        500
      );
    }
    if (!this.config.mppEnabled || !this.mppPaymentManager) {
      throw new DaemonError(
        ErrorCodes.INVALID_REQUEST,
        'MPP payments not enabled',
        400
      );
    }
  }

  private ensureX402Initialized(): void {
    if (!this.initialized) {
      throw new DaemonError(
        ErrorCodes.INVALID_REQUEST,
        'PaymentManager not initialized',
        500
      );
    }
    if (!this.config.x402Enabled || !this.x402Handler) {
      throw new DaemonError(
        ErrorCodes.INVALID_REQUEST,
        'X402 payments not enabled',
        400
      );
    }
  }

  private async deriveEscrowAddress(seed: string): Promise<PublicKey> {
    // For now, use a PDA derived from the seed
    // In production, this would use the MPP program
    const seedBuffer = Buffer.from(seed);
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('mpp_escrow'), seedBuffer],
      SystemProgram.programId
    );
    return pda;
  }

  private createKeyManagerSigner() {
    const keyManager = this.keyManager;
    const connection = this.connection;

    return {
      publicKey: new PublicKey(keyManager.getPublicKey()),
      secretKey: new Uint8Array(0), // We don't expose secret key

      // Implement Signer interface methods
      sign(transaction: Transaction): Promise<Transaction> {
        const message = transaction.serializeMessage();
        const signature = keyManager.sign(message);
        transaction.addSignature(this.publicKey, Buffer.from(signature));
        return Promise.resolve(transaction);
      },
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createPaymentManager(
  config: Partial<PaymentsConfig>,
  keyManager: KeyManager,
  transactionManager: TransactionManager
): PaymentManager {
  return new PaymentManager(config, keyManager, transactionManager);
}
