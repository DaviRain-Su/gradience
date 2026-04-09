'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SocialApiClient } from '@/lib/social/api';
import type { SocialNotification } from '@/lib/social/api';
import type { SocialPost, FollowRelation } from '@/lib/social';

export function useSocial(currentUserAddress: string | null) {
    const clientRef = useRef(new SocialApiClient());

    // ── Follow ──

    const follow = useCallback(
        async (targetAddress: string) => {
            if (!currentUserAddress) return;
            await clientRef.current.follow(currentUserAddress, targetAddress);
        },
        [currentUserAddress],
    );

    const unfollow = useCallback(
        async (targetAddress: string) => {
            if (!currentUserAddress) return;
            await clientRef.current.unfollow(currentUserAddress, targetAddress);
        },
        [currentUserAddress],
    );

    const checkFollowing = useCallback(
        async (targetAddress: string): Promise<boolean> => {
            if (!currentUserAddress) return false;
            return clientRef.current.isFollowing(currentUserAddress, targetAddress);
        },
        [currentUserAddress],
    );

    // ── Posts ──

    const createPost = useCallback(
        async (content: string, tags: string[] = []): Promise<SocialPost | null> => {
            if (!currentUserAddress) return null;
            return clientRef.current.createPost(currentUserAddress, content, tags);
        },
        [currentUserAddress],
    );

    const deletePost = useCallback(
        async (postId: string) => {
            if (!currentUserAddress) return;
            await clientRef.current.deletePost(postId, currentUserAddress);
        },
        [currentUserAddress],
    );

    // ── Feed ──

    const getFeed = useCallback(
        async (limit = 20, offset = 0): Promise<SocialPost[]> => {
            if (!currentUserAddress) return [];
            return clientRef.current.getFeed(currentUserAddress, limit, offset);
        },
        [currentUserAddress],
    );

    const getGlobalFeed = useCallback(async (limit = 20, offset = 0): Promise<SocialPost[]> => {
        return clientRef.current.getGlobalFeed(limit, offset);
    }, []);

    // ── Followers ──

    const getFollowers = useCallback(
        async (address?: string): Promise<FollowRelation[]> => {
            const target = address ?? currentUserAddress;
            if (!target) return [];
            return clientRef.current.getFollowers(target);
        },
        [currentUserAddress],
    );

    const getFollowing = useCallback(
        async (address?: string): Promise<FollowRelation[]> => {
            const target = address ?? currentUserAddress;
            if (!target) return [];
            return clientRef.current.getFollowing(target);
        },
        [currentUserAddress],
    );

    return {
        follow,
        unfollow,
        checkFollowing,
        createPost,
        deletePost,
        getFeed,
        getGlobalFeed,
        getFollowers,
        getFollowing,
    } as const;
}

export function useNotifications(address: string | null) {
    const clientRef = useRef(new SocialApiClient());
    const [notifications, setNotifications] = useState<SocialNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        if (!address) return;
        setLoading(true);
        try {
            const [notifs, count] = await Promise.all([
                clientRef.current.getNotifications(address),
                clientRef.current.getUnreadCount(address),
            ]);
            setNotifications(notifs);
            setUnreadCount(count);
        } catch {
            // API may not be available yet
        } finally {
            setLoading(false);
        }
    }, [address]);

    const markRead = useCallback(async () => {
        if (!address) return;
        await clientRef.current.markNotificationsRead(address);
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }, [address]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { notifications, unreadCount, loading, refresh, markRead } as const;
}
