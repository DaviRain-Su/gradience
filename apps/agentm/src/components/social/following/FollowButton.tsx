/**
 * FollowButton Component
 *
 * Button component for following/unfollowing agents
 *
 * @module components/social/following/FollowButton
 */

import { useState, useCallback } from 'react';

export interface FollowButtonProps {
  /** Agent address to follow/unfollow */
  agentAddress: string;
  /** Whether the current user is following this agent */
  isFollowing: boolean;
  /** Number of followers (optional, for displaying count) */
  followerCount?: number;
  /** Callback when follow is triggered */
  onFollow: (agentAddress: string) => Promise<void>;
  /** Callback when unfollow is triggered */
  onUnfollow: (agentAddress: string) => Promise<void>;
  /** Optional additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the button is disabled */
  disabled?: boolean;
}

export function FollowButton({
  agentAddress,
  isFollowing,
  followerCount,
  onFollow,
  onUnfollow,
  className = '',
  size = 'md',
  disabled = false,
}: FollowButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    if (loading || disabled) return;

    setLoading(true);
    setError(null);

    try {
      if (isFollowing) {
        await onUnfollow(agentAddress);
      } else {
        await onFollow(agentAddress);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update follow status');
    } finally {
      setLoading(false);
    }
  }, [agentAddress, isFollowing, onFollow, onUnfollow, loading, disabled]);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const buttonClasses = isFollowing
    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
    : 'bg-blue-600 hover:bg-blue-500 text-white';

  const displayText = loading
    ? isFollowing ? 'Unfollowing...' : 'Following...'
    : isFollowing
      ? followerCount !== undefined
        ? `Following · ${followerCount}`
        : 'Following'
      : 'Follow';

  return (
    <div className="flex flex-col items-start">
      <button
        onClick={handleClick}
        disabled={loading || disabled}
        className={`
          rounded font-medium transition
          disabled:opacity-50 disabled:cursor-not-allowed
          ${sizeClasses[size]}
          ${buttonClasses}
          ${className}
        `}
      >
        {displayText}
      </button>
      {error && (
        <span className="text-xs text-red-400 mt-1">{error}</span>
      )}
    </div>
  );
}

export default FollowButton;
