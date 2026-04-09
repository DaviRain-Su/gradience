#!/usr/bin/env node

/**
 * Main entry point for Gradience CLI
 */

import { loadConfig, updateConfig } from './utils/config.js';

import { printJson, isNoDnaMode, shouldShowHelp, printHelp } from './utils/output.js';

import { handleTaskCommand } from './commands/task.js';

import { handleJudgeCommand } from './commands/judge.js';

import { handleProfileCommand } from './commands/profile.js';

import { CliError, type ConfigKey, isTaskCommand, isJudgeCommand, isProfileCommand } from './types.js';

function isSupportedConfigKey(value: string): value is ConfigKey {
    return value === 'rpc' || value === 'keypair';
}

function normalizeError(error: unknown): { code: string; message: string } {
    if (error instanceof CliError) {
        return { code: error.code, message: error.message };
    }
    if (error instanceof Error) {
        return { code: 'UNKNOWN_ERROR', message: error.message };
    }
    return { code: 'UNKNOWN_ERROR', message: String(error) };
}

export async function main(): Promise<number> {
    const args = process.argv.slice(2);
    const noDna = isNoDnaMode(process.env);

    try {
        if (shouldShowHelp(args)) {
            printHelp(noDna);
            return 0;
        }

        if (args[0] === 'config' && args[1] === 'set') {
            const key = args[2];
            const value = args[3];
            if (!key || !value || !isSupportedConfigKey(key) || args.length !== 4) {
                throw new CliError('INVALID_ARGUMENT', 'Usage: gradience config set <rpc|keypair> <value>');
            }
            const configPath = await updateConfig(key, value, process.env);
            if (noDna) {
                printJson({
                    ok: true,
                    timestamp: new Date().toISOString(),
                    path: configPath,
                    updated: { [key]: value },
                });
            } else {
                process.stdout.write(`Updated ${key} in ${configPath}\n`);
            }
            return 0;
        }

        if (args[0] === 'task') {
            await handleTaskCommand(args.slice(1), process.env, noDna);
            return 0;
        }

        if (args[0] === 'judge') {
            await handleJudgeCommand(args.slice(1), process.env, noDna);
            return 0;
        }

        if (args[0] === 'profile') {
            await handleProfileCommand(args.slice(1), process.env, noDna);
            return 0;
        }

        throw new CliError('UNKNOWN_COMMAND', `Unknown command: ${args.join(' ') || '(empty)'}. Use --help for usage.`);
    } catch (error) {
        const normalized = normalizeError(error);
        if (noDna) {
            process.stderr.write(
                `${JSON.stringify({
                    ok: false,
                    timestamp: new Date().toISOString(),
                    error: normalized,
                })}\n`,
            );
        } else {
            process.stderr.write(`Error [${normalized.code}]: ${normalized.message}\n`);
        }
        return 1;
    }
}
