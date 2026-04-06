'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';

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

    const ensureDaemon = useCallback((): string => {
        if (!daemonUrl) throw new Error('Daemon not connected');
        return daemonUrl;
    }, [daemonUrl]);

    // ── Follow ──

    const follow = useCallback(
        async (targetAddress: string): Promise<void> => {
            if (!currentUserAddress) return;
            const base = ensureDaemon();
            const res = await fetch(`${base}/api/follow`, {
                method: 'POST',
                headers: headers(true),
                body: JSON.stringify({ targetAddress }),
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) throw new Error(`Follow failed: ${res.status}`);
        },
        [currentUserAddress, ensureDaemon, headers],
    );

    const unfollow = useCallback(
        async (targetAddress: string): Promise<void> => {
            if (!currentUserAddress) return;
            const base = ensureDaemon();
            const res = await fetch(`${base}/api/unfollow`, {
                method: 'POST',
                headers: headers(true),
                body: JSON.stringify({ targetAddress }),
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) throw new Error(`Unfollow failed: ${res.status}`);
        },
        [currentUserAddress, ensureDaemon, headers],
    );

    const checkFollowing = useCallback(
        async (targetAddress: string): Promise<boolean> => {
            if (!currentUserAddress) return false;
            try {
                const base = ensureDaemon();
                const res = await fetch(
                    `${base}/api/is-following?follower=${currentUserAddress}&following=${targetAddress}`,
                    { headers: headers(), signal: AbortSignal.timeout(3000) }
                );
                if (res.ok) {
                    const data = await res.json();
                    return data.following;
                }
            } catch {
                // Silent fail
            }
            return false;
        },
        [currentUserAddress, ensureDaemon, headers],
    );

    // ── Posts ──

    const createPost = useCallback(
        async (content: string, tags: string[] = []): Promise<SocialPost | null> => {
            if (!currentUserAddress) return null;
            const base = ensureDaemon();
            const body = { content, media: tags.map(t => ({ type: 'tag', url: t })) };
            const res = await fetch(`${base}/api/posts`, {
                method: 'POST',
                headers: headers(true),
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) throw new Error(`Create post failed: ${res.status}`);
            return await res.json();
        },
        [currentUserAddress, ensureDaemon, headers],
    );

    const deletePost = useCallback(
        async (postId: string): Promise<void> => {
            if (!currentUserAddress) return;
            const base = ensureDaemon();
            const res = await fetch(`${base}/api/posts/${postId}`, {
                method: 'DELETE',
                headers: headers(),
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) throw new Error(`Delete post failed: ${res.status}`);
        },
        [currentUserAddress, ensureDaemon, headers],
    );

    // ── Feed ──

    const getFeed = useCallback(
        async (limit = 20, offset = 0): Promise<SocialPost[]> => {
            if (!currentUserAddress) return [];
            try {
                const base = ensureDaemon();
                const res = await fetch(
                    `${base}/api/feed?limit=${limit}&offset=${offset}`,
                    { headers: headers(), signal: AbortSignal.timeout(5000) }
                );
                if (res.ok) {
                    const data = await res.json();
                    return (data.posts || []).map((p: any) => ({
                        id: p.id,
                        author: p.authorAddress,
                        authorDomain: p.authorDomain,
                        content: p.content,
                        tags: (p.media || []).map((m: any) => m.url || m).filter(Boolean),
                        likes: p.likes || 0,
                        reposts: p.shares || 0,
                        createdAt: new Date(p.createdAt).getTime(),
                    }));
                }
            } catch {
                // Silent fail
            }
            return [];
        },
        [currentUserAddress, ensureDaemon, headers],
    );

    const getGlobalFeed = useCallback(
        async (limit = 20, offset = 0): Promise<SocialPost[]> => {
            try {
                const base = ensureDaemon();
                const res = await fetch(
                    `${base}/api/feed?limit=${limit}&offset=${offset}`,
                    { headers: headers(), signal: AbortSignal.timeout(5000) }
                );
                if (res.ok) {
                    const data = await res.json();
                    return (data.posts || []).map((p: any) => ({
                        id: p.id,
                        author: p.authorAddress,
                        authorDomain: p.authorDomain,
                        content: p.content,
                        tags: (p.media || []).map((m: any) => m.url || m).filter(Boolean),
                        likes: p.likes || 0,
                        reposts: p.shares || 0,
                        createdAt: new Date(p.createdAt).getTime(),
                    }));
                }
            } catch {
                // Silent fail
            }
            return [];
        },
        [ensureDaemon, headers],
    );

    const likePost = useCallback(
        async (postId: string): Promise<void> => {
            if (!currentUserAddress) return;
            const base = ensureDaemon();
            const res = await fetch(`${base}/api/posts/${postId}/like`, {
                method: 'POST',
                headers: headers(),
                signal: AbortSignal.timeout(3000),
            });
            if (!res.ok) throw new Error(`Like failed: ${res.status}`);
        },
        [currentUserAddress, ensureDaemon, headers],
    );

    // ── Followers ──

    const getFollowers = useCallback(
        async (address?: string): Promise<FollowRelation[]> => {
            const target = address ?? currentUserAddress;
            if (!target) return [];
            try {
                const base = ensureDaemon();
                const res = await fetch(
                    `${base}/api/followers/${target}`,
                    { headers: headers(), signal: AbortSignal.timeout(5000) }
                );
                if (res.ok) {
                    const data = await res.json();
                    return (data.followers || []).map((r: any) => ({
                        address: r.address,
                        domain: r.domain,
                        followedAt: Date.now(),
                    }));
                }
            } catch {
                // Silent fail
            }
            return [];
        },
        [currentUserAddress, ensureDaemon, headers],
    );

    const getFollowing = useCallback(
        async (address?: string): Promise<FollowRelation[]> => {
            const target = address ?? currentUserAddress;
            if (!target) return [];
            try {
                const base = ensureDaemon();
                const res = await fetch(
                    `${base}/api/following/${target}`,
                    { headers: headers(), signal: AbortSignal.timeout(5000) }
                );
                if (res.ok) {
                    const data = await res.json();
                    return (data.following || []).map((r: any) => ({
                        address: r.address,
                        domain: r.domain,
                        followedAt: Date.now(),
                    }));
                }
            } catch {
                // Silent fail
            }
            return [];
        },
        [currentUserAddress, ensureDaemon, headers],
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
        if (!address || !daemonUrl) return;
        setLoading(true);
        try {
            const [notifsRes, countRes] = await Promise.all([
                fetch(`${daemonUrl}/api/notifications/${address}`, {
                    headers: headers(),
                    signal: AbortSignal.timeout(5000),
                }),
                fetch(`${daemonUrl}/api/notifications/${address}/unread`, {
                    headers: headers(),
                    signal: AbortSignal.timeout(5000),
                }),
            ]);
            let notifs: SocialNotification[] = [];
            let count = 0;
            if (notifsRes.ok) {
                const data = await notifsRes.json();
                notifs = (Array.isArray(data) ? data : []).map((n: any) => ({
                    id: n.id,
                    type: n.type,
                    actor: n.actor,
                    actorDomain: n.actorDomain || null,
                    targetId: n.targetId || null,
                    message: n.message,
                    read: n.read,
                    createdAt: n.createdAt,
                }));
            }
            if (countRes.ok) {
                const data = await countRes.json();
                count = data.count || 0;
            }
            setNotifications(notifs);
            setUnreadCount(count);
        } catch {
            // Silent fail
        } finally {
            setLoading(false);
        }
    }, [address, daemonUrl, headers]);

    const markRead = useCallback(async () => {
        if (!address || !daemonUrl) return;
        try {
            const res = await fetch(`${daemonUrl}/api/notifications/${address}/read`, {
                method: 'POST',
                headers: headers(),
                signal: AbortSignal.timeout(3000),
            });
            if (res.ok) {
                setUnreadCount(0);
                setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            }
        } catch {
            // Silent fail
        }
    }, [address, daemonUrl, headers]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { notifications, unreadCount, loading, refresh, markRead } as const;
}
