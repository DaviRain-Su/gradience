'use client';

import { useEffect, useMemo, useState } from 'react';
import { useProStore } from '@/lib/store';
import type { SocialReputationEntry, SocialReputationFeed } from '@/lib/social';
import { loadSocialReputationFeed } from '@/lib/social';

export function SocialView({ owner }: { owner: string }) {
    const profiles = useProStore((state) => state.profiles);
    const [feed, setFeed] = useState<SocialReputationFeed | null>(null);
    const [loading, setLoading] = useState(false);

    const seedAgents = useMemo(() => {
        const agents = new Set<string>();
        agents.add(owner);
        for (const profile of profiles) {
            agents.add(profile.owner);
        }
        return Array.from(agents);
    }, [owner, profiles]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        loadSocialReputationFeed(seedAgents)
            .then((next) => {
                if (!cancelled) setFeed(next);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [seedAgents]);

    return (
        <div className="space-y-6" data-testid="social-view">
            <div>
                <h1 className="text-3xl font-bold">Social Reputation</h1>
                <p className="text-gray-400 mt-1">
                    ChainHub reputation is synced through Indexer into this social graph.
                </p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm space-y-1">
                <p>
                    data_flow:{' '}
                    <span className="text-gray-300">Chain Hub → Indexer → AgentM Pro Social</span>
                </p>
                <p>
                    source:{' '}
                    <span data-testid="social-source-value" className="font-medium">
                        {feed?.source ?? 'loading'}
                    </span>
                </p>
                <p className="text-xs text-gray-500">
                    updated_at:{' '}
                    <span data-testid="social-updated-at">
                        {feed ? new Date(feed.updatedAt).toLocaleString() : '-'}
                    </span>
                </p>
            </div>

            {loading && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400">Loading social reputation feed...</p>
                </div>
            )}

            {!loading && feed && feed.items.length === 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-400">No reputation profiles found yet.</p>
                </div>
            )}

            {!loading && feed && feed.items.length > 0 && (
                <div className="space-y-3">
                    {feed.items.map((item) => (
                        <SocialRow key={item.address} item={item} />
                    ))}
                </div>
            )}
        </div>
    );
}

function SocialRow({ item }: { item: SocialReputationEntry }) {
    return (
        <div
            data-testid={`social-row-${item.rank}`}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4"
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs text-gray-500">#{item.rank}</p>
                    <p className="text-lg font-semibold mt-1">{item.displayName}</p>
                    <p className="text-xs text-gray-500 mt-1 font-mono">{item.address}</p>
                    <p className="text-sm text-gray-400 mt-2">{item.bio}</p>
                </div>
                <div className="text-right space-y-1">
                    {item.verifiedBadge && (
                        <span
                            data-testid={`social-verified-${item.rank}`}
                            className="inline-block text-xs px-2 py-1 rounded bg-emerald-900 text-emerald-300"
                        >
                            Verified
                        </span>
                    )}
                    <p data-testid={`social-trust-${item.rank}`} className="text-sm">
                        trust_score: <span className="font-semibold">{item.trustScore}</span>
                    </p>
                    <p className="text-xs text-gray-400">policy: {item.interactionPolicy}</p>
                    <p className="text-xs text-gray-400">
                        rep: {item.reputation?.avgScore ?? 0} / completed: {item.reputation?.completed ?? 0}
                    </p>
                </div>
            </div>
        </div>
    );
}
