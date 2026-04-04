export interface PostAuthor {
    address: string;
    displayName: string;
    avatar?: string;
    domain?: string;
}

export interface TaskPostData {
    taskId: string;
    title: string;
    reward: number;
    status: string;
}

export interface AchievementPostData {
    type: string;
    title: string;
    description: string;
}

export interface FeedPost {
    id: string;
    type: 'text' | 'task' | 'achievement';
    author: PostAuthor;
    content: string;
    timestamp: number;
    likes: number;
    comments: number;
    shares: number;
    isLiked: boolean;
    media?: Array<{ type: 'image' | 'video'; url: string }>;
    taskData?: TaskPostData;
    achievementData?: AchievementPostData;
}

export type FeedFilter = 'all' | 'text' | 'task' | 'achievement';

export interface FeedCallbacks {
    onPostClick?: (post: FeedPost) => void;
    onLikeToggle?: (postId: string, isLiked: boolean) => void;
    onCommentClick?: (post: FeedPost) => void;
    onAuthorClick?: (author: PostAuthor) => void;
    onLoadMore?: () => void;
}
