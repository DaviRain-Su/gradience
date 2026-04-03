#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { postCommand } from './commands/post.js';
import { applyCommand } from './commands/apply.js';
import { submitCommand } from './commands/submit.js';
import { judgeCommand, judgeTaskCommand } from './commands/judge.js';
import { statusCommand } from './commands/status.js';
import { refundCommand } from './commands/refund.js';
import { listCommand } from './commands/list.js';
import { configCommand } from './commands/config.js';

const program = new Command();

program
    .name('gradience')
    .description('CLI for Gradience protocol - decentralized task marketplace')
    .version('0.1.0');

// Configuration commands
program
    .addCommand(configCommand);

// Task commands group
const taskCommand = new Command('task');
taskCommand.description('Task management commands');

taskCommand.addCommand(postCommand);
taskCommand.addCommand(applyCommand);
taskCommand.addCommand(submitCommand);
taskCommand.addCommand(statusCommand);
taskCommand.addCommand(refundCommand);
taskCommand.addCommand(judgeTaskCommand);

program.addCommand(taskCommand);

// Judge commands group  
const judgeCmd = new Command('judge');
judgeCmd.description('Judge management commands');

judgeCmd
    .command('register')
    .description('Register as a judge for task categories')
    .requiredOption('--category <categories>', 'Comma-separated category names or IDs')
    .option('--stake-amount <lamports>', 'Stake amount in lamports')
    .action(async (options) => {
        try {
            await judgeCommand.register(options);
        } catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

judgeCmd
    .command('unstake')
    .description('Unstake and leave judge pools')
    .action(async () => {
        try {
            await judgeCommand.unstake();
        } catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

program.addCommand(judgeCmd);

// Profile commands group
const profileCmd = new Command('profile');
profileCmd.description('Agent profile management commands');

profileCmd
    .command('show')
    .description('Show agent profile')
    .option('--agent <address>', 'Agent address (defaults to local keypair)')
    .action(async (options) => {
        try {
            const { showProfile } = await import('./commands/profile.js');
            await showProfile(options);
        } catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

profileCmd
    .command('update')
    .description('Update agent profile')
    .option('--agent <address>', 'Agent address (defaults to local keypair)')
    .option('--display-name <name>', 'Display name')
    .option('--bio <text>', 'Biography text')
    .option('--website <url>', 'Website URL')
    .option('--github <url>', 'GitHub URL')
    .option('--x <url>', 'X (Twitter) URL')
    .option('--publish-mode <mode>', 'Publish mode: manual or git-sync')
    .action(async (options) => {
        try {
            const { updateProfile } = await import('./commands/profile.js');
            await updateProfile(options);
        } catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

profileCmd
    .command('publish')
    .description('Publish profile on-chain reference')
    .option('--agent <address>', 'Agent address (defaults to local keypair)')
    .option('--mode <mode>', 'Publish mode: manual or git-sync')
    .option('--content-ref <cid-or-hash>', 'Content reference')
    .action(async (options) => {
        try {
            const { publishProfile } = await import('./commands/profile.js');
            await publishProfile(options);
        } catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

program.addCommand(profileCmd);

// List command
program.addCommand(listCommand);

// Create agent project command
program
    .command('create-agent')
    .description('Create a new agent project')
    .argument('<name>', 'Agent project name')
    .option('--template <template>', 'Template to use', 'basic')
    .action(async (name: string, options) => {
        try {
            const { createAgentCommand } = await import('./commands/create-agent.js');
            await createAgentCommand(name, options);
        } catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

// Global error handling
process.on('unhandledRejection', (reason) => {
    console.error(chalk.red('Unhandled rejection:'), reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error(chalk.red('Uncaught exception:'), error);
    process.exit(1);
});

// Parse arguments
program.parse();