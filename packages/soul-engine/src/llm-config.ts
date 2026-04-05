/**
 * Unified LLM Configuration
 *
 * Shared LLM provider configuration for Gradience ecosystem.
 * Used by both daemon evaluator and soul-engine.
 *
 * @module @gradiences/soul-engine/llm-config
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Supported LLM providers
 */
export type LLMProvider = 'openai' | 'claude' | 'moonshot';

/**
 * LLM configuration options
 */
export interface LLMConfig {
    /** Provider type */
    provider: LLMProvider;
    /** Model name (e.g., gpt-4, claude-3-sonnet, moonshot-v1-8k) */
    model: string;
    /** API key */
    apiKey: string;
    /** Base URL (optional, uses provider default if not set) */
    baseUrl?: string;
    /** Temperature (0-1) */
    temperature?: number;
    /** Max tokens */
    maxTokens?: number;
    /** Request timeout in ms */
    timeout?: number;
}

/**
 * LLM provider-specific configuration
 */
export interface LLMProviderConfig {
    baseUrl: string;
    apiKey: string;
    model: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default base URLs for each provider
 */
export const LLM_DEFAULT_BASE_URLS: Record<LLMProvider, string> = {
    openai: 'https://api.openai.com/v1',
    claude: 'https://api.anthropic.com/v1',
    moonshot: 'https://api.moonshot.cn/v1',
};

/**
 * Default models for each provider
 */
export const LLM_DEFAULT_MODELS: Record<LLMProvider, string> = {
    openai: 'gpt-4',
    claude: 'claude-3-sonnet-20240229',
    moonshot: 'moonshot-v1-8k',
};

/**
 * Environment variable names for each provider's API key
 */
export const LLM_API_KEY_ENV: Record<LLMProvider, string> = {
    openai: 'OPENAI_API_KEY',
    claude: 'ANTHROPIC_API_KEY',
    moonshot: 'MOONSHOT_API_KEY',
};

/**
 * Default LLM configuration values
 */
export const LLM_DEFAULTS = {
    provider: 'openai' as LLMProvider,
    model: 'gpt-4',
    temperature: 0.3,
    maxTokens: 2048,
    timeout: 60000,
} as const;

// ============================================================================
// Configuration Builder
// ============================================================================

/**
 * Build LLM configuration from environment variables
 *
 * Priority:
 * 1. Explicit config parameter
 * 2. LLM_* environment variables (unified)
 * 3. Provider-specific environment variables
 * 4. Defaults
 */
export function buildLLMConfig(config?: Partial<LLMConfig>): LLMConfig {
    const provider = (config?.provider ||
        (typeof process !== 'undefined' ? process.env.LLM_PROVIDER : undefined) ||
        LLM_DEFAULTS.provider) as LLMProvider;

    const providerConfig = getLLMProviderConfig(provider);

    return {
        provider,
        model: config?.model ||
            (typeof process !== 'undefined' ? process.env.LLM_MODEL : undefined) ||
            providerConfig.model,
        apiKey: config?.apiKey || providerConfig.apiKey,
        baseUrl: config?.baseUrl || providerConfig.baseUrl,
        temperature: config?.temperature ?? LLM_DEFAULTS.temperature,
        maxTokens: config?.maxTokens ?? LLM_DEFAULTS.maxTokens,
        timeout: config?.timeout ?? LLM_DEFAULTS.timeout,
    };
}

/**
 * Get provider-specific configuration from environment
 */
export function getLLMProviderConfig(provider: LLMProvider): LLMProviderConfig {
    const baseUrl = getEnvVar(`${provider.toUpperCase()}_BASE_URL`) ||
        LLM_DEFAULT_BASE_URLS[provider];

    const apiKey = getEnvVar(LLM_API_KEY_ENV[provider]) ||
        getEnvVar('LLM_API_KEY') ||
        '';

    const model = getEnvVar(`${provider.toUpperCase()}_MODEL`) ||
        LLM_DEFAULT_MODELS[provider];

    return { baseUrl, apiKey, model };
}

/**
 * Get API key for a specific provider
 */
export function getLLMApiKey(provider: LLMProvider): string {
    return getEnvVar(LLM_API_KEY_ENV[provider]) ||
        getEnvVar('LLM_API_KEY') ||
        '';
}

/**
 * Check if LLM is configured (has API key)
 */
export function isLLMConfigured(config?: LLMConfig): boolean {
    if (config) {
        return !!config.apiKey;
    }
    if (typeof process === 'undefined') {
        return false;
    }
    return !!(process.env.LLM_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.MOONSHOT_API_KEY);
}

// ============================================================================
// Fallback / Local Mode Configuration
// ============================================================================

/**
 * Fallback mode type
 */
export type FallbackMode = 'embedding-only' | 'rule-based' | 'off';

/**
 * Extended LLM configuration with fallback options
 */
export interface LLMConfigWithFallback extends LLMConfig {
    /** Enable fallback mode when LLM is not available */
    fallbackMode?: FallbackMode;
    /** Allow embedding-only matching without LLM */
    allowEmbeddingOnly?: boolean;
}

/**
 * Build LLM configuration with fallback support
 * 
 * If no API key is provided, automatically enables fallback mode
 */
export function buildLLMConfigWithFallback(
    config?: Partial<LLMConfigWithFallback>
): LLMConfigWithFallback {
    const baseConfig = buildLLMConfig(config);
    const hasApiKey = !!baseConfig.apiKey;
    
    // Auto-enable fallback if no API key
    const fallbackMode: FallbackMode = config?.fallbackMode ?? 
        (hasApiKey ? 'off' : 'embedding-only');
    
    return {
        ...baseConfig,
        fallbackMode,
        allowEmbeddingOnly: config?.allowEmbeddingOnly ?? !hasApiKey,
    };
}

/**
 * Get human-readable fallback mode description
 */
export function getFallbackModeDescription(mode: FallbackMode): string {
    switch (mode) {
        case 'embedding-only':
            return 'Using embedding-based matching only (fast, no LLM costs)';
        case 'rule-based':
            return 'Using rule-based analysis (no LLM API calls)';
        case 'off':
            return 'Full LLM analysis enabled';
        default:
            return 'Unknown mode';
    }
}

/**
 * Detect provider from API key pattern
 */
export function detectProviderFromApiKey(apiKey: string): LLMProvider {
    if (apiKey.startsWith('moonshot-')) {
        return 'moonshot';
    } else if (apiKey.startsWith('ant-') || apiKey.startsWith('sk-ant-')) {
        return 'claude';
    } else {
        // Default to openai for sk- prefix and others
        return 'openai';
    }
}

/**
 * Get chat completions endpoint URL
 */
export function getChatCompletionsUrl(config: LLMConfig): string {
    const baseUrl = config.baseUrl || LLM_DEFAULT_BASE_URLS[config.provider];
    return `${baseUrl}/chat/completions`;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Safe environment variable accessor
 */
function getEnvVar(name: string): string | undefined {
    if (typeof process !== 'undefined' && process.env) {
        return process.env[name];
    }
    return undefined;
}

/**
 * Validate LLM configuration
 */
export function validateLLMConfig(config: LLMConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.provider) {
        errors.push('Provider is required');
    }

    if (!config.apiKey) {
        errors.push('API key is required');
    }

    if (!config.model) {
        errors.push('Model is required');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Create headers for LLM API requests
 */
export function createLLMHeaders(config: LLMConfig): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
    };
}

/**
 * Map provider to OpenAI-compatible provider string (for external evaluators)
 */
export function toOpenAICompatibleProvider(provider: LLMProvider): 'openai' | 'anthropic' | 'local' {
    if (provider === 'claude') {
        return 'anthropic';
    }
    if (provider === 'openai' || provider === 'moonshot') {
        return 'openai'; // Moonshot is OpenAI-compatible
    }
    return 'local';
}
