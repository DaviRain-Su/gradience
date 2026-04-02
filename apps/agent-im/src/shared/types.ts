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
}

// ── App Views ────────────────────────────────────────────────────────

export type ActiveView = 'me' | 'discover' | 'chat';

// ── Interoperability Status ─────────────────────────────────────────

export interface InteropStatusSnapshot {
    agent: string;
    identityRegistered: boolean;
    erc8004FeedbackCount: number;
    istranaFeedbackCount: number;
    attestationCount: number;
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
    istranaFeedbackPublished: boolean;
    attestationPublished: boolean;
}
