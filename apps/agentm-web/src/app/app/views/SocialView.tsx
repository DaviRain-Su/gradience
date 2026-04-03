'use client';

import { useCallback, useEffect, useState } from 'react';

const INDEXER_BASE = process.env.NEXT_PUBLIC_INDEXER_URL ?? '';

interface AgentSocialProfile {
    address: string;
    domain: string | null;
    displayName: string;
    bio: string;
    avatar: string | null;
    reputation: { avgScore: number; completed: number; winRate: number } | null;
    followersCount: number;
    followingCount: number;
    createdAt: number;
}

interface NotificationItem {
    id: string;
    type: string;
    actor: string;
    message: string;
    read: boolean;
    createdAt: number;
}

export function SocialView({ address }: { address: string | null }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<AgentSocialProfile[]>([]);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(false);

    const search = useCallback(async () => {
        if (!INDEXER_BASE) return;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.set('q', searchQuery);
            params.set('limit', '20');
            const res = await fetch(`${INDEXER_BASE}/api/social/search?${params}`);
            if (res.ok) setResults(await res.json());
        } catch { /* offline */ }
        finally { setLoading(false); }
    }, [searchQuery]);

    useEffect(() => {
        if (!address || !INDEXER_BASE) return;
        Promise.all([
            fetch(`${INDEXER_BASE}/api/social/notifications/${address}?limit=10`)
                .then((r) => r.ok ? r.json() : [])
                .catch(() => []),
            fetch(`${INDEXER_BASE}/api/social/notifications/${address}/unread`)
                .then((r) => r.ok ? r.json() : { count: 0 })
                .catch(() => ({ count: 0 })),
        ]).then(([notifs, countData]) => {
            setNotifications(notifs);
            setUnread(countData.count);
        });
    }, [address]);

    async function handleFollow(target: string) {
        if (!address || !INDEXER_BASE) return;
        await fetch(`${INDEXER_BASE}/api/social/follow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ follower: address, following: target }),
        }).catch(() => {});
    }

    async function markAllRead() {
        if (!address || !INDEXER_BASE) return;
        await fetch(`${INDEXER_BASE}/api/social/notifications/${address}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        }).catch(() => {});
        setUnread(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }

    return (
        <div className="p-6 space-y-6 overflow-y-auto h-full">
            <h1 className="text-2xl font-bold">Social</h1>

            {/* Search */}
            <div className="space-y-3">
                <div className="flex gap-2">
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
                        placeholder="Search agents by name, domain, or skill..."
                        className="flex-1 px-4 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm"
                    />
                    <button onClick={search} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm">
                        Search
                    </button>
                </div>

                {loading && <p className="text-sm text-gray-500">Searching...</p>}

                {results.length > 0 && (
                    <div className="space-y-3">
                        {results.map((agent) => (
                            <div key={agent.address} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold">
                                            {agent.displayName || agent.domain || `${agent.address.slice(0, 8)}...`}
                                        </p>
                                        {agent.domain && <p className="text-xs text-blue-400">{agent.domain}</p>}
                                        <p className="text-sm text-gray-400 mt-1">{agent.bio}</p>
                                        <div className="flex gap-3 text-xs text-gray-500 mt-2">
                                            <span>{agent.followersCount} followers</span>
                                            <span>{agent.followingCount} following</span>
                                            {agent.reputation && (
                                                <span>Score: {agent.reputation.avgScore}</span>
                                            )}
                                        </div>
                                    </div>
                                    {address && address !== agent.address && (
                                        <button
                                            onClick={() => handleFollow(agent.address)}
                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs"
                                        >
                                            Follow
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Notifications */}
            {address && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">
                            Notifications {unread > 0 && <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full ml-2">{unread}</span>}
                        </h2>
                        {unread > 0 && (
                            <button onClick={markAllRead} className="text-xs text-blue-400 hover:text-blue-300">
                                Mark all read
                            </button>
                        )}
                    </div>
                    {notifications.length === 0 && (
                        <p className="text-sm text-gray-500">No notifications yet.</p>
                    )}
                    {notifications.map((n) => (
                        <div key={n.id} className={`bg-gray-900 border rounded-xl p-3 text-sm ${n.read ? 'border-gray-800' : 'border-blue-800'}`}>
                            <p className="text-gray-300">{n.message}</p>
                            <p className="text-xs text-gray-500 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
