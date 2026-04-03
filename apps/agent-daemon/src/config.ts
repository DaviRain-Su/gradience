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
    chainHubUrl: z.string().url().default('wss://indexer.gradiences.xyz/ws'),
    chainHubRestUrl: z.string().url().default('https://indexer.gradiences.xyz'),
    solanaRpcUrl: z.string().url().default('https://api.devnet.solana.com'),
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
    if (process.env.AGENTD_DB_PATH) envConfig.dbPath = process.env.AGENTD_DB_PATH;
    if (process.env.AGENTD_LOG_LEVEL) envConfig.logLevel = process.env.AGENTD_LOG_LEVEL;

    const merged = { ...fileConfig, ...envConfig, ...overrides };
    return DaemonConfigSchema.parse(merged);
}
