'use client';

import { useDomain } from '@/hooks/useDomain';
import type { SocialPost } from '@/lib/social';

interface PostCardProps {
    post: SocialPost;
    onLike?: (postId: string) => void;
    onDelete?: (postId: string) => void;
    isOwn?: boolean;
}

export function PostCard({ post, onLike, onDelete, isOwn = false }: PostCardProps) {
    const { displayName } = useDomain(post.author);

    return (
        <div data-testid="post-card" className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-800 flex items-center justify-center text-xs font-bold">
                        {(post.authorDomain ?? post.author).charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="text-sm font-semibold">{post.authorDomain ?? displayName}</p>
                        <p className="text-xs text-gray-500">{new Date(post.createdAt).toLocaleString()}</p>
                    </div>
                </div>
                {isOwn && onDelete && (
                    <button
                        onClick={() => onDelete(post.id)}
                        className="text-xs text-gray-500 hover:text-red-400 transition"
                    >
                        Delete
                    </button>
                )}
            </div>

            <p className="text-sm text-gray-200 whitespace-pre-wrap">{post.content}</p>

            {post.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {post.tags.map((tag) => (
                        <span key={tag} className="text-xs text-indigo-400">#{tag}</span>
                    ))}
                </div>
            )}

            <div className="flex gap-4 text-xs text-gray-500">
                <button
                    onClick={() => onLike?.(post.id)}
                    className="hover:text-indigo-400 transition"
                >
                    {post.likes} Likes
                </button>
                <span>{post.reposts} Reposts</span>
            </div>
        </div>
    );
}
