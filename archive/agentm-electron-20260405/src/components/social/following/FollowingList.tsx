/**
 * FollowingList Component
 *
 * List component for displaying who an agent is following
 *
 * @module components/social/following/FollowingList
 */

import { useState, useCallback } from 'react';
import { FollowButton } from './FollowButton.tsx';

export interface Following {
    /** Agent address */
    address: string;
    /** Display name */
    displayName?: string;
    /** Profile avatar URL */
    avatarUrl?: string;
    /** Agent capabilities */
    capabilities?: string[];
    /** Reputation score */
    reputationScore?: number;
    /** When the follow started */
    followedAt?: number;
    /** Bio/description */
    bio?: string;
}

export interface FollowingListProps {
    /** Agent address whose following list to display */
    agentAddress: string;
    /** Array of agents being followed */
    following: Following[];
    /** Total following count (may be more than following.length if paginated) */
    totalCount: number;
    /** Callback when unfollow is triggered */
    onUnfollow: (agentAddress: string) => Promise<void>;
    /** Callback when re-follow is triggered (for quick re-follow) */
    onRefollow?: (agentAddress: string) => Promise<void>;
    /** Callback when an agent is clicked */
    onAgentClick?: (agent: Following) => void;
    /** Callback to load more (for pagination) */
    onLoadMore?: () => Promise<void>;
    /** Whether more items are loading */
    loadingMore?: boolean;
    /** Whether the list is loading */
    loading?: boolean;
    /** Error message if loading failed */
    error?: string | null;
    /** Maximum height for scrollable list */
    maxHeight?: string;
    /** Optional additional CSS classes */
    className?: string;
    /** Whether to show unfollow confirmations */
    confirmUnfollow?: boolean;
}

export function FollowingList({
    agentAddress,
    following,
    totalCount,
    onUnfollow,
    onRefollow,
    onAgentClick,
    onLoadMore,
    loadingMore = false,
    loading = false,
    error = null,
    maxHeight = '400px',
    className = '',
    confirmUnfollow = true,
}: FollowingListProps) {
    const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
    const [confirmingUnfollow, setConfirmingUnfollow] = useState<string | null>(null);

    const handleAgentClick = useCallback(
        (agent: Following) => {
            if (onAgentClick) {
                onAgentClick(agent);
            }
        },
        [onAgentClick],
    );

    const toggleExpanded = useCallback((address: string) => {
        setExpandedAgent((prev) => (prev === address ? null : address));
    }, []);

    const handleUnfollow = useCallback(
        async (address: string) => {
            if (confirmUnfollow && confirmingUnfollow !== address) {
                setConfirmingUnfollow(address);
                return;
            }

            try {
                await onUnfollow(address);
                setConfirmingUnfollow(null);
            } catch {
                // Error is handled by the button component
                setConfirmingUnfollow(null);
            }
        },
        [confirmUnfollow, confirmingUnfollow, onUnfollow],
    );

    if (loading) {
        return (
            <div className={`bg-gray-900 rounded-xl border border-gray-800 p-4 ${className}`}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Following</h3>
                    <span className="text-sm text-gray-500">Loading...</span>
                </div>
                <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg animate-pulse">
                            <div className="w-10 h-10 bg-gray-700 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-gray-700 rounded w-1/3" />
                                <div className="h-3 bg-gray-700 rounded w-1/4" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`bg-gray-900 rounded-xl border border-gray-800 p-4 ${className}`}>
                <h3 className="text-lg font-semibold mb-3">Following</h3>
                <p className="text-sm text-red-400">{error}</p>
            </div>
        );
    }

    return (
        <div className={`bg-gray-900 rounded-xl border border-gray-800 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <h3 className="text-lg font-semibold">Following</h3>
                <span className="text-sm text-gray-500">{totalCount.toLocaleString()} following</span>
            </div>

            {/* List */}
            <div className="overflow-y-auto" style={{ maxHeight }}>
                {following.length === 0 ? (
                    <div className="p-8 text-center">
                        <p className="text-sm text-gray-500">Not following anyone yet</p>
                        <p className="text-xs text-gray-600 mt-1">
                            Discover agents to follow them and see their updates
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-800">
                        {following.map((agent) => (
                            <div
                                key={agent.address}
                                className="p-4 hover:bg-gray-800/50 transition cursor-pointer"
                                onClick={() => handleAgentClick(agent)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {/* Avatar */}
                                        {agent.avatarUrl ? (
                                            <img
                                                src={agent.avatarUrl}
                                                alt={agent.displayName || agent.address}
                                                className="w-10 h-10 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-sm font-bold">
                                                {(agent.displayName || agent.address).charAt(0).toUpperCase()}
                                            </div>
                                        )}

                                        {/* Info */}
                                        <div>
                                            <p className="font-medium text-sm">
                                                {agent.displayName || agent.address.slice(0, 12) + '...'}
                                            </p>
                                            {agent.displayName && (
                                                <p className="text-xs text-gray-500 font-mono">
                                                    {agent.address.slice(0, 16)}...
                                                </p>
                                            )}
                                            {agent.reputationScore !== undefined && (
                                                <p className="text-xs text-gray-500">
                                                    Score: {agent.reputationScore.toFixed(1)}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        {onRefollow ? (
                                            <FollowButton
                                                agentAddress={agent.address}
                                                isFollowing={true}
                                                onFollow={onRefollow}
                                                onUnfollow={handleUnfollow}
                                                size="sm"
                                            />
                                        ) : (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    void handleUnfollow(agent.address);
                                                }}
                                                className={`
                          px-3 py-1.5 text-sm rounded font-medium transition
                          ${
                              confirmingUnfollow === agent.address
                                  ? 'bg-red-600 hover:bg-red-500 text-white'
                                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          }
                        `}
                                            >
                                                {confirmingUnfollow === agent.address ? 'Confirm?' : 'Following'}
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleExpanded(agent.address);
                                            }}
                                            className="p-1 text-gray-500 hover:text-gray-300 transition"
                                        >
                                            <span className="text-xs">
                                                {expandedAgent === agent.address ? '▲' : '▼'}
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded details */}
                                {expandedAgent === agent.address && (
                                    <div className="mt-3 pt-3 border-t border-gray-800/50">
                                        {agent.bio && <p className="text-xs text-gray-400 mb-2">{agent.bio}</p>}
                                        {agent.capabilities && agent.capabilities.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-2">
                                                {agent.capabilities.slice(0, 5).map((cap, i) => (
                                                    <span
                                                        key={i}
                                                        className="text-xs px-2 py-0.5 bg-gray-800 rounded text-gray-400"
                                                    >
                                                        {cap}
                                                    </span>
                                                ))}
                                                {agent.capabilities.length > 5 && (
                                                    <span className="text-xs px-2 py-0.5 text-gray-500">
                                                        +{agent.capabilities.length - 5} more
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {agent.followedAt && (
                                            <p className="text-xs text-gray-500">
                                                Following since: {new Date(agent.followedAt).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Load more */}
                {onLoadMore && following.length < totalCount && (
                    <div className="p-4 border-t border-gray-800">
                        <button
                            onClick={() => void onLoadMore()}
                            disabled={loadingMore}
                            className="w-full py-2 text-sm text-gray-400 hover:text-gray-300 bg-gray-800/50 hover:bg-gray-800 rounded transition disabled:opacity-50"
                        >
                            {loadingMore ? 'Loading...' : `Load more (${totalCount - following.length} remaining)`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default FollowingList;
