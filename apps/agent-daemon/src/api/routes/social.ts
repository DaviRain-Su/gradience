import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';

interface Database {
    prepare(sql: string): Statement;
    exec(sql: string): void;
}

interface Statement {
    run(...params: unknown[]): { lastInsertRowid: number; changes: number };
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
}

function getWallet(request: FastifyRequest): string | null {
    return (request as any).walletAddress ?? null;
}

type PrivacyLevel = 'public' | 'zk-selective' | 'private';

interface SoulProfileData {
    address: string;
    soul_type: string;
    display_name: string;
    bio: string;
    avatar?: string;
    values_core: string[];
    values_priorities: string[];
    values_deal_breakers: string[];
    interests_topics: string[];
    interests_skills: string[];
    interests_goals: string[];
    comm_tone: string;
    comm_pace: string;
    comm_depth: string;
    privacy_level: PrivacyLevel;
    forbidden_topics: string[];
}

function parseSoulRow(row: Record<string, unknown>): SoulProfileData {
    return {
        address: String(row.address),
        soul_type: String(row.soul_type || 'human'),
        display_name: String(row.display_name || ''),
        bio: String(row.bio || ''),
        avatar: row.avatar ? String(row.avatar) : undefined,
        values_core: JSON.parse(String(row.values_core || '[]')),
        values_priorities: JSON.parse(String(row.values_priorities || '[]')),
        values_deal_breakers: JSON.parse(String(row.values_deal_breakers || '[]')),
        interests_topics: JSON.parse(String(row.interests_topics || '[]')),
        interests_skills: JSON.parse(String(row.interests_skills || '[]')),
        interests_goals: JSON.parse(String(row.interests_goals || '[]')),
        comm_tone: String(row.comm_tone || 'casual'),
        comm_pace: String(row.comm_pace || 'moderate'),
        comm_depth: String(row.comm_depth || 'moderate'),
        privacy_level: (row.privacy_level as PrivacyLevel) || 'public',
        forbidden_topics: JSON.parse(String(row.forbidden_topics || '[]')),
    };
}

// ── Matching Engine ──

function intersect(a: string[], b: string[]): string[] {
    const setB = new Set(b.map((s) => s.toLowerCase()));
    return a.filter((v) => setB.has(v.toLowerCase()));
}

function jaccardSimilarity(a: string[], b: string[]): number {
    if (a.length === 0 && b.length === 0) return 1;
    const setA = new Set(a.map((s) => s.toLowerCase()));
    const setB = new Set(b.map((s) => s.toLowerCase()));
    const intersection = [...setA].filter((x) => setB.has(x)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
}

const TONE_SIM: Record<string, number> = {
    'formal-formal': 1,
    'formal-technical': 0.7,
    'formal-friendly': 0.3,
    'formal-casual': 0.2,
    'technical-technical': 1,
    'technical-friendly': 0.5,
    'technical-casual': 0.3,
    'friendly-friendly': 1,
    'friendly-casual': 0.8,
    'casual-casual': 1,
};
const PACE_SIM: Record<string, number> = {
    'fast-fast': 1,
    'fast-moderate': 0.6,
    'fast-slow': 0.2,
    'moderate-moderate': 1,
    'moderate-slow': 0.6,
    'slow-slow': 1,
};
const DEPTH_SIM: Record<string, number> = {
    'deep-deep': 1,
    'deep-moderate': 0.6,
    'deep-surface': 0.2,
    'moderate-moderate': 1,
    'moderate-surface': 0.5,
    'surface-surface': 1,
};

function lookupSim(key: string, map: Record<string, number>): number {
    return map[key] ?? map[key.split('-').reverse().join('-')] ?? 0.5;
}

interface MatchBreakdown {
    values: number;
    interests: number;
    communication: number;
}
interface FullMatchResult {
    score: number;
    breakdown: MatchBreakdown;
    sharedValues: string[];
    sharedInterests: string[];
    conflictAreas: string[];
}

function computeMatch(me: SoulProfileData, other: SoulProfileData): FullMatchResult {
    const valScore =
        jaccardSimilarity(me.values_core, other.values_core) * 0.6 +
        jaccardSimilarity(me.values_priorities, other.values_priorities) * 0.3 +
        (intersect(me.values_deal_breakers, other.values_deal_breakers).length > 0 ? 0.1 : 0);

    const intScore =
        jaccardSimilarity(me.interests_topics, other.interests_topics) * 0.5 +
        jaccardSimilarity(me.interests_skills, other.interests_skills) * 0.3 +
        jaccardSimilarity(me.interests_goals, other.interests_goals) * 0.2;

    const tone = lookupSim(`${me.comm_tone}-${other.comm_tone}`, TONE_SIM);
    const pace = lookupSim(`${me.comm_pace}-${other.comm_pace}`, PACE_SIM);
    const depth = lookupSim(`${me.comm_depth}-${other.comm_depth}`, DEPTH_SIM);
    const commScore = tone * 0.4 + pace * 0.3 + depth * 0.3;

    const overall = valScore * 40 + intScore * 35 + commScore * 25;

    const sharedValues = intersect(me.values_core, other.values_core);
    const sharedInterests = intersect(me.interests_topics, other.interests_topics);

    const conflictAreas: string[] = [];
    const myBreakers = new Set(me.values_deal_breakers.map((s) => s.toLowerCase()));
    for (const v of other.values_core) {
        if (myBreakers.has(v.toLowerCase())) conflictAreas.push(v);
    }
    const theirBreakers = new Set(other.values_deal_breakers.map((s) => s.toLowerCase()));
    for (const v of me.values_core) {
        if (theirBreakers.has(v.toLowerCase())) conflictAreas.push(v);
    }

    return {
        score: Math.round(overall * 10) / 10,
        breakdown: {
            values: Math.round(valScore * 100),
            interests: Math.round(intScore * 100),
            communication: Math.round(commScore * 100),
        },
        sharedValues,
        sharedInterests,
        conflictAreas,
    };
}

function filterByPrivacy(other: SoulProfileData, match: FullMatchResult) {
    if (other.privacy_level === 'private') {
        return {
            address: other.address,
            soulType: other.soul_type,
            displayName: `Anonymous ${other.address.slice(0, 6)}`,
            privacyLevel: 'private' as const,
            score: match.score,
        };
    }
    if (other.privacy_level === 'zk-selective') {
        return {
            address: other.address,
            soulType: other.soul_type,
            displayName: other.display_name,
            bio: other.bio,
            avatar: other.avatar,
            privacyLevel: 'zk-selective' as const,
            score: match.score,
            sharedValues: match.sharedValues,
            sharedInterests: match.sharedInterests,
            communication: { tone: other.comm_tone, pace: other.comm_pace, depth: other.comm_depth },
        };
    }
    // public
    return {
        address: other.address,
        soulType: other.soul_type,
        displayName: other.display_name,
        bio: other.bio,
        avatar: other.avatar,
        privacyLevel: 'public' as const,
        values: { core: other.values_core, priorities: other.values_priorities },
        interests: { topics: other.interests_topics, skills: other.interests_skills, goals: other.interests_goals },
        communication: { tone: other.comm_tone, pace: other.comm_pace, depth: other.comm_depth },
        score: match.score,
        breakdown: match.breakdown,
        sharedValues: match.sharedValues,
        sharedInterests: match.sharedInterests,
        conflictAreas: match.conflictAreas,
    };
}

function ensureSocialTables(db: Database): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS profiles (
            address       TEXT PRIMARY KEY,
            display_name  TEXT NOT NULL DEFAULT '',
            bio           TEXT NOT NULL DEFAULT '',
            avatar        TEXT,
            domain        TEXT,
            metadata      TEXT NOT NULL DEFAULT '{}',
            created_at    INTEGER NOT NULL,
            updated_at    INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS posts (
            id              TEXT PRIMARY KEY,
            author_address  TEXT NOT NULL,
            content         TEXT NOT NULL,
            media           TEXT NOT NULL DEFAULT '[]',
            likes           INTEGER NOT NULL DEFAULT 0,
            comments        INTEGER NOT NULL DEFAULT 0,
            shares          INTEGER NOT NULL DEFAULT 0,
            created_at      INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_address);
        CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);

        CREATE TABLE IF NOT EXISTS post_likes (
            post_id   TEXT NOT NULL,
            address   TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            PRIMARY KEY (post_id, address)
        );
        CREATE TABLE IF NOT EXISTS follows (
            follower    TEXT NOT NULL,
            following   TEXT NOT NULL,
            created_at  INTEGER NOT NULL,
            PRIMARY KEY (follower, following)
        );
        CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower);
        CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following);

        CREATE TABLE IF NOT EXISTS soul_profiles (
            address              TEXT PRIMARY KEY,
            soul_type            TEXT NOT NULL DEFAULT 'human',
            display_name         TEXT NOT NULL DEFAULT '',
            bio                  TEXT NOT NULL DEFAULT '',
            avatar               TEXT,
            values_core          TEXT NOT NULL DEFAULT '[]',
            values_priorities    TEXT NOT NULL DEFAULT '[]',
            values_deal_breakers TEXT NOT NULL DEFAULT '[]',
            interests_topics     TEXT NOT NULL DEFAULT '[]',
            interests_skills     TEXT NOT NULL DEFAULT '[]',
            interests_goals      TEXT NOT NULL DEFAULT '[]',
            comm_tone            TEXT NOT NULL DEFAULT 'casual',
            comm_pace            TEXT NOT NULL DEFAULT 'moderate',
            comm_depth           TEXT NOT NULL DEFAULT 'moderate',
            privacy_level        TEXT NOT NULL DEFAULT 'public',
            forbidden_topics     TEXT NOT NULL DEFAULT '[]',
            created_at           INTEGER NOT NULL,
            updated_at           INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id          TEXT PRIMARY KEY,
            address     TEXT NOT NULL,
            type        TEXT NOT NULL,
            actor       TEXT,
            target_id   TEXT,
            message     TEXT NOT NULL,
            read        INTEGER NOT NULL DEFAULT 0,
            created_at  INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_address ON notifications(address);
        CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(address, read);
    `);
}

export function registerSocialRoutes(app: FastifyInstance, db: Database): void {
    ensureSocialTables(db);

    const stmts = {
        getProfile: db.prepare('SELECT * FROM profiles WHERE address = ? LIMIT 1'),
        upsertProfile: db.prepare(`
            INSERT INTO profiles (address, display_name, bio, avatar, domain, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(address) DO UPDATE SET
                display_name = excluded.display_name,
                bio = excluded.bio,
                avatar = excluded.avatar,
                domain = excluded.domain,
                metadata = excluded.metadata,
                updated_at = excluded.updated_at
        `),
        countFollowers: db.prepare('SELECT COUNT(*) as count FROM follows WHERE following = ?'),
        countFollowing: db.prepare('SELECT COUNT(*) as count FROM follows WHERE follower = ?'),

        getFeed: db.prepare(`
            SELECT p.*, pr.display_name as author_name, pr.avatar as author_avatar, pr.domain as author_domain
            FROM posts p
            LEFT JOIN profiles pr ON p.author_address = pr.address
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `),
        getPost: db.prepare(`
            SELECT p.*, pr.display_name as author_name, pr.avatar as author_avatar, pr.domain as author_domain
            FROM posts p
            LEFT JOIN profiles pr ON p.author_address = pr.address
            WHERE p.id = ?
        `),
        insertPost: db.prepare(
            'INSERT INTO posts (id, author_address, content, media, likes, comments, shares, created_at) VALUES (?, ?, ?, ?, 0, 0, 0, ?)',
        ),
        hasLiked: db.prepare('SELECT 1 FROM post_likes WHERE post_id = ? AND address = ?'),
        insertLike: db.prepare('INSERT OR IGNORE INTO post_likes (post_id, address, created_at) VALUES (?, ?, ?)'),
        removeLike: db.prepare('DELETE FROM post_likes WHERE post_id = ? AND address = ?'),
        incLikes: db.prepare('UPDATE posts SET likes = likes + 1 WHERE id = ?'),
        decLikes: db.prepare('UPDATE posts SET likes = MAX(likes - 1, 0) WHERE id = ?'),

        deletePost: db.prepare('DELETE FROM posts WHERE id = ? AND author_address = ?'),

        getFollowers: db.prepare(`
            SELECT f.follower as address, p.display_name, p.bio, p.avatar, p.domain
            FROM follows f LEFT JOIN profiles p ON f.follower = p.address
            WHERE f.following = ? ORDER BY f.created_at DESC LIMIT ? OFFSET ?
        `),
        getFollowing: db.prepare(`
            SELECT f.following as address, p.display_name, p.bio, p.avatar, p.domain
            FROM follows f LEFT JOIN profiles p ON f.following = p.address
            WHERE f.follower = ? ORDER BY f.created_at DESC LIMIT ? OFFSET ?
        `),
        isFollowing: db.prepare('SELECT 1 FROM follows WHERE follower = ? AND following = ?'),
        insertFollow: db.prepare('INSERT OR IGNORE INTO follows (follower, following, created_at) VALUES (?, ?, ?)'),
        removeFollow: db.prepare('DELETE FROM follows WHERE follower = ? AND following = ?'),

        getNotifications: db.prepare(`
            SELECT id, type, actor, target_id AS targetId, message, read, created_at AS createdAt
            FROM notifications
            WHERE address = ?
            ORDER BY created_at DESC
            LIMIT 50
        `),
        getUnreadCount: db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE address = ? AND read = 0'),
        markNotificationsRead: db.prepare('UPDATE notifications SET read = 1 WHERE address = ?'),
    };

    // ── Profile ──

    app.get<{ Params: { address: string } }>('/api/profile/:address', async (request) => {
        const { address } = request.params;
        const row = stmts.getProfile.get(address);
        if (!row) {
            return {
                address,
                displayName: `Agent ${address.slice(0, 6)}`,
                bio: '',
                avatar: null,
                domain: null,
                followers: 0,
                following: 0,
                createdAt: new Date().toISOString(),
            };
        }
        const followers = (stmts.countFollowers.get(address) as any)?.count ?? 0;
        const following = (stmts.countFollowing.get(address) as any)?.count ?? 0;
        return {
            address: row.address,
            displayName: row.display_name || `Agent ${String(row.address).slice(0, 6)}`,
            bio: row.bio,
            avatar: row.avatar,
            domain: row.domain,
            metadata: JSON.parse(String(row.metadata || '{}')),
            followers,
            following,
            createdAt: new Date(Number(row.created_at)).toISOString(),
        };
    });

    app.post<{ Body: { displayName?: string; bio?: string; avatar?: string; domain?: string; metadata?: object } }>(
        '/api/profile',
        async (request, reply) => {
            const wallet = getWallet(request);
            if (!wallet) {
                reply.code(401).send({ error: 'AUTH_REQUIRED' });
                return;
            }

            const { displayName, bio, avatar, domain, metadata } = request.body;
            const now = Date.now();
            stmts.upsertProfile.run(
                wallet,
                displayName || '',
                bio || '',
                avatar || null,
                domain || null,
                JSON.stringify(metadata || {}),
                now,
                now,
            );
            return { success: true };
        },
    );

    // ── Feed ──

    app.get<{ Querystring: { page?: string; limit?: string; type?: string; sortBy?: string } }>(
        '/api/feed',
        async (request) => {
            const page = Math.max(1, parseInt(request.query.page || '1'));
            const limit = Math.min(50, Math.max(1, parseInt(request.query.limit || '20')));
            const offset = (page - 1) * limit;

            const posts = stmts.getFeed.all(limit + 1, offset);
            const hasMore = posts.length > limit;
            if (hasMore) posts.pop();

            return {
                posts: posts.map(formatPost),
                page,
                limit,
                hasMore,
            };
        },
    );

    app.get<{ Params: { id: string } }>('/api/posts/:id', async (request, reply) => {
        const row = stmts.getPost.get(request.params.id);
        if (!row) {
            reply.code(404).send({ error: 'Post not found' });
            return;
        }
        return formatPost(row);
    });

    app.post<{ Body: { content: string; media?: Array<{ type: string; url: string }> } }>(
        '/api/posts',
        async (request, reply) => {
            const wallet = getWallet(request);
            if (!wallet) {
                reply.code(401).send({ error: 'AUTH_REQUIRED' });
                return;
            }

            const { content, media } = request.body;
            if (!content?.trim()) {
                reply.code(400).send({ error: 'Content required' });
                return;
            }

            const id = randomBytes(16).toString('hex');
            stmts.insertPost.run(id, wallet, content.trim(), JSON.stringify(media || []), Date.now());

            return { id, success: true };
        },
    );

    app.post<{ Params: { id: string } }>('/api/posts/:id/like', async (request, reply) => {
        const wallet = getWallet(request);
        if (!wallet) {
            reply.code(401).send({ error: 'AUTH_REQUIRED' });
            return;
        }

        const { id } = request.params;
        const already = stmts.hasLiked.get(id, wallet);
        if (already) {
            stmts.removeLike.run(id, wallet);
            stmts.decLikes.run(id);
            return { success: true, liked: false };
        }
        stmts.insertLike.run(id, wallet, Date.now());
        stmts.incLikes.run(id);
        return { success: true, liked: true };
    });

    // ── Follows ──

    app.get<{ Params: { address: string }; Querystring: { page?: string; limit?: string } }>(
        '/api/followers/:address',
        async (request) => {
            const page = Math.max(1, parseInt(request.query.page || '1'));
            const limit = Math.min(50, parseInt(request.query.limit || '20'));
            const followers = stmts.getFollowers.all(request.params.address, limit, (page - 1) * limit);
            return {
                followers: followers.map((r) => ({
                    address: r.address,
                    displayName: r.display_name || `Agent ${String(r.address).slice(0, 6)}`,
                    bio: r.bio || '',
                    avatar: r.avatar,
                    domain: r.domain,
                })),
            };
        },
    );

    app.get<{ Params: { address: string }; Querystring: { page?: string; limit?: string } }>(
        '/api/following/:address',
        async (request) => {
            const page = Math.max(1, parseInt(request.query.page || '1'));
            const limit = Math.min(50, parseInt(request.query.limit || '20'));
            const following = stmts.getFollowing.all(request.params.address, limit, (page - 1) * limit);
            return {
                following: following.map((r) => ({
                    address: r.address,
                    displayName: r.display_name || `Agent ${String(r.address).slice(0, 6)}`,
                    bio: r.bio || '',
                    avatar: r.avatar,
                    domain: r.domain,
                })),
            };
        },
    );

    app.post<{ Body: { targetAddress: string } }>('/api/follow', async (request, reply) => {
        const wallet = getWallet(request);
        if (!wallet) {
            reply.code(401).send({ error: 'AUTH_REQUIRED' });
            return;
        }
        const { targetAddress } = request.body;
        if (!targetAddress) {
            reply.code(400).send({ error: 'targetAddress required' });
            return;
        }
        if (wallet === targetAddress) {
            reply.code(400).send({ error: 'Cannot follow yourself' });
            return;
        }
        stmts.insertFollow.run(wallet, targetAddress, Date.now());
        return { success: true };
    });

    app.post<{ Body: { targetAddress: string } }>('/api/unfollow', async (request, reply) => {
        const wallet = getWallet(request);
        if (!wallet) {
            reply.code(401).send({ error: 'AUTH_REQUIRED' });
            return;
        }
        const { targetAddress } = request.body;
        if (!targetAddress) {
            reply.code(400).send({ error: 'targetAddress required' });
            return;
        }
        stmts.removeFollow.run(wallet, targetAddress);
        return { success: true };
    });

    app.get<{ Querystring: { follower: string; following: string } }>('/api/is-following', async (request) => {
        const { follower, following } = request.query;
        const row = stmts.isFollowing.get(follower, following);
        return { following: !!row };
    });

    app.delete<{ Params: { id: string } }>('/api/posts/:id', async (request, reply) => {
        const wallet = getWallet(request);
        if (!wallet) {
            reply.code(401).send({ error: 'AUTH_REQUIRED' });
            return;
        }
        const { id } = request.params;
        const result = stmts.deletePost.run(id, wallet);
        if (result.changes === 0) {
            reply.code(404).send({ error: 'Post not found or not authorized' });
            return;
        }
        return { success: true };
    });

    // ── Notifications ──
    app.get<{ Params: { address: string } }>('/api/notifications/:address', async (request) => {
        const rows = stmts.getNotifications.all(request.params.address);
        return rows.map((r: any) => ({
            id: r.id,
            type: r.type,
            actor: r.actor,
            targetId: r.targetId,
            message: r.message,
            read: !!r.read,
            createdAt: Number(r.createdAt),
        }));
    });

    app.get<{ Params: { address: string } }>('/api/notifications/:address/unread', async (request) => {
        const row = stmts.getUnreadCount.get(request.params.address) as any;
        return { count: row?.count ?? 0 };
    });

    app.post<{ Params: { address: string } }>('/api/notifications/:address/read', async (request, reply) => {
        const wallet = getWallet(request);
        if (!wallet) {
            reply.code(401).send({ error: 'AUTH_REQUIRED' });
            return;
        }
        stmts.markNotificationsRead.run(request.params.address);
        return { success: true };
    });

    // ── Soul Profiles ──

    const soulStmts = {
        get: db.prepare('SELECT * FROM soul_profiles WHERE address = ?'),
        getAll: db.prepare('SELECT * FROM soul_profiles'),
        getAllExcept: db.prepare('SELECT * FROM soul_profiles WHERE address != ?'),
        upsert: db.prepare(`
            INSERT INTO soul_profiles (address, soul_type, display_name, bio, avatar,
                values_core, values_priorities, values_deal_breakers,
                interests_topics, interests_skills, interests_goals,
                comm_tone, comm_pace, comm_depth, privacy_level, forbidden_topics,
                created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(address) DO UPDATE SET
                soul_type = excluded.soul_type,
                display_name = excluded.display_name,
                bio = excluded.bio,
                avatar = excluded.avatar,
                values_core = excluded.values_core,
                values_priorities = excluded.values_priorities,
                values_deal_breakers = excluded.values_deal_breakers,
                interests_topics = excluded.interests_topics,
                interests_skills = excluded.interests_skills,
                interests_goals = excluded.interests_goals,
                comm_tone = excluded.comm_tone,
                comm_pace = excluded.comm_pace,
                comm_depth = excluded.comm_depth,
                privacy_level = excluded.privacy_level,
                forbidden_topics = excluded.forbidden_topics,
                updated_at = excluded.updated_at
        `),
    };

    // Save/update my soul profile
    app.post<{
        Body: {
            soulType?: string;
            displayName?: string;
            bio?: string;
            avatar?: string;
            values?: { core?: string[]; priorities?: string[]; dealBreakers?: string[] };
            interests?: { topics?: string[]; skills?: string[]; goals?: string[] };
            communication?: { tone?: string; pace?: string; depth?: string };
            privacyLevel?: PrivacyLevel;
            forbiddenTopics?: string[];
        };
    }>('/api/soul-profile', async (request, reply) => {
        const wallet = getWallet(request);
        if (!wallet) {
            reply.code(401).send({ error: 'AUTH_REQUIRED' });
            return;
        }

        const b = request.body;
        const now = Date.now();
        soulStmts.upsert.run(
            wallet,
            b.soulType || 'human',
            b.displayName || '',
            b.bio || '',
            b.avatar || null,
            JSON.stringify(b.values?.core || []),
            JSON.stringify(b.values?.priorities || []),
            JSON.stringify(b.values?.dealBreakers || []),
            JSON.stringify(b.interests?.topics || []),
            JSON.stringify(b.interests?.skills || []),
            JSON.stringify(b.interests?.goals || []),
            b.communication?.tone || 'casual',
            b.communication?.pace || 'moderate',
            b.communication?.depth || 'moderate',
            b.privacyLevel || 'public',
            JSON.stringify(b.forbiddenTopics || []),
            now,
            now,
        );
        return { success: true };
    });

    // Get my own soul profile (full, no filtering)
    app.get('/api/soul-profile', async (request, reply) => {
        const wallet = getWallet(request);
        if (!wallet) {
            reply.code(401).send({ error: 'AUTH_REQUIRED' });
            return;
        }
        const row = soulStmts.get.get(wallet);
        if (!row) return { profile: null };
        const p = parseSoulRow(row);
        return {
            profile: {
                address: p.address,
                soulType: p.soul_type,
                displayName: p.display_name,
                bio: p.bio,
                avatar: p.avatar,
                values: { core: p.values_core, priorities: p.values_priorities, dealBreakers: p.values_deal_breakers },
                interests: { topics: p.interests_topics, skills: p.interests_skills, goals: p.interests_goals },
                communication: { tone: p.comm_tone, pace: p.comm_pace, depth: p.comm_depth },
                privacyLevel: p.privacy_level,
                forbiddenTopics: p.forbidden_topics,
            },
        };
    });

    // Get matches -- server-side computation, privacy-filtered
    app.get('/api/matches', async (request, reply) => {
        const wallet = getWallet(request);
        if (!wallet) {
            reply.code(401).send({ error: 'AUTH_REQUIRED' });
            return;
        }

        const myRow = soulStmts.get.get(wallet);
        if (!myRow) {
            return { matches: [], message: 'Create your soul profile first' };
        }
        const me = parseSoulRow(myRow);

        const otherRows = soulStmts.getAllExcept.all(wallet);
        const results = otherRows.map((row) => {
            const other = parseSoulRow(row);
            const match = computeMatch(me, other);
            return { ...filterByPrivacy(other, match), score: match.score };
        });

        results.sort((a, b) => b.score - a.score);
        return { matches: results };
    });

    // Discover -- browse profiles with privacy filtering (no matching, just listing)
    app.get('/api/discover', async (request) => {
        const wallet = getWallet(request);
        const rows = soulStmts.getAll.all();
        const profiles = rows
            .filter((row) => String(row.address) !== wallet)
            .map((row) => {
                const p = parseSoulRow(row);
                if (p.privacy_level === 'private') {
                    return {
                        address: p.address,
                        soulType: p.soul_type,
                        displayName: `Anonymous ${p.address.slice(0, 6)}`,
                        privacyLevel: 'private' as const,
                    };
                }
                // zk-selective and public both show basic info in discovery
                return {
                    address: p.address,
                    soulType: p.soul_type,
                    displayName: p.display_name,
                    bio: p.bio,
                    avatar: p.avatar,
                    privacyLevel: p.privacy_level,
                    interests: { topics: p.interests_topics },
                    communication: { tone: p.comm_tone, pace: p.comm_pace, depth: p.comm_depth },
                };
            });
        return { profiles };
    });
}

function formatPost(row: Record<string, unknown>) {
    return {
        id: row.id,
        authorAddress: row.author_address,
        authorName: row.author_name || `Agent ${String(row.author_address).slice(0, 6)}`,
        authorAvatar: row.author_avatar || null,
        authorDomain: row.author_domain || null,
        content: row.content,
        media: JSON.parse(String(row.media || '[]')),
        likes: Number(row.likes || 0),
        comments: Number(row.comments || 0),
        shares: Number(row.shares || 0),
        createdAt: new Date(Number(row.created_at)).toISOString(),
    };
}
