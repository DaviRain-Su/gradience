/** AgentM Core SDK types — mirrors on-chain program state */

export interface AgentAccount {
    owner: string;
    createdAt: number;
    status: 'active' | 'deactivated';
    metaplexMint: string | null;
}

export interface AgentProfileOnChain {
    agent: string;
    name: string;
    description: string;
    category: number;
    pricingModel: 'fixed' | 'per_call' | 'per_token';
    pricingAmount: number;
    website: string;
    reputationAvgScore: number;
    reputationCompleted: number;
    reputationWinRate: number;
    updatedAt: number;
}

export interface RegisterAgentInput {
    name: string;
    description: string;
    category: number;
    pricingModel: 'fixed' | 'per_call' | 'per_token';
    pricingAmount: number;
    website?: string;
}

export interface UpdateProfileInput {
    name: string;
    description: string;
    category: number;
    pricingModel: 'fixed' | 'per_call' | 'per_token';
    pricingAmount: number;
    website?: string;
}
