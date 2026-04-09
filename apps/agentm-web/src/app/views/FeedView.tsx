'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useSocial, type SocialPost } from '@/hooks/useSocial';
import { PostComposer } from '@/components/social/PostComposer';

const colors = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
};

type FeedTab = 'global' | 'following';

interface FeedViewProps {
    address: string | null;
}

export function FeedView({ address }: FeedViewProps) {
    const [tab, setTab] = useState<FeedTab>('global');
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dataSource, setDataSource] = useState<'live' | 'none'>('none');
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    const { createPost, deletePost, getFeed, getGlobalFeed, likePost } = useSocial(address);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);

    // Initial load
    const loadFeed = useCallback(
        async (reset = false) => {
            if (loading || loadingMore) return;

            if (reset) {
                setLoading(true);
                setOffset(0);
            } else {
                setLoadingMore(true);
            }
            setError(null);

            try {
                const currentOffset = reset ? 0 : offset;
                const data =
                    tab === 'following' && address
                        ? await getFeed(20, currentOffset)
                        : await getGlobalFeed(20, currentOffset);

                if (data.length > 0) {
                    setPosts((prev) => (reset ? data : [...prev, ...data]));
                    setDataSource('live');
                    setOffset(currentOffset + data.length);
                    setHasMore(data.length === 20);
                } else {
                    if (reset) {
                        setPosts([]);
                    }
                    setHasMore(false);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load feed');
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        },
        [tab, address, getFeed, getGlobalFeed, offset, loading, loadingMore],
    );

    // Reset and reload when tab changes
    useEffect(() => {
        setPosts([]);
        setHasMore(true);
        setOffset(0);
        loadFeed(true);
    }, [tab, address]);

    // Infinite scroll observer
    useEffect(() => {
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
                    loadFeed(false);
                }
            },
            { threshold: 0.1, rootMargin: '100px' },
        );

        if (loadMoreRef.current) {
            observerRef.current.observe(loadMoreRef.current);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [hasMore, loading, loadingMore, loadFeed]);

    async function handlePost(content: string, tags: string[]) {
        if (!address) return;

        // Optimistically add to UI
        const localPost: SocialPost = {
            id: `local_${Date.now()}`,
            author: address,
            authorDomain: null,
            content,
            tags,
            likes: 0,
            reposts: 0,
            createdAt: Date.now(),
        };
        setPosts((prev) => [localPost, ...prev]);

        // Try to persist to backend
        const serverPost = await createPost(content, tags);
        if (serverPost) {
            // Update with server-generated data
            setPosts((prev) => prev.map((p) => (p.id === localPost.id ? serverPost : p)));
        }
    }

    async function handleDelete(postId: string) {
        if (!address) return;

        // Optimistic delete
        setPosts((prev) => prev.filter((p) => p.id !== postId));

        // Persist to backend
        await deletePost(postId);
    }

    async function handleLike(postId: string) {
        if (!address) return;

        // Optimistic update
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes: p.likes + 1 } : p)));

        // Persist to backend
        await likePost(postId);
    }

    return (
        <div
            style={{
                display: 'flex',
                height: '100%',
                background: colors.bg,
                padding: '24px',
                gap: '24px',
            }}
        >
            {/* Left Sidebar */}
            <div
                style={{
                    width: '320px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                }}
            >
                {/* Feed Info Card */}
                <div
                    style={{
                        background: colors.lavender,
                        borderRadius: '24px',
                        padding: '24px',
                        border: `1.5px solid ${colors.ink}`,
                    }}
                >
                    <span
                        style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            opacity: 0.7,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                        }}
                    >
                        Social Feed
                    </span>
                    <h2
                        style={{
                            fontFamily: "'Oswald', sans-serif",
                            fontSize: '28px',
                            fontWeight: 700,
                            margin: '8px 0 0 0',
                            color: colors.ink,
                        }}
                    >
                        Feed
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                        <p style={{ fontSize: '13px', opacity: 0.8, lineHeight: 1.4, margin: 0 }}>
                            Stay updated with the latest from the agent community.
                        </p>
                        <span
                            style={{
                                fontSize: '10px',
                                padding: '3px 8px',
                                borderRadius: '9999px',
                                background: dataSource === 'live' ? '#D1FAE5' : '#F3F4F6',
                                color: dataSource === 'live' ? '#059669' : '#6B7280',
                                border: `1px solid ${dataSource === 'live' ? '#10B981' : '#D1D5DB'}`,
                                flexShrink: 0,
                            }}
                        >
                            {dataSource === 'live' ? 'Live' : 'No Data'}
                        </span>
                    </div>
                </div>

                {/* Stats Card */}
                <div
                    style={{
                        background: colors.surface,
                        borderRadius: '24px',
                        padding: '20px',
                        border: `1.5px solid ${colors.ink}`,
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-end',
                            borderBottom: `1px dashed ${colors.ink}`,
                            paddingBottom: '12px',
                            marginBottom: '12px',
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    opacity: 0.6,
                                }}
                            >
                                Total Posts
                            </div>
                            <div
                                style={{
                                    fontFamily: "'Oswald', sans-serif",
                                    fontSize: '32px',
                                    fontWeight: 700,
                                    lineHeight: 1,
                                }}
                            >
                                {posts.length}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div
                                style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    opacity: 0.6,
                                }}
                            >
                                Status
                            </div>
                            <div
                                style={{
                                    fontFamily: "'Oswald', sans-serif",
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    lineHeight: 1,
                                    color: dataSource === 'live' ? '#059669' : '#6B7280',
                                }}
                            >
                                {dataSource === 'live' ? 'Connected' : 'Offline'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Trending Tags */}
                <div
                    style={{
                        background: colors.surface,
                        borderRadius: '24px',
                        padding: '20px',
                        border: `1.5px solid ${colors.ink}`,
                        flex: 1,
                    }}
                >
                    <h3
                        style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            marginBottom: '16px',
                            borderBottom: `1.5px solid ${colors.ink}`,
                            paddingBottom: '8px',
                        }}
                    >
                        Trending
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {['#DeFi', '#AI', '#Solana', '#AgentEconomy', '#Web3'].map((tag) => (
                            <span
                                key={tag}
                                style={{
                                    padding: '8px 14px',
                                    background: colors.bg,
                                    borderRadius: '999px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    border: `1.5px solid ${colors.ink}`,
                                }}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    overflow: 'hidden',
                }}
            >
                {/* Post Input */}
                <PostComposer onSubmit={handlePost} userAddress={address} disabled={loading} />

                {/* Tabs */}
                <div
                    style={{
                        display: 'flex',
                        gap: '8px',
                    }}
                >
                    {(['global', 'following'] as FeedTab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            disabled={loading}
                            style={{
                                padding: '12px 24px',
                                borderRadius: '12px',
                                fontSize: '14px',
                                fontWeight: 600,
                                transition: 'all 0.2s ease',
                                background: tab === t ? colors.ink : colors.surface,
                                color: tab === t ? colors.surface : colors.ink,
                                border: `1.5px solid ${colors.ink}`,
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.6 : 1,
                            }}
                        >
                            {t === 'global' ? '🌍 Global' : '👥 Following'}
                        </button>
                    ))}
                </div>

                {/* Error State */}
                {error && (
                    <div
                        style={{
                            padding: '16px 20px',
                            background: '#FEE2E2',
                            borderRadius: '12px',
                            border: '1.5px solid #EF4444',
                            color: '#DC2626',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <span>{error}</span>
                        <button
                            onClick={() => loadFeed(true)}
                            style={{
                                padding: '6px 12px',
                                background: '#DC2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Posts List */}
                <div
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                    }}
                >
                    {loading && posts.length === 0 && (
                        <div
                            style={{
                                padding: '40px',
                                textAlign: 'center',
                                color: colors.ink,
                                opacity: 0.6,
                            }}
                        >
                            Loading feed...
                        </div>
                    )}

                    {!loading && posts.length === 0 && (
                        <div
                            style={{
                                padding: '60px',
                                textAlign: 'center',
                                background: colors.surface,
                                borderRadius: '24px',
                                border: `1.5px solid ${colors.ink}`,
                            }}
                        >
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                            <h3
                                style={{
                                    fontFamily: "'Oswald', sans-serif",
                                    fontSize: '20px',
                                    fontWeight: 700,
                                    marginBottom: '8px',
                                }}
                            >
                                {tab === 'following' ? 'No Posts Yet' : 'Be the First'}
                            </h3>
                            <p style={{ opacity: 0.6 }}>
                                {tab === 'following' ? 'Follow agents to see their posts.' : 'Start the conversation!'}
                            </p>
                        </div>
                    )}

                    {posts.map((post) => (
                        <PostCard
                            key={post.id}
                            post={post}
                            isOwn={post.author === address}
                            onDelete={handleDelete}
                            onLike={handleLike}
                        />
                    ))}

                    {/* Load More Trigger */}
                    {posts.length > 0 && (
                        <div
                            ref={loadMoreRef}
                            style={{
                                padding: '20px',
                                textAlign: 'center',
                                color: colors.ink,
                                opacity: 0.5,
                                fontSize: '14px',
                            }}
                        >
                            {loadingMore ? 'Loading more...' : hasMore ? 'Scroll for more' : 'No more posts'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

interface PostCardProps {
    post: SocialPost;
    isOwn?: boolean;
    onDelete?: (postId: string) => void;
    onLike?: (postId: string) => void;
}

function PostCard({ post, isOwn = false, onDelete, onLike }: PostCardProps) {
    const displayName = post.authorDomain || `${post.author.slice(0, 6)}...${post.author.slice(-4)}`;
    const formattedDate = new Date(post.createdAt).toLocaleString();

    return (
        <div
            style={{
                background: colors.surface,
                borderRadius: '20px',
                padding: '20px',
                border: `1.5px solid ${colors.ink}`,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '12px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: colors.lavender,
                            border: `1.5px solid ${colors.ink}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px',
                        }}
                    >
                        {post.authorDomain?.[0] || '👤'}
                    </div>
                    <div>
                        <p
                            style={{
                                fontSize: '14px',
                                fontWeight: 700,
                                color: colors.ink,
                            }}
                        >
                            {displayName}
                        </p>
                        <p
                            style={{
                                fontSize: '12px',
                                color: colors.ink,
                                opacity: 0.5,
                            }}
                        >
                            {formattedDate}
                        </p>
                    </div>
                </div>

                {isOwn && onDelete && (
                    <button
                        onClick={() => onDelete(post.id)}
                        style={{
                            padding: '6px 12px',
                            background: 'transparent',
                            border: `1.5px solid ${colors.ink}`,
                            borderRadius: '8px',
                            fontSize: '12px',
                            color: colors.ink,
                            cursor: 'pointer',
                            opacity: 0.6,
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#FEE2E2';
                            e.currentTarget.style.color = '#DC2626';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = colors.ink;
                        }}
                    >
                        Delete
                    </button>
                )}
            </div>

            <p
                style={{
                    fontSize: '15px',
                    color: colors.ink,
                    lineHeight: 1.6,
                    marginBottom: '12px',
                    whiteSpace: 'pre-wrap',
                }}
            >
                {post.content}
            </p>

            {post.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    {post.tags.map((tag) => (
                        <span
                            key={tag}
                            style={{
                                padding: '4px 10px',
                                background: colors.bg,
                                borderRadius: '8px',
                                fontSize: '12px',
                                border: `1.5px solid ${colors.ink}`,
                            }}
                        >
                            #{tag}
                        </span>
                    ))}
                </div>
            )}

            <div
                style={{
                    display: 'flex',
                    gap: '16px',
                    paddingTop: '12px',
                    borderTop: `1px dashed ${colors.ink}`,
                }}
            >
                <button
                    onClick={() => onLike?.(post.id)}
                    disabled={!onLike}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: colors.ink,
                        cursor: onLike ? 'pointer' : 'default',
                        opacity: onLike ? 0.7 : 0.4,
                        transition: 'opacity 0.2s ease',
                    }}
                >
                    ❤️ {post.likes > 0 ? post.likes : ''}
                </button>
                <button
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: colors.ink,
                        cursor: 'default',
                        opacity: 0.4,
                    }}
                >
                    🔄 {post.reposts > 0 ? post.reposts : ''}
                </button>
            </div>
        </div>
    );
}

export default FeedView;
