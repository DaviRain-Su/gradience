import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { GradienceSDK } from '@gradiences/sdk';
import { ConfigManager } from '../config.js';
import { outputResult, outputError, isMockMode, isNoJsonMode } from '../utils.js';

export const listCommand = new Command('list');
listCommand
    .description('List tasks from the indexer')
    .option('--status <status>', 'Filter by status: open, completed, refunded')
    .option('--category <category>', 'Filter by category (0-7)')
    .option('--poster <address>', 'Filter by poster address')
    .option('--mint <address>', 'Filter by token mint')
    .option('--limit <number>', 'Maximum number of tasks to return', '10')
    .option('--offset <number>', 'Number of tasks to skip', '0')
    .action(async (options) => {
        const spinner = ora('Fetching tasks...').start();
        
        try {
            if (isMockMode()) {
                const mockTasks = generateMockTasks(options);
                spinner.succeed('Tasks fetched (mock mode)');
                emitTaskList(mockTasks);
                return;
            }

            const config = new ConfigManager();
            const rpcUrl = await config.get('rpc');
            const indexerEndpoint = process.env.GRADIENCE_INDEXER_ENDPOINT;
            
            const sdkOptions = {
                ...(rpcUrl !== undefined && { rpcEndpoint: rpcUrl }),
                ...(indexerEndpoint !== undefined && { indexerEndpoint }),
            };
            const sdk = new GradienceSDK(sdkOptions);

            const params: any = {};
            
            if (options.status) {
                if (!['open', 'completed', 'refunded'].includes(options.status)) {
                    throw new Error('Status must be one of: open, completed, refunded');
                }
                params.status = options.status;
            }
            
            if (options.category) {
                const category = Number(options.category);
                if (!Number.isInteger(category) || category < 0 || category > 7) {
                    throw new Error('Category must be a number between 0 and 7');
                }
                params.category = category;
            }
            
            if (options.poster) {
                params.poster = options.poster;
            }
            
            if (options.mint) {
                params.mint = options.mint;
            }
            
            if (options.limit) {
                const limit = Number(options.limit);
                if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
                    throw new Error('Limit must be a number between 1 and 100');
                }
                params.limit = limit;
            }
            
            if (options.offset) {
                const offset = Number(options.offset);
                if (!Number.isInteger(offset) || offset < 0) {
                    throw new Error('Offset must be a non-negative number');
                }
                params.offset = offset;
            }

            spinner.text = 'Querying indexer...';
            const tasks = await sdk.getTasks(params);

            spinner.succeed(`Found ${tasks.length} task(s)`);
            emitTaskList(tasks);
        } catch (error) {
            spinner.fail('Failed to fetch tasks');
            outputError(error, 'LIST_ERROR');
            process.exit(1);
        }
    });

// Add subcommand for submissions
listCommand
    .command('submissions')
    .description('List submissions for a specific task')
    .argument('<task-id>', 'Task ID')
    .option('--sort <field>', 'Sort by: score, slot', 'slot')
    .action(async (taskIdStr: string, options) => {
        const spinner = ora('Fetching submissions...').start();
        
        try {
            const taskId = Number(taskIdStr);
            if (!Number.isInteger(taskId) || taskId < 0) {
                throw new Error('Task ID must be a non-negative integer');
            }
            
            if (isMockMode()) {
                const mockSubmissions = generateMockSubmissions(taskId);
                spinner.succeed('Submissions fetched (mock mode)');
                emitSubmissionList(mockSubmissions);
                return;
            }

            const config = new ConfigManager();
            const rpcUrl = await config.get('rpc');
            const indexerEndpoint = process.env.GRADIENCE_INDEXER_ENDPOINT;
            
            const sdkOptions2 = {
                ...(rpcUrl !== undefined && { rpcEndpoint: rpcUrl }),
                ...(indexerEndpoint !== undefined && { indexerEndpoint }),
            };
            const sdk = new GradienceSDK(sdkOptions2);

            const sortField = options.sort === 'score' ? 'score' : 'slot';

            spinner.text = 'Querying submissions...';
            const submissions = await sdk.task.submissions(taskId, { sort: sortField });

            if (!submissions) {
                spinner.fail('Task not found');
                outputError(new Error(`Task ${taskId} not found or has no submissions`), 'NOT_FOUND');
                process.exit(1);
                return;
            }

            spinner.succeed(`Found ${submissions.length} submission(s)`);
            emitSubmissionList(submissions);
        } catch (error) {
            spinner.fail('Failed to fetch submissions');
            outputError(error, 'SUBMISSIONS_ERROR');
            process.exit(1);
        }
    });

function emitTaskList(tasks: any[]): void {
    if (isNoJsonMode()) {
        outputResult({ tasks, count: tasks.length });
        return;
    }

    if (tasks.length === 0) {
        console.log(chalk.yellow('No tasks found'));
        return;
    }

    console.log(chalk.bold(`\nTasks (${tasks.length}):\n`));
    
    for (const task of tasks) {
        const statusColor = getStatusColor(task.state);
        console.log(`${chalk.bold(`Task #${task.task_id}`)} - ${statusColor(task.state)}`);
        console.log(`  Poster: ${task.poster}`);
        console.log(`  Reward: ${task.reward} lamports`);
        console.log(`  Category: ${task.category}`);
        console.log(`  Submissions: ${task.submission_count}`);
        console.log(`  Deadline: ${new Date(task.deadline * 1000).toLocaleDateString()}`);
        if (task.winner) {
            console.log(`  Winner: ${task.winner}`);
        }
        console.log('');
    }
}

function emitSubmissionList(submissions: any[]): void {
    if (isNoJsonMode()) {
        outputResult({ submissions, count: submissions.length });
        return;
    }

    if (submissions.length === 0) {
        console.log(chalk.yellow('No submissions found'));
        return;
    }

    console.log(chalk.bold(`\nSubmissions (${submissions.length}):\n`));
    
    for (const submission of submissions) {
        console.log(`${chalk.bold(`Agent:`)} ${submission.agent}`);
        console.log(`  Result: ${submission.result_ref}`);
        console.log(`  Trace: ${submission.trace_ref}`);
        console.log(`  Runtime: ${submission.runtime_provider}/${submission.runtime_model}`);
        console.log(`  Submitted: ${new Date(submission.submitted_at * 1000).toLocaleString()}`);
        console.log('');
    }
}

function getStatusColor(status: string) {
    switch (status.toLowerCase()) {
        case 'open':
            return chalk.green;
        case 'completed':
            return chalk.blue;
        case 'refunded':
            return chalk.red;
        default:
            return chalk.gray;
    }
}

function generateMockTasks(options: any): any[] {
    const count = Math.min(Number(options.limit) || 10, 5);
    const tasks = [];
    
    for (let i = 0; i < count; i++) {
        tasks.push({
            task_id: 1000 + i,
            poster: `11111111111111111111111111111111111111111${i}`,
            judge: `22222222222222222222222222222222222222222${i}`,
            judge_mode: 'pool',
            reward: 1000000 * (i + 1),
            mint: '11111111111111111111111111111112',
            min_stake: 100000,
            state: ['open', 'completed', 'refunded'][i % 3],
            category: i % 8,
            eval_ref: `QmMockEval${i}`,
            deadline: Math.floor(Date.now() / 1000) + 86400 * (i + 1),
            judge_deadline: Math.floor(Date.now() / 1000) + 86400 * (i + 2),
            submission_count: Math.floor(Math.random() * 5),
            winner: i % 3 === 1 ? `33333333333333333333333333333333333333333${i}` : null,
            created_at: Math.floor(Date.now() / 1000) - 86400 * i,
            slot: 1000 + i,
        });
    }
    
    return tasks;
}

function generateMockSubmissions(taskId: number): any[] {
    const count = Math.floor(Math.random() * 3) + 1;
    const submissions = [];
    
    for (let i = 0; i < count; i++) {
        submissions.push({
            task_id: taskId,
            agent: `44444444444444444444444444444444444444444${i}`,
            result_ref: `QmMockResult${taskId}-${i}`,
            trace_ref: `QmMockTrace${taskId}-${i}`,
            runtime_provider: 'openai',
            runtime_model: 'gpt-4',
            runtime_runtime: 'node',
            runtime_version: '20',
            submission_slot: 2000 + i,
            submitted_at: Math.floor(Date.now() / 1000) - 3600 * i,
        });
    }
    
    return submissions;
}