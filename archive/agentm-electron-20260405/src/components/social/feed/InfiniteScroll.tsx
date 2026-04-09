/**
 * InfiniteScroll Component
 *
 * Handles infinite scrolling pagination for feed content.
 * Uses Intersection Observer for efficient scroll detection.
 *
 * @module components/social/feed/InfiniteScroll
 */

import { useEffect, useRef, useCallback, useState } from 'react';

export interface InfiniteScrollProps {
    /** Callback to load more content */
    onLoadMore: () => Promise<void>;
    /** Whether more content is available */
    hasMore: boolean;
    /** Whether content is currently loading */
    loading?: boolean;
    /** Threshold distance from bottom to trigger load (in pixels) */
    threshold?: number;
    /** Children to render in the scrollable container */
    children: React.ReactNode;
    /** Optional additional CSS classes */
    className?: string;
    /** Loader element to show while loading */
    loader?: React.ReactNode;
    /** End message to show when no more content */
    endMessage?: React.ReactNode;
    /** Error message if loading failed */
    error?: string | null;
    /** Callback to retry loading after error */
    onRetry?: () => void;
}

/**
 * Default loader component
 */
function DefaultLoader() {
    return (
        <div className="flex justify-center py-6">
            <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
                <span>Loading more...</span>
            </div>
        </div>
    );
}

/**
 * Default end message component
 */
function DefaultEndMessage() {
    return (
        <div className="flex justify-center py-6">
            <p className="text-sm text-gray-500">You&apos;ve reached the end</p>
        </div>
    );
}

/**
 * Error message component
 */
function ErrorMessage({ error, onRetry }: { error: string; onRetry?: () => void }) {
    return (
        <div className="flex flex-col items-center gap-3 py-6">
            <p className="text-sm text-red-400">{error}</p>
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition"
                >
                    Try again
                </button>
            )}
        </div>
    );
}

/**
 * InfiniteScroll - Provides infinite scrolling with Intersection Observer
 *
 * Features:
 * - Efficient scroll detection via Intersection Observer
 * - Loading state management
 * - Error handling with retry
 * - Customizable loader and end messages
 * - Debounced load calls to prevent rapid firing
 */
export function InfiniteScroll({
    onLoadMore,
    hasMore,
    loading = false,
    threshold = 200,
    children,
    className = '',
    loader,
    endMessage,
    error = null,
    onRetry,
}: InfiniteScrollProps) {
    const sentinelRef = useRef<HTMLDivElement>(null);
    const loadingRef = useRef(false);
    const [retryCount, setRetryCount] = useState(0);

    const handleLoadMore = useCallback(async () => {
        if (loadingRef.current || !hasMore || loading || error) return;

        loadingRef.current = true;
        try {
            await onLoadMore();
        } finally {
            loadingRef.current = false;
        }
    }, [onLoadMore, hasMore, loading, error]);

    const handleRetry = useCallback(() => {
        setRetryCount((prev) => prev + 1);
        onRetry?.();
    }, [onRetry]);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry?.isIntersecting && hasMore && !loading && !error) {
                    void handleLoadMore();
                }
            },
            {
                root: null,
                rootMargin: `${threshold}px`,
                threshold: 0,
            },
        );

        observer.observe(sentinel);

        return () => {
            observer.disconnect();
        };
    }, [handleLoadMore, hasMore, loading, error, threshold, retryCount]);

    return (
        <div className={className}>
            {children}

            {/* Sentinel element for intersection detection */}
            <div ref={sentinelRef} className="h-1" aria-hidden="true" />

            {/* Loading state */}
            {loading && (loader ?? <DefaultLoader />)}

            {/* Error state */}
            {error && !loading && <ErrorMessage error={error} onRetry={handleRetry} />}

            {/* End message */}
            {!hasMore && !loading && !error && (endMessage ?? <DefaultEndMessage />)}
        </div>
    );
}

/**
 * useInfiniteScroll - Hook for managing infinite scroll state
 *
 * Provides a simpler interface for common infinite scroll patterns
 */
export interface UseInfiniteScrollOptions<T> {
    /** Initial items */
    initialItems?: T[];
    /** Page size */
    pageSize?: number;
    /** Fetch function that returns items for a page */
    fetchPage: (page: number, pageSize: number) => Promise<T[]>;
}

export interface UseInfiniteScrollResult<T> {
    /** Current items */
    items: T[];
    /** Whether loading */
    loading: boolean;
    /** Error message */
    error: string | null;
    /** Whether more items available */
    hasMore: boolean;
    /** Load more items */
    loadMore: () => Promise<void>;
    /** Reset to initial state */
    reset: () => void;
    /** Retry after error */
    retry: () => void;
}

export function useInfiniteScroll<T>({
    initialItems = [],
    pageSize = 20,
    fetchPage,
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollResult<T> {
    const [items, setItems] = useState<T[]>(initialItems);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);

    const loadMore = useCallback(async () => {
        if (loading || !hasMore) return;

        setLoading(true);
        setError(null);

        try {
            const newItems = await fetchPage(page + 1, pageSize);
            setItems((prev) => [...prev, ...newItems]);
            setPage((prev) => prev + 1);
            setHasMore(newItems.length >= pageSize);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load more items');
        } finally {
            setLoading(false);
        }
    }, [loading, hasMore, page, pageSize, fetchPage]);

    const reset = useCallback(() => {
        setItems(initialItems);
        setPage(0);
        setLoading(false);
        setError(null);
        setHasMore(true);
    }, [initialItems]);

    const retry = useCallback(() => {
        setError(null);
        void loadMore();
    }, [loadMore]);

    return {
        items,
        loading,
        error,
        hasMore,
        loadMore,
        reset,
        retry,
    };
}

export default InfiniteScroll;
