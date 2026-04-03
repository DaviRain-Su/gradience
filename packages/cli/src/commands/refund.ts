import { Command } from 'commander';
import ora from 'ora';
import { GradienceSDK, KeypairAdapter } from '@gradiences/sdk';
import { ConfigManager } from '../config.js';
import { loadKeypairSigner, parseU64, parseAddress, outputResult, outputError, isMockMode } from '../utils.js';

export const refundCommand = new Command('refund');
refundCommand
    .description('Request refund for expired task')
    .requiredOption('--task-id <id>', 'Task ID to refund')
    .option('--poster <address>', 'Task poster address (will be fetched if not provided)')
    .option('--mint <address>', 'Token mint address (defaults to SOL)')
    .action(async (options) => {
        const spinner = ora('Processing refund...').start();
        
        try {
            const taskId = parseU64(options.taskId, 'task-id');
            
            if (isMockMode()) {
                const signature = process.env.GRADIENCE_CLI_MOCK_SIGNATURE ?? `mock-refund-signature`;
                spinner.succeed('Refund processed (mock mode)');
                outputResult({
                    signature,
                    taskId: Number(taskId),
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
            const indexerEndpoint = process.env.GRADIENCE_INDEXER_ENDPOINT;
            const sdk = new GradienceSDK({ 
                rpcEndpoint: rpcUrl, 
                indexerEndpoint,
            });

            // Resolve poster address if not provided
            let poster: string;
            if (options.poster) {
                poster = parseAddress(options.poster, 'poster');
            } else {
                spinner.text = 'Fetching task details...';
                const task = await sdk.getTask(Number(taskId));
                if (!task) {
                    throw new Error(`Task ${taskId.toString()} not found`);
                }
                poster = parseAddress(task.poster, 'poster');
            }

            const mint = options.mint ? parseAddress(options.mint, 'mint') : undefined;

            spinner.text = 'Submitting refund transaction...';
            const signature = await sdk.task.refund(wallet, {
                taskId,
                poster,
                mint,
            });

            spinner.succeed('Refund processed successfully');
            outputResult({
                signature,
                taskId: Number(taskId),
                poster,
                requester: signer.address,
            });
        } catch (error) {
            spinner.fail('Failed to process refund');
            outputError(error, 'REFUND_ERROR');
            process.exit(1);
        }
    });

// Additional refund commands
refundCommand
    .command('cancel')
    .description('Cancel a task and refund stakes/reward')
    .requiredOption('--task-id <id>', 'Task ID to cancel')
    .option('--mint <address>', 'Token mint address (defaults to SOL)')
    .action(async (options) => {
        const spinner = ora('Canceling task...').start();
        
        try {
            const taskId = parseU64(options.taskId, 'task-id');
            
            if (isMockMode()) {
                const signature = process.env.GRADIENCE_CLI_MOCK_SIGNATURE ?? `mock-cancel-signature`;
                spinner.succeed('Task canceled (mock mode)');
                outputResult({
                    signature,
                    taskId: Number(taskId),
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

            const mint = options.mint ? parseAddress(options.mint, 'mint') : undefined;

            spinner.text = 'Submitting cancel transaction...';
            const signature = await sdk.task.cancel(wallet, {
                taskId,
                mint,
            });

            spinner.succeed('Task canceled successfully');
            outputResult({
                signature,
                taskId: Number(taskId),
                poster: signer.address,
            });
        } catch (error) {
            spinner.fail('Failed to cancel task');
            outputError(error, 'CANCEL_ERROR');
            process.exit(1);
        }
    });