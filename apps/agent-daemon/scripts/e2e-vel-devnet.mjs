/**
 * VEL Devnet E2E
 *
 * Full cycle: post task → apply → submit result → TEE execute → judge_and_pay with VEL proof
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { createKeyPairSignerFromBytes } from '@solana/kit';
import { GradienceSDK, KeypairAdapter } from '@gradiences/arena-sdk';
import { createSettlementBridge } from '../dist/src/bridge/settlement-bridge.js';
import { resolveJudgeAndPayPdas } from '../dist/src/solana/pda-resolver.js';
import { PublicKey } from '@solana/web3.js';
import {
  TeeProviderFactory,
  DefaultTeeExecutionEngine,
  AttestationVerifier,
  DefaultVelOrchestrator,
} from '../dist/src/vel/index.js';

const RPC = 'https://api.devnet.solana.com/';
const WALLET1_PATH = process.env.HOME + '/.config/solana/id.json';
const WALLET2_PATH = '/tmp/agent2.json';
const PROGRAM_ID = '5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs';
const TEMP_KEY_DIR = '/tmp/vel-e2e-keys';
const TEMP_ATTESTATION_DIR = '/tmp/vel-e2e-attestations';

async function loadKitSigner(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return createKeyPairSignerFromBytes(new Uint8Array(raw));
}

async function main() {
  rmSync(TEMP_KEY_DIR, { recursive: true, force: true });
  mkdirSync(TEMP_KEY_DIR, { recursive: true });
  rmSync(TEMP_ATTESTATION_DIR, { recursive: true, force: true });
  mkdirSync(TEMP_ATTESTATION_DIR, { recursive: true });

  const rawWallet1 = JSON.parse(readFileSync(WALLET1_PATH, 'utf8'));
  writeFileSync(`${TEMP_KEY_DIR}/evaluator.key`, Buffer.from(new Uint8Array(rawWallet1)));

  const sdk = new GradienceSDK({ rpcEndpoint: RPC });

  const signer1 = await loadKitSigner(WALLET1_PATH);
  const wallet1 = new KeypairAdapter({ signer: signer1, rpcEndpoint: RPC });

  const signer2 = await loadKitSigner(WALLET2_PATH);
  const wallet2 = new KeypairAdapter({ signer: signer2, rpcEndpoint: RPC });

  console.log('Poster/Judge:', signer1.address);
  console.log('Agent:', signer2.address);

  const config = await sdk.config.get();
  if (!config) throw new Error('Program config account not found');
  const taskId = config.taskCount;
  console.log('Next taskId:', taskId.toString());

  console.log('\n--- Step 1: Post Task ---');
  const now = BigInt(Math.floor(Date.now() / 1000));
  const postSig = await sdk.task.post(wallet1, {
    taskId,
    evalRef: 'vel-e2e-' + Date.now(),
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

  console.log('\n--- Step 4: TEE Execution + VEL Settlement ---');
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

  const provider = TeeProviderFactory.create('gramine-local');
  await provider.initialize({
    providerName: 'gramine-local',
    socketPath: '/tmp/vel-e2e.sock',
    allowedPcrValues: ['mock-pcr-allowed'],
  });

  const engine = new DefaultTeeExecutionEngine(provider);
  const verifier = new AttestationVerifier(provider);

  const storage = {
    upload: async (bundle) => {
      const path = `${TEMP_ATTESTATION_DIR}/${bundle.taskId}.json`;
      writeFileSync(path, JSON.stringify(bundle, null, 2));
      return `file://${path}`;
    },
  };

  const orchestrator = new DefaultVelOrchestrator(engine, verifier, {
    bridge: {
      judgeAndPay: async ({ taskId: _taskId, winner, score, reasonRef }) => {
        const evaluationResult = {
          evaluationId: `vel-e2e-eval-${taskIdOnChain}`,
          score,
          passed: score >= 60,
          categoryScores: [],
          checkResults: [],
          verificationHash: reasonRef,
          executionLog: { sandbox: 'gramine-mock', startedAt: Date.now() - 1000, completedAt: Date.now(), stdout: '', stderr: '' },
          driftStatus: 'stable',
          actualCost: { amount: '0', currency: 'SOL' },
          completedAt: Date.now(),
        };
        const request = {
          evaluationId: evaluationResult.evaluationId,
          taskId: `local-task-${taskIdOnChain}`,
          taskIdOnChain,
          paymentId: `payment-${taskIdOnChain}`,
          agentId: winner,
          payerAgentId: winner,
          evaluationResult,
          amount: '10000000',
          token: 'SOL',
          taskAccount: pdas.task.toBase58(),
          escrowAccount: pdas.escrow.toBase58(),
          poster: judgeAddress,
          reasonRef,
        };
        const result = await bridge.settleWithReasonRef(request, score, reasonRef);
        return result.txSignature;
      },
    },
    keyManager: {
      getSeedForTask: async () => crypto.getRandomValues(new Uint8Array(32)),
    },
    storage,
    defaultProvider: 'gramine-local',
  });

  const velRequest = {
    workflowId: 'vel-e2e-workflow',
    workflowDefinition: {
      version: '1.0',
      name: 'vel-e2e-workflow',
      steps: [{ type: 'swap', params: { inputMint: 'A', outputMint: 'B', amount: 100n } }],
    },
    inputs: {},
    taskId: Number(taskIdOnChain),
    executorAddress: winnerAddress,
    timeoutMs: 15_000,
  };

  console.log('Executing workflow in mock TEE and submitting VEL settlement...');
  const txSig = await orchestrator.runAndSettle(velRequest);
  console.log('VEL settlement tx:', txSig);
  await provider.terminate();

  console.log('\n✅ E2E VEL SETTLEMENT SUCCESS');
  console.log(`Explorer: https://explorer.solana.com/tx/${txSig}?cluster=devnet`);
}

main().catch((err) => {
  console.error('E2E failed:', err);
  process.exit(1);
});
