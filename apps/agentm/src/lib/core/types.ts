/**
 * Core Integration Types
 *
 * Type definitions for AgentM Core SDK integration.
 * Bridges the Solana program SDK types with the React application.
 *
 * @module lib/core/types
 */

// ── Agent Types (from Core SDK) ─────────────────────────────────────

/** Agent type classification */
export type AgentType = 'task_executor' | 'social_agent' | 'trading_agent' | 'custom';

/** Input for updating user profile on-chain */
export interface UpdateProfileInput {
    displayName: string;
    bio?: string;
    avatarUrl?: string;
    updatedAt?: number;
}

/** Input for creating a new agent on-chain */
export interface CreateAgentInput {
    name: string;
    description?: string;
    agentType?: AgentType;
    config?: Uint8Array;
    createdAt?: number;
}

/** Input for updating agent configuration */
export interface UpdateAgentConfigInput {
    description: string;
    config?: Uint8Array;
    isActive?: boolean;
    updatedAt?: number;
}

/** Input for updating reputation */
export interface UpdateReputationInput {
    scoreBps: number;
    won: boolean;
    updatedAt?: number;
}

/** Decoded reputation account from on-chain data */
export interface ReputationAccount {
    agent: Uint8Array;
    totalReviews: number;
    avgScoreBps: number;
    completed: number;
    wins: number;
    winRateBps: number;
    updatedAt: number;
}

// ── Core Service Types ──────────────────────────────────────────────

/** Core service configuration */
export interface CoreConfig {
    /** Solana RPC endpoint */
    rpcEndpoint: string;
    /** Program ID for AgentM Core */
    programId: string;
    /** Network (devnet/mainnet) */
    network: 'devnet' | 'mainnet';
    /** Optional commitment level */
    commitment?: 'processed' | 'confirmed' | 'finalized';
}

/** Core service connection state */
export interface CoreConnectionState {
    /** Whether connected to the Solana network */
    connected: boolean;
    /** Whether connection is in progress */
    connecting: boolean;
    /** Current RPC endpoint */
    endpoint: string | null;
    /** Error message if any */
    error: string | null;
    /** Current slot */
    slot: number | null;
}

/** Agent account data (fetched from chain) */
export interface AgentAccountData {
    /** Agent public key */
    address: string;
    /** Agent owner */
    owner: string;
    /** Agent name */
    name: string;
    /** Agent description */
    description: string;
    /** Agent type */
    agentType: AgentType;
    /** Whether agent is active */
    isActive: boolean;
    /** Configuration data (JSON-encoded) */
    config: Record<string, unknown>;
    /** Created timestamp */
    createdAt: number;
    /** Last updated timestamp */
    updatedAt: number;
}

/** User profile data (fetched from chain) */
export interface UserProfileData {
    /** User public key */
    address: string;
    /** Username */
    username: string;
    /** Display name */
    displayName: string;
    /** Bio text */
    bio: string;
    /** Avatar URL */
    avatarUrl: string;
    /** Created timestamp */
    createdAt: number;
    /** Last updated timestamp */
    updatedAt: number;
}

/** Reputation data with derived metrics */
export interface ReputationData {
    /** Agent address */
    agent: string;
    /** Total number of reviews */
    totalReviews: number;
    /** Average score (0-100 scale) */
    avgScore: number;
    /** Average score in basis points (0-10000) */
    avgScoreBps: number;
    /** Total completed tasks */
    completed: number;
    /** Total wins */
    wins: number;
    /** Win rate (0-1) */
    winRate: number;
    /** Win rate in basis points (0-10000) */
    winRateBps: number;
    /** Last updated timestamp */
    updatedAt: number;
}

// ── Transaction Types ───────────────────────────────────────────────

/** Transaction status */
export type TransactionStatus =
    | 'pending'
    | 'processing'
    | 'confirmed'
    | 'finalized'
    | 'failed';

/** Transaction result */
export interface TransactionResult {
    /** Transaction signature */
    signature: string;
    /** Transaction status */
    status: TransactionStatus;
    /** Slot when confirmed */
    slot?: number;
    /** Error if failed */
    error?: string;
    /** Block time */
    blockTime?: number;
}

/** Pending transaction tracker */
export interface PendingTransaction {
    /** Transaction ID (signature) */
    id: string;
    /** Transaction type */
    type: 'register_user' | 'update_profile' | 'create_agent' | 'update_agent' | 'update_reputation';
    /** Transaction status */
    status: TransactionStatus;
    /** When transaction was submitted */
    submittedAt: number;
    /** Last status update */
    updatedAt: number;
    /** Error message if failed */
    error?: string;
}

// ── Core Context Types ──────────────────────────────────────────────

/** Core context value */
export interface CoreContextValue {
    /** Connection state */
    connectionState: CoreConnectionState;
    /** Current configuration */
    config: CoreConfig;
    /** Connect to Solana network */
    connect: () => Promise<void>;
    /** Disconnect from network */
    disconnect: () => void;
    /** Register a new user */
    registerUser: (username: string) => Promise<TransactionResult>;
    /** Update user profile */
    updateProfile: (input: UpdateProfileInput) => Promise<TransactionResult>;
    /** Create a new agent */
    createAgent: (input: CreateAgentInput) => Promise<TransactionResult>;
    /** Update agent configuration */
    updateAgentConfig: (agentAddress: string, input: UpdateAgentConfigInput) => Promise<TransactionResult>;
    /** Update agent reputation */
    updateReputation: (agentAddress: string, input: UpdateReputationInput) => Promise<TransactionResult>;
    /** Get user profile */
    getUserProfile: (address: string) => Promise<UserProfileData | null>;
    /** Get agent data */
    getAgent: (address: string) => Promise<AgentAccountData | null>;
    /** Get reputation data */
    getReputation: (agentAddress: string) => Promise<ReputationData | null>;
    /** List user's agents */
    listUserAgents: (ownerAddress: string) => Promise<AgentAccountData[]>;
    /** Pending transactions */
    pendingTransactions: PendingTransaction[];
    /** Whether any operation is loading */
    loading: boolean;
}

// ── Hook Return Types ───────────────────────────────────────────────

/** useCore hook return type */
export interface UseCoreResult {
    /** Core context value (throws if not in provider) */
    core: CoreContextValue;
    /** Whether core is available */
    available: boolean;
}

/** useAgent hook return type */
export interface UseAgentResult {
    /** Agent data */
    agent: AgentAccountData | null;
    /** Reputation data */
    reputation: ReputationData | null;
    /** Whether loading */
    loading: boolean;
    /** Error message */
    error: string | null;
    /** Refresh data */
    refresh: () => Promise<void>;
}

/** useProfile hook return type */
export interface UseProfileResult {
    /** Profile data */
    profile: UserProfileData | null;
    /** Whether loading */
    loading: boolean;
    /** Error message */
    error: string | null;
    /** Refresh data */
    refresh: () => Promise<void>;
    /** Update profile */
    update: (input: UpdateProfileInput) => Promise<TransactionResult>;
}

// ── Utility Types ───────────────────────────────────────────────────

/** Agent type display mapping */
export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
    task_executor: 'Task Executor',
    social_agent: 'Social Agent',
    trading_agent: 'Trading Agent',
    custom: 'Custom Agent',
};

/** Agent type description mapping */
export const AGENT_TYPE_DESCRIPTIONS: Record<AgentType, string> = {
    task_executor: 'Executes tasks in the Arena and earns rewards',
    social_agent: 'Engages in social interactions and content creation',
    trading_agent: 'Performs trading operations and market analysis',
    custom: 'Custom agent with user-defined capabilities',
};

/** Convert basis points to percentage (0-100) */
export function bpsToPercent(bps: number): number {
    return bps / 100;
}

/** Convert percentage (0-100) to basis points */
export function percentToBps(percent: number): number {
    return Math.round(percent * 100);
}

/** Convert basis points to ratio (0-1) */
export function bpsToRatio(bps: number): number {
    return bps / 10000;
}

/** Convert ratio (0-1) to basis points */
export function ratioToBps(ratio: number): number {
    return Math.round(ratio * 10000);
}
