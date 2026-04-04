import type { FastifyInstance } from 'fastify';
import type { SessionManager } from '../../auth/session-manager.js';

interface VerifyBody {
    walletAddress: string;
    challenge: string;
    signature: string;
}

export function registerSessionRoutes(app: FastifyInstance, sessionManager: SessionManager): void {
    app.post('/api/v1/auth/challenge', async (_request, _reply) => {
        return sessionManager.requestChallenge();
    });

    app.post<{ Body: VerifyBody }>('/api/v1/auth/verify', async (request, reply) => {
        const { walletAddress, challenge, signature } = request.body;

        if (!walletAddress || !challenge || !signature) {
            reply.code(400).send({ error: 'INVALID_REQUEST', message: 'walletAddress, challenge, and signature are required' });
            return;
        }

        try {
            const session = sessionManager.verifyAndCreateSession({ walletAddress, challenge, signature });
            return session;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Verification failed';
            reply.code(401).send({ error: 'AUTH_FAILED', message });
        }
    });

    app.post('/api/v1/auth/logout', async (request, reply) => {
        const auth = request.headers.authorization;
        if (!auth?.startsWith('Bearer ')) {
            reply.code(401).send({ error: 'AUTH_REQUIRED' });
            return;
        }
        sessionManager.revokeSession(auth.slice(7));
        return { ok: true };
    });

    app.get('/api/v1/auth/me', async (request, reply) => {
        const auth = request.headers.authorization;
        if (!auth?.startsWith('Bearer ')) {
            reply.code(401).send({ error: 'AUTH_REQUIRED' });
            return;
        }
        const session = sessionManager.validateSession(auth.slice(7));
        if (!session) {
            reply.code(401).send({ error: 'SESSION_EXPIRED' });
            return;
        }
        return { walletAddress: session.walletAddress };
    });
}
