import type { Address } from '@solana/kit';

// ── Profile Types ────────────────────────────────────────────────────────────

export interface AgentProfileLinks {
    website?: string;
    github?: string;
    x?: string;
}

export type ProfilePublishMode = 'manual' | 'git-sync';

export interface AgentProfileApi {
    agent: string;
    display_name: string;
    bio: string;
    links: AgentProfileLinks;
    onchain_ref: string | null;
    publish_mode: ProfilePublishMode;
    updated_at: number;
}

export interface AgentProfileUpdate {
    display_name: string;
    bio: string;
    links?: AgentProfileLinks;
}

// ── Reputation Types ─────────────────────────────────────────────────────────

export interface ReputationApi {
    agent: string;
    global_avg_score: number;
    global_win_rate: number;
    global_completed: number;
    global_total_applied: number;
    total_earned: number;
    updated_slot: number;
}

export interface ReputationCategoryOnChain {
    category: number;
    avgScore: number;
    completed: number;
}

export interface ReputationOnChain {
    agent: Address;
    totalEarned: bigint;
    completed: number;
    totalApplied: number;
    avgScore: number;
    winRate: number;
    byCategory: ReputationCategoryOnChain[];
    bump: number;
}
