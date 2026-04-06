/**
 * WEG Devnet E2E
 *
 * Gateway purchase event → Arena task → auto-apply → TEE execute → settlement
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { createKeyPairSignerFromBytes } from '@solana/kit';
import { GradienceSDK, KeypairAdapter } from '../../agent-arena/clients/typescript/dist/index.js';
import { createSettlementBridge } from '../dist/src/bridge/settlement-bridge.js';
import { resolveJudgeAndPayPdas } from '../dist/src/solana/pda-resolver.js';
import { PublicKey } from '@solana/web3.js';
import {
  TeeProviderFactory,
  DefaultTeeExecutionEngine,
  AttestationVerifier,
  DefaultVelOrchestrator,
} from '../dist/src/vel/index.js';
import {
  GatewayStore,
  DefaultArenaTaskFactory,
  DefaultWorkflowExecutionGateway,
} from '../dist/src/gateway/index.js';

const RPC = 'https://api.devnet.solana.com/';
const WALLET1_PATH = process.env.HOME + '/.config/solana/id.json';
const WALLET2_PATH = '/tmp/agent2.json';
const PROGRAM_ID = '5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs';
const TEMP_KEY_DIR = '/tmp/gateway-e2e-keys';
const TEMP_ATTESTATION_DIR = '/tmp/gateway-e2e-attestations';
const TEMP_DB_PATH = '/tmp/gateway-e2e.db';

async function loadKitSigner(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return createKeyPairSignerFromBytes(new Uint8Array(raw));
}

async function main() {
  rmSync(TEMP_KEY_DIR, { recursive: true, force: true });
  mkdirSync(TEMP_KEY_DIR, { recursive: true });
  rmSync(TEMP_ATTESTATION_DIR, { recursive: true, force: true });
  mkdirSync(TEMP_ATTESTATION_DIR, { recursive: true });
  try { rmSync(TEMP_DB_PATH); } catch {}

  const rawWallet1 = JSON.parse(readFileSync(WALLET1_PATH, 'utf8'));
  writeFileSync(`${TEMP_KEY_DIR}/evaluator.key`, Buffer.from(new Uint8Array(rawWallet1)));

  const sdk = new GradienceSDK({ rpcEndpoint: RPC });

  const signer1 = await loadKitSigner(WALLET1_PATH);
  const wallet1 = new KeypairAdapter({ signer: signer1, rpcEndpoint: RPC });

  const signer2 = await loadKitSigner(WALLET2_PATH);
  const wallet2 = new KeypairAdapter({ signer: signer2, rpcEndpoint: RPC });

  console.log('Poster/Judge:', signer1.address);
  console.log('Agent:', signer2.address);

  // ------------------------------------------------------------------
  // Build Arena SDK adapter for Gateway
  // ------------------------------------------------------------------
  const arenaClient = {
    post: async (params) => {
      const sig = await sdk.task.post(wallet1, {
        taskId: params.taskId,
        evalRef: params.evalRef,
        deadline: params.deadline,
        judgeDeadline: params.judgeDeadline,
        judgeMode: params.judgeMode,
        judge: params.judge,
        category: params.category,
        minStake: params.minStake,
        reward: params.reward,
      });
      console.log('Arena post tx:', sig);
      await new Promise((r) => setTimeout(r, 3000));
      return sig;
    },
    apply: async (taskId) => {
      const sig = await sdk.task.apply(wallet2, { taskId });
      console.log('Arena apply tx:', sig);
      await new Promise((r) => setTimeout(r, 3000));
      return sig;
    },
    submit: async (taskId, params) => {
      const sig = await sdk.task.submit(wallet2, {
        taskId,
        resultRef: params.resultRef,
        traceRef: params.traceRef,
        runtimeEnv: params.runtimeEnv,
      });
      console.log('Arena submit tx:', sig);
      await new Promise((r) => setTimeout(r, 3000));
      return sig;
    },
    getNextTaskId: async () => {
      const config = await sdk.config.get();
      return config.taskCount;
    },
  };

  // ------------------------------------------------------------------
  // Build VEL execution client wrapper
  // ------------------------------------------------------------------
  const bridge = await createSettlementBridge({
    chainHubProgramId: PROGRAM_ID,
    rpcEndpoint: RPC,
    keyDir: TEMP_KEY_DIR,
    maxRetries: 3,
  });

  const provider = TeeProviderFactory.create('gramine-local');
  await provider.initialize({
    providerName: 'gramine-local',
    socketPath: '/tmp/gateway-e2e.sock',
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

  const executionClient = {
    runAndSettle: async (request) => {
      const taskIdOnChain = request.taskId.toString();
      const judgeAddress = signer1.address;
      const winnerAddress = signer2.address;
      const pdas = resolveJudgeAndPayPdas(
        BigInt(taskIdOnChain),
        new PublicKey(judgeAddress),
        new PublicKey(winnerAddress)
      );

      const orchestrator = new DefaultVelOrchestrator(engine, verifier, {
        bridge: {
          judgeAndPay: async ({ taskId: _taskId, winner, score, reasonRef }) => {
            const evaluationResult = {
              evaluationId: `gateway-e2e-eval-${taskIdOnChain}`,
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
            const settleRequest = {
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
            const result = await bridge.settleWithReasonRef(settleRequest, score, reasonRef);
            return result.txSignature;
          },
        },
        keyManager: {
          getSeedForTask: async () => crypto.getRandomValues(new Uint8Array(32)),
        },
        storage,
        defaultProvider: 'gramine-local',
      });

      return orchestrator.runAndSettle(request);
    },
  };

  // ------------------------------------------------------------------
  // Initialize Gateway
  // ------------------------------------------------------------------
  const store = new GatewayStore(TEMP_DB_PATH);
  const factory = new DefaultArenaTaskFactory(signer1.address);
  const gatewayConfig = {
    marketplaceProgramId: '3QRayGY5SHYnD5cb2qegEoNx7dPXJJyHJD3shzAQ75UW',
    arenaProgramId: PROGRAM_ID,
    rpcEndpoint: RPC,
    dbPath: TEMP_DB_PATH,
    posterWallet: { publicKey: signer1.address, signAndSendTransaction: async () => '' },
    agentWallet: { publicKey: signer2.address, signAndSendTransaction: async () => '' },
    defaultJudge: signer1.address,
    pollIntervalMs: 15000,
    maxRetries: 3,
    retryDelayMs: 5000,
  };

  const gateway = new DefaultWorkflowExecutionGateway(
    store,
    factory,
    arenaClient,
    executionClient,
    gatewayConfig
  );

  // ------------------------------------------------------------------
  // Inject synthetic PurchaseEvent (workflow purchase)
  // ------------------------------------------------------------------
  const workflowId = 'gateway-e2e-wf-' + Date.now();
  const purchaseId = `${workflowId}_${signer1.address}_${Date.now().toString(36)}`;
  const mockTxSignature = 'mock-tx-' + Date.now();

  const event = {
    purchaseId,
    buyer: signer1.address,
    workflowId,
    amount: 10_000_000n,
    txSignature: mockTxSignature,
    blockTime: Math.floor(Date.now() / 1000),
  };

  console.log('\n--- Injecting PurchaseEvent to Gateway ---');
  await gateway.processPurchase(event);

  // ------------------------------------------------------------------
  // Poll for completion
  // ------------------------------------------------------------------
  console.log('Polling for completion...');
  let settled = false;
  for (let i = 0; i < 60; i++) {
    const record = await gateway.getStatus(purchaseId);
    console.log(`  [${i}] status=${record?.status || 'null'} taskId=${record?.taskId || '-'} settlement=${record?.settlementTx?.slice(0, 16) || '-'} ...`);
    if (record?.status === 'SETTLED') {
      settled = true;
      console.log('\n✅ GATEWAY E2E SUCCESS');
      console.log(`Purchase ID : ${purchaseId}`);
      console.log(`Task ID     : ${record.taskId}`);
      console.log(`Settlement  : ${record.settlementTx}`);
      console.log(`Explorer    : https://explorer.solana.com/tx/${record.settlementTx}?cluster=devnet`);
      break;
    }
    if (record?.status === 'FAILED') {
      console.log('\n❌ GATEWAY E2E FAILED');
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (!settled) {
    console.log('\n⏱ Gateway E2E timed out');
    process.exit(1);
  }

  // Cleanup
  await provider.terminate();
  store.close();
}

main().catch((err) => {
  console.error('E2E failed:', err);
  process.exit(1);
});
