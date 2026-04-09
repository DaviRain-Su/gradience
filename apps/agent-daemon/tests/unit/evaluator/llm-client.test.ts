/**
 * LLM Client Tests
 *
 * @module evaluator/llm-client.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    LLMClient,
    getLLMClient,
    isLLMAvailable,
    createLLMClient,
    createLLMClientFromConfig,
    type LLMConfig,
    type ChatRequest,
} from '../../../src/evaluator/llm-client.js';

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('LLMClient', () => {
    let client: LLMClient;
    const defaultConfig: LLMConfig = {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'test-api-key',
        model: 'gpt-4',
        temperature: 0.3,
        maxTokens: 2048,
        timeout: 60000,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        client = new LLMClient(defaultConfig);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('constructor', () => {
        it('should create client with default values', () => {
            const minimalConfig: LLMConfig = {
                baseUrl: 'https://api.test.com/v1',
                apiKey: 'key',
                model: 'test-model',
            };
            const c = new LLMClient(minimalConfig);

            expect(c['config'].temperature).toBe(0.3);
            expect(c['config'].maxTokens).toBe(2048);
            expect(c['config'].timeout).toBe(60000);
        });

        it('should use provided config values', () => {
            expect(client['config'].baseUrl).toBe('https://api.openai.com/v1');
            expect(client['config'].apiKey).toBe('test-api-key');
            expect(client['config'].model).toBe('gpt-4');
        });
    });

    describe('isConfigured', () => {
        it('should return true when apiKey and baseUrl are set', () => {
            expect(client.isConfigured()).toBe(true);
        });

        it('should return false when apiKey is missing', () => {
            const c = new LLMClient({ baseUrl: 'https://api.test.com', apiKey: '', model: 'test' });
            expect(c.isConfigured()).toBe(false);
        });

        it('should return false when baseUrl is missing', () => {
            const c = new LLMClient({ baseUrl: '', apiKey: 'key', model: 'test' });
            expect(c.isConfigured()).toBe(false);
        });
    });

    describe('initialize', () => {
        it('should return false when not configured', async () => {
            const c = new LLMClient({ baseUrl: '', apiKey: '', model: 'test' });
            const result = await c.initialize();
            expect(result).toBe(false);
        });

        it('should return true on successful initialization', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'Hello' }, finish_reason: 'stop' }],
                    model: 'gpt-4',
                    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                }),
            });

            const result = await client.initialize();
            expect(result).toBe(true);
        });

        it('should return false on initialization failure', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

            const result = await client.initialize();
            expect(result).toBe(false);
        });
    });

    describe('chat', () => {
        it('should send chat request with correct parameters', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'Test response' }, finish_reason: 'stop' }],
                    model: 'gpt-4',
                    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                }),
            });

            const request: ChatRequest = {
                messages: [
                    { role: 'system', content: 'You are a test' },
                    { role: 'user', content: 'Hello' },
                ],
            };

            const response = await client.chat(request);

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.openai.com/v1/chat/completions',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-api-key',
                    }),
                    body: expect.stringContaining('"model":"gpt-4"'),
                }),
            );

            expect(response.content).toBe('Test response');
            expect(response.model).toBe('gpt-4');
            expect(response.usage.totalTokens).toBe(15);
        });

        it('should use custom parameters when provided', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: '' }, finish_reason: 'stop' }],
                    model: 'custom-model',
                    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                }),
            });

            await client.chat({
                messages: [{ role: 'user', content: 'Test' }],
                model: 'custom-model',
                temperature: 0.5,
                maxTokens: 100,
            });

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.model).toBe('custom-model');
            expect(body.temperature).toBe(0.5);
            expect(body.max_tokens).toBe(100);
        });

        it('should throw error on API failure', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                text: async () => 'Unauthorized',
            });

            await expect(client.chat({ messages: [{ role: 'user', content: 'Test' }] })).rejects.toThrow(
                'LLM API error 401',
            );
        });

        it('should throw error on timeout', async () => {
            mockFetch.mockImplementationOnce(
                () =>
                    new Promise((_, reject) => {
                        const error = new Error('Timeout');
                        (error as any).name = 'AbortError';
                        reject(error);
                    }),
            );

            await expect(client.chat({ messages: [{ role: 'user', content: 'Test' }] })).rejects.toThrow('timeout');
        });

        it('should include response_format for JSON requests', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: '{}' }, finish_reason: 'stop' }],
                    model: 'gpt-4',
                    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                }),
            });

            await client.chat({
                messages: [{ role: 'user', content: 'Test' }],
                responseFormat: 'json',
            });

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.response_format).toEqual({ type: 'json_object' });
        });
    });

    describe('evaluate', () => {
        it('should send evaluation prompt and parse response', async () => {
            const mockResponse = {
                scores: [{ category: 'Quality', score: 85, feedback: 'Good quality' }],
                overallScore: 85,
                passed: true,
                summary: 'Good submission',
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [
                        {
                            message: { content: JSON.stringify(mockResponse) },
                            finish_reason: 'stop',
                        },
                    ],
                    model: 'gpt-4',
                    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
                }),
            });

            const result = await client.evaluate({
                taskType: 'Code',
                taskDescription: 'Write a function',
                submissionContent: 'function test() {}',
                criteria: ['Correctness', 'Quality'],
                outputFormat: 'full',
            });

            expect(result.scores).toHaveLength(1);
            expect(result.overallScore).toBe(85);
            expect(result.passed).toBe(true);
            expect(result.summary).toBe('Good submission');
        });

        it('should handle JSON parsing errors gracefully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [
                        {
                            message: { content: 'Invalid JSON' },
                            finish_reason: 'stop',
                        },
                    ],
                    model: 'gpt-4',
                    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
                }),
            });

            await expect(
                client.evaluate({
                    taskType: 'Code',
                    taskDescription: 'Write a function',
                    submissionContent: 'function test() {}',
                    criteria: ['Correctness'],
                    outputFormat: 'full',
                }),
            ).rejects.toThrow('Failed to parse LLM evaluation response');
        });

        it('should clamp scores to 0-100 range', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [
                        {
                            message: {
                                content: JSON.stringify({
                                    scores: [
                                        { category: 'Test', score: 150, feedback: 'Too high' },
                                        { category: 'Test2', score: -10, feedback: 'Too low' },
                                    ],
                                    overallScore: 200,
                                    passed: true,
                                    summary: 'Test',
                                }),
                            },
                            finish_reason: 'stop',
                        },
                    ],
                    model: 'gpt-4',
                    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                }),
            });

            const result = await client.evaluate({
                taskType: 'Code',
                taskDescription: 'Test',
                submissionContent: 'test',
                criteria: ['Test'],
                outputFormat: 'full',
            });

            expect(result.scores[0].score).toBe(100);
            expect(result.scores[1].score).toBe(0);
            expect(result.overallScore).toBe(100);
        });
    });

    describe('evaluateCode', () => {
        it('should call evaluate with code-specific criteria', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [
                        {
                            message: {
                                content: JSON.stringify({
                                    scores: [
                                        { category: 'Functionality', score: 90, feedback: 'Works' },
                                        { category: 'Code Quality', score: 85, feedback: 'Clean' },
                                    ],
                                    overallScore: 87,
                                    passed: true,
                                    summary: 'Good code',
                                }),
                            },
                            finish_reason: 'stop',
                        },
                    ],
                    model: 'gpt-4',
                    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                }),
            });

            const result = await client.evaluateCode('function test() {}', 'Write a test function');

            expect(result.scores.length).toBeGreaterThan(0);
            expect(mockFetch).toHaveBeenCalled();
        });

        it('should truncate long code submissions', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [
                        {
                            message: {
                                content: JSON.stringify({
                                    scores: [{ category: 'Test', score: 80, feedback: 'OK' }],
                                    overallScore: 80,
                                    passed: true,
                                    summary: 'Test',
                                }),
                            },
                            finish_reason: 'stop',
                        },
                    ],
                    model: 'gpt-4',
                    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                }),
            });

            const longCode = 'x'.repeat(20000);
            await client.evaluateCode(longCode, 'Test');

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.messages[1].content.length).toBeLessThanOrEqual(15000); // Should be truncated
        });
    });

    describe('evaluateContent', () => {
        it('should call evaluate with content-specific criteria', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [
                        {
                            message: {
                                content: JSON.stringify({
                                    scores: [
                                        { category: 'Accuracy', score: 90, feedback: 'Accurate' },
                                        { category: 'Clarity', score: 85, feedback: 'Clear' },
                                    ],
                                    overallScore: 87,
                                    passed: true,
                                    summary: 'Good content',
                                }),
                            },
                            finish_reason: 'stop',
                        },
                    ],
                    model: 'gpt-4',
                    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                }),
            });

            const result = await client.evaluateContent('This is test content', 'Write about testing');

            expect(result.scores.some((s) => s.category === 'Accuracy')).toBe(true);
            expect(result.scores.some((s) => s.category === 'Clarity')).toBe(true);
        });
    });

    describe('evaluateAPI', () => {
        it('should call evaluate with API-specific criteria', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [
                        {
                            message: {
                                content: JSON.stringify({
                                    scores: [
                                        { category: 'Correctness', score: 95, feedback: 'Correct' },
                                        { category: 'Performance', score: 80, feedback: 'Fast' },
                                    ],
                                    overallScore: 87,
                                    passed: true,
                                    summary: 'Good API',
                                }),
                            },
                            finish_reason: 'stop',
                        },
                    ],
                    model: 'gpt-4',
                    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                }),
            });

            const result = await client.evaluateAPI('API spec', 'Test results');

            expect(result.scores.some((s) => s.category === 'Correctness')).toBe(true);
            expect(result.scores.some((s) => s.category === 'Performance')).toBe(true);
        });
    });
});

describe('getLLMClient', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        delete process.env.LLM_API_KEY;
        delete process.env.LLM_BASE_URL;
        delete process.env.LLM_MODEL;
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return null when no config provided and no env vars set', () => {
        const client = getLLMClient();
        expect(client).toBeNull();
    });

    it('should create client from unified config', () => {
        const client = getLLMClient({
            provider: 'openai',
            apiKey: 'test-key',
            model: 'gpt-4',
            baseUrl: 'https://api.openai.com/v1',
            temperature: 0.5,
            maxTokens: 1000,
            timeout: 30000,
        });

        expect(client).toBeDefined();
        expect(client?.isConfigured()).toBe(true);
    });

    it('should return cached client on subsequent calls', () => {
        const config = {
            provider: 'openai' as const,
            apiKey: 'test-key',
            model: 'gpt-4',
            temperature: 0.3,
            maxTokens: 2048,
            timeout: 60000,
        };

        const client1 = getLLMClient(config);
        const client2 = getLLMClient(config);

        expect(client1).toBe(client2);
    });
});

describe('isLLMAvailable', () => {
    beforeEach(() => {
        delete process.env.LLM_API_KEY;
        delete process.env.OPENAI_API_KEY;
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.MOONSHOT_API_KEY;
    });

    it('should return true when config has apiKey', () => {
        const result = isLLMAvailable({
            provider: 'openai',
            apiKey: 'test-key',
            model: 'gpt-4',
            temperature: 0.3,
            maxTokens: 2048,
            timeout: 60000,
        });
        expect(result).toBe(true);
    });

    it('should return false when config has no apiKey', () => {
        const result = isLLMAvailable({
            provider: 'openai',
            apiKey: '',
            model: 'gpt-4',
            temperature: 0.3,
            maxTokens: 2048,
            timeout: 60000,
        });
        expect(result).toBe(false);
    });

    it('should return true when LLM_API_KEY env var is set', () => {
        process.env.LLM_API_KEY = 'test-key';
        expect(isLLMAvailable()).toBe(true);
    });

    it('should return true when OPENAI_API_KEY env var is set', () => {
        process.env.OPENAI_API_KEY = 'test-key';
        expect(isLLMAvailable()).toBe(true);
    });

    it('should return false when no API keys are set', () => {
        expect(isLLMAvailable()).toBe(false);
    });
});

describe('createLLMClient', () => {
    beforeEach(() => {
        delete process.env.LLM_API_KEY;
        delete process.env.LLM_BASE_URL;
        delete process.env.LLM_MODEL;
    });

    it('should create client with provided config', () => {
        const client = createLLMClient({
            baseUrl: 'https://custom.api.com',
            apiKey: 'custom-key',
            model: 'custom-model',
        });

        expect(client.isConfigured()).toBe(true);
        expect(client['config'].baseUrl).toBe('https://custom.api.com');
    });

    it('should fall back to environment variables', () => {
        process.env.LLM_API_KEY = 'env-key';
        process.env.LLM_BASE_URL = 'https://env.api.com';
        process.env.LLM_MODEL = 'env-model';

        const client = createLLMClient({});

        expect(client['config'].apiKey).toBe('env-key');
        expect(client['config'].baseUrl).toBe('https://env.api.com');
        expect(client['config'].model).toBe('env-model');
    });

    it('should use defaults when nothing provided', () => {
        const client = createLLMClient({});

        expect(client['config'].baseUrl).toBe('https://api.openai.com/v1');
        expect(client['config'].model).toBe('gpt-4');
    });
});

describe('createLLMClientFromConfig', () => {
    it('should create client from unified config', () => {
        const client = createLLMClientFromConfig({
            provider: 'moonshot',
            apiKey: 'moonshot-key',
            model: 'moonshot-v1-8k',
            temperature: 0.3,
            maxTokens: 2048,
            timeout: 60000,
        });

        expect(client.isConfigured()).toBe(true);
        expect(client['config'].baseUrl).toBe('https://api.moonshot.cn/v1');
    });

    it('should use provided baseUrl over detected', () => {
        const client = createLLMClientFromConfig({
            provider: 'openai',
            apiKey: 'key',
            model: 'gpt-4',
            baseUrl: 'https://custom.openai.com/v1',
            temperature: 0.3,
            maxTokens: 2048,
            timeout: 60000,
        });

        expect(client['config'].baseUrl).toBe('https://custom.openai.com/v1');
    });
});
