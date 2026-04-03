import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ReputationService } from '../../core/reputation.js';

export function registerReputationCommand(program: Command) {
  const repCmd = program
    .command('reputation')
    .alias('rep')
    .description('Reputation management');

  // Check reputation
  repCmd
    .command('check <name>')
    .description('Check agent reputation score')
    .action(async (name) => {
      try {
        const fullName = name.includes('.ows.eth') ? name : `${name}.ows.eth`;
        
        const spinner = ora(`Fetching reputation for ${fullName}...`).start();
        const repService = new ReputationService();
        const reputation = await repService.get(fullName);
        spinner.stop();

        if (!reputation) {
          console.log(chalk.red(`\n❌ Agent not found: ${fullName}\n`));
          process.exit(1);
        }

        // Level with color
        const level = reputation.score >= 80 ? 'Platinum' :
                     reputation.score >= 60 ? 'Gold' :
                     reputation.score >= 40 ? 'Silver' : 'Bronze';
        
        const levelColor = level === 'Platinum' ? chalk.magenta :
                          level === 'Gold' ? chalk.yellow :
                          level === 'Silver' ? chalk.gray : chalk.rgb(205, 127, 50);

        // Progress bar
        const progress = Math.round(reputation.score / 2);
        const bar = '█'.repeat(progress) + '░'.repeat(50 - progress);

        console.log(chalk.cyan(`\n📊 Reputation: ${fullName}\n`));
        console.log(`  Score: ${chalk.bold(reputation.score)}/100 ${levelColor(`[${level}]`)}`);
        console.log(`  ${chalk.gray(bar)}`);
        console.log('');

        console.log(chalk.white('  Breakdown:'));
        console.log(chalk.gray(`    Task Completion: ${reputation.breakdown.taskCompletion}%`));
        console.log(chalk.gray(`    Judge Rating: ${reputation.breakdown.judgeRating}/5.0`));
        console.log(chalk.gray(`    Payment Speed: ${reputation.breakdown.paymentSpeed}%`));
        console.log(chalk.gray(`    Dispute Rate: ${reputation.breakdown.disputeRate}%`));
        console.log(chalk.gray(`    Cross-chain: ${reputation.breakdown.crossChain}%`));
        console.log('');

        console.log(chalk.white('  Stats:'));
        console.log(chalk.gray(`    Tasks Completed: ${reputation.tasksCompleted}`));
        console.log(chalk.gray(`    Total Earned: $${reputation.totalEarned}`));
        console.log(chalk.gray(`    In Disputes: ${reputation.disputes}`));
        console.log('');

        // Policy hint
        const nextLevel = reputation.score >= 80 ? null :
                         reputation.score >= 60 ? 'Platinum (80)' :
                         reputation.score >= 40 ? 'Gold (60)' : 'Silver (40)';
        
        if (nextLevel) {
          console.log(chalk.cyan(`  ⭐ ${nextLevel} perks:`));
          console.log(chalk.gray(`     • Higher daily limits`));
          console.log(chalk.gray(`     • Less approval required`));
          console.log(chalk.gray(`     • More token options`));
          console.log('');
        } else {
          console.log(chalk.magenta('  👑 Max level reached!'));
          console.log('');
        }

      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
        process.exit(1);
      }
    });

  // Simulate task completion (for demo)
  repCmd
    .command('simulate <name>')
    .description('Simulate task completion (demo only)')
    .option('-s, --score <score>', 'Judge score (1-5)', '5')
    .option('-a, --amount <amount>', 'Payment amount', '100')
    .action(async (name, options) => {
      try {
        const fullName = name.includes('.ows.eth') ? name : `${name}.ows.eth`;
        const score = parseInt(options.score);
        const amount = parseInt(options.amount);

        console.log(chalk.cyan('\n🎯 Simulating task completion...\n'));

        const spinner1 = ora('Verifying task with Judge...').start();
        await new Promise(r => setTimeout(r, 1000));
        spinner1.succeed('Task verified');

        const spinner2 = ora(`Recording payment: $${amount}...`).start();
        await new Promise(r => setTimeout(r, 800));
        spinner2.succeed('Payment recorded');

        const spinner3 = ora('Updating reputation...').start();
        const repService = new ReputationService();
        const oldRep = await repService.get(fullName);
        const newRep = await repService.simulateUpdate(fullName, { score, amount });
        spinner3.succeed('Reputation updated');

        const diff = newRep.score - (oldRep?.score || 0);
        const diffStr = diff >= 0 ? chalk.green(`+${diff}`) : chalk.red(diff);

        console.log(chalk.green('\n✅ Task completed!\n'));
        console.log(chalk.white('  Reputation Update:'));
        console.log(chalk.gray(`    Old: ${oldRep?.score || 0}`));
        console.log(chalk.gray(`    New: ${newRep.score} ${diffStr}`));
        console.log('');

        if (newRep.level !== oldRep?.level) {
          console.log(chalk.yellow(`  🎉 Level up! Now ${newRep.level}`));
          console.log('');
        }

        console.log(chalk.cyan('  Check updated reputation:'));
        console.log(chalk.gray(`    $ gradience reputation check ${fullName}\n`));

      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
        process.exit(1);
      }
    });

  // Leaderboard
  repCmd
    .command('leaderboard')
    .alias('top')
    .description('Show top agents by reputation')
    .option('-l, --limit <limit>', 'Number of agents to show', '10')
    .action(async (options) => {
      try {
        const limit = parseInt(options.limit);
        
        const spinner = ora('Fetching leaderboard...').start();
        const repService = new ReputationService();
        const agents = await repService.getLeaderboard(limit);
        spinner.stop();

        console.log(chalk.cyan(`\n🏆 Top ${limit} Agents by Reputation\n`));

        let rank = 1;
        for (const agent of agents) {
          const levelColor = agent.level === 'Platinum' ? chalk.magenta :
                            agent.level === 'Gold' ? chalk.yellow :
                            agent.level === 'Silver' ? chalk.gray : chalk.rgb(205, 127, 50);

          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
          
          console.log(`${medal} ${chalk.white(agent.name)}`);
          console.log(`   Score: ${chalk.bold(agent.score)} ${levelColor(`[${agent.level}]`)}`);
          console.log(`   Tasks: ${agent.tasksCompleted} | Earned: $${agent.totalEarned}`);
          console.log('');
          rank++;
        }

      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
        process.exit(1);
      }
    });
}
