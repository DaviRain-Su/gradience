import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

/** @type {import('eslint').Linter.Config[]} */
export default [
    js.configs.recommended,
    {
        files: ['**/*.ts', '**/*.tsx'],
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
        },
        rules: {
            // TypeScript handled
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-undef': 'off',

            // Safety
            'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
            'no-debugger': 'error',
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'prefer-const': 'warn',
            'no-var': 'error',
            eqeqeq: ['error', 'always'],

            // Style (Prettier handles formatting)
            'no-trailing-spaces': 'off',
            'comma-dangle': 'off',
            semi: 'off',
        },
    },
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            '.next/**',
            '.turbo/**',
            'target/**',
            '**/generated/**',
            '**/*.d.ts',
            'apps/agentm/**', // Electron app has its own config

        ],
    },
];
