import type { FastifyInstance } from 'fastify';
import type { A2ARouter } from '../../a2a-router/router.js';
import type { MessageRouter } from '../../messages/message-router.js';
import type { A2AMessageType, ProtocolType } from '@gradiences/a2a-types';

export function registerA2ARoutes(app: FastifyInstance, a2aRouter: A2ARouter, messageRouter: MessageRouter): void {
    // Discover agents via Nostr relays
    app.get<{
        Querystring: {
            capabilities?: string;
            minReputation?: string;
            availableOnly?: string;
            limit?: string;
        };
    }>('/api/v1/a2a/agents', async (request) => {
        const { capabilities, minReputation, availableOnly, limit } = request.query;
        const agents = await a2aRouter.discoverAgents({
            capabilities: capabilities ? capabilities.split(',') : undefined,
            minReputation: minReputation ? Number(minReputation) : undefined,
            availableOnly: availableOnly === 'true',
            limit: limit ? Number(limit) : 50,
        });
        return { agents, count: agents.length };
    });

    // Broadcast own capabilities to Nostr relays
    app.post<{
        Body: {
            address: string;
            displayName: string;
            capabilities: string[];
            reputationScore?: number;
            available?: boolean;
        };
    }>('/api/v1/a2a/broadcast', async (request, reply) => {
        const { address, displayName, capabilities, reputationScore, available } = request.body;
        if (!address || !displayName) {
            reply.code(400).send({ error: 'INVALID_REQUEST', message: 'Missing address or displayName' });
            return;
        }
        await a2aRouter.broadcastCapabilities({
            address,
            displayName,
            capabilities: capabilities ?? [],
            reputationScore: reputationScore ?? 0,
            available: available ?? true,
            discoveredVia: 'nostr',
            lastSeenAt: Date.now(),
        });
        return { success: true };
    });

    // Send A2A message (auto-selects protocol)
    app.post<{
        Body: {
            to: string;
            type: string;
            payload: unknown;
            preferredProtocol?: string;
        };
    }>('/api/v1/a2a/send', async (request, reply) => {
        const { to, type, payload, preferredProtocol } = request.body;
        if (!to || !type) {
            reply.code(400).send({ error: 'INVALID_REQUEST', message: 'Missing "to" or "type"' });
            return;
        }

        const result = await a2aRouter.send({
            to,
            type: type as A2AMessageType,
            payload,
            preferredProtocol: preferredProtocol as ProtocolType | undefined,
        });

        // Also persist via MessageRouter
        if (result.success) {
            messageRouter.send({ from: '', to, type, payload });
        }

        if (!result.success) {
            reply.code(502).send(result);
            return;
        }
        return result;
    });

    // List A2A messages (proxied from MessageRouter)
    app.get<{
        Querystring: { direction?: string; limit?: string; offset?: string };
    }>('/api/v1/a2a/messages', async (request) => {
        const dir = request.query.direction as 'inbound' | 'outbound' | undefined;
        const messages = messageRouter.listMessages(
            dir,
            Number(request.query.limit) || 50,
            Number(request.query.offset) || 0,
        );
        return { messages, total: messages.length };
    });

    // A2A health (basic)
    app.get('/api/v1/a2a/health', async () => {
        return a2aRouter.health();
    });

    // A2A system health (detailed with circuit breakers, rate limiters)
    app.get('/api/v1/a2a/health/detailed', async () => {
        return a2aRouter.getSystemHealth();
    });

    // A2A metrics (Prometheus format)
    app.get('/api/v1/a2a/metrics', async (request, reply) => {
        const metrics = a2aRouter.getMetrics();
        reply.type('text/plain');
        return metrics;
    });

    // A2A metrics (JSON format)
    app.get('/api/v1/a2a/metrics/json', async () => {
        return a2aRouter.getMetricsJSON();
    });
}
