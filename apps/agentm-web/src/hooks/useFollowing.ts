import { useState, useEffect, useCallback } from 'react';
import { useDaemonConnection } from '../lib/connection/useDaemonConnection';

export interface Following {
    address: string;
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
    followedAt: number;
    domain?: string;
    reputation?: number;
    capabilities?: string[];
}

export interface Follower {
    address: string;
    displayName?: string;
    avatarUrl?: string;
    isFollowing: boolean;
    followedAt: number;
    domain?: string;
    bio?: string;
    reputation?: number;
}

function authHeaders(token: string | null): Record<string, string> {
    const h: Record<string, string> = {};
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
}

// Hook for a specific user's following list
export function useFollowingList(userAddress: string) {
    const [following, setFollowing] = useState<Following[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { daemonUrl, sessionToken } = useDaemonConnection();

    useEffect(() => {
        if (!userAddress) return;
        setLoading(true);
        setError(null);
        fetch(`${daemonUrl}/api/social/following/${userAddress}`, {
            headers: authHeaders(sessionToken),
        })
            .then(async (res) => {
                if (!res.ok) throw new Error('Failed to load following');
                const data = await res.json();
                setFollowing(data.following || []);
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'Unknown error'))
            .finally(() => setLoading(false));
    }, [userAddress, daemonUrl, sessionToken]);

    return { following, loading, error };
}

// Hook to check if current user is following a specific address
export function useIsFollowing(targetAddress: string) {
    const [isFollowingTarget, setIsFollowingTarget] = useState<boolean>(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { daemonUrl, sessionToken, walletAddress } = useDaemonConnection();

    useEffect(() => {
        if (!walletAddress || !targetAddress) return;
        setLoading(true);
        setError(null);
        fetch(`${daemonUrl}/api/social/is-following?follower=${walletAddress}&following=${targetAddress}`, {
            headers: authHeaders(sessionToken),
        })
            .then(async (res) => {
                if (!res.ok) throw new Error('Failed to check follow status');
                const data = await res.json();
                setIsFollowingTarget(data.following || false);
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'Unknown error'))
            .finally(() => setLoading(false));
    }, [walletAddress, targetAddress, daemonUrl, sessionToken]);

    return { isFollowing: isFollowingTarget, loading, error };
}

// Hook for a specific user's followers
export function useFollowers(userAddress: string) {
    const [followers, setFollowers] = useState<Follower[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { daemonUrl, sessionToken } = useDaemonConnection();

    useEffect(() => {
        if (!userAddress) return;
        setLoading(true);
        setError(null);
        fetch(`${daemonUrl}/api/social/followers/${userAddress}`, {
            headers: authHeaders(sessionToken),
        })
            .then(async (res) => {
                if (!res.ok) throw new Error('Failed to load followers');
                const data = await res.json();
                setFollowers(data.followers || []);
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'Unknown error'))
            .finally(() => setLoading(false));
    }, [userAddress, daemonUrl, sessionToken]);

    return { followers, loading, error };
}

// Main hook that combines both and provides follow/unfollow actions
export function useFollowing() {
    const [following, setFollowing] = useState<Following[]>([]);
    const [followers, setFollowers] = useState<Follower[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { daemonUrl, sessionToken, walletAddress } = useDaemonConnection();

    // Load following list
    const loadFollowing = useCallback(async () => {
        if (!walletAddress) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${daemonUrl}/api/social/following/${walletAddress}`, {
                headers: authHeaders(sessionToken),
            });
            if (!res.ok) throw new Error('Failed to load following');
            const data = await res.json();
            setFollowing(data.following || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [daemonUrl, sessionToken, walletAddress]);

    // Load followers list
    const loadFollowers = useCallback(async () => {
        if (!walletAddress) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${daemonUrl}/api/social/followers/${walletAddress}`, {
                headers: authHeaders(sessionToken),
            });
            if (!res.ok) throw new Error('Failed to load followers');
            const data = await res.json();
            setFollowers(data.followers || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [daemonUrl, sessionToken, walletAddress]);

    // Follow an agent
    const follow = useCallback(
        async (address: string) => {
            if (!walletAddress) throw new Error('Wallet not connected');
            setLoading(true);
            try {
                const res = await fetch(`${daemonUrl}/api/social/follow`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders(sessionToken) },
                    body: JSON.stringify({ follower: walletAddress, following: address }),
                });
                if (!res.ok) throw new Error('Failed to follow');
                // Optimistic update
                setFollowing((prev) => [...prev, { address, followedAt: Date.now() }]);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [daemonUrl, sessionToken, walletAddress],
    );

    // Unfollow an agent
    const unfollow = useCallback(
        async (address: string) => {
            if (!walletAddress) throw new Error('Wallet not connected');
            setLoading(true);
            try {
                const res = await fetch(`${daemonUrl}/api/social/unfollow`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders(sessionToken) },
                    body: JSON.stringify({ follower: walletAddress, following: address }),
                });
                if (!res.ok) throw new Error('Failed to unfollow');
                // Optimistic update
                setFollowing((prev) => prev.filter((f) => f.address !== address));
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [daemonUrl, sessionToken, walletAddress],
    );

    // Check if following a specific address
    const isFollowing = useCallback(
        (address: string) => {
            return following.some((f) => f.address === address);
        },
        [following],
    );

    // Load data on mount
    useEffect(() => {
        if (walletAddress) {
            loadFollowing();
            loadFollowers();
        }
    }, [walletAddress, loadFollowing, loadFollowers]);

    return {
        following,
        followers,
        loading,
        error,
        follow,
        unfollow,
        isFollowing,
        refresh: () => {
            loadFollowing();
            loadFollowers();
        },
        loadFollowing,
        loadFollowers,
    };
}

// Hook to get follower/following counts for an address
export function useFollowCounts(userAddress: string) {
    const [followersCount, setFollowersCount] = useState<number>(0);
    const [followingCount, setFollowingCount] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { daemonUrl, sessionToken } = useDaemonConnection();

    useEffect(() => {
        if (!userAddress) return;
        setLoading(true);
        setError(null);

        Promise.all([
            fetch(`${daemonUrl}/api/social/followers/${userAddress}/count`, {
                headers: authHeaders(sessionToken),
            }).then(async (res) => {
                if (!res.ok) throw new Error('Failed to load followers count');
                const data = await res.json();
                return data.count || 0;
            }),
            fetch(`${daemonUrl}/api/social/following/${userAddress}/count`, {
                headers: authHeaders(sessionToken),
            }).then(async (res) => {
                if (!res.ok) throw new Error('Failed to load following count');
                const data = await res.json();
                return data.count || 0;
            }),
        ])
            .then(([followers, following]) => {
                setFollowersCount(followers);
                setFollowingCount(following);
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'Unknown error'))
            .finally(() => setLoading(false));
    }, [userAddress, daemonUrl, sessionToken]);

    return { followersCount, followingCount, loading, error };
}

export default useFollowing;
