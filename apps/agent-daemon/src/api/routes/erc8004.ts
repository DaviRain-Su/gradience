/**
 * ERC-8004 API Routes
 *
 * GRA-226c: REST API for ERC-8004 operations
 *
 * Endpoints:
 * - POST /api/v1/erc8004/agents/register - Register agent
 * - GET /api/v1/erc8004/agents/:agentId - Get agent info
 * - POST /api/v1/erc8004/agents/:agentId/feedback - Submit feedback
 * - GET /api/v1/erc8004/agents/:agentId/reputation - Get reputation
 * - GET /api/v1/erc8004/health - Health check
 */

import type { FastifyInstance } from 'fastify';
import { createERC8004Client, type ERC8004Config } from '../../integrations/erc8004-client.js';
import { logger } from '../../utils/logger.js';

export function registerERC8004Routes(app: FastifyInstance, config: ERC8004Config): void {
    const client = createERC8004Client(config);

    // -------------------------------------------------------------------------
    // Agent Registration
    // -------------------------------------------------------------------------

    app.post<{
        Body: {
            agentURI: string;
            metadata?: Record<string, string>;
            owner?: string;
        };
    }>('/api/v1/erc8004/agents/register', async (request, reply) => {
        try {
            const { agentURI, metadata, owner } = request.body;

            if (!agentURI || typeof agentURI !== 'string') {
                return reply.code(400).send({ error: 'agentURI is required' });
            }

            const registration = await client.registerAgent(agentURI, metadata, owner);

            return {
                success: true,
                agentId: registration.agentId,
                agentURI: registration.agentURI,
                owner: registration.owner,
                txHash: registration.txHash,
                timestamp: registration.timestamp,
            };
        } catch (err: any) {
            logger.error({ err }, 'Failed to register agent on ERC-8004');
            return reply.code(500).send({ error: err.message });
        }
    });

    // -------------------------------------------------------------------------
    // Agent Info
    // -------------------------------------------------------------------------

    app.get<{
        Params: { agentId: string };
    }>('/api/v1/erc8004/agents/:agentId', async (request, reply) => {
        try {
            const { agentId } = request.params;

            const [owner, reputation, metadataKeys] = await Promise.all([
                client.getOwner(agentId),
                client.getReputation(agentId),
                client.getMetadataKeys(agentId),
            ]);

            if (!owner) {
                return reply.code(404).send({ error: 'Agent not found' });
            }

            // Fetch all metadata
            const metadata: Record<string, string> = {};
            for (const key of metadataKeys) {
                const value = await client.getMetadata(agentId, key);
                if (value) {
                    metadata[key] = value;
                }
            }

            return {
                agentId,
                owner,
                reputation,
                metadata,
            };
        } catch (err: any) {
            logger.error({ err, agentId: request.params.agentId }, 'Failed to get agent info');
            return reply.code(500).send({ error: err.message });
        }
    });

    // -------------------------------------------------------------------------
    // Update Metadata
    // -------------------------------------------------------------------------

    app.post<{
        Params: { agentId: string };
        Body: {
            metadata: Record<string, string>;
        };
    }>('/api/v1/erc8004/agents/:agentId/metadata', async (request, reply) => {
        try {
            const { agentId } = request.params;
            const { metadata } = request.body;

            if (!metadata || typeof metadata !== 'object') {
                return reply.code(400).send({ error: 'metadata is required' });
            }

            const result = await client.updateMetadata(agentId, metadata);

            return {
                success: true,
                agentId,
                txHash: result.txHash,
            };
        } catch (err: any) {
            logger.error({ err, agentId: request.params.agentId }, 'Failed to update metadata');
            return reply.code(500).send({ error: err.message });
        }
    });

    // -------------------------------------------------------------------------
    // Reputation Feedback
    // -------------------------------------------------------------------------

    app.post<{
        Params: { agentId: string };
        Body: {
            value: number;
            valueDecimals?: number;
            tags?: [string, string];
            endpoint?: string;
            feedbackURI?: string;
            feedbackHash?: string;
        };
    }>('/api/v1/erc8004/agents/:agentId/feedback', async (request, reply) => {
        try {
            const { agentId } = request.params;
            const {
                value,
                valueDecimals = 2,
                tags = ['', ''],
                endpoint = '',
                feedbackURI = '',
                feedbackHash = ethers.ZeroHash,
            } = request.body;

            if (typeof value !== 'number') {
                return reply.code(400).send({ error: 'value is required and must be a number' });
            }

            const result = await client.giveFeedback({
                agentId,
                value,
                valueDecimals,
                tags: [tags[0] || '', tags[1] || ''],
                endpoint,
                feedbackURI,
                feedbackHash,
            });

            return {
                success: true,
                agentId,
                txHash: result.txHash,
            };
        } catch (err: any) {
            logger.error({ err, agentId: request.params.agentId }, 'Failed to submit feedback');
            return reply.code(500).send({ error: err.message });
        }
    });

    // -------------------------------------------------------------------------
    // Get Reputation
    // -------------------------------------------------------------------------

    app.get<{
        Params: { agentId: string };
    }>('/api/v1/erc8004/agents/:agentId/reputation', async (request, reply) => {
        try {
            const { agentId } = request.params;

            const [reputation, feedbackCount] = await Promise.all([
                client.getReputation(agentId),
                client.getFeedbackCount(agentId),
            ]);

            if (!reputation) {
                return reply.code(404).send({ error: 'Reputation not found for agent' });
            }

            return {
                agentId,
                ...reputation,
                feedbackCount,
            };
        } catch (err: any) {
            logger.error({ err, agentId: request.params.agentId }, 'Failed to get reputation');
            return reply.code(500).send({ error: err.message });
        }
    });

    // -------------------------------------------------------------------------
    // Get Feedback Details
    // -------------------------------------------------------------------------

    app.get<{
        Params: { agentId: string };
        Querystring: {
            index?: number;
            latest?: boolean;
        };
    }>('/api/v1/erc8004/agents/:agentId/feedback', async (request, reply) => {
        try {
            const { agentId } = request.params;
            const { index, latest } = request.query;

            if (latest) {
                const feedback = await client.getLatestFeedback(agentId);
                if (!feedback) {
                    return reply.code(404).send({ error: 'No feedback found' });
                }
                return { agentId, feedback };
            }

            if (typeof index === 'number') {
                const feedback = await client.getFeedbackDetails(agentId, index);
                if (!feedback) {
                    return reply.code(404).send({ error: 'Feedback not found at index' });
                }
                return { agentId, index, feedback };
            }

            // Return count if no specific query
            const count = await client.getFeedbackCount(agentId);
            return { agentId, feedbackCount: count };
        } catch (err: any) {
            logger.error({ err, agentId: request.params.agentId }, 'Failed to get feedback');
            return reply.code(500).send({ error: err.message });
        }
    });

    // -------------------------------------------------------------------------
    // Lookup by URI
    // -------------------------------------------------------------------------

    app.get<{
        Querystring: {
            uri: string;
        };
    }>('/api/v1/erc8004/lookup', async (request, reply) => {
        try {
            const { uri } = request.query;

            if (!uri) {
                return reply.code(400).send({ error: 'uri query parameter is required' });
            }

            const agentId = await client.getAgentId(uri);

            if (!agentId) {
                return reply.code(404).send({ error: 'Agent not found for URI' });
            }

            const [owner, reputation] = await Promise.all([client.getOwner(agentId), client.getReputation(agentId)]);

            return {
                agentURI: uri,
                agentId,
                owner,
                reputation,
            };
        } catch (err: any) {
            logger.error({ err, uri: request.query.uri }, 'Failed to lookup agent');
            return reply.code(500).send({ error: err.message });
        }
    });

    // -------------------------------------------------------------------------
    // Health Check
    // -------------------------------------------------------------------------

    app.get('/api/v1/erc8004/health', async (_req, reply) => {
        try {
            const health = await client.healthCheck();
            return health;
        } catch (err: any) {
            logger.error({ err }, 'ERC-8004 health check failed');
            return reply.code(500).send({
                healthy: false,
                error: err.message,
            });
        }
    });

    // -------------------------------------------------------------------------
    // Cached Registrations
    // -------------------------------------------------------------------------

    app.get('/api/v1/erc8004/registrations', async (_req, reply) => {
        try {
            const registrations = await client.getCachedRegistrations();
            const result: Record<string, any> = {};

            for (const [uri, data] of registrations) {
                result[uri] = data;
            }

            return {
                count: registrations.size,
                registrations: result,
            };
        } catch (err: any) {
            logger.error({ err }, 'Failed to get cached registrations');
            return reply.code(500).send({ error: err.message });
        }
    });

    logger.info('ERC-8004 routes registered: /api/v1/erc8004/*');
}

// Need to import ethers for ZeroHash
import { ethers } from 'ethers';
