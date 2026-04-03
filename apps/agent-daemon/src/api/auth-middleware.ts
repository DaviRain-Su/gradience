import type { FastifyRequest, FastifyReply } from 'fastify';

export function createAuthHook(token: string) {
    return async function authHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const auth = request.headers.authorization;
        if (!auth) {
            reply.code(401).send({ error: 'AUTH_REQUIRED', message: 'Authorization header required' });
            return;
        }
        const parts = auth.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer' || parts[1] !== token) {
            reply.code(401).send({ error: 'AUTH_INVALID', message: 'Invalid authorization token' });
            return;
        }
    };
}
