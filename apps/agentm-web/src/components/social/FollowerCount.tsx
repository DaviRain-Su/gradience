/**
 * FollowerCount Component
 *
 * Compact display of follower/following counts with optional interaction
 * Styled for AgentM Web with inline styles
 *
 * @module components/social/FollowerCount
 */

import { useCallback } from 'react';

const c = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
};

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
    abbreviate = true,
    horizontal = true,
}: FollowerCountProps) {
    const formatNumber = useCallback(
        (num: number): string => {
            if (!abbreviate) return num.toLocaleString();

            if (num >= 1000000) {
                return (num / 1000000).toFixed(1) + 'M';
            }
            if (num >= 1000) {
                return (num / 1000).toFixed(1) + 'k';
            }
            return num.toLocaleString();
        },
        [abbreviate],
    );

    const sizeStyles = {
        sm: { number: { fontSize: '14px', fontWeight: 600 }, label: { fontSize: '12px' } },
        md: { number: { fontSize: '16px', fontWeight: 700 }, label: { fontSize: '14px' } },
        lg: {
            number: { fontSize: horizontal ? '18px' : '24px', fontWeight: 700 },
            label: { fontSize: horizontal ? '14px' : '12px', opacity: 0.5 },
        },
    };

    const renderCount = (count: number, label: string, clickable: boolean, onClick?: () => void) => {
        if (horizontal) {
            return (
                <button
                    onClick={onClick}
                    disabled={!clickable || loading}
                    style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '4px',
                        background: 'transparent',
                        border: 'none',
                        cursor: clickable ? 'pointer' : 'default',
                        opacity: loading ? 0.5 : 1,
                        padding: 0,
                    }}
                >
                    <span style={sizeStyles[size].number}>{loading ? '-' : formatNumber(count)}</span>
                    <span style={{ ...sizeStyles[size].label, opacity: 0.5 }}>{label}</span>
                </button>
            );
        }

        // Vertical layout
        return (
            <button
                onClick={onClick}
                disabled={!clickable || loading}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: 'transparent',
                    border: 'none',
                    cursor: clickable ? 'pointer' : 'default',
                    opacity: loading ? 0.5 : 1,
                    padding: 0,
                }}
            >
                <span style={{ fontSize: size === 'lg' ? '24px' : size === 'md' ? '18px' : '16px', fontWeight: 700 }}>
                    {loading ? '-' : formatNumber(count)}
                </span>
                <span style={{ fontSize: '12px', opacity: 0.5 }}>{label}</span>
            </button>
        );
    };

    return (
        <div
            style={{
                display: 'flex',
                alignItems: horizontal ? 'center' : 'flex-start',
                gap: horizontal ? '16px' : '8px',
                flexDirection: horizontal ? 'row' : 'column',
            }}
        >
            {renderCount(
                followersCount,
                followersCount === 1 ? 'follower' : 'followers',
                !!onFollowersClick,
                onFollowersClick,
            )}

            {showBoth && horizontal && <span style={{ opacity: 0.3 }}>·</span>}

            {showBoth && renderCount(followingCount, 'following', !!onFollowingClick, onFollowingClick)}
        </div>
    );
}

/**
 * Compact version for inline use
 */
export interface CompactFollowerCountProps {
    followers: number;
    following?: number;
}

export function CompactFollowerCount({ followers, following }: CompactFollowerCountProps) {
    const formatNumber = (num: number): string => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num.toString();
    };

    return (
        <span style={{ fontSize: '12px', opacity: 0.5 }}>
            {formatNumber(followers)} followers
            {following !== undefined && <span> · {formatNumber(following)} following</span>}
        </span>
    );
}

export default FollowerCount;
