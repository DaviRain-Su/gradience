/**
 * A2A Circuit Breaker
 *
 * Implements the circuit breaker pattern to prevent cascade failures:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failures exceeded threshold, requests fail fast
 * - HALF_OPEN: Testing recovery, limited requests allowed
 *
 * @module a2a-router/circuit-breaker
 */

import { createLogger } from './logger.js';
import { getMetrics, A2A_METRICS } from './metrics.js';
import type { ProtocolType } from '../../shared/a2a-router-types.js';

const logger = createLogger('CircuitBreaker');
const metrics = getMetrics();

// ============ Circuit State Types ============

/** Circuit breaker states */
export type CircuitState = 'closed' | 'open' | 'half_open';

/** Circuit breaker event types */
export type CircuitEvent =
    | 'state_change'
    | 'success'
    | 'failure'
    | 'timeout'
    | 'rejected';

/** Circuit breaker configuration */
export interface CircuitBreakerConfig {
    /** Failure threshold to open circuit */
    failureThreshold: number;
    /** Success threshold to close circuit (in half-open state) */
    successThreshold: number;
    /** Time to wait before transitioning from open to half-open (ms) */
    resetTimeoutMs: number;
    /** Timeout for individual operations (ms) */
    operationTimeoutMs: number;
    /** Sliding window size for failure tracking */
    windowSize: number;
    /** Minimum number of calls before evaluating failure rate */
    minimumCalls: number;
    /** Failure rate threshold (0-1) */
    failureRateThreshold: number;
    /** Number of calls allowed in half-open state */
    halfOpenCalls: number;
}

/** Default circuit breaker configuration */
export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 5,
    successThreshold: 3,
    resetTimeoutMs: 30000,
    operationTimeoutMs: 10000,
    windowSize: 10,
    minimumCalls: 5,
    failureRateThreshold: 0.5,
    halfOpenCalls: 3,
};

/** Protocol-specific circuit configurations */
export const PROTOCOL_CIRCUIT_CONFIGS: Record<ProtocolType, Partial<CircuitBreakerConfig>> = {
    nostr: {
        failureThreshold: 3,
        resetTimeoutMs: 20000,
        operationTimeoutMs: 5000,
    },
    xmtp: {
        failureThreshold: 5,
        resetTimeoutMs: 30000,
        operationTimeoutMs: 15000,
    },
    'cross-chain': {
        failureThreshold: 3,
        resetTimeoutMs: 60000,
        operationTimeoutMs: 30000,
    },
    layerzero: {
        failureThreshold: 3,
        resetTimeoutMs: 60000,
        operationTimeoutMs: 30000,
    },
    wormhole: {
        failureThreshold: 3,
        resetTimeoutMs: 60000,
        operationTimeoutMs: 30000,
    },
    debridge: {
        failureThreshold: 3,
        resetTimeoutMs: 60000,
        operationTimeoutMs: 30000,
    },
    'google-a2a': {
        failureThreshold: 5,
        resetTimeoutMs: 30000,
        operationTimeoutMs: 10000,
    },
};

/** Circuit breaker statistics */
export interface CircuitStats {
    /** Current state */
    state: CircuitState;
    /** Total successful calls */
    totalSuccesses: number;
    /** Total failed calls */
    totalFailures: number;
    /** Total rejected calls (when open) */
    totalRejected: number;
    /** Consecutive successes (for half-open recovery) */
    consecutiveSuccesses: number;
    /** Consecutive failures */
    consecutiveFailures: number;
    /** Last failure timestamp */
    lastFailureAt?: number;
    /** Last success timestamp */
    lastSuccessAt?: number;
    /** State change timestamp */
    stateChangedAt: number;
    /** Failure rate in current window */
    failureRate: number;
}

/** Circuit event listener */
export type CircuitEventListener = (
    event: CircuitEvent,
    state: CircuitState,
    stats: CircuitStats
) => void;

// ============ Sliding Window ============

/**
 * Sliding window for tracking call outcomes
 */
class SlidingWindow {
    private outcomes: Array<{ success: boolean; timestamp: number }> = [];
    private windowSize: number;

    constructor(windowSize: number) {
        this.windowSize = windowSize;
    }

    record(success: boolean): void {
        this.outcomes.push({ success, timestamp: Date.now() });

        // Trim to window size
        if (this.outcomes.length > this.windowSize) {
            this.outcomes.shift();
        }
    }

    getStats(): { successes: number; failures: number; total: number; failureRate: number } {
        const successes = this.outcomes.filter((o) => o.success).length;
        const failures = this.outcomes.filter((o) => !o.success).length;
        const total = this.outcomes.length;
        const failureRate = total > 0 ? failures / total : 0;

        return { successes, failures, total, failureRate };
    }

    clear(): void {
        this.outcomes = [];
    }
}

// ============ Circuit Breaker Implementation ============

/**
 * Circuit Breaker for fault tolerance
 *
 * Usage:
 * ```typescript
 * const breaker = new CircuitBreaker('nostr');
 * const result = await breaker.execute(() => sendMessage());
 * ```
 */
export class CircuitBreaker {
    private state: CircuitState = 'closed';
    private config: CircuitBreakerConfig;
    private name: string;

    // Statistics
    private totalSuccesses = 0;
    private totalFailures = 0;
    private totalRejected = 0;
    private consecutiveSuccesses = 0;
    private consecutiveFailures = 0;
    private lastFailureAt?: number;
    private lastSuccessAt?: number;
    private stateChangedAt: number;

    // Sliding window
    private window: SlidingWindow;

    // Half-open tracking
    private halfOpenCalls = 0;

    // Reset timer
    private resetTimer?: NodeJS.Timeout;

    // Event listeners
    private listeners: CircuitEventListener[] = [];

    constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
        this.name = name;
        this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
        this.stateChangedAt = Date.now();
        this.window = new SlidingWindow(this.config.windowSize);

        // Register metrics
        metrics.gauge('a2a_circuit_state', `Circuit breaker state for ${name}`);
        metrics.counter('a2a_circuit_state_changes', 'Circuit breaker state transitions');
    }

    // ============ Public Methods ============

    /**
     * Execute an operation through the circuit breaker
     */
    async execute<T>(operation: () => Promise<T>): Promise<T> {
        // Check if call is allowed
        if (!this.canExecute()) {
            this.totalRejected++;
            this.emit('rejected');
            throw new CircuitOpenError(this.name, this.getTimeUntilReset());
        }

        // Track half-open calls
        if (this.state === 'half_open') {
            this.halfOpenCalls++;
        }

        try {
            // Execute with timeout
            const result = await this.executeWithTimeout(operation);
            this.recordSuccess();
            return result;
        } catch (error) {
            this.recordFailure(error as Error);
            throw error;
        }
    }

    /**
     * Check if the circuit allows execution
     */
    canExecute(): boolean {
        switch (this.state) {
            case 'closed':
                return true;
            case 'open':
                return false;
            case 'half_open':
                return this.halfOpenCalls < this.config.halfOpenCalls;
        }
    }

    /**
     * Get current circuit state
     */
    getState(): CircuitState {
        return this.state;
    }

    /**
     * Get circuit statistics
     */
    getStats(): CircuitStats {
        const windowStats = this.window.getStats();

        return {
            state: this.state,
            totalSuccesses: this.totalSuccesses,
            totalFailures: this.totalFailures,
            totalRejected: this.totalRejected,
            consecutiveSuccesses: this.consecutiveSuccesses,
            consecutiveFailures: this.consecutiveFailures,
            lastFailureAt: this.lastFailureAt,
            lastSuccessAt: this.lastSuccessAt,
            stateChangedAt: this.stateChangedAt,
            failureRate: windowStats.failureRate,
        };
    }

    /**
     * Force the circuit to a specific state (for testing/admin)
     */
    forceState(state: CircuitState): void {
        const oldState = this.state;
        this.transitionTo(state);
        logger.warn(`Circuit ${this.name} forced from ${oldState} to ${state}`);
    }

    /**
     * Reset the circuit to closed state
     */
    reset(): void {
        this.transitionTo('closed');
        this.totalSuccesses = 0;
        this.totalFailures = 0;
        this.totalRejected = 0;
        this.consecutiveSuccesses = 0;
        this.consecutiveFailures = 0;
        this.halfOpenCalls = 0;
        this.window.clear();

        if (this.resetTimer) {
            clearTimeout(this.resetTimer);
            this.resetTimer = undefined;
        }

        logger.info(`Circuit ${this.name} reset`);
    }

    /**
     * Add event listener
     */
    on(listener: CircuitEventListener): () => void {
        this.listeners.push(listener);
        return () => {
            const idx = this.listeners.indexOf(listener);
            if (idx > -1) {
                this.listeners.splice(idx, 1);
            }
        };
    }

    /**
     * Get time until circuit resets (ms), or 0 if not open
     */
    getTimeUntilReset(): number {
        if (this.state !== 'open') {
            return 0;
        }

        const elapsed = Date.now() - this.stateChangedAt;
        return Math.max(0, this.config.resetTimeoutMs - elapsed);
    }

    // ============ Private Methods ============

    private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
        return Promise.race([
            operation(),
            new Promise<never>((_, reject) => {
                setTimeout(() => {
                    this.emit('timeout');
                    reject(new Error(`Circuit breaker timeout after ${this.config.operationTimeoutMs}ms`));
                }, this.config.operationTimeoutMs);
            }),
        ]);
    }

    private recordSuccess(): void {
        this.totalSuccesses++;
        this.consecutiveSuccesses++;
        this.consecutiveFailures = 0;
        this.lastSuccessAt = Date.now();
        this.window.record(true);

        this.emit('success');

        // Check for recovery in half-open state
        if (this.state === 'half_open') {
            if (this.consecutiveSuccesses >= this.config.successThreshold) {
                this.transitionTo('closed');
            }
        }
    }

    private recordFailure(error: Error): void {
        this.totalFailures++;
        this.consecutiveFailures++;
        this.consecutiveSuccesses = 0;
        this.lastFailureAt = Date.now();
        this.window.record(false);

        logger.debug(`Circuit ${this.name} failure: ${error.message}`);
        this.emit('failure');

        // Check for state transitions
        if (this.state === 'closed') {
            const windowStats = this.window.getStats();

            // Check failure threshold
            if (this.consecutiveFailures >= this.config.failureThreshold) {
                this.transitionTo('open');
            }
            // Check failure rate (if minimum calls met)
            else if (
                windowStats.total >= this.config.minimumCalls &&
                windowStats.failureRate >= this.config.failureRateThreshold
            ) {
                this.transitionTo('open');
            }
        } else if (this.state === 'half_open') {
            // Any failure in half-open returns to open
            this.transitionTo('open');
        }
    }

    private transitionTo(newState: CircuitState): void {
        if (this.state === newState) return;

        const oldState = this.state;
        this.state = newState;
        this.stateChangedAt = Date.now();

        // Clear reset timer
        if (this.resetTimer) {
            clearTimeout(this.resetTimer);
            this.resetTimer = undefined;
        }

        // Reset counters on state change
        if (newState === 'closed') {
            this.consecutiveSuccesses = 0;
            this.consecutiveFailures = 0;
            this.halfOpenCalls = 0;
            this.window.clear();
        } else if (newState === 'half_open') {
            this.halfOpenCalls = 0;
            this.consecutiveSuccesses = 0;
        } else if (newState === 'open') {
            // Schedule transition to half-open
            this.resetTimer = setTimeout(() => {
                this.transitionTo('half_open');
            }, this.config.resetTimeoutMs);
        }

        // Update metrics
        const stateValue = newState === 'closed' ? 0 : newState === 'half_open' ? 1 : 2;
        metrics.set('a2a_circuit_state', stateValue, { circuit: this.name });
        metrics.inc('a2a_circuit_state_changes', 1, {
            circuit: this.name,
            from: oldState,
            to: newState,
        });

        logger.info(`Circuit ${this.name} transitioned: ${oldState} -> ${newState}`);
        this.emit('state_change');
    }

    private emit(event: CircuitEvent): void {
        const stats = this.getStats();
        for (const listener of this.listeners) {
            try {
                listener(event, this.state, stats);
            } catch (error) {
                logger.error('Circuit event listener error', {}, error as Error);
            }
        }
    }
}

// ============ Circuit Breaker Error ============

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
    constructor(
        public readonly circuitName: string,
        public readonly retryAfterMs: number
    ) {
        super(`Circuit breaker '${circuitName}' is open. Retry after ${retryAfterMs}ms`);
        this.name = 'CircuitOpenError';
    }
}

// ============ Circuit Breaker Registry ============

/**
 * Registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
    private breakers: Map<string, CircuitBreaker> = new Map();

    /**
     * Get or create a circuit breaker
     */
    get(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
        if (!this.breakers.has(name)) {
            this.breakers.set(name, new CircuitBreaker(name, config));
        }
        return this.breakers.get(name)!;
    }

    /**
     * Get circuit breaker for a protocol
     */
    forProtocol(protocol: ProtocolType): CircuitBreaker {
        const protocolConfig = PROTOCOL_CIRCUIT_CONFIGS[protocol];
        return this.get(`protocol:${protocol}`, protocolConfig);
    }

    /**
     * Get all circuit breaker stats
     */
    getAllStats(): Record<string, CircuitStats> {
        const stats: Record<string, CircuitStats> = {};
        for (const [name, breaker] of this.breakers) {
            stats[name] = breaker.getStats();
        }
        return stats;
    }

    /**
     * Reset all circuit breakers
     */
    resetAll(): void {
        for (const breaker of this.breakers.values()) {
            breaker.reset();
        }
    }

    /**
     * Check if any circuit is open
     */
    hasOpenCircuit(): boolean {
        for (const breaker of this.breakers.values()) {
            if (breaker.getState() === 'open') {
                return true;
            }
        }
        return false;
    }

    /**
     * Get list of open circuits
     */
    getOpenCircuits(): string[] {
        const open: string[] = [];
        for (const [name, breaker] of this.breakers) {
            if (breaker.getState() === 'open') {
                open.push(name);
            }
        }
        return open;
    }
}

/** Global circuit breaker registry */
let globalRegistry: CircuitBreakerRegistry | null = null;

export function getCircuitBreakerRegistry(): CircuitBreakerRegistry {
    if (!globalRegistry) {
        globalRegistry = new CircuitBreakerRegistry();
    }
    return globalRegistry;
}

export default {
    CircuitBreaker,
    CircuitBreakerRegistry,
    CircuitOpenError,
    getCircuitBreakerRegistry,
    DEFAULT_CIRCUIT_CONFIG,
    PROTOCOL_CIRCUIT_CONFIGS,
};
