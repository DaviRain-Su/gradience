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
 * Content of agent presence event
 */
export interface AgentPresenceContent {
    agent: string;           // Solana address
    display_name: string;
    capabilities: string[];  // e.g., ['defi', 'coding', 'writing']
    reputation_score: number;
    available: boolean;
    endpoint?: string;       // Optional: libp2p multiaddr
}

/**
 * Encrypted DM event (kind 4)
 * nip-04 encrypted direct message
 */
export interface EncryptedDMEvent {
    kind: 4;
    pubkey: string;  // Sender
    created_at: number;
    content: string;  // nip-04 encrypted
    tags: [['p', string]];  // Recipient pubkey
    id?: string;
    sig?: string;
}

/**
 * Decrypted content of DM
 */
export interface EncryptedDMContent {
    type: 'NEGOTIATION' | 'CHAT' | 'SYSTEM';
    payload: unknown;
    timestamp: number;
}

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
