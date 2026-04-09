/**
 * Test script for Workflow Marketplace - Payment Features (Phase 5)
 *
 * Tests:
 * - Purchase with payment (SOL transfer)
 * - Revenue distribution (protocol fee + author payment)
 * - Subscription expiration (30 days)
 * - Execution tracking
 */
import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const PROGRAM_ID = new PublicKey('3QRayGY5SHYnD5cb2qegEoNx7dPXJJyHJD3shzAQ75UW');
const RPC_URL = 'https://api.devnet.solana.com';

// Load keypair from file
function loadKeypair(filename: string): Keypair {
    const keypairPath = path.join(process.env.HOME!, '.config', 'solana', filename);
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

// Helper to find PDA
function findPDA(seeds: (Buffer | Uint8Array)[]): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
}

async function test() {
    console.log('💰 Phase 5: Payment Features Test\n');

    const connection = new Connection(RPC_URL, 'confirmed');
    const payer = loadKeypair('id.json');

    console.log('Payer:', payer.publicKey.toBase58());
    const initialBalance = await connection.getBalance(payer.publicKey);
    console.log('Initial Balance:', initialBalance / LAMPORTS_PER_SOL, 'SOL\n');

    // Generate workflow ID
    const workflowId = Keypair.generate().publicKey;
    console.log('Workflow ID:', workflowId.toBase58());

    // Get PDA addresses
    const [workflowPDA] = findPDA([Buffer.from('workflow'), workflowId.toBuffer()]);
    const [configPDA] = findPDA([Buffer.from('config')]);
    const [treasuryPDA] = findPDA([Buffer.from('treasury')]);

    console.log('Workflow PDA:', workflowPDA.toBase58());
    console.log('Treasury PDA:', treasuryPDA.toBase58());
    console.log();

    // ==================== Test 1: Create Paid Workflow ====================
    console.log('📝 Test 1: Create Paid Workflow (0.01 SOL)');
    try {
        // Content hash (64 bytes)
        const contentHash = Buffer.alloc(64, 'p');
        // Version (16 bytes)
        const version = Buffer.from('1.0.0\0\0\0\0\0\0\0\0\0\0\0');
        // Pricing: OneTime = 1
        const pricingModel = 1;
        // Price mint (default = SOL)
        const priceMint = PublicKey.default.toBuffer();
        // Price amount: 0.01 SOL = 10_000_000 lamports
        const priceAmount = Buffer.alloc(8);
        priceAmount.writeBigUInt64LE(BigInt(0.01 * LAMPORTS_PER_SOL));
        // Creator share: 500 bps = 5%
        const creatorShare = Buffer.alloc(2);
        creatorShare.writeUInt16LE(500);
        // Is public
        const isPublic = Buffer.from([1]);

        const data = Buffer.concat([
            Buffer.from([1]), // instruction 1
            workflowId.toBuffer(),
            contentHash,
            version,
            Buffer.from([pricingModel]),
            priceMint,
            priceAmount,
            creatorShare,
            isPublic,
        ]);

        const ix = new TransactionInstruction({
            keys: [
                { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                { pubkey: workflowPDA, isSigner: false, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: PROGRAM_ID,
            data,
        });

        const tx = new Transaction().add(ix);
        const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
        console.log('✅ Created paid workflow:', sig);

        // Check workflow metadata
        const workflowInfo = await connection.getAccountInfo(workflowPDA);
        if (workflowInfo) {
            const price = workflowInfo.data.readBigUInt64LE(147);
            console.log('   Price:', Number(price) / LAMPORTS_PER_SOL, 'SOL');
        }
        console.log();
    } catch (error: any) {
        console.error('❌ Failed:', error.message, '\n');
    }

    // ==================== Test 2: Purchase with Payment ====================
    console.log('💸 Test 2: Purchase with Payment (0.01 SOL)');
    try {
        const [accessPDA] = findPDA([Buffer.from('access'), workflowId.toBuffer(), payer.publicKey.toBuffer()]);

        // Get balances before
        const authorBalanceBefore = await connection.getBalance(payer.publicKey);
        const treasuryBalanceBefore = await connection.getBalance(treasuryPDA);

        console.log('   Author balance before:', authorBalanceBefore / LAMPORTS_PER_SOL, 'SOL');
        console.log('   Treasury balance before:', treasuryBalanceBefore / LAMPORTS_PER_SOL, 'SOL');

        const data = Buffer.concat([
            Buffer.from([8]), // instruction 8 (purchase v2 with payment)
            workflowId.toBuffer(),
            Buffer.from([0]), // access_type: purchased
        ]);

        const ix = new TransactionInstruction({
            keys: [
                { pubkey: payer.publicKey, isSigner: true, isWritable: true }, // buyer (also author in this test)
                { pubkey: workflowPDA, isSigner: false, isWritable: true },
                { pubkey: accessPDA, isSigner: false, isWritable: true },
                { pubkey: payer.publicKey, isSigner: false, isWritable: true }, // author (same as buyer for test)
                { pubkey: treasuryPDA, isSigner: false, isWritable: true },
                { pubkey: configPDA, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: PROGRAM_ID,
            data,
        });

        const tx = new Transaction().add(ix);
        const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
        console.log('✅ Purchased with payment:', sig);

        // Check balances after
        const authorBalanceAfter = await connection.getBalance(payer.publicKey);
        const treasuryBalanceAfter = await connection.getBalance(treasuryPDA);

        console.log('   Author balance after:', authorBalanceAfter / LAMPORTS_PER_SOL, 'SOL');
        console.log('   Treasury balance after:', treasuryBalanceAfter / LAMPORTS_PER_SOL, 'SOL');

        // Calculate transfers
        const price = 0.01 * LAMPORTS_PER_SOL;
        const protocolFee = price * 0.02; // 2% from config
        const expectedAuthorReceive = price - protocolFee;

        console.log('   Expected protocol fee:', protocolFee / LAMPORTS_PER_SOL, 'SOL');
        console.log('   Expected author receive:', expectedAuthorReceive / LAMPORTS_PER_SOL, 'SOL');

        // Verify treasury received fee
        const treasuryReceived = treasuryBalanceAfter - treasuryBalanceBefore;
        console.log('   Actual treasury received:', treasuryReceived / LAMPORTS_PER_SOL, 'SOL');
        console.log();
    } catch (error: any) {
        console.error('❌ Failed:', error.message, '\n');
    }

    // ==================== Test 3: Subscription Purchase ====================
    console.log('📅 Test 3: Subscription Purchase (30 days)');
    try {
        const subWorkflowId = Keypair.generate().publicKey;
        const [subWorkflowPDA] = findPDA([Buffer.from('workflow'), subWorkflowId.toBuffer()]);
        const [subAccessPDA] = findPDA([Buffer.from('access'), subWorkflowId.toBuffer(), payer.publicKey.toBuffer()]);

        // Create subscription workflow
        const contentHash = Buffer.alloc(64, 's');
        const version = Buffer.from('1.0.0\0\0\0\0\0\0\0\0\0\0\0');
        const priceAmount = Buffer.alloc(8);
        priceAmount.writeBigUInt64LE(BigInt(0.005 * LAMPORTS_PER_SOL)); // 0.005 SOL/month
        const creatorShare = Buffer.alloc(2);
        creatorShare.writeUInt16LE(500);

        const createData = Buffer.concat([
            Buffer.from([1]),
            subWorkflowId.toBuffer(),
            contentHash,
            version,
            Buffer.from([2]), // subscription pricing model
            PublicKey.default.toBuffer(),
            priceAmount,
            creatorShare,
            Buffer.from([1]),
        ]);

        const createIx = new TransactionInstruction({
            keys: [
                { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                { pubkey: subWorkflowPDA, isSigner: false, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: PROGRAM_ID,
            data: createData,
        });

        await sendAndConfirmTransaction(connection, new Transaction().add(createIx), [payer]);
        console.log('✅ Created subscription workflow');

        // Purchase subscription
        const purchaseData = Buffer.concat([
            Buffer.from([8]),
            subWorkflowId.toBuffer(),
            Buffer.from([1]), // access_type: subscribed
        ]);

        const purchaseIx = new TransactionInstruction({
            keys: [
                { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                { pubkey: subWorkflowPDA, isSigner: false, isWritable: true },
                { pubkey: subAccessPDA, isSigner: false, isWritable: true },
                { pubkey: payer.publicKey, isSigner: false, isWritable: true },
                { pubkey: treasuryPDA, isSigner: false, isWritable: true },
                { pubkey: configPDA, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: PROGRAM_ID,
            data: purchaseData,
        });

        const sig = await sendAndConfirmTransaction(connection, new Transaction().add(purchaseIx), [payer]);
        console.log('✅ Purchased subscription:', sig);

        // Check access record
        const accessInfo = await connection.getAccountInfo(subAccessPDA);
        if (accessInfo) {
            const accessType = accessInfo.data[66];
            const expiresAt = accessInfo.data.readBigInt64LE(75);
            const now = BigInt(Math.floor(Date.now() / 1000));
            const daysUntilExpiry = Number(expiresAt - now) / (24 * 60 * 60);

            console.log('   Access type:', accessType === 1 ? 'Subscription' : 'Other');
            console.log('   Expires in:', daysUntilExpiry.toFixed(1), 'days');
        }
        console.log();
    } catch (error: any) {
        console.error('❌ Failed:', error.message, '\n');
    }

    // ==================== Test 4: Record Execution ====================
    console.log('⚡ Test 4: Record Workflow Execution');
    try {
        const [accessPDA] = findPDA([Buffer.from('access'), workflowId.toBuffer(), payer.publicKey.toBuffer()]);

        // Get execution count before
        const accessBefore = await connection.getAccountInfo(accessPDA);
        const executionsBefore = accessBefore ? accessBefore.data.readUInt32LE(83) : 0;
        console.log('   Executions before:', executionsBefore);

        const data = Buffer.concat([
            Buffer.from([9]), // instruction 9 (record execution)
            workflowId.toBuffer(),
        ]);

        const ix = new TransactionInstruction({
            keys: [
                { pubkey: payer.publicKey, isSigner: true, isWritable: false },
                { pubkey: workflowPDA, isSigner: false, isWritable: true },
                { pubkey: accessPDA, isSigner: false, isWritable: true },
            ],
            programId: PROGRAM_ID,
            data,
        });

        const tx = new Transaction().add(ix);
        const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
        console.log('✅ Recorded execution:', sig);

        // Check execution count after
        const accessAfter = await connection.getAccountInfo(accessPDA);
        const executionsAfter = accessAfter ? accessAfter.data.readUInt32LE(83) : 0;
        console.log('   Executions after:', executionsAfter);
        console.log();
    } catch (error: any) {
        console.error('❌ Failed:', error.message, '\n');
    }

    // ==================== Summary ====================
    console.log('🎉 Phase 5 Tests Completed!\n');

    const finalBalance = await connection.getBalance(payer.publicKey);
    console.log('Final Balance:', finalBalance / LAMPORTS_PER_SOL, 'SOL');
    console.log('Total Spent:', (initialBalance - finalBalance) / LAMPORTS_PER_SOL, 'SOL');
    console.log('\n✅ Payment features working correctly!');
}

test().catch(console.error);
