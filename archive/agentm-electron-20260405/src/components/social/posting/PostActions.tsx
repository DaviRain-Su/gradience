/**
 * PostActions Component
 *
 * Action buttons for posts: like, comment, share.
 * Supports count display and interaction states.
 *
 * @module components/social/posting/PostActions
 */

import { useState, useCallback } from 'react';

/** Post action stats */
export interface PostStats {
    /** Number of likes */
    likeCount: number;
    /** Number of comments */
    commentCount: number;
    /** Number of shares */
    shareCount: number;
    /** Whether current user has liked */
    isLiked: boolean;
    /** Whether current user has shared */
    isShared: boolean;
}

export interface PostActionsProps {
    /** Post identifier */
    postId: string;
    /** Post statistics */
    stats: PostStats;
    /** Callback when like is toggled */
    onLike: (postId: string) => Promise<void>;
    /** Callback when comment button is clicked */
    onComment: (postId: string) => void;
    /** Callback when share is clicked */
    onShare: (postId: string) => Promise<void>;
    /** Whether actions are disabled */
    disabled?: boolean;
    /** Optional additional CSS classes */
    className?: string;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Show labels next to icons */
    showLabels?: boolean;
}

/**
 * PostActions - Like, comment, and share action bar
 *
 * Features:
 * - Like toggle with animation
 * - Comment count and trigger
 * - Share functionality
 * - Loading states per action
 * - Compact and expanded variants
 */
export function PostActions({
    postId,
    stats,
    onLike,
    onComment,
    onShare,
    disabled = false,
    className = '',
    size = 'md',
    showLabels = false,
}: PostActionsProps) {
    const [isLiking, setIsLiking] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [likeAnimation, setLikeAnimation] = useState(false);

    const handleLike = useCallback(async () => {
        if (isLiking || disabled) return;

        setIsLiking(true);
        setLikeAnimation(true);

        try {
            await onLike(postId);
        } catch (err) {
            console.error('Failed to like post:', err);
        } finally {
            setIsLiking(false);
            // Reset animation after it completes
            setTimeout(() => setLikeAnimation(false), 300);
        }
    }, [postId, onLike, isLiking, disabled]);

    const handleComment = useCallback(() => {
        if (disabled) return;
        onComment(postId);
    }, [postId, onComment, disabled]);

    const handleShare = useCallback(async () => {
        if (isSharing || disabled) return;

        setIsSharing(true);

        try {
            await onShare(postId);
        } catch (err) {
            console.error('Failed to share post:', err);
        } finally {
            setIsSharing(false);
        }
    }, [postId, onShare, isSharing, disabled]);

    const formatCount = (count: number): string => {
        if (count < 1000) return count.toString();
        if (count < 1_000_000) return `${(count / 1000).toFixed(1)}K`;
        return `${(count / 1_000_000).toFixed(1)}M`;
    };

    const sizeClasses = {
        sm: {
            container: 'gap-4',
            button: 'gap-1 text-xs',
            icon: 'w-4 h-4',
        },
        md: {
            container: 'gap-6',
            button: 'gap-1.5 text-sm',
            icon: 'w-5 h-5',
        },
        lg: {
            container: 'gap-8',
            button: 'gap-2 text-base',
            icon: 'w-6 h-6',
        },
    };

    const currentSize = sizeClasses[size];

    return (
        <div className={`flex items-center ${currentSize.container} ${className}`}>
            {/* Like button */}
            <button
                onClick={() => void handleLike()}
                disabled={disabled || isLiking}
                className={`
                    flex items-center ${currentSize.button} transition
                    ${stats.isLiked ? 'text-red-400 hover:text-red-300' : 'text-gray-500 hover:text-red-400'}
                    disabled:opacity-50 disabled:cursor-not-allowed
                `}
            >
                <svg
                    className={`
                        ${currentSize.icon}
                        ${likeAnimation ? 'animate-bounce' : ''}
                        ${stats.isLiked ? 'fill-current' : ''}
                    `}
                    fill={stats.isLiked ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                </svg>
                {(stats.likeCount > 0 || showLabels) && (
                    <span>{showLabels && stats.likeCount === 0 ? 'Like' : formatCount(stats.likeCount)}</span>
                )}
            </button>

            {/* Comment button */}
            <button
                onClick={handleComment}
                disabled={disabled}
                className={`
                    flex items-center ${currentSize.button} text-gray-500 hover:text-blue-400 transition
                    disabled:opacity-50 disabled:cursor-not-allowed
                `}
            >
                <svg className={currentSize.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                </svg>
                {(stats.commentCount > 0 || showLabels) && (
                    <span>{showLabels && stats.commentCount === 0 ? 'Comment' : formatCount(stats.commentCount)}</span>
                )}
            </button>

            {/* Share button */}
            <button
                onClick={() => void handleShare()}
                disabled={disabled || isSharing}
                className={`
                    flex items-center ${currentSize.button} transition
                    ${stats.isShared ? 'text-green-400 hover:text-green-300' : 'text-gray-500 hover:text-green-400'}
                    disabled:opacity-50 disabled:cursor-not-allowed
                `}
            >
                {isSharing ? (
                    <svg className={`${currentSize.icon} animate-spin`} fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                ) : (
                    <svg className={currentSize.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                        />
                    </svg>
                )}
                {(stats.shareCount > 0 || showLabels) && (
                    <span>{showLabels && stats.shareCount === 0 ? 'Share' : formatCount(stats.shareCount)}</span>
                )}
            </button>
        </div>
    );
}

/**
 * PostActionsCompact - Minimal version for tight spaces
 */
export function PostActionsCompact({
    postId,
    stats,
    onLike,
    onComment,
    onShare,
    disabled = false,
    className = '',
}: Omit<PostActionsProps, 'size' | 'showLabels'>) {
    return (
        <PostActions
            postId={postId}
            stats={stats}
            onLike={onLike}
            onComment={onComment}
            onShare={onShare}
            disabled={disabled}
            className={className}
            size="sm"
            showLabels={false}
        />
    );
}

/**
 * PostActionsExpanded - Full version with labels
 */
export function PostActionsExpanded({
    postId,
    stats,
    onLike,
    onComment,
    onShare,
    disabled = false,
    className = '',
}: Omit<PostActionsProps, 'size' | 'showLabels'>) {
    return (
        <PostActions
            postId={postId}
            stats={stats}
            onLike={onLike}
            onComment={onComment}
            onShare={onShare}
            disabled={disabled}
            className={className}
            size="md"
            showLabels={true}
        />
    );
}

export default PostActions;
