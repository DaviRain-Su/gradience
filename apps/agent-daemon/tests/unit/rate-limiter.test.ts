/**
 * Rate Limiter Unit Tests
 *
 * @module a2a-router/rate-limiter.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RateLimiter,
  RateLimiterRegistry,
  RateLimitError,
  DEFAULT_RATE_LIMIT,
} from '../../src/a2a-router/rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter('test', {
      maxRequests: 5,
      windowMs: 60000,
      burstAllowance: 2,
      refillRate: 1,
      maxQueueSize: 10,
      queueTimeoutMs: 1000,
      enablePriority: true,
    });
  });

  describe('Basic Operations', () => {
    it('should execute operations within limit', async () => {
      const results: number[] = [];

      for (let i = 0; i < 5; i++) {
        const result = await limiter.execute(async () => i);
        results.push(result);
      }

      expect(results).toEqual([0, 1, 2, 3, 4]);
    });

    it('should track stats correctly', async () => {
      await limiter.execute(async () => 'success');

      const stats = limiter.getStats();
      expect(stats.allowed).toBe(1);
      expect(stats.rejected).toBe(0);
    });
  });

  describe('Rate Limiting', () => {
    it('should reject when rate limit exceeded', async () => {
      // Use tryExecute which rejects immediately if rate limited
      for (let i = 0; i < 10; i++) {
        try {
          await limiter.tryExecute(async () => i);
        } catch (e) {
          expect(e).toBeInstanceOf(RateLimitError);
          return;
        }
      }

      // Should have been rate limited before this point
      expect(false).toBe('Expected rate limit error');
    });
  });

  describe('Queue Management', () => {
    it('should queue requests when limit reached', async () => {
      const results: string[] = [];

      // Execute multiple requests - some will queue
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          limiter.execute(async () => {
            results.push(`task-${i}`);
            return `result-${i}`;
          })
        );
      }

      await Promise.all(promises);
      expect(results.length).toBe(3);
    });
  });

  describe('Reset', () => {
    it('should reset all counters', async () => {
      await limiter.execute(async () => 'test');
      limiter.reset();

      const stats = limiter.getStats();
      expect(stats.allowed).toBe(0);
      expect(stats.tokens).toBeGreaterThan(0);
    });
  });
});

describe('RateLimiterRegistry', () => {
  let registry: RateLimiterRegistry;

  beforeEach(() => {
    registry = new RateLimiterRegistry();
  });

  it('should create and retrieve limiters', () => {
    const limiter = registry.get('test');
    expect(limiter).toBeInstanceOf(RateLimiter);
    expect(registry.get('test')).toBe(limiter);
  });

  it('should get all stats', () => {
    registry.get('limiter1');
    registry.get('limiter2');

    const stats = registry.getAllStats();
    expect(Object.keys(stats)).toHaveLength(2);
  });
});
