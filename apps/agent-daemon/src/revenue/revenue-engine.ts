/**
 * Revenue Sharing Engine
 *
 * Main engine for calculating and executing revenue distributions.
 * Integrates with the existing distribution modules and handles on-chain settlement.
 *
 * Revenue distribution percentages:
 * - Agent: 95% (9500 basis points)
 * - Judge: 3% (300 basis points)
 * - Protocol: 2% (200 basis points)
 *
 * @module revenue/revenue-engine
 */

import { Connection, PublicKey, type Signer } from '@solana/web3.js';
import type Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';
import { RevenueStore, type RevenueDistributionInput } from './revenue-store.js';
import {
  DistributionBuilder,
  distribute,
  distributeTokens,
  type DistributionConfig,
  type DistributionRequest,
  type DistributionResult,
} from './distribution/index.js';

// ============================================================================
// Configuration Types
// ============================================================================

export interface RevenueEngineConfig {
  /** Solana RPC endpoint */
  rpcEndpoint: string;
  /** Chain Hub program ID */
  chainHubProgramId: PublicKey;
  /** Protocol treasury address */
  protocolTreasury: PublicKey;
  /** Judge pool address */
  judgePool: PublicKey;
  /** Distribution percentages in basis points (10000 = 100%) */
  percentages: {
    agent: number; // 9500 = 95%
    judge: number; // 300 = 3%
    protocol: number; // 200 = 2%
  };
  /** Auto-settle distributions on-chain */
  autoSettle: boolean;
  /** Retry failed settlements */
  retryEnabled: boolean;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Settlement polling interval (ms) */
  settlementIntervalMs: number;
}

export interface SettlementTask {
  distributionId: string;
  request: DistributionRequest;
  attempts: number;
}

// ============================================================================
// Revenue Calculation Types
// ============================================================================

export interface RevenueCalculation {
  totalAmount: bigint;
  agentAmount: bigint;
  judgeAmount: bigint;
  protocolAmount: bigint;
  percentages: {
    agent: number;
    judge: number;
    protocol: number;
  };
}

export interface TaskSettlementInfo {
  taskId: string;
  paymentId: string;
  agentAddress: string;
  judgeAddress: string;
  tokenMint: string;
  totalAmount: bigint;
  escrowAccount: string;
  escrowAuthority: string;
}

// ============================================================================
// Revenue Sharing Engine
// ============================================================================

export class RevenueSharingEngine {
  private connection: Connection;
  private store: RevenueStore;
  private builder: DistributionBuilder;
  private config: RevenueEngineConfig;
  private settlementTimer: ReturnType<typeof setInterval> | null = null;
  private pendingSettlements: Map<string, SettlementTask> = new Map();

  constructor(db: Database.Database, config: Partial<RevenueEngineConfig> = {}) {
    this.config = this.buildConfig(config);
    this.connection = new Connection(this.config.rpcEndpoint);
    this.store = new RevenueStore(db);
    this.builder = new DistributionBuilder({ config: this.getDistributionConfig() });

    logger.info(
      {
        agent: `${this.config.percentages.agent / 100}%`,
        judge: `${this.config.percentages.judge / 100}%`,
        protocol: `${this.config.percentages.protocol / 100}%`,
        autoSettle: this.config.autoSettle,
      },
      'RevenueSharingEngine initialized'
    );

    if (this.config.autoSettle) {
      this.startSettlementPolling();
    }
  }

  private buildConfig(overrides: Partial<RevenueEngineConfig>): RevenueEngineConfig {
    return {
      rpcEndpoint: overrides.rpcEndpoint ?? 'https://api.devnet.solana.com',
      chainHubProgramId: overrides.chainHubProgramId ?? new PublicKey('ChainHub111111111111111111111111111111111111'),
      protocolTreasury: overrides.protocolTreasury ?? new PublicKey('Treasury111111111111111111111111111111111111'),
      judgePool: overrides.judgePool ?? new PublicKey('JudgePool11111111111111111111111111111111111'),
      percentages: overrides.percentages ?? {
        agent: 9500, // 95%
        judge: 300, // 3%
        protocol: 200, // 2%
      },
      autoSettle: overrides.autoSettle ?? true,
      retryEnabled: overrides.retryEnabled ?? true,
      maxRetries: overrides.maxRetries ?? 3,
      settlementIntervalMs: overrides.settlementIntervalMs ?? 30_000,
    };
  }

  private getDistributionConfig(): DistributionConfig {
    return {
      chainHubProgramId: this.config.chainHubProgramId,
      protocolTreasury: this.config.protocolTreasury,
      judgePool: this.config.judgePool,
      percentages: this.config.percentages,
    };
  }

  // -------------------------------------------------------------------------
  // Revenue Calculation
  // -------------------------------------------------------------------------

  /**
   * Calculate revenue distribution breakdown
   */
  calculateRevenue(totalAmount: bigint): RevenueCalculation {
    const agentAmount = (totalAmount * BigInt(this.config.percentages.agent)) / 10000n;
    const judgeAmount = (totalAmount * BigInt(this.config.percentages.judge)) / 10000n;
    const protocolAmount = (totalAmount * BigInt(this.config.percentages.protocol)) / 10000n;

    // Handle rounding - give remainder to agent
    const distributed = agentAmount + judgeAmount + protocolAmount;
    const remainder = totalAmount - distributed;

    return {
      totalAmount,
      agentAmount: agentAmount + remainder,
      judgeAmount,
      protocolAmount,
      percentages: this.config.percentages,
    };
  }

  // -------------------------------------------------------------------------
  // Distribution Recording
  // -------------------------------------------------------------------------

  /**
   * Record a revenue distribution for a completed task
   * This is called when a task is settled and ready for payment
   */
  recordTaskDistribution(
    taskInfo: TaskSettlementInfo
  ): { distributionId: string; calculation: RevenueCalculation } {
    const calculation = this.calculateRevenue(taskInfo.totalAmount);
    const distributionId = `rev-${taskInfo.taskId}-${Date.now()}`;

    const input: RevenueDistributionInput = {
      id: distributionId,
      taskId: taskInfo.taskId,
      paymentId: taskInfo.paymentId,
      agentAddress: taskInfo.agentAddress,
      judgeAddress: taskInfo.judgeAddress,
      tokenMint: taskInfo.tokenMint,
      totalAmount: calculation.totalAmount,
      agentAmount: calculation.agentAmount,
      judgeAmount: calculation.judgeAmount,
      protocolAmount: calculation.protocolAmount,
      agentPercentage: calculation.percentages.agent,
      judgePercentage: calculation.percentages.judge,
      protocolPercentage: calculation.percentages.protocol,
      escrowAccount: taskInfo.escrowAccount,
    };

    this.store.recordDistribution(input);

    logger.info(
      {
        distributionId,
        taskId: taskInfo.taskId,
        totalAmount: calculation.totalAmount.toString(),
        agentAmount: calculation.agentAmount.toString(),
        judgeAmount: calculation.judgeAmount.toString(),
        protocolAmount: calculation.protocolAmount.toString(),
      },
      'Task revenue distribution recorded'
    );

    // If auto-settle is enabled, queue for settlement
    if (this.config.autoSettle) {
      this.queueSettlement(distributionId, taskInfo);
    }

    return { distributionId, calculation };
  }

  // -------------------------------------------------------------------------
  // On-Chain Settlement
  // -------------------------------------------------------------------------

  /**
   * Queue a distribution for on-chain settlement
   */
  private queueSettlement(distributionId: string, taskInfo: TaskSettlementInfo): void {
    const request: DistributionRequest = {
      paymentId: taskInfo.paymentId,
      taskId: taskInfo.taskId,
      agentAddress: new PublicKey(taskInfo.agentAddress),
      judgeAddress: new PublicKey(taskInfo.judgeAddress),
      tokenMint: new PublicKey(taskInfo.tokenMint),
      totalAmount: taskInfo.totalAmount,
      escrowAccount: new PublicKey(taskInfo.escrowAccount),
      escrowAuthority: new PublicKey(taskInfo.escrowAuthority),
    };

    this.pendingSettlements.set(distributionId, {
      distributionId,
      request,
      attempts: 0,
    });

    this.store.markProcessing(distributionId);
    logger.debug({ distributionId }, 'Distribution queued for settlement');
  }

  /**
   * Execute on-chain settlement for a distribution
   */
  async settleDistribution(
    distributionId: string,
    signer: Signer
  ): Promise<DistributionResult> {
    const record = this.store.getById(distributionId);
    if (!record) {
      throw new DaemonError(
        ErrorCodes.NOT_FOUND,
        `Distribution ${distributionId} not found`
      );
    }

    if (record.status === 'confirmed') {
      logger.warn({ distributionId }, 'Distribution already confirmed');
      return {
        distributionId,
        txSignature: record.txSignature!,
        blockTime: record.confirmedAt || Date.now(),
        slot: 0,
        breakdown: {
          agent: { address: record.agentAddress, amount: BigInt(record.agentAmount) },
          judge: { address: record.judgeAddress, amount: BigInt(record.judgeAmount) },
          protocol: { address: this.config.protocolTreasury.toBase58(), amount: BigInt(record.protocolAmount) },
        },
        status: 'confirmed',
      };
    }

    const request: DistributionRequest = {
      paymentId: record.paymentId,
      taskId: record.taskId,
      agentAddress: new PublicKey(record.agentAddress),
      judgeAddress: new PublicKey(record.judgeAddress),
      tokenMint: new PublicKey(record.tokenMint),
      totalAmount: BigInt(record.totalAmount),
      escrowAccount: new PublicKey(record.escrowAccount),
      escrowAuthority: signer.publicKey, // Use signer as escrow authority
    };

    this.store.markProcessing(distributionId);

    try {
      let result: DistributionResult;

      // Determine if native SOL or SPL token
      const isNativeSOL = record.tokenMint === PublicKey.default.toBase58() ||
                         record.tokenMint === 'So11111111111111111111111111111111111111112';

      if (isNativeSOL) {
        result = await distribute(this.connection, this.getDistributionConfig(), request, signer);
      } else {
        result = await distributeTokens(this.connection, this.getDistributionConfig(), request, signer);
      }

      if (result.status === 'confirmed') {
        this.store.markConfirmed(distributionId, result.txSignature);
        this.pendingSettlements.delete(distributionId);
      } else {
        throw new Error(result.error || 'Distribution failed');
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.store.markFailed(distributionId, errorMsg);

      // Retry logic
      const settlement = this.pendingSettlements.get(distributionId);
      if (settlement && this.config.retryEnabled) {
        settlement.attempts++;
        if (settlement.attempts >= this.config.maxRetries) {
          this.pendingSettlements.delete(distributionId);
          logger.error({ distributionId, attempts: settlement.attempts }, 'Max retry attempts reached');
        }
      }

      throw new DaemonError(
        ErrorCodes.TRANSACTION_FAILED,
        `Settlement failed: ${errorMsg}`
      );
    }
  }

  /**
   * Start polling for pending settlements
   */
  private startSettlementPolling(): void {
    this.settlementTimer = setInterval(() => {
      this.processPendingSettlements().catch((err) => {
        logger.error({ err }, 'Settlement polling error');
      });
    }, this.config.settlementIntervalMs);

    logger.info({ intervalMs: this.config.settlementIntervalMs }, 'Settlement polling started');
  }

  /**
   * Process pending settlements
   * Note: This requires a signer, so in practice settlements are triggered
   * manually or via an authorized service with access to the escrow key
   */
  private async processPendingSettlements(): Promise<void> {
    const pending = this.store.getPending();
    if (pending.length === 0) return;

    logger.debug({ count: pending.length }, 'Processing pending settlements');

    // Note: Actual settlement requires a signer, which should be provided
    // by the caller (e.g., a settlement service or admin operation)
    // This method logs pending settlements for manual processing
    for (const record of pending) {
      logger.info(
        {
          distributionId: record.id,
          taskId: record.taskId,
          totalAmount: record.totalAmount,
        },
        'Pending settlement awaiting signer'
      );
    }
  }

  /**
   * Stop settlement polling
   */
  stopSettlementPolling(): void {
    if (this.settlementTimer) {
      clearInterval(this.settlementTimer);
      this.settlementTimer = null;
      logger.info('Settlement polling stopped');
    }
  }

  // -------------------------------------------------------------------------
  // Query Methods
  // -------------------------------------------------------------------------

  /**
   * Get distribution by ID
   */
  getDistribution(distributionId: string) {
    return this.store.getById(distributionId);
  }

  /**
   * Get distribution by task ID
   */
  getDistributionByTask(taskId: string) {
    return this.store.getByTaskId(taskId);
  }

  /**
   * List distributions
   */
  listDistributions(options: Parameters<RevenueStore['list']>[0] = {}) {
    return this.store.list(options);
  }

  /**
   * Get revenue statistics
   */
  getStats() {
    return this.store.getStats();
  }

  /**
   * Get pending settlement count
   */
  getPendingCount(): number {
    return this.pendingSettlements.size;
  }

  /**
   * Shutdown the engine
   */
  shutdown(): void {
    this.stopSettlementPolling();
    this.pendingSettlements.clear();
    logger.info('RevenueSharingEngine shutdown complete');
  }
}

// ============================================================================
// Factory
// ============================================================================

export interface RevenueEngineOptions {
  rpcEndpoint?: string;
  chainHubProgramId?: string;
  protocolTreasury?: string;
  judgePool?: string;
  percentages?: {
    agent?: number;
    judge?: number;
    protocol?: number;
  };
  autoSettle?: boolean;
  retryEnabled?: boolean;
  maxRetries?: number;
  settlementIntervalMs?: number;
}

export function createRevenueSharingEngine(
  db: Database.Database,
  options: RevenueEngineOptions = {}
): RevenueSharingEngine {
  const config: Partial<RevenueEngineConfig> = {
    rpcEndpoint: options.rpcEndpoint,
    autoSettle: options.autoSettle,
    retryEnabled: options.retryEnabled,
    maxRetries: options.maxRetries,
    settlementIntervalMs: options.settlementIntervalMs,
  };

  if (options.chainHubProgramId) {
    config.chainHubProgramId = new PublicKey(options.chainHubProgramId);
  }
  if (options.protocolTreasury) {
    config.protocolTreasury = new PublicKey(options.protocolTreasury);
  }
  if (options.judgePool) {
    config.judgePool = new PublicKey(options.judgePool);
  }
  if (options.percentages) {
    config.percentages = {
      agent: options.percentages.agent ?? 9500,
      judge: options.percentages.judge ?? 300,
      protocol: options.percentages.protocol ?? 200,
    };
  }

  return new RevenueSharingEngine(db, config);
}
