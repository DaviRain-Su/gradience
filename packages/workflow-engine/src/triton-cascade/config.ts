/**
 * Triton Cascade Integration - Configuration and Constants
 *
 * @module triton-cascade/config
 */

import type { TritonCascadeConfig, SolanaNetwork } from './types.js';
import { CascadeError, CascadeErrorCodes } from './errors.js';

/**
 * Default configuration constants
 */
export const DEFAULTS = {
    /** Connection timeout in milliseconds */
    CONNECTION_TIMEOUT_MS: 10000,
    /** Transaction confirmation timeout in milliseconds */
    CONFIRMATION_TIMEOUT_MS: 60000,
    /** Maximum retry attempts */
    MAX_RETRIES: 3,
    /** Retry backoff base in milliseconds */
    RETRY_BACKOFF_BASE_MS: 1000,
    /** Health check interval in milliseconds */
    HEALTH_CHECK_INTERVAL_MS: 30000,
    /** Priority fee cache TTL in milliseconds */
    PRIORITY_FEE_CACHE_TTL_MS: 5000,
    /** Maximum concurrent transactions */
    MAX_CONCURRENT_TRANSACTIONS: 10,
    /** Default priority fee in microLamports */
    DEFAULT_PRIORITY_FEE: 5000,
    /** Maximum retry delay in milliseconds */
    MAX_RETRY_DELAY_MS: 30000,
    /** Jito bundle timeout in milliseconds */
    JITO_BUNDLE_TIMEOUT_MS: 30000,
} as const;

/**
 * Triton Cascade endpoints
 */
export const ENDPOINTS = {
    /** Mainnet RPC endpoint */
    CASCADE_MAINNET: 'https://api.triton.one/rpc',
    /** Devnet RPC endpoint */
    CASCADE_DEVNET: 'https://api.devnet.triton.one/rpc',
    /** Jito mainnet block engine */
    JITO_MAINNET_BLOCK_ENGINE: 'https://mainnet.block-engine.jito.wtf',
    /** Jito devnet block engine */
    JITO_DEVNET_BLOCK_ENGINE: 'https://devnet.block-engine.jito.wtf',
} as const;

/**
 * Create default configuration
 */
export function createDefaultConfig(network: SolanaNetwork = 'devnet'): TritonCascadeConfig {
    const rpcEndpoint = network === 'mainnet' ? ENDPOINTS.CASCADE_MAINNET : ENDPOINTS.CASCADE_DEVNET;

    return {
        rpcEndpoint,
        network,
        connectionTimeoutMs: DEFAULTS.CONNECTION_TIMEOUT_MS,
        confirmationTimeoutMs: DEFAULTS.CONFIRMATION_TIMEOUT_MS,
        maxRetries: DEFAULTS.MAX_RETRIES,
        enableJitoBundle: false,
        priorityFeeStrategy: 'auto',
        maxConcurrentTransactions: DEFAULTS.MAX_CONCURRENT_TRANSACTIONS,
    };
}

/**
 * Create configuration from environment variables
 */
export function createConfigFromEnv(): TritonCascadeConfig {
    const network =
        (process.env.SOLANA_NETWORK as SolanaNetwork) || (process.env.NODE_ENV === 'production' ? 'mainnet' : 'devnet');

    const config = createDefaultConfig(network);

    // Override with environment variables
    if (process.env.TRITON_RPC_ENDPOINT) {
        config.rpcEndpoint = process.env.TRITON_RPC_ENDPOINT;
    }

    if (process.env.TRITON_API_TOKEN) {
        config.apiToken = process.env.TRITON_API_TOKEN;
    }

    if (process.env.TRITON_CONNECTION_TIMEOUT_MS) {
        config.connectionTimeoutMs = parseInt(process.env.TRITON_CONNECTION_TIMEOUT_MS, 10);
    }

    if (process.env.TRITON_CONFIRMATION_TIMEOUT_MS) {
        config.confirmationTimeoutMs = parseInt(process.env.TRITON_CONFIRMATION_TIMEOUT_MS, 10);
    }

    if (process.env.TRITON_MAX_RETRIES) {
        config.maxRetries = parseInt(process.env.TRITON_MAX_RETRIES, 10);
    }

    if (process.env.ENABLE_JITO_BUNDLE) {
        config.enableJitoBundle = process.env.ENABLE_JITO_BUNDLE === 'true';
    }

    if (process.env.JITO_BLOCK_ENGINE_URL) {
        config.jitoBlockEngineUrl = process.env.JITO_BLOCK_ENGINE_URL;
    }

    if (process.env.TRITON_PRIORITY_FEE_STRATEGY) {
        const strategy = process.env.TRITON_PRIORITY_FEE_STRATEGY;
        if (['auto', 'fixed', 'none'].includes(strategy)) {
            config.priorityFeeStrategy = strategy as 'auto' | 'fixed' | 'none';
        }
    }

    if (process.env.TRITON_FIXED_PRIORITY_FEE_LAMPORTS) {
        config.fixedPriorityFeeLamports = parseInt(process.env.TRITON_FIXED_PRIORITY_FEE_LAMPORTS, 10);
    }

    if (process.env.TRITON_MAX_CONCURRENT_TRANSACTIONS) {
        config.maxConcurrentTransactions = parseInt(process.env.TRITON_MAX_CONCURRENT_TRANSACTIONS, 10);
    }

    return validateConfig(config);
}

/**
 * Validate configuration
 */
export function validateConfig(config: Partial<TritonCascadeConfig>): TritonCascadeConfig {
    const errors: string[] = [];

    // Validate required fields
    if (!config.rpcEndpoint) {
        errors.push('rpcEndpoint is required');
    } else {
        try {
            new URL(config.rpcEndpoint);
        } catch {
            errors.push(`Invalid rpcEndpoint URL: ${config.rpcEndpoint}`);
        }
    }

    if (!config.network) {
        errors.push('network is required');
    } else if (!['mainnet', 'devnet'].includes(config.network)) {
        errors.push(`Invalid network: ${config.network}`);
    }

    // Validate numeric fields
    if (
        config.connectionTimeoutMs !== undefined &&
        (config.connectionTimeoutMs < 1000 || config.connectionTimeoutMs > 300000)
    ) {
        errors.push(`connectionTimeoutMs must be between 1000 and 300000, got ${config.connectionTimeoutMs}`);
    }

    if (
        config.confirmationTimeoutMs !== undefined &&
        (config.confirmationTimeoutMs < 5000 || config.confirmationTimeoutMs > 600000)
    ) {
        errors.push(`confirmationTimeoutMs must be between 5000 and 600000, got ${config.confirmationTimeoutMs}`);
    }

    if (config.maxRetries !== undefined && (config.maxRetries < 0 || config.maxRetries > 10)) {
        errors.push(`maxRetries must be between 0 and 10, got ${config.maxRetries}`);
    }

    if (
        config.maxConcurrentTransactions !== undefined &&
        (config.maxConcurrentTransactions < 1 || config.maxConcurrentTransactions > 100)
    ) {
        errors.push(`maxConcurrentTransactions must be between 1 and 100, got ${config.maxConcurrentTransactions}`);
    }

    // Validate priority fee strategy
    if (config.priorityFeeStrategy && !['auto', 'fixed', 'none'].includes(config.priorityFeeStrategy)) {
        errors.push(`Invalid priorityFeeStrategy: ${config.priorityFeeStrategy}`);
    }

    // Validate fixed priority fee
    if (config.fixedPriorityFeeLamports !== undefined && config.fixedPriorityFeeLamports < 0) {
        errors.push(`fixedPriorityFeeLamports must be non-negative, got ${config.fixedPriorityFeeLamports}`);
    }

    if (errors.length > 0) {
        throw new CascadeError(
            CascadeErrorCodes.VALIDATION_ERROR,
            `Configuration validation failed: ${errors.join(', ')}`,
            { data: { errors, config } },
        );
    }

    // Return complete config with defaults
    return {
        ...createDefaultConfig(config.network || 'devnet'),
        ...config,
    } as TritonCascadeConfig;
}

/**
 * Merge partial configuration with defaults
 */
export function mergeConfig(partial: Partial<TritonCascadeConfig>): TritonCascadeConfig {
    const defaultConfig = createDefaultConfig(partial.network || 'devnet');
    return validateConfig({ ...defaultConfig, ...partial });
}

/**
 * Get Jito block engine URL based on network
 */
export function getJitoBlockEngineUrl(network: SolanaNetwork): string {
    return network === 'mainnet' ? ENDPOINTS.JITO_MAINNET_BLOCK_ENGINE : ENDPOINTS.JITO_DEVNET_BLOCK_ENGINE;
}

/**
 * Sanitize config for logging (removes sensitive data)
 */
export function sanitizeConfigForLogging(config: TritonCascadeConfig): Record<string, unknown> {
    return {
        rpcEndpoint: config.rpcEndpoint,
        network: config.network,
        hasApiToken: !!config.apiToken,
        connectionTimeoutMs: config.connectionTimeoutMs,
        confirmationTimeoutMs: config.confirmationTimeoutMs,
        maxRetries: config.maxRetries,
        enableJitoBundle: config.enableJitoBundle,
        jitoBlockEngineUrl: config.jitoBlockEngineUrl,
        priorityFeeStrategy: config.priorityFeeStrategy,
        fixedPriorityFeeLamports: config.fixedPriorityFeeLamports,
        maxConcurrentTransactions: config.maxConcurrentTransactions,
    };
}
