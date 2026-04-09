import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/__tests__/setup.ts'],
        exclude: ['node_modules/', 'e2e/', 'dist/', '.next/'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            thresholds: {
                lines: 70,
                functions: 70,
                branches: 60,
                statements: 70,
            },
            exclude: ['node_modules/', 'src/__tests__/', 'e2e/', '**/*.d.ts', '**/*.config.*', '**/mock-data.ts'],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
