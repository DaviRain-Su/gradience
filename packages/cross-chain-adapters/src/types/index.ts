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
