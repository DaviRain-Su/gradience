import { useState, useCallback, useEffect, useRef } from 'react';
import { FilterBar, type FeedFilters } from './FilterBar.tsx';
import { PostCard, type Post, type PostType } from './PostCard.tsx';
import { InfiniteScroll, useInfiniteScroll } from './InfiniteScroll.tsx';
import type { AgentInfo } from '../../../../shared/a2a-router-types.ts';

interface FeedProps {
    /** Initial posts to display */
    initialPosts?: Post[];
    /** Agent filter options */
    agentOptions?: Array<{ address: string; displayName: string }>;
    /** Fetch posts function (for pagination) */
    fetchPosts?: (page: number, pageSize: number, filters: FeedFilters) => Promise<Post[]>;
    /** Enable real-time updates via WebSocket/SSE */
    enableRealtime?: boolean;
    /** Real-time post handler */
    onRealtimePost?: (post: Post) => void;
    /** Post interaction handlers */
    onLike?: (postId: string) => void | Promise<void>;
    onComment?: (postId: string) => void;
    onShare?: (postId: string) => void;
    onAgentClick?: (address: string) => void;
    onTaskClick?: (taskId: number) => void;
    /** Filter change handler */
    onFilterChange?: (filters: FeedFilters) => void;
    /** Loading state */
    loading?: boolean;
    /** Error state */
    error?: Error | null;
    /** Page size for pagination */
    pageSize?: number;
    /** Custom empty state message */
    emptyMessage?: string;
    /** Compact mode for smaller cards */
    compact?: boolean;
    /** Class name for container */
    className?: string;
}

const DEFAULT_FILTERS: FeedFilters = {
    type: 'all',
    sort: 'latest',
};

const DEFAULT_PAGE_SIZE = 20;

export function Feed({
    initialPosts = [],
    agentOptions = [],
    fetchPosts,
    enableRealtime = false,
    onRealtimePost,
    onLike,
    onComment,
    onShare,
    onAgentClick,
    onTaskClick,
    onFilterChange,
    loading: externalLoading,
    error: externalError,
    pageSize = DEFAULT_PAGE_SIZE,
    emptyMessage = 'No posts yet. Check back later or follow more agents!',
    compact = false,
    className = '',
}: FeedProps) {
    const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
    const [posts, setPosts] = useState<Post[]>(initialPosts);
    const [loading, setLoading] = useState(externalLoading ?? false);
    const [error, setError] = useState<Error | null>(externalError ?? null);
    const [hasMore, setHasMore] = useState(true);
    const pageRef = useRef(0);

    // Reset and reload when filters change
    useEffect(() => {
        setPosts([]);
        setHasMore(true);
        pageRef.current = 0;
        void loadPosts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.type, filters.sort, filters.agentAddress, filters.searchQuery]);

    const loadPosts = useCallback(async (reset = false) => {
        if (!fetchPosts) return;
        if (loading) return;

        setLoading(true);
        setError(null);

        try {
            const page = reset ? 0 : pageRef.current;
            const newPosts = await fetchPosts(page, pageSize, filters);
            
            if (reset) {
                setPosts(newPosts);
                pageRef.current = 1;
            } else {
                setPosts((prev) => [...prev, ...newPosts]);
                pageRef.current += 1;
            }
            
            // Assume no more posts if we got fewer than pageSize
            setHasMore(newPosts.length === pageSize);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load posts'));
        } finally {
            setLoading(false);
        }
    }, [fetchPosts, filters, loading, pageSize]);

    const handleLoadMore = useCallback(async () => {
        await loadPosts(false);
    }, [loadPosts]);

    const handleFilterChange = useCallback((newFilters: FeedFilters) => {
        setFilters(newFilters);
        onFilterChange?.(newFilters);
    }, [onFilterChange]);

    // Real-time updates simulation (would connect to WebSocket in production)
    useEffect(() => {
        if (!enableRealtime) return;

        // This would be replaced with actual WebSocket/SSE connection
        // Example: const ws = new WebSocket('wss://api.example.com/feed');
        
        return () => {
            // Cleanup WebSocket connection
        };
    }, [enableRealtime]);

    const handleRealtimePost = useCallback((post: Post) => {
        setPosts((prev) => [post, ...prev]);
        onRealtimePost?.(post);
    }, [onRealtimePost]);

    // Filter posts locally if no fetchPosts provided
    const filteredPosts = fetchPosts 
        ? posts 
        : filterPostsLocally(posts, filters);

    return (
        <div className={`flex flex-col h-full ${className}`}>
            <FilterBar
                filters={filters}
                onChange={handleFilterChange}
                agentOptions={agentOptions}
                disabled={loading}
            />

            <div className="flex-1 overflow-y-auto">
                {error && !loading && posts.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                        <p className="text-red-400 mb-4">Failed to load feed</p>
                        <button
                            onClick={() => void loadPosts(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {filteredPosts.length === 0 && !loading && !error && (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                        <p className="text-gray-500 text-sm">{emptyMessage}</p>
                        {filters.type !== 'all' && (
                            <button
                                onClick={() => handleFilterChange(DEFAULT_FILTERS)}
                                className="mt-4 text-xs text-blue-400 hover:text-blue-300 underline"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                )}

                <InfiniteScroll
                    onLoadMore={handleLoadMore}
                    hasMore={hasMore && !!fetchPosts}
                    loading={loading}
                    className="p-4 space-y-3"
                >
                    {filteredPosts.map((post) => (
                        <PostCard
                            key={post.id}
                            post={post}
                            onLike={onLike}
                            onComment={onComment}
                            onShare={onShare}
                            onAgentClick={onAgentClick}
                            onTaskClick={onTaskClick}
                            compact={compact}
                        />
                    ))}
                </InfiniteScroll>
            </div>
        </div>
    );
}

// Local filtering for when fetchPosts is not provided
function filterPostsLocally(posts: Post[], filters: FeedFilters): Post[] {
    return posts.filter((post) => {
        // Type filter
        if (filters.type !== 'all' && post.type !== filters.type) {
            return false;
        }

        // Agent filter
        if (filters.agentAddress && post.author.address !== filters.agentAddress) {
            return false;
        }

        // Search filter
        if (filters.searchQuery) {
            const query = filters.searchQuery.toLowerCase();
            const matchesContent = post.content.toLowerCase().includes(query);
            const matchesAuthor = post.author.displayName.toLowerCase().includes(query);
            if (!matchesContent && !matchesAuthor) {
                return false;
            }
        }

        return true;
    }).sort((a, b) => {
        // Sort logic
        switch (filters.sort) {
            case 'latest':
                return b.timestamp - a.timestamp;
            case 'popular':
                return (b.engagement.likes + b.engagement.comments) - 
                       (a.engagement.likes + a.engagement.comments);
            case 'trending':
                // Simple trending: likes per hour since posted
                const aHours = (Date.now() - a.timestamp) / 3600000;
                const bHours = (Date.now() - b.timestamp) / 3600000;
                const aTrending = aHours > 0 ? a.engagement.likes / aHours : a.engagement.likes;
                const bTrending = bHours > 0 ? b.engagement.likes / bHours : b.engagement.likes;
                return bTrending - aTrending;
            default:
                return 0;
        }
    });
}

// Utility hook for feed operations
export function useFeed({
    fetchPosts,
    pageSize = DEFAULT_PAGE_SIZE,
}: {
    fetchPosts: (page: number, pageSize: number, filters: FeedFilters) => Promise<Post[]>;
    pageSize?: number;
}) {
    const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const pageRef = useRef(0);

    const loadPosts = useCallback(async (reset = false) => {
        if (loading) return;

        setLoading(true);
        setError(null);

        try {
            const page = reset ? 0 : pageRef.current;
            const newPosts = await fetchPosts(page, pageSize, filters);
            
            if (reset) {
                setPosts(newPosts);
                pageRef.current = 1;
            } else {
                setPosts((prev) => [...prev, ...newPosts]);
                pageRef.current += 1;
            }
            
            setHasMore(newPosts.length === pageSize);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load posts'));
        } finally {
            setLoading(false);
        }
    }, [fetchPosts, filters, loading, pageSize]);

    const refresh = useCallback(() => {
        pageRef.current = 0;
        setHasMore(true);
        return loadPosts(true);
    }, [loadPosts]);

    const loadMore = useCallback(() => {
        return loadPosts(false);
    }, [loadPosts]);

    const addPost = useCallback((post: Post) => {
        setPosts((prev) => [post, ...prev]);
    }, []);

    const removePost = useCallback((postId: string) => {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
    }, []);

    const updatePost = useCallback((postId: string, updates: Partial<Post>) => {
        setPosts((prev) => prev.map((p) => 
            p.id === postId ? { ...p, ...updates } : p
        ));
    }, []);

    useEffect(() => {
        pageRef.current = 0;
        setHasMore(true);
        void loadPosts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.type, filters.sort, filters.agentAddress, filters.searchQuery]);

    return {
        filters,
        setFilters,
        posts,
        loading,
        error,
        hasMore,
        loadMore,
        refresh,
        addPost,
        removePost,
        updatePost,
    };
}

// Re-export types for convenience
export type { Post, PostType, FeedFilters };
