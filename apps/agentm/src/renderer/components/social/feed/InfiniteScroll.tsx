import { useEffect, useRef, useCallback, useState } from 'react';

interface InfiniteScrollProps {
    onLoadMore: () => void | Promise<void>;
    hasMore: boolean;
    loading?: boolean;
    threshold?: number;
    rootMargin?: string;
    children: React.ReactNode;
    loader?: React.ReactNode;
    endMessage?: React.ReactNode;
    className?: string;
}

export function InfiniteScroll({
    onLoadMore,
    hasMore,
    loading = false,
    threshold = 100,
    rootMargin = '100px',
    children,
    loader,
    endMessage,
    className = '',
}: InfiniteScrollProps) {
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<Error | null>(null);

    const handleLoadMore = useCallback(async () => {
        if (loading || !hasMore) return;
        
        try {
            setError(null);
            await onLoadMore();
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load more items'));
        }
    }, [onLoadMore, loading, hasMore]);

    useEffect(() => {
        // Cleanup previous observer
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        // Don't observe if no more items or already loading
        if (!hasMore || loading) return;

        const options: IntersectionObserverInit = {
            root: null,
            rootMargin,
            threshold: threshold / 100,
        };

        observerRef.current = new IntersectionObserver((entries) => {
            const [target] = entries;
            if (target.isIntersecting) {
                void handleLoadMore();
            }
        }, options);

        if (loadMoreRef.current) {
            observerRef.current.observe(loadMoreRef.current);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [handleLoadMore, hasMore, loading, rootMargin, threshold]);

    const defaultLoader = (
        <div className="flex items-center justify-center py-6 space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
    );

    const defaultEndMessage = (
        <div className="text-center py-6 text-gray-500 text-sm">
            — End of feed —
        </div>
    );

    return (
        <div className={className}>
            {children}
            
            {/* Loading state */}
            {loading && (loader || defaultLoader)}
            
            {/* Error state */}
            {error && !loading && (
                <div className="py-4 text-center">
                    <p className="text-red-400 text-sm mb-2">Failed to load more posts</p>
                    <button
                        onClick={() => void handleLoadMore()}
                        className="text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                        Retry
                    </button>
                </div>
            )}
            
            {/* Intersection observer target */}
            {!loading && !error && hasMore && (
                <div ref={loadMoreRef} className="h-4" aria-hidden="true" />
            )}
            
            {/* End of feed */}
            {!loading && !hasMore && (endMessage || defaultEndMessage)}
        </div>
    );
}

// Hook version for custom implementations
export function useInfiniteScroll<T>({
    fetchItems,
    hasMore,
    initialItems = [],
    pageSize = 20,
}: {
    fetchItems: (page: number, pageSize: number) => Promise<T[]>;
    hasMore: (items: T[]) => boolean;
    initialItems?: T[];
    pageSize?: number;
}) {
    const [items, setItems] = useState<T[]>(initialItems);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [hasMoreItems, setHasMoreItems] = useState(true);
    const pageRef = useRef(0);

    const loadMore = useCallback(async () => {
        if (loading || !hasMoreItems) return;

        setLoading(true);
        setError(null);

        try {
            const newItems = await fetchItems(pageRef.current, pageSize);
            pageRef.current += 1;
            
            setItems((prev) => [...prev, ...newItems]);
            setHasMoreItems(hasMore(newItems));
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch items'));
        } finally {
            setLoading(false);
        }
    }, [fetchItems, hasMore, hasMoreItems, loading, pageSize]);

    const reset = useCallback(() => {
        setItems([]);
        setHasMoreItems(true);
        setError(null);
        pageRef.current = 0;
    }, []);

    const refresh = useCallback(async () => {
        reset();
        await loadMore();
    }, [loadMore, reset]);

    return {
        items,
        loading,
        error,
        hasMore: hasMoreItems,
        loadMore,
        reset,
        refresh,
    };
}
