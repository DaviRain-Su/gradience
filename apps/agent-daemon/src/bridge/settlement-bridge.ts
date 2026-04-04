/**
 * Evaluator → Chain Hub Settlement Bridge
 *
 * Bridges off-chain evaluation results to on-chain Chain Hub settlement.
 * Uses Triton Cascade for high-performance transaction delivery.
 *
 * @module bridge/settlement-bridge
 */

import { EventEmitter } from 'node:events';
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import type { EvaluationResult } from '../evaluator/runtime.js';
import type { PaymentConfirmation } from '../../shared/a2a-payment-types.js';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';
import { TritonCascadeClient } from '@gradiences/workflow-engine/triton-cascade';

// ============================================================================
// Types
// ============================================================================

export interface SettlementRequest {
  evaluationId: string;
  taskId: string;
  paymentId: string;
  agentId: string;
  payerAgentId: string;
  evaluationResult: EvaluationResult;
  amount: string;
  token: string;
  taskAccount: string;
  escrowAccount: string;
}

export interface EvaluationProof {
  evaluationId: string;
  taskId: string;
  evaluatorId: string;
  agentId: string;
  score: number;
  passed: boolean;
  verificationHash: string;
  timestamp: number;
  signature: string;
}

export interface SettlementResult {
  settlementId: string;
  txSignature: string;
  blockTime: number;
  slot: number;
  amount: string;
  distribution: {
    agent: string;
    judge: string;
    protocol: string;
  };
  status: 'confirmed' | 'failed' | 'pending';
  deliveryPath?: string;
  error?: string;
}

export interface BridgeConfig {
  chainHubProgramId: string;
  rpcEndpoint: string;
  cascadeClient?: TritonCascadeClient;
  evaluatorKeypair: Uint8Array;
  evaluatorPubkey: string;
  retry: {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };
  confirmation: {
    commitment: 'processed' | 'confirmed' | 'finalized';
    maxRetries: number;
    timeoutMs: number;
  };
}

export interface SettlementStatus {
  settlementId: string;
  status: 'pending' | 'submitting' | 'confirmed' | 'failed';
  attempts: number;
  lastAttemptAt?: number;
  error?: string;
  txSignature?: string;
}

// ============================================================================
// Settlement Bridge
// ============================================================================

export class SettlementBridge extends EventEmitter {
  private pendingSettlements: Map<string, SettlementStatus> = new Map();
  private config: BridgeConfig;
  private connection: Connection;
  private cascadeClient: TritonCascadeClient;

  constructor(config: BridgeConfig) {
    super();
    this.config = config;
    this.connection = new Connection(config.rpcEndpoint, 'confirmed');
    
    this.cascadeClient = config.cascadeClient || new TritonCascadeClient({
      rpcEndpoint: config.rpcEndpoint,
      apiToken: process.env.TRITON_API_TOKEN,
      network: this.detectNetwork(config.rpcEndpoint),
      enableJitoBundle: true,
      priorityFeeStrategy: 'auto',
    });
  }

  async settle(request: SettlementRequest): Promise<SettlementResult> {
    const settlementId = `${request.evaluationId}-${Date.now()}`;

    logger.info(
      { settlementId, taskId: request.taskId, agentId: request.agentId, score: request.evaluationResult.score },
      'Initiating settlement'
    );

    const status: SettlementStatus = {
      settlementId,
      status: 'pending',
      attempts: 0,
    };
    this.pendingSettlements.set(settlementId, status);

    try {
      const proof = await this.generateProof(request);
      logger.info({ settlementId, proofHash: proof.verificationHash }, 'Proof generated');

      const result = await this.submitWithRetry(settlementId, request, proof);

      status.status = result.status === 'confirmed' ? 'confirmed' : 'failed';
      status.txSignature = result.txSignature;

      this.emit(result.status === 'confirmed' ? 'settled' : 'failed', { settlementId, result });

      logger.info(
        { settlementId, txSignature: result.txSignature, status: result.status, deliveryPath: result.deliveryPath },
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
      setTimeout(() => this.pendingSettlements.delete(settlementId), 60000);
    }
  }

  getStatus(settlementId: string): SettlementStatus | undefined {
    return this.pendingSettlements.get(settlementId);
  }

  listPending(): SettlementStatus[] {
    return Array.from(this.pendingSettlements.values()).filter(
      (s) => s.status === 'pending' || s.status === 'submitting'
    );
  }

  private async generateProof(request: SettlementRequest): Promise<EvaluationProof> {
    const timestamp = Date.now();
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

    const verificationHash = this.hashProofData(proofData);
    const signature = await this.signProof(verificationHash);

    return { ...proofData, verificationHash, signature };
  }

  private hashProofData(data: Omit<EvaluationProof, 'signature'>): string {
    const crypto = require('crypto');
    const json = JSON.stringify(data);
    return crypto.createHash('sha256').update(json).digest('hex');
  }

  private async signProof(hash: string): Promise<string> {
    return `sig_${hash.slice(0, 32)}`;
  }

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
        if (result.status === 'confirmed') return result;
        lastError = new Error(result.error || 'Submission failed');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn({ error, settlementId, attempt }, 'Settlement attempt failed');
      }

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
    logger.info(
      { taskId: request.taskId, agentId: request.agentId, score: proof.score, programId: this.config.chainHubProgramId },
      'Submitting to Chain Hub via Triton Cascade'
    );

    try {
      const instruction = await this.buildChainHubInstruction(request, proof);
      const transaction = new Transaction().add(instruction);
      
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(this.config.evaluatorPubkey);

      const serializedTx = transaction.serialize({ requireAllSignatures: false });
      const base64Tx = Buffer.from(serializedTx).toString('base64');

      const cascadeResponse = await this.cascadeClient.sendTransaction(base64Tx, {
        transactionType: 'other',
        useJitoBundle: true,
        commitment: 'confirmed',
        metadata: {
          settlementId: request.evaluationId,
          taskId: request.taskId,
          agentId: request.agentId,
          score: proof.score,
        },
      });

      if (cascadeResponse.status === 'failed') {
        throw new Error(cascadeResponse.error?.message || 'Transaction failed');
      }

      const totalAmount = BigInt(request.amount);
      const agentAmount = (totalAmount * 95n) / 100n;
      const judgeAmount = (totalAmount * 3n) / 100n;
      const protocolAmount = (totalAmount * 2n) / 100n;

      return {
        settlementId: `${request.evaluationId}-${Date.now()}`,
        txSignature: cascadeResponse.signature,
        blockTime: cascadeResponse.confirmedAt || Date.now(),
        slot: cascadeResponse.confirmation?.slot || 0,
        amount: request.amount,
        distribution: {
          agent: agentAmount.toString(),
          judge: judgeAmount.toString(),
          protocol: protocolAmount.toString(),
        },
        status: 'confirmed',
        deliveryPath: cascadeResponse.deliveryPath,
      };
    } catch (error) {
      logger.error({ error, taskId: request.taskId }, 'Failed to submit to Chain Hub');
      return {
        settlementId: `${request.evaluationId}-${Date.now()}`,
        txSignature: '',
        blockTime: 0,
        slot: 0,
        amount: request.amount,
        distribution: { agent: '0', judge: '0', protocol: '0' },
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async buildChainHubInstruction(
    request: SettlementRequest,
    proof: EvaluationProof
  ): Promise<TransactionInstruction> {
    const instructionData = Buffer.alloc(100);
    const discriminator = Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]);
    discriminator.copy(instructionData, 0);
    
    const proofData = Buffer.from(JSON.stringify({
      evaluationId: proof.evaluationId,
      score: proof.score,
      passed: proof.passed,
      verificationHash: proof.verificationHash,
      signature: proof.signature,
    }));
    proofData.copy(instructionData, 8);

    return new TransactionInstruction({
      keys: [
        { pubkey: new PublicKey(request.taskAccount), isSigner: false, isWritable: true },
        { pubkey: new PublicKey(request.escrowAccount), isSigner: false, isWritable: true },
        { pubkey: new PublicKey(this.config.evaluatorPubkey), isSigner: true, isWritable: false },
        { pubkey: new PublicKey(request.agentId), isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: new PublicKey(this.config.chainHubProgramId),
      data: instructionData,
    });
  }

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
      payer: '',
      payee: '',
      instructionIndex: 0,
      evaluatorScore: request.evaluationResult.score,
      settledAt: Date.now(),
    };
  }

  async verifyOnChain(txSignature: string): Promise<{
    valid: boolean;
    blockTime?: number;
    slot?: number;
    error?: string;
  }> {
    logger.info({ txSignature }, 'Verifying transaction on-chain');

    try {
      const status = await this.connection.getSignatureStatus(txSignature);
      
      if (!status || !status.value) {
        return { valid: false, error: 'Transaction not found' };
      }

      if (status.value.err) {
        return { valid: false, error: `Transaction failed: ${JSON.stringify(status.value.err)}` };
      }

      const tx = await this.connection.getTransaction(txSignature, { commitment: 'confirmed' });
      if (!tx) {
        return { valid: false, error: 'Transaction details not found' };
      }

      return { valid: true, blockTime: tx.blockTime || undefined, slot: tx.slot };
    } catch (error) {
      logger.error({ error, txSignature }, 'Failed to verify transaction');
      return { valid: false, error: error instanceof Error ? error.message : 'Verification failed' };
    }
  }

  async getTransactionDetails(txSignature: string): Promise<{
    status: 'confirmed' | 'failed' | 'not_found';
    blockTime?: number;
    slot?: number;
    logs?: string[];
  }> {
    try {
      const tx = await this.connection.getTransaction(txSignature, { commitment: 'confirmed' });
      if (!tx) return { status: 'not_found' };

      if (tx.meta?.err) {
        return { status: 'failed', blockTime: tx.blockTime || undefined, slot: tx.slot, logs: tx.meta.logMessages };
      }

      return { status: 'confirmed', blockTime: tx.blockTime || undefined, slot: tx.slot, logs: tx.meta?.logMessages };
    } catch (error) {
      logger.error({ error, txSignature }, 'Failed to get transaction details');
      return { status: 'not_found' };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private detectNetwork(rpcEndpoint: string): 'mainnet' | 'devnet' {
    if (rpcEndpoint.includes('mainnet') || rpcEndpoint.includes('api.triton.one')) return 'mainnet';
    return 'devnet';
  }

  async close(): Promise<void> {
    await this.cascadeClient.close();
    this.removeAllListeners();
    this.pendingSettlements.clear();
  }
}

// ============================================================================
// Bridge Factory
// ============================================================================

export interface BridgeOptions {
  chainHubProgramId?: string;
  rpcEndpoint?: string;
  tritonApiToken?: string;
  evaluatorPrivateKey?: string;
  maxRetries?: number;
}

export async function createSettlementBridge(options: BridgeOptions = {}): Promise<SettlementBridge> {
  const programId = options.chainHubProgramId || '6G39W7JGQz7A6L5dAvotFuRP9UbFdCJg2BqDuj6WJWec';
  const rpcEndpoint = options.rpcEndpoint || 'https://api.devnet.solana.com';

  const cascadeClient = new TritonCascadeClient({
    rpcEndpoint: options.tritonApiToken ? 'https://api.triton.one/rpc' : rpcEndpoint,
    apiToken: options.tritonApiToken,
    network: options.rpcEndpoint?.includes('mainnet') ? 'mainnet' : 'devnet',
    enableJitoBundle: true,
    priorityFeeStrategy: 'auto',
  });

  const evaluatorKeypair = new Uint8Array(64);
  const evaluatorPubkey = 'evaluator_pubkey_placeholder';

  const config: BridgeConfig = {
    chainHubProgramId: programId,
    rpcEndpoint,
    cascadeClient,
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
