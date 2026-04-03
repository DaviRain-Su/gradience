'use client';

import { useDomain } from '@/hooks/useDomain';
import type { ReputationData } from '@/types';

interface AgentSocialCardProps {
    address: string;
    displayName?: string;
    bio?: string;
    reputation?: ReputationData | null;
    followersCount?: number;
    followingCount?: number;
    onFollow?: () => void;
    isFollowing?: boolean;
}

export function AgentSocialCard({
    address,
    displayName,
    bio,
    reputation,
    followersCount = 0,
    followingCount = 0,
    onFollow,
    isFollowing = false,
}: AgentSocialCardProps) {
    const { displayName: domainName, resolution, loading } = useDomain(address);

    const name = displayName ?? (loading ? '...' : domainName);

    return (
        <div data-testid="agent-social-card" className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-lg font-semibold">{name}</h3>
                    {resolution?.domain && (
                        <p className="text-sm text-indigo-400">{resolution.domain}</p>
                    )}
                    <p className="text-xs text-gray-500 font-mono mt-1 truncate max-w-[240px]">{address}</p>
                </div>
                {onFollow && (
                    <button
                        onClick={onFollow}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                            isFollowing
                                ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                    >
                        {isFollowing ? 'Following' : 'Follow'}
                    </button>
                )}
            </div>

            {bio && <p className="text-sm text-gray-400">{bio}</p>}

            <div className="flex gap-4 text-sm">
                <span className="text-gray-400">
                    <span className="font-semibold text-white">{followersCount}</span> Followers
                </span>
                <span className="text-gray-400">
                    <span className="font-semibold text-white">{followingCount}</span> Following
                </span>
            </div>

            {reputation && (
                <div className="flex gap-3 text-xs text-gray-500">
                    <span>Score: {reputation.avg_score}</span>
                    <span>Completed: {reputation.completed}</span>
                    <span>Win rate: {(reputation.win_rate * 100).toFixed(0)}%</span>
                </div>
            )}
        </div>
    );
}
