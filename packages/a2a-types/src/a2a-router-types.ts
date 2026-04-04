/**
 * A2A Router Type Definitions
 *
 * Unified routing layer for multi-protocol A2A communication.
 * Shared between agent-daemon, agentm (Electron), and agentm-web.
 */

// ============ Protocol Types ============

export type ProtocolType = 'nostr' | 'xmtp' | 'google-a2a';

export type ProtocolPriority = 'broadcast' | 'discovery' | 'direct_message' | 'task_negotiation' | 'interop';

// ============ Message Types ============

export interface A2AMessage {
    id: string;
    from: string;
    to: string;
    type: A2AMessageType;
    timestamp: number;
    payload: unknown;
    protocol?: ProtocolType;
}

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
    | 'reputation_sync'
    | 'payment_request'
    | 'payment_confirm';

export interface A2AIntent {
    to: string;
    type: A2AMessageType;
    payload: unknown;
    preferredProtocol?: ProtocolType;
    requireReceipt?: boolean;
    timeout?: number;
}

export interface A2AResult {
    success: boolean;
    messageId: string;
    protocol: ProtocolType;
    error?: string;
    errorCode?: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

// ============ Discovery Types ============

export interface AgentFilter {
    capabilities?: string[];
    minReputation?: number;
    availableOnly?: boolean;
    limit?: number;
    soulType?: 'human' | 'agent';
    interestTags?: string[];
    soulVisibility?: 'public' | 'zk-selective' | 'private';
}

export interface AgentInfo {
    address: string;
    displayName: string;
    capabilities: string[];
    reputationScore: number;
    available: boolean;
    discoveredVia: ProtocolType;
    nostrPubkey?: string;
    googleA2AEndpoint?: string;
    multiaddrs?: string[];
    lastSeenAt: number;
}

// ============ Router Status ============

export interface RouterHealthStatus {
    initialized: boolean;
    availableProtocols: ProtocolType[];
    protocolStatus: Partial<Record<ProtocolType, ProtocolHealthStatus>>;
    totalPeers: number;
    activeSubscriptions: number;
    lastError?: string;
}

export interface ProtocolHealthStatus {
    available: boolean;
    peerCount: number;
    subscribedTopics: string[];
    lastActivityAt?: number;
    error?: string;
}

// ============ Adapter Interface ============

export interface ProtocolAdapter {
    readonly protocol: ProtocolType;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    isAvailable(): boolean;
    send(message: A2AMessage): Promise<A2AResult>;
    subscribe(handler: (message: A2AMessage) => void | Promise<void>): Promise<ProtocolSubscription>;
    discoverAgents(filter?: AgentFilter): Promise<AgentInfo[]>;
    broadcastCapabilities(capabilities: AgentInfo): Promise<void>;
    health(): ProtocolHealthStatus;
}

export interface ProtocolSubscription {
    unsubscribe(): Promise<void>;
    protocol: ProtocolType;
}

// ============ Router Options ============

export interface A2ARouterOptions {
    enableNostr?: boolean;
    nostrRelays?: string[];
    nostrPrivateKey?: string;
    enableXMTP?: boolean;
    xmtpEnv?: 'production' | 'dev';
    xmtpPrivateKey?: string;
    xmtpWalletSigner?: { getAddress(): Promise<string>; signMessage(message: string | Uint8Array): Promise<string> };
    agentId?: string;
    protocolPriority?: Record<ProtocolPriority, ProtocolType[]>;
    healthCheckInterval?: number;
    messageTimeout?: number;
}
