/**
 * OWS (Open Wallet Standard) Integration Types
 *
 * Type definitions for OWS wallet provider and reputation integration
 *
 * @module lib/ows/types
 */

/** Network configuration */
export type OWSNetwork = 'devnet' | 'mainnet';

/** Supported blockchain chains */
export type OWSChain = 'solana' | 'ethereum';

/** OWS Provider configuration */
export interface OWSConfig {
    /** Network to connect to */
    network: OWSNetwork;
    /** Default chain for operations */
    defaultChain: OWSChain;
    /** Optional: RPC endpoint for blockchain connection */
    rpcEndpoint?: string;
    /** Optional: API key for OWS services */
    apiKey?: string;
    /** Chain Hub indexer base URL */
    chainHubBaseUrl?: string;
}

/** OWS credential types */
export type OWSCredentialType = 'reputation' | 'task_completion' | 'agent_registration' | 'domain';

/** OWS Credential structure */
export interface OWSCredential {
    /** Credential type */
    type: OWSCredentialType;
    /** Issuer identifier */
    issuer: string;
    /** When the credential was issued (timestamp) */
    issuedAt: number;
    /** Optional expiration timestamp */
    expiresAt?: number;
    /** Credential data payload */
    data: Record<string, unknown>;
}

/** OWS Identity structure */
export interface OWSIdentity {
    /** Decentralized Identifier (DID) */
    did: string;
    /** Primary wallet address */
    address: string;
    /** Chain type */
    chain: OWSChain;
    /** Associated credentials */
    credentials: OWSCredential[];
}

/** OWS Wallet connection state */
export interface OWSWalletState {
    /** Whether connected to wallet */
    connected: boolean;
    /** Whether connection is in progress */
    connecting: boolean;
    /** Current identity if connected */
    identity: OWSIdentity | null;
    /** Error message if any */
    error: string | null;
}

/** Reputation data from Chain Hub */
export interface ReputationData {
    /** Agent address */
    agent: string;
    /** Global average score (0-100) */
    globalAvgScore: number;
    /** Global win rate (0-1) */
    globalWinRate: number;
    /** Total completed tasks */
    globalCompleted: number;
    /** Total tasks applied to */
    globalTotalApplied: number;
    /** Total earned (in lamports/wei) */
    totalEarned: number;
    /** Last updated slot */
    updatedSlot: number;
    /** Category-specific reputation */
    byCategory?: Record<string, CategoryReputation>;
}

/** Category-specific reputation */
export interface CategoryReputation {
    /** Average score in this category */
    avgScore: number;
    /** Completed tasks in this category */
    completed: number;
    /** Win rate in this category */
    winRate?: number;
}

/** Reputation tier based on score */
export type ReputationTier = 'legendary' | 'elite' | 'expert' | 'skilled' | 'novice' | 'unknown';

/** Reputation badge display data */
export interface ReputationBadgeData {
    /** Tier classification */
    tier: ReputationTier;
    /** Display score (formatted) */
    score: string;
    /** Number of completed tasks */
    completedTasks: number;
    /** Win rate as percentage string */
    winRate: string;
    /** Color theme for the tier */
    color: string;
    /** Icon for the tier */
    icon: string;
}

/** OWS Provider context value */
export interface OWSContextValue {
    /** Current wallet state */
    state: OWSWalletState;
    /** Connect to wallet */
    connect: () => Promise<OWSIdentity>;
    /** Disconnect from wallet */
    disconnect: () => Promise<void>;
    /** Sign a message */
    signMessage: (message: string) => Promise<string>;
    /** Get current reputation for connected wallet */
    getReputation: () => Promise<ReputationData | null>;
    /** Refresh reputation data */
    refreshReputation: () => Promise<void>;
    /** Current reputation data */
    reputation: ReputationData | null;
    /** Whether reputation is loading */
    reputationLoading: boolean;
    /** Configuration */
    config: OWSConfig;
}
