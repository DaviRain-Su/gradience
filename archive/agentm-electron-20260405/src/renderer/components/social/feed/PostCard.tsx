import { useCallback, useState } from 'react';
import type { AgentInfo } from '../../../../shared/a2a-router-types.ts';

export type PostType =
    | 'agent_join'
    | 'task_created'
    | 'task_completed'
    | 'achievement_earned'
    | 'system_update'
    | 'direct_message';

export interface Post {
    id: string;
    type: PostType;
    author: {
        address: string;
        displayName: string;
        avatarUrl?: string;
        capabilities?: string[];
    };
    content: string;
    metadata: {
        taskId?: number;
        score?: number;
        reward?: number;
        category?: string;
        txHash?: string;
        relatedAgents?: string[];
    };
    engagement: {
        likes: number;
        comments: number;
        shares: number;
        liked: boolean;
    };
    timestamp: number;
    protocol?: string;
}

interface PostCardProps {
    post: Post;
    onLike?: (postId: string) => void | Promise<void>;
    onComment?: (postId: string) => void;
    onShare?: (postId: string) => void;
    onAgentClick?: (address: string) => void;
    onTaskClick?: (taskId: number) => void;
    compact?: boolean;
}

const POST_TYPE_CONFIG: Record<PostType, { label: string; color: string; icon: string }> = {
    agent_join: { label: 'New Agent', color: 'text-emerald-400', icon: '👋' },
    task_created: { label: 'New Task', color: 'text-blue-400', icon: '📋' },
    task_completed: { label: 'Completed', color: 'text-purple-400', icon: '✅' },
    achievement_earned: { label: 'Achievement', color: 'text-amber-400', icon: '🏆' },
    system_update: { label: 'System', color: 'text-gray-400', icon: '⚙️' },
    direct_message: { label: 'Message', color: 'text-pink-400', icon: '💬' },
};

function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
}

export function PostCard({
    post,
    onLike,
    onComment,
    onShare,
    onAgentClick,
    onTaskClick,
    compact = false,
}: PostCardProps) {
    const [isLiking, setIsLiking] = useState(false);
    const config = POST_TYPE_CONFIG[post.type];

    const handleLike = useCallback(async () => {
        if (!onLike || isLiking || post.engagement.liked) return;
        setIsLiking(true);
        try {
            await onLike(post.id);
        } finally {
            setIsLiking(false);
        }
    }, [onLike, post.id, isLiking, post.engagement.liked]);

    const handleAgentClick = useCallback(() => {
        onAgentClick?.(post.author.address);
    }, [onAgentClick, post.author.address]);

    const handleTaskClick = useCallback(() => {
        if (post.metadata.taskId) {
            onTaskClick?.(post.metadata.taskId);
        }
    }, [onTaskClick, post.metadata.taskId]);

    if (compact) {
        return (
            <div className="bg-gray-950 rounded-lg p-3 border border-gray-800/50 hover:border-gray-700 transition">
                <div className="flex items-start gap-3">
                    <div
                        onClick={handleAgentClick}
                        className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-sm font-bold cursor-pointer hover:opacity-80 transition flex-shrink-0"
                    >
                        {post.author.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                            <span
                                onClick={handleAgentClick}
                                className="font-medium text-gray-200 cursor-pointer hover:text-blue-400 transition truncate"
                            >
                                {post.author.displayName}
                            </span>
                            <span className="text-gray-500 text-xs">{formatTimeAgo(post.timestamp)}</span>
                        </div>
                        <p className="text-gray-300 text-sm mt-0.5 line-clamp-2">{post.content}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-950 rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div
                        onClick={handleAgentClick}
                        className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-lg font-bold cursor-pointer hover:opacity-80 transition flex-shrink-0"
                    >
                        {post.author.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span
                                onClick={handleAgentClick}
                                className="font-medium text-gray-200 cursor-pointer hover:text-blue-400 transition"
                            >
                                {post.author.displayName}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full bg-gray-900 ${config.color}`}>
                                <span className="mr-1">{config.icon}</span>
                                {config.label}
                            </span>
                            {post.protocol && (
                                <span className="text-xs text-gray-500 bg-gray-900 px-2 py-0.5 rounded-full">
                                    {post.protocol}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 font-mono truncate max-w-[200px]">
                            {post.author.address.slice(0, 8)}...{post.author.address.slice(-8)}
                        </p>
                    </div>
                </div>
                <span className="text-xs text-gray-500">{formatTimeAgo(post.timestamp)}</span>
            </div>

            {/* Content */}
            <div className="mt-3">
                <p className="text-gray-200 leading-relaxed">{post.content}</p>

                {/* Metadata badges */}
                {post.metadata.taskId && (
                    <div className="flex flex-wrap gap-2 mt-3">
                        <button
                            onClick={handleTaskClick}
                            className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded hover:bg-blue-600/30 transition"
                        >
                            Task #{post.metadata.taskId}
                        </button>
                        {post.metadata.score !== undefined && (
                            <span className="text-xs bg-emerald-600/20 text-emerald-400 px-2 py-1 rounded">
                                Score: {post.metadata.score.toFixed(1)}
                            </span>
                        )}
                        {post.metadata.reward !== undefined && (
                            <span className="text-xs bg-amber-600/20 text-amber-400 px-2 py-1 rounded">
                                Reward: {post.metadata.reward} SOL
                            </span>
                        )}
                        {post.metadata.category && (
                            <span className="text-xs bg-purple-600/20 text-purple-400 px-2 py-1 rounded">
                                {post.metadata.category}
                            </span>
                        )}
                        {post.metadata.txHash && (
                            <a
                                href={`https://solscan.io/tx/${post.metadata.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded hover:bg-gray-700 transition"
                            >
                                View TX
                            </a>
                        )}
                    </div>
                )}

                {/* Capabilities */}
                {post.author.capabilities && post.author.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                        {post.author.capabilities.map((cap) => (
                            <span key={cap} className="text-xs bg-gray-900 text-gray-500 px-2 py-0.5 rounded">
                                {cap}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Engagement */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-800">
                <button
                    onClick={handleLike}
                    disabled={isLiking || !onLike}
                    className={`flex items-center gap-1.5 text-sm transition ${
                        post.engagement.liked ? 'text-pink-400' : 'text-gray-500 hover:text-pink-400'
                    } disabled:opacity-50`}
                >
                    <span>{post.engagement.liked ? '❤️' : '🤍'}</span>
                    <span>{post.engagement.likes}</span>
                </button>
                <button
                    onClick={() => onComment?.(post.id)}
                    disabled={!onComment}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-400 transition disabled:opacity-50"
                >
                    <span>💬</span>
                    <span>{post.engagement.comments}</span>
                </button>
                <button
                    onClick={() => onShare?.(post.id)}
                    disabled={!onShare}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-emerald-400 transition disabled:opacity-50"
                >
                    <span>🔁</span>
                    <span>{post.engagement.shares}</span>
                </button>
            </div>
        </div>
    );
}
