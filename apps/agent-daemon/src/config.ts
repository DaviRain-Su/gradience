import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DaemonConfigSchema = z.object({
    port: z.number().int().min(1).max(65535).default(7420),
    host: z
        .string()
        .default('127.0.0.1')
        .refine((h) => h !== '0.0.0.0' || process.env.AGENTD_ALLOW_ALL_INTERFACES === 'true', {
            message: 'Binding to 0.0.0.0 is forbidden for security. Set AGENTD_ALLOW_ALL_INTERFACES=true in Docker.',
        }),
    chainHubUrl: z.string().default('wss://indexer.gradiences.xyz/ws'),
    chainHubRestUrl: z.string().default('https://indexer.gradiences.xyz'),
    solanaRpcUrl: z.string().url().default('https://api.devnet.solana.com'),
    evmRpcUrl: z.string().url().optional(),
    evmChainId: z.number().int().min(1).optional(),
    agentArenaEvmAddress: z.string().optional(),
    agentMRegistryEvmAddress: z.string().optional(),
    defaultChain: z.enum(['solana', 'evm']).default('solana'),
    dbPath: z.string().default(() => join(getDataDir(), 'data.db')),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    maxAgentProcesses: z.number().int().min(1).max(64).default(8),
    heartbeatInterval: z.number().int().min(5000).default(30_000),
    reconnectBaseDelay: z.number().int().min(500).default(1_000),
    reconnectMaxDelay: z.number().int().min(1000).default(30_000),
    reconnectMaxAttempts: z.number().int().min(0).default(0),
    wsFailureThreshold: z.number().int().min(1).default(3),
    restPollingInterval: z.number().int().min(1000).default(5_000),
    connectionHealthMetrics: z.boolean().default(true),
    keyStorage: z.enum(['keychain', 'file']).default('file'),
    // A2A communication
    a2aEnabled: z.boolean().default(true),
    nostrRelays: z.array(z.string().url()).default([
        'wss://relay.damus.io',
        'wss://relay.nostr.band',
        'wss://nos.lol',
        'wss://relay.snort.social',
    ]),
    nostrPrivateKey: z.string().optional(),
    xmtpEnabled: z.boolean().default(false),
    // Unified LLM configuration (for soul-engine and evaluator)
    llmProvider: z.enum(['openai', 'claude', 'moonshot']).default('openai'),
    llmModel: z.string().default('gpt-4'),
    llmApiKey: z.string().default(''),
    llmBaseUrl: z.string().optional(),
    llmTemperature: z.number().min(0).max(1).default(0.3),
    llmMaxTokens: z.number().int().min(1).default(2048),
    llmTimeout: z.number().int().min(1000).default(60000),
    // Evaluator configuration (legacy, will use unified LLM config if not set)
    autoJudge: z.boolean().default(true),
    judgeProvider: z.enum(['openai', 'claude', 'moonshot']).optional(),
    judgeModel: z.string().optional(),
    judgeConfidenceThreshold: z.number().min(0).max(1).default(0.7),
    // Revenue sharing configuration
    revenueSharingEnabled: z.boolean().default(true),
    revenueAutoSettle: z.boolean().default(false),
    revenueAgentPercentage: z.number().int().min(0).max(10000).default(9500),
    revenueJudgePercentage: z.number().int().min(0).max(10000).default(300),
    revenueProtocolPercentage: z.number().int().min(0).max(10000).default(200),
    revenueProtocolTreasury: z.string().optional(),
    revenueJudgePool: z.string().optional(),
    revenueSettlementIntervalMs: z.number().int().min(5000).default(60_000),
    // Payments configuration
    paymentsMppEnabled: z.boolean().default(true),
    paymentsX402Enabled: z.boolean().default(true),
    paymentsTimeoutMs: z.number().int().min(1000).default(5 * 60 * 1000), // 5 minutes
    paymentsAutoConfirm: z.boolean().default(true),
    // Bridge settlement configuration
    bridgeEnabled: z.boolean().default(true),
    bridgeAutoSettle: z.boolean().default(false),
    bridgeProgramId: z.string().default('6G39W7JGQz7A6L5dAvotFuRP9UbFdCJg2BqDuj6WJWec'),
    bridgeKeyDir: z.string().default(() => join(getDataDir(), 'bridge-keys')),
    bridgeTritonApiToken: z.string().optional(),
    bridgeRetryMaxAttempts: z.number().int().min(1).default(3),
    bridgeRetryBaseDelayMs: z.number().int().min(100).default(1000),
    bridgeRetryMaxDelayMs: z.number().int().min(1000).default(30000),
    bridgeConfirmationCommitment: z.enum(['processed', 'confirmed', 'finalized']).default('confirmed'),
    bridgeDistributionAgentBps: z.number().int().min(0).max(10000).default(9500),
    bridgeDistributionJudgeBps: z.number().int().min(0).max(10000).default(300),
    bridgeDistributionProtocolBps: z.number().int().min(0).max(10000).default(200),
    // MagicBlock PER configuration
    magicblockPerEnabled: z.boolean().default(false),
    magicblockTeeValidator: z.string().default('FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA'),
    magicblockErRpcUrl: z.string().url().default('https://devnet-tee.magicblock.app'),
    // Arena auto-judge configuration
    arenaAutoJudgeEnabled: z.boolean().default(false),
    arenaAutoJudgeIntervalMs: z.number().int().min(5000).default(60000),
    arenaAutoJudgeMinSubmissions: z.number().int().min(1).default(1),
    arenaAutoJudgePerEnabled: z.boolean().default(false),
});

export type DaemonConfig = z.infer<typeof DaemonConfigSchema>;

export function getDataDir(): string {
    return join(homedir(), '.agentd');
}

export function loadConfig(overrides: Record<string, unknown> = {}): DaemonConfig {
    let fileConfig: Record<string, unknown> = {};

    const configPaths = [
        join(process.cwd(), 'agentd.json'),
        join(getDataDir(), 'config.json'),
    ];

    for (const configPath of configPaths) {
        if (existsSync(configPath)) {
            try {
                fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
                break;
            } catch {
                // ignore malformed config
            }
        }
    }

    const envConfig: Record<string, unknown> = {};
    if (process.env.AGENTD_PORT) envConfig.port = Number(process.env.AGENTD_PORT);
    if (process.env.AGENTD_HOST) envConfig.host = process.env.AGENTD_HOST;
    if (process.env.AGENTD_CHAIN_HUB_URL) envConfig.chainHubUrl = process.env.AGENTD_CHAIN_HUB_URL;
    if (process.env.AGENTD_CHAIN_HUB_REST_URL) envConfig.chainHubRestUrl = process.env.AGENTD_CHAIN_HUB_REST_URL;
    if (process.env.AGENTD_SOLANA_RPC_URL) envConfig.solanaRpcUrl = process.env.AGENTD_SOLANA_RPC_URL;
    if (process.env.AGENTD_EVM_RPC_URL) envConfig.evmRpcUrl = process.env.AGENTD_EVM_RPC_URL;
    if (process.env.AGENTD_EVM_CHAIN_ID) envConfig.evmChainId = Number(process.env.AGENTD_EVM_CHAIN_ID);
    if (process.env.AGENTD_ARENA_EVM_ADDRESS) envConfig.agentArenaEvmAddress = process.env.AGENTD_ARENA_EVM_ADDRESS;
    if (process.env.AGENTD_REGISTRY_EVM_ADDRESS) envConfig.agentMRegistryEvmAddress = process.env.AGENTD_REGISTRY_EVM_ADDRESS;
    if (process.env.AGENTD_DEFAULT_CHAIN) envConfig.defaultChain = process.env.AGENTD_DEFAULT_CHAIN as any;
    if (process.env.AGENTD_DB_PATH) envConfig.dbPath = process.env.AGENTD_DB_PATH;
    if (process.env.AGENTD_LOG_LEVEL) envConfig.logLevel = process.env.AGENTD_LOG_LEVEL;
    if (process.env.AGENTD_A2A_ENABLED) envConfig.a2aEnabled = process.env.AGENTD_A2A_ENABLED === 'true';
    if (process.env.AGENTD_NOSTR_RELAYS) envConfig.nostrRelays = process.env.AGENTD_NOSTR_RELAYS.split(',');
    if (process.env.AGENTD_NOSTR_PRIVATE_KEY) envConfig.nostrPrivateKey = process.env.AGENTD_NOSTR_PRIVATE_KEY;
    if (process.env.AGENTD_XMTP_ENABLED) envConfig.xmtpEnabled = process.env.AGENTD_XMTP_ENABLED === 'true';
    // Unified LLM configuration environment variables
    if (process.env.LLM_PROVIDER) envConfig.llmProvider = process.env.LLM_PROVIDER;
    if (process.env.LLM_MODEL) envConfig.llmModel = process.env.LLM_MODEL;
    if (process.env.LLM_API_KEY) envConfig.llmApiKey = process.env.LLM_API_KEY;
    if (process.env.LLM_BASE_URL) envConfig.llmBaseUrl = process.env.LLM_BASE_URL;
    if (process.env.LLM_TEMPERATURE) envConfig.llmTemperature = Number(process.env.LLM_TEMPERATURE);
    if (process.env.LLM_MAX_TOKENS) envConfig.llmMaxTokens = Number(process.env.LLM_MAX_TOKENS);
    if (process.env.LLM_TIMEOUT) envConfig.llmTimeout = Number(process.env.LLM_TIMEOUT);
    // Provider-specific API keys
    if (process.env.OPENAI_API_KEY && !process.env.LLM_API_KEY) {
        envConfig.llmApiKey = process.env.OPENAI_API_KEY;
        if (!envConfig.llmProvider) envConfig.llmProvider = 'openai';
    }
    if (process.env.ANTHROPIC_API_KEY && !process.env.LLM_API_KEY) {
        envConfig.llmApiKey = process.env.ANTHROPIC_API_KEY;
        if (!envConfig.llmProvider) envConfig.llmProvider = 'claude';
    }
    if (process.env.MOONSHOT_API_KEY && !process.env.LLM_API_KEY) {
        envConfig.llmApiKey = process.env.MOONSHOT_API_KEY;
        if (!envConfig.llmProvider) envConfig.llmProvider = 'moonshot';
    }
    // Evaluator environment variables
    if (process.env.AGENTD_AUTO_JUDGE) envConfig.autoJudge = process.env.AGENTD_AUTO_JUDGE === 'true';
    if (process.env.AGENTD_JUDGE_PROVIDER) envConfig.judgeProvider = process.env.AGENTD_JUDGE_PROVIDER;
    if (process.env.AGENTD_JUDGE_MODEL) envConfig.judgeModel = process.env.AGENTD_JUDGE_MODEL;
    if (process.env.AGENTD_JUDGE_CONFIDENCE_THRESHOLD) {
        envConfig.judgeConfidenceThreshold = Number(process.env.AGENTD_JUDGE_CONFIDENCE_THRESHOLD);
    }
    // Revenue sharing environment variables
    if (process.env.AGENTD_REVENUE_SHARING_ENABLED) {
        envConfig.revenueSharingEnabled = process.env.AGENTD_REVENUE_SHARING_ENABLED === 'true';
    }
    if (process.env.AGENTD_REVENUE_AUTO_SETTLE) {
        envConfig.revenueAutoSettle = process.env.AGENTD_REVENUE_AUTO_SETTLE === 'true';
    }
    if (process.env.AGENTD_REVENUE_AGENT_PERCENTAGE) {
        envConfig.revenueAgentPercentage = Number(process.env.AGENTD_REVENUE_AGENT_PERCENTAGE);
    }
    if (process.env.AGENTD_REVENUE_JUDGE_PERCENTAGE) {
        envConfig.revenueJudgePercentage = Number(process.env.AGENTD_REVENUE_JUDGE_PERCENTAGE);
    }
    if (process.env.AGENTD_REVENUE_PROTOCOL_PERCENTAGE) {
        envConfig.revenueProtocolPercentage = Number(process.env.AGENTD_REVENUE_PROTOCOL_PERCENTAGE);
    }
    if (process.env.AGENTD_REVENUE_PROTOCOL_TREASURY) {
        envConfig.revenueProtocolTreasury = process.env.AGENTD_REVENUE_PROTOCOL_TREASURY;
    }
    if (process.env.AGENTD_REVENUE_JUDGE_POOL) {
        envConfig.revenueJudgePool = process.env.AGENTD_REVENUE_JUDGE_POOL;
    }
    if (process.env.AGENTD_REVENUE_SETTLEMENT_INTERVAL) {
        envConfig.revenueSettlementIntervalMs = Number(process.env.AGENTD_REVENUE_SETTLEMENT_INTERVAL);
    }
    // Payments configuration environment variables
    if (process.env.AGENTD_PAYMENTS_MPP_ENABLED) {
        envConfig.paymentsMppEnabled = process.env.AGENTD_PAYMENTS_MPP_ENABLED === 'true';
    }
    if (process.env.AGENTD_PAYMENTS_X402_ENABLED) {
        envConfig.paymentsX402Enabled = process.env.AGENTD_PAYMENTS_X402_ENABLED === 'true';
    }
    if (process.env.AGENTD_PAYMENTS_TIMEOUT_MS) {
        envConfig.paymentsTimeoutMs = Number(process.env.AGENTD_PAYMENTS_TIMEOUT_MS);
    }
    if (process.env.AGENTD_PAYMENTS_AUTO_CONFIRM) {
        envConfig.paymentsAutoConfirm = process.env.AGENTD_PAYMENTS_AUTO_CONFIRM === 'true';
    }
    // Bridge settlement environment variables
    if (process.env.AGENTD_BRIDGE_ENABLED) {
        envConfig.bridgeEnabled = process.env.AGENTD_BRIDGE_ENABLED === 'true';
    }
    if (process.env.AGENTD_BRIDGE_AUTO_SETTLE) {
        envConfig.bridgeAutoSettle = process.env.AGENTD_BRIDGE_AUTO_SETTLE === 'true';
    }
    if (process.env.AGENTD_BRIDGE_PROGRAM_ID) {
        envConfig.bridgeProgramId = process.env.AGENTD_BRIDGE_PROGRAM_ID;
    }
    if (process.env.AGENTD_BRIDGE_KEY_DIR) {
        envConfig.bridgeKeyDir = process.env.AGENTD_BRIDGE_KEY_DIR;
    }
    if (process.env.AGENTD_BRIDGE_TRITON_API_TOKEN) {
        envConfig.bridgeTritonApiToken = process.env.AGENTD_BRIDGE_TRITON_API_TOKEN;
    }
    if (process.env.AGENTD_BRIDGE_RETRY_MAX_ATTEMPTS) {
        envConfig.bridgeRetryMaxAttempts = Number(process.env.AGENTD_BRIDGE_RETRY_MAX_ATTEMPTS);
    }
    if (process.env.AGENTD_BRIDGE_RETRY_BASE_DELAY_MS) {
        envConfig.bridgeRetryBaseDelayMs = Number(process.env.AGENTD_BRIDGE_RETRY_BASE_DELAY_MS);
    }
    if (process.env.AGENTD_BRIDGE_RETRY_MAX_DELAY_MS) {
        envConfig.bridgeRetryMaxDelayMs = Number(process.env.AGENTD_BRIDGE_RETRY_MAX_DELAY_MS);
    }
    if (process.env.AGENTD_BRIDGE_CONFIRMATION_COMMITMENT) {
        envConfig.bridgeConfirmationCommitment = process.env.AGENTD_BRIDGE_CONFIRMATION_COMMITMENT as any;
    }
    if (process.env.AGENTD_BRIDGE_DISTRIBUTION_AGENT_BPS) {
        envConfig.bridgeDistributionAgentBps = Number(process.env.AGENTD_BRIDGE_DISTRIBUTION_AGENT_BPS);
    }
    if (process.env.AGENTD_BRIDGE_DISTRIBUTION_JUDGE_BPS) {
        envConfig.bridgeDistributionJudgeBps = Number(process.env.AGENTD_BRIDGE_DISTRIBUTION_JUDGE_BPS);
    }
    if (process.env.AGENTD_BRIDGE_DISTRIBUTION_PROTOCOL_BPS) {
        envConfig.bridgeDistributionProtocolBps = Number(process.env.AGENTD_BRIDGE_DISTRIBUTION_PROTOCOL_BPS);
    }
    if (process.env.AGENTD_MAGICBLOCK_PER_ENABLED) {
        envConfig.magicblockPerEnabled = process.env.AGENTD_MAGICBLOCK_PER_ENABLED === 'true';
    }
    if (process.env.AGENTD_MAGICBLOCK_TEE_VALIDATOR) {
        envConfig.magicblockTeeValidator = process.env.AGENTD_MAGICBLOCK_TEE_VALIDATOR;
    }
    if (process.env.AGENTD_MAGICBLOCK_ER_RPC_URL) {
        envConfig.magicblockErRpcUrl = process.env.AGENTD_MAGICBLOCK_ER_RPC_URL;
    }
    if (process.env.AGENTD_ARENA_AUTO_JUDGE_ENABLED) {
        envConfig.arenaAutoJudgeEnabled = process.env.AGENTD_ARENA_AUTO_JUDGE_ENABLED === 'true';
    }
    if (process.env.AGENTD_ARENA_AUTO_JUDGE_INTERVAL_MS) {
        envConfig.arenaAutoJudgeIntervalMs = Number(process.env.AGENTD_ARENA_AUTO_JUDGE_INTERVAL_MS);
    }
    if (process.env.AGENTD_ARENA_AUTO_JUDGE_MIN_SUBMISSIONS) {
        envConfig.arenaAutoJudgeMinSubmissions = Number(process.env.AGENTD_ARENA_AUTO_JUDGE_MIN_SUBMISSIONS);
    }
    if (process.env.AGENTD_ARENA_AUTO_JUDGE_PER_ENABLED) {
        envConfig.arenaAutoJudgePerEnabled = process.env.AGENTD_ARENA_AUTO_JUDGE_PER_ENABLED === 'true';
    }

    const merged = { ...fileConfig, ...envConfig, ...overrides };
    return DaemonConfigSchema.parse(merged);
}

// ============================================================================
// Unified LLM Provider Configuration
// ============================================================================

export type LLMProvider = 'openai' | 'claude' | 'moonshot';

export interface UnifiedLLMConfig {
    provider: LLMProvider;
    model: string;
    apiKey: string;
    baseUrl?: string;
    temperature: number;
    maxTokens: number;
    timeout: number;
}

/**
 * Get unified LLM configuration from daemon config
 * This is used by both evaluator and soul-engine
 */
export function getUnifiedLLMConfig(config: DaemonConfig): UnifiedLLMConfig {
    return {
        provider: config.llmProvider,
        model: config.llmModel,
        apiKey: config.llmApiKey,
        baseUrl: config.llmBaseUrl,
        temperature: config.llmTemperature,
        maxTokens: config.llmMaxTokens,
        timeout: config.llmTimeout,
    };
}

/**
 * Get evaluator LLM configuration from daemon config
 * Falls back to unified config if judge-specific config not set
 */
export function getEvaluatorLLMConfig(config: DaemonConfig): {
    provider: LLMProvider;
    model: string;
} {
    return {
        provider: config.judgeProvider ?? config.llmProvider,
        model: config.judgeModel ?? config.llmModel,
    };
}

/**
 * Check if LLM is properly configured
 */
export function isLLMConfigured(config: DaemonConfig): boolean {
    return !!config.llmApiKey;
}

// ============================================================================
// Legacy LLM Provider Configuration (for backward compatibility)
// ============================================================================

export interface LLMProviderConfig {
    baseUrl: string;
    apiKey: string;
    model: string;
}

/**
 * @deprecated Use getUnifiedLLMConfig instead
 */
export function getLLMProviderConfig(provider: 'openai' | 'claude' | 'moonshot'): LLMProviderConfig {
    const configs: Record<string, LLMProviderConfig> = {
        openai: {
            baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
            apiKey: process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || '',
            model: process.env.OPENAI_MODEL || process.env.LLM_MODEL || 'gpt-4',
        },
        claude: {
            baseUrl: process.env.CLAUDE_BASE_URL || 'https://api.anthropic.com/v1',
            apiKey: process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY || '',
            model: process.env.CLAUDE_MODEL || process.env.LLM_MODEL || 'claude-3-sonnet-20240229',
        },
        moonshot: {
            baseUrl: process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1',
            apiKey: process.env.MOONSHOT_API_KEY || process.env.LLM_API_KEY || '',
            model: process.env.MOONSHOT_MODEL || process.env.LLM_MODEL || 'moonshot-v1-8k',
        },
    };

    return configs[provider] ?? configs.openai;
}
