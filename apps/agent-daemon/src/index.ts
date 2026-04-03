#!/usr/bin/env node

import { loadConfig } from './config.js';
import { Daemon } from './daemon.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const command = args[0] ?? 'start';

    if (command === '--help' || command === '-h') {
        console.log(`
agentd - Gradience Agent Daemon

Usage:
  agentd start [options]    Start the daemon
  agentd --help             Show this help

Environment variables:
  AGENTD_PORT               API port (default: 7420)
  AGENTD_HOST               Bind host (default: 127.0.0.1)
  AGENTD_CHAIN_HUB_URL      Chain Hub WebSocket URL
  AGENTD_SOLANA_RPC_URL      Solana RPC URL
  AGENTD_DB_PATH             SQLite database path
  AGENTD_LOG_LEVEL           Log level (debug|info|warn|error)

Config files (checked in order):
  ./agentd.json
  ~/.agentd/config.json
`);
        process.exit(0);
    }

    if (command !== 'start') {
        console.error(`Unknown command: ${command}. Use --help for usage.`);
        process.exit(1);
    }

    const overrides: Record<string, unknown> = {};
    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--port' && args[i + 1]) {
            overrides.port = Number(args[++i]);
        } else if (args[i] === '--chain-hub-url' && args[i + 1]) {
            overrides.chainHubUrl = args[++i];
        }
    }

    const config = loadConfig(overrides);
    const daemon = new Daemon(config);

    const shutdown = async (signal: string) => {
        logger.info({ signal }, 'Received shutdown signal');
        await daemon.stop();
        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    await daemon.start();
}

main().catch((err) => {
    logger.fatal({ err }, 'Failed to start Agent Daemon');
    process.exit(1);
});
