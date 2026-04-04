/**
 * Nostr type definitions
 * 
 * @module shared/nostr-types
 */

import type { Event as NostrEventBase } from 'nostr-tools';

// Re-export nostr-tools Event type
export type { NostrEventBase };

/**
 * Agent presence event (kind 10002)
 * Broadcast agent availability and capabilities
 */
export interface AgentPresenceEvent {
    kind: 10002;
    pubkey: string;  // Agent's Nostr pubkey
    created_at: number;
    content: string;  // JSON stringified AgentPresenceContent
    tags: string[][];
    id?: string;
    sig?: string;
}

/**
 * Soul Profile metadata (for social matching)
 */
export interface SoulProfileMetadata {
    /** SOUL.md storage CID (IPFS/Arweave) */
    cid: string;
    /** Soul type: human or agent */
    type: 'human' | 'agent';
    /** Embedding hash for fast matching */
    embeddingHash: string;
    /** Privacy level */
    visibility: 'public' | 'zk-selective' | 'private';
    /** Interest tags for filtering (e.g., ['AI', 'blockchain', 'DeFi']) */
    tags: string[];
}

/**
 * Content of agent presence event
 */
export interface AgentPresenceContent {
    agent: string;           // Solana address
    display_name: string;
    capabilities: string[];  // e.g., ['defi', 'coding', 'writing']
    reputation_score: number;
    available: boolean;
    endpoint?: string;       // Optional: Agent endpoint URL
    
    /** Optional: Soul Profile for social matching */
    soul?: SoulProfileMetadata;
}

// NOTE: EncryptedDMEvent and EncryptedDMContent have been removed.
// NIP-04 DM functionality has been migrated to XMTP.

/**
 * Agent capability event (kind 10003)
 * Detailed capability declaration
 */
export interface AgentCapabilityEvent {
    kind: 10003;
    pubkey: string;
    created_at: number;
    content: string;  // JSON stringified AgentCapabilityContent
    tags: string[][];
    id?: string;
    sig?: string;
}

/**
 * Content of capability event
 */
export interface AgentCapabilityContent {
    agent: string;
    capabilities: Array<{
        name: string;
        description: string;
        pricing?: {
            type: 'fixed' | 'hourly' | 'per_task';
            amount: number;
            currency: string;
        };
    }>;
    updated_at: number;
}

/**
 * Reputation proof event (kind 10004)
 * On-chain reputation attestation
 */
export interface ReputationProofEvent {
    kind: 10004;
    pubkey: string;
    created_at: number;
    content: string;  // JSON stringified ReputationProofContent
    tags: string[][];
    id?: string;
    sig?: string;
}

/**
 * Content of reputation proof
 */
export interface ReputationProofContent {
    agent: string;
    reputation: {
        global_avg_score: number;
        global_completed: number;
        global_total_applied: number;
        win_rate: number;
    };
    proof: string;  // Solana signature or attestation hash
    updated_at: number;
}

/**
 * Filter for presence subscription/query
 */
export interface PresenceFilter {
    capabilities?: string[];
    minReputation?: number;
    availableOnly?: boolean;
}

/**
 * Nostr relay status
 */
export interface RelayStatus {
    url: string;
    connected: boolean;
    latencyMs: number;
    lastConnectedAt?: number;
    errorCount: number;
}

/**
 * Nostr client health status
 */
export interface NostrHealthStatus {
    connected: boolean;
    relayCount: number;
    activeSubscriptions: number;
    lastEventAt?: number;
    relays: RelayStatus[];
}

/**
 * Subscription handle
 */
export interface NostrSubscription {
    unsub: () => void;
}

// ============ NIP-89: Application Handler Discovery ============

/**
 * NIP-89 Application Handler event (kind 31990)
 * Declares application/service handlers
 */
export interface NIP89HandlerEvent {
    kind: 31990;
    pubkey: string;
    created_at: number;
    content: string;  // JSON stringified NIP89HandlerContent
    tags: string[][];  // [[\"d\", \"<handler-id>\"], [\"k\", \"<supported-kind>\"], ...]
    id?: string;
    sig?: string;
}

/**
 * Content of NIP-89 handler event
 */
export interface NIP89HandlerContent {
    /** Handler name */
    name: string;
    /** Handler description */
    about?: string;
    /** Picture/logo URL */
    picture?: string;
    /** Supported NIP-90 DVM kinds */
    kinds?: number[];
    /** Pricing information */
    pricing?: {
        type: 'free' | 'fixed' | 'dynamic';
        amount?: number;
        currency?: string;
    };
}

// ============ NIP-90: Data Vending Machines (DVM) ============

/**
 * NIP-90 Job Request event (kind 5000-5999)
 * Client requests a service from DVMs
 */
export interface NIP90JobRequest {
    kind: number;  // 5000-5999 based on job type
    pubkey: string;
    created_at: number;
    content: string;  // Job input data
    tags: string[][];  // [[\"i\", \"<input-url>\", \"<input-type>\"], [\"param\", \"<key>\", \"<value>\"], ...]
    id?: string;
    sig?: string;
}

/**
 * NIP-90 Job Result event (kind 6000-6999)
 * DVM returns job result
 */
export interface NIP90JobResult {
    kind: number;  // 6000-6999 (kind + 1000 from request)
    pubkey: string;
    created_at: number;
    content: string;  // Job result data
    tags: string[][];  // [[\"e\", \"<job-request-id>\"], [\"p\", \"<requester-pubkey>\"], [\"amount\", \"<msat>\"], ...]
    id?: string;
    sig?: string;
}

/**
 * NIP-90 Job Feedback event (kind 7000)
 * Client provides feedback on job result
 */
export interface NIP90JobFeedback {
    kind: 7000;
    pubkey: string;
    created_at: number;
    content: string;  // Feedback message
    tags: string[][];  // [[\"e\", \"<job-result-id>\"], [\"p\", \"<dvm-pubkey>\"], [\"status\", \"success|partial|error\"], ...]
    id?: string;
    sig?: string;
}

/**
 * Common NIP-90 job kinds (examples)
 */
export enum NIP90JobKind {
    // Text processing
    TextExtraction = 5000,
    Summarization = 5001,
    Translation = 5002,
    Classification = 5003,
    
    // Image/Video processing
    ImageGeneration = 5100,
    TextToSpeech = 5101,
    SpeechToText = 5102,
    
    // Gradience-specific (task matching, agent selection)
    AgentSelection = 5900,
    TaskMatching = 5901,
    ReputationQuery = 5902,
}

/**
 * NIP-90 DVM filter
 */
export interface DVMFilter {
    /** Job kinds to filter */
    kinds?: number[];
    /** Minimum reputation score */
    minReputation?: number;
    /** Pricing filter */
    maxPrice?: number;
}
