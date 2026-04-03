export type ActiveView = 'dashboard' | 'profiles' | 'stats' | 'wallet' | 'settings';

export interface AuthState {
    authenticated: boolean;
    publicKey: string | null;
    email: string | null;
    privyUserId: string | null;
}

export type ProfileStatus = 'draft' | 'published' | 'deprecated';
export type PricingModel = 'fixed' | 'per_call' | 'per_token';

export interface Capability {
    id: string;
    name: string;
    description: string;
}

export interface Pricing {
    model: PricingModel;
    amount: number;
    currency: 'SOL';
}

export interface AgentProfile {
    id: string;
    did: string;
    owner: string;
    name: string;
    description: string;
    version: string;
    capabilities: Capability[];
    pricing: Pricing;
    tags: string[];
    website?: string;
    createdAt: number;
    updatedAt: number;
    status: ProfileStatus;
}

export interface ProfileDraft {
    name: string;
    description: string;
    version: string;
    capabilities: Capability[];
    pricing: Pricing;
    tags: string[];
    website?: string;
}

export interface ReputationData {
    avg_score: number;
    completed: number;
    total_applied: number;
    win_rate: number;
    total_earned: number;
}

export interface StatsSnapshot {
    reputation: ReputationData;
    source: 'live' | 'demo';
    updatedAt: number;
    monthlyRevenueLamports: number[];
}
