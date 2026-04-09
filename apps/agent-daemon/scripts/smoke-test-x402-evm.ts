#!/usr/bin/env tsx
/**
 * X402 EVM Smoke Test on X Layer Testnet
 *
 * Flow:
 * 1. Check token balances
 * 2. Build ERC-2612 permit signature (payer)
 * 3. Lock funds via X402Settlement (provider/any caller)
 * 4. Settle partial amount (provider)
 * 5. Verify on-chain via event logs and contract state
 */

import { xLayerTestnet } from 'viem/chains';
import {
  createPublicClient,
  http,
  formatEther,
  parseEther,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { X402EvmClient } from '../src/payments/x402-evm.js';
import { buildPermitSignature } from '../src/payments/x402-evm-signer.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
const RPC_URL = process.env.AGENTD_EVM_RPC_URL || 'https://testrpc.xlayer.tech';
const SETTLEMENT_ADDRESS = (process.env.AGENTD_X402_EVM_SETTLEMENT_ADDRESS ||
  '0x1Af0E217d434323f428609a42Df36B3D93c2452a') as Hex;
const TOKEN_ADDRESS = (process.env.AGENTD_X402_EVM_TEST_TOKEN ||
  '0xa8ad936e0489d847a8e4cffd555cacffdc24b092') as Hex;

if (!PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY env variable is required');
}

const account = privateKeyToAccount(PRIVATE_KEY);
const payer = account.address;
const recipient = account.address; // same wallet for smoke test simplicity

// ---------------------------------------------------------------------------
// ABIs
// ---------------------------------------------------------------------------
const ERC20_PERMIT_ABI = [
  { type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'nonces', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'name', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
] as const;

const SETTLEMENT_ABI = [
  { type: 'function', name: 'authorizations', inputs: [{ name: 'channelId', type: 'bytes32' }], outputs: [{ name: 'payer', type: 'address' }, { name: 'recipient', type: 'address' }, { name: 'token', type: 'address' }, { name: 'maxAmount', type: 'uint256' }, { name: 'lockedAmount', type: 'uint256' }, { name: 'deadline', type: 'uint256' }, { name: 'nonce', type: 'bytes32' }, { name: 'exists', type: 'bool' }, { name: 'settled', type: 'bool' }, { name: 'rolledBack', type: 'bool' }], stateMutability: 'view' },
] as const;

const SETTLED_EVENT_SIGNATURE =
  '0x2a20f8d2d0f487a3016d77037b3c5768216a3dc76401d33abf5dc381af7171cb' as Hex;

const publicClient = createPublicClient({
  chain: xLayerTestnet,
  transport: http(RPC_URL),
});

const evmClient = new X402EvmClient({
  rpcUrl: RPC_URL,
  chain: xLayerTestnet,
  settlementAddress: SETTLEMENT_ADDRESS,
  walletPrivateKey: PRIVATE_KEY,
});

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('=== X402 EVM Smoke Test on X Layer Testnet ===');
  console.log('Wallet:', payer);
  console.log('Settlement:', SETTLEMENT_ADDRESS);
  console.log('Token:', TOKEN_ADDRESS);

  const balanceBefore = await publicClient.readContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_PERMIT_ABI,
    functionName: 'balanceOf',
    args: [payer],
  });
  console.log('Payer token balance before:', formatEther(balanceBefore), 'TPERM');

  const channelId = `0x${[...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}` as Hex;
  const maxAmount = parseEther('100');
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const nonce = await publicClient.readContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_PERMIT_ABI,
    functionName: 'nonces',
    args: [payer],
  });
  const tokenName = await publicClient.readContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_PERMIT_ABI,
    functionName: 'name',
  });

  console.log('ChannelId:', channelId);
  console.log('Building ERC-2612 permit signature...');
  const sig = await buildPermitSignature(
    {
      name: tokenName,
      version: '1',
      chainId: xLayerTestnet.id,
      verifyingContract: TOKEN_ADDRESS,
    },
    payer,
    SETTLEMENT_ADDRESS,
    maxAmount,
    nonce,
    deadline,
    account
  );

  console.log('Locking funds via lockWithPermit...');
  const lockTx = await evmClient.lockWithPermit({
    channelId,
    payer,
    recipient,
    token: TOKEN_ADDRESS,
    maxAmount,
    deadline,
    nonce: `0x${nonce.toString(16).padStart(64, '0')}` as Hex,
    v: sig.v,
    r: sig.r,
    s: sig.s,
  });
  console.log('Lock tx hash:', lockTx);

  await sleep(3000);

  const settlementBalanceAfterLock = await publicClient.readContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_PERMIT_ABI,
    functionName: 'balanceOf',
    args: [SETTLEMENT_ADDRESS],
  });
  console.log('Settlement token balance after lock:', formatEther(settlementBalanceAfterLock), 'TPERM');

  const authAfterLock = await publicClient.readContract({
    address: SETTLEMENT_ADDRESS,
    abi: SETTLEMENT_ABI,
    functionName: 'authorizations',
    args: [channelId],
  });
  console.log('Authorization exists after lock:', authAfterLock[7]);

  const actualAmount = parseEther('80');
  console.log('Settling', formatEther(actualAmount), 'TPERM...');
  const settleTx = await evmClient.settle(channelId, actualAmount);
  console.log('Settle tx hash:', settleTx);

  await sleep(3000);

  const settleReceipt = await publicClient.getTransactionReceipt({ hash: settleTx });
  console.log('Settle receipt logs count:', settleReceipt.logs.length);
  for (const log of settleReceipt.logs) {
    console.log('Log address:', log.address, 'topic0:', log.topics[0]);
  }
  const settledLogs = settleReceipt.logs.filter(
    (log) => log.topics[0] === SETTLED_EVENT_SIGNATURE
  );
  if (settledLogs.length === 0) {
    throw new Error('Settled event not found in transaction logs');
  }
  const settledLog = settledLogs[0];
  const decodedEvent = {
    channelId: settledLog.topics[1],
    actualAmount: BigInt('0x' + settledLog.data.slice(2, 66)),
    refunded: BigInt('0x' + settledLog.data.slice(66, 130)),
  };
  console.log('Settled event:', {
    actualAmount: formatEther(decodedEvent.actualAmount),
    refunded: formatEther(decodedEvent.refunded),
  });

  const authAfterSettle = await publicClient.readContract({
    address: SETTLEMENT_ADDRESS,
    abi: SETTLEMENT_ABI,
    functionName: 'authorizations',
    args: [channelId],
  });
  console.log('Authorization settled:', authAfterSettle[8]);

  const settlementBalanceFinal = await publicClient.readContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_PERMIT_ABI,
    functionName: 'balanceOf',
    args: [SETTLEMENT_ADDRESS],
  });
  console.log('Settlement token balance final:', formatEther(settlementBalanceFinal), 'TPERM');

  if (!authAfterSettle[8]) {
    throw new Error('Authorization not marked as settled');
  }
  if (decodedEvent.actualAmount !== actualAmount) {
    throw new Error(`Settled amount mismatch: expected ${actualAmount}, got ${decodedEvent.actualAmount}`);
  }
  if (decodedEvent.refunded !== maxAmount - actualAmount) {
    throw new Error(`Refund mismatch: expected ${maxAmount - actualAmount}, got ${decodedEvent.refunded}`);
  }
  if (settlementBalanceFinal !== 0n) {
    throw new Error(`Settlement not empty: expected 0, got ${settlementBalanceFinal}`);
  }

  console.log('✅ Smoke test passed!');
}

main().catch((err) => {
  console.error('❌ Smoke test failed:', err);
  process.exit(1);
});
