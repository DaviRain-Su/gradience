/**
 * TrendingAgents Component
 *
 * List component for displaying trending agents with ranking and metrics
 *
 * @module components/social/discovery/TrendingAgents
 */

import { useState, useCallback } from 'react';
import type { TrendingAgent, AgentSearchResult, ReputationTier } from './types.ts';
import { getReputationTier } from './types.ts';
import { AgentCard, CompactAgentCard } from './AgentCard.tsx';

export interface TrendingAgentsProps {
    /** Trending agents data */
    agents: TrendingAgent[];
    /** Title for the section */
    title?: string;
    /** Show full cards or compact list */
    variant?: 'cards' | 'list' | 'compact';
    /** Maximum number of agents to show */
    maxItems?: number;
    /** Whether data is loading */
    loading?: boolean;
    /** Error message if loading failed */
    error?: string | null;
    /** Callback when an agent is clicked */
    onAgentClick?: (agent: AgentSearchResult) => void;
    /** Callback when follow is triggered */
    onFollow?: (agent: AgentSearchResult) => Promise<void>;
    /** Callback when unfollow is triggered */
    onUnfollow?: (agent: AgentSearchResult) => Promise<void>;
    /** Callback to load more agents */
    onLoadMore?: () => Promise<void>;
    /** Whether more agents are loading */
    loadingMore?: boolean;
    /** Whether there are more agents to load */
    hasMore?: boolean;
    /** Additional CSS classes */
    className?: string;
}

/** Trend reason labels and icons */
const TREND_REASONS: Record<string, { label: string; icon: string; color: string }> = {
    hot_streak: { label: 'Hot Streak', icon: '🔥', color: 'text-orange-400' },
    new_arrival: { label: 'New Arrival', icon: '🌟', color: 'text-yellow-400' },
    top_performer: { label: 'Top Performer', icon: '🏆', color: 'text-amber-400' },
    rising_star: { label: 'Rising Star', icon: '📈', color: 'text-green-400' },
};

/** Reputation tier colors for rankings */
const RANK_COLORS: Record<number, string> = {
    1: 'bg-yellow-500 text-black',
    2: 'bg-gray-400 text-black',
    3: 'bg-amber-700 text-white',
};

/**
 * Format address for display
 */
function formatAddress(address: string, chars = 4): string {
    if (address.length <= chars * 2 + 3) return address;
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * TrendingAgents - Display trending agents with rankings
 *
 * Features:
 * - Ranked list with medals for top 3
 * - Trend reason badges
 * - Rank change indicators
 * - Multiple display variants
 * - Pagination support
 */
export function TrendingAgents({
    agents,
    title = 'Trending Agents',
    variant = 'list',
    maxItems = 10,
    loading = false,
    error = null,
    onAgentClick,
    onFollow,
    onUnfollow,
    onLoadMore,
    loadingMore = false,
    hasMore = false,
    className = '',
}: TrendingAgentsProps) {
    const displayAgents = agents.slice(0, maxItems);

    // Loading state
    if (loading) {
        return (
            <div className={`bg-gray-900 rounded-xl border border-gray-800 ${className}`}>
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h3 className="font-semibold text-white">{title}</h3>
                    <span className="text-xs text-gray-500">Loading...</span>
                </div>
                <div className="p-4 space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <TrendingAgentSkeleton key={i} rank={i + 1} />
                    ))}
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className={`bg-gray-900 rounded-xl border border-gray-800 p-4 ${className}`}>
                <h3 className="font-semibold text-white mb-3">{title}</h3>
                <p className="text-sm text-red-400">{error}</p>
            </div>
        );
    }

    // Empty state
    if (displayAgents.length === 0) {
        return (
            <div className={`bg-gray-900 rounded-xl border border-gray-800 p-6 text-center ${className}`}>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-500">No trending agents yet</p>
                <p className="text-xs text-gray-600 mt-1">Check back later for top performers</p>
            </div>
        );
    }

    return (
        <div className={`bg-gray-900 rounded-xl border border-gray-800 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🔥</span>
                    <h3 className="font-semibold text-white">{title}</h3>
                </div>
                <span className="text-xs text-gray-500">
                    {agents.length} agent{agents.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Content */}
            <div className="p-4">
                {variant === 'cards' ? (
                    <div className="grid gap-4 md:grid-cols-2">
                        {displayAgents.map((trending) => (
                            <div key={trending.agent.address} className="relative">
                                <RankBadge rank={trending.rank} rankChange={trending.rankChange} />
                                <AgentCard
                                    agent={trending.agent}
                                    onClick={onAgentClick}
                                    onFollow={onFollow}
                                    onUnfollow={onUnfollow}
                                    className="mt-2"
                                />
                            </div>
                        ))}
                    </div>
                ) : variant === 'compact' ? (
                    <div className="space-y-2">
                        {displayAgents.map((trending) => (
                            <TrendingAgentCompact
                                key={trending.agent.address}
                                trending={trending}
                                onClick={onAgentClick}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="divide-y divide-gray-800">
                        {displayAgents.map((trending) => (
                            <TrendingAgentRow
                                key={trending.agent.address}
                                trending={trending}
                                onClick={onAgentClick}
                                onFollow={onFollow}
                                onUnfollow={onUnfollow}
                            />
                        ))}
                    </div>
                )}

                {/* Load more */}
                {hasMore && onLoadMore && (
                    <button
                        onClick={() => void onLoadMore()}
                        disabled={loadingMore}
                        className="w-full mt-4 py-2 text-sm text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 rounded-lg transition disabled:opacity-50"
                    >
                        {loadingMore ? 'Loading...' : 'Show more'}
                    </button>
                )}
            </div>
        </div>
    );
}

/** Rank badge component */
interface RankBadgeProps {
    rank: number;
    rankChange?: number;
    className?: string;
}

function RankBadge({ rank, rankChange, className = '' }: RankBadgeProps) {
    const isTopThree = rank <= 3;
    const colorClass = RANK_COLORS[rank] || 'bg-gray-800 text-gray-300';

    return (
        <div className={`flex items-center gap-1 ${className}`}>
            <span
                className={`
                    w-6 h-6 rounded-full flex items-center justify-center
                    text-xs font-bold ${colorClass}
                `}
            >
                {isTopThree ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
            </span>
            {rankChange !== undefined && rankChange !== 0 && (
                <span className={`text-[10px] font-medium ${rankChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {rankChange > 0 ? `↑${rankChange}` : `↓${Math.abs(rankChange)}`}
                </span>
            )}
        </div>
    );
}

/** Trending agent row component */
interface TrendingAgentRowProps {
    trending: TrendingAgent;
    onClick?: (agent: AgentSearchResult) => void;
    onFollow?: (agent: AgentSearchResult) => Promise<void>;
    onUnfollow?: (agent: AgentSearchResult) => Promise<void>;
}

function TrendingAgentRow({ trending, onClick, onFollow, onUnfollow }: TrendingAgentRowProps) {
    const { agent, rank, rankChange, reason, trendingScore } = trending;
    const [isFollowing, setIsFollowing] = useState(agent.isFollowing ?? false);
    const [isLoading, setIsLoading] = useState(false);

    const tier = agent.reputation
        ? getReputationTier(agent.reputation.globalScore, agent.reputation.tasksCompleted > 0)
        : 'new';

    const displayName = agent.displayName || formatAddress(agent.address);
    const trendInfo = reason ? TREND_REASONS[reason] : null;

    const handleFollowClick = useCallback(
        async (e: React.MouseEvent) => {
            e.stopPropagation();
            if (isLoading) return;

            setIsLoading(true);
            try {
                if (isFollowing) {
                    await onUnfollow?.(agent);
                    setIsFollowing(false);
                } else {
                    await onFollow?.(agent);
                    setIsFollowing(true);
                }
            } finally {
                setIsLoading(false);
            }
        },
        [isLoading, isFollowing, onFollow, onUnfollow, agent],
    );

    return (
        <div
            onClick={() => onClick?.(agent)}
            className="flex items-center gap-4 py-3 px-2 hover:bg-gray-800/50 rounded-lg cursor-pointer transition -mx-2"
        >
            {/* Rank */}
            <RankBadge rank={rank} rankChange={rankChange} />

            {/* Avatar */}
            {agent.avatarUrl ? (
                <img src={agent.avatarUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover" />
            ) : (
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
                    {displayName.charAt(0).toUpperCase()}
                </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="font-medium text-white truncate">{displayName}</p>
                    {trendInfo && (
                        <span className={`text-[10px] ${trendInfo.color}`}>
                            {trendInfo.icon} {trendInfo.label}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    {agent.primaryDomain && <span className="font-mono">{agent.primaryDomain.name}</span>}
                    {agent.reputation && (
                        <>
                            <span>•</span>
                            <span>Score: {agent.reputation.globalScore.toFixed(1)}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Trending score */}
            <div className="text-right">
                <p className="text-sm font-semibold text-orange-400">{trendingScore.toFixed(0)}</p>
                <p className="text-[10px] text-gray-600">trend</p>
            </div>

            {/* Follow button */}
            {(onFollow || onUnfollow) && (
                <button
                    onClick={handleFollowClick}
                    disabled={isLoading}
                    className={`
                        px-3 py-1 text-xs font-medium rounded-lg transition
                        ${
                            isFollowing
                                ? 'bg-gray-700 text-gray-300 hover:bg-red-600/20 hover:text-red-400'
                                : 'bg-blue-600 text-white hover:bg-blue-500'
                        }
                        disabled:opacity-50
                    `}
                >
                    {isLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                </button>
            )}
        </div>
    );
}

/** Compact trending agent display */
interface TrendingAgentCompactProps {
    trending: TrendingAgent;
    onClick?: (agent: AgentSearchResult) => void;
}

function TrendingAgentCompact({ trending, onClick }: TrendingAgentCompactProps) {
    const { agent, rank, rankChange } = trending;
    const displayName = agent.displayName || formatAddress(agent.address, 4);

    return (
        <div
            onClick={() => onClick?.(agent)}
            className="flex items-center gap-2 p-2 hover:bg-gray-800/50 rounded-lg cursor-pointer transition"
        >
            <RankBadge rank={rank} rankChange={rankChange} />
            <span className="flex-1 text-sm text-white truncate">{displayName}</span>
            {agent.reputation && (
                <span className="text-xs text-gray-500">{agent.reputation.globalScore.toFixed(0)}</span>
            )}
        </div>
    );
}

/** Loading skeleton */
function TrendingAgentSkeleton({ rank }: { rank: number }) {
    return (
        <div className="flex items-center gap-4 py-3 animate-pulse">
            <div
                className={`
                    w-6 h-6 rounded-full flex items-center justify-center
                    text-xs font-bold
                    ${RANK_COLORS[rank] || 'bg-gray-800'}
                `}
            >
                {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-800" />
            <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-800 rounded w-1/3" />
                <div className="h-3 bg-gray-800 rounded w-1/4" />
            </div>
            <div className="w-12 h-8 bg-gray-800 rounded" />
        </div>
    );
}

/**
 * TrendingAgentsBanner - Horizontal scrolling banner for trending agents
 */
export interface TrendingAgentsBannerProps {
    agents: TrendingAgent[];
    onAgentClick?: (agent: AgentSearchResult) => void;
    className?: string;
}

export function TrendingAgentsBanner({ agents, onAgentClick, className = '' }: TrendingAgentsBannerProps) {
    if (agents.length === 0) return null;

    return (
        <div className={`relative ${className}`}>
            <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">🔥</span>
                <span className="text-xs font-medium text-gray-400">Trending Now</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {agents.slice(0, 10).map((trending) => (
                    <div
                        key={trending.agent.address}
                        onClick={() => onAgentClick?.(trending.agent)}
                        className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 cursor-pointer transition"
                    >
                        <span className="text-xs font-bold text-gray-500">#{trending.rank}</span>
                        {trending.agent.avatarUrl ? (
                            <img src={trending.agent.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                        ) : (
                            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold">
                                {(trending.agent.displayName || trending.agent.address).charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className="text-sm text-white truncate max-w-[100px]">
                            {trending.agent.displayName || formatAddress(trending.agent.address, 4)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default TrendingAgents;
