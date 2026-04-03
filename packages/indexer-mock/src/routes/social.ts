import { Hono } from 'hono';
import type { DataStore } from '../db/store';

export interface SocialStore {
    follow(follower: string, followee: string): Promise<void>;
    unfollow(follower: string, followee: string): Promise<void>;
    getFollowers(agent: string, limit: number, offset: number): Promise<{ follower: string; following: string; followedAt: number }[]>;
    getFollowing(agent: string, limit: number, offset: number): Promise<{ follower: string; following: string; followedAt: number }[]>;
    isFollowing(follower: string, followee: string): Promise<boolean>;
    getFollowerCount(agent: string): Promise<number>;
    getFollowingCount(agent: string): Promise<number>;

    createPost(author: string, content: string, tags: string[]): Promise<SocialPostRecord>;
    deletePost(postId: string, author: string): Promise<void>;
    getFeed(agent: string, limit: number, offset: number): Promise<SocialPostRecord[]>;
    getGlobalFeed(limit: number, offset: number): Promise<SocialPostRecord[]>;
    getAgentPosts(agent: string, limit: number, offset: number): Promise<SocialPostRecord[]>;
    likePost(postId: string, liker: string): Promise<void>;

    searchAgents(params: {
        query?: string;
        domain?: string;
        category?: number;
        minReputation?: number;
        sortBy?: string;
        limit?: number;
        offset?: number;
    }): Promise<SocialProfileRecord[]>;

    getNotifications(agent: string, limit: number, offset: number): Promise<NotificationRecord[]>;
    getUnreadCount(agent: string): Promise<number>;
    markNotificationsRead(agent: string): Promise<void>;

    getSocialProfile(agent: string): Promise<SocialProfileRecord | null>;
    upsertSocialProfile(agent: string, data: Partial<SocialProfileRecord>): Promise<void>;
}

export interface SocialPostRecord {
    id: string;
    author: string;
    authorDomain: string | null;
    content: string;
    tags: string[];
    likes: number;
    reposts: number;
    createdAt: number;
}

export interface SocialProfileRecord {
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

export interface NotificationRecord {
    id: string;
    type: string;
    actor: string;
    actorDomain: string | null;
    targetId: string | null;
    message: string;
    read: boolean;
    createdAt: number;
}

export function createSocialRouter(
    store: SocialStore,
    broadcast: (event: string, payload: unknown) => void
) {
    const router = new Hono();

    // -- Follow --

    router.post('/follow', async (c) => {
        const { follower, following } = await c.req.json<{ follower: string; following: string }>();
        await store.follow(follower, following);
        broadcast('social_follow', { follower, following });
        return c.json({ ok: true });
    });

    router.post('/unfollow', async (c) => {
        const { follower, following } = await c.req.json<{ follower: string; following: string }>();
        await store.unfollow(follower, following);
        return c.json({ ok: true });
    });

    router.get('/followers/:address', async (c) => {
        const address = c.req.param('address');
        const limit = Number(c.req.query('limit') ?? 50);
        const offset = Number(c.req.query('offset') ?? 0);
        const followers = await store.getFollowers(address, limit, offset);
        return c.json(followers);
    });

    router.get('/followers/:address/count', async (c) => {
        const count = await store.getFollowerCount(c.req.param('address'));
        return c.json({ count });
    });

    router.get('/following/:address', async (c) => {
        const address = c.req.param('address');
        const limit = Number(c.req.query('limit') ?? 50);
        const offset = Number(c.req.query('offset') ?? 0);
        const following = await store.getFollowing(address, limit, offset);
        return c.json(following);
    });

    router.get('/following/:address/count', async (c) => {
        const count = await store.getFollowingCount(c.req.param('address'));
        return c.json({ count });
    });

    router.get('/is-following', async (c) => {
        const follower = c.req.query('follower');
        const following = c.req.query('following');
        if (!follower || !following) return c.json({ error: 'Missing params' }, 400);
        const result = await store.isFollowing(follower, following);
        return c.json({ following: result });
    });

    // -- Posts / Feed --

    router.post('/posts', async (c) => {
        const { author, content, tags } = await c.req.json<{ author: string; content: string; tags?: string[] }>();
        const post = await store.createPost(author, content, tags ?? []);
        broadcast('social_post', post);
        return c.json(post, 201);
    });

    router.post('/posts/delete', async (c) => {
        const { postId, author } = await c.req.json<{ postId: string; author: string }>();
        await store.deletePost(postId, author);
        return c.json({ ok: true });
    });

    router.get('/posts/:address', async (c) => {
        const address = c.req.param('address');
        const limit = Number(c.req.query('limit') ?? 20);
        const offset = Number(c.req.query('offset') ?? 0);
        const posts = await store.getAgentPosts(address, limit, offset);
        return c.json(posts);
    });

    router.post('/posts/like', async (c) => {
        const { postId, liker } = await c.req.json<{ postId: string; liker: string }>();
        await store.likePost(postId, liker);
        broadcast('social_like', { postId, liker });
        return c.json({ ok: true });
    });

    router.get('/feed/:address', async (c) => {
        const address = c.req.param('address');
        const limit = Number(c.req.query('limit') ?? 20);
        const offset = Number(c.req.query('offset') ?? 0);
        const feed = await store.getFeed(address, limit, offset);
        return c.json(feed);
    });

    router.get('/feed/global', async (c) => {
        const limit = Number(c.req.query('limit') ?? 20);
        const offset = Number(c.req.query('offset') ?? 0);
        const feed = await store.getGlobalFeed(limit, offset);
        return c.json(feed);
    });

    // -- Search --

    router.get('/search', async (c) => {
        const query = c.req.query();
        const results = await store.searchAgents({
            query: query.q,
            domain: query.domain,
            category: query.category ? Number(query.category) : undefined,
            minReputation: query.min_rep ? Number(query.min_rep) : undefined,
            sortBy: query.sort,
            limit: query.limit ? Number(query.limit) : undefined,
            offset: query.offset ? Number(query.offset) : undefined,
        });
        return c.json(results);
    });

    // -- Notifications --

    router.get('/notifications/:address', async (c) => {
        const address = c.req.param('address');
        const limit = Number(c.req.query('limit') ?? 20);
        const offset = Number(c.req.query('offset') ?? 0);
        const notifications = await store.getNotifications(address, limit, offset);
        return c.json(notifications);
    });

    router.get('/notifications/:address/unread', async (c) => {
        const count = await store.getUnreadCount(c.req.param('address'));
        return c.json({ count });
    });

    router.post('/notifications/:address/read', async (c) => {
        await store.markNotificationsRead(c.req.param('address'));
        return c.json({ ok: true });
    });

    // -- Profile --

    router.get('/profile/:address', async (c) => {
        const profile = await store.getSocialProfile(c.req.param('address'));
        if (!profile) return c.json({ error: 'Profile not found' }, 404);
        return c.json(profile);
    });

    router.put('/profile/:address', async (c) => {
        const address = c.req.param('address');
        const body = await c.req.json<Partial<SocialProfileRecord>>();
        await store.upsertSocialProfile(address, body);
        return c.json({ ok: true });
    });

    return router;
}
