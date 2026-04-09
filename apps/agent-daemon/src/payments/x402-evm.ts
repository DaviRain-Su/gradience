/**
 * X402 EVM Client
 *
 * Bridges X402 micropayments to the EVM X402Settlement contract.
 * Uses viem for EVM interactions.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
  type Account,
  type Hex,
  type TransactionReceipt,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';

export interface EvmX402Config {
  rpcUrl: string;
  chain: Chain;
  settlementAddress: Hex;
  walletPrivateKey: Hex;
}

export interface LockPermitParams {
  channelId: Hex;
  payer: Hex;
  recipient: Hex;
  token: Hex;
  maxAmount: bigint;
  deadline: bigint;
  nonce: Hex;
  v: number;
  r: Hex;
  s: Hex;
}

export interface LockApprovalParams {
  channelId: Hex;
  payer: Hex;
  recipient: Hex;
  token: Hex;
  maxAmount: bigint;
  nonce: Hex;
}

const X402_SETTLEMENT_ABI = [
  {
    type: 'function',
    name: 'lockWithPermit',
    inputs: [
      { name: 'channelId', type: 'bytes32' },
      { name: 'payer', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'maxAmount', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'lockWithApproval',
    inputs: [
      { name: 'channelId', type: 'bytes32' },
      { name: 'payer', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'maxAmount', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'settle',
    inputs: [
      { name: 'channelId', type: 'bytes32' },
      { name: 'actualAmount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'rollback',
    inputs: [{ name: 'channelId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'Locked',
    inputs: [
      { indexed: true, name: 'channelId', type: 'bytes32' },
      { indexed: true, name: 'payer', type: 'address' },
      { indexed: true, name: 'recipient', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'maxAmount', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'Settled',
    inputs: [
      { indexed: true, name: 'channelId', type: 'bytes32' },
      { name: 'actualAmount', type: 'uint256' },
      { name: 'refunded', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'RolledBack',
    inputs: [{ indexed: true, name: 'channelId', type: 'bytes32' }],
  },
] as const;

export class X402EvmClient {
  private publicClient: ReturnType<typeof createPublicClient>;
  private walletClient: ReturnType<typeof createWalletClient>;
  private account: Account;
  private config: EvmX402Config;

  constructor(config: EvmX402Config) {
    this.config = config;
    this.account = privateKeyToAccount(config.walletPrivateKey);
    this.publicClient = createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
    });
    this.walletClient = createWalletClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
      account: this.account,
    });
  }

  async lockWithPermit(params: LockPermitParams): Promise<Hex> {
    try {
      const hash = await this.walletClient.writeContract({
        chain: this.config.chain,
        account: this.account,
        address: this.config.settlementAddress,
        abi: X402_SETTLEMENT_ABI,
        functionName: 'lockWithPermit',
        args: [
          params.channelId,
          params.payer,
          params.recipient,
          params.token,
          params.maxAmount,
          params.deadline,
          params.nonce,
          params.v,
          params.r,
          params.s,
        ],
      } as any);
      await this.publicClient.waitForTransactionReceipt({ hash });
      logger.info({ hash, channelId: params.channelId }, 'X402 EVM lockWithPermit success');
      return hash;
    } catch (error) {
      logger.error({ error, channelId: params.channelId }, 'X402 EVM lockWithPermit failed');
      throw new DaemonError(
        ErrorCodes.TRANSACTION_FAILED,
        error instanceof Error ? error.message : 'lockWithPermit failed'
      );
    }
  }

  async lockWithApproval(params: LockApprovalParams): Promise<Hex> {
    try {
      const hash = await this.walletClient.writeContract({
        chain: this.config.chain,
        account: this.account,
        address: this.config.settlementAddress,
        abi: X402_SETTLEMENT_ABI,
        functionName: 'lockWithApproval',
        args: [
          params.channelId,
          params.payer,
          params.recipient,
          params.token,
          params.maxAmount,
          params.nonce,
        ],
      } as any);
      await this.publicClient.waitForTransactionReceipt({ hash });
      logger.info({ hash, channelId: params.channelId }, 'X402 EVM lockWithApproval success');
      return hash;
    } catch (error) {
      logger.error({ error, channelId: params.channelId }, 'X402 EVM lockWithApproval failed');
      throw new DaemonError(
        ErrorCodes.TRANSACTION_FAILED,
        error instanceof Error ? error.message : 'lockWithApproval failed'
      );
    }
  }

  async settle(channelId: Hex, actualAmount: bigint): Promise<Hex> {
    try {
      const hash = await this.walletClient.writeContract({
        chain: this.config.chain,
        account: this.account,
        address: this.config.settlementAddress,
        abi: X402_SETTLEMENT_ABI,
        functionName: 'settle',
        args: [channelId, actualAmount],
      } as any);
      await this.publicClient.waitForTransactionReceipt({ hash });
      logger.info({ hash, channelId, actualAmount: actualAmount.toString() }, 'X402 EVM settle success');
      return hash;
    } catch (error) {
      logger.error({ error, channelId, actualAmount: actualAmount.toString() }, 'X402 EVM settle failed');
      throw new DaemonError(
        ErrorCodes.TRANSACTION_FAILED,
        error instanceof Error ? error.message : 'settle failed'
      );
    }
  }

  async rollback(channelId: Hex): Promise<Hex> {
    try {
      const hash = await this.walletClient.writeContract({
        chain: this.config.chain,
        account: this.account,
        address: this.config.settlementAddress,
        abi: X402_SETTLEMENT_ABI,
        functionName: 'rollback',
        args: [channelId],
      } as any);
      await this.publicClient.waitForTransactionReceipt({ hash });
      logger.info({ hash, channelId }, 'X402 EVM rollback success');
      return hash;
    } catch (error) {
      logger.error({ error, channelId }, 'X402 EVM rollback failed');
      throw new DaemonError(
        ErrorCodes.TRANSACTION_FAILED,
        error instanceof Error ? error.message : 'rollback failed'
      );
    }
  }
}

export function createX402EvmClient(config: EvmX402Config): X402EvmClient {
  return new X402EvmClient(config);
}
