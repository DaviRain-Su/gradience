/**
 * Discovery Types
 *
 * Type definitions for agent search and discovery components
 *
 * @module components/social/discovery/types
 */

import type { DomainType, DomainInfo } from '../../profile/types.ts';

/** Search filter mode */
export type SearchMode = 'all' | 'domain' | 'capabilities' | 'reputation';

/** Domain search type */
export type DomainSearchType = 'sol' | 'eth' | 'ens' | 'bonfida' | 'all';

/** Reputation tier classification */
export type ReputationTier = 'all' | 'elite' | 'high' | 'medium' | 'low' | 'new';

/** Sort options for search results */
export type SortOption = 'relevance' | 'reputation' | 'followers' | 'recent';

/** Capability category */
export interface CapabilityTag {
    /** Unique capability identifier */
    id: string;
    /** Display label */
    label: string;
    /** Icon or emoji */
    icon?: string;
    /** Category grouping */
    category?: string;
}

/** Search query structure */
export interface SearchQuery {
    /** Free-text search term */
    term: string;
    /** Search mode filter */
    mode: SearchMode;
    /** Domain type filter */
    domainType?: DomainSearchType;
    /** Capability filters */
    capabilities?: string[];
    /** Minimum reputation score */
    minReputation?: number;
    /** Maximum reputation score */
    maxReputation?: number;
    /** Reputation tier filter */
    reputationTier?: ReputationTier;
    /** Sort order */
    sortBy: SortOption;
    /** Result offset for pagination */
    offset: number;
    /** Result limit */
    limit: number;
}

/** Default search query */
export const DEFAULT_SEARCH_QUERY: SearchQuery = {
    term: '',
    mode: 'all',
    sortBy: 'relevance',
    offset: 0,
    limit: 20,
};

/** Agent search result */
export interface AgentSearchResult {
    /** Agent wallet address */
    address: string;
    /** Display name */
    displayName?: string;
    /** Bio / description */
    bio?: string;
    /** Avatar URL */
    avatarUrl?: string;
    /** Linked domains */
    domains?: DomainInfo[];
    /** Primary domain for display */
    primaryDomain?: DomainInfo;
    /** Agent capabilities */
    capabilities?: string[];
    /** Reputation metrics */
    reputation?: AgentReputationInfo;
    /** Follower count */
    followerCount?: number;
    /** Following count */
    followingCount?: number;
    /** Whether the current user follows this agent */
    isFollowing?: boolean;
    /** Discovery source */
    discoveredVia?: 'nostr' | 'indexer' | 'chain' | 'search';
    /** Last activity timestamp */
    lastActiveAt?: number;
}

/** Agent reputation information */
export interface AgentReputationInfo {
    /** Global average score (0-100) */
    globalScore: number;
    /** Number of completed tasks */
    tasksCompleted: number;
    /** Total tasks applied for */
    totalApplied: number;
    /** Win rate percentage (0-100) */
    winRate: number;
    /** Reputation tier */
    tier: ReputationTier;
    /** Score trend direction */
    trend?: 'up' | 'down' | 'stable';
    /** Recent score change */
    recentChange?: number;
}

/** Search result metadata */
export interface SearchResultMeta {
    /** Total matching results */
    totalCount: number;
    /** Whether more results exist */
    hasMore: boolean;
    /** Search latency in ms */
    latencyMs: number;
    /** Search source */
    source: 'indexer' | 'local' | 'mixed';
}

/** Full search response */
export interface SearchResponse {
    /** Search results */
    results: AgentSearchResult[];
    /** Result metadata */
    meta: SearchResultMeta;
    /** Query that produced these results */
    query: SearchQuery;
}

/** Trending agent entry */
export interface TrendingAgent {
    /** Agent search result data */
    agent: AgentSearchResult;
    /** Trending rank (1 = most trending) */
    rank: number;
    /** Trending score metric */
    trendingScore: number;
    /** Trend reason */
    reason?: 'hot_streak' | 'new_arrival' | 'top_performer' | 'rising_star';
    /** Rank change from previous period */
    rankChange?: number;
}

/** Filter panel state */
export interface FilterState {
    /** Selected domain types */
    domainTypes: DomainSearchType[];
    /** Selected capabilities */
    capabilities: string[];
    /** Reputation tier filter */
    reputationTier: ReputationTier;
    /** Minimum reputation score */
    minReputation?: number;
    /** Maximum reputation score */
    maxReputation?: number;
    /** Only show verified agents */
    verifiedOnly: boolean;
    /** Only show agents with activity in last N days */
    activeWithinDays?: number;
}

/** Default filter state */
export const DEFAULT_FILTER_STATE: FilterState = {
    domainTypes: [],
    capabilities: [],
    reputationTier: 'all',
    verifiedOnly: false,
};

/** Reputation tier thresholds */
export const REPUTATION_TIER_THRESHOLDS: Record<ReputationTier, { min: number; max: number }> = {
    all: { min: 0, max: 100 },
    elite: { min: 90, max: 100 },
    high: { min: 70, max: 89 },
    medium: { min: 40, max: 69 },
    low: { min: 1, max: 39 },
    new: { min: 0, max: 0 },
};

/** Get reputation tier from score */
export function getReputationTier(score: number, hasActivity: boolean): ReputationTier {
    if (!hasActivity || score === 0) return 'new';
    if (score >= 90) return 'elite';
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
}

/** Common capability tags */
export const COMMON_CAPABILITIES: CapabilityTag[] = [
    { id: 'coding', label: 'Coding', icon: '💻', category: 'technical' },
    { id: 'writing', label: 'Writing', icon: '✍️', category: 'creative' },
    { id: 'design', label: 'Design', icon: '🎨', category: 'creative' },
    { id: 'research', label: 'Research', icon: '🔬', category: 'technical' },
    { id: 'trading', label: 'Trading', icon: '📈', category: 'defi' },
    { id: 'audit', label: 'Audit', icon: '🔍', category: 'technical' },
    { id: 'social', label: 'Social', icon: '🌐', category: 'community' },
    { id: 'analytics', label: 'Analytics', icon: '📊', category: 'technical' },
    { id: 'nft', label: 'NFT', icon: '🖼️', category: 'defi' },
    { id: 'defi', label: 'DeFi', icon: '💰', category: 'defi' },
];
