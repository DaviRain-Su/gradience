/**
 * AgentCard Component
 *
 * Card component for displaying agent information in search/discovery contexts
 *
 * @module components/social/discovery/AgentCard
 */

import { useState, useCallback } from 'react';
import type { AgentSearchResult, ReputationTier } from './types.ts';
import { getReputationTier } from './types.ts';
import type { DomainInfo } from '../../profile/types.ts';

export interface AgentCardProps {
    /** Agent data to display */
    agent: AgentSearchResult;
    /** Whether the current user follows this agent */
    isFollowing?: boolean;
    /** Show expanded view with more details */
    expanded?: boolean;
    /** Enable hover effects */
    interactive?: boolean;
    /** Callback when card is clicked */
    onClick?: (agent: AgentSearchResult) => void;
    /** Callback when follow button is clicked */
    onFollow?: (agent: AgentSearchResult) => Promise<void>;
    /** Callback when unfollow button is clicked */
    onUnfollow?: (agent: AgentSearchResult) => Promise<void>;
    /** Callback when message button is clicked */
    onMessage?: (agent: AgentSearchResult) => void;
    /** Additional CSS classes */
    className?: string;
}

/** Reputation tier colors */
const TIER_COLORS: Record<ReputationTier, { bg: string; text: string; border: string }> = {
    elite: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    high: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
    medium: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
    low: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
    new: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
    all: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
};

/** Domain type colors */
const DOMAIN_COLORS: Record<string, string> = {
    sol: 'bg-purple-600/30 text-purple-400 border-purple-500/30',
    eth: 'bg-blue-600/30 text-blue-400 border-blue-500/30',
    ens: 'bg-indigo-600/30 text-indigo-400 border-indigo-500/30',
    bonfida: 'bg-pink-600/30 text-pink-400 border-pink-500/30',
};

/**
 * Format address for display (truncate middle)
 */
function formatAddress(address: string, chars = 6): string {
    if (address.length <= chars * 2 + 3) return address;
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Format large numbers with K/M suffix
 */
function formatCount(count: number): string {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
    return count.toString();
}

/**
 * AgentCard - Display component for agent search results
 *
 * Features:
 * - Avatar with fallback
 * - Domain badges
 * - Reputation score and tier
 * - Capability tags
 * - Follow/Message actions
 * - Expandable details
 */
export function AgentCard({
    agent,
    isFollowing: controlledIsFollowing,
    expanded = false,
    interactive = true,
    onClick,
    onFollow,
    onUnfollow,
    onMessage,
    className = '',
}: AgentCardProps) {
    const [isExpanded, setIsExpanded] = useState(expanded);
    const [isFollowing, setIsFollowing] = useState(agent.isFollowing ?? controlledIsFollowing ?? false);
    const [isFollowLoading, setIsFollowLoading] = useState(false);

    const tier = agent.reputation
        ? getReputationTier(agent.reputation.globalScore, agent.reputation.tasksCompleted > 0)
        : 'new';
    const tierColors = TIER_COLORS[tier];

    const handleClick = useCallback(() => {
        if (interactive) {
            onClick?.(agent);
        }
    }, [interactive, onClick, agent]);

    const handleFollowClick = useCallback(
        async (e: React.MouseEvent) => {
            e.stopPropagation();
            if (isFollowLoading) return;

            setIsFollowLoading(true);
            try {
                if (isFollowing) {
                    await onUnfollow?.(agent);
                    setIsFollowing(false);
                } else {
                    await onFollow?.(agent);
                    setIsFollowing(true);
                }
            } finally {
                setIsFollowLoading(false);
            }
        },
        [isFollowLoading, isFollowing, onFollow, onUnfollow, agent],
    );

    const handleMessageClick = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onMessage?.(agent);
        },
        [onMessage, agent],
    );

    const handleExpandToggle = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            setIsExpanded((prev) => !prev);
        },
        [],
    );

    const displayName = agent.displayName || formatAddress(agent.address);
    const primaryDomain = agent.primaryDomain ?? agent.domains?.[0];

    return (
        <div
            onClick={handleClick}
            className={`
                bg-gray-900 rounded-xl border border-gray-800 overflow-hidden
                ${interactive ? 'cursor-pointer hover:border-gray-700 hover:bg-gray-800/50' : ''}
                transition-all duration-200
                ${className}
            `}
        >
            {/* Main content */}
            <div className="p-4">
                <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                        {agent.avatarUrl ? (
                            <img
                                src={agent.avatarUrl}
                                alt={displayName}
                                className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-800"
                            />
                        ) : (
                            <div
                                className={`
                                    w-12 h-12 rounded-full flex items-center justify-center
                                    text-lg font-bold ring-2 ring-gray-800
                                    ${tierColors.bg} ${tierColors.text}
                                `}
                            >
                                {displayName.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-white truncate">
                                {displayName}
                            </h3>

                            {/* Domain badge */}
                            {primaryDomain && (
                                <DomainBadge domain={primaryDomain} />
                            )}

                            {/* Reputation tier badge */}
                            {tier !== 'new' && (
                                <span
                                    className={`
                                        text-[10px] font-medium px-1.5 py-0.5 rounded
                                        ${tierColors.bg} ${tierColors.text} border ${tierColors.border}
                                    `}
                                >
                                    {tier.toUpperCase()}
                                </span>
                            )}
                        </div>

                        {/* Address */}
                        <p className="text-xs text-gray-500 font-mono mt-0.5">
                            {formatAddress(agent.address)}
                        </p>

                        {/* Bio preview */}
                        {agent.bio && (
                            <p className="text-sm text-gray-400 mt-2 line-clamp-2">
                                {agent.bio}
                            </p>
                        )}

                        {/* Stats row */}
                        <div className="flex items-center gap-4 mt-3">
                            {/* Reputation score */}
                            {agent.reputation && (
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500">Score:</span>
                                    <span className={`text-sm font-semibold ${tierColors.text}`}>
                                        {agent.reputation.globalScore.toFixed(1)}
                                    </span>
                                    {agent.reputation.trend && (
                                        <span
                                            className={`text-[10px] ${
                                                agent.reputation.trend === 'up'
                                                    ? 'text-green-400'
                                                    : agent.reputation.trend === 'down'
                                                        ? 'text-red-400'
                                                        : 'text-gray-500'
                                            }`}
                                        >
                                            {agent.reputation.trend === 'up' ? '↑' : agent.reputation.trend === 'down' ? '↓' : '→'}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Follower count */}
                            {agent.followerCount !== undefined && (
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500">Followers:</span>
                                    <span className="text-sm font-medium text-gray-300">
                                        {formatCount(agent.followerCount)}
                                    </span>
                                </div>
                            )}

                            {/* Win rate */}
                            {agent.reputation?.winRate !== undefined && agent.reputation.winRate > 0 && (
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500">Win:</span>
                                    <span className="text-sm font-medium text-gray-300">
                                        {agent.reputation.winRate.toFixed(0)}%
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                        {(onFollow || onUnfollow) && (
                            <button
                                onClick={handleFollowClick}
                                disabled={isFollowLoading}
                                className={`
                                    px-3 py-1.5 text-xs font-medium rounded-lg transition
                                    ${isFollowing
                                        ? 'bg-gray-700 text-gray-300 hover:bg-red-600/20 hover:text-red-400 hover:border-red-500/30 border border-transparent'
                                        : 'bg-blue-600 text-white hover:bg-blue-500'
                                    }
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                `}
                            >
                                {isFollowLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                            </button>
                        )}
                        {onMessage && (
                            <button
                                onClick={handleMessageClick}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition"
                            >
                                Message
                            </button>
                        )}
                    </div>
                </div>

                {/* Capabilities */}
                {agent.capabilities && agent.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {agent.capabilities.slice(0, isExpanded ? undefined : 4).map((cap) => (
                            <span
                                key={cap}
                                className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-800 text-gray-400 border border-gray-700"
                            >
                                {cap}
                            </span>
                        ))}
                        {!isExpanded && agent.capabilities.length > 4 && (
                            <button
                                onClick={handleExpandToggle}
                                className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-800 text-gray-500 hover:text-gray-300 transition"
                            >
                                +{agent.capabilities.length - 4} more
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Expanded details */}
            {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-800 mt-2">
                    <div className="pt-3 space-y-3">
                        {/* Additional domains */}
                        {agent.domains && agent.domains.length > 1 && (
                            <div>
                                <p className="text-xs text-gray-500 mb-1.5">All Domains</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {agent.domains.map((domain) => (
                                        <DomainBadge key={domain.name} domain={domain} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Detailed reputation */}
                        {agent.reputation && (
                            <div>
                                <p className="text-xs text-gray-500 mb-1.5">Reputation Details</p>
                                <div className="grid grid-cols-3 gap-2">
                                    <ReputationStat
                                        label="Tasks Completed"
                                        value={agent.reputation.tasksCompleted}
                                    />
                                    <ReputationStat
                                        label="Total Applied"
                                        value={agent.reputation.totalApplied}
                                    />
                                    <ReputationStat
                                        label="Win Rate"
                                        value={`${agent.reputation.winRate.toFixed(1)}%`}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Discovery source */}
                        {agent.discoveredVia && (
                            <p className="text-[10px] text-gray-600">
                                Discovered via: {agent.discoveredVia}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Expand toggle */}
            {(agent.domains?.length ?? 0) > 1 || agent.reputation ? (
                <button
                    onClick={handleExpandToggle}
                    className="w-full py-2 text-xs text-gray-500 hover:text-gray-300 bg-gray-800/50 hover:bg-gray-800 transition"
                >
                    {isExpanded ? 'Show less ▲' : 'Show more ▼'}
                </button>
            ) : null}
        </div>
    );
}

/** Domain badge component */
interface DomainBadgeProps {
    domain: DomainInfo;
    className?: string;
}

function DomainBadge({ domain, className = '' }: DomainBadgeProps) {
    const colorClass = DOMAIN_COLORS[domain.type] || DOMAIN_COLORS.sol;

    return (
        <span
            className={`
                inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border
                ${colorClass}
                ${className}
            `}
        >
            <span className="font-mono">{domain.name}</span>
            {domain.status === 'verified' && <span>✓</span>}
        </span>
    );
}

/** Reputation stat component */
interface ReputationStatProps {
    label: string;
    value: string | number;
}

function ReputationStat({ label, value }: ReputationStatProps) {
    return (
        <div className="bg-gray-800/50 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-sm font-semibold text-gray-300">{value}</p>
        </div>
    );
}

/**
 * CompactAgentCard - Minimal agent card for lists
 */
export interface CompactAgentCardProps {
    agent: AgentSearchResult;
    onClick?: (agent: AgentSearchResult) => void;
    className?: string;
}

export function CompactAgentCard({ agent, onClick, className = '' }: CompactAgentCardProps) {
    const tier = agent.reputation
        ? getReputationTier(agent.reputation.globalScore, agent.reputation.tasksCompleted > 0)
        : 'new';
    const tierColors = TIER_COLORS[tier];
    const displayName = agent.displayName || formatAddress(agent.address, 4);

    return (
        <div
            onClick={() => onClick?.(agent)}
            className={`
                flex items-center gap-3 p-3 bg-gray-900 rounded-lg border border-gray-800
                hover:border-gray-700 hover:bg-gray-800/50 cursor-pointer transition
                ${className}
            `}
        >
            {/* Avatar */}
            {agent.avatarUrl ? (
                <img
                    src={agent.avatarUrl}
                    alt={displayName}
                    className="w-8 h-8 rounded-full object-cover"
                />
            ) : (
                <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${tierColors.bg} ${tierColors.text}`}
                >
                    {displayName.charAt(0).toUpperCase()}
                </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-white truncate">{displayName}</p>
                {agent.primaryDomain && (
                    <p className="text-[10px] text-gray-500 font-mono">{agent.primaryDomain.name}</p>
                )}
            </div>

            {/* Score */}
            {agent.reputation && (
                <div className={`text-sm font-semibold ${tierColors.text}`}>
                    {agent.reputation.globalScore.toFixed(0)}
                </div>
            )}
        </div>
    );
}

export default AgentCard;
