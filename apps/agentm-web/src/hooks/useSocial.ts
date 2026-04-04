'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';

const INDEXER_BASE = process.env.NEXT_PUBLIC_INDEXER_URL
    || (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
        ? 'https://api.gradiences.xyz/indexer' : '');

export interface SocialPost {
    id: string;
    author: string;
    authorDomain: string | null;
    content: string;
    tags: string[];
    likes: number;
    reposts: number;
    createdAt: number;
}

export interface FollowRelation {
    address: string;
    domain: string | null;
    followedAt: number;
}

export interface SocialNotification {
    id: string;
    type: 'follow' | 'like' | 'mention' | 'message' | 'reputation_change';
    actor: string;
    actorDomain: string | null;
    targetId: string | null;
    message: string;
    read: boolean;
    createdAt: number;
}

export function useSocial(currentUserAddress: string | null) {
    const { daemonUrl, sessionToken } = useDaemonConnection();

    // Helper to build headers with auth
    const headers = useCallback((contentType = false): Record<string, string> => {
        const h: Record<string, string> = {};
        if (sessionToken) h['Authorization'] = `Bearer ${sessionToken}`;
        if (contentType) h['Content-Type'] = 'application/json';
        return h;
    }, [sessionToken]);

    // ── Follow ──

    const follow = useCallback(
        async (targetAddress: string): Promise<void> => {
            if (!currentUserAddress) return;
            
            // Try daemon first
            if (daemonUrl) {
                try {
                    const res = await fetch(`${daemonUrl}/api/v1/social/follow`, {
                        method: 'POST',
                        headers: headers(true),
                        body: JSON.stringify({ follower: currentUserAddress, following: targetAddress }),
                        signal: AbortSignal.timeout(5000),
                    });
                    if (res.ok) return;
                } catch {
                    // Fall through to indexer
                }
            }

            // Try indexer
            if (INDEXER_BASE) {
                await fetch(`${INDEXER_BASE}/api/social/follow`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ follower: currentUserAddress, following: targetAddress }),
                    signal: AbortSignal.timeout(5000),
                });
            }
        },
        [currentUserAddress, daemonUrl, headers],
    );

    const unfollow = useCallback(
        async (targetAddress: string): Promise<void> => {
            if (!currentUserAddress) return;
            
            if (daemonUrl) {
                try {
                    const res = await fetch(`${daemonUrl}/api/v1/social/unfollow`, {
                        method: 'POST',
                        headers: headers(true),
                        body: JSON.stringify({ follower: currentUserAddress, following: targetAddress }),
                        signal: AbortSignal.timeout(5000),
                    });
                    if (res.ok) return;
                } catch {
                    // Fall through
                }
            }

            if (INDEXER_BASE) {
                await fetch(`${INDEXER_BASE}/api/social/unfollow`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ follower: currentUserAddress, following: targetAddress }),
                    signal: AbortSignal.timeout(5000),
                });
            }
        },
        [currentUserAddress, daemonUrl, headers],
    );

    const checkFollowing = useCallback(
        async (targetAddress: string): Promise<boolean> => {
            if (!currentUserAddress) return false;
            
            try {
                let res;
                if (daemonUrl) {
                    res = await fetch(
                        `${daemonUrl}/api/v1/social/is-following?follower=${currentUserAddress}&following=${targetAddress}`,
                        { headers: headers(), signal: AbortSignal.timeout(3000) }
                    );
                } else if (INDEXER_BASE) {
                    res = await fetch(
                        `${INDEXER_BASE}/api/social/is-following?follower=${currentUserAddress}&following=${targetAddress}`,
                        { signal: AbortSignal.timeout(3000) }
                    );
                } else {
                    return false;
                }
                
                if (res.ok) {
                    const data = await res.json();
                    return data.following;
                }
            } catch {
                // Silent fail
            }
            return false;
        },
        [currentUserAddress, daemonUrl, headers],
    );

    // ── Posts ──

    const createPost = useCallback(
        async (content: string, tags: string[] = []): Promise<SocialPost | null> => {
            if (!currentUserAddress) return null;
            
            const body = { author: currentUserAddress, content, tags };

            // Try daemon first
            if (daemonUrl) {
                try {
                    const res = await fetch(`${daemonUrl}/api/v1/social/posts`, {
                        method: 'POST',
                        headers: headers(true),
                        body: JSON.stringify(body),
                        signal: AbortSignal.timeout(5000),
                    });
                    if (res.ok) {
                        return await res.json();
                    }
                } catch {
                    // Fall through
                }
            }

            // Try indexer
            if (INDEXER_BASE) {
                try {
                    const res = await fetch(`${INDEXER_BASE}/api/social/posts`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                        signal: AbortSignal.timeout(5000),
                    });
                    if (res.ok) {
                        return await res.json();
                    }
                } catch {
                    // Silent fail
                }
            }

            return null;
        },
        [currentUserAddress, daemonUrl, headers],
    );

    const deletePost = useCallback(
        async (postId: string): Promise<void> => {
            if (!currentUserAddress) return;
            
            if (daemonUrl) {
                try {
                    const res = await fetch(`${daemonUrl}/api/v1/social/posts/delete`, {
                        method: 'POST',
                        headers: headers(true),
                        body: JSON.stringify({ postId, author: currentUserAddress }),
                        signal: AbortSignal.timeout(5000),
                    });
                    if (res.ok) return;
                } catch {
                    // Fall through
                }
            }

            if (INDEXER_BASE) {
                await fetch(`${INDEXER_BASE}/api/social/posts/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ postId, author: currentUserAddress }),
                    signal: AbortSignal.timeout(5000),
                });
            }
        },
        [currentUserAddress, daemonUrl, headers],
    );

    // ── Feed ──

    const getFeed = useCallback(
        async (limit = 20, offset = 0): Promise<SocialPost[]> => {
            if (!currentUserAddress) return [];
            
            // Try daemon first
            if (daemonUrl) {
                try {
                    const res = await fetch(
                        `${daemonUrl}/api/v1/social/feed/${currentUserAddress}?limit=${limit}&offset=${offset}`,
                        { headers: headers(), signal: AbortSignal.timeout(5000) }
                    );
                    if (res.ok) {
                        const data = await res.json();
                        return data.posts || [];
                    }
                } catch {
                    // Fall through
                }
            }

            // Try indexer
            if (INDEXER_BASE) {
                try {
                    const res = await fetch(
                        `${INDEXER_BASE}/api/social/feed/${currentUserAddress}?limit=${limit}&offset=${offset}`,
                        { signal: AbortSignal.timeout(5000) }
                    );
                    if (res.ok) return await res.json();
                } catch {
                    // Silent fail
                }
            }

            return [];
        },
        [currentUserAddress, daemonUrl, headers],
    );

    const getGlobalFeed = useCallback(
        async (limit = 20, offset = 0): Promise<SocialPost[]> => {
            // Try daemon first
            if (daemonUrl) {
                try {
                    const res = await fetch(
                        `${daemonUrl}/api/v1/social/feed/global?limit=${limit}&offset=${offset}`,
                        { headers: headers(), signal: AbortSignal.timeout(5000) }
                    );
                    if (res.ok) {
                        const data = await res.json();
                        return data.posts || [];
                    }
                } catch {
                    // Fall through
                }
            }

            // Try indexer
            if (INDEXER_BASE) {
                try {
                    const res = await fetch(
                        `${INDEXER_BASE}/api/social/feed/global?limit=${limit}&offset=${offset}`,
                        { signal: AbortSignal.timeout(5000) }
                    );
                    if (res.ok) return await res.json();
                } catch {
                    // Silent fail
                }
            }

            return [];
        },
        [daemonUrl, headers],
    );

    const likePost = useCallback(
        async (postId: string): Promise<void> => {
            if (!currentUserAddress) return;
            
            if (daemonUrl) {
                try {
                    const res = await fetch(`${daemonUrl}/api/v1/social/posts/like`, {
                        method: 'POST',
                        headers: headers(true),
                        body: JSON.stringify({ postId, liker: currentUserAddress }),
                        signal: AbortSignal.timeout(3000),
                    });
                    if (res.ok) return;
                } catch {
                    // Fall through
                }
            }

            if (INDEXER_BASE) {
                await fetch(`${INDEXER_BASE}/api/social/posts/like`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ postId, liker: currentUserAddress }),
                    signal: AbortSignal.timeout(3000),
                });
            }
        },
        [currentUserAddress, daemonUrl, headers],
    );

    // ── Followers ──

    const getFollowers = useCallback(
        async (address?: string): Promise<FollowRelation[]> => {
            const target = address ?? currentUserAddress;
            if (!target) return [];
            
            if (daemonUrl) {
                try {
                    const res = await fetch(
                        `${daemonUrl}/api/v1/social/followers/${target}`,
                        { headers: headers(), signal: AbortSignal.timeout(5000) }
                    );
                    if (res.ok) return await res.json();
                } catch {
                    // Fall through
                }
            }

            if (INDEXER_BASE) {
                try {
                    const res = await fetch(
                        `${INDEXER_BASE}/api/social/followers/${target}`,
                        { signal: AbortSignal.timeout(5000) }
                    );
                    if (res.ok) return await res.json();
                } catch {
                    // Silent fail
                }
            }

            return [];
        },
        [currentUserAddress, daemonUrl, headers],
    );

    const getFollowing = useCallback(
        async (address?: string): Promise<FollowRelation[]> => {
            const target = address ?? currentUserAddress;
            if (!target) return [];
            
            if (daemonUrl) {
                try {
                    const res = await fetch(
                        `${daemonUrl}/api/v1/social/following/${target}`,
                        { headers: headers(), signal: AbortSignal.timeout(5000) }
                    );
                    if (res.ok) return await res.json();
                } catch {
                    // Fall through
                }
            }

            if (INDEXER_BASE) {
                try {
                    const res = await fetch(
                        `${INDEXER_BASE}/api/social/following/${target}`,
                        { signal: AbortSignal.timeout(5000) }
                    );
                    if (res.ok) return await res.json();
                } catch {
                    // Silent fail
                }
            }

            return [];
        },
        [currentUserAddress, daemonUrl, headers],
    );

    return {
        follow,
        unfollow,
        checkFollowing,
        createPost,
        deletePost,
        getFeed,
        getGlobalFeed,
        likePost,
        getFollowers,
        getFollowing,
    } as const;
}

export function useNotifications(address: string | null) {
    const { daemonUrl, sessionToken } = useDaemonConnection();
    const [notifications, setNotifications] = useState<SocialNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const headers = useCallback((): Record<string, string> => {
        const h: Record<string, string> = {};
        if (sessionToken) h['Authorization'] = `Bearer ${sessionToken}`;
        return h;
    }, [sessionToken]);

    const refresh = useCallback(async () => {
        if (!address) return;
        setLoading(true);
        try {
            let notifs: SocialNotification[] = [];
            let count = 0;

            // Try daemon first
            if (daemonUrl) {
                try {
                    const [notifsRes, countRes] = await Promise.all([
                        fetch(`${daemonUrl}/api/v1/social/notifications/${address}`, {
                            headers: headers(),
                            signal: AbortSignal.timeout(5000),
                        }),
                        fetch(`${daemonUrl}/api/v1/social/notifications/${address}/unread`, {
                            headers: headers(),
                            signal: AbortSignal.timeout(5000),
                        }),
                    ]);
                    if (notifsRes.ok) notifs = await notifsRes.json();
                    if (countRes.ok) {
                        const countData = await countRes.json();
                        count = countData.count;
                    }
                    setNotifications(notifs);
                    setUnreadCount(count);
                    setLoading(false);
                    return;
                } catch {
                    // Fall through
                }
            }

            // Try indexer
            if (INDEXER_BASE) {
                try {
                    const [notifsRes, countRes] = await Promise.all([
                        fetch(`${INDEXER_BASE}/api/social/notifications/${address}`, {
                            signal: AbortSignal.timeout(5000),
                        }),
                        fetch(`${INDEXER_BASE}/api/social/notifications/${address}/unread`, {
                            signal: AbortSignal.timeout(5000),
                        }),
                    ]);
                    if (notifsRes.ok) notifs = await notifsRes.json();
                    if (countRes.ok) {
                        const countData = await countRes.json();
                        count = countData.count;
                    }
                } catch {
                    // Silent fail
                }
            }

            setNotifications(notifs);
            setUnreadCount(count);
        } finally {
            setLoading(false);
        }
    }, [address, daemonUrl, headers]);

    const markRead = useCallback(async () => {
        if (!address) return;
        
        if (daemonUrl) {
            try {
                const res = await fetch(`${daemonUrl}/api/v1/social/notifications/${address}/read`, {
                    method: 'POST',
                    headers: headers(),
                    signal: AbortSignal.timeout(3000),
                });
                if (res.ok) {
                    setUnreadCount(0);
                    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                    return;
                }
            } catch {
                // Fall through
            }
        }

        if (INDEXER_BASE) {
            try {
                await fetch(`${INDEXER_BASE}/api/social/notifications/${address}/read`, {
                    method: 'POST',
                    signal: AbortSignal.timeout(3000),
                });
            } catch {
                // Silent fail
            }
        }

        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }, [address, daemonUrl, headers]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { notifications, unreadCount, loading, refresh, markRead } as const;
}
