/**
 * External Evaluators Tests
 *
 * @module evaluator/external-evaluators.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ExternalEvaluatorClient,
  LLMEvaluator,
  ExternalEvaluatorRegistry,
  createExternalEvaluator,
  createLLMEvaluator,
  type ExternalEvaluatorConfig,
  type LLMEvaluationConfig,
} from '../../../src/evaluator/external-evaluators.js';
import type { EvaluationTask } from '../../../src/evaluator/runtime.js';

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn();

describe('ExternalEvaluatorClient', () => {
  let client: ExternalEvaluatorClient;
  const mockConfig: ExternalEvaluatorConfig = {
    id: 'test-evaluator',
    name: 'Test Evaluator',
    endpoint: 'https://api.evaluator.com/evaluate',
    apiKey: 'test-api-key',
    supportedTypes: ['code', 'content'],
    timeoutMs: 5000,
    maxRetries: 3,
    webhookSecret: 'webhook-secret',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ExternalEvaluatorClient(mockConfig);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create client with provided config', () => {
      expect(client['config'].id).toBe('test-evaluator');
      expect(client['config'].name).toBe('Test Evaluator');
      expect(client['config'].supportedTypes).toContain('code');
    });
  });

  describe('canEvaluate', () => {
    it('should return true for supported types', () => {
      const task = { type: 'code' } as EvaluationTask;
      expect(client.canEvaluate(task)).toBe(true);
    });

    it('should return false for unsupported types', () => {
      const task = { type: 'ui' } as EvaluationTask;
      expect(client.canEvaluate(task)).toBe(false);
    });
  });

  describe('evaluate', () => {
    const mockTask: EvaluationTask = {
      id: 'task-1',
      taskId: 'task-1',
      agentId: 'agent-1',
      type: 'code',
      submission: { type: 'inline', source: 'test', metadata: {} },
      criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
      budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
      createdAt: Date.now(),
      timeoutAt: Date.now() + 60000,
    };

    it('should submit evaluation successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          score: 85,
          passed: true,
          categoryScores: [{ name: 'Quality', score: 85, maxScore: 100, weight: 1, feedback: ['Good'] }],
          checkResults: [{ type: 'compiles', passed: true, score: 100, details: 'OK', durationMs: 100 }],
          feedback: ['Well done'],
        }),
      });

      const result = await client.evaluate({
        evaluationId: 'eval-1',
        task: mockTask,
        priority: 'normal',
      });

      expect(result.score).toBe(85);
      expect(result.passed).toBe(true);
      expect(result.categoryScores).toHaveLength(1);
      expect(result.externalEvaluatorId).toBe('test-evaluator');
    });

    it('should include callback URL when provided', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          score: 80,
          passed: true,
          categoryScores: [],
          checkResults: [],
          feedback: [],
        }),
      });

      await client.evaluate({
        evaluationId: 'eval-1',
        task: mockTask,
        callbackUrl: 'https://example.com/callback',
        priority: 'high',
      });

      const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(requestBody.callbackUrl).toBe('https://example.com/callback');
      expect(requestBody.priority).toBe('high');
    });

    it('should retry on failure', async () => {
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            score: 90,
            passed: true,
            categoryScores: [],
            checkResults: [],
            feedback: [],
          }),
        });

      const result = await client.evaluate({
        evaluationId: 'eval-1',
        task: mockTask,
        priority: 'normal',
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.score).toBe(90);
    });

    it('should throw error after max retries', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Persistent error'));

      await expect(
        client.evaluate({
          evaluationId: 'eval-1',
          task: mockTask,
          priority: 'normal',
        })
      ).rejects.toThrow('External evaluation failed after 3 attempts');

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff for retries', async () => {
      const sleepSpy = vi.spyOn(global, 'setTimeout');
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ score: 80, passed: true, categoryScores: [], checkResults: [], feedback: [] }),
        });

      await client.evaluate({
        evaluationId: 'eval-1',
        task: mockTask,
        priority: 'normal',
      });

      // Check that setTimeout was called with increasing delays (2^1 * 1000 = 2000, 2^2 * 1000 = 4000)
      const delays = sleepSpy.mock.calls.map(call => call[1]);
      expect(delays).toContain(2000);
      expect(delays).toContain(4000);

      sleepSpy.mockRestore();
    });

    it('should not retry on timeout', async () => {
      const fetchMock = (global.fetch as any);
      fetchMock.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('Timeout');
            (error as any).name = 'AbortError';
            reject(error);
          }, 100);
        });
      });

      await expect(
        client.evaluate({
          evaluationId: 'eval-1',
          task: mockTask,
          priority: 'normal',
        })
      ).rejects.toThrow();

      // Should only call once, no retries on timeout
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should emit evaluation_submitted event', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          score: 80,
          passed: true,
          categoryScores: [],
          checkResults: [],
          feedback: [],
        }),
      });

      const events: any[] = [];
      client.on('evaluation_submitted', (e) => events.push(e));

      await client.evaluate({
        evaluationId: 'eval-1',
        task: mockTask,
        priority: 'normal',
      });

      expect(events).toHaveLength(1);
      expect(events[0].evaluationId).toBe('eval-1');
    });

    it('should emit evaluation_completed event', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          score: 80,
          passed: true,
          categoryScores: [],
          checkResults: [],
          feedback: [],
        }),
      });

      const events: any[] = [];
      client.on('evaluation_completed', (e) => events.push(e));

      await client.evaluate({
        evaluationId: 'eval-1',
        task: mockTask,
        priority: 'normal',
      });

      expect(events).toHaveLength(1);
      expect(events[0].score).toBe(80);
    });

    it('should include correct headers in request', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          score: 80,
          passed: true,
          categoryScores: [],
          checkResults: [],
          feedback: [],
        }),
      });

      await client.evaluate({
        evaluationId: 'eval-1',
        task: mockTask,
        priority: 'normal',
      });

      const headers = (global.fetch as any).mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer test-api-key');
      expect(headers['X-Evaluator-ID']).toBe('test-evaluator');
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('cancel', () => {
    it('should cancel pending evaluation', async () => {
      (global.fetch as any).mockImplementationOnce(() =>
        new Promise(() => {}) // Never resolves
      );

      const mockTask: EvaluationTask = {
        id: 'task-1',
        taskId: 'task-1',
        agentId: 'agent-1',
        type: 'code',
        submission: { type: 'inline', source: 'test', metadata: {} },
        criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
        createdAt: Date.now(),
        timeoutAt: Date.now() + 60000,
      };

      // Start evaluation (don't await)
      client.evaluate({
        evaluationId: 'eval-to-cancel',
        task: mockTask,
        priority: 'normal',
      });

      // Small delay to ensure fetch is called
      await new Promise(resolve => setTimeout(resolve, 10));

      const cancelled = client.cancel('eval-to-cancel');
      expect(cancelled).toBe(true);
    });

    it('should return false for unknown evaluation', () => {
      const cancelled = client.cancel('unknown-eval');
      expect(cancelled).toBe(false);
    });
  });

  describe('handleWebhook', () => {
    it('should handle valid webhook payload', () => {
      const payload = {
        evaluationId: 'eval-1',
        externalEvaluatorId: 'test-evaluator',
        score: 85,
        passed: true,
        categoryScores: [],
        checkResults: [],
        feedback: ['Good job'],
        processingTimeMs: 1000,
        completedAt: Date.now(),
      };

      const result = client.handleWebhook(payload, 'valid-signature');

      expect(result).toBeDefined();
      expect(result?.evaluationId).toBe('eval-1');
    });

    it('should emit webhook_received event', () => {
      const payload = {
        evaluationId: 'eval-1',
        externalEvaluatorId: 'test-evaluator',
        score: 85,
        passed: true,
        categoryScores: [],
        checkResults: [],
        feedback: [],
        processingTimeMs: 1000,
        completedAt: Date.now(),
      };

      const events: any[] = [];
      client.on('webhook_received', (e) => events.push(e));

      client.handleWebhook(payload, 'signature');

      expect(events).toHaveLength(1);
    });

    it('should handle invalid payload gracefully', () => {
      const result = client.handleWebhook(null, 'signature');
      expect(result).toBeNull();
    });
  });
});

describe('LLMEvaluator', () => {
  let evaluator: LLMEvaluator;
  const mockConfig: LLMEvaluationConfig = {
    provider: 'openai',
    model: 'gpt-4',
    apiKey: 'test-api-key',
    temperature: 0.3,
    maxTokens: 2048,
    systemPrompt: 'You are an expert evaluator',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    evaluator = new LLMEvaluator(mockConfig);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create evaluator with provided config', () => {
      expect(evaluator['config'].provider).toBe('openai');
      expect(evaluator['config'].model).toBe('gpt-4');
      expect(evaluator['config'].systemPrompt).toBe('You are an expert evaluator');
    });
  });

  describe('evaluateContent', () => {
    it('should evaluate content successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  score: 85,
                  feedback: ['Good structure', 'Clear writing'],
                  strengths: ['Well researched'],
                  improvements: ['Add more examples'],
                  analysis: 'Overall good content',
                }),
              },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      const result = await evaluator.evaluateContent({
        content: 'Test content',
        criteria: ['Accuracy', 'Clarity'],
        context: 'Evaluate this blog post',
      });

      expect(result.score).toBe(85);
      expect(result.feedback).toHaveLength(2);
      expect(result.analysis).toBe('Overall good content');
    });

    it('should include criteria in prompt', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  score: 80,
                  feedback: ['OK'],
                  strengths: [],
                  improvements: [],
                  analysis: 'Test',
                }),
              },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      await evaluator.evaluateContent({
        content: 'Test',
        criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'],
      });

      const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      const prompt = requestBody.messages[1].content;
      expect(prompt).toContain('1. Criterion 1');
      expect(prompt).toContain('2. Criterion 2');
      expect(prompt).toContain('3. Criterion 3');
    });

    it('should include context when provided', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  score: 80,
                  feedback: ['OK'],
                  strengths: [],
                  improvements: [],
                  analysis: 'Test',
                }),
              },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      await evaluator.evaluateContent({
        content: 'Test',
        criteria: ['Quality'],
        context: 'This is a technical blog post',
      });

      const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      const prompt = requestBody.messages[1].content;
      expect(prompt).toContain('Context: This is a technical blog post');
    });

    it('should throw on API error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(
        evaluator.evaluateContent({
          content: 'Test',
          criteria: ['Quality'],
        })
      ).rejects.toThrow('LLM API error: 500');
    });

    it('should fallback to text extraction on JSON parse error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Score: 75. The content is acceptable but could be improved.',
              },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      const result = await evaluator.evaluateContent({
        content: 'Test',
        criteria: ['Quality'],
      });

      expect(result.score).toBe(75);
    });

    it('should handle malformed response gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'No score here',
              },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      const result = await evaluator.evaluateContent({
        content: 'Test',
        criteria: ['Quality'],
      });

      expect(result.score).toBe(50); // Default fallback
    });
  });

  describe('endpoint selection', () => {
    it('should use OpenAI endpoint for openai provider', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"score":80,"feedback":[],"strengths":[],"improvements":[],"analysis":"test"}' } }],
        }),
      });

      await evaluator.evaluateContent({ content: 'Test', criteria: ['Quality'] });

      const url = (global.fetch as any).mock.calls[0][0];
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
    });

    it('should use Anthropic endpoint for anthropic provider', async () => {
      const anthropicEvaluator = new LLMEvaluator({
        ...mockConfig,
        provider: 'anthropic',
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"score":80,"feedback":[],"strengths":[],"improvements":[],"analysis":"test"}' } }],
        }),
      });

      await anthropicEvaluator.evaluateContent({ content: 'Test', criteria: ['Quality'] });

      const url = (global.fetch as any).mock.calls[0][0];
      expect(url).toBe('https://api.anthropic.com/v1/messages');
    });

    it('should use local endpoint for local provider', async () => {
      const localEvaluator = new LLMEvaluator({
        ...mockConfig,
        provider: 'local',
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"score":80,"feedback":[],"strengths":[],"improvements":[],"analysis":"test"}' } }],
        }),
      });

      await localEvaluator.evaluateContent({ content: 'Test', criteria: ['Quality'] });

      const url = (global.fetch as any).mock.calls[0][0];
      expect(url).toBe('http://localhost:11434/v1/chat/completions');
    });

    it('should throw for unknown provider', async () => {
      const unknownEvaluator = new LLMEvaluator({
        ...mockConfig,
        provider: 'unknown' as any,
      });

      await expect(
        unknownEvaluator.evaluateContent({ content: 'Test', criteria: ['Quality'] })
      ).rejects.toThrow('Unknown provider');
    });
  });

  describe('request structure', () => {
    it('should include system prompt when provided', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"score":80,"feedback":[],"strengths":[],"improvements":[],"analysis":"test"}' } }],
        }),
      });

      await evaluator.evaluateContent({ content: 'Test', criteria: ['Quality'] });

      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toBe('You are an expert evaluator');
    });

    it('should use correct temperature and max_tokens', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"score":80,"feedback":[],"strengths":[],"improvements":[],"analysis":"test"}' } }],
        }),
      });

      await evaluator.evaluateContent({ content: 'Test', criteria: ['Quality'] });

      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.temperature).toBe(0.3);
      expect(body.max_tokens).toBe(2048);
    });
  });
});

describe('ExternalEvaluatorRegistry', () => {
  let registry: ExternalEvaluatorRegistry;

  beforeEach(() => {
    registry = new ExternalEvaluatorRegistry();
  });

  describe('register', () => {
    it('should register external evaluator', () => {
      const client = new ExternalEvaluatorClient({
        id: 'eval-1',
        name: 'Evaluator 1',
        endpoint: 'https://api.eval.com',
        apiKey: 'key',
        supportedTypes: ['code'],
        timeoutMs: 5000,
        maxRetries: 3,
      });

      registry.register(client);

      expect(registry.list()).toHaveLength(1);
    });

    it('should register LLM evaluator', () => {
      const llm = new LLMEvaluator({
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'key',
        temperature: 0.3,
        maxTokens: 2048,
      });

      registry.registerLLM('llm-1', llm);

      expect(registry.listLLMs()).toHaveLength(1);
    });
  });

  describe('get', () => {
    it('should retrieve external evaluator by id', () => {
      const client = new ExternalEvaluatorClient({
        id: 'eval-1',
        name: 'Evaluator 1',
        endpoint: 'https://api.eval.com',
        apiKey: 'key',
        supportedTypes: ['code'],
        timeoutMs: 5000,
        maxRetries: 3,
      });

      registry.register(client);

      const retrieved = registry.get('eval-1');
      expect(retrieved).toBe(client);
    });

    it('should retrieve LLM evaluator by id', () => {
      const llm = new LLMEvaluator({
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'key',
        temperature: 0.3,
        maxTokens: 2048,
      });

      registry.registerLLM('llm-1', llm);

      const retrieved = registry.getLLM('llm-1');
      expect(retrieved).toBe(llm);
    });

    it('should return undefined for unknown id', () => {
      expect(registry.get('unknown')).toBeUndefined();
      expect(registry.getLLM('unknown')).toBeUndefined();
    });
  });

  describe('findForTask', () => {
    it('should find evaluator for task type', () => {
      const client = new ExternalEvaluatorClient({
        id: 'code-eval',
        name: 'Code Evaluator',
        endpoint: 'https://api.eval.com',
        apiKey: 'key',
        supportedTypes: ['code'],
        timeoutMs: 5000,
        maxRetries: 3,
      });

      registry.register(client);

      const task: EvaluationTask = {
        id: 'task-1',
        taskId: 'task-1',
        agentId: 'agent-1',
        type: 'code',
        submission: { type: 'inline', source: '', metadata: {} },
        criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
        createdAt: Date.now(),
        timeoutAt: Date.now() + 60000,
      };

      const found = registry.findForTask(task);
      expect(found).toBe(client);
    });

    it('should return undefined if no evaluator supports task', () => {
      const task: EvaluationTask = {
        id: 'task-1',
        taskId: 'task-1',
        agentId: 'agent-1',
        type: 'ui',
        submission: { type: 'inline', source: '', metadata: {} },
        criteria: { minScore: 70, rubric: { maxScore: 100, categories: [] }, requiredChecks: [] },
        budget: { maxCostUsd: 5, maxTimeSeconds: 60, maxMemoryMb: 1024, contextWindowSize: 64000 },
        createdAt: Date.now(),
        timeoutAt: Date.now() + 60000,
      };

      const found = registry.findForTask(task);
      expect(found).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should list all external evaluators', () => {
      registry.register(new ExternalEvaluatorClient({
        id: 'eval-1',
        name: 'Evaluator 1',
        endpoint: 'https://api.eval.com',
        apiKey: 'key',
        supportedTypes: ['code'],
        timeoutMs: 5000,
        maxRetries: 3,
      }));

      registry.register(new ExternalEvaluatorClient({
        id: 'eval-2',
        name: 'Evaluator 2',
        endpoint: 'https://api.eval2.com',
        apiKey: 'key2',
        supportedTypes: ['content'],
        timeoutMs: 5000,
        maxRetries: 3,
      }));

      expect(registry.list()).toHaveLength(2);
    });

    it('should list all LLM evaluators', () => {
      registry.registerLLM('llm-1', new LLMEvaluator({
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'key',
        temperature: 0.3,
        maxTokens: 2048,
      }));

      registry.registerLLM('llm-2', new LLMEvaluator({
        provider: 'anthropic',
        model: 'claude-3',
        apiKey: 'key2',
        temperature: 0.3,
        maxTokens: 2048,
      }));

      expect(registry.listLLMs()).toHaveLength(2);
    });
  });

  describe('cancelAll', () => {
    it('should return 0 when no evaluations pending', () => {
      const cancelled = registry.cancelAll();
      expect(cancelled).toBe(0);
    });
  });
});

describe('createExternalEvaluator', () => {
  it('should create external evaluator client', () => {
    const client = createExternalEvaluator({
      id: 'test',
      name: 'Test Evaluator',
      endpoint: 'https://api.test.com',
      apiKey: 'key',
      supportedTypes: ['code'],
      timeoutMs: 5000,
      maxRetries: 3,
    });

    expect(client).toBeInstanceOf(ExternalEvaluatorClient);
  });
});

describe('createLLMEvaluator', () => {
  it('should create LLM evaluator', () => {
    const evaluator = createLLMEvaluator({
      provider: 'openai',
      model: 'gpt-4',
      apiKey: 'key',
      temperature: 0.3,
      maxTokens: 2048,
    });

    expect(evaluator).toBeInstanceOf(LLMEvaluator);
  });
});
