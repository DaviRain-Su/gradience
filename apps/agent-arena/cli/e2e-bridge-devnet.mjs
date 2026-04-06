import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { createKeyPairSignerFromBytes } from '@solana/kit';
import { GradienceSDK } from '../clients/typescript/dist/sdk.js';
import { KeypairAdapter } from '../clients/typescript/dist/wallet-adapters.js';
import { createSettlementBridge } from '../../agent-daemon/dist/src/bridge/settlement-bridge.js';
import { resolveJudgeAndPayPdas } from '../../agent-daemon/dist/src/solana/pda-resolver.js';
import { PublicKey } from '@solana/web3.js';

const RPC = 'https://api.devnet.solana.com/';
const WALLET1_PATH = process.env.HOME + '/.config/solana/id.json';
const WALLET2_PATH = '/tmp/agent2.json';
const PROGRAM_ID = '5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs';
const TEMP_KEY_DIR = '/tmp/bridge-e2e-keys';

function loadKitSigner(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return createKeyPairSignerFromBytes(new Uint8Array(raw));
}

async function main() {
  rmSync(TEMP_KEY_DIR, { recursive: true, force: true });
  mkdirSync(TEMP_KEY_DIR, { recursive: true });
  const rawWallet1 = JSON.parse(readFileSync(WALLET1_PATH, 'utf8'));
  writeFileSync(`${TEMP_KEY_DIR}/evaluator.key`, Buffer.from(new Uint8Array(rawWallet1)));

  const sdk = new GradienceSDK({ rpcEndpoint: RPC });

  const signer1 = loadKitSigner(WALLET1_PATH);
  const wallet1 = new KeypairAdapter({ signer: signer1, rpcEndpoint: RPC });

  const signer2 = loadKitSigner(WALLET2_PATH);
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
  };

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
    taskAccount: pdas.task.toBase58(),
    escrowAccount: pdas.escrow.toBase58(),
    poster: judgeAddress,
    reasonRef: 'E2E bridge settlement test',
  };

  console.log('Submitting judge_and_pay via SettlementBridge...');
  const result = await bridge.settle(request);
  console.log('Result:', JSON.stringify(result, null, 2));

  if (result.status === 'confirmed') {
    console.log('\n✅ E2E BRIDGE SETTLEMENT SUCCESS');
    console.log(`Explorer: https://explorer.solana.com/tx/${result.txSignature}?cluster=devnet`);
  } else {
    console.error('\n❌ E2E BRIDGE SETTLEMENT FAILED');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('E2E failed:', err);
  process.exit(1);
});
