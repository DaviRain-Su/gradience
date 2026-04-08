/**
 * MagicBlock Session API Routes — GRA-208
 *
 * Lightweight session management for ER/PER delegation.
 * MVP: in-memory session store. Future: integrate MagicBlockExecutionEngine.
 */

import { PublicKey } from '@solana/web3.js';
import type { FastifyInstance } from 'fastify';
import type { BridgeManager } from '../../bridge/index.js';
import { VRFJudgeSelector } from '../../settlement/vrf-judge-selector.js';
import { logger } from '../../utils/logger.js';

interface SessionRecord {
  id: string;
  mode: 'l1' | 'er' | 'per';
  accounts: string[];
  state: 'initializing' | 'active' | 'committing' | 'closed';
  createdAt: number;
}

interface JudgePerBody {
  taskId: string;
  taskIdOnChain: string;
  agentId: string;
  amount: string;
  token: string;
  poster: string;
  score: number;
  reasonRef: string;
  losers?: Array<{ agent: string; account?: string }>;
}

const sessions = new Map<string, SessionRecord>();

export function registerMagicBlockRoutes(app: FastifyInstance, bridgeManager?: BridgeManager): void {
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

  // POST /api/v1/magicblock/judge-per
  // Settles a task via MagicBlock PER (TEE) pipeline.
  app.post<{
    Body: JudgePerBody;
  }>('/api/v1/magicblock/judge-per', async (request, reply) => {
    try {
      if (!bridgeManager || !bridgeManager.isEnabled()) {
        return reply.code(503).send({ error: 'Bridge not available' });
      }

      const body = request.body;
      const evalResult = {
        evaluationId: `per-${body.taskId}-${Date.now()}`,
        score: body.score,
        passed: body.score >= 60,
        categoryScores: [],
        checkResults: [],
        verificationHash: '',
        executionLog: { sandboxType: 'vm' as const, steps: [], stdout: '', stderr: '' },
        driftStatus: { driftDetected: false, contextWindowUsage: 0 },
        actualCost: { usd: 0, timeSeconds: 0, peakMemoryMb: 0 },
        completedAt: Date.now(),
      };

      const result = await bridgeManager.settleWithPER(evalResult, {
        taskId: body.taskId,
        taskIdOnChain: body.taskIdOnChain,
        agentId: body.agentId,
        amount: body.amount,
        token: body.token,
        poster: body.poster,
        score: body.score,
        reasonRef: body.reasonRef,
        losers: body.losers,
      });

      logger.info(
        { taskId: body.taskId, txSignature: result.txSignature, status: result.status },
        'PER judge settlement completed'
      );
      return result;
    } catch (err: any) {
      logger.error({ err }, 'PER judge settlement failed');
      return reply.code(500).send({ error: err.message || 'PER judge settlement failed' });
    }
  });

  // POST /api/v1/magicblock/request-vrf
  // Scaffold for GRA-207. Builds a RequestRandomness instruction manually
  // because @magicblock-labs/vrf-sdk does not exist on npm.
  app.post<{
    Body: { taskId: string; numericTaskId: string | number; payer: string };
  }>('/api/v1/magicblock/request-vrf', async (request, reply) => {
    try {
      const { taskId, numericTaskId, payer } = request.body;
      if (!taskId || numericTaskId === undefined || !payer) {
        return reply.code(400).send({ error: 'taskId, numericTaskId, and payer are required' });
      }

      const payerPubkey = new PublicKey(payer);
      const selector = new VRFJudgeSelector();
      const ix = selector.buildGradienceRequestRandomnessIx(
        taskId,
        Number(numericTaskId),
        payerPubkey,
      );

      logger.info({ taskId, numericTaskId, payer }, 'VRF randomness request instruction built');
      return {
        success: true,
        message: 'Instruction built. Caller must sign and submit to Solana.',
        programId: ix.programId.toBase58(),
        keys: ix.keys.map((k) => ({ pubkey: k.pubkey.toBase58(), isSigner: k.isSigner, isWritable: k.isWritable })),
        data: ix.data.toString('base64'),
      };
    } catch (err: any) {
      logger.error({ err }, 'VRF request instruction build failed');
      return reply.code(500).send({ error: err.message || 'VRF request failed' });
    }
  });

  logger.info('MagicBlock API routes registered: /api/v1/magicblock/session/*, /api/v1/magicblock/judge-per, /api/v1/magicblock/request-vrf');
}
