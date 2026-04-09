'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';
import type { AgentProfile } from '@/types/profile';

export interface DashboardStats {
    // Profile stats
    totalProfiles: number;
    publishedProfiles: number;
    draftProfiles: number;

    // Social stats
    followersCount: number;
    followingCount: number;
    postsCount: number;
    totalLikes: number;

    // Reputation
    reputationScore: number;

    // Activity
    recentActivity: ActivityItem[];
}

export interface ActivityItem {
    id: string;
    type: 'profile_created' | 'profile_published' | 'post_created' | 'follow' | 'like';
    title: string;
    description: string;
    timestamp: number;
}

interface UseDashboardResult {
    stats: DashboardStats;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

const PROFILE_STORAGE_KEY = 'agentm-web:profiles:v1';

function authHeaders(token: string | null): Record<string, string> {
    const h: Record<string, string> = {};
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
}

function readProfilesFromStorage(owner: string): AgentProfile[] {
    if (typeof window === 'undefined') {
        return [];
    }
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((profile: AgentProfile) => profile.owner === owner);
    } catch {
        return [];
    }
}

export function useDashboard(): UseDashboardResult {
    const { daemonUrl, sessionToken, walletAddress } = useDaemonConnection();
    const [stats, setStats] = useState<DashboardStats>({
        totalProfiles: 0,
        publishedProfiles: 0,
        draftProfiles: 0,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        totalLikes: 0,
        reputationScore: 0,
        recentActivity: [],
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboardData = useCallback(async () => {
        if (!walletAddress) {
            setStats({
                totalProfiles: 0,
                publishedProfiles: 0,
                draftProfiles: 0,
                followersCount: 0,
                followingCount: 0,
                postsCount: 0,
                totalLikes: 0,
                reputationScore: 0,
                recentActivity: [],
            });
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Load profiles from localStorage
            const profiles = readProfilesFromStorage(walletAddress);
            const publishedProfiles = profiles.filter((p) => p.status === 'published');
            const draftProfiles = profiles.filter((p) => p.status === 'draft');

            // Fetch social stats from API
            let followersCount = 0;
            let followingCount = 0;
            let postsCount = 0;
            let reputationScore = 0;
            let recentActivity: ActivityItem[] = [];

            try {
                // Fetch followers count
                const followersRes = await fetch(`${daemonUrl}/api/social/followers/${walletAddress}/count`, {
                    headers: authHeaders(sessionToken),
                });
                if (followersRes.ok) {
                    const data = await followersRes.json();
                    followersCount = data.count || 0;
                }
            } catch {
                // Silent fail - keep default
            }

            try {
                // Fetch following count
                const followingRes = await fetch(`${daemonUrl}/api/social/following/${walletAddress}/count`, {
                    headers: authHeaders(sessionToken),
                });
                if (followingRes.ok) {
                    const data = await followingRes.json();
                    followingCount = data.count || 0;
                }
            } catch {
                // Silent fail - keep default
            }

            try {
                // Fetch user profile for reputation
                const profileRes = await fetch(`${daemonUrl}/api/profile/${walletAddress}`, {
                    headers: authHeaders(sessionToken),
                });
                if (profileRes.ok) {
                    const data = await profileRes.json();
                    reputationScore = data.reputation || 0;
                }
            } catch {
                // Silent fail - keep default
            }

            try {
                // Fetch posts count from feed
                const feedRes = await fetch(`${daemonUrl}/api/v1/social/feed/${walletAddress}?limit=1`, {
                    headers: authHeaders(sessionToken),
                });
                if (feedRes.ok) {
                    const data = await feedRes.json();
                    // Some APIs return total count in meta or we can get from another endpoint
                    postsCount = data.totalCount || data.posts?.length || 0;
                }
            } catch {
                // Silent fail - keep default
            }

            // Build recent activity from profiles
            recentActivity = profiles
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .slice(0, 5)
                .map(
                    (profile): ActivityItem => ({
                        id: `profile-${profile.id}`,
                        type: profile.status === 'published' ? 'profile_published' : 'profile_created',
                        title: profile.status === 'published' ? 'Profile Published' : 'Profile Created',
                        description: profile.name,
                        timestamp: profile.updatedAt,
                    }),
                );

            setStats({
                totalProfiles: profiles.length,
                publishedProfiles: publishedProfiles.length,
                draftProfiles: draftProfiles.length,
                followersCount,
                followingCount,
                postsCount,
                totalLikes: 0, // Would need aggregation from posts
                reputationScore,
                recentActivity,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    }, [daemonUrl, sessionToken, walletAddress]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    return {
        stats,
        loading,
        error,
        refresh: fetchDashboardData,
    };
}

export default useDashboard;
