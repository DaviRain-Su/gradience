/**
 * Triton Cascade Integration
 *
 * High-performance Solana transaction delivery through Triton One's Cascade network.
 *
 * @example
 * ```typescript
 * import { TritonCascadeClient } from '@gradience/triton-cascade';
 *
 * const client = new TritonCascadeClient({
 *   rpcEndpoint: 'https://api.triton.one/rpc',
 *   apiToken: process.env.TRITON_API_TOKEN,
 *   network: 'mainnet',
 *   enableJitoBundle: true,
 * });
 *
 * const response = await client.sendTransaction(transactionBase64, {
 *   transactionType: 'swap',
 *   useJitoBundle: true,
 * });
 *
 * console.log('Transaction confirmed:', response.signature);
 * ```
 *
 * @module triton-cascade
 */

// Export main client
export { TritonCascadeClient, createTritonCascadeClient } from './client.js';

// Export types
export type {
    TritonCascadeConfig,
    CascadeTransactionRequest,
    CascadeTransactionResponse,
    SendTransactionOptions,
    PriorityFeeEstimate,
    ConnectionHealth,
    ClientMetrics,
    TransactionType,
    PriorityFeeStrategy,
    CommitmentLevel,
    DeliveryPath,
    SolanaNetwork,
    JitoBundleConfig,
    JitoBundleResponse,
} from './types.js';

// Export errors
export {
    CascadeError,
    CascadeErrorCodes,
    isCascadeError,
    isRetryableError,
    createErrorFromRpcError,
    createErrorFromHttpResponse,
    type CascadeErrorCode,
} from './errors.js';

// Export config utilities
export {
    createDefaultConfig,
    createConfigFromEnv,
    validateConfig,
    mergeConfig,
    getJitoBlockEngineUrl,
    sanitizeConfigForLogging,
    DEFAULTS,
    ENDPOINTS,
} from './config.js';

// Export queue
export { TransactionQueue, type TransactionQueueOptions } from './queue.js';

// Export health monitor
export { HealthMonitor, type HealthMonitorOptions } from './health-monitor.js';

// Export fee estimator
export { FeeEstimator, type FeeEstimatorOptions } from './fee-estimator.js';

// Export Jito bundle client
export { JitoBundleClient } from './jito-bundle.js';
