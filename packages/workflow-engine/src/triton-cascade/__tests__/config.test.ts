/**
 * Triton Cascade Integration - Config Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    createDefaultConfig,
    createConfigFromEnv,
    validateConfig,
    mergeConfig,
    getJitoBlockEngineUrl,
    sanitizeConfigForLogging,
    DEFAULTS,
    ENDPOINTS,
} from '../config.js';
import { CascadeError, CascadeErrorCodes } from '../errors.js';

describe('createDefaultConfig', () => {
    it('should create devnet config by default', () => {
        const config = createDefaultConfig();

        expect(config.network).toBe('devnet');
        expect(config.rpcEndpoint).toBe(ENDPOINTS.CASCADE_DEVNET);
    });

    it('should create mainnet config when specified', () => {
        const config = createDefaultConfig('mainnet');

        expect(config.network).toBe('mainnet');
        expect(config.rpcEndpoint).toBe(ENDPOINTS.CASCADE_MAINNET);
    });

    it('should have correct default values', () => {
        const config = createDefaultConfig();

        expect(config.connectionTimeoutMs).toBe(DEFAULTS.CONNECTION_TIMEOUT_MS);
        expect(config.confirmationTimeoutMs).toBe(DEFAULTS.CONFIRMATION_TIMEOUT_MS);
        expect(config.maxRetries).toBe(DEFAULTS.MAX_RETRIES);
        expect(config.enableJitoBundle).toBe(false);
        expect(config.priorityFeeStrategy).toBe('auto');
        expect(config.maxConcurrentTransactions).toBe(DEFAULTS.MAX_CONCURRENT_TRANSACTIONS);
    });
});

describe('validateConfig', () => {
    it('should validate a complete config', () => {
        const config = createDefaultConfig();
        const validated = validateConfig(config);

        expect(validated).toEqual(config);
    });

    it('should throw for missing rpcEndpoint', () => {
        expect(() => validateConfig({ network: 'devnet' })).toThrow(CascadeError);
        expect(() => validateConfig({ network: 'devnet' })).toThrow('rpcEndpoint is required');
    });

    it('should throw for invalid rpcEndpoint URL', () => {
        expect(() => validateConfig({ network: 'devnet', rpcEndpoint: 'not-a-url' })).toThrow(
            'Invalid rpcEndpoint URL',
        );
    });

    it('should throw for invalid network', () => {
        expect(() => validateConfig({ network: 'invalid' as 'devnet', rpcEndpoint: 'https://test.com' })).toThrow(
            'Invalid network',
        );
    });

    it('should throw for connectionTimeoutMs too low', () => {
        expect(() =>
            validateConfig({
                network: 'devnet',
                rpcEndpoint: 'https://test.com',
                connectionTimeoutMs: 500,
            }),
        ).toThrow('connectionTimeoutMs must be between');
    });

    it('should throw for connectionTimeoutMs too high', () => {
        expect(() =>
            validateConfig({
                network: 'devnet',
                rpcEndpoint: 'https://test.com',
                connectionTimeoutMs: 400000,
            }),
        ).toThrow('connectionTimeoutMs must be between');
    });

    it('should throw for negative maxRetries', () => {
        expect(() =>
            validateConfig({
                network: 'devnet',
                rpcEndpoint: 'https://test.com',
                maxRetries: -1,
            }),
        ).toThrow('maxRetries must be between');
    });

    it('should throw for maxRetries too high', () => {
        expect(() =>
            validateConfig({
                network: 'devnet',
                rpcEndpoint: 'https://test.com',
                maxRetries: 15,
            }),
        ).toThrow('maxRetries must be between');
    });

    it('should throw for invalid priorityFeeStrategy', () => {
        expect(() =>
            validateConfig({
                network: 'devnet',
                rpcEndpoint: 'https://test.com',
                priorityFeeStrategy: 'invalid' as 'auto',
            }),
        ).toThrow('Invalid priorityFeeStrategy');
    });

    it('should throw for negative fixedPriorityFeeLamports', () => {
        expect(() =>
            validateConfig({
                network: 'devnet',
                rpcEndpoint: 'https://test.com',
                fixedPriorityFeeLamports: -100,
            }),
        ).toThrow('fixedPriorityFeeLamports must be non-negative');
    });
});

describe('mergeConfig', () => {
    it('should merge partial config with defaults', () => {
        const merged = mergeConfig({ network: 'mainnet' });

        expect(merged.network).toBe('mainnet');
        expect(merged.rpcEndpoint).toBe(ENDPOINTS.CASCADE_MAINNET);
        expect(merged.maxRetries).toBe(DEFAULTS.MAX_RETRIES);
    });

    it('should override defaults with provided values', () => {
        const merged = mergeConfig({
            network: 'devnet',
            maxRetries: 5,
            enableJitoBundle: true,
        });

        expect(merged.maxRetries).toBe(5);
        expect(merged.enableJitoBundle).toBe(true);
    });
});

describe('getJitoBlockEngineUrl', () => {
    it('should return mainnet URL', () => {
        expect(getJitoBlockEngineUrl('mainnet')).toBe(ENDPOINTS.JITO_MAINNET_BLOCK_ENGINE);
    });

    it('should return devnet URL', () => {
        expect(getJitoBlockEngineUrl('devnet')).toBe(ENDPOINTS.JITO_DEVNET_BLOCK_ENGINE);
    });
});

describe('sanitizeConfigForLogging', () => {
    it('should hide apiToken', () => {
        const config = createDefaultConfig();
        config.apiToken = 'secret-token-123';

        const sanitized = sanitizeConfigForLogging(config);

        expect(sanitized.hasApiToken).toBe(true);
        expect(sanitized).not.toHaveProperty('apiToken');
    });

    it('should show hasApiToken as false when no token', () => {
        const config = createDefaultConfig();

        const sanitized = sanitizeConfigForLogging(config);

        expect(sanitized.hasApiToken).toBe(false);
    });

    it('should include all other config fields', () => {
        const config = createDefaultConfig();
        config.enableJitoBundle = true;

        const sanitized = sanitizeConfigForLogging(config);

        expect(sanitized).toMatchObject({
            rpcEndpoint: config.rpcEndpoint,
            network: config.network,
            connectionTimeoutMs: config.connectionTimeoutMs,
            enableJitoBundle: true,
            priorityFeeStrategy: config.priorityFeeStrategy,
        });
    });
});
