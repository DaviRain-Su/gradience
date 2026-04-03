/**
 * Playwright Harness Tests
 *
 * @module evaluator/playwright-harness.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlaywrightHarness } from './playwright-harness.js';

describe('PlaywrightHarness', () => {
  let harness: PlaywrightHarness;

  beforeEach(() => {
    harness = new PlaywrightHarness({
      maxBrowsers: 2,
      browserType: 'chromium',
      headless: true,
    });
  });

  afterEach(async () => {
    await harness.shutdown();
  });

  describe('UI verification', () => {
    it('should verify UI with interactions', async () => {
      const result = await harness.verifyUI({
        url: 'https://example.com',
        viewport: { width: 1280, height: 720 },
        interactions: [
          { type: 'click', target: '#button' },
          { type: 'fill', target: '#input', value: 'test' },
          { type: 'wait', duration: 1000 },
        ],
        accessibilityCheck: true,
      });

      expect(result.score).toBeGreaterThan(0);
      expect(result.details.length).toBeGreaterThan(0);
      expect(result.details.some((d) => d.name === 'navigation')).toBe(true);
    });

    it('should verify responsive layouts', async () => {
      const result = await harness.verifyUI({
        url: 'https://example.com',
        viewport: { width: 1280, height: 720 },
        interactions: [],
        responsiveBreakpoints: [375, 768, 1024],
      });

      expect(result.details.some((d) => d.name.startsWith('responsive:'))).toBe(true);
    });
  });

  describe('API verification', () => {
    it('should verify API endpoints', async () => {
      const result = await harness.verifyAPI({
        baseUrl: 'https://api.example.com',
        endpoints: [
          {
            method: 'GET',
            path: '/health',
            expectedStatus: 200,
            maxResponseTimeMs: 1000,
          },
          {
            method: 'POST',
            path: '/users',
            expectedStatus: 201,
            body: { name: 'Test' },
            responseSchema: {
              type: 'object',
              required: ['id', 'name'],
            },
          },
        ],
      });

      expect(result.details).toHaveLength(2);
      expect(result.details[0].name).toBe('GET /health');
      expect(result.details[1].name).toBe('POST /users');
    });
  });

  describe('Code verification', () => {
    it('should verify code with tests', async () => {
      const result = await harness.verifyCode({
        repoPath: '/tmp/test-repo',
        testCommand: 'npm test',
        coverageThreshold: 80,
        lintCommand: 'npm run lint',
      });

      expect(result.details.some((d) => d.name === 'tests')).toBe(true);
      expect(result.details.some((d) => d.name === 'coverage')).toBe(true);
      expect(result.details.some((d) => d.name === 'lint')).toBe(true);
    });

    it('should include security check when configured', async () => {
      const result = await harness.verifyCode({
        repoPath: '/tmp/test-repo',
        testCommand: 'npm test',
        coverageThreshold: 80,
        securityCommand: 'npm audit',
      });

      expect(result.details.some((d) => d.name === 'security')).toBe(true);
    });
  });

  describe('scoring', () => {
    it('should calculate score from details', async () => {
      const result = await harness.verifyAPI({
        baseUrl: 'https://api.example.com',
        endpoints: [
          { method: 'GET', path: '/test1', expectedStatus: 200 },
          { method: 'GET', path: '/test2', expectedStatus: 200 },
        ],
      });

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should mark as passed above threshold', async () => {
      const result = await harness.verifyAPI({
        baseUrl: 'https://api.example.com',
        endpoints: [{ method: 'GET', path: '/health', expectedStatus: 200 }],
      });

      // Mock returns passing results
      expect(result.passed).toBe(true);
    });
  });
});
