/**
 * A2A Router Module
 *
 * Production-grade A2A messaging router with:
 * - Circuit breaker for fault tolerance
 * - Health monitoring
 * - Metrics collection
 * - Rate limiting
 * - Error recovery
 * - Message validation
 *
 * @module a2a-router
 */

// Core router
export { A2ARouter } from './router.js';

// Circuit breaker
export {
  CircuitBreaker,
  CircuitBreakerRegistry,
  CircuitOpenError,
  getCircuitBreakerRegistry,
  DEFAULT_CIRCUIT_CONFIG,
  PROTOCOL_CIRCUIT_CONFIGS,
  type CircuitBreakerConfig,
  type CircuitState,
  type CircuitStats,
} from './circuit-breaker.js';

// Health monitoring
export {
  HealthMonitor,
  getHealthMonitor,
  createProtocolHealthCheck,
  type HealthCheckFn,
  type HealthCheckRegistration,
  type HealthCheckResult,
  type HealthStatus,
  type SystemHealth,
} from './health-monitor.js';

// Metrics
export {
  MetricsCollector,
  getMetrics,
  setMetrics,
  A2A_METRICS,
  recordMessageSend,
  recordMessageReceive,
  recordProtocolError,
  recordRetryAttempt,
  initMetrics,
  type MetricValue,
  type HistogramBucket,
  type HistogramValue,
  type Metric,
} from './metrics.js';

// Rate limiting
export {
  RateLimiter,
  RateLimiterRegistry,
  RateLimitError,
  getRateLimiterRegistry,
  withRateLimit,
  DEFAULT_RATE_LIMIT,
  PROTOCOL_RATE_LIMITS,
  type RateLimitConfig,
  type RequestPriority,
  type RateLimiterStats,
} from './rate-limiter.js';

// Error recovery
export {
  RecoveryManager,
  getRecoveryManager,
  classifyError,
  calculateBackoffDelay,
  sleep,
  withRetry,
  DEFAULT_RETRY_POLICY,
  AGGRESSIVE_RETRY_POLICY,
  CONSERVATIVE_RETRY_POLICY,
  type ErrorSeverity,
  type ClassifiedError,
  type RetryPolicy,
  type RetryContext,
  type RetryResult,
  type RecoveryStrategy,
} from './error-recovery.js';

// Validation
export {
  validateA2AMessage,
  isValidSolanaAddress,
  isValidMessageId,
  sanitizeString,
} from './validation.js';

// Constants
export { A2A_ERROR_CODES } from './constants.js';
