#!/usr/bin/env node
import { ReputationWallet } from './wallet';
import { OWSWalletAdapter } from '@gradience/ows-adapter';

/**
 * Reputation-Powered Wallet CLI
 * 
 * Usage:
 *   npm start
 *   npm start -- --address <ADDRESS>
 */

async function main() {
  console.log('🏆 OWS Reputation-Powered Wallet MVP\n');

  // Parse arguments
  const args = process.argv.slice(2);
  const network = args.includes('--mainnet') ? 'mainnet' : 'devnet';

  try {
    // Create OWS adapter
    const owsAdapter = new OWSWalletAdapter({
      network: network as 'mainnet' | 'devnet',
      defaultChain: 'solana'
    });

    // Create reputation wallet
    const wallet = new ReputationWallet(owsAdapter);

    // Initialize
    console.log(`Connecting to OWS (${network})...`);
    await wallet.initialize();

    // Display summary
    console.log('\n' + wallet.displaySummary());

    // Show credentials
    const credentials = wallet.getCredentials();
    if (credentials.length > 0) {
      console.log('\n📜 Credentials:');
      credentials.forEach((cred, i) => {
        console.log(`  ${i + 1}. ${cred.type} (issued by ${cred.issuer})`);
      });
    }

    console.log('\n✅ Wallet initialized successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
