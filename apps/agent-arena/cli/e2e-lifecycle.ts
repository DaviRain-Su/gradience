/**
 * E2E lifecycle test: two different wallets doing a full task lifecycle on devnet.
 *
 * Wallet 1 (poster/judge): ~/.config/solana/id.json
 * Wallet 2 (agent): /tmp/agent2.json
 *
 * Steps:
 *   1. Wallet 1 posts a task (using taskCount from config as taskId)
 *   2. Wallet 2 applies for the task
 *   3. Wallet 2 submits a result
 *   4. Wallet 1 judges the task with score=85
 */

import { readFile } from 'node:fs/promises';
import { createKeyPairSignerFromBytes } from '@solana/kit';
import { GradienceSDK } from '../clients/typescript/src/sdk.js';
import { KeypairAdapter } from '../clients/typescript/src/wallet-adapters.js';

const RPC = 'https://api.devnet.solana.com/';
const WALLET1_PATH = process.env.HOME + '/.config/solana/id.json';
const WALLET2_PATH = '/tmp/agent2.json';

async function loadSigner(path: string) {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw);
    const bytes = Uint8Array.from(parsed as number[]);
    return createKeyPairSignerFromBytes(bytes);
}

async function main() {
    console.log('=== E2E LIFECYCLE TEST ===\n');

    // Setup SDK and wallets
    const sdk = new GradienceSDK({ rpcEndpoint: RPC });

    const signer1 = await loadSigner(WALLET1_PATH);
    const wallet1 = new KeypairAdapter({ signer: signer1, rpcEndpoint: RPC });
    console.log('Wallet 1 (poster/judge):', signer1.address);

    const signer2 = await loadSigner(WALLET2_PATH);
    const wallet2 = new KeypairAdapter({ signer: signer2, rpcEndpoint: RPC });
    console.log('Wallet 2 (agent):', signer2.address);
    console.log('');

    // Step 0: Read config to get taskCount
    let taskId: bigint;
    try {
        const config = await sdk.config.get();
        if (!config) throw new Error('Config not found');
        taskId = config.taskCount;
        console.log('[CONFIG] taskCount (next taskId):', taskId.toString());
    } catch (e: any) {
        console.error('[CONFIG] FAILED:', e.message);
        return;
    }

    // Step 1: Wallet 1 posts a task
    console.log('\n--- Step 1: Post Task ---');
    try {
        const now = BigInt(Math.floor(Date.now() / 1000));
        const sig = await sdk.task.post(wallet1, {
            taskId,
            evalRef: 'e2e-lifecycle-test-' + Date.now(),
            deadline: now + 3600n,
            judgeDeadline: now + 7200n,
            judgeMode: 0, // designated judge
            judge: signer1.address, // wallet1 is the judge
            category: 0,
            minStake: 0n,
            reward: 10_000_000n, // 0.01 SOL
        });
        console.log('[POST TASK] SUCCESS! Sig:', sig);
    } catch (e: any) {
        console.error('[POST TASK] FAILED:', e.message);
        if (e.context?.logs) console.error('  Logs:', e.context.logs.slice(-5));
        return;
    }

    // Small delay to let the tx confirm
    await new Promise(r => setTimeout(r, 3000));

    // Step 2: Wallet 2 applies for the task
    console.log('\n--- Step 2: Apply for Task ---');
    try {
        const sig = await sdk.task.apply(wallet2, { taskId });
        console.log('[APPLY] SUCCESS! Sig:', sig);
    } catch (e: any) {
        console.error('[APPLY] FAILED:', e.message);
        if (e.context?.logs) console.error('  Logs:', e.context.logs.slice(-5));
        return;
    }

    await new Promise(r => setTimeout(r, 3000));

    // Step 3: Wallet 2 submits result
    console.log('\n--- Step 3: Submit Result ---');
    try {
        const sig = await sdk.task.submit(wallet2, {
            taskId,
            resultRef: 'ipfs://QmE2ETest' + Date.now(),
            traceRef: 'ipfs://QmTraceTest' + Date.now(),
            runtimeEnv: {
                provider: 'test',
                model: 'gpt-4',
                runtime: 'node',
                version: '1.0',
            },
        });
        console.log('[SUBMIT] SUCCESS! Sig:', sig);
    } catch (e: any) {
        console.error('[SUBMIT] FAILED:', e.message);
        if (e.context?.logs) console.error('  Logs:', e.context.logs.slice(-5));
        return;
    }

    await new Promise(r => setTimeout(r, 3000));

    // Step 4: Wallet 1 judges the task with score=85
    console.log('\n--- Step 4: Judge Task ---');
    try {
        const sig = await sdk.task.judge(wallet1, {
            taskId,
            winner: signer2.address,
            poster: signer1.address,
            score: 85,
            reasonRef: 'Good work on e2e test',
        });
        console.log('[JUDGE] SUCCESS! Sig:', sig);
    } catch (e: any) {
        console.error('[JUDGE] FAILED:', e.message);
        if (e.context?.logs) console.error('  Logs:', e.context.logs.slice(-5));
        // Don't return - still report
    }

    console.log('\n=== E2E LIFECYCLE TEST COMPLETE ===');
}

main().catch(e => {
    console.error('Unexpected error:', e);
    process.exit(1);
});
