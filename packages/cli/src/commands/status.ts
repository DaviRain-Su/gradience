import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { GradienceSDK } from '@gradiences/sdk';
import { ConfigManager } from '../config.js';
import { parseU64, outputResult, outputError, isMockMode, isNoJsonMode } from '../utils.js';

export const statusCommand = new Command('status');
statusCommand
    .description('Check task status')
    .argument('<task-id>', 'Task ID to check')
    .action(async (taskIdStr: string) => {
        const spinner = ora('Fetching task status...').start();
        
        try {
            const taskId = parseU64(taskIdStr, 'task-id');
            
            if (isMockMode()) {
                const state = process.env.GRADIENCE_CLI_MOCK_STATE ?? 'Open';
                const submissionCount = BigInt(process.env.GRADIENCE_CLI_MOCK_SUBMISSION_COUNT ?? '0');
                
                spinner.succeed('Task status fetched (mock mode)');
                emitStatus(Number(taskId), state, submissionCount);
                return;
            }

            const config = new ConfigManager();
            const rpcUrl = await config.get('rpc');
            
            // For status checks, we can use the indexer without requiring a keypair
            const indexerEndpoint = process.env.GRADIENCE_INDEXER_ENDPOINT;
            const statusSdkOptions = {
                ...(rpcUrl !== undefined && { rpcEndpoint: rpcUrl }),
                ...(indexerEndpoint !== undefined && { indexerEndpoint }),
            };
            const sdk = new GradienceSDK(statusSdkOptions);

            spinner.text = 'Querying task data...';
            const task = await sdk.getTask(Number(taskId));
            
            if (!task) {
                spinner.fail('Task not found');
                outputError(new Error(`Task ${taskId.toString()} not found`), 'NOT_FOUND');
                process.exit(1);
                return;
            }

            spinner.succeed('Task status retrieved');
            
            const state = toCliTaskState(task.state);
            emitStatus(Number(taskId), state, BigInt(task.submission_count));
            
            // Show additional details in non-JSON mode
            if (!isNoJsonMode()) {
                console.log('');
                console.log(chalk.bold('Task Details:'));
                console.log(`  ID: ${task.task_id}`);
                console.log(`  Poster: ${task.poster}`);
                console.log(`  Judge: ${task.judge}`);
                console.log(`  Reward: ${task.reward} lamports`);
                console.log(`  Min Stake: ${task.min_stake} lamports`);
                console.log(`  Category: ${task.category}`);
                console.log(`  Judge Mode: ${task.judge_mode}`);
                console.log(`  Deadline: ${new Date(task.deadline * 1000).toISOString()}`);
                console.log(`  Judge Deadline: ${new Date(task.judge_deadline * 1000).toISOString()}`);
                console.log(`  Created: ${new Date(task.created_at * 1000).toISOString()}`);
                
                if (task.winner) {
                    console.log(`  Winner: ${task.winner}`);
                }
                
                if (task.eval_ref) {
                    console.log(`  Evaluation: ${task.eval_ref}`);
                }
            }
        } catch (error) {
            spinner.fail('Failed to fetch task status');
            outputError(error, 'STATUS_ERROR');
            process.exit(1);
        }
    });

function emitStatus(taskId: number, state: string, submissionCount: bigint): void {
    if (isNoJsonMode()) {
        outputResult({
            taskId,
            state,
            submissionCount: Number(submissionCount),
        });
    } else {
        console.log(
            `Task ${taskId}: ${chalk.bold(state)}, ${submissionCount.toString()} submission(s)`
        );
    }
}

function toCliTaskState(value: string): string {
    if (value === 'open') {
        return 'Open';
    }
    if (value === 'completed') {
        return 'Completed';
    }
    if (value === 'refunded') {
        return 'Refunded';
    }
    return value;
}