/**
 * Test script for Jupiter Swap
 * 
 * Usage: npx tsx tests/swap-test.ts
 */
import { Connection, Keypair } from '@solana/web3.js';
import { createRealSwapHandler } from '../src/handlers/trading-real.js';
import * as fs from 'fs';
import * as os from 'os';

async function testSwap() {
  console.log('🧪 Testing Jupiter Swap\n');

  // 1. Setup
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  console.log('✅ Connection created');

  // 2. Load signer
  const keypairPath = os.homedir() + '/.config/solana/id.json';
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const signer = Keypair.fromSecretKey(new Uint8Array(keypairData));
  console.log('✅ Signer loaded:', signer.publicKey.toBase58());

  // 3. Check balance
  const balance = await connection.getBalance(signer.publicKey);
  console.log('💰 Balance:', balance / 1e9, 'SOL\n');

  if (balance < 0.01 * 1e9) {
    console.error('❌ Insufficient balance. Need at least 0.01 SOL');
    process.exit(1);
  }

  // 4. Create handler
  const handler = createRealSwapHandler({ connection });
  console.log('✅ Handler created\n');

  // 5. Test swap: SOL -> USDC
  console.log('🔄 Swapping 0.001 SOL to USDC...');
  console.log('⏳ This may take 10-30 seconds...\n');

  try {
    const result = await handler.execute(
      'solana',
      {
        from: 'So11111111111111111111111111111111111111112', // SOL
        to: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        amount: '1000000', // 0.001 SOL
        slippage: 1.0, // 1% slippage for test
        signer,
      },
      { executor: signer.publicKey.toBase58() }
    );

    console.log('\n✅ Swap successful!');
    console.log('📋 Transaction Hash:', result.txHash);
    console.log('🔗 Explorer:', result.explorer);
    console.log('📊 Input:', result.inputAmount, 'lamports');
    console.log('📊 Output:', result.outputAmount, 'USDC lamports');
    console.log('📊 Route:', result.route?.join(' -> '));
    console.log('📊 Price Impact:', result.priceImpact, '%');

    // 6. Verify
    console.log('\n🔍 Verifying transaction...');
    const status = await connection.getSignatureStatus(result.txHash as string);
    if (status.value?.confirmationStatus === 'confirmed') {
      console.log('✅ Transaction confirmed on-chain!');
    }

  } catch (error: any) {
    console.error('\n❌ Swap failed:', error.message);
    if (error.message.includes('Insufficient funds')) {
      console.log('💡 Tip: You need SOL for the swap + transaction fee');
    }
    if (error.message.includes('Jupiter')) {
      console.log('💡 Tip: Jupiter API may be rate limited, try again in a few seconds');
    }
    process.exit(1);
  }

  console.log('\n🎉 Swap test completed successfully!');
}

testSwap().catch(console.error);
