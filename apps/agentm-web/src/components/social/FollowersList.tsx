/**
 * FollowersList Component
 *
 * List component for displaying an agent's followers
 * Styled for AgentM Web with inline styles
 *
 * @module components/social/FollowersList
 */

import { useState, useCallback } from 'react';
import { FollowButton } from './FollowButton';

const c = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
};

export interface Follower {
    /** Agent address */
    address: string;
    /** Display name */
    displayName?: string;
    /** Profile avatar URL */
    avatarUrl?: string;
    /** Whether the current user follows this follower */
    isFollowing?: boolean;
    /** Reputation score */
    reputationScore?: number;
    /** Follow timestamp */
    followedAt?: number;
    /** Bio */
    bio?: string;
    /** Domain */
    domain?: string;
}

export interface FollowersListProps {
    /** Agent address whose followers to display */
    agentAddress: string;
    /** Array of followers */
    followers: Follower[];
    /** Total follower count (may be more than followers.length if paginated) */
    totalCount: number;
    /** Callback when follow is triggered */
    onFollow: (agentAddress: string) => Promise<void>;
    /** Callback when unfollow is triggered */
    onUnfollow: (agentAddress: string) => Promise<void>;
    /** Callback when a follower is clicked */
    onFollowerClick?: (follower: Follower) => void;
    /** Callback to load more followers (for pagination) */
    onLoadMore?: () => Promise<void>;
    /** Whether more followers are loading */
    loadingMore?: boolean;
    /** Whether the list is loading */
    loading?: boolean;
    /** Error message if loading failed */
    error?: string | null;
    /** Maximum height for scrollable list */
    maxHeight?: string;
}

export function FollowersList({
    agentAddress,
    followers,
    totalCount,
    onFollow,
    onUnfollow,
    onFollowerClick,
    onLoadMore,
    loadingMore = false,
    loading = false,
    error = null,
    maxHeight = '400px',
}: FollowersListProps) {
    const [expandedFollower, setExpandedFollower] = useState<string | null>(null);

    const handleFollowerClick = useCallback(
        (follower: Follower) => {
            if (onFollowerClick) {
                onFollowerClick(follower);
            }
        },
        [onFollowerClick],
    );

    const toggleExpanded = useCallback((address: string) => {
        setExpandedFollower((prev) => (prev === address ? null : address));
    }, []);

    if (loading) {
        return (
            <div
                style={{ background: c.surface, borderRadius: '16px', border: `1.5px solid ${c.ink}`, padding: '16px' }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '16px',
                    }}
                >
                    <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '18px', fontWeight: 700, margin: 0 }}>
                        Followers
                    </h3>
                    <span style={{ fontSize: '13px', opacity: 0.5 }}>Loading...</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[...Array(3)].map((_, i) => (
                        <div
                            key={i}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px',
                                background: c.bg,
                                borderRadius: '12px',
                                opacity: 0.5,
                            }}
                        >
                            <div
                                style={{ width: '40px', height: '40px', background: c.lavender, borderRadius: '50%' }}
                            />
                            <div style={{ flex: 1 }}>
                                <div
                                    style={{
                                        height: '16px',
                                        background: c.ink,
                                        opacity: 0.1,
                                        borderRadius: '4px',
                                        width: '30%',
                                        marginBottom: '8px',
                                    }}
                                />
                                <div
                                    style={{
                                        height: '12px',
                                        background: c.ink,
                                        opacity: 0.1,
                                        borderRadius: '4px',
                                        width: '20%',
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div
                style={{ background: c.surface, borderRadius: '16px', border: `1.5px solid ${c.ink}`, padding: '16px' }}
            >
                <h3
                    style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontSize: '18px',
                        fontWeight: 700,
                        margin: '0 0 12px 0',
                    }}
                >
                    Followers
                </h3>
                <p style={{ fontSize: '13px', color: '#DC2626' }}>{error}</p>
            </div>
        );
    }

    return (
        <div
            style={{ background: c.surface, borderRadius: '16px', border: `1.5px solid ${c.ink}`, overflow: 'hidden' }}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: `1px dashed ${c.ink}`,
                }}
            >
                <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '18px', fontWeight: 700, margin: 0 }}>
                    Followers
                </h3>
                <span style={{ fontSize: '13px', opacity: 0.5 }}>{totalCount.toLocaleString()} total</span>
            </div>

            {/* List */}
            <div style={{ maxHeight, overflowY: 'auto' }}>
                {followers.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center' }}>
                        <p style={{ fontSize: '14px', opacity: 0.5 }}>No followers yet</p>
                        <p style={{ fontSize: '12px', opacity: 0.4, marginTop: '8px' }}>
                            When agents follow this account, they&apos;ll appear here
                        </p>
                    </div>
                ) : (
                    <div>
                        {followers.map((follower) => (
                            <div
                                key={follower.address}
                                style={{
                                    padding: '16px 20px',
                                    borderBottom: `1px solid ${c.bg}`,
                                    cursor: 'pointer',
                                    transition: 'background 0.15s',
                                }}
                                onClick={() => handleFollowerClick(follower)}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = c.bg;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {/* Avatar */}
                                        {follower.avatarUrl ? (
                                            <img
                                                src={follower.avatarUrl}
                                                alt={follower.displayName || follower.address}
                                                style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '50%',
                                                    objectFit: 'cover',
                                                    border: `1.5px solid ${c.ink}`,
                                                }}
                                            />
                                        ) : (
                                            <div
                                                style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    background: c.lime,
                                                    borderRadius: '50%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '14px',
                                                    fontWeight: 700,
                                                    border: `1.5px solid ${c.ink}`,
                                                }}
                                            >
                                                {(follower.displayName || follower.address).charAt(0).toUpperCase()}
                                            </div>
                                        )}

                                        {/* Info */}
                                        <div>
                                            <p style={{ fontWeight: 600, fontSize: '14px', margin: 0 }}>
                                                {follower.displayName || `${follower.address.slice(0, 12)}...`}
                                            </p>
                                            {follower.displayName && (
                                                <p
                                                    style={{
                                                        fontSize: '12px',
                                                        opacity: 0.5,
                                                        margin: '2px 0 0 0',
                                                        fontFamily: 'monospace',
                                                    }}
                                                >
                                                    {follower.address.slice(0, 16)}...
                                                </p>
                                            )}
                                            {follower.reputationScore !== undefined && (
                                                <p style={{ fontSize: '12px', opacity: 0.5, margin: '2px 0 0 0' }}>
                                                    Score: {follower.reputationScore.toFixed(1)}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {follower.isFollowing !== undefined && follower.address !== agentAddress && (
                                            <FollowButton
                                                agentAddress={follower.address}
                                                isFollowing={follower.isFollowing}
                                                onFollow={onFollow}
                                                onUnfollow={onUnfollow}
                                                size="sm"
                                            />
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleExpanded(follower.address);
                                            }}
                                            style={{
                                                padding: '4px 8px',
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: '12px',
                                                opacity: 0.5,
                                            }}
                                        >
                                            {expandedFollower === follower.address ? '▲' : '▼'}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded details */}
                                {expandedFollower === follower.address && follower.followedAt && (
                                    <div
                                        style={{
                                            marginTop: '12px',
                                            paddingTop: '12px',
                                            borderTop: `1px dashed ${c.bg}`,
                                            fontSize: '12px',
                                            opacity: 0.5,
                                        }}
                                    >
                                        <p style={{ margin: 0 }}>
                                            Followed since: {new Date(follower.followedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Load more */}
                {onLoadMore && followers.length < totalCount && (
                    <div style={{ padding: '16px', borderTop: `1px dashed ${c.ink}` }}>
                        <button
                            onClick={() => void onLoadMore()}
                            disabled={loadingMore}
                            style={{
                                width: '100%',
                                padding: '12px',
                                fontSize: '13px',
                                opacity: loadingMore ? 0.5 : 0.7,
                                background: c.bg,
                                border: `1.5px solid ${c.ink}`,
                                borderRadius: '8px',
                                cursor: loadingMore ? 'not-allowed' : 'pointer',
                                fontWeight: 500,
                            }}
                        >
                            {loadingMore ? 'Loading...' : `Load more (${totalCount - followers.length} remaining)`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default FollowersList;
