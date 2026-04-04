// @ts-nocheck
/**
 * PostCard Component
 *
 * Displays an individual post in the feed with support for
 * text, task, and achievement post types.
 *
 * @module components/social/feed/PostCard
 */

import type { FeedPost, PostAuthor, TaskPostData, AchievementPostData } from './types';

export interface PostCardProps {
    /** The post to display */
    post: FeedPost;
    /** Callback when post is clicked */
    onPostClick?: (post: FeedPost) => void;
    /** Callback when like is toggled */
    onLikeToggle?: (postId: string, isLiked: boolean) => void;
    /** Callback when comment is clicked */
    onCommentClick?: (post: FeedPost) => void;
    /** Callback when author is clicked */
    onAuthorClick?: (author: PostAuthor) => void;
    /** Optional additional CSS classes */
    className?: string;
}

/**
 * Formats a timestamp into relative time string
 */
function formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Truncates text with ellipsis
 */
function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

/**
 * Formats lamports to SOL display
 */
function formatReward(lamports: number): string {
    const sol = lamports / 1e9;
    if (sol >= 1) return `${sol.toFixed(2)} SOL`;
    if (sol >= 0.001) return `${(sol * 1000).toFixed(2)} mSOL`;
    return `${lamports.toLocaleString()} lamports`;
}

/**
 * Avatar component with fallback initials
 */
function Avatar({
    author,
    size = 'md',
    onClick,
}: {
    author: PostAuthor;
    size?: 'sm' | 'md' | 'lg';
    onClick?: () => void;
}) {
    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base',
    };

    const displayName = author.displayName || author.address;
    const initials = displayName.slice(0, 2).toUpperCase();

    return (
        <button
            type="button"
            onClick={onClick}
            className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 transition hover:opacity-80`}
        >
            {author.avatarUrl ? (
                <img
                    src={author.avatarUrl}
                    alt={displayName}
                    className="w-full h-full rounded-full object-cover"
                />
            ) : (
                <span className="text-white font-semibold">{initials}</span>
            )}
        </button>
    );
}

/**
 * Task-specific content section
 */
function TaskContent({ data }: { data: TaskPostData }) {
    return (
        <div className="mt-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-blue-400">Task #{data.taskId}</span>
                {data.state && (
                    <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                            data.state === 'completed'
                                ? 'bg-green-600/20 text-green-400'
                                : data.state === 'active'
                                    ? 'bg-blue-600/20 text-blue-400'
                                    : 'bg-gray-600/20 text-gray-400'
                        }`}
                    >
                        {data.state}
                    </span>
                )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                {data.reward !== undefined && (
                    <div>
                        <span className="text-gray-500">Reward: </span>
                        <span className="text-emerald-400">{formatReward(data.reward)}</span>
                    </div>
                )}
                {data.submissionCount !== undefined && (
                    <div>
                        <span className="text-gray-500">Submissions: </span>
                        <span>{data.submissionCount}</span>
                    </div>
                )}
                {data.deadline && (
                    <div>
                        <span className="text-gray-500">Deadline: </span>
                        <span>{new Date(data.deadline).toLocaleDateString()}</span>
                    </div>
                )}
                {data.winner && (
                    <div>
                        <span className="text-gray-500">Winner: </span>
                        <span className="text-yellow-400 font-mono">{truncate(data.winner, 12)}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Achievement-specific content section
 */
function AchievementContent({ data }: { data: AchievementPostData }) {
    const achievementIcons: Record<AchievementPostData['type'], string> = {
        task_won: '🏆',
        task_completed: '✅',
        reputation_milestone: '⭐',
        streak: '🔥',
        badge: '🎖️',
    };

    const icon = data.icon || achievementIcons[data.type];

    return (
        <div className="mt-3 p-4 bg-gradient-to-r from-yellow-600/10 to-orange-600/10 rounded-lg border border-yellow-600/20">
            <div className="flex items-center gap-3">
                <span className="text-2xl">{icon}</span>
                <div>
                    <h4 className="font-semibold text-yellow-400">{data.title}</h4>
                    {data.description && (
                        <p className="text-sm text-gray-400 mt-0.5">{data.description}</p>
                    )}
                </div>
            </div>

            {(data.taskId !== undefined || data.value !== undefined) && (
                <div className="flex gap-4 mt-3 text-xs text-gray-400">
                    {data.taskId !== undefined && (
                        <span>
                            <span className="text-gray-500">Task: </span>#{data.taskId}
                        </span>
                    )}
                    {data.value !== undefined && (
                        <span>
                            <span className="text-gray-500">Value: </span>
                            <span className="text-yellow-400">{data.value}</span>
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * Action buttons (like, comment)
 */
function PostActions({
    post,
    onLikeToggle,
    onCommentClick,
}: {
    post: FeedPost;
    onLikeToggle?: (postId: string, isLiked: boolean) => void;
    onCommentClick?: (post: FeedPost) => void;
}) {
    return (
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-800/50">
            <button
                type="button"
                onClick={() => onLikeToggle?.(post.id, !post.isLiked)}
                className={`flex items-center gap-1.5 text-sm transition ${
                    post.isLiked ? 'text-red-400' : 'text-gray-500 hover:text-red-400'
                }`}
            >
                <svg
                    className="w-5 h-5"
                    fill={post.isLiked ? 'currentColor' : 'none'}
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
                <span>{post.likeCount > 0 ? post.likeCount : ''}</span>
            </button>

            <button
                type="button"
                onClick={() => onCommentClick?.(post)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-400 transition"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                </svg>
                <span>{post.commentCount > 0 ? post.commentCount : ''}</span>
            </button>
        </div>
    );
}

/**
 * PostCard - Displays an individual post with type-specific content
 */
export function PostCard({
    post,
    onPostClick,
    onLikeToggle,
    onCommentClick,
    onAuthorClick,
    className = '',
}: PostCardProps) {
    const displayName = post.author.displayName || truncate(post.author.address, 16);

    const typeIndicator: Record<FeedPost['type'], { label: string; color: string }> = {
        text: { label: '', color: '' },
        task: { label: 'Task', color: 'text-blue-400 bg-blue-600/20' },
        achievement: { label: 'Achievement', color: 'text-yellow-400 bg-yellow-600/20' },
    };

    const indicator = typeIndicator[post.type];

    return (
        <article
            className={`bg-gray-900 border border-gray-800 rounded-xl p-4 transition hover:border-gray-700 ${className}`}
            onClick={() => onPostClick?.(post)}
            role="article"
        >
            {/* Header */}
            <div className="flex items-start gap-3">
                <Avatar
                    author={post.author}
                    onClick={() => onAuthorClick?.(post.author)}
                />

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAuthorClick?.(post.author);
                            }}
                            className="font-medium text-sm text-gray-200 hover:text-white transition"
                        >
                            {displayName}
                        </button>

                        {indicator.label && (
                            <span
                                className={`text-xs px-2 py-0.5 rounded-full ${indicator.color}`}
                            >
                                {indicator.label}
                            </span>
                        )}

                        <span className="text-xs text-gray-500">
                            · {formatTimeAgo(post.createdAt)}
                        </span>
                    </div>

                    {post.author.displayName && (
                        <p className="text-xs text-gray-500 font-mono">
                            {truncate(post.author.address, 16)}
                        </p>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="mt-3">
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{post.content}</p>

                {/* Type-specific content */}
                {post.type === 'task' && post.taskData && (
                    <TaskContent data={post.taskData} />
                )}

                {post.type === 'achievement' && post.achievementData && (
                    <AchievementContent data={post.achievementData} />
                )}
            </div>

            {/* Actions */}
            <PostActions
                post={post}
                onLikeToggle={onLikeToggle}
                onCommentClick={onCommentClick}
            />
        </article>
    );
}

export default PostCard;
