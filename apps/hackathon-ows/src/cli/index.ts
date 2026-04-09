#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { registerAgentCommand } from './commands/agent.js';
import { registerReputationCommand } from './commands/reputation.js';
import { registerWalletCommand } from './commands/wallet.js';

const program = new Command();

program.name('gradience').description('Gradience OWS Identity + Reputation CLI').version('1.0.0');

// Logo
console.log(
    chalk.magenta(`
   ____           _       _            _         
  / ___|_ __ __ _| |_ ___| |__   ___  | | _____  
 | |  _| '__/ _\` | __/ _ \ '_ \ / _ \ | |/ / __| 
 | |_| | | | (_| | ||  __/ | | |  __/ |   <\__ \ 
  \____|_|  \__,_|\__\___|_| |_|\___| |_|\_\___/ 
                                                 
  ${chalk.gray('Agent Identity with Reputation')}
  ${chalk.gray('OWS Hackathon Miami 2026')}
`),
);

// Register commands
registerAgentCommand(program);
registerReputationCommand(program);
registerWalletCommand(program);

// Default help
program.on('--help', () => {
    console.log('');
    console.log(chalk.cyan('Examples:'));
    console.log('  $ gradience agent register --name "trading-agent"');
    console.log('  $ gradience reputation check trading-agent.ows.eth');
    console.log('  $ gradience wallet create-sub --parent "trading-agent.ows.eth" --name "sub-1"');
    console.log('');
});

program.parse();
