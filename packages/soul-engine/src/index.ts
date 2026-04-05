/**
 * Soul Engine
 *
 * Core engine for Soul Profile management, parsing, storage, and social matching.
 *
 * @packageDocumentation
 */

// Export unified LLM configuration (must be first to avoid type conflicts)
export * from './llm-config.js';

// Re-export fallback configuration utilities
export { 
    buildLLMConfigWithFallback,
    getFallbackModeDescription 
} from './llm-config.js';

// Export all types
export * from './types.js';

// Export parser
export * from './parser.js';

// Export probe types and implementation
export * from './probe-types.js';
export * from './probe.js';

// Export matching engine (complete!)
export * from './matching/index.js';

// Export storage (will be implemented later)
// export * from './storage.js';
