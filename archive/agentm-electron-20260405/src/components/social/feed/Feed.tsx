/**
 * Feed Component
 *
 * Main feed display component that combines PostCard, InfiniteScroll,
 * and FilterBar to create a complete timeline experience.
 *
 * @module components/social/feed/Feed
 */

import { useState, useCallback, useMemo } from 'react';
import type { FeedPost, FeedFilter, PostAuthor, FeedCallbacks } from './types.ts';
import { PostCard } from './PostCard.tsx';
import { InfiniteScroll } from './InfiniteScroll.tsx';
import { FilterBar } from './FilterBar.tsx';

export interface FeedProps extends FeedCallbacks {
    /** Array of posts to display */
    posts: FeedPost[];
    /** Whether more posts are available */
    hasMore?: boolean;
    /** Whether feed is loading */
    loading?: boolean;
    /** Error message if loading failed */
    error?: string | null;
    /** Initial filter value */
    initialFilter?: FeedFilter;
    /** Whether to show the filter bar */
    showFilter?: boolean;
    /** Optional header element */
    header?: React.ReactNode;
    /** Empty state message */
    emptyMessage?: string;
    /** Optional additional CSS classes */
    className?: string;
}

/**
 * Empty state component
 */
function EmptyState({ filter, message }: { filter: FeedFilter; message?: string }) {
    const defaultMessages: Record<FeedFilter, string> = {
        all: 'No posts yet. Start following agents to see their activity!',
        text: 'No text posts yet.',
        task: 'No task posts yet. Tasks will appear when agents share task updates.',
        achievement: 'No achievements yet. Achievements will appear as agents complete milestones.',
    };

    return (
        <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                    />
                </svg>
            </div>
            <p className="text-sm text-gray-500 text-center max-w-xs">{message ?? defaultMessages[filter]}</p>
        </div>
    );
}

/**
 * Loading skeleton for posts
 */
function PostSkeleton() {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-800 rounded-full" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-800 rounded w-1/3" />
                    <div className="h-3 bg-gray-800 rounded w-1/4" />
                </div>
            </div>
            <div className="mt-4 space-y-2">
                <div className="h-4 bg-gray-800 rounded w-full" />
                <div className="h-4 bg-gray-800 rounded w-4/5" />
            </div>
        </div>
    );
}

/**
 * Feed - Complete feed display with filtering and infinite scroll
 *
 * Features:
 * - Filter by post type (all, text, task, achievement)
 * - Infinite scroll pagination
 * - Loading and error states
 * - Empty state handling
 * - Customizable header
 */
export function Feed({
    posts,
    hasMore = false,
    loading = false,
    error = null,
    initialFilter = 'all',
    showFilter = true,
    header,
    emptyMessage,
    className = '',
    onPostClick,
    onLikeToggle,
    onCommentClick,
    onAuthorClick,
    onLoadMore,
}: FeedProps) {
    const [activeFilter, setActiveFilter] = useState<FeedFilter>(initialFilter);

    // Filter posts based on active filter
    const filteredPosts = useMemo(() => {
        if (activeFilter === 'all') return posts;
        return posts.filter((post) => post.type === activeFilter);
    }, [posts, activeFilter]);

    // Calculate counts for filter badges
    const filterCounts = useMemo(() => {
        return {
            all: posts.length,
            text: posts.filter((p) => p.type === 'text').length,
            task: posts.filter((p) => p.type === 'task').length,
            achievement: posts.filter((p) => p.type === 'achievement').length,
        };
    }, [posts]);

    const handleFilterChange = useCallback((filter: FeedFilter) => {
        setActiveFilter(filter);
    }, []);

    const handleLoadMore = useCallback(async () => {
        await onLoadMore?.();
    }, [onLoadMore]);

    // Show skeleton loaders during initial load
    if (loading && posts.length === 0) {
        return (
            <div className={`space-y-4 ${className}`}>
                {header}
                {showFilter && (
                    <FilterBar activeFilter={activeFilter} onFilterChange={handleFilterChange} counts={filterCounts} />
                )}
                <PostSkeleton />
                <PostSkeleton />
                <PostSkeleton />
            </div>
        );
    }

    // Show error state
    if (error && posts.length === 0) {
        return (
            <div className={`${className}`}>
                {header}
                {showFilter && (
                    <FilterBar activeFilter={activeFilter} onFilterChange={handleFilterChange} counts={filterCounts} />
                )}
                <div className="flex flex-col items-center justify-center py-12 px-6">
                    <div className="w-16 h-16 rounded-full bg-red-600/10 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </div>
                    <p className="text-sm text-red-400 text-center mb-4">{error}</p>
                    {onLoadMore && (
                        <button
                            type="button"
                            onClick={() => void handleLoadMore()}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition"
                        >
                            Try again
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Show empty state
    if (filteredPosts.length === 0) {
        return (
            <div className={`${className}`}>
                {header}
                {showFilter && (
                    <FilterBar activeFilter={activeFilter} onFilterChange={handleFilterChange} counts={filterCounts} />
                )}
                <EmptyState filter={activeFilter} message={emptyMessage} />
            </div>
        );
    }

    return (
        <div className={`${className}`}>
            {header}

            {showFilter && (
                <FilterBar
                    activeFilter={activeFilter}
                    onFilterChange={handleFilterChange}
                    counts={filterCounts}
                    className="mb-4"
                />
            )}

            <InfiniteScroll
                onLoadMore={handleLoadMore}
                hasMore={hasMore}
                loading={loading}
                error={error}
                onRetry={handleLoadMore}
                className="space-y-4"
            >
                {filteredPosts.map((post) => (
                    <PostCard
                        key={post.id}
                        post={post}
                        onPostClick={onPostClick}
                        onLikeToggle={onLikeToggle}
                        onCommentClick={onCommentClick}
                        onAuthorClick={onAuthorClick}
                    />
                ))}
            </InfiniteScroll>
        </div>
    );
}

/**
 * FeedHeader - Standard header for the feed
 */
export interface FeedHeaderProps {
    /** Title text */
    title?: string;
    /** Optional refresh callback */
    onRefresh?: () => void;
    /** Whether refreshing */
    refreshing?: boolean;
    /** Optional additional CSS classes */
    className?: string;
}

export function FeedHeader({ title = 'Feed', onRefresh, refreshing = false, className = '' }: FeedHeaderProps) {
    return (
        <div className={`flex items-center justify-between py-4 border-b border-gray-800 mb-4 ${className}`}>
            <h1 className="text-xl font-bold text-white">{title}</h1>

            {onRefresh && (
                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={refreshing}
                    className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition disabled:opacity-50"
                    aria-label="Refresh feed"
                >
                    <svg
                        className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                    </svg>
                </button>
            )}
        </div>
    );
}

export default Feed;
