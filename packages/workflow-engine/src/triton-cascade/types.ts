/**
 * Triton Cascade Integration - Type Definitions
 *
 * @module triton-cascade/types
 */

/**
 * Network type for Solana
 */
export type SolanaNetwork = 'mainnet' | 'devnet';

/**
 * Commitment level for transaction confirmation
 */
export type CommitmentLevel = 'processed' | 'confirmed' | 'finalized';

/**
 * Transaction type categorization
 */
export type TransactionType = 'swap' | 'transfer' | 'stake' | 'bridge' | 'other';

/**
 * Priority fee calculation strategy
 */
export type PriorityFeeStrategy = 'auto' | 'fixed' | 'none';

/**
 * Delivery path used for transaction submission
 */
export type DeliveryPath = 'cascade' | 'standard_rpc' | 'jito_bundle';

/**
 * Triton Cascade configuration
 */
export interface TritonCascadeConfig {
  /** Triton RPC endpoint */
  rpcEndpoint: string;
  /** Triton API Token for authentication and higher rate limits */
  apiToken?: string;
  /** Network type */
  network: SolanaNetwork;
  /** Connection timeout in milliseconds */
  connectionTimeoutMs: number;
  /** Transaction confirmation timeout in milliseconds */
  confirmationTimeoutMs: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Enable Jito Bundle for MEV protection */
  enableJitoBundle: boolean;
  /** Jito block engine URL (optional) */
  jitoBlockEngineUrl?: string;
  /** Priority fee calculation strategy */
  priorityFeeStrategy: PriorityFeeStrategy;
  /** Fixed priority fee in microLamports (when strategy is 'fixed') */
  fixedPriorityFeeLamports?: number;
  /** Maximum concurrent transactions */
  maxConcurrentTransactions: number;
}

/**
 * Transaction submission request
 */
export interface CascadeTransactionRequest {
  /** Serialized transaction (base64) */
  transaction: string;
  /** Transaction signature (for tracking) */
  signature: string;
  /** Recent blockhash */
  recentBlockhash: string;
  /** Last valid block height */
  lastValidBlockHeight: number;
  /** Sender public key */
  sender: string;
  /** Transaction type */
  transactionType: TransactionType;
  /** Use Jito Bundle for MEV protection */
  useJitoBundle?: boolean;
  /** Custom priority fee (microLamports) */
  priorityFee?: number;
  /** Metadata for tracking and logging */
  metadata?: Record<string, unknown>;
}

/**
 * Transaction submission response
 */
export interface CascadeTransactionResponse {
  /** Transaction signature */
  signature: string;
  /** Submission status */
  status: 'submitted' | 'confirmed' | 'failed';
  /** Confirmation result */
  confirmation?: {
    slot: number;
    confirmations: number;
    err: null | object;
  };
  /** Priority fee used (microLamports) */
  priorityFeeUsed: number;
  /** Submission timestamp */
  submittedAt: number;
  /** Confirmation timestamp */
  confirmedAt?: number;
  /** Error details (if status is 'failed') */
  error?: {
    code: string;
    message: string;
    logs?: string[];
  };
  /** Delivery path used */
  deliveryPath: DeliveryPath;
}

/**
 * Priority fee estimate
 */
export interface PriorityFeeEstimate {
  /** Recommended fee (microLamports) */
  recommended: number;
  /** Minimum fee */
  min: number;
  /** Medium fee */
  medium: number;
  /** High priority fee */
  high: number;
  /** Very high priority fee */
  veryHigh: number;
  /** Estimate timestamp */
  timestamp: number;
}

/**
 * Send transaction options
 */
export interface SendTransactionOptions {
  /** Transaction type */
  transactionType?: TransactionType;
  /** Use Jito Bundle for MEV protection */
  useJitoBundle?: boolean;
  /** Custom priority fee (microLamports) */
  priorityFee?: number;
  /** Commitment level for confirmation */
  commitment?: CommitmentLevel;
  /** Skip preflight simulation */
  skipPreflight?: boolean;
  /** Preflight commitment level */
  preflightCommitment?: CommitmentLevel;
  /** Maximum retry attempts (overrides config) */
  maxRetries?: number;
  /** Metadata for tracking */
  metadata?: Record<string, unknown>;
}

/**
 * Connection health status
 */
export interface ConnectionHealth {
  /** Endpoint URL */
  endpoint: string;
  /** Health status */
  isHealthy: boolean;
  /** Latency in milliseconds */
  latencyMs: number;
  /** Last check timestamp */
  lastCheckedAt: number;
  /** Consecutive failure count */
  consecutiveFailures: number;
  /** Success rate (last 100 requests) */
  successRate: number;
}

/**
 * Internal transaction queue item
 */
export interface TransactionQueueItem {
  /** Unique ID */
  id: string;
  /** Request data */
  request: CascadeTransactionRequest;
  /** Retry count */
  retryCount: number;
  /** First attempt timestamp */
  firstAttemptAt: number;
  /** Next retry timestamp */
  nextRetryAt?: number;
  /** Current state */
  state: TransactionState;
  /** Last error message */
  lastError?: string;
  /** Resolve function for promise */
  resolve: (value: CascadeTransactionResponse) => void;
  /** Reject function for promise */
  reject: (reason: Error) => void;
}

/**
 * Transaction state
 */
export type TransactionState =
  | 'pending'
  | 'submitting'
  | 'confirming'
  | 'completed'
  | 'failed';

/**
 * Jito Bundle configuration
 */
export interface JitoBundleConfig {
  /** Block engine URL */
  blockEngineUrl: string;
  /** Authentication keypair (optional) */
  authKeypair?: Uint8Array;
  /** Bundle timeout in milliseconds */
  bundleTimeoutMs: number;
}

/**
 * Jito Bundle response
 */
export interface JitoBundleResponse {
  /** Bundle UUID */
  bundleId: string;
  /** Bundle status */
  status: 'pending' | 'landed' | 'failed';
  /** Landed slot (if status is 'landed') */
  landedSlot?: number;
  /** Error message (if status is 'failed') */
  error?: string;
}

/**
 * RPC request payload
 */
export interface RpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: unknown[];
}

/**
 * RPC response payload
 */
export interface RpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Event types for transaction lifecycle
 */
export interface TransactionEvents {
  'transaction:submitted': {
    signature: string;
    deliveryPath: DeliveryPath;
    timestamp: number;
  };
  'transaction:confirmed': {
    signature: string;
    slot: number;
    confirmations: number;
  };
  'transaction:failed': {
    signature: string;
    error: Error;
    retryable: boolean;
  };
  'connection:health_changed': ConnectionHealth;
  'priority_fee:updated': {
    estimate: PriorityFeeEstimate;
  };
}

/**
 * Client metrics
 */
export interface ClientMetrics {
  /** Total transactions submitted */
  transactionsSubmitted: number;
  /** Total transactions confirmed */
  transactionsConfirmed: number;
  /** Total transactions failed */
  transactionsFailed: number;
  /** Total retries */
  totalRetries: number;
  /** Average latency (ms) */
  averageLatencyMs: number;
  /** Current queue size */
  queueSize: number;
}
