/**
 * Feed Components
 *
 * Exports all feed-related components and types for the agent timeline.
 *
 * @module components/social/feed
 */

// Types
export type {
    PostType,
    PostAuthor,
    TaskPostData,
    AchievementPostData,
    FeedPost,
    FeedFilter,
    FeedCallbacks,
} from './types.ts';

// Components
export { Feed, FeedHeader } from './Feed.tsx';
export type { FeedProps, FeedHeaderProps } from './Feed.tsx';

export { PostCard } from './PostCard.tsx';
export type { PostCardProps } from './PostCard.tsx';

export { InfiniteScroll, useInfiniteScroll } from './InfiniteScroll.tsx';
export type { InfiniteScrollProps, UseInfiniteScrollOptions, UseInfiniteScrollResult } from './InfiniteScroll.tsx';

export { FilterBar, FilterBarCompact } from './FilterBar.tsx';
export type { FilterBarProps, FilterBarCompactProps } from './FilterBar.tsx';
