import type { FastifyInstance } from 'fastify';
import type { KeyManager } from '../../keys/key-manager.js';
import { DaemonError } from '../../utils/errors.js';

export function registerKeyRoutes(app: FastifyInstance, keyManager: KeyManager): void {
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
