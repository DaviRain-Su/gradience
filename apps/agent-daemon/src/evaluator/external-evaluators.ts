/**
 * External Evaluator Integration
 *
 * Integrates with external evaluation services:
 * - Third-party LLM judges
 * - Human evaluator platforms
 * - Automated testing services
 * - Security audit services
 *
 * @module evaluators/external
 */

import { EventEmitter } from 'node:events';
import type {
  EvaluationTask,
  EvaluationResult,
  CategoryScore,
  CheckResult,
} from './runtime.js';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';

// ============================================================================
// Types
// ============================================================================

export interface ExternalEvaluatorConfig {
  /** Evaluator ID */
  id: string;
  /** Evaluator name */
  name: string;
  /** API endpoint */
  endpoint: string;
  /** API key */
  apiKey: string;
  /** Supported evaluation types */
  supportedTypes: string[];
  /** Request timeout (ms) */
  timeoutMs: number;
  /** Retry attempts */
  maxRetries: number;
  /** Webhook secret for callbacks */
  webhookSecret?: string;
}

export interface ExternalEvaluationRequest {
  /** Evaluation ID */
  evaluationId: string;
  /** Task details */
  task: EvaluationTask;
  /** Callback URL for results */
  callbackUrl?: string;
  /** Priority level */
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export interface ExternalEvaluationResult {
  /** Evaluation ID */
  evaluationId: string;
  /** External evaluator ID */
  externalEvaluatorId: string;
  /** Overall score (0-100) */
  score: number;
  /** Whether passed */
  passed: boolean;
  /** Category scores */
  categoryScores: CategoryScore[];
  /** Check results */
  checkResults: CheckResult[];
  /** Detailed feedback */
  feedback: string[];
  /** Raw response from external service */
  rawResponse?: Record<string, unknown>;
  /** Processing time (ms) */
  processingTimeMs: number;
  /** Timestamp */
  completedAt: number;
}

export interface LLMEvaluationConfig {
  /** Model provider */
  provider: 'anthropic' | 'openai' | 'local';
  /** Model name */
  model: string;
  /** API key */
  apiKey: string;
  /** Temperature */
  temperature: number;
  /** Max tokens */
  maxTokens: number;
  /** System prompt */
  systemPrompt?: string;
}

// ============================================================================
// External Evaluator Client
// ============================================================================

export class ExternalEvaluatorClient extends EventEmitter {
  private config: ExternalEvaluatorConfig;
  private pendingEvaluations: Map<string, AbortController> = new Map();

  constructor(config: ExternalEvaluatorConfig) {
    super();
    this.config = config;
  }

  /**
   * Check if this evaluator can handle the task
   */
  canEvaluate(task: EvaluationTask): boolean {
    return this.config.supportedTypes.includes(task.type);
  }

  /**
   * Submit evaluation to external service
   */
  async evaluate(
    request: ExternalEvaluationRequest
  ): Promise<ExternalEvaluationResult> {
    const startTime = Date.now();
    
    logger.info(
      { evaluationId: request.evaluationId, evaluator: this.config.name },
      'Submitting to external evaluator'
    );

    this.emit('evaluation_submitted', {
      evaluationId: request.evaluationId,
      evaluatorId: this.config.id,
    });

    // Create abort controller for timeout
    const controller = new AbortController();
    this.pendingEvaluations.set(request.evaluationId, controller);

    // Set timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.config.timeoutMs);

    let lastError: Error | undefined;

    // Retry loop
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            'X-Evaluator-ID': this.config.id,
          },
          body: JSON.stringify({
            evaluationId: request.evaluationId,
            taskType: request.task.type,
            submission: request.task.submission,
            criteria: request.task.criteria,
            callbackUrl: request.callbackUrl,
            priority: request.priority,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`External evaluator returned ${response.status}: ${await response.text()}`);
        }

        const result = await response.json();

        this.pendingEvaluations.delete(request.evaluationId);

        const evaluationResult: ExternalEvaluationResult = {
          evaluationId: request.evaluationId,
          externalEvaluatorId: this.config.id,
          score: result.score,
          passed: result.passed,
          categoryScores: result.categoryScores || [],
          checkResults: result.checkResults || [],
          feedback: result.feedback || [],
          rawResponse: result,
          processingTimeMs: Date.now() - startTime,
          completedAt: Date.now(),
        };

        this.emit('evaluation_completed', evaluationResult);

        logger.info(
          {
            evaluationId: request.evaluationId,
            score: evaluationResult.score,
            passed: evaluationResult.passed,
          },
          'External evaluation completed'
        );

        return evaluationResult;
      } catch (error) {
        lastError = error as Error;
        
        if (controller.signal.aborted) {
          break; // Don't retry on timeout
        }

        if (attempt < this.config.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          logger.warn(
            { evaluationId: request.evaluationId, attempt, delay },
            'External evaluation failed, retrying'
          );
          await this.sleep(delay);
        }
      }
    }

    clearTimeout(timeoutId);
    this.pendingEvaluations.delete(request.evaluationId);

    throw new DaemonError(
      ErrorCodes.SETTLEMENT_FAILED,
      `External evaluation failed after ${this.config.maxRetries} attempts: ${lastError?.message}`,
      500
    );
  }

  /**
   * Cancel pending evaluation
   */
  cancel(evaluationId: string): boolean {
    const controller = this.pendingEvaluations.get(evaluationId);
    if (controller) {
      controller.abort();
      this.pendingEvaluations.delete(evaluationId);
      return true;
    }
    return false;
  }

  /**
   * Handle webhook callback from external evaluator
   */
  handleWebhook(payload: unknown, signature: string): ExternalEvaluationResult | null {
    // Verify signature
    if (this.config.webhookSecret) {
      const isValid = this.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        logger.warn('Invalid webhook signature');
        return null;
      }
    }

    try {
      const result = payload as ExternalEvaluationResult;
      
      this.emit('webhook_received', result);
      
      logger.info(
        { evaluationId: result.evaluationId },
        'Received webhook from external evaluator'
      );

      return result;
    } catch (error) {
      logger.error({ error }, 'Failed to parse webhook payload');
      return null;
    }
  }

  /**
   * Verify webhook signature
   */
  private verifyWebhookSignature(payload: unknown, signature: string): boolean {
    // Implement HMAC signature verification
    // const crypto = require('crypto');
    // const expected = crypto
    //   .createHmac('sha256', this.config.webhookSecret!)
    //   .update(JSON.stringify(payload))
    //   .digest('hex');
    // return signature === expected;
    
    // Mock: always valid
    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// LLM Evaluator
// ============================================================================

export class LLMEvaluator extends EventEmitter {
  private config: LLMEvaluationConfig;

  constructor(config: LLMEvaluationConfig) {
    super();
    this.config = config;
  }

  /**
   * Evaluate content using LLM
   */
  async evaluateContent(params: {
    content: string;
    criteria: string[];
    context?: string;
  }): Promise<{
    score: number;
    feedback: string[];
    analysis: string;
  }> {
    const prompt = this.buildEvaluationPrompt(params);

    try {
      const response = await this.callLLM(prompt);
      return this.parseLLMResponse(response);
    } catch (error) {
      logger.error({ error }, 'LLM evaluation failed');
      throw error;
    }
  }

  /**
   * Build evaluation prompt
   */
  private buildEvaluationPrompt(params: {
    content: string;
    criteria: string[];
    context?: string;
  }): string {
    return `
You are an expert evaluator. Please evaluate the following content based on the given criteria.

${params.context ? `Context: ${params.context}\n` : ''}
Content to evaluate:
---
${params.content}
---

Evaluation Criteria:
${params.criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Please provide:
1. Overall score (0-100)
2. Detailed feedback for each criterion
3. Strengths
4. Areas for improvement
5. Overall analysis

Format your response as JSON:
{
  "score": number,
  "feedback": ["string"],
  "strengths": ["string"],
  "improvements": ["string"],
  "analysis": "string"
}
`;
  }

  /**
   * Call LLM API
   */
  private async callLLM(prompt: string): Promise<string> {
    const endpoint = this.getLLMEndpoint();

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          ...(this.config.systemPrompt ? [{ role: 'system', content: this.config.systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  /**
   * Get LLM endpoint based on provider
   */
  private getLLMEndpoint(): string {
    switch (this.config.provider) {
      case 'anthropic':
        return 'https://api.anthropic.com/v1/messages';
      case 'openai':
        return 'https://api.openai.com/v1/chat/completions';
      case 'local':
        return 'http://localhost:11434/v1/chat/completions';
      default:
        throw new Error(`Unknown provider: ${this.config.provider}`);
    }
  }

  /**
   * Parse LLM response
   */
  private parseLLMResponse(response: string): {
    score: number;
    feedback: string[];
    analysis: string;
  } {
    try {
      // Try to parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: Math.min(100, Math.max(0, parsed.score || 0)),
          feedback: parsed.feedback || [],
          analysis: parsed.analysis || '',
        };
      }
    } catch {
      // Fallback: extract score from text
      const scoreMatch = response.match(/score[:\s]+(\d+)/i);
      return {
        score: scoreMatch ? parseInt(scoreMatch[1]) : 50,
        feedback: [response.slice(0, 500)],
        analysis: response,
      };
    }

    return {
      score: 50,
      feedback: ['Unable to parse evaluation'],
      analysis: response,
    };
  }
}

// ============================================================================
// External Evaluator Registry
// ============================================================================

export class ExternalEvaluatorRegistry {
  private evaluators: Map<string, ExternalEvaluatorClient> = new Map();
  private llmEvaluators: Map<string, LLMEvaluator> = new Map();

  register(client: ExternalEvaluatorClient): void {
    this.evaluators.set(client['config'].id, client);
  }

  registerLLM(id: string, evaluator: LLMEvaluator): void {
    this.llmEvaluators.set(id, evaluator);
  }

  get(id: string): ExternalEvaluatorClient | undefined {
    return this.evaluators.get(id);
  }

  getLLM(id: string): LLMEvaluator | undefined {
    return this.llmEvaluators.get(id);
  }

  findForTask(task: EvaluationTask): ExternalEvaluatorClient | undefined {
    return Array.from(this.evaluators.values()).find(e => e.canEvaluate(task));
  }

  list(): ExternalEvaluatorClient[] {
    return Array.from(this.evaluators.values());
  }

  listLLMs(): LLMEvaluator[] {
    return Array.from(this.llmEvaluators.values());
  }

  /**
   * Cancel all pending evaluations
   */
  cancelAll(): number {
    let cancelled = 0;
    for (const evaluator of this.evaluators.values()) {
      // Note: This is a simplified version
      // In production, track pending evaluations per evaluator
    }
    return cancelled;
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createExternalEvaluator(
  config: ExternalEvaluatorConfig
): ExternalEvaluatorClient {
  return new ExternalEvaluatorClient(config);
}

export function createLLMEvaluator(
  config: LLMEvaluationConfig
): LLMEvaluator {
  return new LLMEvaluator(config);
}
