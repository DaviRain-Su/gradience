/**
 * Tests for unified LLM configuration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  type LLMConfig,
  type LLMProvider,
  LLM_DEFAULT_BASE_URLS,
  LLM_DEFAULT_MODELS,
  LLM_API_KEY_ENV,
  buildLLMConfig,
  getLLMApiKey,
  isLLMConfigured,
  detectProviderFromApiKey,
  validateLLMConfig,
  createLLMHeaders,
} from './llm-config.js';

describe('LLM Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    delete process.env.LLM_PROVIDER;
    delete process.env.LLM_MODEL;
    delete process.env.LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.MOONSHOT_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Constants', () => {
    it('should have default base URLs for all providers', () => {
      expect(LLM_DEFAULT_BASE_URLS.openai).toBe('https://api.openai.com/v1');
      expect(LLM_DEFAULT_BASE_URLS.claude).toBe('https://api.anthropic.com/v1');
      expect(LLM_DEFAULT_BASE_URLS.moonshot).toBe('https://api.moonshot.cn/v1');
    });

    it('should have default models for all providers', () => {
      expect(LLM_DEFAULT_MODELS.openai).toBe('gpt-4');
      expect(LLM_DEFAULT_MODELS.claude).toBe('claude-3-sonnet-20240229');
      expect(LLM_DEFAULT_MODELS.moonshot).toBe('moonshot-v1-8k');
    });

    it('should have environment variable names for all providers', () => {
      expect(LLM_API_KEY_ENV.openai).toBe('OPENAI_API_KEY');
      expect(LLM_API_KEY_ENV.claude).toBe('ANTHROPIC_API_KEY');
      expect(LLM_API_KEY_ENV.moonshot).toBe('MOONSHOT_API_KEY');
    });
  });

  describe('buildLLMConfig', () => {
    it('should build config with defaults when no env vars set', () => {
      const config = buildLLMConfig();

      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4');
      expect(config.apiKey).toBe('');
      expect(config.baseUrl).toBe('https://api.openai.com/v1');
      expect(config.temperature).toBe(0.3);
      expect(config.maxTokens).toBe(2048);
      expect(config.timeout).toBe(60000);
    });

    it('should use LLM_* environment variables', () => {
      process.env.LLM_PROVIDER = 'claude';
      process.env.LLM_MODEL = 'claude-3-opus';
      process.env.LLM_API_KEY = 'test-api-key';

      const config = buildLLMConfig();

      expect(config.provider).toBe('claude');
      expect(config.model).toBe('claude-3-opus');
      expect(config.apiKey).toBe('test-api-key');
    });

    it('should override environment with explicit config', () => {
      process.env.LLM_PROVIDER = 'openai';
      process.env.LLM_MODEL = 'gpt-4';

      const config = buildLLMConfig({
        provider: 'moonshot',
        model: 'moonshot-v1-32k',
      });

      expect(config.provider).toBe('moonshot');
      expect(config.model).toBe('moonshot-v1-32k');
    });
  });

  describe('detectProviderFromApiKey', () => {
    it('should detect moonshot from api key prefix', () => {
      expect(detectProviderFromApiKey('moonshot-test-key')).toBe('moonshot');
    });

    it('should detect claude from api key prefix', () => {
      expect(detectProviderFromApiKey('ant-test-key')).toBe('claude');
      expect(detectProviderFromApiKey('sk-ant-test-key')).toBe('claude');
    });

    it('should default to openai for other prefixes', () => {
      expect(detectProviderFromApiKey('sk-test-key')).toBe('openai');
      expect(detectProviderFromApiKey('any-other-key')).toBe('openai');
    });
  });

  describe('isLLMConfigured', () => {
    it('should return false when no api key is set', () => {
      expect(isLLMConfigured()).toBe(false);
    });

    it('should return true when LLM_API_KEY is set', () => {
      process.env.LLM_API_KEY = 'test-key';
      expect(isLLMConfigured()).toBe(true);
    });

    it('should return true when provider-specific key is set', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      expect(isLLMConfigured()).toBe(true);
    });

    it('should return true when config with apiKey is provided', () => {
      const config: LLMConfig = {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'test-key',
        temperature: 0.3,
        maxTokens: 2048,
        timeout: 60000,
      };
      expect(isLLMConfigured(config)).toBe(true);
    });
  });

  describe('validateLLMConfig', () => {
    it('should return valid for complete config', () => {
      const config: LLMConfig = {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'test-key',
        temperature: 0.3,
        maxTokens: 2048,
        timeout: 60000,
      };

      const result = validateLLMConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing required fields', () => {
      const config = {
        provider: undefined as unknown as LLMProvider,
        model: '',
        apiKey: '',
        temperature: 0.3,
        maxTokens: 2048,
        timeout: 60000,
      };

      const result = validateLLMConfig(config as LLMConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('createLLMHeaders', () => {
    it('should create headers with authorization', () => {
      const config: LLMConfig = {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'test-key',
        temperature: 0.3,
        maxTokens: 2048,
        timeout: 60000,
      };

      const headers = createLLMHeaders(config);
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Authorization']).toBe('Bearer test-key');
    });
  });
});
