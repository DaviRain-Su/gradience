import { useState, useEffect, useCallback } from 'react';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';

export interface Post {
    id: string;
    author: {
        address: string;
        domain?: string;
        displayName: string;
        avatar?: string;
    };
    content: string;
    media?: Array<{ type: 'image' | 'video'; url: string }>;
    createdAt: string;
    likes: number;
    comments: number;
    shares: number;
    isLiked: boolean;
}

export interface FeedFilters {
    type?: 'all' | 'posts' | 'updates' | 'workflows';
    sortBy?: 'latest' | 'popular' | 'following';
}

function authHeaders(token: string | null): Record<string, string> {
    const h: Record<string, string> = {};
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
}

export function useFeed(filters?: FeedFilters, page: number = 1) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const { daemonUrl, sessionToken } = useDaemonConnection();

    useEffect(() => {
        setLoading(true);
        const query = new URLSearchParams({
            page: page.toString(),
            limit: '20',
            ...(filters?.type && filters.type !== 'all' && { type: filters.type }),
            ...(filters?.sortBy && { sortBy: filters.sortBy }),
        });

        fetch(`${daemonUrl}/api/feed?${query}`, { headers: authHeaders(sessionToken) })
            .then(async (res) => {
                if (!res.ok) throw new Error(`Feed error: ${res.status}`);
                return res.json();
            })
            .then((data) => {
                const fetched = (data.posts || []).map(mapPost);
                setPosts((prev) => (page === 1 ? fetched : [...prev, ...fetched]));
                setHasMore(data.hasMore ?? false);
            })
            .catch((err) => {
                setError(err instanceof Error ? err.message : 'Unknown error');
                if (page === 1) setPosts([]);
                setHasMore(false);
            })
            .finally(() => setLoading(false));
    }, [filters?.type, filters?.sortBy, page, daemonUrl, sessionToken]);

    const loadMore = useCallback(() => {}, []);

    const likePost = useCallback(
        async (postId: string) => {
            if (!sessionToken) return;
            try {
                const res = await fetch(`${daemonUrl}/api/posts/${postId}/like`, {
                    method: 'POST',
                    headers: authHeaders(sessionToken),
                });
                if (!res.ok) throw new Error('Failed');
                const data = await res.json();
                setPosts((prev) =>
                    prev.map((p) =>
                        p.id === postId
                            ? { ...p, isLiked: data.liked, likes: data.liked ? p.likes + 1 : p.likes - 1 }
                            : p,
                    ),
                );
            } catch {
                // Toggle optimistic
                setPosts((prev) =>
                    prev.map((p) =>
                        p.id === postId
                            ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 }
                            : p,
                    ),
                );
            }
        },
        [daemonUrl, sessionToken],
    );

    return { posts, loading, error, hasMore, loadMore, likePost };
}

export function usePost(postId: string) {
    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { daemonUrl, sessionToken } = useDaemonConnection();

    useEffect(() => {
        if (!postId) {
            setPost(null);
            return;
        }
        setLoading(true);
        fetch(`${daemonUrl}/api/posts/${postId}`, { headers: authHeaders(sessionToken) })
            .then(async (res) => {
                if (!res.ok) throw new Error('Not found');
                return res.json();
            })
            .then((data) => setPost(mapPost(data)))
            .catch((err) => setError(err instanceof Error ? err.message : 'Unknown error'))
            .finally(() => setLoading(false));
    }, [postId, daemonUrl, sessionToken]);

    return { post, loading, error };
}

function mapPost(raw: any): Post {
    return {
        id: raw.id,
        author: {
            address: raw.authorAddress,
            domain: raw.authorDomain,
            displayName: raw.authorName || `Agent ${(raw.authorAddress || '').slice(0, 6)}`,
            avatar: raw.authorAvatar,
        },
        content: raw.content,
        media: raw.media,
        createdAt: raw.createdAt,
        likes: raw.likes || 0,
        comments: raw.comments || 0,
        shares: raw.shares || 0,
        isLiked: false,
    };
}

export default useFeed;
