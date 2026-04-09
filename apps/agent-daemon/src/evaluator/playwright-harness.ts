/**
 * Playwright Verification Harness
 *
 * Provides UI screenshot comparison, API contract testing, and code verification
 * using Playwright and custom validators.
 *
 * @module evaluator/playwright-harness
 */

import { chromium, firefox, webkit, type Browser, type BrowserContext, type Page } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

export interface UIInteraction {
    type: 'click' | 'fill' | 'select' | 'hover' | 'scroll' | 'wait' | 'press' | 'focus';
    target?: string;
    value?: string;
    key?: string;
    duration?: number;
    options?: { force?: boolean; timeout?: number };
}

export interface ScreenshotComparison {
    baseline: string | Buffer;
    current: string | Buffer;
    threshold: number;
    maskRegions?: Array<{ x: number; y: number; width: number; height: number }>;
}

export interface APIEndpoint {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path: string;
    expectedStatus: number;
    headers?: Record<string, string>;
    body?: unknown;
    responseSchema?: JSONSchema;
    maxResponseTimeMs?: number;
}

export interface JSONSchema {
    type: 'object' | 'array' | 'string' | 'number' | 'boolean';
    properties?: Record<string, JSONSchema>;
    required?: string[];
    items?: JSONSchema;
}

export interface CodeVerification {
    repoPath: string;
    testCommand: string;
    coverageThreshold: number;
    lintCommand?: string;
    securityCommand?: string;
}

export interface VerificationResult {
    passed: boolean;
    score: number;
    details: VerificationDetail[];
    durationMs: number;
    artifacts?: string[];
}

export interface VerificationDetail {
    name: string;
    passed: boolean;
    score: number;
    message: string;
    metadata?: Record<string, unknown>;
}

export interface PlaywrightConfig {
    maxBrowsers: number;
    browserType: 'chromium' | 'firefox' | 'webkit';
    headless: boolean;
    screenshotDir?: string;
}

const DEFAULT_CONFIG: PlaywrightConfig = {
    maxBrowsers: 3,
    browserType: 'chromium',
    headless: true,
    screenshotDir: '/tmp/evaluator-screenshots',
};

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
            const { browser, context, page } = await this.browserPool.acquireWithContext(params.viewport);

            try {
                // Navigate
                const navStart = Date.now();
                await page.goto(params.url, { waitUntil: 'networkidle' });
                details.push({
                    name: 'navigation',
                    passed: true,
                    score: 100,
                    message: `Navigated to ${params.url} in ${Date.now() - navStart}ms`,
                });

                // Execute interactions
                for (let i = 0; i < params.interactions.length; i++) {
                    const interaction = params.interactions[i];
                    const interactionResult = await this.executeInteraction(page, interaction, i);
                    details.push(interactionResult);
                }

                // Screenshot comparison
                if (params.expectedScreenshots && params.expectedScreenshots.length > 0) {
                    const screenshot = await page.screenshot({ fullPage: true });
                    const screenshotPath = `${this.config.screenshotDir}/current-${Date.now()}.png`;
                    artifacts.push(screenshotPath);

                    for (let i = 0; i < params.expectedScreenshots.length; i++) {
                        const comparison = params.expectedScreenshots[i];
                        const comparisonResult = await this.compareScreenshots(screenshot, comparison, i);
                        details.push(comparisonResult);
                    }
                }

                // Accessibility check using axe-core
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

                const statusMatch = response.status === endpoint.expectedStatus;
                const timeOk = !endpoint.maxResponseTimeMs || duration <= endpoint.maxResponseTimeMs;

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
                    metadata: { status: response.status, duration, schemaValid },
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
            metadata: { stdout: testResult.stdout.slice(0, 1000), stderr: testResult.stderr.slice(0, 1000) },
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
        page: Page,
        interaction: UIInteraction,
        index: number,
    ): Promise<VerificationDetail> {
        const startTime = Date.now();

        try {
            switch (interaction.type) {
                case 'click':
                    await page.click(interaction.target!, interaction.options);
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
                case 'press':
                    await page.press(interaction.target!, interaction.key!);
                    break;
                case 'focus':
                    await page.focus(interaction.target!);
                    break;
            }

            return {
                name: `interaction:${index}:${interaction.type}`,
                passed: true,
                score: 100,
                message: `Executed ${interaction.type} in ${Date.now() - startTime}ms`,
            };
        } catch (error) {
            return {
                name: `interaction:${index}:${interaction.type}`,
                passed: false,
                score: 0,
                message: error instanceof Error ? error.message : 'Interaction failed',
            };
        }
    }

    private async compareScreenshots(
        current: Buffer,
        comparison: ScreenshotComparison,
        index: number,
    ): Promise<VerificationDetail> {
        try {
            const currentPng = PNG.sync.read(current);
            const baselinePng = PNG.sync.read(
                typeof comparison.baseline === 'string'
                    ? await import('node:fs').then((fs) => fs.readFileSync(comparison.baseline as string))
                    : comparison.baseline,
            );

            const { width, height } = currentPng;
            const diff = new PNG({ width, height });

            const numDiffPixels = pixelmatch(currentPng.data, baselinePng.data, diff.data, width, height, {
                threshold: comparison.threshold,
            });

            const totalPixels = width * height;
            const diffPercentage = (numDiffPixels / totalPixels) * 100;
            const passed = diffPercentage <= comparison.threshold * 100;

            return {
                name: `screenshot-comparison:${index}`,
                passed,
                score: passed ? 100 : Math.max(0, 100 - diffPercentage),
                message: `Pixel diff: ${diffPercentage.toFixed(2)}% (threshold: ${(comparison.threshold * 100).toFixed(2)}%)`,
                metadata: { diffPixels: numDiffPixels, totalPixels },
            };
        } catch (error) {
            return {
                name: `screenshot-comparison:${index}`,
                passed: false,
                score: 0,
                message: error instanceof Error ? error.message : 'Screenshot comparison failed',
            };
        }
    }

    private async runAccessibilityCheck(page: Page): Promise<VerificationDetail> {
        try {
            // Inject axe-core
            await page.addScriptTag({
                url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.0/axe.min.js',
            });

            const results = await page.evaluate(async () => {
                // @ts-ignore
                return await axe.run();
            });

            const violations = results.violations || [];
            const criticalCount = violations.filter((v: any) => v.impact === 'critical').length;
            const seriousCount = violations.filter((v: any) => v.impact === 'serious').length;

            const passed = criticalCount === 0 && seriousCount === 0;
            const score = passed ? 100 : Math.max(0, 100 - (criticalCount * 20 + seriousCount * 10));

            return {
                name: 'accessibility',
                passed,
                score,
                message: `${violations.length} violations (${criticalCount} critical, ${seriousCount} serious)`,
                metadata: { violations: violations.map((v: any) => ({ id: v.id, impact: v.impact })) },
            };
        } catch (error) {
            return {
                name: 'accessibility',
                passed: false,
                score: 0,
                message: error instanceof Error ? error.message : 'Accessibility check failed',
            };
        }
    }

    private async checkResponsive(page: Page, width: number): Promise<VerificationDetail> {
        try {
            // Check for horizontal scroll
            const hasHorizontalScroll = await page.evaluate(() => {
                return document.documentElement.scrollWidth > window.innerWidth;
            });

            // Check for overflow issues
            const overflowElements = await page.evaluate(() => {
                const elements = document.querySelectorAll('*');
                return Array.from(elements).filter((el) => {
                    const style = window.getComputedStyle(el);
                    return style.overflow === 'hidden' && el.scrollWidth > el.clientWidth;
                }).length;
            });

            const passed = !hasHorizontalScroll && overflowElements === 0;

            return {
                name: `responsive:${width}px`,
                passed,
                score: passed ? 100 : 50,
                message: hasHorizontalScroll
                    ? `Horizontal scroll detected at ${width}px`
                    : overflowElements > 0
                      ? `${overflowElements} overflow elements at ${width}px`
                      : `Layout responsive at ${width}px`,
            };
        } catch (error) {
            return {
                name: `responsive:${width}px`,
                passed: false,
                score: 0,
                message: error instanceof Error ? error.message : 'Responsive check failed',
            };
        }
    }

    private async makeRequest(
        baseUrl: string,
        endpoint: APIEndpoint,
        globalHeaders?: Record<string, string>,
    ): Promise<{ status: number; data: unknown }> {
        const url = `${baseUrl}${endpoint.path}`;
        const headers = { ...globalHeaders, ...endpoint.headers };

        const response = await fetch(url, {
            method: endpoint.method,
            headers,
            body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
        });

        const data = await response.json().catch(() => null);
        return { status: response.status, data };
    }

    private validateSchema(data: unknown, schema: JSONSchema): { valid: boolean; error?: string } {
        if (schema.type === 'object' && typeof data !== 'object') {
            return { valid: false, error: 'Expected object' };
        }
        if (schema.type === 'array' && !Array.isArray(data)) {
            return { valid: false, error: 'Expected array' };
        }

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
        command: string,
    ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
        try {
            const { stdout, stderr } = await execAsync(command, { cwd, timeout: 120000 });
            return { exitCode: 0, stdout, stderr };
        } catch (error: any) {
            return {
                exitCode: error.code || 1,
                stdout: error.stdout || '',
                stderr: error.stderr || error.message,
            };
        }
    }

    private async extractCoverage(repoPath: string): Promise<{ percentage: number; files: string[] }> {
        try {
            // Try to read coverage summary from common locations
            const fs = await import('node:fs');
            const path = await import('node:path');

            const coveragePaths = [
                path.join(repoPath, 'coverage/coverage-summary.json'),
                path.join(repoPath, 'coverage/lcov-report/coverage-summary.json'),
            ];

            for (const coveragePath of coveragePaths) {
                if (fs.existsSync(coveragePath)) {
                    const summary = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));
                    const total = summary.total || summary;
                    const percentage = total.lines?.pct || total.branches?.pct || 0;
                    return { percentage, files: Object.keys(summary).filter((k) => k !== 'total') };
                }
            }

            return { percentage: 0, files: [] };
        } catch {
            return { percentage: 0, files: [] };
        }
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

class BrowserPool {
    private browsers: Browser[] = [];
    private available: Browser[] = [];
    private waiting: Array<(browser: Browser) => void> = [];

    constructor(private config: PlaywrightConfig) {}

    async acquireWithContext(viewport: { width: number; height: number }): Promise<{
        browser: Browser;
        context: BrowserContext;
        page: Page;
    }> {
        const browser = await this.acquire();
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        return { browser, context, page };
    }

    async acquire(): Promise<Browser> {
        if (this.available.length > 0) {
            return this.available.pop()!;
        }

        if (this.browsers.length < this.config.maxBrowsers) {
            const browser = await this.createBrowser();
            this.browsers.push(browser);
            return browser;
        }

        return new Promise((resolve) => {
            this.waiting.push(resolve);
        });
    }

    async release(browser: Browser): Promise<void> {
        if (this.waiting.length > 0) {
            const waiter = this.waiting.shift()!;
            waiter(browser);
            return;
        }
        this.available.push(browser);
    }

    async close(): Promise<void> {
        for (const browser of this.browsers) {
            await browser.close();
        }
        this.browsers = [];
        this.available = [];
    }

    private async createBrowser(): Promise<Browser> {
        logger.info({ browserType: this.config.browserType }, 'Creating browser');

        const launchOptions = { headless: this.config.headless };

        switch (this.config.browserType) {
            case 'firefox':
                return firefox.launch(launchOptions);
            case 'webkit':
                return webkit.launch(launchOptions);
            case 'chromium':
            default:
                return chromium.launch(launchOptions);
        }
    }
}
