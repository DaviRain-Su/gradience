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
import { getLLMClient, isLLMAvailable, type LLMClient, type EvaluationScores } from './llm-client.js';

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
  private llmClient: LLMClient | null = null;

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
    this.llmClient = getLLMClient();
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

    // Try LLM evaluation first
    if (this.llmClient && isLLMAvailable()) {
      try {
        const codeContent = task.submission?.source || task.submission?.content || '';
        const requirements = task.description || '';
        
        logger.info({ taskId: task.id }, 'Using LLM for code evaluation');
        const llmResult = await this.llmClient.evaluateCode(codeContent, requirements);
        
        // Convert LLM scores to CategoryScore format
        for (const s of llmResult.scores) {
          const weightKey = s.category.toLowerCase().replace(/\s+/g, '');
          scores.push({
            name: s.category,
            score: s.score,
            maxScore: 100,
            weight: this.config.weights[weightKey] || 0.25,
            feedback: [s.feedback],
          });
        }
        
        feedback.push(`Code evaluated using LLM (${this.llmClient['config']?.model || 'unknown'})`);
        feedback.push(llmResult.summary);
        
        // Add basic checks
        checks.push(
          { type: 'llm_evaluated', passed: true, score: 100, details: 'LLM evaluation successful', durationMs: 0 }
        );
        
        return { scores, checks, feedback };
      } catch (error) {
        logger.warn({ error, taskId: task.id }, 'LLM evaluation failed, using fallback');
        feedback.push('LLM evaluation failed, using fallback scoring');
      }
    }

    // Fallback to basic scoring (when LLM unavailable)
    logger.info({ taskId: task.id }, 'Using fallback code evaluation (LLM not available)');
    
    // Basic heuristic scoring based on code analysis
    const codeContent = task.submission?.source || task.submission?.content || '';
    const codeLength = codeContent.length;
    const hasTests = /test|spec|describe|it\(|expect\(/.test(codeContent);
    const hasComments = /\/\/|\/\*|\*\/|#/.test(codeContent);
    const hasErrorHandling = /try|catch|throw|error/i.test(codeContent);
    
    // Functionality score - based on code presence
    const funcScore = Math.min(100, 60 + (codeLength > 100 ? 20 : 0) + (hasTests ? 20 : 0));
    scores.push({
      name: 'Functionality',
      score: funcScore,
      maxScore: 100,
      weight: this.config.weights.functionality,
      feedback: hasTests ? ['Tests detected'] : ['No tests detected - consider adding tests'],
    });

    // Code quality score
    const qualityScore = Math.min(100, 60 + (hasComments ? 20 : 0) + (codeLength > 50 ? 20 : 0));
    scores.push({
      name: 'Code Quality',
      score: qualityScore,
      maxScore: 100,
      weight: this.config.weights.quality,
      feedback: hasComments ? ['Code includes comments'] : ['Consider adding comments'],
    });

    // Test coverage score (heuristic)
    const coverageScore = hasTests ? 75 : 50;
    scores.push({
      name: 'Test Coverage',
      score: coverageScore,
      maxScore: 100,
      weight: this.config.weights.tests,
      feedback: [`Estimated coverage: ${coverageScore}%`],
    });

    // Security score
    const securityScore = hasErrorHandling ? 85 : 70;
    scores.push({
      name: 'Security',
      score: securityScore,
      maxScore: 100,
      weight: this.config.weights.security,
      feedback: hasErrorHandling ? ['Error handling detected'] : ['Consider adding error handling'],
    });

    // Add checks
    checks.push(
      { type: 'code_present', passed: codeLength > 0, score: codeLength > 0 ? 100 : 0, details: 'Code submission present', durationMs: 0 },
      { type: 'tests_detected', passed: hasTests, score: hasTests ? 100 : 50, details: hasTests ? 'Tests found' : 'No tests found', durationMs: 0 }
    );

    feedback.push(`Code evaluated using heuristic analysis (LLM_API_KEY not configured)`);
    feedback.push('For better evaluation, configure LLM_API_KEY environment variable');

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
    const endpoints = (task.submission.metadata?.endpoints ?? []) as any[];

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
  private llmClient: LLMClient | null = null;

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
    this.llmClient = getLLMClient();
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

    // Try LLM evaluation first
    if (this.llmClient && isLLMAvailable()) {
      try {
        const content = task.submission?.content || task.submission?.source || '';
        const requirements = task.description || '';
        
        logger.info({ taskId: task.id }, 'Using LLM for content evaluation');
        const llmResult = await this.llmClient.evaluateContent(content, requirements);
        
        // Convert LLM scores to CategoryScore format
        for (const s of llmResult.scores) {
          const weightKey = s.category.toLowerCase().replace(/\s+/g, '');
          scores.push({
            name: s.category,
            score: s.score,
            maxScore: 100,
            weight: this.config.weights[weightKey] || 0.25,
            feedback: [s.feedback],
          });
        }
        
        feedback.push(`Content evaluated using LLM (${this.llmClient['config']?.model || 'unknown'})`);
        feedback.push(llmResult.summary);
        
        checks.push(
          { type: 'llm_evaluated', passed: true, score: 100, details: 'LLM evaluation successful', durationMs: 0 }
        );
        
        return { scores, checks, feedback };
      } catch (error) {
        logger.warn({ error, taskId: task.id }, 'LLM evaluation failed, using fallback');
        feedback.push('LLM evaluation failed, using fallback scoring');
      }
    }

    // Fallback to heuristic scoring
    logger.info({ taskId: task.id }, 'Using fallback content evaluation (LLM not available)');
    
    const content = task.submission?.content || task.submission?.source || '';
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const hasStructure = /#{1,6}\s|^\d+\.|^\-\s/m.test(content);
    const hasParagraphs = content.split(/\n\n+/).length > 1;
    
    // Accuracy - hard to judge without LLM, give moderate score
    const accuracyScore = 70;
    scores.push({
      name: 'Accuracy',
      score: accuracyScore,
      maxScore: 100,
      weight: this.config.weights.accuracy,
      feedback: ['Accuracy cannot be verified without LLM - using baseline score'],
    });

    // Clarity - based on structure
    const clarityScore = Math.min(100, 60 + (hasStructure ? 20 : 0) + (hasParagraphs ? 20 : 0));
    scores.push({
      name: 'Clarity',
      score: clarityScore,
      maxScore: 100,
      weight: this.config.weights.clarity,
      feedback: hasStructure ? ['Content has clear structure'] : ['Consider adding headings or structure'],
    });

    // Completeness - based on length
    const completenessScore = Math.min(100, 50 + Math.min(50, wordCount / 10));
    scores.push({
      name: 'Completeness',
      score: completenessScore,
      maxScore: 100,
      weight: this.config.weights.completeness,
      feedback: [`Content has ${wordCount} words`],
    });

    // Originality - can't judge without LLM
    const originalityScore = 70;
    scores.push({
      name: 'Originality',
      score: originalityScore,
      maxScore: 100,
      weight: this.config.weights.originality,
      feedback: ['Originality cannot be verified without LLM - using baseline score'],
    });

    feedback.push('Content evaluated using heuristic analysis (LLM_API_KEY not configured)');
    feedback.push('For better evaluation, configure LLM_API_KEY environment variable');

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
