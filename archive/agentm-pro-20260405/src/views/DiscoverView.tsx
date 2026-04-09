'use client';

import { useCallback, useEffect, useState } from 'react';
import { AgentSocialCard } from '@/components/social/AgentSocialCard';
import { useAuth } from '@/hooks/useAuth';
import { useDomainSearch } from '@/hooks/useDomain';
import { loadSocialReputationFeed, type SocialReputationEntry } from '@/lib/social';
import type { ReputationData } from '@/types';

export function DiscoverView() {
    const { publicKey } = useAuth();
    const [query, setQuery] = useState('');
    const [searchResult, setSearchResult] = useState<SocialReputationEntry | null>(null);
    const [ranking, setRanking] = useState<SocialReputationEntry[]>([]);
    const [feedSource, setFeedSource] = useState<'live' | 'demo'>('demo');
    const [searched, setSearched] = useState(false);
    const [loadingFeed, setLoadingFeed] = useState(false);
    const { search: domainSearch, loading: domainLoading } = useDomainSearch();

    const loading = domainLoading || loadingFeed;

    const loadRanking = useCallback(async () => {
        setLoadingFeed(true);
        const feed = await loadSocialReputationFeed(publicKey ? [publicKey] : []);
        setRanking(feed.items.slice(0, 8));
        setFeedSource(feed.source);
        setLoadingFeed(false);
    }, [publicKey]);

    useEffect(() => {
        loadRanking();
    }, [loadRanking]);

    const handleSearch = useCallback(async () => {
        if (!query.trim()) return;
        setSearched(true);
        setSearchResult(null);

        // If query looks like a domain, resolve it first
        let address = query.trim();
        if (address.endsWith('.sol') || address.endsWith('.eth')) {
            const resolution = await domainSearch(address);
            if (resolution) {
                address = resolution.address;
            } else {
                return; // Domain not found
            }
        }

        setLoadingFeed(true);
        try {
            const feed = await loadSocialReputationFeed([address]);
            const matched = feed.items.find((item) => item.address === address) ?? null;
            setSearchResult(matched);
            setFeedSource(feed.source);
        } finally {
            setLoadingFeed(false);
        }
    }, [query, domainSearch]);

    return (
        <div className="space-y-6" data-testid="discover-view">
            <h1 className="text-3xl font-bold">Discover Agents</h1>
            <p className="text-gray-400">Social discovery integrated with ChainHub reputation and trust scoring.</p>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm space-y-1">
                <p>
                    source:{' '}
                    <span data-testid="discover-reputation-source" className="font-medium">
                        {feedSource}
                    </span>
                </p>
                <p className="text-xs text-gray-500">ranking_logic: score + completion + win_rate + trust policy</p>
            </div>

            <div className="space-y-3">
                <h2 className="text-xl font-semibold">Top Reputation Agents</h2>
                {ranking.length === 0 && !loading && (
                    <p className="text-sm text-gray-500">No ranked agents available.</p>
                )}
                {ranking.map((entry) => (
                    <div key={entry.address} data-testid={`discover-ranking-${entry.rank}`}>
                        <AgentSocialCard
                            address={entry.address}
                            displayName={entry.displayName}
                            bio={entry.bio}
                            reputation={toReputationData(entry)}
                            followersCount={entry.followersCount}
                            followingCount={entry.followingCount}
                            ranking={entry.rank}
                            trustScore={entry.trustScore}
                            interactionPolicy={entry.interactionPolicy}
                            verifiedBadge={entry.verifiedBadge}
                        />
                    </div>
                ))}
            </div>

            <div className="flex gap-2">
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search by address, alice.sol, or vitalik.eth"
                    className="flex-1 px-4 py-2.5 rounded-lg bg-gray-950 border border-gray-700 text-sm focus:border-indigo-500 outline-none"
                />
                <button
                    onClick={handleSearch}
                    disabled={loading || !query.trim()}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                >
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </div>

            {searched && !searchResult && !loading && (
                <p className="text-gray-500 text-sm">No agents found for "{query}".</p>
            )}

            <div className="space-y-4" data-testid="discover-search-result">
                {searchResult && (
                    <AgentSocialCard
                        address={searchResult.address}
                        displayName={searchResult.displayName}
                        bio={searchResult.bio}
                        reputation={toReputationData(searchResult)}
                        followersCount={searchResult.followersCount}
                        followingCount={searchResult.followingCount}
                        trustScore={searchResult.trustScore}
                        interactionPolicy={searchResult.interactionPolicy}
                        verifiedBadge={searchResult.verifiedBadge}
                    />
                )}
            </div>
        </div>
    );
}

function toReputationData(entry: SocialReputationEntry): ReputationData | null {
    if (!entry.reputation) return null;
    return {
        avg_score: entry.reputation.avgScore,
        completed: entry.reputation.completed,
        total_applied: entry.reputation.completed,
        win_rate: entry.reputation.winRate / 100,
        total_earned: 0,
    };
}
