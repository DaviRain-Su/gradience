import type {
    SocialStore,
    SocialPostRecord,
    SocialProfileRecord,
    NotificationRecord,
} from '../routes/social';

export class InMemorySocialStore implements SocialStore {
    private follows = new Map<string, Set<string>>(); // follower -> set of followees
    private reverseFollows = new Map<string, Set<string>>(); // followee -> set of followers
    private posts: SocialPostRecord[] = [];
    private likes = new Map<string, Set<string>>(); // postId -> set of likers
    private profiles = new Map<string, SocialProfileRecord>();
    private notifications: NotificationRecord[] = [];
    private postSeq = 0;
    private notifSeq = 0;

    async follow(follower: string, followee: string): Promise<void> {
        if (!this.follows.has(follower)) this.follows.set(follower, new Set());
        this.follows.get(follower)!.add(followee);
        if (!this.reverseFollows.has(followee)) this.reverseFollows.set(followee, new Set());
        this.reverseFollows.get(followee)!.add(follower);
        this.addNotification(followee, 'follow', follower, null, `${follower.slice(0,6)}... followed you`);
    }

    async unfollow(follower: string, followee: string): Promise<void> {
        this.follows.get(follower)?.delete(followee);
        this.reverseFollows.get(followee)?.delete(follower);
    }

    async getFollowers(agent: string, limit: number, offset: number) {
        const set = this.reverseFollows.get(agent) ?? new Set();
        return Array.from(set).slice(offset, offset + limit).map(f => ({
            follower: f,
            following: agent,
            followedAt: Date.now(),
        }));
    }

    async getFollowing(agent: string, limit: number, offset: number) {
        const set = this.follows.get(agent) ?? new Set();
        return Array.from(set).slice(offset, offset + limit).map(f => ({
            follower: agent,
            following: f,
            followedAt: Date.now(),
        }));
    }

    async isFollowing(follower: string, followee: string): Promise<boolean> {
        return this.follows.get(follower)?.has(followee) ?? false;
    }

    async getFollowerCount(agent: string): Promise<number> {
        return this.reverseFollows.get(agent)?.size ?? 0;
    }

    async getFollowingCount(agent: string): Promise<number> {
        return this.follows.get(agent)?.size ?? 0;
    }

    async createPost(author: string, content: string, tags: string[]): Promise<SocialPostRecord> {
        this.postSeq++;
        const post: SocialPostRecord = {
            id: `post-${this.postSeq}`,
            author,
            authorDomain: null,
            content,
            tags,
            likes: 0,
            reposts: 0,
            createdAt: Date.now(),
        };
        this.posts.unshift(post);
        return post;
    }

    async deletePost(postId: string, author: string): Promise<void> {
        const idx = this.posts.findIndex(p => p.id === postId && p.author === author);
        if (idx >= 0) this.posts.splice(idx, 1);
    }

    async getFeed(agent: string, limit: number, offset: number): Promise<SocialPostRecord[]> {
        const following = this.follows.get(agent) ?? new Set();
        const feedPosts = this.posts.filter(p => following.has(p.author) || p.author === agent);
        return feedPosts.slice(offset, offset + limit);
    }

    async getGlobalFeed(limit: number, offset: number): Promise<SocialPostRecord[]> {
        return this.posts.slice(offset, offset + limit);
    }

    async getAgentPosts(agent: string, limit: number, offset: number): Promise<SocialPostRecord[]> {
        return this.posts.filter(p => p.author === agent).slice(offset, offset + limit);
    }

    async likePost(postId: string, liker: string): Promise<void> {
        if (!this.likes.has(postId)) this.likes.set(postId, new Set());
        const likerSet = this.likes.get(postId)!;
        if (!likerSet.has(liker)) {
            likerSet.add(liker);
            const post = this.posts.find(p => p.id === postId);
            if (post) {
                post.likes++;
                this.addNotification(post.author, 'like', liker, postId, `${liker.slice(0,6)}... liked your post`);
            }
        }
    }

    async searchAgents(params: {
        query?: string;
        domain?: string;
        category?: number;
        minReputation?: number;
        sortBy?: string;
        limit?: number;
        offset?: number;
    }): Promise<SocialProfileRecord[]> {
        let results = Array.from(this.profiles.values());
        if (params.query) {
            const q = params.query.toLowerCase();
            results = results.filter(p =>
                p.displayName.toLowerCase().includes(q) ||
                p.bio.toLowerCase().includes(q) ||
                p.address.toLowerCase().includes(q) ||
                (p.domain && p.domain.toLowerCase().includes(q))
            );
        }
        if (params.domain) {
            results = results.filter(p => p.domain === params.domain);
        }
        if (params.minReputation !== undefined) {
            results = results.filter(p => (p.reputation?.avgScore ?? 0) >= params.minReputation!);
        }
        if (params.sortBy === 'reputation') {
            results.sort((a, b) => (b.reputation?.avgScore ?? 0) - (a.reputation?.avgScore ?? 0));
        } else if (params.sortBy === 'followers') {
            results.sort((a, b) => b.followersCount - a.followersCount);
        } else {
            results.sort((a, b) => b.createdAt - a.createdAt);
        }
        const offset = params.offset ?? 0;
        const limit = params.limit ?? 20;
        return results.slice(offset, offset + limit);
    }

    async getNotifications(agent: string, limit: number, offset: number): Promise<NotificationRecord[]> {
        return this.notifications.filter(n => n.actor !== agent && this.isForAgent(n, agent)).slice(offset, offset + limit);
    }

    async getUnreadCount(agent: string): Promise<number> {
        return this.notifications.filter(n => this.isForAgent(n, agent) && !n.read).length;
    }

    async markNotificationsRead(agent: string): Promise<void> {
        this.notifications.filter(n => this.isForAgent(n, agent)).forEach(n => { n.read = true; });
    }

    async getSocialProfile(agent: string): Promise<SocialProfileRecord | null> {
        return this.profiles.get(agent) ?? null;
    }

    async upsertSocialProfile(agent: string, data: Partial<SocialProfileRecord>): Promise<void> {
        const existing = this.profiles.get(agent);
        this.profiles.set(agent, {
            address: agent,
            domain: data.domain ?? existing?.domain ?? null,
            displayName: data.displayName ?? existing?.displayName ?? '',
            bio: data.bio ?? existing?.bio ?? '',
            avatar: data.avatar ?? existing?.avatar ?? null,
            reputation: data.reputation ?? existing?.reputation ?? null,
            followersCount: this.reverseFollows.get(agent)?.size ?? 0,
            followingCount: this.follows.get(agent)?.size ?? 0,
            createdAt: existing?.createdAt ?? Date.now(),
        });
    }

    private addNotification(agent: string, type: string, actor: string, targetId: string | null, message: string) {
        this.notifSeq++;
        this.notifications.unshift({
            id: `notif-${this.notifSeq}`,
            type,
            actor,
            actorDomain: null,
            targetId,
            message,
            read: false,
            createdAt: Date.now(),
        });
    }

    private isForAgent(n: NotificationRecord, agent: string): boolean {
        // Notifications where agent is mentioned in targetId or it's a follow notification
        // In a real impl this would use a recipient field
        return true; // simplified: return all for now
    }
}
