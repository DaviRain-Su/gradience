'use client';

import { useCallback, useEffect, useState } from 'react';
import { PostCard } from '@/components/social/PostCard';
import { PostComposer } from '@/components/social/PostComposer';
import { useAuth } from '@/hooks/useAuth';
import { useSocial } from '@/hooks/useSocial';
import type { SocialPost } from '@/lib/social';

type FeedTab = 'following' | 'global';

export function FeedView() {
    const { publicKey } = useAuth();
    const { createPost, deletePost, getFeed, getGlobalFeed } = useSocial(publicKey);
    const [tab, setTab] = useState<FeedTab>('global');
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [loading, setLoading] = useState(false);

    const loadFeed = useCallback(async () => {
        setLoading(true);
        try {
            const data = tab === 'following' ? await getFeed() : await getGlobalFeed();
            setPosts(data);
        } catch {
            // API may not be live
        } finally {
            setLoading(false);
        }
    }, [tab, getFeed, getGlobalFeed]);

    useEffect(() => {
        loadFeed();
    }, [loadFeed]);

    async function handlePost(content: string, tags: string[]) {
        const post = await createPost(content, tags);
        if (post) {
            setPosts((prev) => [post, ...prev]);
        }
    }

    async function handleDelete(postId: string) {
        await deletePost(postId);
        setPosts((prev) => prev.filter((p) => p.id !== postId));
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Feed</h1>

            {publicKey && <PostComposer onSubmit={handlePost} />}

            <div className="flex gap-2">
                <TabButton active={tab === 'global'} onClick={() => setTab('global')}>
                    Global
                </TabButton>
                <TabButton active={tab === 'following'} onClick={() => setTab('following')}>
                    Following
                </TabButton>
            </div>

            {loading && <p className="text-sm text-gray-500">Loading feed...</p>}

            {!loading && posts.length === 0 && (
                <p className="text-sm text-gray-500">
                    {tab === 'following' ? 'Follow agents to see their posts here.' : 'No posts yet.'}
                </p>
            )}

            <div className="space-y-4">
                {posts.map((post) => (
                    <PostCard key={post.id} post={post} isOwn={post.author === publicKey} onDelete={handleDelete} />
                ))}
            </div>
        </div>
    );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                active ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
        >
            {children}
        </button>
    );
}
