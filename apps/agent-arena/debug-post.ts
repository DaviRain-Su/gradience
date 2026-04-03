import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { createKeyPairSignerFromBytes, createSolanaRpc, getBase64EncodedWireTransaction, type Instruction } from '@solana/kit';

import {
    GRADIENCE_PROGRAM_ADDRESS,
    GradienceSDK,
    KeypairAdapter,
} from './clients/typescript/src/index.js';

async function main() {
    const rpcUrl = 'https://api.devnet.solana.com';
    const rpc = createSolanaRpc(rpcUrl);
    const sdk = new GradienceSDK({ rpc, rpcEndpoint: rpcUrl, programAddress: GRADIENCE_PROGRAM_ADDRESS });
    
    const keypairPath = path.join(homedir(), '.config/solana/id.json');
    const raw = JSON.parse(await readFile(keypairPath, 'utf8'));
    const signer = await createKeyPairSignerFromBytes(new Uint8Array(raw));
    const wallet = new KeypairAdapter({ signer, rpc });
    
    console.log('Program:', GRADIENCE_PROGRAM_ADDRESS);
    console.log('Wallet:', signer.address);
    
    // First check the current task_count from config
    const config = await sdk.config.get();
    console.log('Config:', config);
    const nextTaskId = config ? Number(config.taskCount) : 0;
    console.log('Next task ID should be:', nextTaskId);

    // Post task with correct sequential ID
    try {
        const sig = await sdk.postTask(wallet, {
            taskId: nextTaskId,
            evalRef: 'smart-contract-audit',
            reward: 50000000n,
            category: 0,
            minStake: 0n,
            judgeMode: 0,
            judge: signer.address,
            deadline: BigInt(Math.floor(Date.now()/1000) + 86400),
            judgeDeadline: BigInt(Math.floor(Date.now()/1000) + 172800),
        });
        console.log('✅ Post task', nextTaskId, ':', sig);
    } catch (e: any) {
        console.error('❌ Post error:', e?.message?.slice(0, 500));
    }

    // Apply
    try {
        const sig = await sdk.applyForTask(wallet, { taskId: nextTaskId });
        console.log('✅ Apply task', nextTaskId, ':', sig);
    } catch (e: any) {
        console.error('❌ Apply error:', e?.message?.slice(0, 500));
    }

    // Submit
    try {
        const sig = await sdk.submitResult(wallet, {
            taskId: nextTaskId,
            resultRef: 'QmAuditResult123',
            traceRef: 'QmTraceLog456',
            runtimeEnv: { provider: 'openai', model: 'gpt-4', runtime: 'node', version: '20' },
        });
        console.log('✅ Submit task', nextTaskId, ':', sig);
    } catch (e: any) {
        console.error('❌ Submit error:', e?.message?.slice(0, 500));
    }

    // Judge
    try {
        const sig = await sdk.judgeTask(wallet, {
            taskId: nextTaskId,
            winner: signer.address,
            poster: signer.address,
            score: 85,
            reasonRef: 'QmJudgeReason789',
        });
        console.log('✅ Judge task', nextTaskId, ':', sig);
    } catch (e: any) {
        console.error('❌ Judge error:', e?.message?.slice(0, 500));
    }
}
main().catch(console.error);
