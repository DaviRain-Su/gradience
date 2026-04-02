// Shared types — aligned with apps/agentm/src/shared/types.ts

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
    publishMode: 'manual' | 'git-sync';
    updatedAt: number;
}

export interface ChatMessage {
    id: string;
    peerAddress: string;
    direction: 'incoming' | 'outgoing';
    topic: string;
    message: string;
    paymentMicrolamports: number;
    status: 'sending' | 'sent' | 'delivered' | 'failed';
    createdAt: number;
}

export interface Conversation {
    peerAddress: string;
    peerName: string | null;
    lastMessage: string;
    lastMessageAt: number;
    unreadCount: number;
}

export type ActiveView = 'me' | 'discover' | 'chat';
