import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 60_000,
    expect: {
        timeout: 10_000,
    },
    fullyParallel: false,
    retries: 1,
    workers: 1,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:5300',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5300/app',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
