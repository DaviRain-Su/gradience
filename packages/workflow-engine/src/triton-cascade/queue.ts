/**
 * Triton Cascade Integration - Transaction Queue Management
 *
 * @module triton-cascade/queue
 */

import type { TransactionQueueItem, CascadeTransactionRequest } from './types.js';
import { DEFAULTS } from './config.js';

/**
 * Transaction queue options
 */
export interface TransactionQueueOptions {
  /** Maximum concurrent transactions */
  maxConcurrent: number;
  /** Maximum queue size */
  maxQueueSize?: number;
  /** Retry backoff base in milliseconds */
  retryBackoffBaseMs?: number;
  /** Maximum retry delay in milliseconds */
  maxRetryDelayMs?: number;
}

/**
 * Transaction queue manager
 */
export class TransactionQueue {
  private queue: TransactionQueueItem[] = [];
  private running = 0;
  private readonly options: Required<TransactionQueueOptions>;
  private processingInterval?: ReturnType<typeof setInterval>;
  private readonly signatures = new Set<string>();

  constructor(options: TransactionQueueOptions) {
    this.options = {
      maxConcurrent: options.maxConcurrent,
      maxQueueSize: options.maxQueueSize || 1000,
      retryBackoffBaseMs: options.retryBackoffBaseMs || DEFAULTS.RETRY_BACKOFF_BASE_MS,
      maxRetryDelayMs: options.maxRetryDelayMs || DEFAULTS.MAX_RETRY_DELAY_MS,
    };
  }

  /**
   * Add a transaction to the queue
   */
  add(
    request: CascadeTransactionRequest,
    retryCount = 0
  ): Promise<import('./types.js').CascadeTransactionResponse> {
    // Check for duplicate signature
    if (this.signatures.has(request.signature)) {
      return Promise.reject(
        new Error(`Transaction with signature ${request.signature} already in queue`)
      );
    }

    // Check queue size limit
    if (this.queue.length >= this.options.maxQueueSize) {
      return Promise.reject(new Error('Transaction queue is full'));
    }

    return new Promise((resolve, reject) => {
      const item: TransactionQueueItem = {
        id: this.generateId(),
        request,
        retryCount,
        firstAttemptAt: Date.now(),
        state: 'pending',
        resolve,
        reject,
      };

      this.signatures.add(request.signature);
      this.queue.push(item);
      this.processQueue();
    });
  }

  /**
   * Schedule a retry for a failed transaction
   */
  scheduleRetry(
    item: TransactionQueueItem,
    error: Error
  ): Promise<import('./types.js').CascadeTransactionResponse> | null {
    if (item.retryCount >= this.options.maxRetryDelayMs) {
      return null;
    }

    const delay = this.calculateRetryDelay(item.retryCount);
    item.nextRetryAt = Date.now() + delay;
    item.retryCount++;
    item.lastError = error.message;
    item.state = 'pending';

    // Re-add to queue
    this.queue.push(item);
    this.processQueue();

    return new Promise((resolve, reject) => {
      item.resolve = resolve;
      item.reject = reject;
    });
  }

  /**
   * Get the next item to process
   */
  next(): TransactionQueueItem | undefined {
    const now = Date.now();

    // Find items that are ready to be processed
    const readyItems = this.queue.filter(
      (item) => !item.nextRetryAt || item.nextRetryAt <= now
    );

    // Sort by priority (if implemented) and then by first attempt time
    readyItems.sort((a, b) => a.firstAttemptAt - b.firstAttemptAt);

    return readyItems[0];
  }

  /**
   * Mark an item as processing
   */
  markProcessing(item: TransactionQueueItem): void {
    item.state = 'submitting';
    this.running++;
    this.removeFromQueue(item);
  }

  /**
   * Mark an item as completed
   */
  markCompleted(item: TransactionQueueItem): void {
    item.state = 'completed';
    this.running--;
    this.signatures.delete(item.request.signature);
    this.processQueue();
  }

  /**
   * Mark an item as failed
   */
  markFailed(item: TransactionQueueItem, error: Error): void {
    item.state = 'failed';
    this.running--;
    this.signatures.delete(item.request.signature);
    item.reject(error);
    this.processQueue();
  }

  /**
   * Remove an item from the queue
   */
  private removeFromQueue(item: TransactionQueueItem): void {
    const index = this.queue.indexOf(item);
    if (index > -1) {
      this.queue.splice(index, 1);
    }
  }

  /**
   * Process the queue
   */
  private processQueue(): void {
    while (
      this.running < this.options.maxConcurrent &&
      this.queue.length > 0
    ) {
      const item = this.next();
      if (!item) break;

      this.markProcessing(item);
      // The actual processing is handled by the caller
    }
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(retryCount: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s...
    const exponentialDelay =
      this.options.retryBackoffBaseMs * Math.pow(2, retryCount);

    // Add random jitter (±25%)
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);

    // Cap at maximum delay
    return Math.min(exponentialDelay + jitter, this.options.maxRetryDelayMs);
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current queue statistics
   */
  getStats(): {
    queueSize: number;
    running: number;
    totalPending: number;
  } {
    return {
      queueSize: this.queue.length,
      running: this.running,
      totalPending: this.queue.length + this.running,
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    // Reject all pending items
    for (const item of this.queue) {
      item.reject(new Error('Queue cleared'));
    }

    this.queue = [];
    this.signatures.clear();
    this.running = 0;
  }

  /**
   * Check if a signature is already in the queue
   */
  hasSignature(signature: string): boolean {
    return this.signatures.has(signature);
  }

  /**
   * Get all pending signatures
   */
  getPendingSignatures(): string[] {
    return Array.from(this.signatures);
  }

  /**
   * Destroy the queue
   */
  destroy(): void {
    this.clear();
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
  }
}
