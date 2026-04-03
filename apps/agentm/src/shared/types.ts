// ── Auth ──────────────────────────────────────────────────────────────

export interface AuthState {
    authenticated: boolean;
    publicKey: string | null;
    email: string | null;
    privyUserId: string | null;
}

export const EMPTY_AUTH: AuthState = {
    authenticated: false,
    publicKey: null,
    email: null,
    privyUserId: null,
};

// ── A2A Protocol (mirrored from magicblock-a2a.ts) ───────────────────

export interface MicropaymentPolicy {
    baseMicrolamports: number;
    perByteMicrolamports: number;
}

export interface A2AEnvelope {
    id: string;
    from: string;
    to: string;
    topic: string;
    message: string;
    createdAt: number;
    paymentMicrolamports: number;
}

export interface A2ADelivery {
    envelope: A2AEnvelope;
    direction: 'incoming' | 'outgoing';
    latencyMs: number;
    channel: string;
    receivedAt: number;
}

export interface SendInviteInput {
    to: string;
    topic: string;
    message: string;
}

// ── Chat (local storage) ─────────────────────────────────────────────

export interface Conversation {
    peerAddress: string;
    peerName: string | null;
    lastMessage: string;
    lastMessageAt: number;
    unreadCount: number;
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'failed';

export interface ChatMessage {
    id: string;
    peerAddress: string;
    direction: 'incoming' | 'outgoing';
    topic: string;
    message: string;
    paymentMicrolamports: number;
    status: MessageStatus;
    createdAt: number;
}

// ── Agent Discovery ──────────────────────────────────────────────────

export interface AgentDiscoveryRow {
    agent: string;
    weight: number;
    reputation: {
        global_avg_score: number;
        global_completed: number;
        global_total_applied: number;
        win_rate: number;
    } | null;
    // A2A multi-protocol fields
    capabilities?: string[];
    discoveredVia?: 'nostr' | 'libp2p' | 'magicblock' | 'webrtc' | 'cross-chain' | 'indexer' | 'both';
    displayName?: string;
    nostrPubkey?: string;
    libp2pPeerId?: string;
    multiaddrs?: string[];
}

// ── Agent Profile ───────────────────────────────────────────────────

export type ProfilePublishMode = 'manual' | 'git-sync';

export interface AgentProfileLinks {
    website?: string;
    github?: string;
    x?: string;
}

export interface AgentProfile {
    agent: string;
    displayName: string;
    bio: string;
    links: AgentProfileLinks;
    onchainRef: string | null;
    publishMode: ProfilePublishMode;
    updatedAt: number;
}

// ── Arena Task Flow (local workflow tracking) ───────────────────────

export type TaskFlowStatus =
    | 'available'
    | 'applied'
    | 'submitted'
    | 'won'
    | 'lost'
    | 'refunded';

export interface ArenaTaskSummary {
    taskId: number;
    poster: string;
    judge: string;
    reward: number;
    state: string;
    category: number;
    deadline: string;
    submissionCount: number;
    winner: string | null;
}

export interface TaskFlowRecord {
    taskId: number;
    status: TaskFlowStatus;
    appliedAt: number;
    updatedAt: number;
    resultRef: string | null;
    traceRef: string | null;
    lastKnownTaskState: string | null;
    winner: string | null;
}

// ── App Views ────────────────────────────────────────────────────────

export type ActiveView = 'me' | 'discover' | 'chat';

// ── Interoperability Status ─────────────────────────────────────────

export interface InteropStatusSnapshot {
    agent: string;
    identityRegistered: boolean;
    erc8004FeedbackCount: number;
    evmReputationCount: number;
    istranaFeedbackCount: number;
    attestationCount: number;
    identityRoleCounts: {
        winner: number;
        poster: number;
        judge: number;
        loser: number;
    };
    feedbackRoleCounts: {
        winner: number;
        poster: number;
        judge: number;
        loser: number;
    };
    lastTaskId: number | null;
    lastScore: number | null;
    lastChainTx: string | null;
    updatedAt: number;
}

export interface InteropSyncEvent {
    type: 'interop_sync';
    winner: string;
    taskId: number;
    score: number;
    category: number;
    chainTx: string;
    judgedAt: number;
    identityRegistered: boolean;
    feedbackTargets: string[];
    erc8004FeedbackPublished: boolean;
    evmReputationPublished?: boolean;
    istranaFeedbackPublished: boolean;
    attestationPublished: boolean;
    participants?: string[];
    identityRecipients?: string[];
    identityDispatches?: Array<{
        role: 'winner' | 'poster' | 'judge' | 'loser';
        agent: string;
    }>;
    feedbackPublishedCount?: number;
    feedbackRecipients?: Array<{
        sink: string;
        role: 'winner' | 'poster' | 'judge' | 'loser';
        agent: string;
    }>;
}

// ── Identity Registration (Metaplex / ERC-8004 relay) ──────────────

export type IdentityRegistrationState =
    | 'unknown'
    | 'pending'
    | 'registered'
    | 'failed'
    | 'disabled';

export interface IdentityRegistrationStatus {
    agent: string;
    state: IdentityRegistrationState;
    agentId: string | null;
    txHash: string | null;
    error: string | null;
    updatedAt: number;
}
