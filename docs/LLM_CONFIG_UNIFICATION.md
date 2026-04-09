# Unified LLM Configuration System

## Overview

This document describes the unified LLM configuration system that provides a single source of truth for LLM provider settings across the Gradience daemon and soul-engine.

## Changes Made

### 1. soul-engine - Unified LLM Config Module

**New file: `packages/soul-engine/src/llm-config.ts`**

Exports:

- `LLMProvider` - Type for supported providers ('openai' | 'claude' | 'moonshot')
- `LLMConfig` - Unified configuration interface
- `LLMProviderConfig` - Provider-specific configuration
- Constants:
    - `LLM_DEFAULT_BASE_URLS` - Default API endpoints
    - `LLM_DEFAULT_MODELS` - Default model names
    - `LLM_API_KEY_ENV` - Environment variable names
    - `LLM_DEFAULTS` - Default configuration values
- Functions:
    - `buildLLMConfig()` - Build config from environment variables
    - `getLLMProviderConfig()` - Get provider-specific config
    - `getLLMApiKey()` - Get API key for provider
    - `isLLMConfigured()` - Check if LLM is configured
    - `detectProviderFromApiKey()` - Auto-detect provider from API key
    - `validateLLMConfig()` - Validate configuration
    - `createLLMHeaders()` - Create API headers

**Updated files:**

- `packages/soul-engine/src/index.ts` - Exports llm-config
- `packages/soul-engine/src/matching/llm-analyzer.ts` - Uses unified config
- `packages/soul-engine/src/matching/index.ts` - Re-exports types
- `packages/soul-engine/tsup.config.ts` - Added llm-config.ts entry
- `packages/soul-engine/package.json` - Added llm-config export

### 2. agent-daemon - Unified Configuration

**Updated file: `apps/agent-daemon/src/config.ts`**

Added new config fields:

- `llmProvider` - Provider type ('openai' | 'claude' | 'moonshot')
- `llmModel` - Model name
- `llmApiKey` - API key
- `llmBaseUrl` - Optional base URL
- `llmTemperature` - Temperature (0-1)
- `llmMaxTokens` - Max tokens
- `llmTimeout` - Request timeout

Updated fields (now optional, fallback to unified config):

- `judgeProvider` - Falls back to llmProvider
- `judgeModel` - Falls back to llmModel

New functions:

- `getUnifiedLLMConfig()` - Extract unified config from daemon config
- `getEvaluatorLLMConfig()` - Get evaluator-specific config with fallback
- `isLLMConfigured()` - Check if LLM is configured

Environment variable support:

- `LLM_PROVIDER` - Set provider
- `LLM_MODEL` - Set model
- `LLM_API_KEY` - Set API key (unified)
- `LLM_BASE_URL` - Set base URL
- `LLM_TEMPERATURE` - Set temperature
- `LLM_MAX_TOKENS` - Set max tokens
- `LLM_TIMEOUT` - Set timeout
- `OPENAI_API_KEY` - OpenAI API key (fallback)
- `ANTHROPIC_API_KEY` - Claude API key (fallback)
- `MOONSHOT_API_KEY` - Moonshot API key (fallback)

**Updated file: `apps/agent-daemon/src/evaluator/llm-client.ts`**

- Added `createLLMClientFromConfig()` - Create client from unified config
- Updated `getLLMClient()` - Accept optional unified config
- Updated `isLLMAvailable()` - Accept optional unified config
- Re-exports `UnifiedLLMConfig` and `LLMProvider` types

**Updated file: `apps/agent-daemon/src/evaluator/index.ts`**

- Exports `createLLMClientFromConfig`, `UnifiedLLMConfig`, `LLMProvider`

**Updated file: `apps/agent-daemon/src/tasks/task-service.ts`**

- Updated to use unified LLM config
- Falls back to legacy config if unified config not provided

**Updated file: `apps/agent-daemon/src/daemon.ts`**

- Uses `getUnifiedLLMConfig()` and `getEvaluatorLLMConfig()`
- Passes unified config to TaskService

## Configuration Priority

When building LLM configuration, the system uses the following priority (highest to lowest):

1. Explicit config parameters passed to functions
2. `LLM_*` environment variables (unified)
3. Provider-specific environment variables (`OPENAI_API_KEY`, etc.)
4. Default values

## Usage Examples

### Using Unified Config in soul-engine

```typescript
import { buildLLMConfig, LLMConfig, isLLMConfigured } from '@gradiences/soul-engine';

// Build from environment
const config = buildLLMConfig();

// Or with explicit values
const customConfig = buildLLMConfig({
    provider: 'claude',
    model: 'claude-3-opus',
    apiKey: 'your-api-key',
});

// Check if configured
if (isLLMConfigured(config)) {
    // Use LLM
}
```

### Using Unified Config in agent-daemon

```typescript
import { loadConfig, getUnifiedLLMConfig, isLLMConfigured } from './config.js';

const daemonConfig = loadConfig();
const llmConfig = getUnifiedLLMConfig(daemonConfig);

if (isLLMConfigured(daemonConfig)) {
    // Use unified LLM config
}
```

### Environment Variables

```bash
# Unified approach
export LLM_PROVIDER=claude
export LLM_MODEL=claude-3-sonnet
export LLM_API_KEY=your-api-key

# Or provider-specific
export ANTHROPIC_API_KEY=your-api-key
# LLM_PROVIDER defaults to 'claude' when ANTHROPIC_API_KEY is set
```

## Backward Compatibility

The system maintains backward compatibility:

1. Legacy `judgeProvider` and `judgeModel` still work
2. Provider-specific environment variables are still supported
3. `getLLMProviderConfig()` is marked as deprecated but still functional
4. Old code using `createLLMClient()` continues to work

## Testing

Tests added in:

- `packages/soul-engine/src/llm-config.test.ts` - 16 tests covering all config functions

Run tests:

```bash
cd packages/soul-engine && npm test
```

## Migration Guide

### For Daemon Users

No changes required. The system automatically uses new unified config while maintaining backward compatibility with existing environment variables.

### For Developers

**Old way (still works):**

```typescript
const config = loadConfig();
const llmConfig = getLLMProviderConfig(config.judgeProvider);
```

**New way (recommended):**

```typescript
const config = loadConfig();
const llmConfig = getUnifiedLLMConfig(config);
```

## Files Modified

### soul-engine

- `packages/soul-engine/src/llm-config.ts` (new)
- `packages/soul-engine/src/llm-config.test.ts` (new)
- `packages/soul-engine/src/index.ts`
- `packages/soul-engine/src/matching/llm-analyzer.ts`
- `packages/soul-engine/src/matching/index.ts`
- `packages/soul-engine/tsup.config.ts`
- `packages/soul-engine/package.json`

### agent-daemon

- `apps/agent-daemon/src/config.ts`
- `apps/agent-daemon/src/evaluator/llm-client.ts`
- `apps/agent-daemon/src/evaluator/index.ts`
- `apps/agent-daemon/src/tasks/task-service.ts`
- `apps/agent-daemon/src/daemon.ts`
