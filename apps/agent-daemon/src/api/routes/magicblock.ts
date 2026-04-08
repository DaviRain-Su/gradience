/**
 * MagicBlock Session API Routes — GRA-208
 *
 * Lightweight session management for ER/PER delegation.
 * MVP: in-memory session store. Future: integrate MagicBlockExecutionEngine.
 */

import type { FastifyInstance } from 'fastify';
import { logger } from '../../utils/logger.js';

interface SessionRecord {
  id: string;
  mode: 'l1' | 'er' | 'per';
  accounts: string[];
  state: 'initializing' | 'active' | 'committing' | 'closed';
  createdAt: number;
}

const sessions = new Map<string, SessionRecord>();

export function registerMagicBlockRoutes(app: FastifyInstance): void {
  // POST /api/v1/magicblock/session
  app.post<{
    Body: { mode: 'l1' | 'er' | 'per'; accounts?: string[] };
  }>('/api/v1/magicblock/session', async (request, reply) => {
    try {
      const { mode, accounts = [] } = request.body;
      if (!mode || !['l1', 'er', 'per'].includes(mode)) {
        return reply.code(400).send({ error: 'Invalid mode. Must be l1, er, or per.' });
      }

      const id = `${mode}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const record: SessionRecord = {
        id,
        mode,
        accounts,
        state: mode === 'l1' ? 'active' : 'initializing',
        createdAt: Date.now(),
      };
      sessions.set(id, record);

      // Simulate ER/PER delegation completion asynchronously
      if (mode !== 'l1') {
        setTimeout(() => {
          const s = sessions.get(id);
          if (s && s.state === 'initializing') {
            s.state = 'active';
            logger.info({ sessionId: id, mode }, 'MagicBlock session activated');
          }
        }, 600);
      }

      logger.info({ sessionId: id, mode, accountCount: accounts.length }, 'MagicBlock session created');
      return { id, mode, state: record.state, createdAt: record.createdAt };
    } catch (err: any) {
      logger.error({ err }, 'Failed to create MagicBlock session');
      return reply.code(500).send({ error: err.message || 'Session creation failed' });
    }
  });

  // GET /api/v1/magicblock/session/:id
  app.get<{
    Params: { id: string };
  }>('/api/v1/magicblock/session/:id', async (request, reply) => {
    try {
      const record = sessions.get(request.params.id);
      if (!record) {
        return reply.code(404).send({ error: 'Session not found' });
      }
      return {
        id: record.id,
        mode: record.mode,
        state: record.state,
        accounts: record.accounts,
        createdAt: record.createdAt,
      };
    } catch (err: any) {
      logger.error({ err }, 'Failed to get MagicBlock session');
      return reply.code(500).send({ error: err.message || 'Session lookup failed' });
    }
  });

  // DELETE /api/v1/magicblock/session/:id
  app.delete<{
    Params: { id: string };
  }>('/api/v1/magicblock/session/:id', async (request, reply) => {
    try {
      const existed = sessions.delete(request.params.id);
      if (!existed) {
        return reply.code(404).send({ error: 'Session not found' });
      }
      return { success: true };
    } catch (err: any) {
      logger.error({ err }, 'Failed to delete MagicBlock session');
      return reply.code(500).send({ error: err.message || 'Session deletion failed' });
    }
  });

  logger.info('MagicBlock API routes registered: /api/v1/magicblock/session/*');
}
