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
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';

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
}

export type EvaluationType =
  | 'code'      // Code execution + tests
  | 'ui'        // UI/UX evaluation (Playwright)
  | 'api'       // API endpoint testing
  | 'content'   // Content quality (LLM-as-judge)
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
  resetStrategy: 'sprint_boundary' | 'checkpoint' | 'gradual';
  /** Checkpoint interval (ms) */
  checkpointIntervalMs: number;
}

// ============================================================================
// Evaluator Runtime
// ============================================================================

export class EvaluatorRuntime extends EventEmitter {
  private activeEvaluations: Map<string, EvaluationTask> = new Map();
  private config: EvaluatorConfig;

  constructor(config: Partial<EvaluatorConfig> = {}) {
    super();
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
      timeoutAt: now + (task.budget.maxTimeSeconds * 1000),
    };

    // Validate task
    this.validateTask(fullTask);

    // Store task
    this.activeEvaluations.set(id, fullTask);

    logger.info(
      { evaluationId: id, taskId: task.taskId, type: task.type },
      'Evaluation task submitted'
    );

    // Emit event
    this.emit('submitted', fullTask);

    // Start evaluation asynchronously
    this.runEvaluation(fullTask).catch((error) => {
      logger.error({ error, evaluationId: id }, 'Evaluation failed');
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

    // TODO: Signal sandbox to stop
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
          throw new DaemonError(
            ErrorCodes.INVALID_REQUEST,
            `Unknown evaluation type: ${task.type}`
          );
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
      await this.destroySandbox(sandbox);
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
        'Evaluation completed'
      );

      return finalResult;
    } catch (error) {
      // Cleanup on error
      if (sandbox) await this.destroySandbox(sandbox);
      this.activeEvaluations.delete(task.id);

      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Evaluation Types
  // -------------------------------------------------------------------------

  private async evaluateCode(
    task: EvaluationTask,
    sandbox: Sandbox
  ): Promise<Partial<EvaluationResult>> {
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

  private async evaluateUI(
    task: EvaluationTask,
    sandbox: Sandbox
  ): Promise<Partial<EvaluationResult>> {
    // TODO: Implement Playwright-based UI evaluation
    // This would launch a browser, run interactions, take screenshots

    logger.info({ evaluationId: task.id }, 'UI evaluation not yet implemented');

    return {
      categoryScores: [],
      checkResults: [],
      executionLog: {
        sandboxType: this.config.sandbox.type,
        steps: [],
        stdout: '',
        stderr: '',
      },
    };
  }

  private async evaluateAPI(
    task: EvaluationTask,
    sandbox: Sandbox
  ): Promise<Partial<EvaluationResult>> {
    // TODO: Implement API contract testing

    logger.info({ evaluationId: task.id }, 'API evaluation not yet implemented');

    return {
      categoryScores: [],
      checkResults: [],
      executionLog: {
        sandboxType: this.config.sandbox.type,
        steps: [],
        stdout: '',
        stderr: '',
      },
    };
  }

  private async evaluateContent(
    task: EvaluationTask,
    sandbox: Sandbox
  ): Promise<Partial<EvaluationResult>> {
    // TODO: Implement LLM-as-judge content evaluation

    logger.info({ evaluationId: task.id }, 'Content evaluation not yet implemented');

    return {
      categoryScores: [],
      checkResults: [],
      executionLog: {
        sandboxType: this.config.sandbox.type,
        steps: [],
        stdout: '',
        stderr: '',
      },
    };
  }

  private async evaluateComposite(
    task: EvaluationTask,
    sandbox: Sandbox
  ): Promise<Partial<EvaluationResult>> {
    // TODO: Implement composite evaluation (multiple types)

    logger.info({ evaluationId: task.id }, 'Composite evaluation not yet implemented');

    return {
      categoryScores: [],
      checkResults: [],
      executionLog: {
        sandboxType: this.config.sandbox.type,
        steps: [],
        stdout: '',
        stderr: '',
      },
    };
  }

  // -------------------------------------------------------------------------
  // Sandbox Management
  // -------------------------------------------------------------------------

  private async createSandbox(task: EvaluationTask): Promise<Sandbox> {
    // TODO: Implement actual Docker/git-worktree sandbox
    // For now, return mock sandbox

    logger.info({ evaluationId: task.id }, 'Creating sandbox');

    return new MockSandbox(task, this.config.sandbox);
  }

  private async destroySandbox(sandbox: Sandbox): Promise<void> {
    await sandbox.destroy();
    logger.info({ sandboxId: sandbox.id }, 'Sandbox destroyed');
  }

  // -------------------------------------------------------------------------
  // Scoring
  // -------------------------------------------------------------------------

  private calculateFinalScore(categoryScores: CategoryScore[]): number {
    if (categoryScores.length === 0) return 0;

    const weightedSum = categoryScores.reduce(
      (sum, cat) => sum + (cat.score / cat.maxScore) * cat.weight * 100,
      0
    );

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
      details: driftDetected
        ? `Context window usage ${(usage * 100).toFixed(1)}% exceeds threshold`
        : undefined,
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

  private generateVerificationHash(
    task: EvaluationTask,
    result: Partial<EvaluationResult>
  ): string {
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

class MockSandbox implements Sandbox {
  id: string;

  constructor(
    private task: EvaluationTask,
    private config: SandboxConfig
  ) {
    this.id = `sandbox-${task.id}`;
  }

  async execute(name: string, command: string): Promise<ExecutionStep> {
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
    logger.info({ sandboxId: this.id }, 'Destroying sandbox');
  }
}
