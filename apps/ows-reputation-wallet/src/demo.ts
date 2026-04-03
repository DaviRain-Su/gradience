import { ReputationWallet } from './wallet';
import { OWSWalletAdapter } from '@gradiences/ows-adapter';

/**
 * Run demo of reputation-powered wallet
 */
export async function runDemo(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     🏆 OWS HACKATHON 2026 - GRADIENCE DEMO 🏆            ║');
  console.log('║     Reputation-Powered Wallet MVP                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Create adapters for different agents
  const agents = [
    { name: 'New Agent', network: 'devnet' as const },
    { name: 'Experienced Agent', network: 'devnet' as const },
    { name: 'Elite Agent', network: 'devnet' as const }
  ];

  for (const agent of agents) {
    console.log(`\n👤 ${agent.name}:`);
    console.log('─'.repeat(50));

    const owsAdapter = new OWSWalletAdapter({
      network: agent.network,
      defaultChain: 'solana'
    });

    const wallet = new ReputationWallet(owsAdapter);
    await wallet.initialize();

    console.log(wallet.displaySummary());
  }

  console.log('\n' + '═'.repeat(50));
  console.log('✅ Demo complete!');
  console.log('\nKey Features Demonstrated:');
  console.log('  • Reputation scoring based on task completion');
  console.log('  • Tier system (Bronze → Diamond)');
  console.log('  • Credit limit based on reputation');
  console.log('  • Premium access control');
  console.log('  • Judge eligibility check');
}

// Run if called directly
if (require.main === module) {
  runDemo().catch(console.error);
}
