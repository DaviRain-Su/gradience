/**
 * Social Platform API Client
 *
 * Manages follows, posts, feed, and notifications via the Indexer API.
 * Social data is stored in Indexer PostgreSQL alongside on-chain data.
 */

import type { FollowRelation, SocialPost, AgentSocialProfile, AgentSearchParams } from './types';

const BASE_URL = process.env.NEXT_PUBLIC_INDEXER_URL ?? 'https://indexer.gradiences.xyz';

export class SocialApiClient {
    private baseUrl: string;

    constructor(baseUrl?: string) {
        this.baseUrl = (baseUrl ?? BASE_URL).replace(/\/$/, '');
    }

    // ── Follow System ──

    async follow(follower: string, following: string): Promise<void> {
        await this.post('/api/social/follow', { follower, following });
    }

    async unfollow(follower: string, following: string): Promise<void> {
        await this.post('/api/social/unfollow', { follower, following });
    }

    async getFollowers(address: string, limit = 50, offset = 0): Promise<FollowRelation[]> {
        return this.get<FollowRelation[]>(`/api/social/followers/${address}?limit=${limit}&offset=${offset}`);
    }

    async getFollowing(address: string, limit = 50, offset = 0): Promise<FollowRelation[]> {
        return this.get<FollowRelation[]>(`/api/social/following/${address}?limit=${limit}&offset=${offset}`);
    }

    async isFollowing(follower: string, following: string): Promise<boolean> {
        try {
            const result = await this.get<{ following: boolean }>(`/api/social/is-following?follower=${follower}&following=${following}`);
            return result.following;
        } catch {
            return false;
        }
    }

    async getFollowerCount(address: string): Promise<number> {
        const result = await this.get<{ count: number }>(`/api/social/followers/${address}/count`);
        return result.count;
    }

    async getFollowingCount(address: string): Promise<number> {
        const result = await this.get<{ count: number }>(`/api/social/following/${address}/count`);
        return result.count;
    }

    // ── Posts / Feed ──

    async createPost(author: string, content: string, tags: string[] = []): Promise<SocialPost> {
        return this.post<SocialPost>('/api/social/posts', { author, content, tags });
    }

    async deletePost(postId: string, author: string): Promise<void> {
        await this.post('/api/social/posts/delete', { postId, author });
    }

    async getFeed(address: string, limit = 20, offset = 0): Promise<SocialPost[]> {
        return this.get<SocialPost[]>(`/api/social/feed/${address}?limit=${limit}&offset=${offset}`);
    }

    async getGlobalFeed(limit = 20, offset = 0): Promise<SocialPost[]> {
        return this.get<SocialPost[]>(`/api/social/feed/global?limit=${limit}&offset=${offset}`);
    }

    async getAgentPosts(address: string, limit = 20, offset = 0): Promise<SocialPost[]> {
        return this.get<SocialPost[]>(`/api/social/posts/${address}?limit=${limit}&offset=${offset}`);
    }

    async likePost(postId: string, liker: string): Promise<void> {
        await this.post('/api/social/posts/like', { postId, liker });
    }

    // ── Search & Discovery ──

    async searchAgents(params: AgentSearchParams): Promise<AgentSocialProfile[]> {
        const query = new URLSearchParams();
        if (params.query) query.set('q', params.query);
        if (params.domain) query.set('domain', params.domain);
        if (params.category !== undefined) query.set('category', String(params.category));
        if (params.minReputation !== undefined) query.set('min_rep', String(params.minReputation));
        if (params.sortBy) query.set('sort', params.sortBy);
        if (params.limit) query.set('limit', String(params.limit));
        if (params.offset) query.set('offset', String(params.offset));
        const qs = query.toString();
        return this.get<AgentSocialProfile[]>(`/api/social/search${qs ? '?' + qs : ''}`);
    }

    // ── Notifications ──

    async getNotifications(address: string, limit = 20, offset = 0): Promise<SocialNotification[]> {
        return this.get<SocialNotification[]>(`/api/social/notifications/${address}?limit=${limit}&offset=${offset}`);
    }

    async getUnreadCount(address: string): Promise<number> {
        const result = await this.get<{ count: number }>(`/api/social/notifications/${address}/unread`);
        return result.count;
    }

    async markNotificationsRead(address: string): Promise<void> {
        await this.post(`/api/social/notifications/${address}/read`, {});
    }

    // ── Internal ──

    private async get<T>(path: string): Promise<T> {
        const res = await fetch(`${this.baseUrl}${path}`);
        if (!res.ok) throw new Error(`Social API error ${res.status}`);
        return res.json();
    }

    private async post<T = void>(path: string, body: unknown): Promise<T> {
        const res = await fetch(`${this.baseUrl}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Social API error ${res.status}`);
        const text = await res.text();
        return text ? JSON.parse(text) : (undefined as T);
    }
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

let defaultClient: SocialApiClient | null = null;

export function getSocialClient(): SocialApiClient {
    if (!defaultClient) {
        defaultClient = new SocialApiClient();
    }
    return defaultClient;
}
