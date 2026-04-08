/**
 * Reputation Push Service - GRA-228c
 * 
 * Actively pushes reputation data to external registries:
 * - Solana Agent Registry
 * - ERC-8004 Reputation Registry
 * 
 * Triggers:
 * 1. Real-time: After task settlement
 * 2. Batch: Daily sync job
 * 3. Manual: API request
 */

import { logger } from '../utils/logger.js';
import type { SolanaAgentRegistryClient } from '../integrations/solana-agent-registry.js';
import type { ERC8004Client } from '../integrations/erc8004-client.js';
import type { ChainHubReputationClient } from '../integrations/chain-hub-reputation.js';
import type { ReputationAggregationEngine, ReputationScore } from './aggregation-engine.js';

export interface PushServiceConfig {
  solanaClient: SolanaAgentRegistryClient;
  erc8004Client: ERC8004Client;
  engine: ReputationAggregationEngine;
  chainHubClient?: ChainHubReputationClient;
  enableRealtime: boolean;
  enableBatch: boolean;
  batchIntervalMs: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface PushResult {
  agentAddress: string;
  solana?: {
    success: boolean;
    signature?: string;
    error?: string;
  };
  erc8004?: {
    success: boolean;
    txHash?: string;
    error?: string;
  };
  timestamp: number;
}

export interface SyncStatus {
  agentAddress: string;
  solanaSynced: boolean;
  ethereumSynced: boolean;
  lastSyncAt: number | null;
  pendingSync: boolean;
}

export class ReputationPushService {
  private config: PushServiceConfig;
  private syncQueue: Map<string, { score: ReputationScore; retries: number }> = new Map();
  private syncStatus: Map<string, SyncStatus> = new Map();
  private batchTimer?: NodeJS.Timeout;

  constructor(config: PushServiceConfig) {
    this.config = config;
    
    if (config.enableBatch) {
      this.startBatchJob();
    }

    logger.info(
      { realtime: config.enableRealtime, batch: config.enableBatch },
      'Reputation push service initialized'
    );
  }

  /**
   * Push reputation to all registries (real-time)
   */
  async push(agentAddress: string, score: ReputationScore): Promise<PushResult> {
    const result: PushResult = {
      agentAddress,
      timestamp: Date.now(),
    };

    // Push to Solana Agent Registry
    try {
      const solanaResult = await this.pushToSolana(agentAddress, score);
      result.solana = solanaResult;
    } catch (error) {
      result.solana = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Push to ERC-8004
    try {
      const erc8004Result = await this.pushToERC8004(agentAddress, score);
      result.erc8004 = erc8004Result;
    } catch (error) {
      result.erc8004 = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Update sync status
    this.updateSyncStatus(agentAddress, result);

    // Queue for retry if failed
    if (!result.solana?.success || !result.erc8004?.success) {
      this.queueForRetry(agentAddress, score);
    }

    logger.info(
      {
        agent: agentAddress,
        solana: result.solana?.success,
        erc8004: result.erc8004?.success,
      },
      'Reputation push completed'
    );

    return result;
  }

  /**
   * Push to Solana Agent Registry
   */
  private async pushToSolana(
    agentAddress: string,
    score: ReputationScore
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      // Check if agent is registered
      const isRegistered = await this.config.solanaClient.isRegistered(agentAddress);
      
      if (!isRegistered) {
        // Auto-register if not exists
        logger.info({ agent: agentAddress }, 'Auto-registering agent on Solana');
        await this.config.solanaClient.registerAgent({
          name: `Agent ${agentAddress.slice(0, 8)}`,
          description: 'Auto-registered by Gradience Reputation Oracle',
          owner: new (await import('@solana/web3.js')).PublicKey(agentAddress),
        });
      }

      // Submit reputation
      const signature = await this.config.solanaClient.submitReputation({
        agentPDA: agentAddress,
        score: score.overallScore,
        category: 'overall',
        proof: JSON.stringify({
          completedTasks: score.completedTasks,
          avgRating: score.avgRating,
          calculatedAt: score.calculatedAt,
        }),
      });

      return { success: true, signature };
    } catch (error) {
      logger.error({ error, agent: agentAddress }, 'Failed to push to Solana');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Push to ERC-8004
   */
  private async pushToERC8004(
    agentAddress: string,
    score: ReputationScore
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const agentURI = `gradience://agent/${agentAddress}`;
      
      // Check if registered
      const isRegistered = await this.config.erc8004Client.isRegistered(agentURI);
      
      let agentId: string;
      
      if (!isRegistered) {
        // Auto-register
        logger.info({ agent: agentAddress }, 'Auto-registering agent on ERC-8004');
        const result = await this.config.erc8004Client.registerAgent(agentURI, {
          name: `Agent ${agentAddress.slice(0, 8)}`,
          description: 'Auto-registered by Gradience Reputation Oracle',
          source: 'gradience',
        });
        agentId = result.agentId;
      } else {
        // Get existing agent ID
        const id = await this.config.erc8004Client.getAgentId(agentURI);
        if (!id) throw new Error('Agent ID not found');
        agentId = id;
      }

      // Submit feedback
      const { txHash } = await this.config.erc8004Client.giveFeedback({
        agentId,
        value: score.overallScore - 50, // Convert to -50 to +50 range
        valueDecimals: 2,
        tags: ['gradience', 'task_reputation'],
        endpoint: 'https://api.gradiences.xyz',
        feedbackURI: `data:application/json;base64,${Buffer.from(
          JSON.stringify(score)
        ).toString('base64')}`,
        feedbackHash: '0x' + '0'.repeat(64), // Placeholder
      });

      return { success: true, txHash };
    } catch (error) {
      logger.error({ error, agent: agentAddress }, 'Failed to push to ERC-8004');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Batch push multiple agents
   */
  async batchPush(agentAddresses: string[]): Promise<{
    success: string[];
    failed: string[];
    results: PushResult[];
  }> {
    const success: string[] = [];
    const failed: string[] = [];
    const results: PushResult[] = [];

    for (const address of agentAddresses) {
      try {
        // Calculate reputation
        // Note: In real implementation, fetch activity from database
        const activity = await this.fetchActivity(address);
        const score = this.config.engine.calculateReputation(activity);
        
        const result = await this.push(address, score);
        results.push(result);
        
        if (result.solana?.success && result.erc8004?.success) {
          success.push(address);
        } else {
          failed.push(address);
        }
      } catch (error) {
        failed.push(address);
        logger.error({ error, agent: address }, 'Batch push failed');
      }
    }

    logger.info(
      { success: success.length, failed: failed.length },
      'Batch push completed'
    );

    return { success, failed, results };
  }

  /**
   * Get sync status
   */
  getSyncStatus(agentAddress: string): SyncStatus {
    return this.syncStatus.get(agentAddress) || {
      agentAddress,
      solanaSynced: false,
      ethereumSynced: false,
      lastSyncAt: null,
      pendingSync: false,
    };
  }

  /**
   * Queue for retry
   */
  private queueForRetry(agentAddress: string, score: ReputationScore): void {
    const existing = this.syncQueue.get(agentAddress);
    
    if (existing && existing.retries >= this.config.retryAttempts) {
      logger.warn({ agent: agentAddress }, 'Max retries exceeded, dropping');
      this.syncQueue.delete(agentAddress);
      return;
    }

    this.syncQueue.set(agentAddress, {
      score,
      retries: existing ? existing.retries + 1 : 1,
    });

    // Schedule retry
    setTimeout(() => {
      this.retry(agentAddress);
    }, this.config.retryDelayMs);
  }

  /**
   * Retry failed push
   */
  private async retry(agentAddress: string): Promise<void> {
    const queued = this.syncQueue.get(agentAddress);
    if (!queued) return;

    this.syncQueue.delete(agentAddress);
    
    logger.info({ agent: agentAddress, retry: queued.retries }, 'Retrying push');
    
    await this.push(agentAddress, queued.score);
  }

  /**
   * Start batch job
   */
  private startBatchJob(): void {
    this.batchTimer = setInterval(() => {
      this.processBatch();
    }, this.config.batchIntervalMs);

    logger.info(
      { intervalMs: this.config.batchIntervalMs },
      'Batch push job started'
    );
  }

  /**
   * Process batch
   */
  private async processBatch(): Promise<void> {
    // Get all agents needing sync
    const pending: string[] = [];
    
    for (const [address, status] of this.syncStatus) {
      if (status.pendingSync) {
        pending.push(address);
      }
    }

    if (pending.length === 0) return;

    logger.info({ count: pending.length }, 'Processing batch sync');
    
    await this.batchPush(pending);
  }

  /**
   * Update sync status
   */
  private updateSyncStatus(agentAddress: string, result: PushResult): void {
    const status: SyncStatus = {
      agentAddress,
      solanaSynced: result.solana?.success || false,
      ethereumSynced: result.erc8004?.success || false,
      lastSyncAt: result.timestamp,
      pendingSync: !result.solana?.success || !result.erc8004?.success,
    };

    this.syncStatus.set(agentAddress, status);
  }

  /**
   * Fetch agent activity (placeholder)
   */
  private async fetchActivity(agentAddress: string): Promise<any> {
    const client = this.config.chainHubClient;
    if (client) {
      const record = await client.getReputation(agentAddress);
      if (record) {
        return {
          agentAddress,
          completedTasks: record.completedTasks,
          attemptedTasks: record.completedTasks,
          totalEarned: BigInt(0),
          totalStaked: BigInt(0),
          avgRating: record.avgRating,
          ratingsCount: record.completedTasks,
          disputeCount: 0,
          disputeWon: 0,
          firstActivity: Date.now() - 86400000 * 30,
          lastActivity: new Date(record.updatedAt).getTime(),
          dailyActivity: [],
        };
      }
    }
    // Fallback placeholder
    return {
      agentAddress,
      completedTasks: 10,
      attemptedTasks: 12,
      totalEarned: BigInt(1000000000),
      totalStaked: BigInt(500000000),
      avgRating: 4.5,
      ratingsCount: 8,
      disputeCount: 1,
      disputeWon: 1,
      firstActivity: Date.now() - 86400000 * 30,
      lastActivity: Date.now(),
      dailyActivity: [],
    };
  }

  /**
   * Stop service
   */
  stop(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    this.syncQueue.clear();
    logger.info('Reputation push service stopped');
  }
}

// Factory
export function createReputationPushService(
  config: PushServiceConfig
): ReputationPushService {
  return new ReputationPushService(config);
}
