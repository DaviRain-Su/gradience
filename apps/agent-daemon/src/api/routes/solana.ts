import type { FastifyInstance } from 'fastify';
import type { TransactionManager, RuntimeEnv, PostTaskParams } from '../../solana/transaction-manager.js';
import { DaemonError } from '../../utils/errors.js';

export function registerSolanaRoutes(app: FastifyInstance, transactionManager: TransactionManager): void {
    /**
     * GET /api/v1/solana/balance
     * Get SOL balance of the agent wallet
     */
    app.get('/api/v1/solana/balance', async () => {
        const balance = await transactionManager.getBalance();
        return { balance, publicKey: transactionManager['publicKey'].toBase58() };
    });

    /**
     * POST /api/v1/solana/post-task
     * Create a new task on the Arena program
     */
    app.post<{
        Body: {
            evalRef: string;
            deadline: number;
            judgeDeadline: number;
            judgeMode: number;
            judge?: string;
            category: number;
            mint?: string;
            minStake: number;
            reward: number;
        };
    }>('/api/v1/solana/post-task', async (request, reply) => {
        try {
            const params: PostTaskParams = request.body;

            // Validate required fields
            if (!params.evalRef || params.evalRef.trim() === '') {
                reply.code(400).send({ error: 'INVALID_REQUEST', message: 'evalRef is required' });
                return;
            }
            if (typeof params.deadline !== 'number' || params.deadline <= 0) {
                reply.code(400).send({ error: 'INVALID_REQUEST', message: 'deadline must be a positive number' });
                return;
            }
            if (typeof params.judgeDeadline !== 'number' || params.judgeDeadline <= 0) {
                reply.code(400).send({ error: 'INVALID_REQUEST', message: 'judgeDeadline must be a positive number' });
                return;
            }
            if (typeof params.category !== 'number' || params.category < 0 || params.category > 7) {
                reply.code(400).send({ error: 'INVALID_REQUEST', message: 'category must be between 0 and 7' });
                return;
            }
            if (typeof params.minStake !== 'number' || params.minStake < 0) {
                reply.code(400).send({ error: 'INVALID_REQUEST', message: 'minStake must be a non-negative number' });
                return;
            }
            if (typeof params.reward !== 'number' || params.reward <= 0) {
                reply.code(400).send({ error: 'INVALID_REQUEST', message: 'reward must be a positive number' });
                return;
            }

            const signature = await transactionManager.postTask(params);
            reply.code(201).send({ signature, success: true });
        } catch (err) {
            if (err instanceof DaemonError) {
                reply.code(err.statusCode).send({ error: err.code, message: err.message });
                return;
            }
            throw err;
        }
    });

    /**
     * POST /api/v1/solana/apply-task
     * Apply for a task
     */
    app.post<{
        Body: {
            taskId: string;
        };
    }>('/api/v1/solana/apply-task', async (request, reply) => {
        try {
            const { taskId } = request.body;

            if (!taskId || taskId.trim() === '') {
                reply.code(400).send({ error: 'INVALID_REQUEST', message: 'taskId is required' });
                return;
            }

            // Validate taskId is a valid number
            if (isNaN(Number(taskId))) {
                reply.code(400).send({ error: 'INVALID_REQUEST', message: 'taskId must be a valid number' });
                return;
            }

            const signature = await transactionManager.applyForTask(taskId);
            reply.code(201).send({ signature, success: true });
        } catch (err) {
            if (err instanceof DaemonError) {
                reply.code(err.statusCode).send({ error: err.code, message: err.message });
                return;
            }
            throw err;
        }
    });

    /**
     * POST /api/v1/solana/submit-result
     * Submit work result for a task
     */
    app.post<{
        Body: {
            taskId: string;
            resultCid: string;
            traceCid?: string;
            runtimeEnv?: RuntimeEnv;
        };
    }>('/api/v1/solana/submit-result', async (request, reply) => {
        try {
            const { taskId, resultCid, traceCid, runtimeEnv } = request.body;

            if (!taskId || taskId.trim() === '') {
                reply.code(400).send({ error: 'INVALID_REQUEST', message: 'taskId is required' });
                return;
            }
            if (!resultCid || resultCid.trim() === '') {
                reply.code(400).send({ error: 'INVALID_REQUEST', message: 'resultCid is required' });
                return;
            }

            // Validate taskId is a valid number
            if (isNaN(Number(taskId))) {
                reply.code(400).send({ error: 'INVALID_REQUEST', message: 'taskId must be a valid number' });
                return;
            }

            const signature = await transactionManager.submitResult(taskId, resultCid, traceCid, runtimeEnv);
            reply.code(201).send({ signature, success: true });
        } catch (err) {
            if (err instanceof DaemonError) {
                reply.code(err.statusCode).send({ error: err.code, message: err.message });
                return;
            }
            throw err;
        }
    });
}
