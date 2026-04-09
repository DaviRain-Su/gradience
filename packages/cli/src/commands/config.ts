import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../config.js';
import { isNoJsonMode } from '../utils.js';

export const configCommand = new Command('config');
configCommand.description('Configuration management');

configCommand
    .command('set')
    .description('Set configuration value')
    .argument('<key>', 'Configuration key (rpc|keypair)')
    .argument('<value>', 'Configuration value')
    .action(async (key: string, value: string) => {
        try {
            const config = new ConfigManager();

            if (key !== 'rpc' && key !== 'keypair') {
                throw new Error('Config key must be "rpc" or "keypair"');
            }

            await config.set(key, value);

            if (isNoJsonMode()) {
                console.log(
                    JSON.stringify({
                        ok: true,
                        timestamp: new Date().toISOString(),
                        path: config.getPath(),
                        updated: { [key]: value },
                    }),
                );
            } else {
                console.log(chalk.green('✓'), `Updated ${key} in ${config.getPath()}`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (isNoJsonMode()) {
                console.error(
                    JSON.stringify({
                        ok: false,
                        timestamp: new Date().toISOString(),
                        error: { code: 'CONFIG_ERROR', message },
                    }),
                );
            } else {
                console.error(chalk.red('Error:'), message);
            }
            process.exit(1);
        }
    });

configCommand
    .command('get')
    .description('Get configuration value')
    .argument('<key>', 'Configuration key (rpc|keypair)')
    .action(async (key: string) => {
        try {
            const config = new ConfigManager();

            if (key !== 'rpc' && key !== 'keypair') {
                throw new Error('Config key must be "rpc" or "keypair"');
            }

            const value = await config.get(key);

            if (isNoJsonMode()) {
                console.log(
                    JSON.stringify({
                        ok: true,
                        timestamp: new Date().toISOString(),
                        key,
                        value: value ?? null,
                    }),
                );
            } else {
                if (value) {
                    console.log(`${key}: ${value}`);
                } else {
                    console.log(`${key}: (not set)`);
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (isNoJsonMode()) {
                console.error(
                    JSON.stringify({
                        ok: false,
                        timestamp: new Date().toISOString(),
                        error: { code: 'CONFIG_ERROR', message },
                    }),
                );
            } else {
                console.error(chalk.red('Error:'), message);
            }
            process.exit(1);
        }
    });

configCommand
    .command('show')
    .description('Show all configuration values')
    .action(async () => {
        try {
            const config = new ConfigManager();
            const allConfig = await config.load();

            if (isNoJsonMode()) {
                console.log(
                    JSON.stringify({
                        ok: true,
                        timestamp: new Date().toISOString(),
                        config: allConfig,
                        path: config.getPath(),
                    }),
                );
            } else {
                console.log(chalk.bold('Configuration:'));
                console.log(`Path: ${config.getPath()}`);
                console.log(`RPC: ${allConfig.rpc ?? '(not set)'}`);
                console.log(`Keypair: ${allConfig.keypair ?? '(not set)'}`);
                if (allConfig.updatedAt) {
                    console.log(`Last updated: ${allConfig.updatedAt}`);
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (isNoJsonMode()) {
                console.error(
                    JSON.stringify({
                        ok: false,
                        timestamp: new Date().toISOString(),
                        error: { code: 'CONFIG_ERROR', message },
                    }),
                );
            } else {
                console.error(chalk.red('Error:'), message);
            }
            process.exit(1);
        }
    });
