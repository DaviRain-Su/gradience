import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { createKeyPairSignerFromBytes } from '@solana/kit';
import { GradienceSDK, KeypairAdapter } from '../../../agent-arena/clients/typescript/dist/index.js';
import { createSettlementBridge } from '../../src/bridge/settlement-bridge.js';
import { resolveJudgeAndPayPdas } from '../../src/solana/pda-resolver.js';
import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

const RPC = 'https://api.devnet.solana.com/';
const WALLET1_PATH = process.env.HOME + '/.config/solana/id.json';
const WALLET2_PATH = '/tmp/agent2.json';
const PROGRAM_ID = '5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs';
const TEMP_KEY_DIR = '/tmp/bridge-e2e-keys';

async function loadKitSigner(path: string) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return createKeyPairSignerFromBytes(new Uint8Array(raw));
}

describe('Daemon Bridge Devnet E2E', () => {
  it(
    'should post task, apply, submit and settle via SettlementBridge',
    async () => {
      // Ensure second test wallet exists
      if (!existsSync(WALLET2_PATH)) {
        const kp = Keypair.generate();
        writeFileSync(WALLET2_PATH, JSON.stringify(Array.from(kp.secretKey)));
      }

      rmSync(TEMP_KEY_DIR, { recursive: true, force: true });
      mkdirSync(TEMP_KEY_DIR, { recursive: true });
      const rawWallet1 = JSON.parse(readFileSync(WALLET1_PATH, 'utf8'));
      writeFileSync(`${TEMP_KEY_DIR}/evaluator.key`, Buffer.from(new Uint8Array(rawWallet1)));

      const sdk = new GradienceSDK({ rpcEndpoint: RPC });

      const signer1 = await loadKitSigner(WALLET1_PATH);
      const wallet1 = new KeypairAdapter({ signer: signer1 as any, rpcEndpoint: RPC });

      const signer2 = await loadKitSigner(WALLET2_PATH);
      const wallet2 = new KeypairAdapter({ signer: signer2 as any, rpcEndpoint: RPC });

      console.log('Poster/Judge:', signer1.address);
      console.log('Agent:', signer2.address);

      // Fund agent wallet with devnet SOL from poster/judge wallet so it can pay fees
      const connection = new Connection(RPC, 'confirmed');
      const agent2Keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync(WALLET2_PATH, 'utf8'))));
      const posterKeypair = Keypair.fromSecretKey(new Uint8Array(rawWallet1));
      try {
        const balance = await connection.getBalance(agent2Keypair.publicKey);
        if (balance < 0.5 * LAMPORTS_PER_SOL) {
          const transferTx = new (await import('@solana/web3.js')).Transaction().add(
            SystemProgram.transfer({
              fromPubkey: posterKeypair.publicKey,
              toPubkey: agent2Keypair.publicKey,
              lamports: 2 * LAMPORTS_PER_SOL,
            })
          );
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
          transferTx.recentBlockhash = blockhash;
          transferTx.feePayer = posterKeypair.publicKey;
          transferTx.sign(posterKeypair);
          const sig = await connection.sendRawTransaction(transferTx.serialize());
          await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
          console.log('Funded agent with 2 SOL from poster');
        } else {
          console.log('Agent already funded');
        }
      } catch (e) {
        console.warn('Funding agent failed:', e);
      }

      const config = await sdk.config.get();
      if (!config) throw new Error('Program config account not found');
      const taskId = config.taskCount;
      console.log('Next taskId:', taskId.toString());

      console.log('\n--- Step 1: Post Task ---');
      const now = BigInt(Math.floor(Date.now() / 1000));
      const postSig = await sdk.task.post(wallet1, {
        taskId,
        evalRef: 'bridge-e2e-' + Date.now(),
        deadline: now + 3600n,
        judgeDeadline: now + 7200n,
        judgeMode: 0,
        judge: signer1.address,
        category: 0,
        minStake: 0n,
        reward: 10_000_000n,
      });
      console.log('Post task success:', postSig);
      await new Promise((r) => setTimeout(r, 3000));

      console.log('\n--- Step 2: Apply ---');
      const applySig = await sdk.task.apply(wallet2, { taskId });
      console.log('Apply success:', applySig);
      await new Promise((r) => setTimeout(r, 3000));

      console.log('\n--- Step 3: Submit Result ---');
      const submitSig = await sdk.task.submit(wallet2, {
        taskId,
        resultRef: 'ipfs://QmResult' + Date.now(),
        traceRef: 'ipfs://QmTrace' + Date.now(),
        runtimeEnv: {
          provider: 'test',
          model: 'gpt-4',
          runtime: 'node',
          version: '1.0',
        },
      });
      console.log('Submit success:', submitSig);
      await new Promise((r) => setTimeout(r, 3000));

      console.log('\n--- Step 4: Daemon Bridge Settlement ---');
      const bridge = await createSettlementBridge({
        chainHubProgramId: PROGRAM_ID,
        rpcEndpoint: RPC,
        keyDir: TEMP_KEY_DIR,
        maxRetries: 3,
      });

      const taskIdOnChain = taskId.toString();
      const judgeAddress = signer1.address;
      const winnerAddress = signer2.address;
      const pdas = resolveJudgeAndPayPdas(
        BigInt(taskIdOnChain),
        new PublicKey(judgeAddress),
        new PublicKey(winnerAddress)
      );

      const evaluationResult = {
        evaluationId: `e2e-eval-${taskIdOnChain}`,
        score: 85,
        passed: true,
        categoryScores: [],
        checkResults: [],
        verificationHash: '0x' + Buffer.from('verify-me').toString('hex'),
        executionLog: {
          sandbox: 'local',
          startedAt: Date.now() - 1000,
          completedAt: Date.now(),
          stdout: '',
          stderr: '',
        },
        driftStatus: 'stable',
        actualCost: { amount: '0', currency: 'SOL' },
        completedAt: Date.now(),
      } as any;

      const request = {
        evaluationId: evaluationResult.evaluationId,
        taskId: `local-task-${taskIdOnChain}`,
        taskIdOnChain,
        paymentId: `payment-${taskIdOnChain}`,
        agentId: winnerAddress,
        payerAgentId: winnerAddress,
        evaluationResult,
        amount: '10000000',
        token: 'SOL',
        taskAccount: pdas.task,
        escrowAccount: pdas.escrow,
        poster: judgeAddress,
        reasonRef: 'E2E bridge settlement test',
      };

      console.log('Submitting judge_and_pay via SettlementBridge...');
      const result = await bridge.settle(request as any);
      console.log('Result:', JSON.stringify(result, null, 2));

      expect(result.status).toBe('confirmed');
      expect(result.txSignature).toBeTruthy();
      console.log(`\n✅ E2E BRIDGE SETTLEMENT SUCCESS`);
      console.log(`Explorer: https://explorer.solana.com/tx/${result.txSignature}?cluster=devnet`);
    },
    120_000
  );
});
