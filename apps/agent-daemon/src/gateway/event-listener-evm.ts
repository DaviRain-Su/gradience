/**
 * EVM Marketplace Event Listener
 *
 * Polls AgentArenaEVM TaskCreated events and emits PurchaseEvent objects.
 * In the EVM architecture, posting a task is synonymous with a purchase,
 * so we treat each TaskCreated event as a purchase event.
 */

import { createPublicClient, http, hexToString, defineChain } from 'viem';
import type { PurchaseEvent } from './types.js';
import type { MarketplaceEventListener } from './event-listener.js';
import { logger } from '../utils/logger.js';

const AGENT_ARENA_EVM_ABI = [
  {
    type: 'event',
    name: 'TaskCreated',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'poster', type: 'address', indexed: true, internalType: 'address' },
      { name: 'judge', type: 'address', indexed: true, internalType: 'address' },
      { name: 'category', type: 'uint8', indexed: false, internalType: 'uint8' },
      { name: 'minStake', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'reward', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'deadline', type: 'uint64', indexed: false, internalType: 'uint64' },
      { name: 'judgeDeadline', type: 'uint64', indexed: false, internalType: 'uint64' },
      { name: 'evalRef', type: 'string', indexed: false, internalType: 'string' },
    ],
    anonymous: false,
  },
] as const;

export interface EvmEventListenerConfig {
  rpcEndpoint: string;
  chainId: number;
  agentArenaAddress: `0x${string}`;
  pollIntervalMs: number;
}

export class PollingEvmMarketplaceEventListener implements MarketplaceEventListener {
  private publicClient: ReturnType<typeof createPublicClient>;
  private config: EvmEventListenerConfig;
  private pollingInterval?: ReturnType<typeof setInterval>;
  private running = false;
  private lastPolledBlock = 0n;
  private processedTxHashes = new Set<string>();

  constructor(config: EvmEventListenerConfig) {
    this.config = config;
    const customChain = defineChain({
      id: config.chainId,
      name: `EVM-${config.chainId}`,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [config.rpcEndpoint] } },
    });
    this.publicClient = createPublicClient({
      chain: customChain,
      transport: http(config.rpcEndpoint),
    });
  }

  start(onEvent: (event: PurchaseEvent) => void | Promise<void>): void {
    if (this.running) return;
    this.running = true;

    this.publicClient.getBlockNumber().then((blockNumber) => {
      this.lastPolledBlock = blockNumber;
      logger.info({ blockNumber: blockNumber.toString() }, 'EVM event listener starting');
    }).catch((err) => {
      logger.error({ err }, 'Failed to get initial EVM block number');
    });

    this.poll(onEvent).catch((err) => console.error('Initial EVM poll failed:', err));

    this.pollingInterval = setInterval(() => {
      this.poll(onEvent).catch((err) => console.error('EVM poll failed:', err));
    }, this.config.pollIntervalMs);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  private async poll(onEvent: (event: PurchaseEvent) => void | Promise<void>): Promise<void> {
    try {
      const currentBlock = await this.publicClient.getBlockNumber();
      if (currentBlock <= this.lastPolledBlock) return;

      const logs = await this.publicClient.getLogs({
        address: this.config.agentArenaAddress,
        event: AGENT_ARENA_EVM_ABI[0],
        fromBlock: this.lastPolledBlock + 1n,
        toBlock: currentBlock,
      });

      for (const log of logs) {
        if (!this.running) break;
        if (this.processedTxHashes.has(log.transactionHash)) continue;

        const event = this.parsePurchaseEvent(log);
        if (event) {
          await onEvent(event);
        }
        this.processedTxHashes.add(log.transactionHash);
        if (this.processedTxHashes.size > 1000) {
          const first = this.processedTxHashes.values().next().value;
          if (first) this.processedTxHashes.delete(first);
        }
      }

      this.lastPolledBlock = currentBlock;
    } catch (err) {
      logger.error({ err }, 'EVM event listener poll failed');
    }
  }

  private parsePurchaseEvent(log: any): PurchaseEvent | null {
    try {
      const args = (log as any).args || {};
      const taskId = args.taskId?.toString?.() ?? '';
      const poster = args.poster?.toLowerCase?.() ?? '';
      const reward = args.reward ? BigInt(args.reward) : 0n;
      const evalRef = args.evalRef ?? '';

      if (!taskId || !poster) return null;

      // Derive stable purchaseId from task + poster + tx prefix
      const purchaseId = `evm_${taskId}_${poster}_${log.transactionHash.slice(0, 8)}`;

      return {
        purchaseId,
        buyer: poster,
        workflowId: evalRef,
        amount: reward,
        txSignature: log.transactionHash,
        blockTime: Number(log.blockNumber ?? 0),
      };
    } catch (err) {
      logger.error({ err, log }, 'Failed to parse EVM TaskCreated log');
      return null;
    }
  }
}
