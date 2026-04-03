import { Command } from 'commander';
import ora from 'ora';
import { GradienceSDK, KeypairAdapter } from '@gradiences/sdk';
import { ConfigManager } from '../config.js';
import { loadKeypairSigner, parseU64, parseAddress, outputResult, outputError, isMockMode } from '../utils.js';

// Create the judge command for task judging
export const judgeTaskCommand = new Command('judge');
judgeTaskCommand
    .description('Judge a task and settle payouts')
    .requiredOption('--task-id <id>', 'Task ID to judge')
    .requiredOption('--winner <address>', 'Winner agent address')
    .requiredOption('--poster <address>', 'Task poster address')
    .requiredOption('--score <0-10000>', 'Score from 0 to 10000')
    .requiredOption('--reason-ref <cid>', 'Judging reason reference (IPFS CID)')
    .option('--mint <address>', 'Token mint address (defaults to SOL)')
    .action(async (options) => {
        const spinner = ora('Judging task...').start();
        
        try {
            const taskId = parseU64(options.taskId, 'task-id');
            const scoreBig = parseU64(options.score, 'score');
            
            if (scoreBig > 10_000n) {
                throw new Error('Score must be <= 10000');
            }
            
            const winner = parseAddress(options.winner, 'winner');
            const poster = parseAddress(options.poster, 'poster');
            
            if (isMockMode()) {
                const signature = process.env.GRADIENCE_CLI_MOCK_SIGNATURE ?? `mock-judge-signature`;
                spinner.succeed('Task judged (mock mode)');
                outputResult({
                    signature,
                    taskId: Number(taskId),
                    winner,
                    score: Number(scoreBig),
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

            spinner.text = 'Submitting judgment transaction...';
            const judgeRequest = {
                taskId,
                winner,
                poster,
                score: Number(scoreBig),
                reasonRef: options.reasonRef,
                ...(mint !== undefined && { mint }),
            };
            const signature = await sdk.task.judge(wallet, judgeRequest);

            spinner.succeed('Task judged successfully');
            outputResult({
                signature,
                taskId: Number(taskId),
                winner,
                poster,
                score: Number(scoreBig),
                judge: signer.address,
            });
        } catch (error) {
            spinner.fail('Failed to judge task');
            outputError(error, 'TASK_JUDGE_ERROR');
            process.exit(1);
        }
    });

// Export the judge management functions
export const judgeCommand = {
    async register(options: { category: string; stakeAmount?: string }) {
        const spinner = ora('Registering as judge...').start();
        
        try {
            if (isMockMode()) {
                const signature = process.env.GRADIENCE_CLI_MOCK_SIGNATURE ?? `mock-judge-register-signature`;
                spinner.succeed('Judge registration completed (mock mode)');
                outputResult({
                    signature,
                    categories: parseCategories(options.category),
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

            const categories = parseCategories(options.category);
            const stakeAmount = options.stakeAmount ? parseU64(options.stakeAmount, 'stake-amount') : undefined;

            spinner.text = 'Submitting judge registration...';
            
            // Note: This will need to be implemented in the SDK
            throw new Error('Judge registration not yet implemented in SDK');
            
        } catch (error) {
            spinner.fail('Failed to register as judge');
            outputError(error, 'JUDGE_REGISTER_ERROR');
            process.exit(1);
        }
    },

    async unstake() {
        const spinner = ora('Unstaking judge...').start();
        
        try {
            if (isMockMode()) {
                const signature = process.env.GRADIENCE_CLI_MOCK_SIGNATURE ?? `mock-judge-unstake-signature`;
                spinner.succeed('Judge unstaked (mock mode)');
                outputResult({ signature });
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

            spinner.text = 'Submitting unstake transaction...';
            
            // Note: This will need to be implemented in the SDK
            throw new Error('Judge unstaking not yet implemented in SDK');
            
        } catch (error) {
            spinner.fail('Failed to unstake judge');
            outputError(error, 'JUDGE_UNSTAKE_ERROR');
            process.exit(1);
        }
    },
};

function parseCategories(raw: string): number[] {
    const CATEGORY_NAME_TO_ID = new Map<string, number>([
        ['general', 0],
        ['defi', 1],
        ['code', 2],
        ['research', 3],
        ['creative', 4],
        ['data', 5],
        ['compute', 6],
        ['gov', 7],
    ]);
    
    const chunks = raw
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
        
    if (chunks.length === 0) {
        throw new Error('At least one category is required');
    }
    
    const categories = chunks.map(item => {
        const lower = item.toLowerCase();
        if (CATEGORY_NAME_TO_ID.has(lower)) {
            return CATEGORY_NAME_TO_ID.get(lower)!;
        }
        
        const numeric = Number(item);
        if (!Number.isInteger(numeric) || numeric < 0 || numeric >= 8) {
            throw new Error(
                `Invalid category "${item}". Use 0-7 or names: ${[...CATEGORY_NAME_TO_ID.keys()].join(', ')}`,
            );
        }
        return numeric;
    });
    
    const unique = [...new Set(categories)];
    if (unique.length !== categories.length) {
        throw new Error('Duplicate categories are not allowed');
    }
    
    return unique;
}