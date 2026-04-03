/**
 * Example: Using Solana Workflow SDK
 * 
 * Demonstrates how to interact with the deployed Solana program
 */
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { createSolanaWorkflowSDK } from '../src/sdk/solana-sdk.js';
import type { GradienceWorkflow } from '../src/schema/types.js';
import * as fs from 'fs';
import * as path from 'path';

// Load keypair from Solana CLI config
function loadKeypair(): Keypair {
  const keypairPath = path.join(
    process.env.HOME!,
    '.config',
    'solana',
    'id.json'
  );
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

async function main() {
  console.log('🚀 Solana Workflow SDK Example\n');

  // Setup connection
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const payer = loadKeypair();

  console.log('Payer:', payer.publicKey.toBase58());
  console.log('Balance:', await connection.getBalance(payer.publicKey) / 1e9, 'SOL\n');

  // Create SDK instance
  const sdk = createSolanaWorkflowSDK({
    connection,
    payer,
  });

  // Get PDA addresses
  console.log('📍 PDA Addresses:');
  console.log('Config:', sdk.getConfigAddress().toBase58());
  console.log('Treasury:', sdk.getTreasuryAddress().toBase58());
  console.log();

  // Generate a new workflow ID
  const workflowId = Keypair.generate().publicKey;
  console.log('Workflow ID:', workflowId.toBase58());
  console.log('Workflow PDA:', sdk.getWorkflowAddress(workflowId).toBase58());
  console.log();

  // Define a sample workflow
  const workflow: GradienceWorkflow = {
    id: workflowId.toBase58(),
    name: 'Token Swap Example',
    description: 'Simple SOL to USDC swap workflow',
    author: payer.publicKey.toBase58(),
    version: '1.0.0',
    steps: [
      {
        id: 'swap-step',
        name: 'Swap SOL for USDC',
        chain: 'solana',
        action: 'swap',
        params: {
          from: 'SOL',
          to: 'USDC',
          amount: '1000000000', // 1 SOL
          slippage: 0.5,
        },
      },
    ],
    pricing: { model: 'free' },
    revenueShare: {
      creator: 0,
      user: 9500,
      agent: 0,
      protocol: 200,
      judge: 300,
    },
    requirements: {},
    isPublic: true,
    isTemplate: false,
    tags: ['defi', 'swap', 'example'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    contentHash: 'ipfs://QmExample123',
    signature: 'mock-signature',
  };

  try {
    // 1. Create Workflow
    console.log('📝 1. Creating workflow on-chain...');
    const createSig = await sdk.createWorkflow(workflow, workflowId);
    console.log('✅ Created:', createSig);
    console.log();

    // Wait a bit for confirmation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 2. Get workflow metadata
    console.log('📖 2. Fetching workflow metadata...');
    const metadata = await sdk.getWorkflow(workflowId);
    if (metadata) {
      console.log('✅ Metadata:');
      console.log('   Author:', metadata.author.toBase58());
      console.log('   Version:', metadata.version);
      console.log('   Purchases:', metadata.totalPurchases);
      console.log('   Rating:', metadata.avgRating / 2000, '/ 5');
      console.log('   Active:', metadata.isActive);
      console.log('   Public:', metadata.isPublic);
      console.log();
    }

    // 3. Purchase workflow
    console.log('💰 3. Purchasing workflow...');
    const purchaseSig = await sdk.purchaseWorkflow(workflowId);
    console.log('✅ Purchased:', purchaseSig);
    console.log();

    // Wait for confirmation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 4. Check access
    console.log('🔐 4. Checking access...');
    const hasAccess = await sdk.hasAccess(workflowId);
    console.log('✅ Has access:', hasAccess);
    console.log();

    // 5. Review workflow
    console.log('⭐ 5. Leaving a review...');
    const reviewSig = await sdk.reviewWorkflow(
      workflowId,
      5,
      'Excellent workflow! Easy to use.'
    );
    console.log('✅ Reviewed:', reviewSig);
    console.log();

    // Wait for confirmation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 6. Get updated metadata (should show purchase + review)
    console.log('📖 6. Fetching updated metadata...');
    const updatedMetadata = await sdk.getWorkflow(workflowId);
    if (updatedMetadata) {
      console.log('✅ Updated Metadata:');
      console.log('   Purchases:', updatedMetadata.totalPurchases);
      console.log('   Rating:', updatedMetadata.avgRating / 2000, '/ 5');
      console.log();
    }

    // 7. Update workflow
    console.log('🔄 7. Updating workflow content...');
    const updateSig = await sdk.updateWorkflow(
      workflowId,
      'ipfs://QmUpdatedExample456'
    );
    console.log('✅ Updated:', updateSig);
    console.log();

    // 8. Deactivate workflow
    console.log('🔴 8. Deactivating workflow...');
    const deactivateSig = await sdk.deactivateWorkflow(workflowId);
    console.log('✅ Deactivated:', deactivateSig);
    console.log();

    // 9. Activate workflow
    console.log('🟢 9. Reactivating workflow...');
    const activateSig = await sdk.activateWorkflow(workflowId);
    console.log('✅ Activated:', activateSig);
    console.log();

    // 10. Try to delete (will fail - has purchases)
    console.log('🗑️  10. Attempting to delete workflow...');
    try {
      await sdk.deleteWorkflow(workflowId);
      console.log('❌ Delete succeeded (unexpected!)');
    } catch (error: any) {
      console.log('✅ Delete correctly failed (has purchases)');
      console.log('   Error:', error.message.substring(0, 100));
    }

    console.log('\n🎉 SDK example completed successfully!\n');

    // Summary
    console.log('📊 Summary:');
    console.log('   Workflow PDA:', sdk.getWorkflowAddress(workflowId).toBase58());
    console.log('   Access PDA:', sdk.getAccessAddress(workflowId).toBase58());
    console.log('   Review PDA:', sdk.getReviewAddress(workflowId).toBase58());
    console.log('   Explorer:', `https://explorer.solana.com/address/${sdk.getWorkflowAddress(workflowId).toBase58()}?cluster=devnet`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

// Run example
main().catch(console.error);
