/**
 * Evaluator API Routes
 *
 * Provides endpoints for:
 * - POST /api/v1/evaluations - Create evaluation task
 * - GET /api/v1/evaluations/:id - Get evaluation result
 * - POST /api/v1/evaluations/:id/judge - Submit manual judgment
 * - GET /api/v1/tasks/:id/evaluations - List task evaluations
 *
 * @module api/routes/evaluator
 */

import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import {
    EvaluatorRuntime,
    createDefaultJudgeRegistry,
    type EvaluationTask,
    type EvaluationType,
    type EvaluationResult,
} from '../../evaluator/index.js';
import { logger } from '../../utils/logger.js';
import { DaemonError } from '../../utils/errors.js';

// ============================================================================
// Types
// ============================================================================

interface CreateEvaluationBody {
    taskId: string;
    agentId: string;
    type: EvaluationType;
    submission: {
        type: 'git_repo' | 'zip_archive' | 'url' | 'inline';
        source: string;
        commitHash?: string;
        entryPoint?: string;
        metadata?: Record<string, unknown>;
    };
    criteria?: {
        minScore?: number;
        rubric?: {
            maxScore: number;
            categories: Array<{
                name: string;
                weight: number;
                description: string;
                criteria: string[];
            }>;
        };
        requiredChecks?: string[];
    };
    budget?: {
        maxCostUsd?: number;
        maxTimeSeconds?: number;
        maxMemoryMb?: number;
    };
}

interface ManualJudgeBody {
    score: number;
    feedback?: string;
    passed?: boolean;
}

interface EvalResult {
    id: string;
    taskId: string;
    agentId: string;
    type: EvaluationType;
    status: 'pending' | 'running' | 'completed' | 'failed';
    score?: number;
    passed?: boolean;
    reasoning?: string;
    result?: EvaluationResult;
    createdAt: number;
    completedAt?: number;
}

// ============================================================================
// Database Operations
// ============================================================================

function initEvaluationsTable(db: Database.Database): void {
    const schema = `
    CREATE TABLE IF NOT EXISTS evaluations (
      id            TEXT PRIMARY KEY,
      task_id       TEXT NOT NULL,
      agent_id      TEXT NOT NULL,
      type          TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      score         REAL,
      passed        INTEGER,
      reasoning     TEXT,
      result        TEXT,
      created_at    INTEGER NOT NULL,
      completed_at  INTEGER,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_evaluations_task_id ON evaluations(task_id);
    CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluations(status);
    CREATE INDEX IF NOT EXISTS idx_evaluations_created_at ON evaluations(created_at DESC);
  `;
    db.exec(schema);
}

function storeEvaluation(db: Database.Database, evalResult: EvalResult): void {
    const stmt = db.prepare(`
    INSERT INTO evaluations (id, task_id, agent_id, type, status, score, passed, reasoning, result, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      score = excluded.score,
      passed = excluded.passed,
      reasoning = excluded.reasoning,
      result = excluded.result,
      completed_at = excluded.completed_at
  `);

    stmt.run(
        evalResult.id,
        evalResult.taskId,
        evalResult.agentId,
        evalResult.type,
        evalResult.status,
        evalResult.score ?? null,
        evalResult.passed ? 1 : 0,
        evalResult.reasoning ?? null,
        evalResult.result ? JSON.stringify(evalResult.result) : null,
        evalResult.createdAt,
        evalResult.completedAt ?? null,
    );
}

function getEvaluation(db: Database.Database, id: string): EvalResult | null {
    const stmt = db.prepare('SELECT * FROM evaluations WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return rowToEvalResult(row);
}

function getTaskEvaluations(db: Database.Database, taskId: string): EvalResult[] {
    const stmt = db.prepare('SELECT * FROM evaluations WHERE task_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(taskId) as Record<string, unknown>[];
    return rows.map(rowToEvalResult);
}

function rowToEvalResult(row: Record<string, unknown>): EvalResult {
    return {
        id: row.id as string,
        taskId: row.task_id as string,
        agentId: row.agent_id as string,
        type: row.type as EvaluationType,
        status: row.status as EvalResult['status'],
        score: row.score as number | undefined,
        passed: row.passed === 1,
        reasoning: row.reasoning as string | undefined,
        result: row.result ? JSON.parse(row.result as string) : undefined,
        createdAt: row.created_at as number,
        completedAt: row.completed_at as number | undefined,
    };
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerEvaluatorRoutes(
    app: FastifyInstance,
    db: Database.Database,
    evaluatorRuntime?: EvaluatorRuntime,
): void {
    // Initialize database table
    initEvaluationsTable(db);

    // Initialize evaluator runtime if not provided
    const runtime =
        evaluatorRuntime ??
        new EvaluatorRuntime({
            defaultBudget: {
                maxCostUsd: 1.0,
                maxTimeSeconds: 300,
                maxMemoryMb: 512,
                contextWindowSize: 10,
            },
            sandbox: {
                type: 'git_worktree',
                resources: {
                    cpu: '1',
                    memory: '512m',
                    timeout: 300,
                },
                networkAccess: false,
            },
            scoringModel: {
                provider: 'openai',
                model: 'gpt-4',
                temperature: 0.3,
                maxTokens: 2048,
            },
            driftDetection: {
                enabled: true,
                threshold: 0.8,
                resetStrategy: 'sprint_boundary',
                checkpointIntervalMs: 60000,
            },
        });

    // POST /api/v1/evaluations - Create evaluation task
    app.post<{ Body: CreateEvaluationBody }>('/api/v1/evaluations', async (request, reply) => {
        try {
            const { taskId, agentId, type, submission, criteria, budget } = request.body;

            // Validate required fields
            if (!taskId || !agentId || !type || !submission) {
                reply.code(400).send({
                    error: 'INVALID_REQUEST',
                    message: 'Missing required fields: taskId, agentId, type, submission',
                });
                return;
            }

            // Check if task exists
            const taskStmt = db.prepare('SELECT id FROM tasks WHERE id = ?');
            const taskExists = taskStmt.get(taskId);
            if (!taskExists) {
                reply.code(404).send({
                    error: 'TASK_NOT_FOUND',
                    message: `Task ${taskId} not found`,
                });
                return;
            }

            // Generate evaluation ID
            const evaluationId = `eval-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

            // Create evaluation task
            const evalTask: EvaluationTask = {
                id: evaluationId,
                taskId,
                agentId,
                type,
                submission: {
                    type: submission.type,
                    source: submission.source,
                    commitHash: submission.commitHash,
                    entryPoint: submission.entryPoint,
                    metadata: submission.metadata || {},
                },
                criteria: {
                    minScore: criteria?.minScore ?? 70,
                    rubric: criteria?.rubric ?? {
                        maxScore: 100,
                        categories: [
                            {
                                name: 'Quality',
                                weight: 1.0,
                                description: 'Overall quality',
                                criteria: ['Functionality', 'Code quality'],
                            },
                        ],
                    },
                    requiredChecks: (criteria?.requiredChecks as EvaluationTask['criteria']['requiredChecks']) ?? [
                        'compiles',
                    ],
                },
                budget: {
                    maxCostUsd: budget?.maxCostUsd ?? 1.0,
                    maxTimeSeconds: budget?.maxTimeSeconds ?? 300,
                    maxMemoryMb: budget?.maxMemoryMb ?? 512,
                    contextWindowSize: 10,
                },
                createdAt: Date.now(),
                timeoutAt: Date.now() + (budget?.maxTimeSeconds ?? 300) * 1000,
            };

            // Store initial evaluation record
            const evalResult: EvalResult = {
                id: evaluationId,
                taskId,
                agentId,
                type,
                status: 'pending',
                createdAt: Date.now(),
            };
            storeEvaluation(db, evalResult);

            // Listen for evaluation completion
            runtime.once('completed', (result: EvaluationResult) => {
                if (result.evaluationId === evaluationId) {
                    // Update with results
                    const completedEval: EvalResult = {
                        ...evalResult,
                        status: 'completed',
                        score: result.score,
                        passed: result.passed,
                        result: result,
                        completedAt: Date.now(),
                    };
                    storeEvaluation(db, completedEval);
                    logger.info({ evaluationId, score: result.score, passed: result.passed }, 'Evaluation completed');
                }
            });

            runtime.once('error', ({ evaluationId: errEvalId, error }: { evaluationId: string; error: Error }) => {
                if (errEvalId === evaluationId) {
                    // Update with error
                    const failedEval: EvalResult = {
                        ...evalResult,
                        status: 'failed',
                        reasoning: error instanceof Error ? error.message : 'Unknown error',
                        completedAt: Date.now(),
                    };
                    storeEvaluation(db, failedEval);
                    logger.error({ error, evaluationId }, 'Evaluation failed');
                }
            });

            // Submit evaluation task
            runtime.submit(evalTask).catch((error) => {
                logger.error({ error, evaluationId }, 'Failed to submit evaluation');
            });

            reply.code(202).send({
                id: evaluationId,
                taskId,
                agentId,
                type,
                status: 'pending',
                message: 'Evaluation started',
            });
        } catch (err) {
            logger.error({ err }, 'Failed to create evaluation');
            if (err instanceof DaemonError) {
                reply.code(err.statusCode).send({ error: err.code, message: err.message });
                return;
            }
            throw err;
        }
    });

    // GET /api/v1/evaluations/:id - Get evaluation result
    app.get<{ Params: { id: string } }>('/api/v1/evaluations/:id', async (request, reply) => {
        try {
            const { id } = request.params;
            const evaluation = getEvaluation(db, id);

            if (!evaluation) {
                reply.code(404).send({
                    error: 'EVALUATION_NOT_FOUND',
                    message: `Evaluation ${id} not found`,
                });
                return;
            }

            return evaluation;
        } catch (err) {
            logger.error({ err, id: request.params.id }, 'Failed to get evaluation');
            throw err;
        }
    });

    // POST /api/v1/evaluations/:id/judge - Manual judgment submission
    app.post<{ Params: { id: string }; Body: ManualJudgeBody }>(
        '/api/v1/evaluations/:id/judge',
        async (request, reply) => {
            try {
                const { id } = request.params;
                const { score, feedback, passed } = request.body;

                if (score === undefined || score < 0 || score > 100) {
                    reply.code(400).send({
                        error: 'INVALID_SCORE',
                        message: 'Score must be between 0 and 100',
                    });
                    return;
                }

                const existing = getEvaluation(db, id);
                if (!existing) {
                    reply.code(404).send({
                        error: 'EVALUATION_NOT_FOUND',
                        message: `Evaluation ${id} not found`,
                    });
                    return;
                }

                // Update with manual judgment
                const updatedEval: EvalResult = {
                    ...existing,
                    status: 'completed',
                    score,
                    passed: passed ?? score >= 70,
                    reasoning: feedback,
                    completedAt: Date.now(),
                };
                storeEvaluation(db, updatedEval);

                logger.info({ evaluationId: id, score, passed: updatedEval.passed }, 'Manual judgment submitted');

                return updatedEval;
            } catch (err) {
                logger.error({ err, id: request.params.id }, 'Failed to submit judgment');
                throw err;
            }
        },
    );

    // GET /api/v1/tasks/:id/evaluations - List evaluations for a task
    app.get<{ Params: { id: string } }>('/api/v1/tasks/:id/evaluations', async (request, reply) => {
        try {
            const { id } = request.params;

            // Check if task exists
            const taskStmt = db.prepare('SELECT id FROM tasks WHERE id = ?');
            const taskExists = taskStmt.get(id);
            if (!taskExists) {
                reply.code(404).send({
                    error: 'TASK_NOT_FOUND',
                    message: `Task ${id} not found`,
                });
                return;
            }

            const evaluations = getTaskEvaluations(db, id);
            return { evaluations, total: evaluations.length };
        } catch (err) {
            logger.error({ err, taskId: request.params.id }, 'Failed to list evaluations');
            throw err;
        }
    });
}

// Export database helpers for use in other modules
export { getEvaluation, getTaskEvaluations, storeEvaluation, initEvaluationsTable };
