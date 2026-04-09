/**
 * A2A Rate Limiter
 *
 * Production-grade rate limiting for request throttling:
 * - Token bucket algorithm for smooth rate limiting
 * - Sliding window for burst control
 * - Per-protocol and per-peer limits
 * - Priority-based request queuing
 *
 * @module a2a-router/rate-limiter
 */

import { createLogger } from './logger.js';
import { getMetrics, A2A_METRICS } from './metrics.js';
import type { ProtocolType } from '@gradiences/a2a-types';

const logger = createLogger('RateLimiter');
const metrics = getMetrics();

// ============ Configuration Types ============

/** Rate limiter configuration */
export interface RateLimitConfig {
    /** Maximum requests per window */
    maxRequests: number;
    /** Window duration in milliseconds */
    windowMs: number;
    /** Burst allowance (additional requests above limit) */
    burstAllowance: number;
    /** Token refill rate per second */
    refillRate: number;
    /** Maximum queue size for pending requests */
    maxQueueSize: number;
    /** Request timeout when queued (ms) */
    queueTimeoutMs: number;
    /** Enable priority queueing */
    enablePriority: boolean;
}

/** Default rate limit configuration */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
    burstAllowance: 20,
    refillRate: 2, // 2 tokens/second
    maxQueueSize: 50,
    queueTimeoutMs: 30000,
    enablePriority: true,
};

/** Protocol-specific rate limits */
export const PROTOCOL_RATE_LIMITS: Record<ProtocolType, Partial<RateLimitConfig>> = {
    nostr: {
        maxRequests: 50,
        windowMs: 60000,
        burstAllowance: 10,
        refillRate: 1,
    },
    xmtp: {
        maxRequests: 100,
        windowMs: 60000,
        burstAllowance: 20,
        refillRate: 2,
    },
    'google-a2a': {
        maxRequests: 60,
        windowMs: 60000,
        burstAllowance: 15,
        refillRate: 1.5,
    },
};

/** Request priority levels */
export type RequestPriority = 'critical' | 'high' | 'normal' | 'low';

/** Priority weights (higher = more important) */
const PRIORITY_WEIGHTS: Record<RequestPriority, number> = {
    critical: 100,
    high: 75,
    normal: 50,
    low: 25,
};

// ============ Token Bucket Implementation ============

/**
 * Token bucket for rate limiting
 */
class TokenBucket {
    private tokens: number;
    private lastRefill: number;
    private readonly maxTokens: number;
    private readonly refillRate: number;

    constructor(maxTokens: number, refillRate: number) {
        this.maxTokens = maxTokens;
        this.tokens = maxTokens;
        this.refillRate = refillRate;
        this.lastRefill = Date.now();
    }

    /**
     * Try to consume tokens
     * @returns true if tokens were consumed
     */
    tryConsume(count: number = 1): boolean {
        this.refill();

        if (this.tokens >= count) {
            this.tokens -= count;
            return true;
        }

        return false;
    }

    /**
     * Get current token count
     */
    getTokens(): number {
        this.refill();
        return this.tokens;
    }

    /**
     * Get time until tokens are available (ms)
     */
    getWaitTime(count: number = 1): number {
        this.refill();

        if (this.tokens >= count) {
            return 0;
        }

        const needed = count - this.tokens;
        return Math.ceil((needed / this.refillRate) * 1000);
    }

    /**
     * Force refill (for testing/admin)
     */
    forceRefill(): void {
        this.tokens = this.maxTokens;
        this.lastRefill = Date.now();
    }

    private refill(): void {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000; // seconds
        const refillAmount = elapsed * this.refillRate;

        this.tokens = Math.min(this.maxTokens, this.tokens + refillAmount);
        this.lastRefill = now;
    }
}

// ============ Sliding Window Counter ============

/**
 * Sliding window for request counting
 */
class SlidingWindowCounter {
    private currentWindow: number = 0;
    private previousWindow: number = 0;
    private windowStart: number;
    private readonly windowMs: number;

    constructor(windowMs: number) {
        this.windowMs = windowMs;
        this.windowStart = Date.now();
    }

    /**
     * Increment the counter
     */
    increment(): void {
        this.slideWindow();
        this.currentWindow++;
    }

    /**
     * Get approximate count in sliding window
     */
    getCount(): number {
        this.slideWindow();

        const now = Date.now();
        const windowElapsed = now - this.windowStart;
        const previousWeight = 1 - windowElapsed / this.windowMs;

        return Math.floor(this.previousWindow * previousWeight + this.currentWindow);
    }

    /**
     * Reset counters
     */
    reset(): void {
        this.currentWindow = 0;
        this.previousWindow = 0;
        this.windowStart = Date.now();
    }

    private slideWindow(): void {
        const now = Date.now();

        if (now - this.windowStart >= this.windowMs) {
            // Move to next window
            this.previousWindow = this.currentWindow;
            this.currentWindow = 0;
            this.windowStart = now;
        }
    }
}

// ============ Rate Limiter Implementation ============

/** Queued request */
interface QueuedRequest<T> {
    id: string;
    operation: () => Promise<T>;
    priority: RequestPriority;
    enqueuedAt: number;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
}

/** Rate limiter statistics */
export interface RateLimiterStats {
    /** Requests allowed in current window */
    allowed: number;
    /** Requests rejected (rate limited) */
    rejected: number;
    /** Requests currently queued */
    queued: number;
    /** Current token count */
    tokens: number;
    /** Requests in sliding window */
    windowCount: number;
    /** Average wait time (ms) */
    avgWaitTimeMs: number;
}

/**
 * Rate limiter with token bucket and sliding window
 */
export class RateLimiter {
    private config: RateLimitConfig;
    private name: string;
    private bucket: TokenBucket;
    private window: SlidingWindowCounter;
    private queue: QueuedRequest<unknown>[] = [];
    private processing = false;

    // Statistics
    private allowed = 0;
    private rejected = 0;
    private totalWaitTime = 0;
    private waitCount = 0;

    constructor(name: string, config: Partial<RateLimitConfig> = {}) {
        this.name = name;
        this.config = { ...DEFAULT_RATE_LIMIT, ...config };

        const maxTokens = this.config.maxRequests + this.config.burstAllowance;
        this.bucket = new TokenBucket(maxTokens, this.config.refillRate);
        this.window = new SlidingWindowCounter(this.config.windowMs);

        // Register metrics
        metrics.gauge(A2A_METRICS.RATE_LIMITER_QUEUE_SIZE, `Rate limiter queue size for ${name}`);
        metrics.counter(A2A_METRICS.RATE_LIMITER_REJECTED, `Rate limiter rejections for ${name}`);
    }

    // ============ Public Methods ============

    /**
     * Check if request would be allowed (doesn't consume tokens)
     */
    canProceed(): boolean {
        const tokens = this.bucket.getTokens();
        const windowCount = this.window.getCount();

        return tokens >= 1 && windowCount < this.config.maxRequests + this.config.burstAllowance;
    }

    /**
     * Try to execute immediately, reject if rate limited
     */
    async tryExecute<T>(operation: () => Promise<T>): Promise<T> {
        if (!this.canProceed()) {
            this.rejected++;
            metrics.inc(A2A_METRICS.RATE_LIMITER_REJECTED, 1, { limiter: this.name });
            throw new RateLimitError(this.name, this.getWaitTime());
        }

        return this.execute(operation);
    }

    /**
     * Execute with queueing if rate limited
     */
    async execute<T>(
        operation: () => Promise<T>,
        options: { priority?: RequestPriority; timeout?: number } = {},
    ): Promise<T> {
        const priority = options.priority ?? 'normal';
        const timeout = options.timeout ?? this.config.queueTimeoutMs;

        // Try immediate execution
        if (this.bucket.tryConsume(1)) {
            this.window.increment();
            this.allowed++;
            return operation();
        }

        // Queue if allowed
        if (this.queue.length >= this.config.maxQueueSize) {
            this.rejected++;
            metrics.inc(A2A_METRICS.RATE_LIMITER_REJECTED, 1, { limiter: this.name });
            throw new RateLimitError(this.name, this.getWaitTime(), 'Queue full');
        }

        // Add to queue
        return new Promise((resolve, reject) => {
            const request: QueuedRequest<T> = {
                id: crypto.randomUUID(),
                operation,
                priority,
                enqueuedAt: Date.now(),
                resolve: resolve as (value: unknown) => void,
                reject,
            };

            this.enqueue(request as QueuedRequest<unknown>);

            // Set timeout
            setTimeout(() => {
                this.removeFromQueue(request.id);
                reject(new RateLimitError(this.name, 0, 'Queue timeout'));
            }, timeout);

            // Start processing queue
            this.processQueue();
        });
    }

    /**
     * Get current wait time (ms)
     */
    getWaitTime(): number {
        return this.bucket.getWaitTime(1);
    }

    /**
     * Get statistics
     */
    getStats(): RateLimiterStats {
        return {
            allowed: this.allowed,
            rejected: this.rejected,
            queued: this.queue.length,
            tokens: this.bucket.getTokens(),
            windowCount: this.window.getCount(),
            avgWaitTimeMs: this.waitCount > 0 ? this.totalWaitTime / this.waitCount : 0,
        };
    }

    /**
     * Reset the rate limiter
     */
    reset(): void {
        this.bucket.forceRefill();
        this.window.reset();
        this.allowed = 0;
        this.rejected = 0;
        this.totalWaitTime = 0;
        this.waitCount = 0;

        // Reject all queued requests
        for (const request of this.queue) {
            request.reject(new Error('Rate limiter reset'));
        }
        this.queue = [];

        logger.info(`Rate limiter ${this.name} reset`);
    }

    // ============ Private Methods ============

    private enqueue(request: QueuedRequest<unknown>): void {
        if (!this.config.enablePriority) {
            this.queue.push(request);
            return;
        }

        // Insert by priority
        const weight = PRIORITY_WEIGHTS[request.priority];
        const insertIdx = this.queue.findIndex((r) => PRIORITY_WEIGHTS[r.priority] < weight);

        if (insertIdx === -1) {
            this.queue.push(request);
        } else {
            this.queue.splice(insertIdx, 0, request);
        }

        metrics.set(A2A_METRICS.RATE_LIMITER_QUEUE_SIZE, this.queue.length, { limiter: this.name });
    }

    private removeFromQueue(id: string): boolean {
        const idx = this.queue.findIndex((r) => r.id === id);
        if (idx > -1) {
            this.queue.splice(idx, 1);
            metrics.set(A2A_METRICS.RATE_LIMITER_QUEUE_SIZE, this.queue.length, { limiter: this.name });
            return true;
        }
        return false;
    }

    private async processQueue(): Promise<void> {
        if (this.processing) return;
        this.processing = true;

        while (this.queue.length > 0) {
            const waitTime = this.bucket.getWaitTime(1);

            if (waitTime > 0) {
                await new Promise((resolve) => setTimeout(resolve, waitTime));
            }

            if (this.queue.length === 0) break;

            // Try to consume token
            if (!this.bucket.tryConsume(1)) {
                continue;
            }

            // Dequeue and execute
            const request = this.queue.shift()!;
            metrics.set(A2A_METRICS.RATE_LIMITER_QUEUE_SIZE, this.queue.length, { limiter: this.name });

            const waitedMs = Date.now() - request.enqueuedAt;
            this.totalWaitTime += waitedMs;
            this.waitCount++;

            this.window.increment();
            this.allowed++;

            // Execute without blocking queue processing
            (async () => {
                try {
                    const result = await request.operation();
                    request.resolve(result);
                } catch (error) {
                    request.reject(error as Error);
                }
            })();
        }

        this.processing = false;
    }
}

// ============ Rate Limit Error ============

/**
 * Error thrown when rate limited
 */
export class RateLimitError extends Error {
    constructor(
        public readonly limiterName: string,
        public readonly retryAfterMs: number,
        reason?: string,
    ) {
        super(
            reason
                ? `Rate limited by '${limiterName}': ${reason}. Retry after ${retryAfterMs}ms`
                : `Rate limited by '${limiterName}'. Retry after ${retryAfterMs}ms`,
        );
        this.name = 'RateLimitError';
    }
}

// ============ Rate Limiter Registry ============

/**
 * Registry for managing multiple rate limiters
 */
export class RateLimiterRegistry {
    private limiters: Map<string, RateLimiter> = new Map();

    /**
     * Get or create a rate limiter
     */
    get(name: string, config?: Partial<RateLimitConfig>): RateLimiter {
        if (!this.limiters.has(name)) {
            this.limiters.set(name, new RateLimiter(name, config));
        }
        return this.limiters.get(name)!;
    }

    /**
     * Get rate limiter for a protocol
     */
    forProtocol(protocol: ProtocolType): RateLimiter {
        const protocolConfig = PROTOCOL_RATE_LIMITS[protocol];
        return this.get(`protocol:${protocol}`, protocolConfig);
    }

    /**
     * Get rate limiter for a peer
     */
    forPeer(peerId: string, config?: Partial<RateLimitConfig>): RateLimiter {
        return this.get(`peer:${peerId}`, config ?? { maxRequests: 30, windowMs: 60000 });
    }

    /**
     * Get all rate limiter stats
     */
    getAllStats(): Record<string, RateLimiterStats> {
        const stats: Record<string, RateLimiterStats> = {};
        Array.from(this.limiters.entries()).forEach(([name, limiter]) => {
            stats[name] = limiter.getStats();
        });
        return stats;
    }

    /**
     * Reset all rate limiters
     */
    resetAll(): void {
        Array.from(this.limiters.values()).forEach((limiter) => {
            limiter.reset();
        });
    }

    /**
     * Check if any limiter is rate limiting
     */
    isAnyLimiting(): boolean {
        return Array.from(this.limiters.values()).some((limiter) => !limiter.canProceed());
    }
}

/** Global rate limiter registry */
let globalRegistry: RateLimiterRegistry | null = null;

export function getRateLimiterRegistry(): RateLimiterRegistry {
    if (!globalRegistry) {
        globalRegistry = new RateLimiterRegistry();
    }
    return globalRegistry;
}

// ============ Convenience Decorators ============

/**
 * Create a rate-limited wrapper for an async function
 */
export function withRateLimit<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    limiterName: string,
    config?: Partial<RateLimitConfig>,
): T {
    const registry = getRateLimiterRegistry();
    const limiter = registry.get(limiterName, config);

    return (async (...args: Parameters<T>) => {
        return limiter.execute(() => fn(...args));
    }) as T;
}

export default {
    RateLimiter,
    RateLimiterRegistry,
    RateLimitError,
    getRateLimiterRegistry,
    withRateLimit,
    DEFAULT_RATE_LIMIT,
    PROTOCOL_RATE_LIMITS,
};
