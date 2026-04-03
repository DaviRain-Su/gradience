/**
 * A2A Router Type Definitions
 *
 * Unified routing layer for multi-protocol A2A communication
 *
 * @module shared/a2a-router-types
 */

import type { NostrSubscription } from './nostr-types.js';
import type { Libp2pSubscription } from './libp2p-types.js';

// ============ Protocol Types ============

/** Supported transport protocols */
export type ProtocolType = 'nostr' | 'libp2p' | 'magicblock' | 'webrtc' | 'cross-chain' | 'layerzero';

/** Protocol priority for selection */
export type ProtocolPriority = 'broadcast' | 'direct_p2p' | 'paid_service' | 'offline_message';

// ============ Message Types ============

/** A2A message envelope */
export interface A2AMessage {
    /** Unique message ID */
    id: string;
    /** Sender address (Solana) */
    from: string;
    /** Recipient address (Solana) */
    to: string;
    /** Message type */
    type: A2AMessageType;
    /** Timestamp (Unix ms) */
    timestamp: number;
    /** Payload (type-specific) */
    payload: unknown;
    /** Protocol used for delivery */
    protocol?: ProtocolType;
}

/** A2A message types */
export type A2AMessageType =
    | 'capability_offer'
    | 'capability_query'
    | 'task_proposal'
    | 'task_accept'
    | 'task_reject'
    | 'task_counter'
    | 'direct_message'
    | 'reputation_query'
    | 'reputation_response'
    | 'payment_request'
    | 'payment_confirm';

/** A2A intent for sending messages */
export interface A2AIntent {
    /** Recipient address (Solana) */
    to: string;
    /** Message type */
    type: A2AMessageType;
    /** Payload */
    payload: unknown;
    /** Preferred protocol (optional) */
    preferredProtocol?: ProtocolType;
    /** Require receipt confirmation */
    requireReceipt?: boolean;
    /** Timeout (ms) */
    timeout?: number;
}

/** A2A send result */
export interface A2AResult {
    /** Success status */
    success: boolean;
    /** Message ID */
    messageId: string;
    /** Protocol used */
    protocol: ProtocolType;
    /** Error message (if failed) */
    error?: string;
    /** Error code */
    errorCode?: string;
    /** Timestamp */
    timestamp: number;
}

// ============ Discovery Types ============

/** Agent capability filter */
export interface AgentFilter {
    /** Required capabilities */
    capabilities?: string[];
    /** Minimum reputation score */
    minReputation?: number;
    /** Available only */
    availableOnly?: boolean;
    /** Maximum results */
    limit?: number;
}

/** Discovered agent info */
export interface AgentInfo {
    /** Solana address */
    address: string;
    /** Display name */
    displayName: string;
    /** Capabilities */
    capabilities: string[];
    /** Reputation score (0-10000) */
    reputationScore: number;
    /** Available for work */
    available: boolean;
    /** Discovery source protocol */
    discoveredVia: ProtocolType;
    /** Nostr pubkey (if available) */
    nostrPubkey?: string;
    /** libp2p peer ID (if available) */
    libp2pPeerId?: string;
    /** Multiaddrs for direct connection */
    multiaddrs?: string[];
    /** Last seen timestamp */
    lastSeenAt: number;
}

// ============ Router Status ============

/** Router health status */
export interface RouterHealthStatus {
    /** Router is initialized */
    initialized: boolean;
    /** Available protocols */
    availableProtocols: ProtocolType[];
    /** Protocol statuses */
    protocolStatus: Record<ProtocolType, ProtocolHealthStatus>;
    /** Total peers connected */
    totalPeers: number;
    /** Active subscriptions */
    activeSubscriptions: number;
    /** Last error (if any) */
    lastError?: string;
}

/** Protocol health status */
export interface ProtocolHealthStatus {
    /** Protocol is available */
    available: boolean;
    /** Connected peers count */
    peerCount: number;
    /** Subscribed topics */
    subscribedTopics: string[];
    /** Last activity timestamp */
    lastActivityAt?: number;
    /** Error message (if unhealthy) */
    error?: string;
}

// ============ Adapter Interface ============

/** Protocol adapter interface */
export interface ProtocolAdapter {
    /** Protocol type */
    readonly protocol: ProtocolType;

    /** Initialize the adapter */
    initialize(): Promise<void>;

    /** Shutdown the adapter */
    shutdown(): Promise<void>;

    /** Check if adapter is available */
    isAvailable(): boolean;

    /** Send message via this protocol */
    send(message: A2AMessage): Promise<A2AResult>;

    /** Subscribe to incoming messages */
    subscribe(
        handler: (message: A2AMessage) => void | Promise<void>
    ): Promise<ProtocolSubscription>;

    /** Discover agents */
    discoverAgents(filter?: AgentFilter): Promise<AgentInfo[]>;

    /** Broadcast capabilities */
    broadcastCapabilities(capabilities: AgentInfo): Promise<void>;

    /** Get health status */
    health(): ProtocolHealthStatus;
}

/** Protocol subscription handle */
export interface ProtocolSubscription {
    /** Unsubscribe */
    unsubscribe(): Promise<void>;
    /** Protocol type */
    protocol: ProtocolType;
}

// ============ Router Options ============

/** A2A Router options */
export interface A2ARouterOptions {
    /** Enable Nostr protocol */
    enableNostr?: boolean;
    /** Enable libp2p protocol */
    enableLibp2p?: boolean;
    /** Enable MagicBlock protocol */
    enableMagicBlock?: boolean;
    /** Nostr client options */
    nostrOptions?: {
        relays?: string[];
        privateKey?: string;
    };
    /** libp2p node options */
    libp2pOptions?: {
        bootstrapList?: string[];
        topics?: string[];
        dhtClientMode?: boolean;
        maxConnections?: number;
    };
    /** MagicBlock adapter options */
    magicblockOptions?: {
        agentId?: string;
        paymentPolicy?: {
            baseMicrolamports: number;
            perByteMicrolamports: number;
        };
    };
    /** Agent ID (required for MagicBlock) */
    agentId?: string;
    /** Protocol priority override */
    protocolPriority?: Record<ProtocolPriority, ProtocolType[]>;
    /** Health check interval (ms) */
    healthCheckInterval?: number;
    /** Message timeout (ms) */
    messageTimeout?: number;
}

// ============ Error Types ============

/** A2A error codes */
export const A2A_ERROR_CODES = {
    // Router errors
    ROUTER_NOT_INITIALIZED: 'ROUTER_001',
    ROUTER_ALREADY_INITIALIZED: 'ROUTER_002',
    ROUTER_NO_PROTOCOL_AVAILABLE: 'ROUTER_003',
    ROUTER_SEND_FAILED: 'ROUTER_004',
    ROUTER_DISCOVER_FAILED: 'ROUTER_005',

    // Protocol errors
    PROTOCOL_NOT_AVAILABLE: 'PROTOCOL_001',
    PROTOCOL_SEND_FAILED: 'PROTOCOL_002',
    PROTOCOL_SUBSCRIBE_FAILED: 'PROTOCOL_003',
    PROTOCOL_DISCOVER_FAILED: 'PROTOCOL_004',

    // Message errors
    MESSAGE_INVALID: 'MESSAGE_001',
    MESSAGE_TIMEOUT: 'MESSAGE_002',
    MESSAGE_REJECTED: 'MESSAGE_003',
} as const;

/** A2A error */
export class A2AError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly cause?: Error
    ) {
        super(message);
        this.name = 'A2AError';
    }
}
