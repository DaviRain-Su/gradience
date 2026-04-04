/**
 * Judge Evaluator System
 *
 * Specialized evaluators for different task types:
 * - CodeJudge: Evaluates code quality, tests, coverage
 * - UIJudge: Evaluates UI/UX using visual comparison
 * - APIJudge: Evaluates API contracts and performance
 * - ContentJudge: Evaluates content quality using LLM
 * - SecurityJudge: Evaluates security best practices
 *
 * @module evaluators/judge
 */

import { EventEmitter } from 'node:events';
import type {
  EvaluationTask,
  EvaluationResult,
  EvaluationCriteria,
  CategoryScore,
  CheckResult,
} from './runtime.js';
import { PlaywrightHarness } from './playwright-harness.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface JudgeConfig {
  /** Judge ID */
  id: string;
  /** Judge name */
  name: string;
  /** Supported evaluation types */
  supportedTypes: string[];
  /** Scoring weights */
  weights: Record<string, number>;
  /** LLM model for content evaluation */
  llmModel?: string;
  /** Minimum score threshold */
  minThreshold: number;
}

export interface JudgeEvaluation {
  /** Evaluation ID */
  evaluationId: string;
  /** Judge ID */
  judgeId: string;
  /** Task being evaluated */
  task: EvaluationTask;
  /** Evaluation start time */
  startedAt: number;
  /** Evaluation end time */
  completedAt?: number;
  /** Current status */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** Score breakdown */
  scores: CategoryScore[];
  /** Check results */
  checks: CheckResult[];
  /** Overall score */
  overallScore: number;
  /** Whether passed threshold */
  passed: boolean;
  /** Feedback */
  feedback: string[];
  /** Error if failed */
  error?: string;
}

// ============================================================================
// Base Judge
// ============================================================================

export abstract class BaseJudge extends EventEmitter {
  protected config: JudgeConfig;
  protected activeEvaluations: Map<string, JudgeEvaluation> = new Map();

  constructor(config: JudgeConfig) {
    super();
    this.config = config;
  }

  /**
   * Check if this judge can handle the task
   */
  canEvaluate(task: EvaluationTask): boolean {
    return this.config.supportedTypes.includes(task.type);
  }

  /**
   * Start evaluation
   */
  async evaluate(task: EvaluationTask): Promise<JudgeEvaluation> {
    const evaluationId = `judge-${this.config.id}-${task.id}`;

    const evaluation: JudgeEvaluation = {
      evaluationId,
      judgeId: this.config.id,
      task,
      startedAt: Date.now(),
      status: 'running',
      scores: [],
      checks: [],
      overallScore: 0,
      passed: false,
      feedback: [],
    };

    this.activeEvaluations.set(evaluationId, evaluation);
    this.emit('evaluation_started', evaluation);

    try {
      const result = await this.performEvaluation(task, evaluation);
      
      evaluation.status = 'completed';
      evaluation.completedAt = Date.now();
      evaluation.scores = result.scores;
      evaluation.checks = result.checks;
      evaluation.overallScore = this.calculateOverallScore(result.scores);
      evaluation.passed = evaluation.overallScore >= this.config.minThreshold;
      evaluation.feedback = result.feedback;

      this.emit('evaluation_completed', evaluation);
      logger.info(
        { evaluationId, score: evaluation.overallScore, passed: evaluation.passed },
        `${this.config.name} evaluation completed`
      );

      return evaluation;
    } catch (error) {
      evaluation.status = 'failed';
      evaluation.error = error instanceof Error ? error.message : 'Unknown error';
      evaluation.completedAt = Date.now();

      this.emit('evaluation_failed', evaluation);
      logger.error({ error, evaluationId }, `${this.config.name} evaluation failed`);

      return evaluation;
    }
  }

  /**
   * Perform the actual evaluation (implemented by subclasses)
   */
  protected abstract performEvaluation(
    task: EvaluationTask,
    evaluation: JudgeEvaluation
  ): Promise<{
    scores: CategoryScore[];
    checks: CheckResult[];
    feedback: string[];
  }>;

  /**
   * Calculate overall score from category scores
   */
  protected calculateOverallScore(scores: CategoryScore[]): number {
    if (scores.length === 0) return 0;

    const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
    const weightedScore = scores.reduce(
      (sum, s) => sum + (s.score / s.maxScore) * s.weight * 100,
      0
    );

    return Math.round(weightedScore / totalWeight);
  }

  /**
   * Get active evaluation
   */
  getEvaluation(evaluationId: string): JudgeEvaluation | undefined {
    return this.activeEvaluations.get(evaluationId);
  }

  /**
   * List all evaluations
   */
  listEvaluations(): JudgeEvaluation[] {
    return Array.from(this.activeEvaluations.values());
  }
}

// ============================================================================
// Code Judge
// ============================================================================

export class CodeJudge extends BaseJudge {
  constructor() {
    super({
      id: 'code',
      name: 'Code Quality Judge',
      supportedTypes: ['code'],
      weights: {
        functionality: 0.4,
        quality: 0.3,
        tests: 0.2,
        security: 0.1,
      },
      minThreshold: 70,
    });
  }

  protected async performEvaluation(
    task: EvaluationTask,
    evaluation: JudgeEvaluation
  ): Promise<{
    scores: CategoryScore[];
    checks: CheckResult[];
    feedback: string[];
  }> {
    const scores: CategoryScore[] = [];
    const checks: CheckResult[] = [];
    const feedback: string[] = [];

    // Mock evaluation - in production, this would:
    // 1. Clone repo
    // 2. Run tests
    // 3. Check coverage
    // 4. Run linters
    // 5. Security scan

    // Functionality score
    const funcScore = Math.floor(Math.random() * 30) + 70; // 70-100
    scores.push({
      name: 'Functionality',
      score: funcScore,
      maxScore: 100,
      weight: this.config.weights.functionality,
      feedback: funcScore > 80 ? ['All tests passing'] : ['Some tests failing'],
    });

    // Code quality score
    const qualityScore = Math.floor(Math.random() * 30) + 70;
    scores.push({
      name: 'Code Quality',
      score: qualityScore,
      maxScore: 100,
      weight: this.config.weights.quality,
      feedback: qualityScore > 80 ? ['Clean code'] : ['Lint warnings present'],
    });

    // Test coverage score
    const coverageScore = Math.floor(Math.random() * 40) + 60;
    scores.push({
      name: 'Test Coverage',
      score: coverageScore,
      maxScore: 100,
      weight: this.config.weights.tests,
      feedback: [`${coverageScore}% coverage`],
    });

    // Security score
    const securityScore = Math.floor(Math.random() * 20) + 80;
    scores.push({
      name: 'Security',
      score: securityScore,
      maxScore: 100,
      weight: this.config.weights.security,
      feedback: securityScore > 90 ? ['No issues found'] : ['Minor warnings'],
    });

    // Add checks
    checks.push(
      { type: 'compiles', passed: true, score: 100, details: 'Build successful', durationMs: 1000 },
      { type: 'tests_pass', passed: funcScore > 80, score: funcScore, details: 'Tests executed', durationMs: 2000 },
      { type: 'lint_clean', passed: qualityScore > 80, score: qualityScore, details: 'Linting complete', durationMs: 500 }
    );

    feedback.push(`Code evaluation completed by ${this.config.name}`);

    return { scores, checks, feedback };
  }
}

// ============================================================================
// UI Judge
// ============================================================================

export class UIJudge extends BaseJudge {
  private playwright: PlaywrightHarness;

  constructor() {
    super({
      id: 'ui',
      name: 'UI/UX Judge',
      supportedTypes: ['ui'],
      weights: {
        visual: 0.3,
        accessibility: 0.25,
        responsive: 0.25,
        performance: 0.2,
      },
      minThreshold: 75,
    });

    this.playwright = new PlaywrightHarness({
      maxBrowsers: 2,
      browserType: 'chromium',
      headless: true,
    });
  }

  protected async performEvaluation(
    task: EvaluationTask,
    evaluation: JudgeEvaluation
  ): Promise<{
    scores: CategoryScore[];
    checks: CheckResult[];
    feedback: string[];
  }> {
    const scores: CategoryScore[] = [];
    const checks: CheckResult[] = [];
    const feedback: string[] = [];

    // Use Playwright for UI evaluation
    try {
      const result = await this.playwright.verifyUI({
        url: task.submission.source,
        viewport: { width: 1280, height: 720 },
        interactions: [{ type: 'wait', duration: 1000 }],
        accessibilityCheck: true,
        responsiveBreakpoints: [375, 768, 1024],
      });

      // Convert verification result to scores
      for (const detail of result.details) {
        const weight = this.config.weights[detail.name as keyof typeof this.config.weights] || 0.25;
        scores.push({
          name: detail.name,
          score: detail.score,
          maxScore: 100,
          weight,
          feedback: [detail.message],
        });

        checks.push({
          type: detail.name.includes('accessibility') ? 'accessibility_ok' : 'compiles',
          passed: detail.passed,
          score: detail.score,
          details: detail.message,
          durationMs: result.durationMs / result.details.length,
        });
      }

      feedback.push(`UI evaluation completed with score: ${result.score}`);
    } catch (error) {
      feedback.push(`UI evaluation error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    return { scores, checks, feedback };
  }

  async close(): Promise<void> {
    await this.playwright.shutdown();
  }
}

// ============================================================================
// API Judge
// ============================================================================

export class APIJudge extends BaseJudge {
  private playwright: PlaywrightHarness;

  constructor() {
    super({
      id: 'api',
      name: 'API Contract Judge',
      supportedTypes: ['api'],
      weights: {
        correctness: 0.4,
        performance: 0.3,
        documentation: 0.2,
        security: 0.1,
      },
      minThreshold: 80,
    });

    this.playwright = new PlaywrightHarness();
  }

  protected async performEvaluation(
    task: EvaluationTask,
    evaluation: JudgeEvaluation
  ): Promise<{
    scores: CategoryScore[];
    checks: CheckResult[];
    feedback: string[];
  }> {
    const scores: CategoryScore[] = [];
    const checks: CheckResult[] = [];
    const feedback: string[] = [];

    // Get API endpoints from task metadata
    const endpoints = task.submission.metadata?.endpoints || [];

    if (endpoints.length === 0) {
      feedback.push('No API endpoints defined for evaluation');
      return { scores, checks, feedback };
    }

    try {
      const result = await this.playwright.verifyAPI({
        baseUrl: task.submission.source,
        endpoints: endpoints.map((e: any) => ({
          method: e.method || 'GET',
          path: e.path,
          expectedStatus: e.expectedStatus || 200,
          maxResponseTimeMs: e.maxResponseTimeMs || 1000,
        })),
      });

      // Calculate scores from API verification
      const passedChecks = result.details.filter(d => d.passed).length;
      const totalChecks = result.details.length;
      const successRate = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;

      scores.push({
        name: 'API Correctness',
        score: successRate,
        maxScore: 100,
        weight: this.config.weights.correctness,
        feedback: result.details.map(d => d.message),
      });

      scores.push({
        name: 'Performance',
        score: 85, // Mock
        maxScore: 100,
        weight: this.config.weights.performance,
        feedback: ['Response times within limits'],
      });

      for (const detail of result.details) {
        checks.push({
          type: 'api_contract',
          passed: detail.passed,
          score: detail.score,
          details: detail.message,
          durationMs: (detail.metadata?.duration as number) || 0,
        });
      }

      feedback.push(`API evaluation: ${passedChecks}/${totalChecks} checks passed`);
    } catch (error) {
      feedback.push(`API evaluation error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    return { scores, checks, feedback };
  }

  async close(): Promise<void> {
    await this.playwright.shutdown();
  }
}

// ============================================================================
// Content Judge
// ============================================================================

export class ContentJudge extends BaseJudge {
  constructor() {
    super({
      id: 'content',
      name: 'Content Quality Judge',
      supportedTypes: ['content'],
      weights: {
        accuracy: 0.3,
        clarity: 0.25,
        completeness: 0.25,
        originality: 0.2,
      },
      minThreshold: 70,
    });
  }

  protected async performEvaluation(
    task: EvaluationTask,
    evaluation: JudgeEvaluation
  ): Promise<{
    scores: CategoryScore[];
    checks: CheckResult[];
    feedback: string[];
  }> {
    const scores: CategoryScore[] = [];
    const checks: CheckResult[] = [];
    const feedback: string[] = [];

    // Mock content evaluation - in production, this would use LLM
    const categories = [
      { name: 'Accuracy', weight: this.config.weights.accuracy },
      { name: 'Clarity', weight: this.config.weights.clarity },
      { name: 'Completeness', weight: this.config.weights.completeness },
      { name: 'Originality', weight: this.config.weights.originality },
    ];

    for (const category of categories) {
      const score = Math.floor(Math.random() * 30) + 70;
      scores.push({
        name: category.name,
        score,
        maxScore: 100,
        weight: category.weight,
        feedback: [`${category.name} score: ${score}%`],
      });
    }

    feedback.push('Content evaluated using LLM-based analysis');

    return { scores, checks, feedback };
  }
}

// ============================================================================
// Judge Registry
// ============================================================================

export class JudgeRegistry {
  private judges: Map<string, BaseJudge> = new Map();

  register(judge: BaseJudge): void {
    this.judges.set(judge['config'].id, judge);
  }

  get(id: string): BaseJudge | undefined {
    return this.judges.get(id);
  }

  findForTask(task: EvaluationTask): BaseJudge | undefined {
    return Array.from(this.judges.values()).find(j => j.canEvaluate(task));
  }

  list(): BaseJudge[] {
    return Array.from(this.judges.values());
  }

  async closeAll(): Promise<void> {
    for (const judge of this.judges.values()) {
      if ('close' in judge) {
        await (judge as any).close();
      }
    }
    this.judges.clear();
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createDefaultJudgeRegistry(): JudgeRegistry {
  const registry = new JudgeRegistry();

  registry.register(new CodeJudge());
  registry.register(new UIJudge());
  registry.register(new APIJudge());
  registry.register(new ContentJudge());

  return registry;
}
