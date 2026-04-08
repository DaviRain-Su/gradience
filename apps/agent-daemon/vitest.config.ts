import { defineConfig } from 'vitest/config';

const skipE2E = process.env.SKIP_E2E_TESTS === 'true';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
        exclude: skipE2E
            ? ['tests/e2e/**/*.test.ts', 'tests/revenue-distribution.e2e.test.ts', 'src/tests/e2e-payment-flow.test.ts']
            : [],
        testTimeout: 30000,
        dangerouslyIgnoreUnhandledErrors: true,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/index.ts'],
        },
    },
});
