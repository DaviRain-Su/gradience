/**
 * X402 EVM Self-Test / Smoke Test
 *
 * Runs a real on-chain transaction sequence on a testnet to verify the full
 * X402 EVM micropayment flow works end-to-end.
 */

import { xLayerTestnet } from 'viem/chains';
import { createPublicClient, createWalletClient, http, formatEther, parseEther, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { X402EvmClient } from './x402-evm.js';
import { buildPermitSignature } from './x402-evm-signer.js';
import type { DaemonConfig } from '../config.js';

const SETTLED_EVENT_SIGNATURE = '0x2a20f8d2d0f487a3016d77037b3c5768216a3dc76401d33abf5dc381af7171cb' as Hex;

const ERC20_PERMIT_ABI = [
    {
        type: 'function',
        name: 'balanceOf',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'nonces',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'name',
        inputs: [],
        outputs: [{ type: 'string' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'approve',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ type: 'bool' }],
        stateMutability: 'nonpayable',
    },
] as const;

const SETTLEMENT_ABI = [
    {
        type: 'function',
        name: 'authorizations',
        inputs: [{ name: 'channelId', type: 'bytes32' }],
        outputs: [
            { name: 'payer', type: 'address' },
            { name: 'recipient', type: 'address' },
            { name: 'token', type: 'address' },
            { name: 'maxAmount', type: 'uint256' },
            { name: 'lockedAmount', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' },
            { name: 'exists', type: 'bool' },
            { name: 'settled', type: 'bool' },
            { name: 'rolledBack', type: 'bool' },
        ],
        stateMutability: 'view',
    },
] as const;

export interface X402EvmSelfTestResult {
    success: boolean;
    lockTxHash?: Hex;
    settleTxHash?: Hex;
    error?: string;
}

export async function runX402EvmSelfTest(
    config: DaemonConfig,
    testTokenAddress?: string,
): Promise<X402EvmSelfTestResult> {
    const privateKey = config.x402EvmPrivateKey || (process.env.PRIVATE_KEY as Hex | undefined);
    const settlementAddress = config.x402EvmSettlementAddress;

    if (!privateKey) {
        return {
            success: false,
            error: 'x402EvmPrivateKey not configured (set AGENTD_X402_EVM_PRIVATE_KEY or PRIVATE_KEY)',
        };
    }
    if (!settlementAddress) {
        return { success: false, error: 'x402EvmSettlementAddress not configured' };
    }

    const rpcUrl = config.evmRpcUrl || 'https://testrpc.xlayer.tech';
    const tokenAddress = (testTokenAddress || process.env.AGENTD_X402_EVM_TEST_TOKEN) as Hex;
    const settlementAddr = settlementAddress as Hex;
    if (!tokenAddress) {
        return {
            success: false,
            error: 'Test token address not provided. Pass --test-token or set AGENTD_X402_EVM_TEST_TOKEN',
        };
    }

    const account = privateKeyToAccount(privateKey as Hex);
    const payer = account.address;
    const recipient = account.address; // same wallet for self-test simplicity

    const publicClient = createPublicClient({
        chain: xLayerTestnet,
        transport: http(rpcUrl),
    });

    const walletClient = createWalletClient({
        chain: xLayerTestnet,
        transport: http(rpcUrl),
        account,
    });

    const evmClient = new X402EvmClient({
        rpcUrl,
        chain: xLayerTestnet,
        settlementAddress: settlementAddress as Hex,
        walletPrivateKey: privateKey as Hex,
    });

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    try {
        console.log('=== X402 EVM Self-Test on X Layer Testnet ===');
        console.log('Wallet:', payer);
        console.log('Settlement:', settlementAddress);
        console.log('Token:', tokenAddress);

        const balanceBefore = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_PERMIT_ABI,
            functionName: 'balanceOf',
            args: [payer],
        });
        console.log('Payer token balance before:', formatEther(balanceBefore), 'TPERM');

        const channelId = `0x${[...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}` as Hex;
        const maxAmount = parseEther('10');
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
        const nonce = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_PERMIT_ABI,
            functionName: 'nonces',
            args: [payer],
        });
        const tokenName = await publicClient.readContract({
            address: tokenAddress,
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
                verifyingContract: tokenAddress,
            },
            payer,
            settlementAddress as Hex,
            maxAmount,
            nonce,
            deadline,
            account,
        );

        console.log('Locking funds via lockWithPermit...');
        let lockTx: Hex;
        try {
            lockTx = await evmClient.lockWithPermit({
                channelId,
                payer,
                recipient,
                token: tokenAddress,
                maxAmount,
                deadline,
                nonce: `0x${nonce.toString(16).padStart(64, '0')}` as Hex,
                v: sig.v,
                r: sig.r,
                s: sig.s,
            });
            console.log('Lock tx hash:', lockTx);
        } catch (lockErr: any) {
            const msg = lockErr instanceof Error ? lockErr.message : String(lockErr);
            if (msg.includes('PermitFailed') || msg.includes('0xb78cb0dd')) {
                console.warn(
                    '⚠️ lockWithPermit failed (permit rejected). Falling back to approve + lockWithApproval...',
                );
                const approveHash = await walletClient.writeContract({
                    chain: xLayerTestnet,
                    account,
                    address: tokenAddress,
                    abi: ERC20_PERMIT_ABI,
                    functionName: 'approve',
                    args: [settlementAddr, maxAmount],
                } as any);
                await publicClient.waitForTransactionReceipt({ hash: approveHash });
                console.log('Approve tx hash:', approveHash);
                lockTx = await evmClient.lockWithApproval({
                    channelId,
                    payer,
                    recipient,
                    token: tokenAddress,
                    maxAmount,
                    nonce: `0x${nonce.toString(16).padStart(64, '0')}` as Hex,
                });
                console.log('Lock (approval fallback) tx hash:', lockTx);
            } else {
                throw lockErr;
            }
        }

        await sleep(3000);

        const settlementBalanceAfterLock = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_PERMIT_ABI,
            functionName: 'balanceOf',
            args: [settlementAddr],
        });
        console.log('Settlement token balance after lock:', formatEther(settlementBalanceAfterLock), 'TPERM');

        const authAfterLock = await publicClient.readContract({
            address: settlementAddr,
            abi: SETTLEMENT_ABI,
            functionName: 'authorizations',
            args: [channelId],
        });
        if (!authAfterLock[7]) {
            throw new Error('Authorization not found after lock');
        }

        const actualAmount = parseEther('8');
        console.log('Settling', formatEther(actualAmount), 'TPERM...');
        const settleTx = await evmClient.settle(channelId, actualAmount);
        console.log('Settle tx hash:', settleTx);

        await sleep(3000);

        const settleReceipt = await publicClient.getTransactionReceipt({ hash: settleTx });
        const settledLogs = settleReceipt.logs.filter((log) => log.topics[0] === SETTLED_EVENT_SIGNATURE);
        if (settledLogs.length === 0) {
            throw new Error('Settled event not found in transaction logs');
        }
        const settledLog = settledLogs[0];
        const decodedEvent = {
            channelId: settledLog.topics[1] as Hex,
            actualAmount: BigInt(('0x' + settledLog.data.slice(2, 66)) as Hex),
            refunded: BigInt(('0x' + settledLog.data.slice(66, 130)) as Hex),
        };
        console.log('Settled event:', {
            actualAmount: formatEther(decodedEvent.actualAmount),
            refunded: formatEther(decodedEvent.refunded),
        });

        const authAfterSettle = await publicClient.readContract({
            address: settlementAddr,
            abi: SETTLEMENT_ABI,
            functionName: 'authorizations',
            args: [channelId],
        });
        if (!authAfterSettle[8]) {
            throw new Error('Authorization not marked as settled');
        }
        if (decodedEvent.actualAmount !== actualAmount) {
            throw new Error(`Settled amount mismatch: expected ${actualAmount}, got ${decodedEvent.actualAmount}`);
        }
        if (decodedEvent.refunded !== maxAmount - actualAmount) {
            throw new Error(`Refund mismatch: expected ${maxAmount - actualAmount}, got ${decodedEvent.refunded}`);
        }

        const settlementBalanceFinal = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_PERMIT_ABI,
            functionName: 'balanceOf',
            args: [settlementAddr],
        });
        console.log('Settlement token balance final:', formatEther(settlementBalanceFinal), 'TPERM');
        if (settlementBalanceFinal !== 0n) {
            throw new Error(`Settlement not empty: expected 0, got ${settlementBalanceFinal}`);
        }

        console.log('✅ X402 EVM self-test passed!');
        return { success: true, lockTxHash: lockTx, settleTxHash: settleTx };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('❌ X402 EVM self-test failed:', message);
        return { success: false, error: message };
    }
}
