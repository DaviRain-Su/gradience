import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { WalletService } from '../../core/wallet.js';

export function registerWalletCommand(program: Command) {
    const walletCmd = program.command('wallet').alias('w').description('Wallet management');

    // Create sub-wallet
    walletCmd
        .command('create-sub')
        .description('Create a sub-wallet with reputation-based policy')
        .option('-p, --parent <parent>', 'Parent agent name')
        .option('-n, --name <name>', 'Sub-wallet name')
        .action(async (options) => {
            try {
                let { parent, name } = options;

                if (!parent) {
                    const answers = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'parent',
                            message: 'Parent agent name:',
                            validate: (input: string) => input.length > 0 || 'Parent name required',
                        },
                    ]);
                    parent = answers.parent;
                }

                if (!name) {
                    const answers = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'name',
                            message: 'Sub-wallet name:',
                            validate: (input: string) => input.length > 0 || 'Name required',
                        },
                    ]);
                    name = answers.name;
                }

                const parentName = parent.includes('.ows.eth') ? parent : `${parent}.ows.eth`;

                console.log(chalk.cyan('\n💼 Creating sub-wallet...\n'));

                const spinner = ora('Checking parent reputation...').start();
                const walletService = new WalletService();
                const result = await walletService.createSubWallet({
                    parentName,
                    subName: name,
                });
                spinner.stop();

                const subFullName = `${name}.${parentName}`;

                console.log(chalk.green('\n✅ Sub-wallet created!\n'));
                console.log(chalk.white('  Details:'));
                console.log(chalk.gray(`    Name: ${subFullName}`));
                console.log(chalk.gray(`    Parent: ${parentName}`));
                console.log(chalk.gray(`    Parent Reputation: ${result.parentReputation.score}`));
                console.log('');

                console.log(chalk.white('  Policy (inherited from parent):'));
                console.log(chalk.gray(`    Daily Limit: $${result.policy.dailyLimit}`));
                console.log(chalk.gray(`    Require Approval: ${result.policy.requireApproval ? 'Yes' : 'No'}`));
                console.log(chalk.gray(`    Allowed Tokens: ${result.policy.allowedTokens?.join(', ') || 'All'}`));
                console.log('');

                if (result.parentReputation.score < 50) {
                    console.log(chalk.yellow('  ⚠️  Warning:'));
                    console.log(chalk.gray('    Parent reputation is low. Consider completing more tasks'));
                    console.log(chalk.gray('    to increase sub-wallet limits.\n'));
                }
            } catch (error: any) {
                console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
                process.exit(1);
            }
        });

    // Check policy
    walletCmd
        .command('check-policy <name>')
        .description('Check wallet policy for an agent')
        .action(async (name) => {
            try {
                const fullName = name.includes('.ows.eth') ? name : `${name}.ows.eth`;

                const spinner = ora(`Fetching policy for ${fullName}...`).start();
                const walletService = new WalletService();
                const policy = await walletService.getPolicy(fullName);
                const subWallets = await walletService.getSubWallets(fullName);
                spinner.stop();

                if (!policy) {
                    console.log(chalk.red(`\n❌ Agent not found: ${fullName}\n`));
                    process.exit(1);
                }

                console.log(chalk.cyan(`\n💼 Wallet Policy: ${fullName}\n`));

                console.log(chalk.white('  Transaction Limits:'));
                console.log(chalk.gray(`    Daily Limit: $${policy.dailyLimit}`));
                console.log(chalk.gray(`    Single Transaction: $${policy.maxTransaction || 'Unlimited'}`));
                console.log('');

                console.log(chalk.white('  Requirements:'));
                console.log(chalk.gray(`    Approval Required: ${policy.requireApproval ? 'Yes' : 'No'}`));
                console.log(chalk.gray(`    Manual Review: ${policy.requireManualReview ? 'Yes' : 'No'}`));
                console.log('');

                console.log(chalk.white('  Restrictions:'));
                console.log(chalk.gray(`    Allowed Tokens: ${policy.allowedTokens?.join(', ') || 'All'}`));
                console.log(chalk.gray(`    Blocked Contracts: ${policy.blockedContracts?.length || 0}`));
                console.log('');

                if (subWallets.length > 0) {
                    console.log(chalk.white('  Sub-wallets:'));
                    for (const sub of subWallets) {
                        console.log(chalk.gray(`    ${sub.name}: $${sub.policy.dailyLimit}/day`));
                    }
                    console.log('');
                }

                // Upgrade hint
                if (policy.dailyLimit < 1000) {
                    const nextThreshold = policy.dailyLimit < 500 ? 500 : policy.dailyLimit < 800 ? 800 : 1000;
                    console.log(chalk.cyan(`  💡 Upgrade tip:`));
                    console.log(chalk.gray(`     Increase reputation to ${Math.ceil(nextThreshold / 10)}`));
                    console.log(chalk.gray(`     to unlock $${nextThreshold} daily limit.\n`));
                }
            } catch (error: any) {
                console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
                process.exit(1);
            }
        });

    // List sub-wallets
    walletCmd
        .command('list-subs <parent>')
        .description('List all sub-wallets for a parent agent')
        .action(async (parent) => {
            try {
                const parentName = parent.includes('.ows.eth') ? parent : `${parent}.ows.eth`;

                const walletService = new WalletService();
                const subWallets = await walletService.getSubWallets(parentName);

                if (subWallets.length === 0) {
                    console.log(chalk.yellow(`\nNo sub-wallets for ${parentName}\n`));
                    console.log('Create one with:');
                    console.log(chalk.cyan(`  $ gradience wallet create-sub --parent ${parent} --name sub-1\n`));
                    return;
                }

                console.log(chalk.cyan(`\n💼 Sub-wallets of ${parentName}:\n`));

                for (const sub of subWallets) {
                    console.log(chalk.white(`  ${sub.name}`));
                    console.log(chalk.gray(`    Daily Limit: $${sub.policy.dailyLimit}`));
                    console.log(chalk.gray(`    Created: ${sub.createdAt.toLocaleDateString()}`));
                    console.log('');
                }
            } catch (error: any) {
                console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
                process.exit(1);
            }
        });

    // Simulate transaction
    walletCmd
        .command('simulate-tx <name>')
        .description('Simulate a transaction (demo only)')
        .option('-a, --amount <amount>', 'Transaction amount', '50')
        .option('-t, --token <token>', 'Token symbol', 'USDC')
        .action(async (name, options) => {
            try {
                const fullName = name.includes('.ows.eth') ? name : `${name}.ows.eth`;
                const amount = parseInt(options.amount);
                const token = options.token;

                console.log(chalk.cyan('\n💸 Simulating transaction...\n'));
                console.log(chalk.gray(`  Agent: ${fullName}`));
                console.log(chalk.gray(`  Amount: ${amount} ${token}`));
                console.log('');

                const spinner = ora('Checking policy...').start();
                const walletService = new WalletService();
                const result = await walletService.simulateTransaction(fullName, { amount, token });
                await new Promise((r) => setTimeout(r, 800));
                spinner.stop();

                if (result.allowed) {
                    console.log(chalk.green('✅ Transaction allowed\n'));
                    console.log(chalk.white('  Result:'));
                    console.log(chalk.gray(`    Status: ${result.requiresApproval ? 'Pending approval' : 'Executed'}`));
                    console.log(chalk.gray(`    Remaining daily limit: $${result.remainingLimit}`));
                    console.log('');
                } else {
                    console.log(chalk.red('❌ Transaction rejected\n'));
                    console.log(chalk.white('  Reason:'));
                    console.log(chalk.gray(`    ${result.reason}`));
                    console.log('');

                    if (result.suggestion) {
                        console.log(chalk.cyan('  💡 Suggestion:'));
                        console.log(chalk.gray(`    ${result.suggestion}\n`));
                    }
                }
            } catch (error: any) {
                console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
                process.exit(1);
            }
        });
}
