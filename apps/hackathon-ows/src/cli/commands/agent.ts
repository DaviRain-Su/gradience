import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { AgentService } from '../../core/agent.js';
import { OWSWallet } from '../../ows/wallet.js';

export function registerAgentCommand(program: Command) {
  const agentCmd = program
    .command('agent')
    .description('Agent identity management');

  // Register new agent
  agentCmd
    .command('register')
    .description('Register a new agent with OWS wallet + ENS')
    .option('-n, --name <name>', 'Agent name (e.g., trading-agent)')
    .option('-c, --chains <chains>', 'Comma-separated chains (ethereum,solana,bitcoin)', 'ethereum,solana')
    .action(async (options) => {
      try {
        let { name, chains } = options;

        // Interactive prompts if not provided
        if (!name) {
          const answers = await inquirer.prompt([{
            type: 'input',
            name: 'name',
            message: 'Enter agent name (without .ows.eth):',
            validate: (input: string) => input.length > 0 || 'Name is required'
          }]);
          name = answers.name;
        }

        const chainList = chains.split(',').map((c: string) => c.trim());
        const fullName = `${name}.ows.eth`;

        console.log(chalk.cyan('\n🚀 Registering new agent...\n'));

        // Step 1: Create OWS Wallet
        const spinner1 = ora('Creating OWS multi-chain wallet...').start();
        const wallet = await OWSWallet.create({
          name: fullName,
          chains: chainList
        });
        spinner1.succeed('OWS wallet created');

        // Show addresses
        console.log(chalk.gray('\n  Cross-chain addresses:'));
        for (const [chain, address] of Object.entries(wallet.addresses)) {
          console.log(chalk.gray(`    ${chain}: ${address}`));
        }

        // Step 2: Register ENS
        const spinner2 = ora('Registering ENS domain...').start();
        const agentService = new AgentService();
        const agent = await agentService.register({
          name: fullName,
          wallet,
          chains: chainList
        });
        spinner2.succeed(`ENS registered: ${chalk.green(fullName)}`);

        // Step 3: Set initial reputation
        const spinner3 = ora('Initializing reputation...').start();
        await agentService.initializeReputation(agent.id);
        spinner3.succeed('Reputation initialized: 50 (Bronze)');

        // Success output
        console.log(chalk.green('\n✅ Agent registered successfully!\n'));
        console.log(chalk.white('Agent Details:'));
        console.log(chalk.gray(`  Name: ${fullName}`));
        console.log(chalk.gray(`  ID: ${agent.id}`));
        console.log(chalk.gray(`  Reputation: 50 (Bronze)`));
        console.log(chalk.gray(`  Daily Limit: $500`));
        
        console.log(chalk.cyan('\nNext steps:'));
        console.log(`  $ gradience reputation check ${fullName}`);
        console.log(`  $ gradience wallet create-sub --parent ${fullName} --name sub-1`);
        console.log('');

      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
        process.exit(1);
      }
    });

  // List agents
  agentCmd
    .command('list')
    .description('List all registered agents')
    .action(async () => {
      const agentService = new AgentService();
      const agents = await agentService.list();

      if (agents.length === 0) {
        console.log(chalk.yellow('\nNo agents registered yet.\n'));
        console.log('Create one with:');
        console.log(chalk.cyan('  $ gradience agent register\n'));
        return;
      }

      console.log(chalk.cyan('\n📋 Registered Agents:\n'));
      
      for (const agent of agents) {
        const level = agent.reputation.score >= 80 ? 'Platinum' :
                     agent.reputation.score >= 60 ? 'Gold' :
                     agent.reputation.score >= 40 ? 'Silver' : 'Bronze';
        
        const levelColor = level === 'Platinum' ? chalk.magenta :
                          level === 'Gold' ? chalk.yellow :
                          level === 'Silver' ? chalk.gray : chalk.rgb(205, 127, 50);

        console.log(chalk.white(`  ${agent.name}`));
        console.log(chalk.gray(`    ID: ${agent.id}`));
        console.log(chalk.gray(`    Reputation: ${agent.reputation.score} ${levelColor(`(${level})`)}`));
        console.log(chalk.gray(`    Created: ${agent.createdAt.toLocaleDateString()}`));
        console.log('');
      }
    });

  // Get agent details
  agentCmd
    .command('info <name>')
    .description('Get detailed info about an agent')
    .action(async (name) => {
      const fullName = name.includes('.ows.eth') ? name : `${name}.ows.eth`;
      
      const agentService = new AgentService();
      const agent = await agentService.getByName(fullName);

      if (!agent) {
        console.log(chalk.red(`\n❌ Agent not found: ${fullName}\n`));
        process.exit(1);
      }

      console.log(chalk.cyan('\n📊 Agent Details:\n'));
      console.log(chalk.white(`  Name: ${agent.name}`));
      console.log(chalk.gray(`  ID: ${agent.id}`));
      console.log('');

      console.log(chalk.white('  Cross-chain Addresses:'));
      for (const [chain, address] of Object.entries(agent.wallet.addresses)) {
        console.log(chalk.gray(`    ${chain}: ${address}`));
      }
      console.log('');

      console.log(chalk.white('  Reputation:'));
      console.log(chalk.gray(`    Score: ${agent.reputation.score}/100`));
      console.log(chalk.gray(`    Tasks Completed: ${agent.reputation.tasksCompleted}`));
      console.log(chalk.gray(`    Judge Rating: ${agent.reputation.judgeRating}/5`));
      console.log('');

      console.log(chalk.white('  Wallet Policy:'));
      console.log(chalk.gray(`    Daily Limit: $${agent.policy.dailyLimit}`));
      console.log(chalk.gray(`    Require Approval: ${agent.policy.requireApproval ? 'Yes' : 'No'}`));
      console.log(chalk.gray(`    Allowed Tokens: ${agent.policy.allowedTokens?.join(', ') || 'All'}`));
      console.log('');
    });
}
