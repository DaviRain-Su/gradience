/**
 * Feed Component
 *
 * Main feed display component that combines PostCard, InfiniteScroll,
 * and FilterBar to create a complete timeline experience.
 *
 * @module components/social/feed/Feed
 */

import { useState, useCallback, useMemo } from 'react';
import type { FeedPost, FeedFilter, PostAuthor, FeedCallbacks } from './types';
import { PostCard } from './PostCard';
import { InfiniteScroll } from './InfiniteScroll';
import { FilterBar } from './FilterBar';

const c = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
};

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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>ud83dudcdd</div>
            <p style={{ fontSize: '14px', color: c.ink, opacity: 0.5, textAlign: 'center', maxWidth: '320px' }}>
                {message ?? defaultMessages[filter]}
            </p>
        </div>
    );
}

/**
 * Loading skeleton for posts
 */
function PostSkeleton() {
    const bar: React.CSSProperties = { background: c.bg, borderRadius: '6px', height: '14px' };
    return (
        <div style={{ background: c.surface, border: `1.5px solid ${c.ink}`, borderRadius: '20px', padding: '20px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: c.bg }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ ...bar, width: '33%' }} />
                    <div style={{ ...bar, width: '25%', height: '12px' }} />
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                <div style={{ ...bar, width: '100%' }} />
                <div style={{ ...bar, width: '80%' }} />
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
                    <FilterBar
                        activeFilter={activeFilter}
                        onFilterChange={handleFilterChange}
                        counts={filterCounts}
                    />
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
                    <FilterBar
                        activeFilter={activeFilter}
                        onFilterChange={handleFilterChange}
                        counts={filterCounts}
                    />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>ud83dudea8</div>
                    <p style={{ fontSize: '14px', color: '#DC2626', textAlign: 'center', marginBottom: '16px' }}>{error}</p>
                    {onLoadMore && (
                        <button
                            type="button"
                            onClick={() => void handleLoadMore()}
                            style={{
                                padding: '10px 20px', background: c.bg, border: `1.5px solid ${c.ink}`,
                                borderRadius: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', color: c.ink,
                            }}
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
                    <FilterBar
                        activeFilter={activeFilter}
                        onFilterChange={handleFilterChange}
                        counts={filterCounts}
                    />
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

export function FeedHeader({
    title = 'Feed',
    onRefresh,
    refreshing = false,
    className = '',
}: FeedHeaderProps) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', marginBottom: '16px', borderBottom: `1.5px solid ${c.ink}` }}>
            <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '20px', fontWeight: 700, color: c.ink, margin: 0 }}>{title}</h1>
            {onRefresh && (
                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={refreshing}
                    aria-label="Refresh feed"
                    style={{ padding: '8px', background: 'transparent', border: `1.5px solid ${c.ink}`, borderRadius: '8px', cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.5 : 1, color: c.ink }}
                >
                    u21bb
                </button>
            )}
        </div>
    );
}

export default Feed;
