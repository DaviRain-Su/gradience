/**
 * Enhanced Workflow SDK
 *
 * Extended SDK with advanced features:
 * - Batch operations
 * - Caching layer
 * - Retry logic
 * - Event subscriptions
 * - Rate limiting
 *
 * @module sdk/enhanced
 */

import { EventEmitter } from 'node:events';
import type { GradienceWorkflow, WorkflowExecutionResult } from '../schema/types.js';
import type { WorkflowSDKConfig, WalletAdapter, BrowseFilters, WorkflowListing } from './marketplace.js';
import { WorkflowSDK } from './marketplace.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface EnhancedSDKConfig extends WorkflowSDKConfig {
  /** Enable caching */
  enableCache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtlMs?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelayMs?: number;
  /** Rate limit (requests per minute) */
  rateLimitPerMinute?: number;
  /** Enable event subscriptions */
  enableEvents?: boolean;
  /** WebSocket endpoint for events */
  wsEndpoint?: string;
}

export interface BatchOperationResult<T> {
  /** Successful results */
  successful: { id: string; result: T }[];
  /** Failed operations */
  failed: { id: string; error: Error }[];
  /** Total duration */
  durationMs: number;
}

export interface CachedWorkflow {
  workflow: GradienceWorkflow;
  cachedAt: number;
  expiresAt: number;
}

export interface WorkflowEvent {
  type: 'workflow_created' | 'workflow_purchased' | 'workflow_executed' | 'workflow_reviewed' | 'price_updated';
  workflowId: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface ExecutionOptions {
  /** Maximum execution time (ms) */
  timeoutMs?: number;
  /** Enable parallel step execution where possible */
  parallel?: boolean;
  /** Retry failed steps */
  retryFailed?: boolean;
  /** Maximum retries per step */
  maxRetries?: number;
  /** Dry run (don't execute handlers) */
  dryRun?: boolean;
  /** Callbacks */
  onStepStart?: (stepId: string) => void;
  onStepComplete?: (result: { stepId: string; status: string }) => void;
  onStepError?: (stepId: string, error: Error) => void;
}

// ============================================================================
// Enhanced Workflow SDK
// ============================================================================

export class EnhancedWorkflowSDK extends EventEmitter {
  private baseSDK: WorkflowSDK;
  private config: Required<EnhancedSDKConfig>;
  private cache: Map<string, CachedWorkflow> = new Map();
  private rateLimitQueue: Array<() => void> = [];
  private rateLimitCount: number = 0;
  private rateLimitResetTime: number = 0;
  private wsConnection?: WebSocket;

  constructor(config: EnhancedSDKConfig) {
    super();
    
    this.config = {
      enableCache: true,
      cacheTtlMs: 5 * 60 * 1000, // 5 minutes
      maxRetries: 3,
      retryDelayMs: 1000,
      rateLimitPerMinute: 60,
      enableEvents: false,
      wsEndpoint: '',
      rpcEndpoint: config.rpcEndpoint,
      programId: config.programId || '3QRayGY5SHYnD5cb2qegEoNx7dPXJJyHJD3shzAQ75UW',
      indexerEndpoint: config.indexerEndpoint || '',
      wallet: config.wallet as import('./marketplace.js').WalletAdapter,
      connection: config.connection as import('@solana/web3.js').Connection,
    };

    this.baseSDK = new WorkflowSDK(config);

    if (this.config.enableEvents && this.config.wsEndpoint) {
      this.connectWebSocket();
    }
  }

  // -------------------------------------------------------------------------
  // Caching
  // -------------------------------------------------------------------------

  /**
   * Get workflow with caching
   */
  async get(workflowId: string, useCache: boolean = true): Promise<GradienceWorkflow | null> {
    // Check cache
    if (useCache && this.config.enableCache) {
      const cached = this.cache.get(workflowId);
      if (cached && Date.now() < cached.expiresAt) {
        this.emit('cache_hit', { workflowId });
        return cached.workflow;
      }
    }

    // Fetch from base SDK
    const workflow = await this.withRetry(() => this.baseSDK.get(workflowId));

    // Cache result
    if (workflow && this.config.enableCache) {
      this.cache.set(workflowId, {
        workflow,
        cachedAt: Date.now(),
        expiresAt: Date.now() + this.config.cacheTtlMs,
      });
      this.emit('cache_set', { workflowId });
    }

    return workflow;
  }

  /**
   * Invalidate cache entry
   */
  invalidateCache(workflowId?: string): void {
    if (workflowId) {
      this.cache.delete(workflowId);
      this.emit('cache_invalidate', { workflowId });
    } else {
      this.cache.clear();
      this.emit('cache_clear', {});
    }
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would track actual hit rate in production
    };
  }

  // -------------------------------------------------------------------------
  // Batch Operations
  // -------------------------------------------------------------------------

  /**
   * Batch get workflows
   */
  async batchGet(workflowIds: string[]): Promise<BatchOperationResult<GradienceWorkflow | null>> {
    const startTime = Date.now();
    const successful: { id: string; result: GradienceWorkflow | null }[] = [];
    const failed: { id: string; error: Error }[] = [];

    // Process in parallel with concurrency limit
    const concurrencyLimit = 5;
    const chunks = this.chunkArray(workflowIds, concurrencyLimit);

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(id => this.get(id))
      );

      results.forEach((result, index) => {
        const id = chunk[index];
        if (result.status === 'fulfilled') {
          successful.push({ id, result: result.value });
        } else {
          failed.push({ id, error: result.reason });
        }
      });
    }

    return {
      successful,
      failed,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Batch purchase workflows
   */
  async batchPurchase(workflowIds: string[]): Promise<BatchOperationResult<import('./marketplace.js').PurchaseResult>> {
    const startTime = Date.now();
    const successful: { id: string; result: import('./marketplace.js').PurchaseResult }[] = [];
    const failed: { id: string; error: Error }[] = [];

    for (const id of workflowIds) {
      try {
        await this.withRateLimit();
        const result = await this.withRetry(() => this.baseSDK.purchase(id));
        successful.push({ id, result });
      } catch (error) {
        failed.push({ id, error: error as Error });
      }
    }

    return {
      successful,
      failed,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Batch execute workflows
   */
  async batchExecute(
    executions: Array<{ workflowId: string; config?: Record<string, unknown> }>,
    options?: ExecutionOptions
  ): Promise<BatchOperationResult<WorkflowExecutionResult>> {
    const startTime = Date.now();
    const successful: { id: string; result: WorkflowExecutionResult }[] = [];
    const failed: { id: string; error: Error }[] = [];

    // Execute with concurrency limit
    const concurrencyLimit = options?.parallel ? 3 : 1;
    const chunks = this.chunkArray(executions, concurrencyLimit);

    for (const chunk of chunks) {
      const promises = chunk.map(({ workflowId, config }) =>
        this.withRetry(() =>
          this.execute(workflowId, config, options).then(result => ({
            workflowId,
            result,
          }))
        )
      );

      const results = await Promise.allSettled(promises);

      results.forEach((result, index) => {
        const { workflowId } = chunk[index];
        if (result.status === 'fulfilled') {
          successful.push({ id: workflowId, result: result.value.result });
        } else {
          failed.push({ id: workflowId, error: result.reason });
        }
      });
    }

    return {
      successful,
      failed,
      durationMs: Date.now() - startTime,
    };
  }

  // -------------------------------------------------------------------------
  // Enhanced Execution
  // -------------------------------------------------------------------------

  /**
   * Execute workflow with advanced options
   */
  async execute(
    workflowId: string,
    config?: Record<string, unknown>,
    options?: ExecutionOptions
  ): Promise<WorkflowExecutionResult> {
    const timeoutMs = options?.timeoutMs || 60000;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Check access
      const hasAccess = await this.baseSDK.hasAccess(workflowId);
      if (!hasAccess) {
        throw new Error('No access to workflow');
      }

      // Get workflow
      const workflow = await this.get(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      // Execute with timeout
      const result = await Promise.race([
        this.runExecution(workflow, config, options),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('Execution timeout'));
          });
        }),
      ]);

      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async runExecution(
    workflow: GradienceWorkflow,
    config?: Record<string, unknown>,
    options?: ExecutionOptions
  ): Promise<WorkflowExecutionResult> {
    // This would use a more sophisticated execution engine
    // For now, delegate to base SDK
    return this.baseSDK.execute(workflow.id, config, {
      onStepStart: options?.onStepStart,
      onStepComplete: options?.onStepComplete,
    });
  }

  // -------------------------------------------------------------------------
  // Retry & Rate Limiting
  // -------------------------------------------------------------------------

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
          logger.warn({ attempt, delay, error: lastError.message }, 'Retrying operation');
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  private async withRateLimit(): Promise<void> {
    const now = Date.now();

    // Reset counter if minute has passed
    if (now > this.rateLimitResetTime) {
      this.rateLimitCount = 0;
      this.rateLimitResetTime = now + 60000;
    }

    // Check if under limit
    if (this.rateLimitCount < this.config.rateLimitPerMinute) {
      this.rateLimitCount++;
      return;
    }

    // Wait for next minute
    return new Promise((resolve) => {
      this.rateLimitQueue.push(resolve);
      
      setTimeout(() => {
        this.rateLimitCount = 0;
        this.rateLimitResetTime = Date.now() + 60000;
        
        // Resolve queued requests
        while (this.rateLimitQueue.length > 0 && this.rateLimitCount < this.config.rateLimitPerMinute) {
          const resolveFn = this.rateLimitQueue.shift();
          if (resolveFn) {
            this.rateLimitCount++;
            resolveFn();
          }
        }
      }, this.rateLimitResetTime - now);
    });
  }

  // -------------------------------------------------------------------------
  // Event Subscriptions
  // -------------------------------------------------------------------------

  private connectWebSocket(): void {
    if (!this.config.wsEndpoint) return;

    try {
      this.wsConnection = new WebSocket(this.config.wsEndpoint);

      this.wsConnection.onmessage = (event) => {
        try {
          const workflowEvent: WorkflowEvent = JSON.parse(event.data);
          this.emit('workflow_event', workflowEvent);
          this.emit(workflowEvent.type, workflowEvent);
        } catch (error) {
          logger.error({ error: String(error) }, 'Failed to parse WebSocket message');
        }
      };

      this.wsConnection.onclose = () => {
        this.emit('disconnected', {});
        // Reconnect after delay
        setTimeout(() => this.connectWebSocket(), 5000);
      };

      this.wsConnection.onerror = (error) => {
        logger.error({ error: error.message || 'WebSocket error' }, 'WebSocket error');
      };

      this.emit('connected', {});
    } catch (error) {
      logger.error({ error: String(error) }, 'Failed to connect WebSocket');
    }
  }

  /**
   * Subscribe to workflow events
   */
  subscribeToWorkflow(workflowId: string, callback: (event: WorkflowEvent) => void): () => void {
    const handler = (event: WorkflowEvent) => {
      if (event.workflowId === workflowId) {
        callback(event);
      }
    };

    this.on('workflow_event', handler);

    // Return unsubscribe function
    return () => this.off('workflow_event', handler);
  }

  // -------------------------------------------------------------------------
  // Utility Methods
  // -------------------------------------------------------------------------

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // -------------------------------------------------------------------------
  // Passthrough to Base SDK
  // -------------------------------------------------------------------------

  async create(workflow: GradienceWorkflow): Promise<string> {
    return this.withRetry(() => this.baseSDK.create(workflow));
  }

  async purchase(workflowId: string): Promise<import('./marketplace.js').PurchaseResult> {
    await this.withRateLimit();
    return this.withRetry(() => this.baseSDK.purchase(workflowId));
  }

  async simulate(workflow: GradienceWorkflow, config?: Record<string, unknown>): Promise<WorkflowExecutionResult> {
    return this.baseSDK.simulate(workflow, config);
  }

  async review(workflowId: string, rating: number, comment: string): Promise<import('./marketplace.js').ReviewResult> {
    await this.withRateLimit();
    return this.withRetry(() => this.baseSDK.review(workflowId, rating, comment));
  }

  async browse(filters: BrowseFilters = {}): Promise<WorkflowListing[]> {
    return this.withRetry(() => this.baseSDK.browse(filters));
  }

  async getMyWorkflows(): Promise<WorkflowListing[]> {
    return this.withRetry(() => this.baseSDK.getMyWorkflows());
  }

  async getMyPurchases(): Promise<WorkflowListing[]> {
    return this.withRetry(() => this.baseSDK.getMyPurchases());
  }

  async update(workflowId: string, updates: Partial<Pick<GradienceWorkflow, 'description' | 'isPublic'>>): Promise<import('./marketplace.js').UpdateResult> {
    await this.withRateLimit();
    // Invalidate cache after update
    this.invalidateCache(workflowId);
    return this.withRetry(() => this.baseSDK.update(workflowId, updates));
  }

  async deactivate(workflowId: string): Promise<import('./marketplace.js').UpdateResult> {
    await this.withRateLimit();
    this.invalidateCache(workflowId);
    return this.withRetry(() => this.baseSDK.deactivate(workflowId));
  }

  async activate(workflowId: string): Promise<import('./marketplace.js').UpdateResult> {
    await this.withRateLimit();
    this.invalidateCache(workflowId);
    return this.withRetry(() => this.baseSDK.activate(workflowId));
  }

  async delete(workflowId: string): Promise<import('./marketplace.js').UpdateResult> {
    await this.withRateLimit();
    this.invalidateCache(workflowId);
    return this.withRetry(() => this.baseSDK.delete(workflowId));
  }

  async getExecutions(workflowId: string): Promise<WorkflowExecutionResult[]> {
    return this.withRetry(() => this.baseSDK.getExecutions(workflowId));
  }

  async hasAccess(workflowId: string, user?: string): Promise<boolean> {
    return this.baseSDK.hasAccess(workflowId, user);
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  async close(): Promise<void> {
    this.cache.clear();
    this.rateLimitQueue = [];
    
    if (this.wsConnection) {
      this.wsConnection.close();
    }
    
    this.removeAllListeners();
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createEnhancedSDK(config: EnhancedSDKConfig): EnhancedWorkflowSDK {
  return new EnhancedWorkflowSDK(config);
}
