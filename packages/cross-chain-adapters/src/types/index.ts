/**
 * Cross-Chain Adapters - Shared Types
 *
 * @module cross-chain-adapters/types
 */

// ============================================================================
// Protocol Adapter Interface (from A2A types)
// ============================================================================

export interface A2AMessage {
    id: string;
    from: string;
    to: string;
    protocol: string;
    timestamp: number;
    payload: unknown;
    signature?: string;
}

export interface A2AResult {
    success: boolean;
    messageId: string;
    protocol: string;
    timestamp: number;
    error?: string;
    errorCode?: string;
    metadata?: Record<string, unknown>;
}

export interface AgentInfo {
    id: string;
    name: string;
    capabilities: string[];
    reputationScore: number;
    supportedProtocols: string[];
}

export interface AgentFilter {
    capabilities?: string[];
    minReputationScore?: number;
    protocols?: string[];
}

export interface ProtocolSubscription {
    protocol: string;
    unsubscribe: () => Promise<void>;
}

export interface ProtocolHealthStatus {
    available: boolean;
    peerCount: number;
    subscribedTopics: string[];
    lastActivityAt?: number;
}

export interface ProtocolAdapter {
    readonly protocol: string;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    isAvailable(): boolean;
    send(message: A2AMessage): Promise<A2AResult>;
    subscribe(handler: (message: A2AMessage) => void | Promise<void>): Promise<ProtocolSubscription>;
    discoverAgents(filter?: AgentFilter): Promise<AgentInfo[]>;
    broadcastCapabilities(agentInfo: AgentInfo): Promise<void>;
    health(): ProtocolHealthStatus;
}

// ============================================================================
// Error Codes
// ============================================================================

export const CROSS_CHAIN_ERROR_CODES = {
    PROTOCOL_NOT_AVAILABLE: 'PROTOCOL_NOT_AVAILABLE',
    PROTOCOL_SEND_FAILED: 'PROTOCOL_SEND_FAILED',
    BRIDGE_NOT_CONNECTED: 'BRIDGE_NOT_CONNECTED',
    CHAIN_NOT_SUPPORTED: 'CHAIN_NOT_SUPPORTED',
    INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
    TIMEOUT: 'TIMEOUT',
    INVALID_MESSAGE: 'INVALID_MESSAGE',
    // LayerZero specific errors
    LZ_QUOTE_FAILED: 'LZ_QUOTE_FAILED',
    LZ_SEND_FAILED: 'LZ_SEND_FAILED',
    LZ_ENDPOINT_ERROR: 'LZ_ENDPOINT_ERROR',
    LZ_MESSAGE_TOO_LARGE: 'LZ_MESSAGE_TOO_LARGE',
    LZ_INVALID_EID: 'LZ_INVALID_EID',
    LZ_RETRY_EXHAUSTED: 'LZ_RETRY_EXHAUSTED',
    LZ_VERIFICATION_FAILED: 'LZ_VERIFICATION_FAILED',
    // Wormhole specific errors
    WH_QUOTE_FAILED: 'WH_QUOTE_FAILED',
    WH_SEND_FAILED: 'WH_SEND_FAILED',
    WH_VAA_VERIFICATION_FAILED: 'WH_VAA_VERIFICATION_FAILED',
    WH_GUARDIAN_RPC_ERROR: 'WH_GUARDIAN_RPC_ERROR',
    WH_MESSAGE_TOO_LARGE: 'WH_MESSAGE_TOO_LARGE',
    WH_CHAIN_NOT_SUPPORTED: 'WH_CHAIN_NOT_SUPPORTED',
    WH_RETRY_EXHAUSTED: 'WH_RETRY_EXHAUSTED',
    WH_REDEEM_FAILED: 'WH_REDEEM_FAILED',
    WH_FETCH_VAA_FAILED: 'WH_FETCH_VAA_FAILED',
    // DeBridge specific errors
    DB_QUOTE_FAILED: 'DB_QUOTE_FAILED',
    DB_SEND_FAILED: 'DB_SEND_FAILED',
    DB_SUBMISSION_FAILED: 'DB_SUBMISSION_FAILED',
    DB_ORDER_CREATION_FAILED: 'DB_ORDER_CREATION_FAILED',
    DB_MESSAGE_TOO_LARGE: 'DB_MESSAGE_TOO_LARGE',
    DB_CHAIN_NOT_SUPPORTED: 'DB_CHAIN_NOT_SUPPORTED',
    DB_RETRY_EXHAUSTED: 'DB_RETRY_EXHAUSTED',
    DB_CLAIM_FAILED: 'DB_CLAIM_FAILED',
    DB_LOCK_FAILED: 'DB_LOCK_FAILED',
    DB_MINT_FAILED: 'DB_MINT_FAILED',
} as const;

// ============================================================================
// Chain Configuration
// ============================================================================

export interface ChainConfig {
    name: string;
    chainId: number;
    rpcUrl: string;
    nativeCurrency: string;
    explorerUrl?: string;
}

export interface BridgeConfig {
    fromChain: string;
    toChain: string;
    contractAddress: string;
}

// ============================================================================
// Reputation Data Types
// ============================================================================

export interface TaskCompletion {
    taskId: string;
    taskType: 'coding' | 'audit' | 'design' | 'analysis' | 'review';
    completedAt: number;
    score: number;
    reward: string;
    evaluator: string;
    metadata: string; // IPFS hash or JSON string
}

export interface Attestation {
    attestationType: 'skill' | 'reliability' | 'quality' | 'communication';
    attester: string;
    value: number;
    timestamp: number;
    expiresAt: number;
}

export interface ChainScore {
    chain: string;
    value: number;
    weight: number;
    updatedAt: number;
}

export interface ReputationData {
    taskCompletions: TaskCompletion[];
    attestations: Attestation[];
    scores: ChainScore[];
}

// ============================================================================
// Bridge Result Types
// ============================================================================

export interface BridgeResult {
    txHash: string;
    messageId: string;
    status: 'pending' | 'completed' | 'failed';
    estimatedTime: number; // seconds
    submissionId?: string;
    /** VAA for Wormhole protocol */
    vaa?: VAA;
}

// ============================================================================
// LayerZero Specific Types
// ============================================================================

export type LayerZeroMessageStatus = 'pending' | 'inflight' | 'delivered' | 'failed' | 'confirmed';

export interface LayerZeroMessageReceipt {
    guid: string;
    srcEid: number;
    dstEid: number;
    sender: string;
    receiver: string;
    nonce: bigint;
    payloadHash: string;
    status: LayerZeroMessageStatus;
    blockConfirmations: number;
    timestamp: number;
}

export interface LayerZeroFeeQuote {
    nativeFee: bigint;
    lzTokenFee: bigint;
    gasLimit: bigint;
    options: string;
}

export interface LayerZeroConfig {
    // Endpoint IDs
    ethereum: { eid: number; endpoint: string };
    ethereumTestnet: { eid: number; endpoint: string };
    polygon: { eid: number; endpoint: string };
    polygonTestnet: { eid: number; endpoint: string };
    solana: { eid: number; endpoint: string };
    solanaDevnet: { eid: number; endpoint: string };
    sui: { eid: number; endpoint: string };
    suiTestnet: { eid: number; endpoint: string };
    near: { eid: number; endpoint: string };
    nearTestnet: { eid: number; endpoint: string };
}

// ============================================================================
// Retry Configuration
// ============================================================================

export interface RetryConfig {
    maxRetries: number;
    retryDelay: number; // milliseconds
    retryMultiplier: number;
    maxDelay: number; // milliseconds
    timeout: number; // milliseconds
}

// ============================================================================
// VAA Types (Wormhole)
// ============================================================================

export interface Signature {
    guardianIndex: number;
    signature: string;
}

export interface VAA {
    version: number;
    guardianSetIndex: number;
    signatures: Signature[];
    timestamp: number;
    nonce: number;
    emitterChain: number;
    emitterAddress: string;
    sequence: bigint;
    consistencyLevel: number;
    payload: string;
    hash: string;
}

// ============================================================================
// Wormhole Specific Types
// ============================================================================

export type WormholeMessageStatus = 'pending' | 'awaiting_signatures' | 'signed' | 'delivered' | 'failed';

export interface WormholeFeeQuote {
    /** Fee in native tokens (wei/lamports) */
    nativeFee: bigint;
    /** Gas limit for the transaction */
    gasLimit: bigint;
    /** Estimated time in seconds */
    estimatedTime: number;
}

export interface WormholeMessageReceipt {
    /** Unique sequence number */
    sequence: bigint;
    /** Emitter chain ID */
    emitterChain: number;
    /** Emitter address */
    emitterAddress: string;
    /** VAA hash */
    vaaHash: string;
    /** Current status */
    status: WormholeMessageStatus;
    /** Number of guardian signatures */
    signatureCount: number;
    /** Timestamp when message was sent */
    timestamp: number;
    /** Block number/height when message was sent */
    blockNumber?: bigint;
}

export interface WormholeConfig {
    // Chain IDs per Wormhole spec
    solana: { chainId: number; coreBridge: string; tokenBridge?: string };
    ethereum: { chainId: number; coreBridge: string; tokenBridge?: string };
    polygon: { chainId: number; coreBridge: string; tokenBridge?: string };
    bsc: { chainId: number; coreBridge: string; tokenBridge?: string };
    avalanche: { chainId: number; coreBridge: string; tokenBridge?: string };
    sui: { chainId: number; coreBridge: string; tokenBridge?: string };
    near: { chainId: number; coreBridge: string; tokenBridge?: string };
    // Testnets
    solanaDevnet: { chainId: number; coreBridge: string; tokenBridge?: string };
    ethereumTestnet: { chainId: number; coreBridge: string; tokenBridge?: string };
    polygonTestnet: { chainId: number; coreBridge: string; tokenBridge?: string };
}

// ============================================================================
// Submission Status (Debridge)
// ============================================================================

export interface SubmissionStatus {
    submissionId: string;
    status: 'pending' | 'claimed' | 'executed' | 'cancelled';
    sourceChain: string;
    targetChain: string;
    sender: string;
    receiver: string;
    amount: string;
    executionFee: string;
}

// ============================================================================
// DeBridge Specific Types
// ============================================================================

export type DeBridgeMessageStatus = 'pending' | 'sent' | 'confirmed' | 'executed' | 'failed';

export interface DeBridgeFeeQuote {
    /** Fixed protocol fee in native token (wei/lamports) */
    fixedFee: bigint;
    /** Execution fee for the transaction */
    executionFee: bigint;
    /** Total fee (fixed + execution) */
    totalFee: bigint;
    /** Gas limit for the transaction */
    gasLimit: bigint;
    /** Estimated time in seconds */
    estimatedTime: number;
}

export interface DeBridgeMessageReceipt {
    /** Submission ID from DeBridge */
    submissionId: string;
    /** Transaction hash on source chain */
    txHash: string;
    /** Source chain ID */
    sourceChainId: number;
    /** Target chain ID */
    targetChainId: number;
    /** Sender address */
    sender: string;
    /** Receiver address */
    receiver: string;
    /** Current status */
    status: DeBridgeMessageStatus;
    /** Timestamp when message was sent */
    timestamp: number;
    /** Block number on source chain */
    blockNumber?: bigint;
    /** Amount being transferred (if any) */
    amount?: string;
    /** Native fee paid */
    nativeFee?: string;
}

export interface DeBridgeOrder {
    /** Unique order ID */
    orderId: string;
    /** Order type: message, token, or both */
    orderType: 'message' | 'token' | 'message_and_token';
    /** Source chain ID */
    srcChainId: number;
    /** Destination chain ID */
    dstChainId: number;
    /** Token address on source chain */
    srcTokenAddress: string;
    /** Token amount on source chain */
    srcAmount: string;
    /** Token address on destination chain */
    dstTokenAddress: string;
    /** Expected amount on destination chain */
    dstAmount: string;
    /** Recipient address on destination chain */
    recipient: string;
    /** Order status */
    status: 'pending' | 'fulfilled' | 'cancelled' | 'expired';
    /** Creation timestamp */
    createdAt: number;
    /** Expiration timestamp */
    expiresAt: number;
}

export interface DeBridgeConfig {
    // Chain IDs per DeBridge spec
    ethereum: { chainId: number; gateway: string; treasury: string };
    polygon: { chainId: number; gateway: string; treasury: string };
    bsc: { chainId: number; gateway: string; treasury: string };
    solana: { chainId: number; gateway: string; treasury: string };
    arbitrum: { chainId: number; gateway: string; treasury: string };
    optimism: { chainId: number; gateway: string; treasury: string };
    // Testnets
    ethereumTestnet: { chainId: number; gateway: string; treasury: string };
    polygonTestnet: { chainId: number; gateway: string; treasury: string };
    solanaDevnet: { chainId: number; gateway: string; treasury: string };
}
