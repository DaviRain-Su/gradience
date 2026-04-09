/**
 * Spec Generator 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSpec, generateSpecStream, generateCacheKey } from '@/lib/ai/spec-generator';

describe('Spec Generator', () => {
    describe('generateCacheKey', () => {
        it('应该生成一致的缓存键', () => {
            const key1 = generateCacheKey('test prompt', 'agent-config');
            const key2 = generateCacheKey('test prompt', 'agent-config');
            expect(key1).toBe(key2);
        });

        it('应该对大小写不敏感', () => {
            const key1 = generateCacheKey('Test Prompt', 'agent-config');
            const key2 = generateCacheKey('test prompt', 'agent-config');
            expect(key1).toBe(key2);
        });

        it('应该对空格敏感', () => {
            const key1 = generateCacheKey('test prompt', 'agent-config');
            const key2 = generateCacheKey('test  prompt', 'agent-config');
            expect(key1).not.toBe(key2);
        });
    });

    describe('generateSpec', () => {
        it('应该抛出错误当没有 API key', async () => {
            // 确保环境变量未设置
            const originalKey = process.env.OPENAI_API_KEY;
            delete process.env.OPENAI_API_KEY;
            const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
            delete process.env.ANTHROPIC_API_KEY;

            await expect(
                generateSpec({
                    prompt: 'test',
                    context: { type: 'agent-config' },
                }),
            ).rejects.toThrow('No AI API key configured');

            // 恢复环境变量
            if (originalKey) process.env.OPENAI_API_KEY = originalKey;
            if (originalAnthropicKey) process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
        });
    });

    describe('generateSpecStream', () => {
        it('应该返回错误当没有 API key', async () => {
            const originalKey = process.env.OPENAI_API_KEY;
            delete process.env.OPENAI_API_KEY;

            const generator = generateSpecStream({
                prompt: 'test',
                context: { type: 'agent-config' },
            });

            const results = [];
            for await (const result of generator) {
                results.push(result);
            }

            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({
                type: 'error',
                error: 'OpenAI API key not configured',
            });

            if (originalKey) process.env.OPENAI_API_KEY = originalKey;
        });
    });
});
