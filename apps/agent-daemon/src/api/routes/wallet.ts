import type { FastifyInstance } from 'fastify';
import type { AuthorizationManager, SigningPolicy } from '../../wallet/authorization.js';
import { DaemonError } from '../../utils/errors.js';

interface AuthorizeBody {
    masterWallet: string;
    challenge: string;
    signature: string;
    policy?: Partial<SigningPolicy>;
}

export function registerWalletRoutes(app: FastifyInstance, authManager: AuthorizationManager): void {
    /**
     * Step 1 of the authorization flow.
     * Returns a one-time challenge that the frontend must sign with the master wallet.
     */
    app.post('/api/v1/wallet/request-authorization', async (_request, reply) => {
        try {
            const result = authManager.requestAuthorization();
            return result;
        } catch (err) {
            if (err instanceof DaemonError) {
                reply.code(err.statusCode).send({ error: err.code, message: err.message });
                return;
            }
            throw err;
        }
    });

    /**
     * Step 2 of the authorization flow.
     * The frontend provides the master wallet's signature over the challenge.
     * On success the daemon is authorized to sign transactions within policy limits.
     */
    app.post<{ Body: AuthorizeBody }>('/api/v1/wallet/authorize', async (request, reply) => {
        try {
            const { masterWallet, challenge, signature, policy } = request.body;

            if (typeof masterWallet !== 'string' || masterWallet.length === 0) {
                reply.code(400).send({ error: 'INVALID_REQUEST', message: 'masterWallet is required' });
                return;
            }
            if (typeof challenge !== 'string' || challenge.length === 0) {
                reply.code(400).send({ error: 'INVALID_REQUEST', message: 'challenge is required' });
                return;
            }
            if (typeof signature !== 'string' || signature.length === 0) {
                reply.code(400).send({ error: 'INVALID_REQUEST', message: 'signature is required' });
                return;
            }

            authManager.authorize({ masterWallet, challenge, signature, policy });
            return { ok: true, agentWallet: authManager.agentWallet, masterWallet };
        } catch (err) {
            if (err instanceof DaemonError) {
                reply.code(err.statusCode).send({ error: err.code, message: err.message });
                return;
            }
            throw err;
        }
    });

    /**
     * Returns the current authorization state and policy.
     */
    app.get('/api/v1/wallet/status', async (_request, _reply) => {
        return authManager.getStatus();
    });

    /**
     * Revoke the current authorization.
     * Protected by the daemon bearer token — no additional signature required.
     */
    app.post('/api/v1/wallet/revoke', async (_request, reply) => {
        try {
            if (!authManager.authorized) {
                reply.code(400).send({ error: 'WALLET_NOT_AUTHORIZED', message: 'No active authorization to revoke' });
                return;
            }
            authManager.revoke();
            return { ok: true };
        } catch (err) {
            if (err instanceof DaemonError) {
                reply.code(err.statusCode).send({ error: err.code, message: err.message });
                return;
            }
            throw err;
        }
    });

    /**
     * Returns the current signing policy.
     */
    app.get('/api/v1/wallet/policy', async (_request, reply) => {
        if (!authManager.authorized) {
            reply.code(403).send({ error: 'WALLET_NOT_AUTHORIZED', message: 'Not authorized' });
            return;
        }
        return {
            policy: authManager.policy,
            dailySpendLamports: authManager.getDailySpend(),
        };
    });
}
