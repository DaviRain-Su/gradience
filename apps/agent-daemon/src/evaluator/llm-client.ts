/**
 * LLM Client for Judge Evaluation
 * 
 * Pluggable LLM backend supporting any OpenAI-compatible API:
 * - OpenAI (GPT-4, GPT-3.5)
 * - Anthropic Claude (via proxy)
 * - Moonshot Kimi
 * - Ollama (local)
 * - Any OpenAI-compatible endpoint
 * 
 * @module evaluator/llm-client
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface LLMConfig {
  /** API base URL (e.g., https://api.openai.com/v1, https://api.moonshot.cn/v1) */
  baseUrl: string;
  /** API key */
  apiKey: string;
  /** Model name (e.g., gpt-4, moonshot-v1-8k, claude-3-sonnet) */
  model: string;
  /** Max tokens for response */
  maxTokens?: number;
  /** Temperature (0-1) */
  temperature?: number;
  /** Request timeout in ms */
  timeout?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

export interface ChatResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

export interface EvaluationPrompt {
  taskType: string;
  taskDescription: string;
  submissionContent: string;
  criteria: string[];
  outputFormat: 'scores' | 'feedback' | 'full';
}

export interface EvaluationScores {
  scores: Array<{
    category: string;
    score: number;
    feedback: string;
  }>;
  overallScore: number;
  passed: boolean;
  summary: string;
}

// ============================================================================
// LLM Client
// ============================================================================

export class LLMClient {
  private config: LLMConfig;
  private initialized: boolean = false;

  constructor(config: LLMConfig) {
    this.config = {
      maxTokens: 2048,
      temperature: 0.3,
      timeout: 60000,
      ...config,
    };
  }

  /**
   * Check if LLM is configured
   */
  isConfigured(): boolean {
    return !!(this.config.apiKey && this.config.baseUrl);
  }

  /**
   * Initialize and verify connection
   */
  async initialize(): Promise<boolean> {
    if (!this.isConfigured()) {
      logger.warn('LLM not configured - will use fallback scoring');
      return false;
    }

    try {
      // Simple health check
      const response = await this.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 10,
      });
      this.initialized = true;
      logger.info(
        { model: this.config.model, baseUrl: this.config.baseUrl },
        'LLM client initialized'
      );
      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to initialize LLM client');
      return false;
    }
  }

  /**
   * Send chat completion request
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const url = `${this.config.baseUrl}/chat/completions`;
    
    const body = {
      model: request.model || this.config.model,
      messages: request.messages,
      temperature: request.temperature ?? this.config.temperature,
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      ...(request.responseFormat === 'json' && {
        response_format: { type: 'json_object' },
      }),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`LLM API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      return {
        content: choice?.message?.content || '',
        model: data.model || this.config.model,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        finishReason: choice?.finish_reason || 'stop',
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`LLM request timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Evaluate submission using LLM
   */
  async evaluate(prompt: EvaluationPrompt): Promise<EvaluationScores> {
    const systemPrompt = `You are an expert evaluator for ${prompt.taskType} tasks.
Your job is to objectively score submissions based on given criteria.
Be fair, consistent, and provide constructive feedback.
Output your evaluation in the exact JSON format specified.`;

    const userPrompt = `## Task Description
${prompt.taskDescription}

## Submission Content
${prompt.submissionContent}

## Evaluation Criteria
${prompt.criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## Instructions
Evaluate the submission against each criterion. For each criterion:
- Score from 0-100 (0=completely fails, 50=partial, 100=perfect)
- Provide specific feedback

Output as JSON:
{
  "scores": [
    { "category": "<criterion name>", "score": <0-100>, "feedback": "<specific feedback>" }
  ],
  "overallScore": <weighted average 0-100>,
  "passed": <true if overallScore >= 60>,
  "summary": "<2-3 sentence summary>"
}`;

    try {
      const response = await this.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        responseFormat: 'json',
      });

      // Parse JSON response
      const result = this.parseEvaluationResponse(response.content);
      
      logger.info(
        { taskType: prompt.taskType, overallScore: result.overallScore, passed: result.passed },
        'LLM evaluation completed'
      );

      return result;
    } catch (error) {
      logger.error({ error, taskType: prompt.taskType }, 'LLM evaluation failed');
      throw error;
    }
  }

  /**
   * Parse and validate evaluation response
   */
  private parseEvaluationResponse(content: string): EvaluationScores {
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (!Array.isArray(parsed.scores)) {
        throw new Error('Missing scores array');
      }

      // Normalize scores
      const scores = parsed.scores.map((s: any) => ({
        category: String(s.category || s.name || 'Unknown'),
        score: Math.min(100, Math.max(0, Number(s.score) || 0)),
        feedback: String(s.feedback || ''),
      }));

      const overallScore = typeof parsed.overallScore === 'number'
        ? Math.min(100, Math.max(0, parsed.overallScore))
        : scores.reduce((sum: number, s: any) => sum + s.score, 0) / scores.length;

      return {
        scores,
        overallScore,
        passed: parsed.passed ?? overallScore >= 60,
        summary: String(parsed.summary || ''),
      };
    } catch (error) {
      logger.error({ error, content: content.slice(0, 200) }, 'Failed to parse LLM response');
      throw new Error(`Failed to parse LLM evaluation response: ${(error as Error).message}`);
    }
  }

  /**
   * Evaluate code quality
   */
  async evaluateCode(code: string, requirements: string): Promise<EvaluationScores> {
    return this.evaluate({
      taskType: 'Code',
      taskDescription: requirements,
      submissionContent: code.slice(0, 10000), // Limit code length
      criteria: [
        'Functionality: Does the code correctly implement the requirements?',
        'Code Quality: Is the code clean, readable, and well-structured?',
        'Best Practices: Does it follow language idioms and best practices?',
        'Error Handling: Are errors properly handled?',
        'Documentation: Are there appropriate comments and documentation?',
      ],
      outputFormat: 'full',
    });
  }

  /**
   * Evaluate content quality
   */
  async evaluateContent(content: string, requirements: string): Promise<EvaluationScores> {
    return this.evaluate({
      taskType: 'Content',
      taskDescription: requirements,
      submissionContent: content.slice(0, 10000),
      criteria: [
        'Accuracy: Is the information correct and well-researched?',
        'Clarity: Is it easy to understand and well-written?',
        'Completeness: Does it cover all required topics?',
        'Originality: Is it unique and adds value?',
        'Relevance: Does it address the requirements?',
      ],
      outputFormat: 'full',
    });
  }

  /**
   * Evaluate API implementation
   */
  async evaluateAPI(apiSpec: string, testResults: string): Promise<EvaluationScores> {
    return this.evaluate({
      taskType: 'API',
      taskDescription: apiSpec,
      submissionContent: testResults,
      criteria: [
        'Correctness: Do endpoints return expected responses?',
        'Performance: Are response times acceptable?',
        'Error Handling: Are errors properly formatted?',
        'Documentation: Is the API well-documented?',
        'Security: Are there security best practices?',
      ],
      outputFormat: 'full',
    });
  }
}

// ============================================================================
// Factory
// ============================================================================

let defaultLLMClient: LLMClient | null = null;

/**
 * Get or create LLM client from environment
 */
export function getLLMClient(): LLMClient | null {
  if (defaultLLMClient) {
    return defaultLLMClient;
  }

  // Check for LLM configuration in environment
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL || detectBaseUrl();
  const model = process.env.LLM_MODEL || detectModel(baseUrl);

  if (!apiKey) {
    logger.warn('LLM_API_KEY not set - LLM evaluation disabled');
    return null;
  }

  defaultLLMClient = new LLMClient({
    apiKey,
    baseUrl,
    model,
    temperature: Number(process.env.LLM_TEMPERATURE) || 0.3,
    maxTokens: Number(process.env.LLM_MAX_TOKENS) || 2048,
    timeout: Number(process.env.LLM_TIMEOUT) || 60000,
  });

  return defaultLLMClient;
}

/**
 * Detect base URL from API key pattern
 */
function detectBaseUrl(): string {
  const apiKey = process.env.LLM_API_KEY || '';
  
  if (apiKey.startsWith('sk-')) {
    // OpenAI or compatible
    return 'https://api.openai.com/v1';
  } else if (apiKey.startsWith('moonshot-')) {
    // Kimi
    return 'https://api.moonshot.cn/v1';
  } else if (apiKey.startsWith('ant-')) {
    // Anthropic (needs proxy)
    return 'https://api.anthropic.com/v1';
  }
  
  // Default to OpenAI-compatible
  return 'https://api.openai.com/v1';
}

/**
 * Detect model based on base URL
 */
function detectModel(baseUrl: string): string {
  if (baseUrl.includes('moonshot')) {
    return 'moonshot-v1-8k';
  } else if (baseUrl.includes('anthropic')) {
    return 'claude-3-sonnet-20240229';
  } else if (baseUrl.includes('localhost') || baseUrl.includes('ollama')) {
    return 'llama2';
  }
  return 'gpt-4';
}

/**
 * Create LLM client with explicit config
 */
export function createLLMClient(config: Partial<LLMConfig>): LLMClient {
  const fullConfig: LLMConfig = {
    baseUrl: config.baseUrl || process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    apiKey: config.apiKey || process.env.LLM_API_KEY || '',
    model: config.model || process.env.LLM_MODEL || 'gpt-4',
    ...config,
  };
  return new LLMClient(fullConfig);
}

/**
 * Check if LLM is available
 */
export function isLLMAvailable(): boolean {
  return !!(process.env.LLM_API_KEY);
}
