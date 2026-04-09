/**
 * FollowButton Component
 *
 * Button component for following/unfollowing agents
 * Styled for AgentM Web with inline styles
 *
 * @module components/social/FollowButton
 */

import { useState, useCallback } from 'react';

const c = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
};

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

    const sizeStyles = {
        sm: { padding: '6px 12px', fontSize: '12px' },
        md: { padding: '8px 16px', fontSize: '14px' },
        lg: { padding: '10px 20px', fontSize: '16px' },
    };

    const buttonStyles = isFollowing
        ? { background: c.bg, color: c.ink, border: `1.5px solid ${c.ink}` }
        : { background: c.ink, color: c.surface, border: `1.5px solid ${c.ink}` };

    const displayText = loading
        ? isFollowing
            ? 'Unfollowing...'
            : 'Following...'
        : isFollowing
          ? followerCount !== undefined
              ? `Following · ${followerCount}`
              : 'Following'
          : 'Follow';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <button
                onClick={handleClick}
                disabled={loading || disabled}
                style={{
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: loading || disabled ? 'not-allowed' : 'pointer',
                    opacity: loading || disabled ? 0.5 : 1,
                    transition: 'all 0.2s ease',
                    ...sizeStyles[size],
                    ...buttonStyles,
                }}
                onMouseEnter={(e) => {
                    if (!loading && !disabled) {
                        e.currentTarget.style.opacity = '0.85';
                    }
                }}
                onMouseLeave={(e) => {
                    if (!loading && !disabled) {
                        e.currentTarget.style.opacity = '1';
                    }
                }}
            >
                {displayText}
            </button>
            {error && <span style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px' }}>{error}</span>}
        </div>
    );
}

export default FollowButton;
