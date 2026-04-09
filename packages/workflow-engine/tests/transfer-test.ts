/**
 * Test script for real Solana transfer
 *
 * Usage: npx tsx tests/transfer-test.ts
 */
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { createRealTransferHandler } from '../src/handlers/trading-real.js';
import * as fs from 'fs';
import * as os from 'os';

async function testTransfer() {
    console.log('🧪 Testing Real Solana Transfer\n');

    // 1. Setup connection
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    console.log('✅ Connection created');

    // 2. Load signer from default Solana CLI keypair
    const keypairPath = os.homedir() + '/.config/solana/id.json';
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    const signer = Keypair.fromSecretKey(new Uint8Array(keypairData));
    console.log('✅ Signer loaded:', signer.publicKey.toBase58());

    // 3. Check balance
    const balance = await connection.getBalance(signer.publicKey);
    console.log('💰 Balance:', balance / 1e9, 'SOL');

    if (balance < 0.002 * 1e9) {
        console.error('❌ Insufficient balance. Need at least 0.002 SOL');
        console.log('Run: solana airdrop 2');
        process.exit(1);
    }

    // 4. Create handler
    const handler = createRealTransferHandler({ connection });
    console.log('✅ Handler created\n');

    // 5. Test SOL transfer
    console.log('📤 Sending 0.001 SOL to self...');
    try {
        const result = await handler.execute(
            'solana',
            {
                token: 'SOL',
                to: signer.publicKey.toBase58(), // Send to self for testing
                amount: '1000000', // 0.001 SOL
                signer,
            },
            { executor: signer.publicKey.toBase58() },
        );

        console.log('\n✅ Transfer successful!');
        console.log('📋 Transaction Hash:', result.txHash);
        console.log('🔗 Explorer:', result.explorer);
        console.log('📊 Amount:', result.amount);
        console.log('📍 To:', result.to);

        // 6. Verify transaction
        console.log('\n🔍 Verifying transaction...');
        const status = await connection.getSignatureStatus(result.txHash as string);
        if (status.value?.confirmationStatus === 'confirmed') {
            console.log('✅ Transaction confirmed on-chain!');
        } else {
            console.log('⚠️ Transaction status:', status.value?.confirmationStatus);
        }
    } catch (error) {
        console.error('\n❌ Transfer failed:', error);
        process.exit(1);
    }

    console.log('\n🎉 Test completed successfully!');
}

testTransfer().catch(console.error);
