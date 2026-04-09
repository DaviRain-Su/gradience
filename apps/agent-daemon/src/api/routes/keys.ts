import type { FastifyInstance } from 'fastify';
import type { KeyManager } from '../../keys/key-manager.js';
import { DaemonError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import crypto from 'node:crypto';

interface ApiKeyRecord {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    createdAt: number;
    revokedAt?: number;
}

const apiKeys = new Map<string, { record: ApiKeyRecord; tokenHash: string }>();

function generateToken(): string {
    return `ows_key_${crypto.randomBytes(32).toString('hex')}`;
}

function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export function registerKeyRoutes(app: FastifyInstance, keyManager: KeyManager): void {
    app.post<{ Body: { name: string; scopes?: string[] } }>('/api/v1/keys/create', async (request, reply) => {
        try {
            const { name, scopes = ['sign'] } = request.body;
            if (!name) {
                return reply.code(400).send({ error: 'Missing name' });
            }
            const token = generateToken();
            const prefix = token.slice(0, 12);
            const record: ApiKeyRecord = {
                id: crypto.randomUUID(),
                name,
                prefix,
                scopes,
                createdAt: Date.now(),
            };
            apiKeys.set(record.id, { record, tokenHash: hashToken(token) });
            logger.info({ keyId: record.id, prefix }, 'API key created');
            return { key: record, token };
        } catch (err) {
            if (err instanceof DaemonError) {
                reply.code(err.statusCode).send({ error: err.code, message: err.message });
                return;
            }
            throw err;
        }
    });

    app.get('/api/v1/keys/list', async (_request, reply) => {
        try {
            const keys = Array.from(apiKeys.values())
                .filter((k) => !k.record.revokedAt)
                .map((k) => k.record);
            return { keys };
        } catch (err) {
            if (err instanceof DaemonError) {
                reply.code(err.statusCode).send({ error: err.code, message: err.message });
                return;
            }
            throw err;
        }
    });

    app.delete<{ Params: { id: string } }>('/api/v1/keys/:id', async (request, reply) => {
        try {
            const entry = apiKeys.get(request.params.id);
            if (!entry || entry.record.revokedAt) {
                return reply.code(404).send({ error: 'Key not found' });
            }
            entry.record.revokedAt = Date.now();
            logger.info({ keyId: entry.record.id }, 'API key revoked');
            return { success: true };
        } catch (err) {
            if (err instanceof DaemonError) {
                reply.code(err.statusCode).send({ error: err.code, message: err.message });
                return;
            }
            throw err;
        }
    });

    app.post<{ Body: { token: string; message: string } }>('/api/v1/keys/agent-sign', async (request, reply) => {
        try {
            const { token, message } = request.body;
            if (!token || !message) {
                return reply.code(400).send({ error: 'Missing token or message' });
            }
            const hashed = hashToken(token);
            const entry = Array.from(apiKeys.values()).find((k) => k.tokenHash === hashed && !k.record.revokedAt);
            if (!entry) {
                return reply.code(401).send({ error: 'Invalid or revoked API key' });
            }
            if (!entry.record.scopes.includes('sign')) {
                return reply.code(403).send({ error: 'API key does not have sign scope' });
            }
            const messageBytes = Buffer.from(message, 'base64');
            const signature = keyManager.sign(messageBytes);
            return {
                signature: Buffer.from(signature).toString('base64'),
                publicKey: keyManager.getPublicKey(),
            };
        } catch (err) {
            if (err instanceof DaemonError) {
                reply.code(err.statusCode).send({ error: err.code, message: err.message });
                return;
            }
            throw err;
        }
    });

    app.post<{ Body: { message: string } }>('/api/v1/keys/sign', async (request, reply) => {
        try {
            const messageBytes = Buffer.from(request.body.message, 'base64');
            const signature = keyManager.sign(messageBytes);
            return {
                signature: Buffer.from(signature).toString('base64'),
                publicKey: keyManager.getPublicKey(),
            };
        } catch (err) {
            if (err instanceof DaemonError) {
                reply.code(err.statusCode).send({ error: err.code, message: err.message });
                return;
            }
            throw err;
        }
    });

    app.get('/api/v1/keys/public', async (_request, reply) => {
        try {
            return { publicKey: keyManager.getPublicKey() };
        } catch (err) {
            if (err instanceof DaemonError) {
                reply.code(err.statusCode).send({ error: err.code, message: err.message });
                return;
            }
            throw err;
        }
    });
}
