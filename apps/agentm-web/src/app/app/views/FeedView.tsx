'use client';

import { useCallback, useEffect, useState } from 'react';

const INDEXER_BASE = process.env.NEXT_PUBLIC_INDEXER_URL ?? '';

const colors = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
};

interface SocialPost {
    id: string;
    author: string;
    authorDomain: string | null;
    content: string;
    tags: string[];
    likes: number;
    reposts: number;
    createdAt: number;
}

type FeedTab = 'global' | 'following';

export function FeedView({ address }: { address: string | null }) {
    const [tab, setTab] = useState<FeedTab>('global');
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [loading, setLoading] = useState(false);
    const [newContent, setNewContent] = useState('');

    const loadFeed = useCallback(async () => {
        if (!INDEXER_BASE) return;
        setLoading(true);
        try {
            const endpoint = tab === 'following' && address
                ? `${INDEXER_BASE}/api/social/feed/${address}?limit=20`
                : `${INDEXER_BASE}/api/social/feed/global?limit=20`;
            const res = await fetch(endpoint);
            if (res.ok) setPosts(await res.json());
        } catch { /* indexer may be offline */ }
        finally { setLoading(false); }
    }, [tab, address]);

    useEffect(() => { loadFeed(); }, [loadFeed]);

    async function handlePost() {
        if (!address || !newContent.trim() || !INDEXER_BASE) return;
        try {
            const res = await fetch(`${INDEXER_BASE}/api/social/posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ author: address, content: newContent, tags: [] }),
            });
            if (res.ok) {
                const post = await res.json();
                setPosts((prev) => [post, ...prev]);
                setNewContent('');
            }
        } catch { /* offline */ }
    }

    async function handleLike(postId: string) {
        if (!address || !INDEXER_BASE) return;
        try {
            await fetch(`${INDEXER_BASE}/api/social/posts/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postId, liker: address }),
            });
            setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likes: p.likes + 1 } : p));
        } catch { /* offline */ }
    }

    return (
        <div style={{
            display: 'flex',
            height: '100%',
            background: colors.bg,
            padding: '24px',
            gap: '24px',
        }}>
            {/* Left Sidebar */}
            <div style={{
                width: '320px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
            }}>
                {/* Feed Info Card */}
                <div style={{
                    background: colors.lavender,
                    borderRadius: '24px',
                    padding: '24px',
                    border: `1.5px solid ${colors.ink}`,
                }}>
                    <span style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        opacity: 0.7,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                    }}>Social Feed</span>
                    <h2 style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontSize: '28px',
                        fontWeight: 700,
                        margin: '8px 0 0 0',
                        color: colors.ink,
                    }}>Feed</h2>
                    <p style={{
                        fontSize: '13px',
                        opacity: 0.8,
                        marginTop: '8px',
                        lineHeight: 1.4,
                    }}>
                        Stay updated with the latest from the agent community.
                    </p>
                </div>

                {/* Stats Card */}
                <div style={{
                    background: colors.surface,
                    borderRadius: '24px',
                    padding: '20px',
                    border: `1.5px solid ${colors.ink}`,
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        borderBottom: `1px dashed ${colors.ink}`,
                        paddingBottom: '12px',
                        marginBottom: '12px',
                    }}>
                        <div>
                            <div style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                opacity: 0.6,
                            }}>Total Posts</div>
                            <div style={{
                                fontFamily: "'Oswald', sans-serif",
                                fontSize: '32px',
                                fontWeight: 700,
                                lineHeight: 1,
                            }}>{posts.length}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                opacity: 0.6,
                            }}>Active Now</div>
                            <div style={{
                                fontFamily: "'Oswald', sans-serif",
                                fontSize: '32px',
                                fontWeight: 700,
                                lineHeight: 1,
                            }}>24</div>
                        </div>
                    </div>
                </div>

                {/* Trending Tags */}
                <div style={{
                    background: colors.surface,
                    borderRadius: '24px',
                    padding: '20px',
                    border: `1.5px solid ${colors.ink}`,
                    flex: 1,
                }}>
                    <h3 style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        marginBottom: '16px',
                        borderBottom: `1.5px solid ${colors.ink}`,
                        paddingBottom: '8px',
                    }}>Trending</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {['#DeFi', '#AI', '#Solana', '#AgentEconomy', '#Web3'].map((tag) => (
                            <span key={tag} style={{
                                padding: '8px 14px',
                                background: colors.bg,
                                borderRadius: '999px',
                                fontSize: '12px',
                                fontWeight: 600,
                                border: `1.5px solid ${colors.ink}`,
                            }}>
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                overflow: 'hidden',
            }}>
                {/* Post Input */}
                {address && (
                    <div style={{
                        background: colors.surface,
                        borderRadius: '24px',
                        padding: '20px',
                        border: `1.5px solid ${colors.ink}`,
                    }}>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '50%',
                                background: colors.lavender,
                                border: `1.5px solid ${colors.ink}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '18px',
                                flexShrink: 0,
                            }}>👤</div>
                            <div style={{ flex: 1 }}>
                                <textarea
                                    value={newContent}
                                    onChange={(e) => setNewContent(e.target.value)}
                                    placeholder="What's happening?"
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        border: `1.5px solid ${colors.ink}`,
                                        background: colors.bg,
                                        fontSize: '14px',
                                        resize: 'none',
                                        minHeight: '80px',
                                        fontFamily: 'inherit',
                                    }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                                    <button
                                        onClick={handlePost}
                                        disabled={!newContent.trim()}
                                        style={{
                                            padding: '10px 24px',
                                            background: colors.ink,
                                            color: colors.surface,
                                            border: 'none',
                                            borderRadius: '12px',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            cursor: newContent.trim() ? 'pointer' : 'not-allowed',
                                            opacity: newContent.trim() ? 1 : 0.5,
                                        }}
                                    >
                                        Post
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '8px',
                }}>
                    {(['global', 'following'] as FeedTab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            style={{
                                padding: '12px 24px',
                                borderRadius: '12px',
                                fontSize: '14px',
                                fontWeight: 600,
                                transition: 'all 0.2s ease',
                                background: tab === t ? colors.ink : colors.surface,
                                color: tab === t ? colors.surface : colors.ink,
                                border: `1.5px solid ${colors.ink}`,
                                cursor: 'pointer',
                            }}
                        >
                            {t === 'global' ? '🌍 Global' : '👥 Following'}
                        </button>
                    ))}
                </div>

                {/* Posts List */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                }}>
                    {loading && (
                        <div style={{
                            padding: '40px',
                            textAlign: 'center',
                            color: colors.ink,
                            opacity: 0.6,
                        }}>
                            Loading feed...
                        </div>
                    )}

                    {!loading && posts.length === 0 && (
                        <div style={{
                            padding: '60px',
                            textAlign: 'center',
                            background: colors.surface,
                            borderRadius: '24px',
                            border: `1.5px solid ${colors.ink}`,
                        }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                            <h3 style={{
                                fontFamily: "'Oswald', sans-serif",
                                fontSize: '20px',
                                fontWeight: 700,
                                marginBottom: '8px',
                            }}>
                                {tab === 'following' ? 'No Posts Yet' : 'Be the First'}
                            </h3>
                            <p style={{ opacity: 0.6 }}>
                                {tab === 'following' ? 'Follow agents to see their posts.' : 'Start the conversation!'}
                            </p>
                        </div>
                    )}

                    {posts.map((post) => (
                        <div key={post.id} style={{
                            background: colors.surface,
                            borderRadius: '20px',
                            padding: '20px',
                            border: `1.5px solid ${colors.ink}`,
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                marginBottom: '12px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        background: colors.lavender,
                                        border: `1.5px solid ${colors.ink}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '16px',
                                    }}>
                                        {post.authorDomain?.[0] || '👤'}
                                    </div>
                                    <div>
                                        <p style={{
                                            fontSize: '14px',
                                            fontWeight: 700,
                                            color: colors.ink,
                                        }}>
                                            {post.authorDomain ?? `${post.author.slice(0, 6)}...${post.author.slice(-4)}`}
                                        </p>
                                        <p style={{
                                            fontSize: '12px',
                                            color: colors.ink,
                                            opacity: 0.5,
                                        }}>
                                            {new Date(post.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            <p style={{
                                fontSize: '15px',
                                color: colors.ink,
                                lineHeight: 1.6,
                                marginBottom: '12px',
                            }}>{post.content}</p>
                            
                            {post.tags.length > 0 && (
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                    {post.tags.map((tag) => (
                                        <span key={tag} style={{
                                            padding: '4px 10px',
                                            background: colors.bg,
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            border: `1.5px solid ${colors.ink}`,
                                        }}>{tag}</span>
                                    ))}
                                </div>
                            )}
                            
                            <div style={{
                                display: 'flex',
                                gap: '16px',
                                paddingTop: '12px',
                                borderTop: `1px dashed ${colors.ink}`,
                            }}>
                                <button 
                                    onClick={() => handleLike(post.id)}
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
                                        cursor: 'pointer',
                                        opacity: 0.7,
                                    }}
                                >
                                    ❤️ {post.likes}
                                </button>
                                <button style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    background: 'transparent',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    color: colors.ink,
                                    cursor: 'pointer',
                                    opacity: 0.7,
                                }}>
                                    🔄 {post.reposts}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
