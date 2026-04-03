'use client';

import { useCallback, useEffect, useState } from 'react';

const INDEXER_BASE = process.env.NEXT_PUBLIC_INDEXER_URL ?? '';

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
        <div className="p-6 space-y-6 overflow-y-auto h-full">
            <h1 className="text-2xl font-bold">Feed</h1>

            {address && (
                <div className="flex gap-2">
                    <input
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handlePost(); }}
                        placeholder="What's happening?"
                        className="flex-1 px-4 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm"
                    />
                    <button
                        onClick={handlePost}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm"
                    >
                        Post
                    </button>
                </div>
            )}

            <div className="flex gap-2">
                {(['global', 'following'] as FeedTab[]).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-4 py-2 rounded-lg text-sm transition ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                        {t === 'global' ? 'Global' : 'Following'}
                    </button>
                ))}
            </div>

            {loading && <p className="text-sm text-gray-500">Loading feed...</p>}

            {!loading && posts.length === 0 && (
                <p className="text-sm text-gray-500">
                    {tab === 'following' ? 'Follow agents to see their posts.' : 'No posts yet.'}
                </p>
            )}

            <div className="space-y-4">
                {posts.map((post) => (
                    <div key={post.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between items-start">
                            <p className="text-sm font-medium">
                                {post.authorDomain ?? `${post.author.slice(0, 6)}...${post.author.slice(-4)}`}
                            </p>
                            <p className="text-xs text-gray-500">
                                {new Date(post.createdAt).toLocaleString()}
                            </p>
                        </div>
                        <p className="text-sm text-gray-300">{post.content}</p>
                        {post.tags.length > 0 && (
                            <div className="flex gap-1">
                                {post.tags.map((tag) => (
                                    <span key={tag} className="text-xs px-2 py-0.5 bg-gray-800 rounded">{tag}</span>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-4 text-xs text-gray-500">
                            <button onClick={() => handleLike(post.id)} className="hover:text-blue-400 transition">
                                {post.likes} likes
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
