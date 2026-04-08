/**
 * Evaluator → Agent Arena Settlement Bridge
 *
 * Bridges off-chain evaluation results to on-chain Agent Arena settlement
 * via the judge_and_pay instruction.
 *
 * @module bridge/settlement-bridge
 */

import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';

import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { addressToPublicKey } from '../solana/kit-compat.js';
import { MagicBlockPERClient } from '../settlement/magicblock-per-client.js';
import {
  buildCreateTaskPermissionIx,
  deriveTaskPda,
  type MembersArgs,
} from '../settlement/per-program-builder.js';
import {
  address,
  getAddressEncoder,
  AccountRole,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
  type Instruction,
  type Blockhash,
  type Address,
} from '@solana/kit';
import { serialize } from 'borsh';
import type { EvaluationResult } from '../evaluator/runtime.js';
import type { PaymentConfirmation } from '../../shared/a2a-payment-types.js';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';
import { KeyManager, getKeyManager } from './key-manager.js';
import {
  resolveJudgeAndPayPdas,
  findApplicationPda,
} from '../solana/pda-resolver.js';

// TritonCascadeClient stub (actual implementation would come from @gradiences/workflow-engine)
interface TritonCascadeClient {
  sendTransaction(tx: string, options: unknown): Promise<{
    status: 'confirmed' | 'failed' | 'pending';
    signature: string;
    confirmedAt?: number;
    confirmation?: { slot: number };
    deliveryPath?: string;
    error?: { message: string };
  }>;
  close(): Promise<void>;
}

// Simple fallback cascade client using standard RPC
class FallbackCascadeClient implements TritonCascadeClient {
  private connection: Connection;

  constructor(rpcEndpoint: string) {
    this.connection = new Connection(rpcEndpoint, 'confirmed');
  }

  async sendTransaction(
    base64Tx: string,
    options: unknown
  ): Promise<{
    status: 'confirmed' | 'failed' | 'pending';
    signature: string;
    confirmedAt?: number;
    confirmation?: { slot: number };
    deliveryPath?: string;
    error?: { message: string };
  }> {
    try {
      const txBuffer = Buffer.from(base64Tx, 'base64');
      const signature = await this.connection.sendRawTransaction(txBuffer, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      await this.connection.confirmTransaction(signature, 'confirmed');

      return {
        status: 'confirmed',
        signature,
        confirmedAt: Date.now(),
        confirmation: { slot: 0 },
        deliveryPath: 'rpc-fallback',
      };
    } catch (error) {
      return {
        status: 'failed',
        signature: '',
        error: { message: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  async close(): Promise<void> {
    // No-op for fallback
  }
}

// ============================================================================
// Types
// ============================================================================

export interface SettlementRequest {
  evaluationId: string;
  /** Internal/local task identifier (can be any string) */
  taskId: string;
  /** On-chain task id used for PDA derivation (must be a valid u64 string) */
  taskIdOnChain: string;
  paymentId: string;
  agentId: string;
  payerAgentId: string;
  evaluationResult: EvaluationResult;
  amount: string;
  token: string;
  taskAccount?: string;
  escrowAccount?: string;
  /** Task poster address (required for judge_and_pay) */
  poster: string;
  /** Optional reason reference for the judgement */
  reasonRef?: string;
  /** Optional loser stake refund pairs */
  losers?: Array<{ agent: string; account?: string }>;
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
  keyManager: KeyManager;
  perClient?: MagicBlockPERClient;
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
  private keyManager: KeyManager;

  constructor(config: BridgeConfig) {
    super();
    this.config = config;
    this.keyManager = config.keyManager;
    this.connection = new Connection(config.rpcEndpoint, 'confirmed');
    
    // Use provided cascade client or fallback to standard RPC
    this.cascadeClient = config.cascadeClient || new FallbackCascadeClient(config.rpcEndpoint);
  }

  /**
   * Setup MagicBlock PER permissions for a task (create + delegate).
   */
  async setupTaskPermission(
    taskIdOnChain: string,
    members: MembersArgs = { members: null }
  ): Promise<string> {
    if (!this.config.perClient) {
      throw new Error('PER client not configured');
    }

    const arenaProgramId = new PublicKey(this.config.chainHubProgramId);
    const taskId = BigInt(taskIdOnChain);
    const payer = new PublicKey(this.keyManager.getPublicKey());

    const createIx = buildCreateTaskPermissionIx(arenaProgramId, taskId, payer, members);
    const taskPda = deriveTaskPda(arenaProgramId, taskId);
    const delegateIx = this.config.perClient.buildDelegatePermissionIx(taskPda, payer, payer);

    const tx = new Transaction().add(createIx, delegateIx);
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer;

    const message = tx.serializeMessage();
    const signature = this.keyManager.sign(message);
    tx.addSignature(payer, Buffer.from(signature));

    const txid = await this.connection.sendRawTransaction(tx.serialize(), {
      preflightCommitment: 'confirmed',
    });
    await this.connection.confirmTransaction({ signature: txid, blockhash, lastValidBlockHeight });
    return txid;
  }

  /**
   * Teardown MagicBlock PER permissions for a task (update + commit/undelegate).
   */
  async teardownTaskPermission(
    taskIdOnChain: string,
    revealMembers: MembersArgs = { members: null }
  ): Promise<string> {
    if (!this.config.perClient) {
      throw new Error('PER client not configured');
    }

    const arenaProgramId = new PublicKey(this.config.chainHubProgramId);
    const taskId = BigInt(taskIdOnChain);
    const taskPda = deriveTaskPda(arenaProgramId, taskId);
    const payer = new PublicKey(this.keyManager.getPublicKey());

    const updateIx = this.config.perClient.buildUpdatePermissionIx(taskPda, payer, revealMembers);
    const commitIx = this.config.perClient.buildCommitAndUndelegatePermissionIx(taskPda, payer);

    const tx = new Transaction().add(updateIx, commitIx);
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer;

    const message = tx.serializeMessage();
    const signature = this.keyManager.sign(message);
    tx.addSignature(payer, Buffer.from(signature));

    const txid = await this.connection.sendRawTransaction(tx.serialize(), {
      preflightCommitment: 'confirmed',
    });
    await this.connection.confirmTransaction({ signature: txid, blockhash, lastValidBlockHeight });
    return txid;
  }

  /**
   * Settle a VEL/TEE evaluation via MagicBlock PER (TEE RPC).
   */
  async settleWithPER(
    request: SettlementRequest,
    score: number,
    reasonRef: string
  ): Promise<SettlementResult> {
    const settlementId = `${request.evaluationId}-${Date.now()}`;
    if (!this.config.perClient) {
      throw new Error('PER client not configured');
    }

    logger.info(
      { settlementId, taskId: request.taskId, agentId: request.agentId, score, reasonRef },
      'Initiating PER settlement'
    );

    const status: SettlementStatus = {
      settlementId,
      status: 'pending',
      attempts: 0,
    };
    this.pendingSettlements.set(settlementId, status);

    try {
      // Step 1: verify TEE
      const teeVerified = await this.config.perClient.verifyTee();
      if (!teeVerified) {
        throw new Error('TEE RPC integrity verification failed');
      }

      // Step 2: setup permission
      logger.info({ settlementId, taskIdOnChain: request.taskIdOnChain }, 'Setting up PER task permission');
      await this.setupTaskPermission(request.taskIdOnChain, { members: null });

      // Step 3: fetch auth token
      const payer = new PublicKey(this.keyManager.getPublicKey());
      const signMessage = (msg: Uint8Array) => Promise.resolve(this.keyManager.sign(msg));
      const auth = await this.config.perClient.fetchAuthToken(payer, signMessage);
      logger.info({ settlementId, expiresAt: auth.expiresAt }, 'PER auth token acquired');

      // Step 4: build proof
      request.reasonRef = reasonRef;
      const verificationHash = this.hashProofData({ reasonRef, score, settlementId } as unknown as Omit<EvaluationProof, 'signature'>);
      const proof: EvaluationProof = {
        evaluationId: request.evaluationId,
        taskId: request.taskId,
        evaluatorId: this.keyManager.getPublicKey(),
        agentId: request.agentId,
        score,
        passed: score >= 60,
        verificationHash,
        timestamp: Date.now(),
        signature: this.signProof(verificationHash),
      };

      // Step 5: send judge_and_pay via TEE RPC
      logger.info({ settlementId }, 'Submitting judge_and_pay via TEE RPC');
      const judgeTxSig = await this.sendJudgeAndPayViaTee(request, proof, auth.token);

      // Step 6: teardown permission
      logger.info({ settlementId }, 'Tearing down PER task permission');
      await this.teardownTaskPermission(request.taskIdOnChain, { members: null });

      status.status = 'confirmed';
      status.txSignature = judgeTxSig;

      this.emit('settled', { settlementId, txSignature: judgeTxSig });

      const totalAmount = BigInt(request.amount);
      const agentAmount = (totalAmount * BigInt(95)) / BigInt(100);
      const judgeAmount = (totalAmount * BigInt(3)) / BigInt(100);
      const protocolAmount = (totalAmount * BigInt(2)) / BigInt(100);

      return {
        settlementId,
        txSignature: judgeTxSig,
        blockTime: Date.now(),
        slot: 0,
        amount: request.amount,
        distribution: {
          agent: agentAmount.toString(),
          judge: judgeAmount.toString(),
          protocol: protocolAmount.toString(),
        },
        status: 'confirmed',
        deliveryPath: 'tee-per',
      };
    } catch (error) {
      status.status = 'failed';
      status.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('failed', { settlementId, error });
      logger.error({ error, settlementId }, 'PER settlement failed');
      throw error;
    } finally {
      setTimeout(() => this.pendingSettlements.delete(settlementId), 60000);
    }
  }

  /**
   * Send judge_and_pay instruction via MagicBlock TEE RPC.
   */
  private async sendJudgeAndPayViaTee(
    request: SettlementRequest,
    proof: EvaluationProof,
    authToken: string
  ): Promise<string> {
    const instruction = await this.buildAgentArenaJudgeInstruction(request, proof);
    const signer = await this.keyManager.getSigner();

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    const transactionMessage = appendTransactionMessageInstructions(
      [instruction],
      setTransactionMessageLifetimeUsingBlockhash(
        { blockhash: blockhash as Blockhash, lastValidBlockHeight: BigInt(lastValidBlockHeight) },
        setTransactionMessageFeePayerSigner(signer, createTransactionMessage({ version: 0 }))
      )
    );

    const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
    const base64Tx = getBase64EncodedWireTransaction(signedTransaction);
    const serialized = Buffer.from(base64Tx, 'base64');

    return this.config.perClient!.sendToTee(serialized, authToken);
  }

  /**
   * Get the evaluator's public key
   */
  getEvaluatorPublicKey(): string {
    return this.keyManager.getPublicKey();
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

  /**
   * Settle with a custom reasonRef and score (used by VEL / TEE path).
   * Bypasses the default generateProof flow.
   */
  async settleWithReasonRef(
    request: SettlementRequest,
    score: number,
    reasonRef: string
  ): Promise<SettlementResult> {
    const settlementId = `${request.evaluationId}-${Date.now()}`;

    logger.info(
      { settlementId, taskId: request.taskId, agentId: request.agentId, score, reasonRef },
      'Initiating VEL settlement'
    );

    const status: SettlementStatus = {
      settlementId,
      status: 'pending',
      attempts: 0,
    };
    this.pendingSettlements.set(settlementId, status);

    try {
      request.reasonRef = reasonRef;
      const verificationHash = this.hashProofData({ reasonRef, score, settlementId } as unknown as Omit<EvaluationProof, 'signature'>);
      const proof: EvaluationProof = {
        evaluationId: request.evaluationId,
        taskId: request.taskId,
        evaluatorId: this.keyManager.getPublicKey(),
        agentId: request.agentId,
        score,
        passed: score >= 60,
        verificationHash,
        timestamp: Date.now(),
        signature: this.signProof(verificationHash),
      };
      logger.info({ settlementId, proofHash: proof.verificationHash }, 'VEL proof generated');

      const result = await this.submitWithRetry(settlementId, request, proof);

      status.status = result.status === 'confirmed' ? 'confirmed' : 'failed';
      status.txSignature = result.txSignature;

      this.emit(result.status === 'confirmed' ? 'settled' : 'failed', { settlementId, result });

      logger.info(
        { settlementId, txSignature: result.txSignature, status: result.status, deliveryPath: result.deliveryPath },
        'VEL settlement completed'
      );

      return result;
    } catch (error) {
      status.status = 'failed';
      status.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('failed', { settlementId, error });
      logger.error({ error, settlementId }, 'VEL settlement failed');
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
      evaluatorId: this.keyManager.getPublicKey(),
      agentId: request.agentId,
      score: request.evaluationResult.score,
      passed: request.evaluationResult.passed,
      verificationHash: request.evaluationResult.verificationHash,
      timestamp,
    };

    const verificationHash = this.hashProofData(proofData);
    const signature = this.signProof(verificationHash);

    return { ...proofData, verificationHash, signature };
  }

  private hashProofData(data: Omit<EvaluationProof, 'signature'>): string {
    const json = JSON.stringify(data);
    return createHash('sha256').update(json).digest('hex');
  }

  /**
   * Sign proof with Ed25519 using KeyManager
   */
  private signProof(hash: string): string {
    return this.keyManager.signHash(hash);
  }

  /**
   * Verify a proof signature
   */
  verifyProof(proof: EvaluationProof): boolean {
    const { signature, ...proofData } = proof;
    const hash = this.hashProofData(proofData as Omit<EvaluationProof, 'signature'>);
    return KeyManager.verifyHex(hash, signature, proof.evaluatorId);
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
        const result = await this.submitToAgentArena(request, proof);
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

  private async submitToAgentArena(
    request: SettlementRequest,
    proof: EvaluationProof
  ): Promise<SettlementResult> {
    logger.info(
      { taskId: request.taskId, agentId: request.agentId, score: proof.score, programId: this.config.chainHubProgramId },
      'Submitting judge_and_pay to Agent Arena'
    );

    try {
      const instruction = await this.buildAgentArenaJudgeInstruction(request, proof);
      const signer = await this.keyManager.getSigner();

      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();

      const transactionMessage = appendTransactionMessageInstructions(
        [instruction],
        setTransactionMessageLifetimeUsingBlockhash(
          { blockhash: blockhash as Blockhash, lastValidBlockHeight: BigInt(lastValidBlockHeight) },
          setTransactionMessageFeePayerSigner(signer, createTransactionMessage({ version: 0 }))
        )
      );

      const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
      const base64Tx = getBase64EncodedWireTransaction(signedTransaction);

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
      const agentAmount = (totalAmount * BigInt(95)) / BigInt(100);
      const judgeAmount = (totalAmount * BigInt(3)) / BigInt(100);
      const protocolAmount = (totalAmount * BigInt(2)) / BigInt(100);

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
      logger.error({ error, taskId: request.taskId }, 'Failed to submit judge_and_pay');
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

  private async buildAgentArenaJudgeInstruction(
    request: SettlementRequest,
    proof: EvaluationProof
  ): Promise<Instruction> {
    const programId = address(this.config.chainHubProgramId);
    const judge = this.keyManager.getAddress();
    const winner = address(request.agentId);
    const poster = address(request.poster);
    const taskId = BigInt(request.taskIdOnChain);

    const pdas = await resolveJudgeAndPayPdas(taskId, judge, winner);
    const toBytes = (addr: Address) => Array.from(getAddressEncoder().encode(addr));

    const accounts = [
      { address: judge, role: AccountRole.WRITABLE_SIGNER },
      { address: pdas.task, role: AccountRole.WRITABLE },
      { address: pdas.escrow, role: AccountRole.WRITABLE },
      { address: poster, role: AccountRole.WRITABLE },
      { address: winner, role: AccountRole.WRITABLE },
      { address: pdas.winnerApplication, role: AccountRole.READONLY },
      { address: pdas.winnerSubmission, role: AccountRole.READONLY },
      { address: pdas.winnerReputation, role: AccountRole.WRITABLE },
      { address: pdas.judgeStake, role: AccountRole.WRITABLE },
      { address: pdas.treasury, role: AccountRole.WRITABLE },
      { address: address('11111111111111111111111111111111'), role: AccountRole.READONLY },
      { address: pdas.eventAuthority, role: AccountRole.READONLY },
      { address: programId, role: AccountRole.READONLY },
    ];

    const isSolPath = request.token === 'SOL';
    const mintAddr = isSolPath ? null : address(request.token);
    const mintPk = isSolPath ? null : addressToPublicKey(address(request.token));

    if (!isSolPath && mintAddr && mintPk) {
      const [judgeAta, escrowAta, winnerAta, posterAta, treasuryAta] = await Promise.all([
        getAssociatedTokenAddress(mintPk, addressToPublicKey(address(judge))),
        getAssociatedTokenAddress(mintPk, addressToPublicKey(address(pdas.escrow))),
        getAssociatedTokenAddress(mintPk, addressToPublicKey(address(winner))),
        getAssociatedTokenAddress(mintPk, addressToPublicKey(address(poster))),
        getAssociatedTokenAddress(mintPk, addressToPublicKey(address(pdas.treasury))),
      ]);

      accounts.push({ address: address(judgeAta.toBase58()), role: AccountRole.WRITABLE });
      accounts.push({ address: address(escrowAta.toBase58()), role: AccountRole.WRITABLE });
      accounts.push({ address: address(winnerAta.toBase58()), role: AccountRole.WRITABLE });
      accounts.push({ address: address(posterAta.toBase58()), role: AccountRole.WRITABLE });
      accounts.push({ address: address(treasuryAta.toBase58()), role: AccountRole.WRITABLE });
      accounts.push({ address: mintAddr, role: AccountRole.READONLY });
      accounts.push({ address: address(TOKEN_PROGRAM_ID.toBase58()), role: AccountRole.READONLY });
      accounts.push({ address: address('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'), role: AccountRole.READONLY });
    }

    if (request.losers && request.losers.length > 0) {
      for (const loser of request.losers) {
        const agentAddr = address(loser.agent);
        const [applicationPda] = await findApplicationPda(taskId, agentAddr);
        accounts.push({ address: applicationPda, role: AccountRole.READONLY });
        if (isSolPath) {
          accounts.push({ address: agentAddr, role: AccountRole.WRITABLE });
        } else {
          const agentAta = await getAssociatedTokenAddress(mintPk!, addressToPublicKey(agentAddr));
          accounts.push({ address: address(agentAta.toBase58()), role: AccountRole.WRITABLE });
        }
      }
    }

    const data = new Uint8Array(serializeJudgeAndPayData({
      winner: toBytes(winner),
      score: proof.score,
      reasonRef: request.reasonRef ?? null,
    }));

    return {
      programAddress: programId,
      accounts,
      data,
    };
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
        return { status: 'failed', blockTime: tx.blockTime || undefined, slot: tx.slot, logs: tx.meta.logMessages || undefined };
      }

      return { status: 'confirmed', blockTime: tx.blockTime || undefined, slot: tx.slot, logs: tx.meta?.logMessages || undefined };
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
  keyDir?: string;
  keyPassword?: string;
  maxRetries?: number;
  perClient?: MagicBlockPERClient;
}

export async function createSettlementBridge(options: BridgeOptions = {}): Promise<SettlementBridge> {
  const programId = options.chainHubProgramId || '5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs';
  const rpcEndpoint = options.rpcEndpoint || 'https://api.devnet.solana.com';

  // Initialize key manager
  const keyManager = getKeyManager({
    keyDir: options.keyDir || process.env.DAEMON_KEY_DIR || './keys',
    keyName: 'evaluator',
  });
  
  // Load or create evaluator keypair
  const keyPassword = options.keyPassword || process.env.DAEMON_KEY_PASSWORD;
  await keyManager.loadOrCreate(keyPassword);
  
  logger.info(
    { evaluatorPubkey: keyManager.getPublicKey(), keyDir: options.keyDir || './keys' },
    'Settlement bridge initialized with evaluator key'
  );

  // Initialize cascade client (fallback to standard RPC if no Triton token)
  let cascadeClient: TritonCascadeClient;
  if (options.tritonApiToken || process.env.TRITON_API_TOKEN) {
    // Triton Cascade client would be initialized here when available
    // For now, use fallback
    cascadeClient = new FallbackCascadeClient(rpcEndpoint);
    logger.info('Using Triton Cascade for transaction delivery (fallback mode)');
  } else {
    cascadeClient = new FallbackCascadeClient(rpcEndpoint);
    logger.info('Using standard RPC for transaction delivery (no Triton API token)');
  }

  const config: BridgeConfig = {
    chainHubProgramId: programId,
    rpcEndpoint,
    cascadeClient,
    keyManager,
    perClient: options.perClient,
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

// ============================================================================
// Borsh Serialization Helpers
// ============================================================================

function u64LeBuffer(value: bigint | number): Buffer {
  const buf = Buffer.allocUnsafe(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

interface JudgeAndPayDataArgs {
  winner: number[];
  score: number;
  reasonRef: string | null;
}

function serializeJudgeAndPayData(args: JudgeAndPayDataArgs): Buffer {
  const schema = {
    struct: {
      winner: { array: { type: 'u8', len: 32 } },
      score: 'u8',
      reasonRef: { option: 'string' },
    },
  };
  const serialized = serialize(schema, args);
  return Buffer.concat([Buffer.from([4]), Buffer.from(serialized)]);
}

// Re-export KeyManager for external use
export { KeyManager, getKeyManager, initializeKeyManager } from './key-manager.js';
