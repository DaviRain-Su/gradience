import { Command } from 'commander';
import ora from 'ora';
import { GradienceSDK, KeypairAdapter } from '@gradiences/sdk';
import { ConfigManager } from '../config.js';
import { loadKeypairSigner, parseU64, parseAddress, outputResult, outputError, isMockMode } from '../utils.js';

export const applyCommand = new Command('apply');
applyCommand
    .description('Apply for a task on-chain')
    .requiredOption('--task-id <id>', 'Task ID to apply for')
    .option('--mint <address>', 'Token mint address (defaults to SOL)')
    .action(async (options) => {
        const spinner = ora('Applying for task...').start();
        
        try {
            const taskId = parseU64(options.taskId, 'task-id');
            
            if (isMockMode()) {
                const signature = process.env.GRADIENCE_CLI_MOCK_SIGNATURE ?? `mock-apply-signature`;
                spinner.succeed('Applied for task (mock mode)');
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

            spinner.text = 'Submitting application...';
            const applyRequest = mint !== undefined
                ? { taskId, mint }
                : { taskId };
            const signature = await sdk.task.apply(wallet, applyRequest);

            spinner.succeed('Successfully applied for task');
            outputResult({
                signature,
                taskId: Number(taskId),
                agent: signer.address,
            });
        } catch (error) {
            spinner.fail('Failed to apply for task');
            outputError(error, 'TASK_APPLY_ERROR');
            process.exit(1);
        }
    });