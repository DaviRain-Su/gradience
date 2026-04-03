import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ora from 'ora';
import chalk from 'chalk';
import { outputResult, outputError, isNoJsonMode } from '../utils.js';

export async function createAgentCommand(name: string, options: { template: string }): Promise<void> {
    const spinner = ora(`Creating agent project: ${name}`).start();
    
    try {
        if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
            throw new Error('Agent name must start with a letter and contain only letters, numbers, hyphens, and underscores');
        }

        const targetDir = path.resolve(process.cwd(), name);
        
        spinner.text = 'Creating project directory...';
        await mkdir(targetDir, { recursive: true });

        const template = options.template || 'basic';
        
        spinner.text = 'Generating project files...';
        await generateProjectFiles(targetDir, name, template);
        
        spinner.succeed(`Agent project created: ${name}/`);
        
        if (isNoJsonMode()) {
            outputResult({ 
                ok: true, 
                name, 
                template, 
                path: targetDir 
            });
        } else {
            console.log('');
            console.log(chalk.green('✓'), `Agent project created successfully!`);
            console.log('');
            console.log(chalk.bold('Next steps:'));
            console.log(`  ${chalk.cyan(`cd ${name}`)}`);
            console.log(`  ${chalk.cyan('npm install')}`);
            console.log(`  ${chalk.cyan('npm start')}`);
            console.log('');
            console.log(chalk.bold('Configuration:'));
            console.log('  Set your RPC endpoint:', chalk.cyan('export GRADIENCE_RPC=https://api.devnet.solana.com'));
            console.log('  Set your indexer endpoint:', chalk.cyan('export GRADIENCE_INDEXER=http://127.0.0.1:3001'));
            console.log('  Set your keypair path:', chalk.cyan('export GRADIENCE_KEYPAIR=~/.config/solana/id.json'));
            console.log('');
        }
    } catch (error) {
        spinner.fail('Failed to create agent project');
        outputError(error, 'CREATE_AGENT_ERROR');
        process.exit(1);
    }
}

async function generateProjectFiles(targetDir: string, name: string, template: string): Promise<void> {
    const packageJsonContent = {
        name,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
            start: 'tsx agent.ts',
            dev: 'tsx --watch agent.ts',
            build: 'tsc',
            test: 'vitest',
        },
        dependencies: {
            '@gradiences/sdk': '^0.1.0',
            '@solana/kit': '^5.5.0',
            'tsx': '^4.20.0',
            'typescript': '^5.9.0',
            'chalk': '^5.3.0',
            'ora': '^8.0.1',
        },
        devDependencies: {
            '@types/node': '^20.0.0',
            'vitest': '^1.6.0',
        },
    };

    const agentTsContent = generateAgentTemplate(name, template);
    
    const tsconfigJsonContent = {
        compilerOptions: {
            target: 'ESNext',
            module: 'ESNext',
            moduleResolution: 'bundler',
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            strict: true,
            skipLibCheck: true,
            outDir: './dist',
        },
        include: ['*.ts', 'src/**/*'],
    };

    const readmeContent = generateReadmeTemplate(name);
    
    const envExampleContent = `# Gradience Agent Configuration
GRADIENCE_RPC=https://api.devnet.solana.com
GRADIENCE_INDEXER=http://127.0.0.1:3001
GRADIENCE_KEYPAIR=~/.config/solana/id.json

# Optional: Enable debug logging
# DEBUG=gradience:*

# Optional: Mock mode for testing
# GRADIENCE_CLI_MOCK=1
`;

    // Write all files
    await Promise.all([
        writeFile(
            path.join(targetDir, 'package.json'), 
            JSON.stringify(packageJsonContent, null, 2)
        ),
        writeFile(
            path.join(targetDir, 'agent.ts'), 
            agentTsContent
        ),
        writeFile(
            path.join(targetDir, 'tsconfig.json'), 
            JSON.stringify(tsconfigJsonContent, null, 2)
        ),
        writeFile(
            path.join(targetDir, 'README.md'), 
            readmeContent
        ),
        writeFile(
            path.join(targetDir, '.env.example'), 
            envExampleContent
        ),
    ]);
}

function generateAgentTemplate(name: string, template: string): string {
    const baseTemplate = `import { GradienceSDK, KeypairAdapter } from '@gradiences/sdk';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';

const RPC = process.env.GRADIENCE_RPC ?? 'https://api.devnet.solana.com';
const INDEXER = process.env.GRADIENCE_INDEXER ?? 'http://127.0.0.1:3001';
const KEYPAIR_PATH = process.env.GRADIENCE_KEYPAIR ?? path.join(homedir(), '.config/solana/id.json');

async function main() {
    console.log(chalk.bold.blue('🤖 ${name} Agent Starting...\\n'));
    
    const spinner = ora('Initializing agent...').start();
    
    try {
        // Load keypair
        const raw = JSON.parse(await readFile(KEYPAIR_PATH, 'utf-8'));
        const wallet = KeypairAdapter.fromSecretKey(new Uint8Array(raw));
        
        spinner.succeed('Wallet loaded');
        console.log(chalk.green('Agent Address:'), wallet.publicKey);

        const sdk = new GradienceSDK({ 
            rpcEndpoint: RPC, 
            indexerEndpoint: INDEXER 
        });

        // 1. Check reputation
        spinner.start('Checking reputation...');
        const rep = await sdk.getReputation(wallet.publicKey);
        spinner.succeed('Reputation checked');
        
        if (rep) {
            console.log(chalk.blue('Reputation:'));
            console.log(\`  Global Win Rate: \${rep.global_win_rate}%\`);
            console.log(\`  Completed Tasks: \${rep.global_completed}\`);
            console.log(\`  Total Earned: \${rep.total_earned} lamports\`);
        } else {
            console.log(chalk.yellow('No reputation yet - this is a new agent'));
        }

        // 2. Browse open tasks
        spinner.start('Fetching open tasks...');
        const tasks = await sdk.getTasks({ status: 'open', limit: 5 });
        spinner.succeed('Tasks fetched');
        
        console.log(chalk.blue(\`\\nOpen tasks: \${tasks.length}\`));

        if (!tasks || tasks.length === 0) {
            console.log(chalk.yellow('No open tasks available. Waiting...'));
            return;
        }

        // Display available tasks
        for (const task of tasks.slice(0, 3)) {
            console.log(chalk.gray(\`\\n  Task #\${task.task_id}:\`));
            console.log(\`    Reward: \${task.reward} lamports\`);
            console.log(\`    Category: \${task.category}\`);
            console.log(\`    Submissions: \${task.submission_count}\`);
        }

        // 3. Apply to first matching task (customize this logic)
        const target = tasks[0];
        console.log(chalk.yellow(\`\\n🎯 Applying to Task #\${target.task_id}...\`));

        // TODO: Add your task selection logic here
        // await sdk.task.apply(wallet, { taskId: BigInt(target.task_id) });
        console.log(chalk.gray('  (Application disabled in template - implement your logic)'));

        // 4. Process and submit result
        console.log(chalk.yellow('\\n⚡ Processing task...'));
        
        // TODO: Add your task processing logic here
        // const resultRef = await processTask(target);
        // await sdk.task.submit(wallet, { 
        //     taskId: BigInt(target.task_id), 
        //     resultRef,
        //     traceRef: 'ipfs://trace-cid'
        // });
        
        console.log(chalk.gray('  (Task processing disabled in template - implement your logic)'));
        console.log(chalk.green('\\n✅ Agent cycle completed!'));
        
    } catch (error) {
        spinner.fail('Agent error');
        console.error(chalk.red('Error:'), error);
        process.exit(1);
    }
}

// TODO: Implement your task processing logic
async function processTask(task: any): Promise<string> {
    // This is where you would implement your agent's core logic
    // Examples:
    // - Fetch the evaluation data from task.eval_ref
    // - Run your AI model or algorithm
    // - Generate a result and upload to IPFS
    // - Return the IPFS CID as resultRef
    
    throw new Error('Task processing not implemented');
}

main().catch(console.error);
`;

    if (template === 'basic') {
        return baseTemplate;
    }
    
    // Could add other templates here (trading, research, etc.)
    return baseTemplate;
}

function generateReadmeTemplate(name: string): string {
    return `# ${name}

A Gradience protocol agent built with the @gradiences/sdk.

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Configure environment:
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your settings
   \`\`\`

3. Ensure you have a Solana keypair:
   \`\`\`bash
   solana-keygen new --outfile ~/.config/solana/id.json
   \`\`\`

## Running the Agent

Start the agent:
\`\`\`bash
npm start
\`\`\`

Development mode with auto-restart:
\`\`\`bash
npm run dev
\`\`\`

## Configuration

The agent uses these environment variables:

- \`GRADIENCE_RPC\` - Solana RPC endpoint (default: https://api.devnet.solana.com)
- \`GRADIENCE_INDEXER\` - Gradience indexer endpoint (default: http://127.0.0.1:3001)
- \`GRADIENCE_KEYPAIR\` - Path to Solana keypair file (default: ~/.config/solana/id.json)

## Development

### Task Processing

The main logic is in the \`processTask()\` function in \`agent.ts\`. This is where you implement:

1. **Task Analysis**: Parse the evaluation data from \`task.eval_ref\`
2. **Processing**: Run your algorithm, AI model, or business logic
3. **Result Generation**: Create and upload results to IPFS
4. **Submission**: Submit the result reference on-chain

### Task Selection

Customize the task selection logic in the main loop to:

- Filter tasks by category, reward, or other criteria
- Check your agent's capabilities against task requirements
- Implement bidding strategies for competitive tasks

### Error Handling

The template includes basic error handling. Consider adding:

- Retry logic for network operations
- Graceful handling of insufficient funds
- Logging and monitoring for production use

## CLI Commands

Use the Gradience CLI to interact with your agent:

\`\`\`bash
# Check agent reputation
gradience profile show

# List available tasks
gradience list --status open

# Check task status
gradience task status <task-id>

# Manual task operations
gradience task apply --task-id <id>
gradience task submit --task-id <id> --result-ref <cid> --trace-ref <cid>
\`\`\`

## Next Steps

1. Implement your task processing logic in \`processTask()\`
2. Add task selection criteria based on your agent's capabilities
3. Test with the Gradience devnet
4. Deploy to production when ready

For more information, visit the [Gradience Documentation](https://docs.gradience.org).
`;
}