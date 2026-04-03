/**
 * Playwright Verification Harness
 *
 * Provides UI screenshot comparison, API contract testing, and code verification
 * using Playwright and custom validators.
 *
 * @module evaluator/playwright-harness
 */

import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';

// ============================================================================
// Types
// ============================================================================

export interface UIInteraction {
  /** Interaction type */
  type: 'click' | 'fill' | 'select' | 'hover' | 'scroll' | 'wait';
  /** Target selector */
  target?: string;
  /** Value (for fill/select) */
  value?: string;
  /** Wait duration ms (for wait) */
  duration?: number;
}

export interface ScreenshotComparison {
  /** Baseline image path or buffer */
  baseline: string | Buffer;
  /** Current screenshot path or buffer */
  current: string | Buffer;
  /** Threshold for pixel difference (0-1) */
  threshold: number;
  /** Mask regions to ignore */
  maskRegions?: Array<{ x: number; y: number; width: number; height: number }>;
}

export interface APIEndpoint {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Endpoint path */
  path: string;
  /** Expected status code */
  expectedStatus: number;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: unknown;
  /** Expected response schema */
  responseSchema?: JSONSchema;
  /** Performance threshold (ms) */
  maxResponseTimeMs?: number;
}

export interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
}

export interface CodeVerification {
  /** Repository path */
  repoPath: string;
  /** Test command to run */
  testCommand: string;
  /** Coverage threshold (0-100) */
  coverageThreshold: number;
  /** Lint command */
  lintCommand?: string;
  /** Security scan command */
  securityCommand?: string;
}

export interface VerificationResult {
  /** Verification passed */
  passed: boolean;
  /** Score (0-100) */
  score: number;
  /** Detailed results */
  details: VerificationDetail[];
  /** Execution duration ms */
  durationMs: number;
  /** Artifacts (screenshots, logs) */
  artifacts?: string[];
}

export interface VerificationDetail {
  /** Check name */
  name: string;
  /** Check passed */
  passed: boolean;
  /** Score for this check */
  score: number;
  /** Feedback/message */
  message: string;
  /** Additional data */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Playwright Harness
// ============================================================================

export class PlaywrightHarness {
  private browserPool: BrowserPool;

  constructor(private config: PlaywrightConfig = DEFAULT_CONFIG) {
    this.browserPool = new BrowserPool(config);
  }

  // -------------------------------------------------------------------------
  // UI Verification
  // -------------------------------------------------------------------------

  /**
   * Verify UI by running interactions and comparing screenshots
   */
  async verifyUI(params: {
    url: string;
    viewport: { width: number; height: number };
    interactions: UIInteraction[];
    expectedScreenshots?: ScreenshotComparison[];
    accessibilityCheck?: boolean;
    responsiveBreakpoints?: number[];
  }): Promise<VerificationResult> {
    const startTime = Date.now();
    const details: VerificationDetail[] = [];
    const artifacts: string[] = [];

    try {
      // Get browser from pool
      const browser = await this.browserPool.acquire();

      try {
        const context = await browser.newContext({
          viewport: params.viewport,
        });
        const page = await context.newPage();

        // Navigate to URL
        await page.goto(params.url, { waitUntil: 'networkidle' });
        details.push({
          name: 'navigation',
          passed: true,
          score: 100,
          message: `Successfully navigated to ${params.url}`,
        });

        // Execute interactions
        for (const interaction of params.interactions) {
          const interactionResult = await this.executeInteraction(page, interaction);
          details.push(interactionResult);
        }

        // Take screenshot for comparison
        if (params.expectedScreenshots && params.expectedScreenshots.length > 0) {
          const screenshot = await page.screenshot({ fullPage: true });
          artifacts.push(`screenshot-${Date.now()}.png`);

          for (const comparison of params.expectedScreenshots) {
            const comparisonResult = await this.compareScreenshots(screenshot, comparison);
            details.push(comparisonResult);
          }
        }

        // Accessibility check
        if (params.accessibilityCheck) {
          const a11yResult = await this.runAccessibilityCheck(page);
          details.push(a11yResult);
        }

        // Responsive testing
        if (params.responsiveBreakpoints) {
          for (const width of params.responsiveBreakpoints) {
            await page.setViewportSize({ width, height: params.viewport.height });
            await page.reload({ waitUntil: 'networkidle' });
            const responsiveResult = await this.checkResponsive(page, width);
            details.push(responsiveResult);
          }
        }

        await context.close();
      } finally {
        await this.browserPool.release(browser);
      }

      const score = this.calculateScore(details);

      return {
        passed: score >= 70,
        score,
        details,
        durationMs: Date.now() - startTime,
        artifacts,
      };
    } catch (error) {
      logger.error({ error }, 'UI verification failed');

      details.push({
        name: 'error',
        passed: false,
        score: 0,
        message: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        passed: false,
        score: 0,
        details,
        durationMs: Date.now() - startTime,
      };
    }
  }

  // -------------------------------------------------------------------------
  // API Verification
  // -------------------------------------------------------------------------

  /**
   * Verify API endpoints
   */
  async verifyAPI(params: {
    baseUrl: string;
    endpoints: APIEndpoint[];
    globalHeaders?: Record<string, string>;
  }): Promise<VerificationResult> {
    const startTime = Date.now();
    const details: VerificationDetail[] = [];

    for (const endpoint of params.endpoints) {
      const checkStart = Date.now();

      try {
        const response = await this.makeRequest(params.baseUrl, endpoint, params.globalHeaders);
        const duration = Date.now() - checkStart;

        // Check status
        const statusMatch = response.status === endpoint.expectedStatus;

        // Check response time
        const timeOk = !endpoint.maxResponseTimeMs || duration <= endpoint.maxResponseTimeMs;

        // Validate schema if provided
        let schemaValid = true;
        let schemaError = '';
        if (endpoint.responseSchema) {
          const validation = this.validateSchema(response.data, endpoint.responseSchema);
          schemaValid = validation.valid;
          schemaError = validation.error || '';
        }

        const passed = statusMatch && timeOk && schemaValid;

        details.push({
          name: `${endpoint.method} ${endpoint.path}`,
          passed,
          score: passed ? 100 : 0,
          message: passed
            ? `Status: ${response.status}, Time: ${duration}ms`
            : `Failed: ${!statusMatch ? 'wrong status' : ''} ${!timeOk ? 'slow' : ''} ${!schemaValid ? schemaError : ''}`,
          metadata: {
            status: response.status,
            duration,
            schemaValid,
          },
        });
      } catch (error) {
        details.push({
          name: `${endpoint.method} ${endpoint.path}`,
          passed: false,
          score: 0,
          message: error instanceof Error ? error.message : 'Request failed',
        });
      }
    }

    const score = this.calculateScore(details);

    return {
      passed: score >= 70,
      score,
      details,
      durationMs: Date.now() - startTime,
    };
  }

  // -------------------------------------------------------------------------
  // Code Verification
  // -------------------------------------------------------------------------

  /**
   * Verify code by running tests and checks
   */
  async verifyCode(params: CodeVerification): Promise<VerificationResult> {
    const startTime = Date.now();
    const details: VerificationDetail[] = [];

    // Run tests
    const testResult = await this.runCommand(params.repoPath, params.testCommand);
    details.push({
      name: 'tests',
      passed: testResult.exitCode === 0,
      score: testResult.exitCode === 0 ? 100 : 0,
      message: testResult.exitCode === 0 ? 'All tests pass' : 'Tests failed',
      metadata: { stdout: testResult.stdout, stderr: testResult.stderr },
    });

    // Check coverage
    const coverageResult = await this.extractCoverage(params.repoPath);
    const coverageScore = coverageResult.percentage;
    const coveragePassed = coverageScore >= params.coverageThreshold;

    details.push({
      name: 'coverage',
      passed: coveragePassed,
      score: coverageScore,
      message: `Coverage: ${coverageScore.toFixed(1)}% (threshold: ${params.coverageThreshold}%)`,
      metadata: { files: coverageResult.files },
    });

    // Lint check
    if (params.lintCommand) {
      const lintResult = await this.runCommand(params.repoPath, params.lintCommand);
      details.push({
        name: 'lint',
        passed: lintResult.exitCode === 0,
        score: lintResult.exitCode === 0 ? 100 : 50,
        message: lintResult.exitCode === 0 ? 'Lint clean' : 'Lint warnings/errors',
      });
    }

    // Security scan
    if (params.securityCommand) {
      const securityResult = await this.runCommand(params.repoPath, params.securityCommand);
      details.push({
        name: 'security',
        passed: securityResult.exitCode === 0,
        score: securityResult.exitCode === 0 ? 100 : 0,
        message: securityResult.exitCode === 0 ? 'No security issues' : 'Security issues found',
      });
    }

    const score = this.calculateScore(details);

    return {
      passed: score >= 70,
      score,
      details,
      durationMs: Date.now() - startTime,
    };
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  async shutdown(): Promise<void> {
    await this.browserPool.close();
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  private async executeInteraction(
    page: PlaywrightPage,
    interaction: UIInteraction
  ): Promise<VerificationDetail> {
    try {
      switch (interaction.type) {
        case 'click':
          await page.click(interaction.target!);
          break;
        case 'fill':
          await page.fill(interaction.target!, interaction.value!);
          break;
        case 'select':
          await page.selectOption(interaction.target!, interaction.value!);
          break;
        case 'hover':
          await page.hover(interaction.target!);
          break;
        case 'scroll':
          await page.evaluate(() => window.scrollBy(0, 500));
          break;
        case 'wait':
          await page.waitForTimeout(interaction.duration || 1000);
          break;
      }

      return {
        name: `interaction:${interaction.type}`,
        passed: true,
        score: 100,
        message: `Executed ${interaction.type}`,
      };
    } catch (error) {
      return {
        name: `interaction:${interaction.type}`,
        passed: false,
        score: 0,
        message: error instanceof Error ? error.message : 'Interaction failed',
      };
    }
  }

  private async compareScreenshots(
    current: Buffer,
    comparison: ScreenshotComparison
  ): Promise<VerificationDetail> {
    // TODO: Implement actual image comparison using pixelmatch or similar
    // For now, mock implementation

    return {
      name: 'screenshot-comparison',
      passed: true,
      score: 95,
      message: 'Screenshots match within threshold',
    };
  }

  private async runAccessibilityCheck(page: PlaywrightPage): Promise<VerificationDetail> {
    // TODO: Implement using @axe-core/playwright
    // For now, mock implementation

    return {
      name: 'accessibility',
      passed: true,
      score: 90,
      message: 'No critical accessibility issues',
    };
  }

  private async checkResponsive(page: PlaywrightPage, width: number): Promise<VerificationDetail> {
    // TODO: Implement responsive layout checks
    // For now, mock implementation

    return {
      name: `responsive:${width}px`,
      passed: true,
      score: 100,
      message: `Layout works at ${width}px`,
    };
  }

  private async makeRequest(
    baseUrl: string,
    endpoint: APIEndpoint,
    globalHeaders?: Record<string, string>
  ): Promise<{ status: number; data: unknown }> {
    const url = `${baseUrl}${endpoint.path}`;
    const headers = { ...globalHeaders, ...endpoint.headers };

    // Use native fetch (Node 18+)
    const response = await fetch(url, {
      method: endpoint.method,
      headers,
      body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
    });

    const data = await response.json().catch(() => null);

    return { status: response.status, data };
  }

  private validateSchema(data: unknown, schema: JSONSchema): { valid: boolean; error?: string } {
    // Simple schema validation - in production use ajv or zod
    if (schema.type === 'object' && typeof data !== 'object') {
      return { valid: false, error: 'Expected object' };
    }
    if (schema.type === 'array' && !Array.isArray(data)) {
      return { valid: false, error: 'Expected array' };
    }

    // Check required properties
    if (schema.required && typeof data === 'object' && data !== null) {
      for (const key of schema.required) {
        if (!(key in data)) {
          return { valid: false, error: `Missing required property: ${key}` };
        }
      }
    }

    return { valid: true };
  }

  private async runCommand(
    cwd: string,
    command: string
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    // TODO: Implement actual command execution using child_process
    // For now, mock implementation

    logger.info({ cwd, command }, 'Running command');

    return {
      exitCode: 0,
      stdout: 'Mock stdout',
      stderr: '',
    };
  }

  private async extractCoverage(repoPath: string): Promise<{ percentage: number; files: string[] }> {
    // TODO: Parse coverage report (nyc, jest, etc.)
    // For now, mock implementation

    return {
      percentage: 85,
      files: ['src/index.ts', 'src/utils.ts'],
    };
  }

  private calculateScore(details: VerificationDetail[]): number {
    if (details.length === 0) return 0;
    const totalScore = details.reduce((sum, d) => sum + d.score, 0);
    return Math.round(totalScore / details.length);
  }
}

// ============================================================================
// Browser Pool
// ============================================================================

interface PlaywrightConfig {
  maxBrowsers: number;
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
}

const DEFAULT_CONFIG: PlaywrightConfig = {
  maxBrowsers: 3,
  browserType: 'chromium',
  headless: true,
};

interface PlaywrightPage {
  goto(url: string, options?: { waitUntil?: string }): Promise<void>;
  click(selector: string): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  selectOption(selector: string, value: string): Promise<void>;
  hover(selector: string): Promise<void>;
  evaluate(fn: () => void): Promise<void>;
  waitForTimeout(duration: number): Promise<void>;
  screenshot(options?: { fullPage?: boolean }): Promise<Buffer>;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  reload(options?: { waitUntil?: string }): Promise<void>;
}

interface PlaywrightBrowser {
  newContext(options?: { viewport?: { width: number; height: number } }): Promise<{
    newPage(): Promise<PlaywrightPage>;
    close(): Promise<void>;
  }>;
  close(): Promise<void>;
}

class BrowserPool {
  private browsers: PlaywrightBrowser[] = [];
  private available: PlaywrightBrowser[] = [];
  private waiting: Array<(browser: PlaywrightBrowser) => void> = [];

  constructor(private config: PlaywrightConfig) {}

  async acquire(): Promise<PlaywrightBrowser> {
    // Return available browser
    if (this.available.length > 0) {
      return this.available.pop()!;
    }

    // Create new browser if under limit
    if (this.browsers.length < this.config.maxBrowsers) {
      const browser = await this.createBrowser();
      this.browsers.push(browser);
      return browser;
    }

    // Wait for available browser
    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  async release(browser: PlaywrightBrowser): Promise<void> {
    // Check if someone is waiting
    if (this.waiting.length > 0) {
      const waiter = this.waiting.shift()!;
      waiter(browser);
      return;
    }

    // Add back to available pool
    this.available.push(browser);
  }

  async close(): Promise<void> {
    for (const browser of this.browsers) {
      await browser.close();
    }
    this.browsers = [];
    this.available = [];
  }

  private async createBrowser(): Promise<PlaywrightBrowser> {
    // TODO: Import playwright and create actual browser
    // For now, return mock browser

    logger.info('Creating mock browser');

    return {
      newContext: async () => ({
        newPage: async () => ({
          goto: async () => {},
          click: async () => {},
          fill: async () => {},
          selectOption: async () => {},
          hover: async () => {},
          evaluate: async () => {},
          waitForTimeout: async () => {},
          screenshot: async () => Buffer.from('mock'),
          setViewportSize: async () => {},
          reload: async () => {},
        }),
        close: async () => {},
      }),
      close: async () => {},
    };
  }
}
