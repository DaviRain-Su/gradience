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
            'INSERT INTO posts (id, author_address, content, media, likes, comments, shares, created_at) VALUES (?, ?, ?, ?, 0, 0, 0, ?)'
        ),
        hasLiked: db.prepare('SELECT 1 FROM post_likes WHERE post_id = ? AND address = ?'),
        insertLike: db.prepare('INSERT OR IGNORE INTO post_likes (post_id, address, created_at) VALUES (?, ?, ?)'),
        removeLike: db.prepare('DELETE FROM post_likes WHERE post_id = ? AND address = ?'),
        incLikes: db.prepare('UPDATE posts SET likes = likes + 1 WHERE id = ?'),
        decLikes: db.prepare('UPDATE posts SET likes = MAX(likes - 1, 0) WHERE id = ?'),

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
            if (!wallet) { reply.code(401).send({ error: 'AUTH_REQUIRED' }); return; }

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
        }
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
        }
    );

    app.get<{ Params: { id: string } }>('/api/posts/:id', async (request, reply) => {
        const row = stmts.getPost.get(request.params.id);
        if (!row) { reply.code(404).send({ error: 'Post not found' }); return; }
        return formatPost(row);
    });

    app.post<{ Body: { content: string; media?: Array<{ type: string; url: string }> } }>(
        '/api/posts',
        async (request, reply) => {
            const wallet = getWallet(request);
            if (!wallet) { reply.code(401).send({ error: 'AUTH_REQUIRED' }); return; }

            const { content, media } = request.body;
            if (!content?.trim()) { reply.code(400).send({ error: 'Content required' }); return; }

            const id = randomBytes(16).toString('hex');
            stmts.insertPost.run(id, wallet, content.trim(), JSON.stringify(media || []), Date.now());

            return { id, success: true };
        }
    );

    app.post<{ Params: { id: string } }>('/api/posts/:id/like', async (request, reply) => {
        const wallet = getWallet(request);
        if (!wallet) { reply.code(401).send({ error: 'AUTH_REQUIRED' }); return; }

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
                followers: followers.map(r => ({
                    address: r.address,
                    displayName: r.display_name || `Agent ${String(r.address).slice(0, 6)}`,
                    bio: r.bio || '',
                    avatar: r.avatar,
                    domain: r.domain,
                })),
            };
        }
    );

    app.get<{ Params: { address: string }; Querystring: { page?: string; limit?: string } }>(
        '/api/following/:address',
        async (request) => {
            const page = Math.max(1, parseInt(request.query.page || '1'));
            const limit = Math.min(50, parseInt(request.query.limit || '20'));
            const following = stmts.getFollowing.all(request.params.address, limit, (page - 1) * limit);
            return {
                following: following.map(r => ({
                    address: r.address,
                    displayName: r.display_name || `Agent ${String(r.address).slice(0, 6)}`,
                    bio: r.bio || '',
                    avatar: r.avatar,
                    domain: r.domain,
                })),
            };
        }
    );

    app.post<{ Body: { targetAddress: string } }>('/api/follow', async (request, reply) => {
        const wallet = getWallet(request);
        if (!wallet) { reply.code(401).send({ error: 'AUTH_REQUIRED' }); return; }
        const { targetAddress } = request.body;
        if (!targetAddress) { reply.code(400).send({ error: 'targetAddress required' }); return; }
        if (wallet === targetAddress) { reply.code(400).send({ error: 'Cannot follow yourself' }); return; }
        stmts.insertFollow.run(wallet, targetAddress, Date.now());
        return { success: true };
    });

    app.post<{ Body: { targetAddress: string } }>('/api/unfollow', async (request, reply) => {
        const wallet = getWallet(request);
        if (!wallet) { reply.code(401).send({ error: 'AUTH_REQUIRED' }); return; }
        const { targetAddress } = request.body;
        if (!targetAddress) { reply.code(400).send({ error: 'targetAddress required' }); return; }
        stmts.removeFollow.run(wallet, targetAddress);
        return { success: true };
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
