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

const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes without heartbeat
const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getWallet(request: FastifyRequest): string | null {
    return (request as any).walletAddress ?? null;
}

function getAuthType(request: FastifyRequest): string | null {
    return (request as any).authType ?? null;
}

function ensureNetworkTables(db: Database): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS network_agents (
            public_key    TEXT PRIMARY KEY,
            display_name  TEXT NOT NULL DEFAULT '',
            capabilities  TEXT NOT NULL DEFAULT '[]',
            endpoint      TEXT,
            version       TEXT,
            online        INTEGER NOT NULL DEFAULT 1,
            last_seen     INTEGER NOT NULL,
            registered_at INTEGER NOT NULL,
            metadata      TEXT NOT NULL DEFAULT '{}'
        );
        CREATE INDEX IF NOT EXISTS idx_net_agents_online ON network_agents(online);
        CREATE INDEX IF NOT EXISTS idx_net_agents_lastseen ON network_agents(last_seen);

        CREATE TABLE IF NOT EXISTS network_messages (
            id          TEXT PRIMARY KEY,
            from_pubkey TEXT NOT NULL,
            to_pubkey   TEXT NOT NULL,
            type        TEXT NOT NULL,
            payload     TEXT NOT NULL DEFAULT '{}',
            delivered   INTEGER NOT NULL DEFAULT 0,
            acked       INTEGER NOT NULL DEFAULT 0,
            created_at  INTEGER NOT NULL,
            expires_at  INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_netmsg_to ON network_messages(to_pubkey, delivered);
        CREATE INDEX IF NOT EXISTS idx_netmsg_expires ON network_messages(expires_at);
    `);
}

export function registerNetworkRoutes(app: FastifyInstance, db: Database): void {
    ensureNetworkTables(db);

    const stmts = {
        // Agent Registry
        upsertAgent: db.prepare(`
            INSERT INTO network_agents (public_key, display_name, capabilities, endpoint, version, online, last_seen, registered_at, metadata)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
            ON CONFLICT(public_key) DO UPDATE SET
                display_name = excluded.display_name,
                capabilities = excluded.capabilities,
                endpoint = excluded.endpoint,
                version = excluded.version,
                online = 1,
                last_seen = excluded.last_seen,
                metadata = excluded.metadata
        `),
        getAgent: db.prepare('SELECT * FROM network_agents WHERE public_key = ? LIMIT 1'),
        listOnline: db.prepare(`
            SELECT * FROM network_agents WHERE online = 1
            ORDER BY last_seen DESC LIMIT ? OFFSET ?
        `),
        listAll: db.prepare(`
            SELECT * FROM network_agents
            ORDER BY last_seen DESC LIMIT ? OFFSET ?
        `),
        searchByCapability: db.prepare(`
            SELECT * FROM network_agents WHERE online = 1 AND capabilities LIKE ?
            ORDER BY last_seen DESC LIMIT ? OFFSET ?
        `),
        heartbeat: db.prepare(`
            UPDATE network_agents SET last_seen = ?, online = 1 WHERE public_key = ?
        `),
        markOffline: db.prepare(`
            UPDATE network_agents SET online = 0 WHERE last_seen < ? AND online = 1
        `),
        removeAgent: db.prepare('DELETE FROM network_agents WHERE public_key = ?'),
        countOnline: db.prepare('SELECT COUNT(*) as count FROM network_agents WHERE online = 1'),

        // Messages
        insertMessage: db.prepare(`
            INSERT INTO network_messages (id, from_pubkey, to_pubkey, type, payload, delivered, acked, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
        `),
        getInbox: db.prepare(`
            SELECT * FROM network_messages WHERE to_pubkey = ? AND delivered = 0 AND expires_at > ?
            ORDER BY created_at ASC LIMIT ?
        `),
        getInboxSince: db.prepare(`
            SELECT * FROM network_messages WHERE to_pubkey = ? AND created_at > ? AND expires_at > ? AND delivered = 0
            ORDER BY created_at ASC LIMIT ?
        `),
        markDelivered: db.prepare('UPDATE network_messages SET delivered = 1 WHERE id = ?'),
        ackMessage: db.prepare('UPDATE network_messages SET acked = 1 WHERE id = ? AND to_pubkey = ?'),
        pruneExpired: db.prepare('DELETE FROM network_messages WHERE expires_at <= ?'),
    };

    // Prune stale agents and expired messages periodically
    const pruneInterval = setInterval(() => {
        const now = Date.now();
        stmts.markOffline.run(now - OFFLINE_THRESHOLD_MS);
        stmts.pruneExpired.run(now);
    }, 30_000);

    app.addHook('onClose', () => clearInterval(pruneInterval));

    // ══════════════════════════════════════════════════════════════════════
    // Agent Registry
    // ══════════════════════════════════════════════════════════════════════

    app.post<{
        Body: {
            publicKey: string;
            displayName?: string;
            capabilities?: string[];
            endpoint?: string;
            version?: string;
            metadata?: object;
        };
    }>('/api/v1/network/register', async (request, reply) => {
        const { publicKey, displayName, capabilities, endpoint, version, metadata } = request.body;

        if (!publicKey || typeof publicKey !== 'string' || publicKey.length < 32) {
            reply.code(400).send({ error: 'INVALID_REQUEST', message: 'publicKey is required' });
            return;
        }

        const now = Date.now();
        stmts.upsertAgent.run(
            publicKey,
            displayName || `Agent ${publicKey.slice(0, 8)}`,
            JSON.stringify(capabilities || []),
            endpoint || null,
            version || '0.1.0',
            now,
            now,
            JSON.stringify(metadata || {}),
        );

        return { agentId: publicKey, registeredAt: now };
    });

    app.get<{
        Querystring: { online?: string; capability?: string; limit?: string; offset?: string; q?: string };
    }>('/api/v1/network/agents', async (request) => {
        const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '50')));
        const offset = Math.max(0, parseInt(request.query.offset || '0'));
        const onlineOnly = request.query.online !== 'false';
        const capability = request.query.capability;
        const q = request.query.q;

        let rows: Record<string, unknown>[];
        if (capability) {
            rows = stmts.searchByCapability.all(`%${capability}%`, limit, offset);
        } else if (onlineOnly) {
            rows = stmts.listOnline.all(limit, offset);
        } else {
            rows = stmts.listAll.all(limit, offset);
        }

        let agents = rows.map(formatAgent);

        if (q) {
            const lower = q.toLowerCase();
            agents = agents.filter(a =>
                a.displayName.toLowerCase().includes(lower) ||
                a.publicKey.toLowerCase().includes(lower)
            );
        }

        const total = (stmts.countOnline.get() as any)?.count ?? 0;

        return { agents, total };
    });

    app.get<{ Params: { publicKey: string } }>('/api/v1/network/agents/:publicKey', async (request, reply) => {
        const row = stmts.getAgent.get(request.params.publicKey);
        if (!row) {
            reply.code(404).send({ error: 'AGENT_NOT_FOUND' });
            return;
        }
        return formatAgent(row);
    });

    app.post<{ Body: { publicKey: string } }>('/api/v1/network/heartbeat', async (request, reply) => {
        const { publicKey } = request.body;
        if (!publicKey) {
            reply.code(400).send({ error: 'INVALID_REQUEST', message: 'publicKey required' });
            return;
        }
        const result = stmts.heartbeat.run(Date.now(), publicKey);
        if (result.changes === 0) {
            reply.code(404).send({ error: 'AGENT_NOT_FOUND', message: 'Register first' });
            return;
        }
        return { ok: true };
    });

    app.delete<{ Params: { publicKey: string } }>('/api/v1/network/agents/:publicKey', async (request, reply) => {
        stmts.removeAgent.run(request.params.publicKey);
        return { ok: true };
    });

    // ══════════════════════════════════════════════════════════════════════
    // Message Relay
    // ══════════════════════════════════════════════════════════════════════

    app.post<{
        Body: { to: string; type: string; payload?: object };
    }>('/api/v1/network/messages', async (request, reply) => {
        const wallet = getWallet(request);
        const authType = getAuthType(request);
        // For daemon-token auth, publicKey might be in body
        const from = wallet || (request.body as any).from;

        if (!from) {
            reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Sender identity required' });
            return;
        }

        const { to, type, payload } = request.body;
        if (!to || !type) {
            reply.code(400).send({ error: 'INVALID_REQUEST', message: 'to and type are required' });
            return;
        }

        const id = randomBytes(16).toString('hex');
        const now = Date.now();

        stmts.insertMessage.run(
            id, from, to, type,
            JSON.stringify(payload || {}),
            now, now + MESSAGE_TTL_MS,
        );

        return { messageId: id, delivered: false };
    });

    app.get<{
        Querystring: { since?: string; limit?: string };
    }>('/api/v1/network/messages/inbox', async (request, reply) => {
        const wallet = getWallet(request);
        if (!wallet) {
            reply.code(401).send({ error: 'AUTH_REQUIRED' });
            return;
        }

        const limit = Math.min(100, parseInt(request.query.limit || '50'));
        const since = parseInt(request.query.since || '0');
        const now = Date.now();

        let rows: Record<string, unknown>[];
        if (since > 0) {
            rows = stmts.getInboxSince.all(wallet, since, now, limit);
        } else {
            rows = stmts.getInbox.all(wallet, now, limit);
        }

        // Mark as delivered
        for (const row of rows) {
            stmts.markDelivered.run(row.id);
        }

        return {
            messages: rows.map(r => ({
                id: r.id,
                from: r.from_pubkey,
                to: r.to_pubkey,
                type: r.type,
                payload: JSON.parse(String(r.payload || '{}')),
                createdAt: Number(r.created_at),
            })),
        };
    });

    app.post<{ Params: { id: string } }>('/api/v1/network/messages/:id/ack', async (request, reply) => {
        const wallet = getWallet(request);
        if (!wallet) {
            reply.code(401).send({ error: 'AUTH_REQUIRED' });
            return;
        }
        stmts.ackMessage.run(request.params.id, wallet);
        return { ok: true };
    });
}

function formatAgent(row: Record<string, unknown>) {
    return {
        publicKey: row.public_key as string,
        displayName: row.display_name as string || `Agent ${(row.public_key as string).slice(0, 8)}`,
        capabilities: JSON.parse(String(row.capabilities || '[]')),
        endpoint: row.endpoint as string | null,
        version: row.version as string,
        online: !!row.online,
        lastSeen: Number(row.last_seen),
        registeredAt: Number(row.registered_at),
        metadata: JSON.parse(String(row.metadata || '{}')),
    };
}
