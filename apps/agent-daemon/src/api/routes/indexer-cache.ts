/**
 * Indexer API Routes
 * 
 * Provides cached read-only access to indexer data via local SQLite
 * Web clients query these routes instead of connecting directly to indexer
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IndexerSyncService } from '../../storage/indexer-sync.js';

export default async function indexerRoutes(
  fastify: FastifyInstance,
  opts: { syncService: IndexerSyncService }
) {
  const { syncService } = opts;

  // GET /api/v1/indexer/tasks - Get cached tasks
  fastify.get('/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { limit = '50' } = request.query as { limit?: string };
      const tasks = syncService.getCachedTasks(parseInt(limit));
      
      return {
        success: true,
        data: tasks,
        source: 'local_cache',
        cached: true,
      };
    } catch (err) {
      request.log.error(err);
      reply.status(500);
      return {
        success: false,
        error: 'Failed to fetch tasks from cache',
      };
    }
  });

  // GET /api/v1/indexer/agents - Get cached agents
  fastify.get('/agents', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { limit = '50' } = request.query as { limit?: string };
      const agents = syncService.getCachedAgents(parseInt(limit));
      
      return {
        success: true,
        data: agents,
        source: 'local_cache',
        cached: true,
      };
    } catch (err) {
      request.log.error(err);
      reply.status(500);
      return {
        success: false,
        error: 'Failed to fetch agents from cache',
      };
    }
  });

  // GET /api/v1/indexer/status - Get sync status
  fastify.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const status = syncService.getSyncStatus();
    
    return {
      success: true,
      data: {
        ...status,
        healthy: status.isRunning,
      },
    };
  });
}
