/**
 * A2A Error Recovery System
 *
 * Provides automatic recovery mechanisms for transient failures:
 * - Exponential backoff with jitter
 * - Configurable retry policies
 * - Error classification and recovery strategies
 *
 * @module a2a-router/error-recovery
 */

import { createLogger } from './logger.js';
import { A2A_ERROR_CODES } from './constants.js';

const logger = createLogger('ErrorRecovery');

// ============ Error Classification ============

/** Error severity levels */
export type ErrorSeverity = 'transient' | 'degraded' | 'fatal';

/** Classified error with recovery hints */
export interface ClassifiedError {
    /** Original error */
    error: Error;
    /** Error code (if available) */
    code?: string;
    /** Severity classification */
    severity: ErrorSeverity;
    /** Whether retry is recommended */
    retryable: boolean;
    /** Suggested wait time before retry (ms) */
    suggestedWaitMs?: number;
    /** Recovery action hint */
    recoveryHint?: string;
}

/** Error patterns for classification */
const ERROR_PATTERNS: Array<{
    pattern: RegExp | string;
    codes?: string[];
    severity: ErrorSeverity;
    retryable: boolean;
    recoveryHint?: string;
}> = [
    // Network errors (transient)
    {
        pattern: /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|socket hang up/i,
        severity: 'transient',
        retryable: true,
        recoveryHint: 'Network connectivity issue, retry with backoff',
    },
    // Rate limiting
    {
        pattern: /rate limit|too many requests|429/i,
        severity: 'transient',
        retryable: true,
        recoveryHint: 'Rate limited, wait longer before retry',
    },
    // Service unavailable
    {
        pattern: /503|502|504|service unavailable|gateway timeout/i,
        severity: 'transient',
        retryable: true,
        recoveryHint: 'Service temporarily unavailable',
    },
    // Protocol errors (retryable with different protocol)
    {
        codes: [
            A2A_ERROR_CODES.NOSTR_RELAY_UNAVAILABLE,
            A2A_ERROR_CODES.NOSTR_PUBLISH_FAILED,
        ],
        pattern: /relay|publish failed/i,
        severity: 'degraded',
        retryable: true,
        recoveryHint: 'Protocol issue, try alternative protocol',
    },
    // Authentication/authorization (not retryable)
    {
        pattern: /unauthorized|forbidden|401|403|invalid signature/i,
        severity: 'fatal',
        retryable: false,
        recoveryHint: 'Authentication failure, requires manual intervention',
    },
    // Invalid input (not retryable)
    {
        pattern: /invalid|malformed|bad request|400/i,
        severity: 'fatal',
        retryable: false,
        recoveryHint: 'Invalid request, check input parameters',
    },
];

/**
 * Classify an error for recovery decision making
 */
export function classifyError(error: Error, errorCode?: string): ClassifiedError {
    const errorMessage = error.message.toLowerCase();

    for (const pattern of ERROR_PATTERNS) {
        // Check by error code
        if (errorCode && pattern.codes?.includes(errorCode)) {
            return {
                error,
                code: errorCode,
                severity: pattern.severity,
                retryable: pattern.retryable,
                recoveryHint: pattern.recoveryHint,
            };
        }

        // Check by message pattern
        const regex = pattern.pattern instanceof RegExp
            ? pattern.pattern
            : new RegExp(pattern.pattern, 'i');

        if (regex.test(errorMessage)) {
            return {
                error,
                code: errorCode,
                severity: pattern.severity,
                retryable: pattern.retryable,
                recoveryHint: pattern.recoveryHint,
            };
        }
    }

    // Default to transient and retryable for unknown errors
    return {
        error,
        code: errorCode,
        severity: 'transient',
        retryable: true,
        recoveryHint: 'Unknown error, attempting recovery',
    };
}

// ============ Retry Configuration ============

/** Retry policy configuration */
export interface RetryPolicy {
    /** Maximum number of retry attempts */
    maxAttempts: number;
    /** Base delay between retries (ms) */
    baseDelayMs: number;
    /** Maximum delay between retries (ms) */
    maxDelayMs: number;
    /** Backoff multiplier */
    backoffMultiplier: number;
    /** Jitter factor (0-1) */
    jitterFactor: number;
    /** Timeout for individual operations (ms) */
    operationTimeoutMs?: number;
    /** Callback on each retry attempt */
    onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

/** Default retry policy */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    operationTimeoutMs: 30000,
};

/** Aggressive retry policy for critical operations */
export const AGGRESSIVE_RETRY_POLICY: RetryPolicy = {
    maxAttempts: 5,
    baseDelayMs: 500,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    jitterFactor: 0.2,
    operationTimeoutMs: 60000,
};

/** Conservative retry policy for non-critical operations */
export const CONSERVATIVE_RETRY_POLICY: RetryPolicy = {
    maxAttempts: 2,
    baseDelayMs: 2000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    operationTimeoutMs: 10000,
};

// ============ Retry Implementation ============

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateBackoffDelay(
    attempt: number,
    policy: RetryPolicy
): number {
    // Exponential backoff: baseDelay * (multiplier ^ attempt)
    const exponentialDelay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attempt);

    // Cap at maxDelay
    const cappedDelay = Math.min(exponentialDelay, policy.maxDelayMs);

    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * policy.jitterFactor * (Math.random() * 2 - 1);

    return Math.max(0, Math.floor(cappedDelay + jitter));
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry execution context */
export interface RetryContext {
    /** Current attempt number (0-based) */
    attempt: number;
    /** Total elapsed time (ms) */
    elapsedMs: number;
    /** Previous errors */
    errors: Error[];
    /** Whether operation was aborted */
    aborted: boolean;
}

/** Result of retry operation */
export interface RetryResult<T> {
    /** Whether operation succeeded */
    success: boolean;
    /** Result value (if successful) */
    value?: T;
    /** Final error (if failed) */
    error?: Error;
    /** Number of attempts made */
    attempts: number;
    /** Total time spent (ms) */
    totalTimeMs: number;
    /** Whether all retries were exhausted */
    exhausted: boolean;
}

/**
 * Execute an operation with automatic retry
 *
 * @param operation - Async operation to execute
 * @param policy - Retry policy configuration
 * @param abortSignal - Optional abort signal for cancellation
 * @returns Result of the retry operation
 */
export async function withRetry<T>(
    operation: (context: RetryContext) => Promise<T>,
    policy: RetryPolicy = DEFAULT_RETRY_POLICY,
    abortSignal?: AbortSignal
): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const errors: Error[] = [];
    let attempt = 0;

    while (attempt < policy.maxAttempts) {
        // Check for abort
        if (abortSignal?.aborted) {
            return {
                success: false,
                error: new Error('Operation aborted'),
                attempts: attempt,
                totalTimeMs: Date.now() - startTime,
                exhausted: false,
            };
        }

        const context: RetryContext = {
            attempt,
            elapsedMs: Date.now() - startTime,
            errors: [...errors],
            aborted: false,
        };

        try {
            // Execute with optional timeout
            let result: T;
            if (policy.operationTimeoutMs) {
                result = await Promise.race([
                    operation(context),
                    new Promise<never>((_, reject) => {
                        setTimeout(
                            () => reject(new Error(`Operation timeout after ${policy.operationTimeoutMs}ms`)),
                            policy.operationTimeoutMs
                        );
                    }),
                ]);
            } else {
                result = await operation(context);
            }

            return {
                success: true,
                value: result,
                attempts: attempt + 1,
                totalTimeMs: Date.now() - startTime,
                exhausted: false,
            };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            errors.push(err);

            // Classify error
            const classified = classifyError(err);

            logger.warn(`Retry attempt ${attempt + 1}/${policy.maxAttempts} failed`, {
                error: err.message,
                severity: classified.severity,
                retryable: classified.retryable,
                hint: classified.recoveryHint,
            });

            // Don't retry fatal errors
            if (!classified.retryable) {
                return {
                    success: false,
                    error: err,
                    attempts: attempt + 1,
                    totalTimeMs: Date.now() - startTime,
                    exhausted: false,
                };
            }

            // Calculate delay for next attempt
            if (attempt < policy.maxAttempts - 1) {
                const delayMs = calculateBackoffDelay(attempt, policy);

                if (policy.onRetry) {
                    policy.onRetry(attempt + 1, err, delayMs);
                }

                await sleep(delayMs);
            }

            attempt++;
        }
    }

    // All retries exhausted
    const lastError = errors[errors.length - 1] ?? new Error('Unknown error');

    return {
        success: false,
        error: lastError,
        attempts: attempt,
        totalTimeMs: Date.now() - startTime,
        exhausted: true,
    };
}

// ============ Recovery Strategies ============

/** Recovery strategy for protocol failures */
export interface RecoveryStrategy {
    /** Strategy name */
    name: string;
    /** Check if strategy applies to error */
    applies: (error: ClassifiedError) => boolean;
    /** Execute recovery action */
    recover: (error: ClassifiedError, context: unknown) => Promise<void>;
}

/**
 * Recovery strategy registry
 */
export class RecoveryManager {
    private strategies: RecoveryStrategy[] = [];
    private recoveryAttempts: Map<string, number> = new Map();
    private readonly maxRecoveryAttempts = 3;

    /**
     * Register a recovery strategy
     */
    register(strategy: RecoveryStrategy): void {
        this.strategies.push(strategy);
        logger.debug(`Registered recovery strategy: ${strategy.name}`);
    }

    /**
     * Attempt recovery for an error
     *
     * @returns true if recovery was attempted
     */
    async attemptRecovery(
        error: Error,
        errorCode?: string,
        context?: unknown
    ): Promise<boolean> {
        const classified = classifyError(error, errorCode);
        const errorKey = `${classified.code ?? error.message}`;

        // Check recovery attempt limit
        const attempts = this.recoveryAttempts.get(errorKey) ?? 0;
        if (attempts >= this.maxRecoveryAttempts) {
            logger.warn(`Max recovery attempts reached for: ${errorKey}`);
            return false;
        }

        // Find applicable strategy
        for (const strategy of this.strategies) {
            if (strategy.applies(classified)) {
                logger.info(`Applying recovery strategy: ${strategy.name}`, {
                    error: error.message,
                    attempt: attempts + 1,
                });

                try {
                    await strategy.recover(classified, context);
                    // Reset counter on successful recovery
                    this.recoveryAttempts.delete(errorKey);
                    return true;
                } catch (recoveryError) {
                    logger.error(
                        `Recovery strategy ${strategy.name} failed`,
                        { error: (recoveryError as Error).message },
                        recoveryError as Error
                    );
                    this.recoveryAttempts.set(errorKey, attempts + 1);
                }
            }
        }

        return false;
    }

    /**
     * Clear recovery attempt counters
     */
    resetCounters(): void {
        this.recoveryAttempts.clear();
    }
}

/** Global recovery manager instance */
let globalRecoveryManager: RecoveryManager | null = null;

export function getRecoveryManager(): RecoveryManager {
    if (!globalRecoveryManager) {
        globalRecoveryManager = new RecoveryManager();
    }
    return globalRecoveryManager;
}

// ============ Convenience Functions ============

/**
 * Execute an operation with retry and automatic error recovery
 */
export async function withRecovery<T>(
    operation: () => Promise<T>,
    options: {
        policy?: RetryPolicy;
        recoveryContext?: unknown;
        abortSignal?: AbortSignal;
    } = {}
): Promise<RetryResult<T>> {
    const policy = options.policy ?? DEFAULT_RETRY_POLICY;
    const recoveryManager = getRecoveryManager();

    return withRetry(
        async (ctx) => {
            try {
                return await operation();
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));

                // Attempt recovery between retries
                if (ctx.attempt > 0) {
                    await recoveryManager.attemptRecovery(err, undefined, options.recoveryContext);
                }

                throw err;
            }
        },
        policy,
        options.abortSignal
    );
}

export default {
    classifyError,
    calculateBackoffDelay,
    withRetry,
    withRecovery,
    getRecoveryManager,
    DEFAULT_RETRY_POLICY,
    AGGRESSIVE_RETRY_POLICY,
    CONSERVATIVE_RETRY_POLICY,
};
