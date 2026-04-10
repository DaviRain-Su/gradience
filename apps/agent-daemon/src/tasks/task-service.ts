/**
 * Task Service - Enhanced Task Lifecycle Management
 *
 * Provides task management with automatic evaluation triggering
 * and revenue sharing distribution on task completion.
 * Integrates with the evaluator system when autoJudge is enabled.
 *
 * @module tasks/task-service
 */

import type Database from 'better-sqlite3';
import { TaskQueue, type Task, type TaskState } from './task-queue.js';
import {
    EvaluatorRuntime,
    createLLMClientFromConfig,
    type EvaluationTask,
    type EvaluationType,
    type EvaluationResult,
} from '../evaluator/index.js';
import {
    getUnifiedLLMConfig,
    getEvaluatorLLMConfig,
    type DaemonConfig,
    type UnifiedLLMConfig,
    type LLMProvider,
} from '../config.js';
import { logger } from '../utils/logger.js';
import { RevenueSharingEngine, type TaskSettlementInfo } from '../revenue/revenue-engine.js';
import type { TaskMemoryService } from '../memory/task-memory.js';

// ============================================================================
// Types
// ============================================================================

export interface TaskServiceConfig {
    autoJudge: boolean;
    judgeProvider: LLMProvider;
    judgeModel: string;
    judgeConfidenceThreshold: number;
    // Unified LLM configuration
    llmConfig?: UnifiedLLMConfig;
    // Revenue sharing
    revenueSharingEnabled: boolean;
    revenueAutoSettle: boolean;
}

export interface TaskWithEval extends Task {
    evaluations?: Array<{
        id: string;
        status: string;
        score?: number;
        passed?: boolean;
    }>;
}

// ============================================================================
// Task Service
// ============================================================================

export class TaskService extends TaskQueue {
    private config: TaskServiceConfig;
    private evaluatorRuntime?: EvaluatorRuntime;
    private activeEvaluations: Map<string, string> = new Map(); // taskId -> evaluationId
    private revenueEngine?: RevenueSharingEngine;
    private memoryService?: TaskMemoryService;

    constructor(
        db: Database.Database,
        config: TaskServiceConfig = {
            autoJudge: true,
            judgeProvider: 'openai',
            judgeModel: 'gpt-4',
            judgeConfidenceThreshold: 0.7,
            revenueSharingEnabled: true,
            revenueAutoSettle: false,
        },
        memoryService?: TaskMemoryService,
    ) {
        super(db);
        this.config = config;
        this.memoryService = memoryService;

        // Initialize evaluator runtime if auto-judge is enabled
        if (config.autoJudge) {
            this.initEvaluatorRuntime();
        }

        // Initialize revenue sharing engine if enabled
        if (config.revenueSharingEnabled) {
            this.revenueEngine = new RevenueSharingEngine(db, {
                autoSettle: config.revenueAutoSettle,
            });
        }

        // Listen for evaluation events
        this.setupEvaluationListeners();
    }

    /**
     * Initialize the evaluator runtime with configured LLM
     * Uses unified LLM config if available, falls back to legacy config
     */
    private initEvaluatorRuntime(): void {
        try {
            // Use unified LLM config if available, otherwise create from legacy config
            const unifiedConfig = this.config.llmConfig;
            const llmClient = unifiedConfig ? createLLMClientFromConfig(unifiedConfig) : null;

            // Map provider to scoring model format
            const provider = unifiedConfig?.provider ?? this.config.judgeProvider;
            const model = unifiedConfig?.model ?? this.config.judgeModel;
            const scoringProvider = provider === 'claude' ? 'anthropic' : provider === 'moonshot' ? 'openai' : provider;

            this.evaluatorRuntime = new EvaluatorRuntime(
                {
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
                        provider: scoringProvider as 'openai' | 'anthropic' | 'local',
                        model: model,
                        temperature: unifiedConfig?.temperature ?? 0.3,
                        maxTokens: unifiedConfig?.maxTokens ?? 2048,
                    },
                    driftDetection: {
                        enabled: true,
                        threshold: 0.8,
                        resetStrategy: 'sprint_boundary',
                        checkpointIntervalMs: 60000,
                    },
                },
                this.memoryService,
            );

            logger.info({ provider, model, unified: !!unifiedConfig }, 'Evaluator runtime initialized');
        } catch (error) {
            logger.error({ error }, 'Failed to initialize evaluator runtime');
        }
    }

    /**
     * Setup listeners for evaluation events
     */
    private setupEvaluationListeners(): void {
        if (!this.evaluatorRuntime) return;

        this.evaluatorRuntime.on('completed', (result: EvaluationResult) => {
            logger.info(
                { evaluationId: result.evaluationId, score: result.score, passed: result.passed },
                'Evaluation completed - storing result',
            );
            this.storeEvaluationResult(result.evaluationId, result);
        });

        this.evaluatorRuntime.on('error', ({ evaluationId, error }: { evaluationId: string; error: Error }) => {
            logger.error({ evaluationId, error }, 'Evaluation failed');
        });
    }

    /**
     * Update task state with automatic evaluation trigger
     * and revenue distribution on completion
     */
    updateState(
        id: string,
        state: TaskState,
        extra?: { result?: unknown; error?: string; assignedAgent?: string; paymentInfo?: TaskSettlementInfo },
    ): void {
        // Call parent updateState
        super.updateState(id, state, extra);

        // Trigger evaluation when task is completed
        if (state === 'completed' && this.config.autoJudge && this.evaluatorRuntime) {
            const task = this.get(id);
            if (task && !this.activeEvaluations.has(id)) {
                this.triggerEvaluation(task);
            }
        }

        // Record revenue distribution when task is completed with payment info
        if (state === 'completed' && this.config.revenueSharingEnabled && this.revenueEngine) {
            if (extra?.paymentInfo) {
                this.recordRevenueDistribution(extra.paymentInfo);
            }
        }
    }

    /**
     * Record revenue distribution for a completed task
     */
    private recordRevenueDistribution(paymentInfo: TaskSettlementInfo): void {
        try {
            const { distributionId, calculation } = this.revenueEngine!.recordTaskDistribution(paymentInfo);
            logger.info(
                {
                    distributionId,
                    taskId: paymentInfo.taskId,
                    totalAmount: calculation.totalAmount.toString(),
                    agentAmount: calculation.agentAmount.toString(),
                },
                'Revenue distribution recorded for task',
            );
        } catch (error) {
            logger.error({ error, taskId: paymentInfo.taskId }, 'Failed to record revenue distribution');
        }
    }

    /**
     * Get revenue statistics
     */
    getRevenueStats() {
        if (!this.revenueEngine) {
            return null;
        }
        return this.revenueEngine.getStats();
    }

    /**
     * Get distribution by task ID
     */
    getRevenueDistributionByTask(taskId: string) {
        if (!this.revenueEngine) {
            return null;
        }
        return this.revenueEngine.getDistributionByTask(taskId);
    }

    /**
     * Trigger automatic evaluation for a completed task
     */
    private async triggerEvaluation(task: Task): Promise<void> {
        if (!this.evaluatorRuntime) return;

        try {
            const evaluationId = `eval-auto-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
            this.activeEvaluations.set(task.id, evaluationId);

            // Determine evaluation type from task type
            const evalType = this.inferEvaluationType(task.type);

            // Extract submission from task payload
            const payload = task.payload as Record<string, unknown>;
            const submission = this.extractSubmission(payload);

            if (!submission) {
                logger.warn({ taskId: task.id }, 'Cannot trigger evaluation: no submission found in task payload');
                return;
            }

            // Submit evaluation task to runtime
            const evalTask: Omit<EvaluationTask, 'id' | 'createdAt' | 'timeoutAt'> = {
                taskId: task.id,
                agentId: task.assignedAgent || 'unknown',
                type: evalType,
                submission,
                criteria: {
                    minScore: Math.round(this.config.judgeConfidenceThreshold * 100),
                    rubric: {
                        maxScore: 100,
                        categories: this.getDefaultCategories(evalType),
                    },
                    requiredChecks: ['compiles'],
                },
                budget: {
                    maxCostUsd: 1.0,
                    maxTimeSeconds: 300,
                    maxMemoryMb: 512,
                    contextWindowSize: 10,
                },
            };

            logger.info({ taskId: task.id, evaluationId, type: evalType }, 'Auto-triggering evaluation');

            // Submit evaluation
            await this.evaluatorRuntime.submit(evalTask);
        } catch (error) {
            logger.error({ error, taskId: task.id }, 'Auto-evaluation failed');
            this.activeEvaluations.delete(task.id);
        }
    }

    /**
     * Infer evaluation type from task type
     */
    private inferEvaluationType(taskType: string): EvaluationType {
        const typeMap: Record<string, EvaluationType> = {
            code: 'code',
            coding: 'code',
            development: 'code',
            ui: 'ui',
            frontend: 'ui',
            design: 'ui',
            api: 'api',
            backend: 'api',
            content: 'content',
            writing: 'content',
            review: 'content',
        };

        const normalizedType = taskType.toLowerCase();
        return typeMap[normalizedType] || 'content';
    }

    /**
     * Extract submission from task payload
     */
    private extractSubmission(payload: Record<string, unknown>): EvaluationTask['submission'] | null {
        // Check various payload formats
        if (payload.submission) {
            const sub = payload.submission as Record<string, unknown>;
            return {
                type: (sub.type as EvaluationTask['submission']['type']) || 'inline',
                source: (sub.source as string) || String(sub.content || sub.code || sub.url || ''),
                commitHash: sub.commitHash as string | undefined,
                entryPoint: sub.entryPoint as string | undefined,
                metadata: (sub.metadata as Record<string, unknown>) || {},
            };
        }

        // Try to infer from common fields
        if (payload.code || payload.content) {
            return {
                type: 'inline',
                source: String(payload.code || payload.content),
                metadata: {},
            };
        }

        if (payload.url || payload.source) {
            return {
                type: 'url',
                source: String(payload.url || payload.source),
                metadata: {},
            };
        }

        if (payload.repo || payload.repository) {
            return {
                type: 'git_repo',
                source: String(payload.repo || payload.repository),
                metadata: {},
            };
        }

        return null;
    }

    /**
     * Get default scoring categories for evaluation type
     */
    private getDefaultCategories(evalType: EvaluationType): Array<{
        name: string;
        weight: number;
        description: string;
        criteria: string[];
    }> {
        const categories: Record<
            EvaluationType,
            Array<{
                name: string;
                weight: number;
                description: string;
                criteria: string[];
            }>
        > = {
            code: [
                {
                    name: 'Functionality',
                    weight: 0.4,
                    description: 'Code works as expected',
                    criteria: ['Correctness', 'Test coverage'],
                },
                {
                    name: 'Quality',
                    weight: 0.3,
                    description: 'Code quality and style',
                    criteria: ['Readability', 'Maintainability'],
                },
                {
                    name: 'Security',
                    weight: 0.2,
                    description: 'Security best practices',
                    criteria: ['Input validation', 'Error handling'],
                },
                {
                    name: 'Documentation',
                    weight: 0.1,
                    description: 'Documentation quality',
                    criteria: ['Comments', 'README'],
                },
            ],
            ui: [
                {
                    name: 'Visual',
                    weight: 0.3,
                    description: 'Visual design quality',
                    criteria: ['Layout', 'Color scheme'],
                },
                {
                    name: 'Accessibility',
                    weight: 0.25,
                    description: 'Accessibility compliance',
                    criteria: ['WCAG', 'Keyboard navigation'],
                },
                { name: 'Responsive', weight: 0.25, description: 'Responsive design', criteria: ['Mobile', 'Tablet'] },
                {
                    name: 'Performance',
                    weight: 0.2,
                    description: 'UI performance',
                    criteria: ['Load time', 'Interactivity'],
                },
            ],
            api: [
                {
                    name: 'Correctness',
                    weight: 0.4,
                    description: 'API correctness',
                    criteria: ['Contract compliance', 'Status codes'],
                },
                {
                    name: 'Performance',
                    weight: 0.3,
                    description: 'API performance',
                    criteria: ['Latency', 'Throughput'],
                },
                {
                    name: 'Documentation',
                    weight: 0.2,
                    description: 'API documentation',
                    criteria: ['OpenAPI', 'Examples'],
                },
                { name: 'Security', weight: 0.1, description: 'API security', criteria: ['Auth', 'Rate limiting'] },
            ],
            content: [
                {
                    name: 'Accuracy',
                    weight: 0.3,
                    description: 'Content accuracy',
                    criteria: ['Factual correctness', 'Sources'],
                },
                { name: 'Clarity', weight: 0.25, description: 'Content clarity', criteria: ['Structure', 'Language'] },
                {
                    name: 'Completeness',
                    weight: 0.25,
                    description: 'Content completeness',
                    criteria: ['Coverage', 'Depth'],
                },
                {
                    name: 'Originality',
                    weight: 0.2,
                    description: 'Content originality',
                    criteria: ['Uniqueness', 'Insights'],
                },
            ],
            composite: [
                { name: 'Overall', weight: 1.0, description: 'Overall quality', criteria: ['Combined assessment'] },
            ],
        };

        return categories[evalType] || categories.content;
    }

    /**
     * Store evaluation result in database
     */
    private storeEvaluationResult(evaluationId: string, result: EvaluationResult): void {
        try {
            // Initialize evaluations table if not exists
            const createTableSQL = `
        CREATE TABLE IF NOT EXISTS evaluations (
          id            TEXT PRIMARY KEY,
          task_id       TEXT NOT NULL,
          agent_id      TEXT NOT NULL,
          type          TEXT NOT NULL,
          status        TEXT NOT NULL DEFAULT 'completed',
          score         REAL,
          passed        INTEGER,
          reasoning     TEXT,
          result        TEXT,
          created_at    INTEGER NOT NULL,
          completed_at  INTEGER
        )
      `;
            (this as unknown as { db: Database.Database }).db.exec(createTableSQL);

            const stmt = (this as unknown as { db: Database.Database }).db.prepare(`
        INSERT INTO evaluations (id, task_id, agent_id, type, status, score, passed, result, created_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          score = excluded.score,
          passed = excluded.passed,
          result = excluded.result,
          completed_at = excluded.completed_at
      `);

            stmt.run(
                evaluationId,
                result.evaluationId.split('-')[0] || 'unknown',
                'auto',
                'auto',
                'completed',
                result.score,
                result.passed ? 1 : 0,
                JSON.stringify(result),
                Date.now(),
                result.completedAt,
            );

            logger.info({ evaluationId, score: result.score }, 'Evaluation result stored');
        } catch (error) {
            logger.error({ error, evaluationId }, 'Failed to store evaluation result');
        }
    }

    /**
     * Get task with its evaluations
     */
    getTaskWithEvaluations(id: string): TaskWithEval | null {
        const task = this.get(id);
        if (!task) return null;

        try {
            const evalStmt = (this as unknown as { db: Database.Database }).db.prepare(
                'SELECT id, status, score, passed FROM evaluations WHERE task_id = ? ORDER BY created_at DESC',
            );
            const evaluations = evalStmt.all(id) as Array<{
                id: string;
                status: string;
                score: number;
                passed: number;
            }>;

            return {
                ...task,
                evaluations: evaluations.map((e) => ({
                    id: e.id,
                    status: e.status,
                    score: e.score,
                    passed: e.passed === 1,
                })),
            };
        } catch {
            return task;
        }
    }

    /**
     * Check if auto-judge is enabled
     */
    isAutoJudgeEnabled(): boolean {
        return this.config.autoJudge;
    }

    /**
     * Get active evaluations count
     */
    getActiveEvaluationsCount(): number {
        return this.activeEvaluations.size;
    }

    /**
     * Shutdown the task service
     */
    async shutdown(): Promise<void> {
        // Clear active evaluations map
        this.activeEvaluations.clear();
    }
}
