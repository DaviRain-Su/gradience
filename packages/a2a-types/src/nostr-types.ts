/**
 * Nostr type definitions for Gradience agent communication.
 * No runtime dependency on nostr-tools -- pure types.
 */

// ============ Nostr Event Base ============

export interface NostrEvent {
    kind: number;
    pubkey: string;
    created_at: number;
    content: string;
    tags: string[][];
    id?: string;
    sig?: string;
}

// ============ Agent Presence (kind 10002) ============

export interface AgentPresenceEvent extends NostrEvent {
    kind: 10002;
}

export interface SoulProfileMetadata {
    cid: string;
    type: 'human' | 'agent';
    embeddingHash: string;
    visibility: 'public' | 'zk-selective' | 'private';
    tags: string[];
}

export interface AgentPresenceContent {
    agent: string;
    display_name: string;
    capabilities: string[];
    reputation_score: number;
    available: boolean;
    endpoint?: string;
    soul?: SoulProfileMetadata;
}

// ============ Agent Capability (kind 10003) ============

export interface AgentCapabilityEvent extends NostrEvent {
    kind: 10003;
}

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

// ============ Reputation Proof (kind 10004) ============

export interface ReputationProofEvent extends NostrEvent {
    kind: 10004;
}

export interface ReputationProofContent {
    agent: string;
    reputation: {
        global_avg_score: number;
        global_completed: number;
        global_total_applied: number;
        win_rate: number;
    };
    proof: string;
    updated_at: number;
}

// ============ NIP-89: Handler Discovery (kind 31990) ============

export interface NIP89HandlerEvent extends NostrEvent {
    kind: 31990;
}

export interface NIP89HandlerContent {
    name: string;
    about?: string;
    picture?: string;
    kinds?: number[];
    pricing?: {
        type: 'free' | 'fixed' | 'dynamic';
        amount?: number;
        currency?: string;
    };
}

// ============ NIP-90: DVM (kind 5000-6999, 7000) ============

export interface NIP90JobRequest extends NostrEvent {
    kind: number; // 5000-5999
}

export interface NIP90JobResult extends NostrEvent {
    kind: number; // 6000-6999
}

export interface NIP90JobFeedback extends NostrEvent {
    kind: 7000;
}

export interface DVMFilter {
    kinds?: number[];
    minReputation?: number;
    maxPrice?: number;
}

// ============ Filters & Health ============

export interface PresenceFilter {
    capabilities?: string[];
    minReputation?: number;
    availableOnly?: boolean;
}

export interface RelayStatus {
    url: string;
    connected: boolean;
    latencyMs: number;
    lastConnectedAt?: number;
    errorCount: number;
}

export interface NostrHealthStatus {
    connected: boolean;
    relayCount: number;
    activeSubscriptions: number;
    lastEventAt?: number;
    relays: RelayStatus[];
}

export interface NostrSubscription {
    unsub: () => void;
}
