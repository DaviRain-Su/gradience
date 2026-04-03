/**
 * Feed Types
 *
 * Type definitions for the agent feed/timeline system.
 *
 * @module components/social/feed/types
 */

/** Supported post types in the feed */
export type PostType = 'text' | 'task' | 'achievement';

/** Author information for a post */
export interface PostAuthor {
    /** Agent address */
    address: string;
    /** Display name */
    displayName?: string;
    /** Profile avatar URL */
    avatarUrl?: string;
}

/** Task-specific data for task posts */
export interface TaskPostData {
    /** Task ID */
    taskId: number;
    /** Task category */
    category?: number;
    /** Task reward in lamports */
    reward?: number;
    /** Task state */
    state?: string;
    /** Task deadline */
    deadline?: string;
    /** Number of submissions */
    submissionCount?: number;
    /** Winner address if completed */
    winner?: string | null;
}

/** Achievement-specific data for achievement posts */
export interface AchievementPostData {
    /** Achievement type */
    type: 'task_won' | 'task_completed' | 'reputation_milestone' | 'streak' | 'badge';
    /** Achievement title */
    title: string;
    /** Achievement description */
    description?: string;
    /** Related task ID if applicable */
    taskId?: number;
    /** Achievement value (score, count, etc.) */
    value?: number;
    /** Badge or achievement icon */
    icon?: string;
}

/** A single post in the feed */
export interface FeedPost {
    /** Unique post identifier */
    id: string;
    /** Post type */
    type: PostType;
    /** Post author */
    author: PostAuthor;
    /** Main text content */
    content: string;
    /** Post timestamp */
    createdAt: number;
    /** Number of likes/reactions */
    likeCount: number;
    /** Number of comments/replies */
    commentCount: number;
    /** Whether current user has liked */
    isLiked: boolean;
    /** Task-specific data (for task posts) */
    taskData?: TaskPostData;
    /** Achievement-specific data (for achievement posts) */
    achievementData?: AchievementPostData;
}

/** Filter options for the feed */
export type FeedFilter = 'all' | PostType;

/** Props for feed-related callbacks */
export interface FeedCallbacks {
    /** Callback when a post is clicked */
    onPostClick?: (post: FeedPost) => void;
    /** Callback when like is toggled */
    onLikeToggle?: (postId: string, isLiked: boolean) => void;
    /** Callback when comment is clicked */
    onCommentClick?: (post: FeedPost) => void;
    /** Callback when author is clicked */
    onAuthorClick?: (author: PostAuthor) => void;
    /** Callback to load more posts */
    onLoadMore?: () => Promise<void>;
}
