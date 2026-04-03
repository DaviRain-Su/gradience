/**
 * FollowerCount Component
 *
 * Compact display of follower/following counts with optional interaction
 *
 * @module components/social/following/FollowerCount
 */

import { useCallback } from 'react';

export interface FollowerCountProps {
  /** Number of followers */
  followersCount: number;
  /** Number of accounts being followed */
  followingCount: number;
  /** Whether to show both counts or just followers */
  showBoth?: boolean;
  /** Click handler for followers count */
  onFollowersClick?: () => void;
  /** Click handler for following count */
  onFollowingClick?: () => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the counts are loading */
  loading?: boolean;
  /** Optional additional CSS classes */
  className?: string;
  /** Whether to abbreviate large numbers (1.2k instead of 1200) */
  abbreviate?: boolean;
  /** Whether to use horizontal layout */
  horizontal?: boolean;
}

export function FollowerCount({
  followersCount,
  followingCount,
  showBoth = true,
  onFollowersClick,
  onFollowingClick,
  size = 'md',
  loading = false,
  className = '',
  abbreviate = true,
  horizontal = true,
}: FollowerCountProps) {
  const formatNumber = useCallback((num: number): string => {
    if (!abbreviate) return num.toLocaleString();

    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toLocaleString();
  }, [abbreviate]);

  const sizeClasses = {
    sm: {
      container: 'gap-2',
      number: 'text-sm font-semibold',
      label: 'text-xs',
    },
    md: {
      container: 'gap-4',
      number: 'text-base font-bold',
      label: 'text-sm',
    },
    lg: {
      container: horizontal ? 'gap-6' : 'gap-2',
      number: horizontal ? 'text-lg font-bold' : 'text-2xl font-bold',
      label: horizontal ? 'text-sm' : 'text-xs text-gray-500',
    },
  };

  const verticalSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const renderCount = (
    count: number,
    label: string,
    clickable: boolean,
    onClick?: () => void
  ) => {
    if (horizontal) {
      return (
        <button
          onClick={onClick}
          disabled={!clickable || loading}
          className={`
            flex items-baseline gap-1
            ${clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
            ${loading ? 'opacity-50' : ''}
          `}
        >
          <span className={sizeClasses[size].number}>
            {loading ? '-' : formatNumber(count)}
          </span>
          <span className={`${sizeClasses[size].label} text-gray-500`}>
            {label}
          </span>
        </button>
      );
    }

    // Vertical layout
    return (
      <button
        onClick={onClick}
        disabled={!clickable || loading}
        className={`
          flex flex-col items-center
          ${clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
          ${loading ? 'opacity-50' : ''}
        `}
      >
        <span className={`${verticalSizeClasses[size]} font-bold`}>
          {loading ? '-' : formatNumber(count)}
        </span>
        <span className="text-xs text-gray-500">{label}</span>
      </button>
    );
  };

  const containerClasses = horizontal
    ? `flex items-center ${sizeClasses[size].container}`
    : `flex flex-col items-center ${sizeClasses[size].container}`;

  return (
    <div className={`${containerClasses} ${className}`}>
      {renderCount(
        followersCount,
        followersCount === 1 ? 'follower' : 'followers',
        !!onFollowersClick,
        onFollowersClick
      )}

      {showBoth && horizontal && (
        <span className="text-gray-700">·</span>
      )}

      {showBoth && renderCount(
        followingCount,
        'following',
        !!onFollowingClick,
        onFollowingClick
      )}
    </div>
  );
}

/**
 * Compact version for inline use
 */
export interface CompactFollowerCountProps {
  followers: number;
  following?: number;
  className?: string;
}

export function CompactFollowerCount({
  followers,
  following,
  className = '',
}: CompactFollowerCountProps) {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  };

  return (
    <span className={`text-xs text-gray-500 ${className}`}>
      {formatNumber(followers)} followers
      {following !== undefined && (
        <span> · {formatNumber(following)} following</span>
      )}
    </span>
  );
}

export default FollowerCount;
