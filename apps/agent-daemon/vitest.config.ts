import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
        testTimeout: 30000,
        dangerouslyIgnoreUnhandledErrors: true,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/index.ts'],
        },
    },
});
