/**
 * Evaluator Runtime - Off-chain Task Evaluation
 *
 * Inspired by Anthropic's approach:
 * - Evaluator is independent from Generator (no shared state)
 * - Actual execution verification (Playwright, sandbox)
 * - Drift detection with context window management
 * - Cost control with budget and time limits
 *
 * @module evaluator/runtime
 */

import { EventEmitter } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { APIEndpoint } from './playwright-harness.js';
import { PlaywrightHarness } from './playwright-harness.js';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';
import { getLLMClient, isLLMAvailable } from './llm-client.js';

const execFileAsync = promisify(execFile);

// ============================================================================
// Types
// ============================================================================

export interface EvaluationTask {
    /** Unique evaluation ID */
    id: string;
    /** Associated task ID */
    taskId: string;
    /** Agent ID that submitted the work */
    agentId: string;
    /** Evaluation type */
    type: EvaluationType;
    /** Work to evaluate */
    submission: Submission;
    /** Evaluation criteria */
    criteria: EvaluationCriteria;
    /** Budget constraints */
    budget: EvaluationBudget;
    /** Created timestamp */
    createdAt: number;
    /** Timeout timestamp */
    timeoutAt: number;
    /** Optional metadata for composite evaluations */
    metadata?: Record<string, unknown>;
}

export type EvaluationType =
    | 'code' // Code execution + tests
    | 'ui' // UI/UX evaluation (Playwright)
    | 'api' // API endpoint testing
    | 'content' // Content quality (LLM-as-judge)
    | 'composite'; // Multiple evaluation types

export interface Submission {
    /** Submission type */
    type: 'git_repo' | 'zip_archive' | 'url' | 'inline';
    /** Source location */
    source: string;
    /** Commit hash (for git) */
    commitHash?: string;
    /** Entry point or main file */
    entryPoint?: string;
    /** Metadata */
    metadata: Record<string, unknown>;
}

export interface EvaluationCriteria {
    /** Required score threshold (0-100) */
    minScore: number;
    /** Scoring rubric */
    rubric: ScoringRubric;
    /** Required checks */
    requiredChecks: CheckType[];
    /** Optional checks */
    optionalChecks?: CheckType[];
    /** Custom validation rules */
    customRules?: CustomRule[];
}

export type CheckType =
    | 'compiles'
    | 'tests_pass'
    | 'lint_clean'
    | 'no_secrets'
    | 'performance_ok'
    | 'accessibility_ok'
    | 'responsive'
    | 'api_contract';

export interface CustomRule {
    name: string;
    command: string;
    expectedExitCode: number;
    weight: number;
}

export interface ScoringRubric {
    /** Maximum possible score */
    maxScore: number;
    /** Score categories */
    categories: ScoreCategory[];
}

export interface ScoreCategory {
    name: string;
    weight: number; // 0-1, sum should be 1
    description: string;
    criteria: string[];
}

export interface EvaluationBudget {
    /** Maximum cost in USD */
    maxCostUsd: number;
    /** Maximum time in seconds */
    maxTimeSeconds: number;
    /** Maximum memory in MB */
    maxMemoryMb: number;
    /** Context window size for drift detection */
    contextWindowSize: number;
}

export interface EvaluationResult {
    /** Evaluation ID */
    evaluationId: string;
    /** Overall score (0-100) */
    score: number;
    /** Whether evaluation passed threshold */
    passed: boolean;
    /** Detailed category scores */
    categoryScores: CategoryScore[];
    /** Check results */
    checkResults: CheckResult[];
    /** Verification proof (hash) */
    verificationHash: string;
    /** Execution log */
    executionLog: ExecutionLog;
    /** Drift detection result */
    driftStatus: DriftStatus;
    /** Actual cost */
    actualCost: ActualCost;
    /** Timestamp */
    completedAt: number;
}

export interface CategoryScore {
    name: string;
    score: number;
    maxScore: number;
    weight: number;
    feedback: string[];
}

export interface CheckResult {
    type: CheckType;
    passed: boolean;
    score: number;
    details: string;
    durationMs: number;
}

export interface ExecutionLog {
    /** Sandbox environment used */
    sandboxType: 'docker' | 'git_worktree' | 'vm';
    /** Execution steps */
    steps: ExecutionStep[];
    /** Stdout capture */
    stdout: string;
    /** Stderr capture */
    stderr: string;
}

export interface ExecutionStep {
    name: string;
    command: string;
    exitCode: number;
    durationMs: number;
    timestamp: number;
}

export interface DriftStatus {
    /** Whether drift was detected */
    driftDetected: boolean;
    /** Context window usage (0-1) */
    contextWindowUsage: number;
    /** Reset strategy applied */
    resetStrategy?: 'sprint_boundary' | 'checkpoint' | 'none';
    /** Drift details */
    details?: string;
}

export interface ActualCost {
    /** Actual cost in USD */
    usd: number;
    /** Actual time in seconds */
    timeSeconds: number;
    /** Peak memory in MB */
    peakMemoryMb: number;
}

export interface EvaluatorConfig {
    /** Default evaluation budget */
    defaultBudget: EvaluationBudget;
    /** Sandbox configuration */
    sandbox: SandboxConfig;
    /** Scoring model configuration */
    scoringModel: ScoringModelConfig;
    /** Drift detection configuration */
    driftDetection: DriftDetectionConfig;
}

export interface SandboxConfig {
    /** Sandbox type */
    type: 'docker' | 'git_worktree';
    /** Docker image (if using docker) */
    dockerImage?: string;
    /** Resource limits */
    resources: {
        cpu: string;
        memory: string;
        timeout: number;
    };
    /** Network access */
    networkAccess: boolean;
    /** Volume mounts */
    volumes?: string[];
}

export interface ScoringModelConfig {
    /** Model provider */
    provider: 'anthropic' | 'openai' | 'local';
    /** Model name */
    model: string;
    /** Temperature for scoring */
    temperature: number;
    /** Max tokens for feedback */
    maxTokens: number;
}

export interface DriftDetectionConfig {
    /** Enable drift detection */
    enabled: boolean;
    /** Context window threshold (0-1) */
    threshold: number;
    /** Reset strategy */
    resetStrategy: 'sprint_boundary' | 'checkpoint' | 'none';
    /** Checkpoint interval (ms) */
    checkpointIntervalMs: number;
}

// ============================================================================
// Evaluator Runtime
// ============================================================================

export class EvaluatorRuntime extends EventEmitter {
    private activeEvaluations: Map<string, EvaluationTask> = new Map();
    private activeSandboxes: Map<string, Sandbox> = new Map();
    private config: EvaluatorConfig;
    private memoryService?: import('../memory/task-memory.js').TaskMemoryService;

    constructor(
        config: Partial<EvaluatorConfig> = {},
        memoryService?: import('../memory/task-memory.js').TaskMemoryService,
    ) {
        super();
        this.memoryService = memoryService;
        this.config = {
            defaultBudget: {
                maxCostUsd: 10,
                maxTimeSeconds: 300,
                maxMemoryMb: 2048,
                contextWindowSize: 128000,
            },
            sandbox: {
                type: 'docker',
                dockerImage: 'gradience/evaluator:latest',
                resources: {
                    cpu: '2',
                    memory: '4g',
                    timeout: 300,
                },
                networkAccess: false,
            },
            scoringModel: {
                provider: 'anthropic',
                model: 'claude-opus-4',
                temperature: 0.1,
                maxTokens: 4096,
            },
            driftDetection: {
                enabled: true,
                threshold: 0.8,
                resetStrategy: 'sprint_boundary',
                checkpointIntervalMs: 60000,
            },
            ...config,
        };
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Submit a task for evaluation
     */
    async submit(task: Omit<EvaluationTask, 'id' | 'createdAt' | 'timeoutAt'>): Promise<string> {
        const id = crypto.randomUUID();
        const now = Date.now();

        const fullTask: EvaluationTask = {
            ...task,
            id,
            createdAt: now,
            timeoutAt: now + task.budget.maxTimeSeconds * 1000,
        };

        // Validate task
        this.validateTask(fullTask);

        // Store task
        this.activeEvaluations.set(id, fullTask);

        logger.info({ evaluationId: id, taskId: task.taskId, type: task.type }, 'Evaluation task submitted');

        // Emit event
        this.emit('submitted', fullTask);

        // Start evaluation asynchronously
        this.runEvaluation(fullTask).catch((error) => {
            logger.error({ error, evaluationId: id }, 'Evaluation failed');
            this.activeEvaluations.delete(id);
            this.emit('error', { evaluationId: id, error });
        });

        return id;
    }

    /**
     * Get evaluation status
     */
    getStatus(evaluationId: string): EvaluationTask | undefined {
        return this.activeEvaluations.get(evaluationId);
    }

    /**
     * Cancel an evaluation
     */
    async cancel(evaluationId: string): Promise<boolean> {
        const task = this.activeEvaluations.get(evaluationId);
        if (!task) return false;

        const sandbox = this.activeSandboxes.get(evaluationId);
        if (sandbox) {
            try {
                await sandbox.destroy();
                this.activeSandboxes.delete(evaluationId);
            } catch (err) {
                logger.warn({ evaluationId, err }, 'Failed to destroy sandbox during cancel');
            }
        }
        this.activeEvaluations.delete(evaluationId);

        logger.info({ evaluationId }, 'Evaluation cancelled');
        this.emit('cancelled', { evaluationId });

        return true;
    }

    /**
     * Get runtime configuration
     */
    getConfig(): EvaluatorConfig {
        return { ...this.config };
    }

    // -------------------------------------------------------------------------
    // Evaluation Execution
    // -------------------------------------------------------------------------

    private async runEvaluation(task: EvaluationTask): Promise<EvaluationResult> {
        const startTime = Date.now();
        let sandbox: Sandbox | null = null;

        try {
            // Emit started event
            this.emit('started', { evaluationId: task.id, taskId: task.taskId });

            // Create sandbox
            sandbox = await this.createSandbox(task);
            this.activeSandboxes.set(task.id, sandbox);

            // Guard against cancellation before evaluation begins
            if (!this.activeEvaluations.has(task.id)) {
                throw new DaemonError(ErrorCodes.INVALID_REQUEST, 'Evaluation was cancelled');
            }

            // Run evaluation based on type
            let result: Partial<EvaluationResult>;

            switch (task.type) {
                case 'code':
                    result = await this.evaluateCode(task, sandbox);
                    break;
                case 'ui':
                    result = await this.evaluateUI(task, sandbox);
                    break;
                case 'api':
                    result = await this.evaluateAPI(task, sandbox);
                    break;
                case 'content':
                    result = await this.evaluateContent(task, sandbox);
                    break;
                case 'composite':
                    result = await this.evaluateComposite(task, sandbox);
                    break;
                default:
                    throw new DaemonError(ErrorCodes.INVALID_REQUEST, `Unknown evaluation type: ${task.type}`);
            }

            // Calculate final score
            const score = this.calculateFinalScore(result.categoryScores || []);
            const passed = score >= task.criteria.minScore;

            // Generate verification hash
            const verificationHash = this.generateVerificationHash(task, result);

            // Check drift
            const driftStatus = this.checkDrift(task, startTime);

            // Calculate actual cost
            const actualCost: ActualCost = {
                usd: this.estimateCost(startTime),
                timeSeconds: (Date.now() - startTime) / 1000,
                peakMemoryMb: 0, // Would be measured from sandbox
            };

            const finalResult: EvaluationResult = {
                evaluationId: task.id,
                score,
                passed,
                categoryScores: result.categoryScores || [],
                checkResults: result.checkResults || [],
                verificationHash,
                executionLog: result.executionLog || {
                    sandboxType: this.config.sandbox.type,
                    steps: [],
                    stdout: '',
                    stderr: '',
                },
                driftStatus,
                actualCost,
                completedAt: Date.now(),
            };

            // Cleanup
            await this.destroySandbox(sandbox, task.id);
            this.activeEvaluations.delete(task.id);

            // Emit completion
            this.emit('completed', finalResult);

            logger.info(
                {
                    evaluationId: task.id,
                    score,
                    passed,
                    durationMs: Date.now() - startTime,
                },
                'Evaluation completed',
            );

            return finalResult;
        } catch (error) {
            // Cleanup on error
            if (sandbox) await this.destroySandbox(sandbox, task.id);
            this.activeEvaluations.delete(task.id);

            throw error;
        }
    }

    // -------------------------------------------------------------------------
    // Evaluation Types
    // -------------------------------------------------------------------------

    private async evaluateCode(task: EvaluationTask, sandbox: Sandbox): Promise<Partial<EvaluationResult>> {
        const steps: ExecutionStep[] = [];
        const checkResults: CheckResult[] = [];

        // Step 1: Checkout/Extract submission
        steps.push(await sandbox.execute('checkout', 'Extracting submission...'));

        // Step 2: Install dependencies
        steps.push(await sandbox.execute('install', 'npm install'));

        // Step 3: Compile/Build
        const compileStep = await sandbox.execute('compile', 'npm run build');
        steps.push(compileStep);
        checkResults.push({
            type: 'compiles',
            passed: compileStep.exitCode === 0,
            score: compileStep.exitCode === 0 ? 100 : 0,
            details: compileStep.exitCode === 0 ? 'Build successful' : 'Build failed',
            durationMs: compileStep.durationMs,
        });

        // Step 4: Run tests
        const testStep = await sandbox.execute('test', 'npm test');
        steps.push(testStep);
        const testScore = testStep.exitCode === 0 ? 100 : 0;
        checkResults.push({
            type: 'tests_pass',
            passed: testStep.exitCode === 0,
            score: testScore,
            details: `Tests ${testStep.exitCode === 0 ? 'passed' : 'failed'}`,
            durationMs: testStep.durationMs,
        });

        // Step 5: Lint
        const lintStep = await sandbox.execute('lint', 'npm run lint');
        steps.push(lintStep);
        checkResults.push({
            type: 'lint_clean',
            passed: lintStep.exitCode === 0,
            score: lintStep.exitCode === 0 ? 100 : 50,
            details: `Lint ${lintStep.exitCode === 0 ? 'clean' : 'has warnings'}`,
            durationMs: lintStep.durationMs,
        });

        // Calculate category scores
        const categoryScores: CategoryScore[] = [
            {
                name: 'Functionality',
                score: testScore,
                maxScore: 100,
                weight: 0.5,
                feedback: testStep.exitCode === 0 ? ['All tests pass'] : ['Tests failed'],
            },
            {
                name: 'Code Quality',
                score: lintStep.exitCode === 0 ? 100 : 70,
                maxScore: 100,
                weight: 0.3,
                feedback: lintStep.exitCode === 0 ? ['Code is clean'] : ['Lint warnings present'],
            },
            {
                name: 'Build',
                score: compileStep.exitCode === 0 ? 100 : 0,
                maxScore: 100,
                weight: 0.2,
                feedback: compileStep.exitCode === 0 ? ['Builds successfully'] : ['Build failed'],
            },
        ];

        return {
            categoryScores,
            checkResults,
            executionLog: {
                sandboxType: this.config.sandbox.type,
                steps,
                stdout: '',
                stderr: '',
            },
        };
    }

    // -------------------------------------------------------------------------
    // Evaluation Types
    // -------------------------------------------------------------------------

    private async evaluateUI(task: EvaluationTask, sandbox: Sandbox): Promise<Partial<EvaluationResult>> {
        const harness = new PlaywrightHarness({
            maxBrowsers: 2,
            browserType: 'chromium',
            headless: true,
        });

        try {
            // Extract submission to sandbox
            await sandbox.execute('checkout', 'Extracting submission...');

            // Start the application
            const startStep = await sandbox.execute('start', 'npm run dev &');

            // Wait for server to be ready
            await new Promise((resolve) => setTimeout(resolve, 5000));

            // Run UI verification
            const uiResult = await harness.verifyUI({
                url: 'http://localhost:3000',
                viewport: { width: 1280, height: 720 },
                interactions: [
                    { type: 'wait', duration: 1000 },
                    { type: 'click', target: 'body' },
                ],
                accessibilityCheck: true,
                responsiveBreakpoints: [375, 768, 1024, 1440],
            });

            // Convert to EvaluationResult format
            const categoryScores: CategoryScore[] = uiResult.details.map((detail) => ({
                name: detail.name,
                score: detail.score,
                maxScore: 100,
                weight: 1 / uiResult.details.length,
                feedback: [detail.message],
            }));

            const checkResults: CheckResult[] = uiResult.details.map((detail) => ({
                type: detail.name.includes('accessibility')
                    ? 'accessibility_ok'
                    : detail.name.includes('responsive')
                      ? 'responsive'
                      : 'compiles',
                passed: detail.passed,
                score: detail.score,
                details: detail.message,
                durationMs: uiResult.durationMs / uiResult.details.length,
            }));

            return {
                categoryScores,
                checkResults,
                executionLog: {
                    sandboxType: this.config.sandbox.type,
                    steps: [
                        {
                            name: 'ui-verification',
                            command: 'playwright-harness',
                            exitCode: uiResult.passed ? 0 : 1,
                            durationMs: uiResult.durationMs,
                            timestamp: Date.now(),
                        },
                    ],
                    stdout: JSON.stringify(uiResult.details, null, 2),
                    stderr: '',
                },
            };
        } finally {
            if (typeof harness.shutdown === 'function') {
                await harness.shutdown();
            }
        }
    }

    private async evaluateAPI(task: EvaluationTask, sandbox: Sandbox): Promise<Partial<EvaluationResult>> {
        const harness = new PlaywrightHarness();

        try {
            // Extract API definition from task
            const apiEndpoints = (task.submission.metadata?.endpoints as APIEndpoint[]) || [];

            const apiResult = await harness.verifyAPI({
                baseUrl: task.submission.source,
                endpoints: apiEndpoints,
            });

            const categoryScores: CategoryScore[] = apiResult.details.map((detail) => ({
                name: detail.name,
                score: detail.score,
                maxScore: 100,
                weight: 1 / apiResult.details.length,
                feedback: [detail.message],
            }));

            const checkResults: CheckResult[] = apiResult.details.map((detail) => ({
                type: 'api_contract',
                passed: detail.passed,
                score: detail.score,
                details: detail.message,
                durationMs: apiResult.durationMs / apiResult.details.length,
            }));

            return {
                categoryScores,
                checkResults,
                executionLog: {
                    sandboxType: this.config.sandbox.type,
                    steps: [
                        {
                            name: 'api-verification',
                            command: 'playwright-harness-api',
                            exitCode: apiResult.passed ? 0 : 1,
                            durationMs: apiResult.durationMs,
                            timestamp: Date.now(),
                        },
                    ],
                    stdout: JSON.stringify(apiResult.details, null, 2),
                    stderr: '',
                },
            };
        } finally {
            if (typeof harness.shutdown === 'function') {
                await harness.shutdown();
            }
        }
    }

    private async evaluateContent(task: EvaluationTask, _sandbox: Sandbox): Promise<Partial<EvaluationResult>> {
        if (!isLLMAvailable()) {
            logger.warn({ evaluationId: task.id }, 'LLM not available for content evaluation');
            return {
                categoryScores: [],
                checkResults: [
                    {
                        type: 'compiles' as CheckType,
                        passed: false,
                        score: 0,
                        details: 'LLM client not configured',
                        durationMs: 0,
                    },
                ],
                executionLog: {
                    sandboxType: this.config.sandbox.type,
                    steps: [
                        { name: 'llm_check', command: 'llm_check', exitCode: 1, durationMs: 0, timestamp: Date.now() },
                    ],
                    stdout: '',
                    stderr: 'LLM not available',
                },
            };
        }

        const llmClient = getLLMClient()!;
        const submissionContent = typeof task.submission.source === 'string' ? task.submission.source : '';
        const baseRequirements =
            task.criteria.rubric?.categories?.map((r) => r.name).join(', ') || task.criteria.requiredChecks.join(', ');
        const memoryContext = this.memoryService?.formatForPrompt(task.taskId) ?? '';
        const requirements = memoryContext ? `${memoryContext}\n\n${baseRequirements}` : baseRequirements;

        logger.info({ evaluationId: task.id, hasMemory: !!memoryContext }, 'Running LLM content evaluation');

        const startTime = Date.now();
        const scores = await llmClient.evaluateContent(submissionContent, requirements);
        const durationMs = Date.now() - startTime;

        const categoryScores = (scores.scores || []).map((s) => ({
            name: s.category,
            score: Math.max(0, Math.min(100, s.score)),
            maxScore: 100,
            weight: 1,
            feedback: [s.feedback],
        }));

        const overallScore = Math.max(0, Math.min(100, scores.overallScore));
        const passed = overallScore >= task.criteria.minScore;

        return {
            score: overallScore,
            passed,
            categoryScores,
            checkResults: [
                {
                    type: 'compiles' as CheckType,
                    passed: true,
                    score: 100,
                    details: 'LLM evaluation completed',
                    durationMs,
                },
                {
                    type: 'tests_pass' as CheckType,
                    passed,
                    score: passed ? 100 : 0,
                    details: `Score ${overallScore} vs threshold ${task.criteria.minScore}`,
                    durationMs,
                },
            ],
            executionLog: {
                sandboxType: this.config.sandbox.type,
                steps: [
                    { name: 'llm_evaluation', command: 'llm_evaluate', exitCode: 0, durationMs, timestamp: Date.now() },
                ],
                stdout: scores.summary || '',
                stderr: '',
            },
        };
    }

    private async evaluateComposite(task: EvaluationTask, sandbox: Sandbox): Promise<Partial<EvaluationResult>> {
        logger.info({ evaluationId: task.id }, 'Running composite evaluation');

        const types = task.metadata?.compositeTypes as Array<EvaluationType> | undefined;
        const evaluations: Partial<EvaluationResult>[] = [];
        const steps: ExecutionStep[] = [];

        const typesToRun = types?.length ? types : (['code', 'content'] as EvaluationType[]);

        for (const evalType of typesToRun) {
            const stepStart = Date.now();
            let result: Partial<EvaluationResult>;

            switch (evalType) {
                case 'code':
                    result = await this.evaluateCode(task, sandbox);
                    break;
                case 'ui':
                    result = await this.evaluateUI(task, sandbox);
                    break;
                case 'api':
                    result = await this.evaluateAPI(task, sandbox);
                    break;
                case 'content':
                    result = await this.evaluateContent(task, sandbox);
                    break;
                default:
                    result = {
                        categoryScores: [{ name: String(evalType), score: 0, maxScore: 100, weight: 1, feedback: [] }],
                        checkResults: [
                            {
                                type: 'compiles' as CheckType,
                                passed: false,
                                score: 0,
                                details: `Unsupported composite type: ${evalType}`,
                                durationMs: 0,
                            },
                        ],
                    };
            }

            evaluations.push(result);
            steps.push({
                name: `composite_${evalType}`,
                command: `evaluate_${evalType}`,
                exitCode: 0,
                durationMs: Date.now() - stepStart,
                timestamp: Date.now(),
            });
        }

        // Aggregate scores
        const allCategoryScores = evaluations.flatMap((e) => e.categoryScores || []);
        const allCheckResults = evaluations.flatMap((e) => e.checkResults || []);
        const overallScores = evaluations.map((e) => e.score ?? 0).filter((s) => s > 0);
        const aggregatedOverall = overallScores.length
            ? Math.round(overallScores.reduce((a, b) => a + b, 0) / overallScores.length)
            : 0;
        const passed = aggregatedOverall >= task.criteria.minScore && allCheckResults.every((c) => c.passed);

        return {
            score: aggregatedOverall,
            passed,
            categoryScores: allCategoryScores,
            checkResults: allCheckResults,
            executionLog: {
                sandboxType: this.config.sandbox.type,
                steps,
                stdout: evaluations.map((e) => e.executionLog?.stdout || '').join('\n'),
                stderr: evaluations.map((e) => e.executionLog?.stderr || '').join('\n'),
            },
        };
    }

    // -------------------------------------------------------------------------
    // Sandbox Management
    // -------------------------------------------------------------------------

    private async createSandbox(task: EvaluationTask): Promise<Sandbox> {
        logger.info({ evaluationId: task.id, type: this.config.sandbox.type }, 'Creating sandbox');

        if (this.config.sandbox.type === 'docker') {
            return new DockerSandbox(task, this.config.sandbox);
        }

        return new MockSandbox(task, this.config.sandbox);
    }

    private async destroySandbox(sandbox: Sandbox, taskId?: string): Promise<void> {
        await sandbox.destroy();
        if (taskId) {
            this.activeSandboxes.delete(taskId);
        }
        logger.info({ sandboxId: sandbox.id }, 'Sandbox destroyed');
    }

    // -------------------------------------------------------------------------
    // Scoring
    // -------------------------------------------------------------------------

    private calculateFinalScore(categoryScores: CategoryScore[]): number {
        if (categoryScores.length === 0) return 0;

        const weightedSum = categoryScores.reduce((sum, cat) => sum + (cat.score / cat.maxScore) * cat.weight * 100, 0);

        const totalWeight = categoryScores.reduce((sum, cat) => sum + cat.weight, 0);

        return Math.round(weightedSum / totalWeight);
    }

    // -------------------------------------------------------------------------
    // Drift Detection
    // -------------------------------------------------------------------------

    private checkDrift(task: EvaluationTask, startTime: number): DriftStatus {
        if (!this.config.driftDetection.enabled) {
            return {
                driftDetected: false,
                contextWindowUsage: 0,
            };
        }

        const elapsed = Date.now() - startTime;
        const budget = task.budget.maxTimeSeconds * 1000;
        const usage = elapsed / budget;

        const driftDetected = usage > this.config.driftDetection.threshold;

        return {
            driftDetected,
            contextWindowUsage: usage,
            resetStrategy: driftDetected ? this.config.driftDetection.resetStrategy : undefined,
            details: driftDetected ? `Context window usage ${(usage * 100).toFixed(1)}% exceeds threshold` : undefined,
        };
    }

    // -------------------------------------------------------------------------
    // Utilities
    // -------------------------------------------------------------------------

    private validateTask(task: EvaluationTask): void {
        if (!task.taskId) {
            throw new DaemonError(ErrorCodes.INVALID_REQUEST, 'Task ID is required');
        }
        if (!task.agentId) {
            throw new DaemonError(ErrorCodes.INVALID_REQUEST, 'Agent ID is required');
        }
        if (task.criteria.minScore < 0 || task.criteria.minScore > 100) {
            throw new DaemonError(ErrorCodes.INVALID_REQUEST, 'Min score must be 0-100');
        }
    }

    private generateVerificationHash(task: EvaluationTask, result: Partial<EvaluationResult>): string {
        // Simple hash for demo - in production use proper cryptographic hash
        const data = `${task.id}:${task.taskId}:${result.score}:${Date.now()}`;
        return Buffer.from(data).toString('base64url');
    }

    private estimateCost(startTime: number): number {
        // Simple estimation - in production track actual API costs
        const elapsedMinutes = (Date.now() - startTime) / 60000;
        return elapsedMinutes * 0.05; // $0.05 per minute
    }
}

// ============================================================================
// Sandbox Interface
// ============================================================================

interface Sandbox {
    id: string;
    execute(name: string, command: string): Promise<ExecutionStep>;
    destroy(): Promise<void>;
}

class DockerSandbox implements Sandbox {
    id: string;
    private tmpDir: string;

    constructor(
        private task: EvaluationTask,
        private config: SandboxConfig,
    ) {
        this.id = `docker-${task.id}`;
        this.tmpDir = mkdtempSync(join(tmpdir(), `eval-${task.id}-`));
        if (task.submission.type === 'inline' && typeof task.submission.source === 'string') {
            writeFileSync(join(this.tmpDir, 'submission.txt'), task.submission.source);
        }
    }

    async execute(name: string, command: string): Promise<ExecutionStep> {
        const startTime = Date.now();
        logger.info({ sandboxId: this.id, name, command }, 'Executing in Docker sandbox');

        const image = this.config.dockerImage || 'node:20-alpine';
        const containerName = `eval-${this.task.id}`;
        const args = [
            'run',
            '--rm',
            '--name',
            containerName,
            '--network',
            this.config.networkAccess ? 'host' : 'none',
            '-v',
            `${this.tmpDir}:/workspace:rw`,
            '-w',
            '/workspace',
            '-m',
            this.config.resources.memory || '512m',
            '--cpus',
            this.config.resources.cpu || '1',
            image,
            'sh',
            '-c',
            command,
        ];

        try {
            await execFileAsync('docker', args, {
                timeout: this.config.resources.timeout || 300_000,
                killSignal: 'SIGKILL',
            });
            return {
                name,
                command,
                exitCode: 0,
                durationMs: Date.now() - startTime,
                timestamp: Date.now(),
            };
        } catch (error: any) {
            return {
                name,
                command,
                exitCode: error.code || 1,
                durationMs: Date.now() - startTime,
                timestamp: Date.now(),
            };
        }
    }

    async destroy(): Promise<void> {
        const containerName = `eval-${this.task.id}`;
        try {
            await execFileAsync('docker', ['kill', containerName]).catch(() => {});
            await execFileAsync('docker', ['rm', '-f', containerName]).catch(() => {});
        } catch {}
        try {
            rmSync(this.tmpDir, { recursive: true, force: true });
        } catch (err) {
            logger.warn({ sandboxId: this.id, err }, 'Failed to clean up Docker sandbox temp dir');
        }
        logger.info({ sandboxId: this.id }, 'Docker sandbox destroyed');
    }
}

class MockSandbox implements Sandbox {
    id: string;
    private destroyed = false;

    constructor(
        private task: EvaluationTask,
        private config: SandboxConfig,
    ) {
        this.id = `sandbox-${task.id}`;
    }

    async execute(name: string, command: string): Promise<ExecutionStep> {
        if (this.destroyed) {
            throw new Error('Sandbox has been destroyed');
        }
        const startTime = Date.now();

        // Mock execution - in production this would run in actual sandbox
        logger.info({ sandboxId: this.id, name, command }, 'Executing command');

        // Simulate some execution time
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Mock success for most commands
        const exitCode = command.includes('fail') ? 1 : 0;

        return {
            name,
            command,
            exitCode,
            durationMs: Date.now() - startTime,
            timestamp: Date.now(),
        };
    }

    async destroy(): Promise<void> {
        this.destroyed = true;
        logger.info({ sandboxId: this.id }, 'Destroying sandbox');
    }
}
