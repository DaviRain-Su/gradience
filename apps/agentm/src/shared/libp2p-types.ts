/**
 * libp2p Type Definitions
 * 
 * @module shared/libp2p-types
 */

import type { PeerId } from '@libp2p/interface';
import type { Multiaddr } from '@multiformats/multiaddr';

// ============ Message Types ============

/** Base message envelope for all libp2p messages */
export interface Libp2pMessage {
    /** Message type identifier */
    type: string;
    /** Sender peer ID */
    from: string;
    /** Timestamp (Unix ms) */
    timestamp: number;
    /** Payload (type-specific) */
    payload: unknown;
    /** Solana signature for authentication */
    signature?: string;
}

/** Agent capability announcement payload */
export interface CapabilityOfferPayload {
    /** Agent's Solana address */
    agent: string;
    /** Human-readable name */
    display_name: string;
    /** List of capabilities */
    capabilities: string[];
    /** Reputation score (0-10000) */
    reputation_score: number;
    /** Available for work */
    available: boolean;
    /** libp2p multiaddrs for direct connection */
    multiaddrs: string[];
    /** Nostr pubkey for fallback */
    nostr_pubkey?: string;
}

/** Capability announcement message */
export interface CapabilityOfferMessage extends Libp2pMessage {
    type: 'capability_offer';
    payload: CapabilityOfferPayload;
}

/** Direct message payload */
export interface DirectMessagePayload {
    /** Recipient Solana address */
    to: string;
    /** Message content */
    content: string;
    /** Message ID for deduplication */
    messageId: string;
    /** Reply to message ID (optional) */
    inReplyTo?: string;
}

/** Direct message */
export interface DirectMessage extends Libp2pMessage {
    type: 'direct_message';
    payload: DirectMessagePayload;
}

/** Task negotiation payload */
export interface TaskNegotiationPayload {
    /** Task ID */
    taskId: string;
    /** Negotiation type */
    action: 'propose' | 'accept' | 'reject' | 'counter';
    /** Terms (JSON-serialized) */
    terms: string;
    /** Proposed payment (micro-lamports) */
    payment?: number;
}

/** Task negotiation message */
export interface TaskNegotiationMessage extends Libp2pMessage {
    type: 'task_negotiation';
    payload: TaskNegotiationPayload;
}

// ============ Peer Types ============

/** Peer information */
export interface PeerInfo {
    /** libp2p peer ID */
    peerId: string;
    /** Solana address (verified) */
    solanaAddress?: string;
    /** Connection multiaddrs */
    multiaddrs: string[];
    /** Connected protocols */
    protocols: string[];
    /** Connection latency (ms) */
    latencyMs?: number;
    /** Connected timestamp */
    connectedAt: number;
    /** Last activity timestamp */
    lastSeenAt: number;
}

/** Discovered agent via libp2p */
export interface DiscoveredAgent {
    /** Solana address */
    address: string;
    /** Peer ID */
    peerId: string;
    /** Display name */
    displayName: string;
    /** Capabilities */
    capabilities: string[];
    /** Reputation score */
    reputationScore: number;
    /** Available for work */
    available: boolean;
    /** Direct connection addresses */
    multiaddrs: string[];
    /** Nostr fallback pubkey */
    nostrPubkey?: string;
    /** Discovery timestamp */
    discoveredAt: number;
}

// ============ Health & Status ============

/** libp2p node health status */
export interface Libp2pHealthStatus {
    /** Node is running */
    started: boolean;
    /** Peer ID */
    peerId: string;
    /** Listening addresses */
    listenAddrs: string[];
    /** Number of connected peers */
    peerCount: number;
    /** Number of subscribed topics */
    subscribedTopics: string[];
    /** DHT routing table size */
    dhtTableSize?: number;
    /** Last error (if any) */
    lastError?: string;
}

/** Connection status */
export interface ConnectionStatus {
    /** Peer ID */
    peerId: string;
    /** Connection state */
    state: 'connecting' | 'connected' | 'disconnecting' | 'disconnected';
    /** Direction: inbound or outbound */
    direction: 'inbound' | 'outbound';
    /** Connection latency (ms) */
    latencyMs?: number;
    /** Connected timestamp */
    connectedAt?: number;
}

// ============ DHT Types ============

/** DHT provider record */
export interface DHTProvider {
    /** Peer ID providing the content */
    peerId: string;
    /** Multiaddrs for connection */
    multiaddrs: string[];
}

/** Agent DHT record */
export interface AgentDHTRecord {
    /** Solana address (content ID) */
    solanaAddress: string;
    /** Agent info CID */
    cid: string;
    /** TTL in seconds */
    ttl: number;
}

// ============ Subscription Types ============

/** Message handler function */
export type MessageHandler<T = Libp2pMessage> = (message: T) => void | Promise<void>;

/** Subscription handle */
export interface Libp2pSubscription {
    /** Unsubscribe */
    unsubscribe(): void;
    /** Topic name */
    topic: string;
}

// ============ Options ============

/** Libp2pNode constructor options */
export interface Libp2pNodeOptions {
    /** Bootstrap nodes (defaults to LIBP2P_CONFIG) */
    bootstrapList?: string[];
    /** Topics to subscribe (defaults to LIBP2P_CONFIG) */
    topics?: string[];
    /** Solana private key for signing (optional) */
    solanaPrivateKey?: Uint8Array;
    /** Enable DHT client mode (default: true) */
    dhtClientMode?: boolean;
    /** Max connections (default: 50) */
    maxConnections?: number;
}

/** Dial options */
export interface DialOptions {
    /** Timeout in milliseconds */
    timeout?: number;
    /** Retry attempts */
    retries?: number;
}

/** Publish options */
export interface PublishOptions {
    /** Timeout in milliseconds */
    timeout?: number;
    /** Require receipt confirmation */
    requireReceipt?: boolean;
}
