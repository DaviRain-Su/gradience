/**
 * FollowersList Component
 *
 * List component for displaying an agent's followers
 *
 * @module components/social/following/FollowersList
 */

import { useState, useCallback } from 'react';
import { FollowButton } from './FollowButton';

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
  /** Optional additional CSS classes */
  className?: string;
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
  className = '',
}: FollowersListProps) {
  const [expandedFollower, setExpandedFollower] = useState<string | null>(null);

  const handleFollowerClick = useCallback((follower: Follower) => {
    if (onFollowerClick) {
      onFollowerClick(follower);
    }
  }, [onFollowerClick]);

  const toggleExpanded = useCallback((address: string) => {
    setExpandedFollower(prev => prev === address ? null : address);
  }, []);

  if (loading) {
    return (
      <div className={`bg-gray-900 rounded-xl border border-gray-800 p-4 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Followers</h3>
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
        <h3 className="text-lg font-semibold mb-3">Followers</h3>
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h3 className="text-lg font-semibold">Followers</h3>
        <span className="text-sm text-gray-500">{totalCount.toLocaleString()} total</span>
      </div>

      {/* List */}
      <div
        className="overflow-y-auto"
        style={{ maxHeight }}
      >
        {followers.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500">No followers yet</p>
            <p className="text-xs text-gray-600 mt-1">
              When agents follow this account, they&apos;ll appear here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {followers.map((follower) => (
              <div
                key={follower.address}
                className="p-4 hover:bg-gray-800/50 transition cursor-pointer"
                onClick={() => handleFollowerClick(follower)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    {follower.avatarUrl ? (
                      <img
                        src={follower.avatarUrl}
                        alt={follower.displayName || follower.address}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                        {(follower.displayName || follower.address).charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Info */}
                    <div>
                      <p className="font-medium text-sm">
                        {follower.displayName || follower.address.slice(0, 12) + '...'}
                      </p>
                      {follower.displayName && (
                        <p className="text-xs text-gray-500 font-mono">{follower.address.slice(0, 16)}...</p>
                      )}
                      {follower.reputationScore !== undefined && (
                        <p className="text-xs text-gray-500">
                          Score: {follower.reputationScore.toFixed(1)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
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
                      className="p-1 text-gray-500 hover:text-gray-300 transition"
                    >
                      <span className="text-xs">
                        {expandedFollower === follower.address ? '▲' : '▼'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedFollower === follower.address && follower.followedAt && (
                  <div className="mt-3 pt-3 border-t border-gray-800/50 text-xs text-gray-500">
                    <p>Followed since: {new Date(follower.followedAt).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Load more */}
        {onLoadMore && followers.length < totalCount && (
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={() => void onLoadMore()}
              disabled={loadingMore}
              className="w-full py-2 text-sm text-gray-400 hover:text-gray-300 bg-gray-800/50 hover:bg-gray-800 rounded transition disabled:opacity-50"
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
