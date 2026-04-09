import { Command } from 'commander';
import ora from 'ora';
import { GradienceSDK, KeypairAdapter } from '@gradiences/sdk';
import { ConfigManager } from '../config.js';
import { loadKeypairSigner, parseU64, outputResult, outputError, isMockMode } from '../utils.js';

export const submitCommand = new Command('submit');
submitCommand
    .description('Submit task result on-chain')
    .requiredOption('--task-id <id>', 'Task ID')
    .requiredOption('--result-ref <cid>', 'Result reference (IPFS CID)')
    .requiredOption('--trace-ref <cid>', 'Trace reference (IPFS CID)')
    .option('--runtime-provider <provider>', 'Runtime provider', 'openai')
    .option('--runtime-model <model>', 'Runtime model', 'gpt-4')
    .option('--runtime-runtime <runtime>', 'Runtime environment', 'node')
    .option('--runtime-version <version>', 'Runtime version', '20')
    .action(async (options) => {
        const spinner = ora('Submitting task result...').start();

        try {
            const taskId = parseU64(options.taskId, 'task-id');

            if (isMockMode()) {
                const signature = process.env.GRADIENCE_CLI_MOCK_SIGNATURE ?? `mock-submit-signature`;
                spinner.succeed('Task result submitted (mock mode)');
                outputResult({
                    signature,
                    taskId: Number(taskId),
                    resultRef: options.resultRef,
                    traceRef: options.traceRef,
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

            spinner.text = 'Submitting result transaction...';
            const signature = await sdk.task.submit(wallet, {
                taskId,
                resultRef: options.resultRef,
                traceRef: options.traceRef,
                runtimeEnv: {
                    provider: options.runtimeProvider ?? 'openai',
                    model: options.runtimeModel ?? 'gpt-4',
                    runtime: options.runtimeRuntime ?? 'node',
                    version: options.runtimeVersion ?? '20',
                },
            });

            spinner.succeed('Task result submitted successfully');
            outputResult({
                signature,
                taskId: Number(taskId),
                resultRef: options.resultRef,
                traceRef: options.traceRef,
                agent: signer.address,
            });
        } catch (error) {
            spinner.fail('Failed to submit task result');
            outputError(error, 'TASK_SUBMIT_ERROR');
            process.exit(1);
        }
    });
