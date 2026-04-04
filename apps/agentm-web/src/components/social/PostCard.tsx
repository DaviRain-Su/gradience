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

const c = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
};

const avatarSizes = { sm: 32, md: 40, lg: 48 };

function Avatar({
    author,
    size = 'md',
    onClick,
}: {
    author: PostAuthor;
    size?: 'sm' | 'md' | 'lg';
    onClick?: () => void;
}) {
    const px = avatarSizes[size];
    const displayName = author.displayName || author.address;
    const initials = displayName.slice(0, 2).toUpperCase();

    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                width: px, height: px, borderRadius: '50%',
                background: c.lavender, border: `1.5px solid ${c.ink}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, cursor: 'pointer', padding: 0,
                fontSize: size === 'sm' ? '11px' : size === 'lg' ? '16px' : '13px',
                fontWeight: 700, color: c.ink,
            }}
        >
            {author.avatarUrl ? (
                <img
                    src={author.avatarUrl}
                    alt={displayName}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
            ) : (
                <span>{initials}</span>
            )}
        </button>
    );
}

/**
 * Task-specific content section
 */
function TaskContent({ data }: { data: TaskPostData }) {
    const stateColors: Record<string, { bg: string; color: string }> = {
        completed: { bg: '#D1FAE5', color: '#059669' },
        active: { bg: '#DBEAFE', color: '#2563EB' },
        default: { bg: c.bg, color: c.ink },
    };
    const sc = stateColors[data.state ?? ''] ?? stateColors.default;

    return (
        <div style={{ marginTop: '12px', padding: '12px', background: c.bg, borderRadius: '12px', border: `1px solid ${c.ink}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: c.lavender }}>Task #{data.taskId}</span>
                {data.state && (
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: sc.bg, color: sc.color, fontWeight: 600 }}>
                        {data.state}
                    </span>
                )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: c.ink, opacity: 0.7 }}>
                {data.reward !== undefined && (
                    <div><span style={{ opacity: 0.5 }}>Reward: </span><span style={{ color: '#059669', fontWeight: 600 }}>{formatReward(data.reward)}</span></div>
                )}
                {data.submissionCount !== undefined && (
                    <div><span style={{ opacity: 0.5 }}>Submissions: </span><span>{data.submissionCount}</span></div>
                )}
                {data.deadline && (
                    <div><span style={{ opacity: 0.5 }}>Deadline: </span><span>{new Date(data.deadline).toLocaleDateString()}</span></div>
                )}
                {data.winner && (
                    <div><span style={{ opacity: 0.5 }}>Winner: </span><span style={{ fontFamily: 'monospace', color: '#D97706' }}>{truncate(data.winner, 12)}</span></div>
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
        <div style={{ marginTop: '12px', padding: '16px', background: `${c.lime}30`, borderRadius: '12px', border: `1px solid ${c.lime}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>{icon}</span>
                <div>
                    <h4 style={{ fontWeight: 700, color: c.ink, fontSize: '14px', margin: 0 }}>{data.title}</h4>
                    {data.description && (
                        <p style={{ fontSize: '13px', color: c.ink, opacity: 0.6, marginTop: '2px' }}>{data.description}</p>
                    )}
                </div>
            </div>
            {(data.taskId !== undefined || data.value !== undefined) && (
                <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '12px', color: c.ink, opacity: 0.7 }}>
                    {data.taskId !== undefined && (
                        <span><span style={{ opacity: 0.5 }}>Task: </span>#{data.taskId}</span>
                    )}
                    {data.value !== undefined && (
                        <span><span style={{ opacity: 0.5 }}>Value: </span><span style={{ color: '#D97706', fontWeight: 600 }}>{data.value}</span></span>
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
    const actionStyle: React.CSSProperties = {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '6px 12px', background: 'transparent', border: 'none',
        borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
        color: c.ink, opacity: 0.6,
    };

    return (
        <div style={{ display: 'flex', gap: '16px', marginTop: '12px', paddingTop: '12px', borderTop: `1px dashed ${c.ink}` }}>
            <button
                type="button"
                onClick={() => onLikeToggle?.(post.id, !post.isLiked)}
                style={{ ...actionStyle, color: post.isLiked ? '#DC2626' : c.ink, opacity: post.isLiked ? 1 : 0.6 }}
            >
                {post.isLiked ? 'u2764ufe0f' : 'ud83eude76'} {post.likeCount > 0 ? post.likeCount : ''}
            </button>
            <button
                type="button"
                onClick={() => onCommentClick?.(post)}
                style={actionStyle}
            >
                ud83dudcac {post.commentCount > 0 ? post.commentCount : ''}
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

    const typeIndicator: Record<FeedPost['type'], { label: string; bg: string; color: string }> = {
        text: { label: '', bg: '', color: '' },
        task: { label: 'Task', bg: '#DBEAFE', color: '#2563EB' },
        achievement: { label: 'Achievement', bg: `${c.lime}60`, color: c.ink },
    };

    const indicator = typeIndicator[post.type];

    return (
        <article
            style={{
                background: c.surface, border: `1.5px solid ${c.ink}`,
                borderRadius: '20px', padding: '20px', cursor: 'pointer',
                transition: 'box-shadow 0.15s',
            }}
            onClick={() => onPostClick?.(post)}
            role="article"
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <Avatar
                    author={post.author}
                    onClick={() => onAuthorClick?.(post.author)}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onAuthorClick?.(post.author); }}
                            style={{ fontWeight: 700, fontSize: '14px', color: c.ink, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                            {displayName}
                        </button>
                        {indicator.label && (
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: indicator.bg, color: indicator.color, fontWeight: 600 }}>
                                {indicator.label}
                            </span>
                        )}
                        <span style={{ fontSize: '12px', color: c.ink, opacity: 0.5 }}>
                            · {formatTimeAgo(post.createdAt)}
                        </span>
                    </div>
                    {post.author.displayName && (
                        <p style={{ fontSize: '12px', color: c.ink, opacity: 0.5, fontFamily: 'monospace', margin: '2px 0 0' }}>
                            {truncate(post.author.address, 16)}
                        </p>
                    )}
                </div>
            </div>

            <div style={{ marginTop: '12px' }}>
                <p style={{ fontSize: '14px', color: c.ink, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>{post.content}</p>
                {post.type === 'task' && post.taskData && <TaskContent data={post.taskData} />}
                {post.type === 'achievement' && post.achievementData && <AchievementContent data={post.achievementData} />}
            </div>

            <PostActions post={post} onLikeToggle={onLikeToggle} onCommentClick={onCommentClick} />
        </article>
    );
}

export default PostCard;
