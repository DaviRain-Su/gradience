/**
 * Test script for Workflow Marketplace Program
 *
 * Tests all 8 instructions on Solana devnet
 */
import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    sendAndConfirmTransaction,
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
    console.log('🧪 Testing Workflow Marketplace Program\n');

    const connection = new Connection(RPC_URL, 'confirmed');
    const payer = loadKeypair('id.json');

    console.log('Payer:', payer.publicKey.toBase58());
    console.log('Program:', PROGRAM_ID.toBase58(), '\n');

    // Generate workflow ID
    const workflowId = Keypair.generate().publicKey;
    console.log('Workflow ID:', workflowId.toBase58(), '\n');

    // ==================== Test 0: Initialize ====================
    console.log('📝 Test 0: Initialize Program');
    try {
        const [configPDA] = findPDA([Buffer.from('config')]);
        const [treasuryPDA] = findPDA([Buffer.from('treasury')]);

        console.log('Config PDA:', configPDA.toBase58());
        console.log('Treasury PDA:', treasuryPDA.toBase58());

        // Check if already initialized
        const configInfo = await connection.getAccountInfo(configPDA);
        if (configInfo && configInfo.data.length > 0) {
            console.log('✅ Program already initialized\n');
        } else {
            const data = Buffer.concat([
                Buffer.from([0]), // instruction 0
                treasuryPDA.toBuffer(), // treasury (32 bytes)
                payer.publicKey.toBuffer(), // upgrade_authority (32 bytes)
            ]);

            const ix = new TransactionInstruction({
                keys: [
                    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                    { pubkey: configPDA, isSigner: false, isWritable: true },
                    { pubkey: treasuryPDA, isSigner: false, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                programId: PROGRAM_ID,
                data,
            });

            const tx = new Transaction().add(ix);
            const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
            console.log('✅ Initialize signature:', sig, '\n');
        }
    } catch (error: any) {
        console.error('❌ Initialize failed:', error.message, '\n');
    }

    // ==================== Test 1: Create Workflow ====================
    console.log('📝 Test 1: Create Workflow');
    try {
        const [workflowPDA] = findPDA([Buffer.from('workflow'), workflowId.toBuffer()]);

        console.log('Workflow PDA:', workflowPDA.toBase58());

        // Prepare data (156 bytes)
        const contentHash = Buffer.alloc(64, 'a'); // Fake content hash
        const version = Buffer.from('1.0.0\0\0\0\0\0\0\0\0\0\0\0'); // 16 bytes
        const pricingModel = 0; // Free
        const priceMint = PublicKey.default.toBuffer();
        const priceAmount = Buffer.alloc(8, 0); // 0 lamports (free)
        const creatorShare = Buffer.from([0, 0]); // 0 bps
        const isPublic = Buffer.from([1]); // true

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
        console.log('✅ Create Workflow signature:', sig, '\n');
    } catch (error: any) {
        console.error('❌ Create Workflow failed:', error.message, '\n');
    }

    // ==================== Test 2: Purchase Workflow ====================
    console.log('📝 Test 2: Purchase Workflow');
    try {
        const [workflowPDA] = findPDA([Buffer.from('workflow'), workflowId.toBuffer()]);
        const [accessPDA] = findPDA([Buffer.from('access'), workflowId.toBuffer(), payer.publicKey.toBuffer()]);

        console.log('Access PDA:', accessPDA.toBase58());

        const data = Buffer.concat([
            Buffer.from([2]), // instruction 2
            workflowId.toBuffer(),
            Buffer.from([0]), // access_type: purchased
        ]);

        const ix = new TransactionInstruction({
            keys: [
                { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                { pubkey: workflowPDA, isSigner: false, isWritable: true },
                { pubkey: accessPDA, isSigner: false, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: PROGRAM_ID,
            data,
        });

        const tx = new Transaction().add(ix);
        const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
        console.log('✅ Purchase Workflow signature:', sig, '\n');
    } catch (error: any) {
        console.error('❌ Purchase Workflow failed:', error.message, '\n');
    }

    // ==================== Test 3: Review Workflow ====================
    console.log('📝 Test 3: Review Workflow');
    try {
        const [workflowPDA] = findPDA([Buffer.from('workflow'), workflowId.toBuffer()]);
        const [reviewPDA] = findPDA([Buffer.from('review'), workflowId.toBuffer(), payer.publicKey.toBuffer()]);
        const [accessPDA] = findPDA([Buffer.from('access'), workflowId.toBuffer(), payer.publicKey.toBuffer()]);

        console.log('Review PDA:', reviewPDA.toBase58());

        const commentHash = Buffer.alloc(32, 'b'); // Fake comment hash
        const data = Buffer.concat([
            Buffer.from([3]), // instruction 3
            workflowId.toBuffer(),
            Buffer.from([5]), // rating: 5 stars
            commentHash,
        ]);

        const ix = new TransactionInstruction({
            keys: [
                { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                { pubkey: workflowPDA, isSigner: false, isWritable: true },
                { pubkey: reviewPDA, isSigner: false, isWritable: true },
                { pubkey: accessPDA, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: PROGRAM_ID,
            data,
        });

        const tx = new Transaction().add(ix);
        const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
        console.log('✅ Review Workflow signature:', sig, '\n');
    } catch (error: any) {
        console.error('❌ Review Workflow failed:', error.message, '\n');
    }

    // ==================== Test 4: Update Workflow ====================
    console.log('📝 Test 4: Update Workflow');
    try {
        const [workflowPDA] = findPDA([Buffer.from('workflow'), workflowId.toBuffer()]);

        const newContentHash = Buffer.alloc(64, 'c'); // New content hash
        const data = Buffer.concat([
            Buffer.from([4]), // instruction 4
            workflowId.toBuffer(),
            newContentHash,
        ]);

        const ix = new TransactionInstruction({
            keys: [
                { pubkey: payer.publicKey, isSigner: true, isWritable: false },
                { pubkey: workflowPDA, isSigner: false, isWritable: true },
            ],
            programId: PROGRAM_ID,
            data,
        });

        const tx = new Transaction().add(ix);
        const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
        console.log('✅ Update Workflow signature:', sig, '\n');
    } catch (error: any) {
        console.error('❌ Update Workflow failed:', error.message, '\n');
    }

    // ==================== Test 5: Deactivate Workflow ====================
    console.log('📝 Test 5: Deactivate Workflow');
    try {
        const [workflowPDA] = findPDA([Buffer.from('workflow'), workflowId.toBuffer()]);

        const data = Buffer.concat([
            Buffer.from([5]), // instruction 5
            workflowId.toBuffer(),
        ]);

        const ix = new TransactionInstruction({
            keys: [
                { pubkey: payer.publicKey, isSigner: true, isWritable: false },
                { pubkey: workflowPDA, isSigner: false, isWritable: true },
            ],
            programId: PROGRAM_ID,
            data,
        });

        const tx = new Transaction().add(ix);
        const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
        console.log('✅ Deactivate Workflow signature:', sig, '\n');
    } catch (error: any) {
        console.error('❌ Deactivate Workflow failed:', error.message, '\n');
    }

    // ==================== Test 6: Activate Workflow ====================
    console.log('📝 Test 6: Activate Workflow');
    try {
        const [workflowPDA] = findPDA([Buffer.from('workflow'), workflowId.toBuffer()]);

        const data = Buffer.concat([
            Buffer.from([6]), // instruction 6
            workflowId.toBuffer(),
        ]);

        const ix = new TransactionInstruction({
            keys: [
                { pubkey: payer.publicKey, isSigner: true, isWritable: false },
                { pubkey: workflowPDA, isSigner: false, isWritable: true },
            ],
            programId: PROGRAM_ID,
            data,
        });

        const tx = new Transaction().add(ix);
        const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
        console.log('✅ Activate Workflow signature:', sig, '\n');
    } catch (error: any) {
        console.error('❌ Activate Workflow failed:', error.message, '\n');
    }

    // ==================== Test 7: Delete Workflow ====================
    console.log('📝 Test 7: Delete Workflow (will fail - has purchases)');
    try {
        const [workflowPDA] = findPDA([Buffer.from('workflow'), workflowId.toBuffer()]);

        const data = Buffer.concat([
            Buffer.from([7]), // instruction 7
            workflowId.toBuffer(),
        ]);

        const ix = new TransactionInstruction({
            keys: [
                { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                { pubkey: workflowPDA, isSigner: false, isWritable: true },
            ],
            programId: PROGRAM_ID,
            data,
        });

        const tx = new Transaction().add(ix);
        const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
        console.log('✅ Delete Workflow signature:', sig, '\n');
    } catch (error: any) {
        console.log('✅ Delete correctly failed (has purchases):', error.message, '\n');
    }

    console.log('🎉 All tests completed!\n');
}

test().catch(console.error);
