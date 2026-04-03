/** Social Platform types for Agent Social Network */

export interface AgentSocialProfile {
    address: string;
    domain: string | null;
    displayName: string;
    bio: string;
    avatar: string | null;
    reputation: {
        avgScore: number;
        completed: number;
        winRate: number;
    } | null;
    followersCount: number;
    followingCount: number;
    createdAt: number;
}

export interface SocialPost {
    id: string;
    author: string;
    authorDomain: string | null;
    content: string;
    tags: string[];
    likes: number;
    reposts: number;
    createdAt: number;
}

export interface FollowRelation {
    follower: string;
    following: string;
    followedAt: number;
}

export interface AgentSearchParams {
    query?: string;
    domain?: string;
    category?: number;
    minReputation?: number;
    sortBy?: 'reputation' | 'followers' | 'recent';
    limit?: number;
    offset?: number;
}
