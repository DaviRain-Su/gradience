import type { FastifyInstance } from 'fastify';
import type { MessageRouter } from '../../messages/message-router.js';

export function registerMessageRoutes(app: FastifyInstance, messageRouter: MessageRouter): void {
    app.post<{ Body: { to: string; type: string; payload: unknown } }>(
        '/api/v1/messages/send',
        async (request, reply) => {
            const { to, type, payload } = request.body;
            if (!to || !type) {
                reply.code(400).send({ error: 'INVALID_REQUEST', message: 'Missing "to" or "type"' });
                return;
            }
            const result = messageRouter.send({ from: '', to, type, payload });
            if (!result.success) {
                reply.code(502).send({ error: 'SEND_FAILED', message: 'No protocol available' });
                return;
            }
            return { success: true, messageId: result.messageId, protocol: 'websocket' };
        },
    );

    app.get<{ Querystring: { direction?: string; limit?: string; offset?: string } }>(
        '/api/v1/messages',
        async (request) => {
            const dir = request.query.direction as 'inbound' | 'outbound' | undefined;
            const messages = messageRouter.listMessages(dir, Number(request.query.limit) || 50, Number(request.query.offset) || 0);
            return { messages, total: messages.length };
        },
    );
}
