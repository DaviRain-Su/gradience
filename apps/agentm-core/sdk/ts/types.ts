export type AgentType = 'task_executor' | 'social_agent' | 'trading_agent' | 'custom';

export interface UpdateProfileInput {
    displayName: string;
    bio?: string;
    avatarUrl?: string;
    updatedAt?: number;
}

export interface CreateAgentInput {
    name: string;
    description?: string;
    agentType?: AgentType;
    config?: Uint8Array;
    createdAt?: number;
}

export interface UpdateAgentConfigInput {
    description: string;
    config?: Uint8Array;
    isActive?: boolean;
    updatedAt?: number;
}

export interface UpdateReputationInput {
    scoreBps: number;
    won: boolean;
    updatedAt?: number;
}

export interface ReputationAccount {
    agent: Uint8Array;
    totalReviews: number;
    avgScoreBps: number;
    completed: number;
    wins: number;
    winRateBps: number;
    updatedAt: number;
}
