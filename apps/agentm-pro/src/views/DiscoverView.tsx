'use client';

import { useCallback, useState } from 'react';
import { AgentSocialCard } from '@/components/social/AgentSocialCard';
import { useDomainSearch } from '@/hooks/useDomain';
import { useIndexer } from '@/hooks/useIndexer';
import type { AgentProfileApi } from '@/lib/indexer';

export function DiscoverView() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<AgentProfileApi[]>([]);
    const [searched, setSearched] = useState(false);
    const { search: domainSearch, loading: domainLoading } = useDomainSearch();
    const { getAgentProfile, loading: indexerLoading } = useIndexer();

    const loading = domainLoading || indexerLoading;

    const handleSearch = useCallback(async () => {
        if (!query.trim()) return;
        setSearched(true);
        setResults([]);

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

        // Fetch profile from indexer
        const profile = await getAgentProfile(address);
        if (profile) {
            setResults([profile]);
        }
    }, [query, domainSearch, getAgentProfile]);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Discover Agents</h1>
            <p className="text-gray-400">Search for agents by address or .sol/.eth domain name.</p>

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

            {searched && results.length === 0 && !loading && (
                <p className="text-gray-500 text-sm">No agents found for "{query}".</p>
            )}

            <div className="space-y-4">
                {results.map((profile) => (
                    <AgentSocialCard
                        key={profile.agent}
                        address={profile.agent}
                        displayName={profile.display_name}
                        bio={profile.bio}
                    />
                ))}
            </div>
        </div>
    );
}
