/**
 * Triton Cascade Integration - Queue Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TransactionQueue } from '../queue.js';
import type { CascadeTransactionRequest } from '../types.js';

describe('TransactionQueue', () => {
  let queue: TransactionQueue;

  beforeEach(() => {
    queue = new TransactionQueue({ maxConcurrent: 2 });
  });

  const createMockRequest = (signature: string): CascadeTransactionRequest => ({
    transaction: 'base64data',
    signature,
    recentBlockhash: 'hash',
    lastValidBlockHeight: 100,
    sender: 'sender',
    transactionType: 'transfer',
  });

  it('should add transaction to queue', async () => {
    const request = createMockRequest('sig1');

    const promise = queue.add(request);

    // Queue should have the item
    expect(queue.getStats().queueSize).toBe(0); // Immediately moved to processing
    expect(queue.getStats().running).toBe(1);

    // Clean up
    queue.clear();
  });

  it('should reject duplicate signatures', async () => {
    const request = createMockRequest('sig1');

    queue.add(request);

    await expect(queue.add(request)).rejects.toThrow('already in queue');

    queue.clear();
  });

  it('should respect max queue size', async () => {
    const smallQueue = new TransactionQueue({
      maxConcurrent: 1,
      maxQueueSize: 2,
    });

    // Fill the queue
    smallQueue.add(createMockRequest('sig1'));
    smallQueue.add(createMockRequest('sig2'));

    // Third should fail
    await expect(smallQueue.add(createMockRequest('sig3'))).rejects.toThrow(
      'queue is full'
    );

    smallQueue.clear();
  });

  it('should track pending signatures', () => {
    const request = createMockRequest('sig1');
    queue.add(request);

    expect(queue.hasSignature('sig1')).toBe(true);
    expect(queue.hasSignature('sig2')).toBe(false);

    queue.clear();
  });

  it('should return queue statistics', () => {
    queue.add(createMockRequest('sig1'));
    queue.add(createMockRequest('sig2'));

    const stats = queue.getStats();

    expect(stats.running).toBe(2);
    expect(stats.totalPending).toBe(2);

    queue.clear();
  });

  it('should clear the queue', () => {
    queue.add(createMockRequest('sig1'));
    queue.add(createMockRequest('sig2'));

    queue.clear();

    expect(queue.getStats().queueSize).toBe(0);
    expect(queue.getStats().running).toBe(0);
    expect(queue.getPendingSignatures()).toHaveLength(0);
  });

  it('should calculate retry delay with exponential backoff', async () => {
    const request = createMockRequest('sig1');
    const promise = queue.add(request);

    // Get the item and mark it for retry
    const item = {
      id: 'test',
      request,
      retryCount: 1,
      firstAttemptAt: Date.now(),
      state: 'pending' as const,
      resolve: () => {},
      reject: () => {},
    };

    const retryPromise = queue.scheduleRetry(item, new Error('Test error'));

    expect(item.retryCount).toBe(2);
    expect(item.nextRetryAt).toBeDefined();
    expect(item.nextRetryAt! - Date.now()).toBeGreaterThan(1000); // At least 1s delay

    queue.clear();
  });

  it('should return null for max retry exceeded', () => {
    const item = {
      id: 'test',
      request: createMockRequest('sig1'),
      retryCount: 30000, // Max retry
      firstAttemptAt: Date.now(),
      state: 'pending' as const,
      resolve: () => {},
      reject: () => {},
    };

    const result = queue.scheduleRetry(item, new Error('Test'));

    expect(result).toBeNull();
  });
});
