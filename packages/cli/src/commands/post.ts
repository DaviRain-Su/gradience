import { Command } from 'commander';
import ora from 'ora';
import { GradienceSDK, KeypairAdapter } from '@gradiences/sdk';
import { ConfigManager } from '../config.js';
import { loadKeypairSigner, parseU64, parseAddress, outputResult, outputError, isMockMode } from '../utils.js';

export const postCommand = new Command('post');
postCommand
    .description('Create a new task on-chain')
    .requiredOption('--task-id <id>', 'Task ID')
    .requiredOption('--eval-ref <cid>', 'Evaluation reference (IPFS CID)')
    .requiredOption('--reward <lamports>', 'Reward amount in lamports')
    .option('--category <n>', 'Task category (0-7)', '0')
    .option('--min-stake <lamports>', 'Minimum stake amount', '0')
    .option('--judge-mode <mode>', 'Judge mode: pool or designated', 'pool')
    .option('--judge <address>', 'Judge address (required for designated mode)')
    .option('--deadline <timestamp>', 'Task deadline (unix timestamp)')
    .option('--judge-deadline <timestamp>', 'Judge deadline (unix timestamp)')
    .option('--mint <address>', 'Token mint address (defaults to SOL)')
    .action(async (options) => {
        const spinner = ora('Creating task...').start();
        
        try {
            if (isMockMode()) {
                const signature = process.env.GRADIENCE_CLI_MOCK_SIGNATURE ?? `mock-post-signature`;
                spinner.succeed('Task created (mock mode)');
                outputResult({
                    signature,
                    taskId: Number(parseU64(options.taskId, 'task-id')),
                });
                return;
            }

            const config = new ConfigManager();
            const rpcUrl = await config.get('rpc');
            const keypairPath = await config.get('keypair');

            if (!rpcUrl) {
                throw new Error('RPC URL not configured. Run: gradience config set rpc <url>');
            }

            if (!keypairPath) {
                throw new Error('Keypair not configured. Run: gradience config set keypair <path>');
            }

            const signer = await loadKeypairSigner(keypairPath);
            const wallet = new KeypairAdapter({ signer, rpcEndpoint: rpcUrl });
            const sdk = new GradienceSDK({ rpcEndpoint: rpcUrl });

            const taskId = parseU64(options.taskId, 'task-id');
            const category = Number(parseU64(options.category ?? '0', 'category'));
            const minStake = parseU64(options.minStake ?? '0', 'min-stake');
            const reward = parseU64(options.reward, 'reward');
            
            const judgeModeStr = (options.judgeMode ?? 'pool').toLowerCase();
            if (judgeModeStr !== 'pool' && judgeModeStr !== 'designated') {
                throw new Error('--judge-mode must be "pool" or "designated"');
            }
            
            const judgeMode = judgeModeStr === 'designated' ? 0 : 1;
            const judge = judgeModeStr === 'designated' 
                ? parseAddress(options.judge, 'judge')
                : options.judge ? parseAddress(options.judge, 'judge') : undefined;

            const now = BigInt(Math.floor(Date.now() / 1000));
            const deadline = options.deadline ? parseU64(options.deadline, 'deadline') : now + 86_400n;
            const judgeDeadline = options.judgeDeadline ? parseU64(options.judgeDeadline, 'judge-deadline') : deadline + 86_400n;
            const mint = options.mint ? parseAddress(options.mint, 'mint') : undefined;

            spinner.text = 'Submitting transaction...';
            const signature = await sdk.task.post(wallet, {
                taskId,
                evalRef: options.evalRef,
                reward,
                category,
                minStake,
                judgeMode,
                judge,
                deadline,
                judgeDeadline,
                mint,
            });

            spinner.succeed('Task created successfully');
            outputResult({
                signature,
                taskId: Number(taskId),
                evalRef: options.evalRef,
                reward: Number(reward),
                category,
            });
        } catch (error) {
            spinner.fail('Failed to create task');
            outputError(error, 'TASK_POST_ERROR');
            process.exit(1);
        }
    });