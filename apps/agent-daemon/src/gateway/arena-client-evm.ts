/**
 * EVM Arena Task Client for DefaultWorkflowExecutionGateway.
 *
 * Wraps EvmTransactionManager to satisfy the ArenaTaskClient interface.
 */

import type { EvmTransactionManager } from '../evm/transaction-manager.js';
import type { ArenaTaskClient } from './gateway.js';
import { logger } from '../utils/logger.js';

export function createEvmArenaTaskClient(txManager: EvmTransactionManager): ArenaTaskClient {
  return {
    async post(params): Promise<string> {
      // EVM postTask ignores the passed-in taskId because the contract auto-increments.
      const txHash = await txManager.postTask({
        evalRef: params.evalRef,
        deadline: Number(params.deadline),
        judgeDeadline: Number(params.judgeDeadline),
        judgeMode: params.judgeMode,
        judge: params.judge,
        category: params.category,
        minStake: Number(params.minStake),
        reward: Number(params.reward),
      });
      return txHash;
    },

    async apply(taskId: bigint): Promise<string> {
      return txManager.applyForTask(taskId.toString());
    },

    async submit(taskId: bigint, params: { resultRef: string; traceRef: string; runtimeEnv: Record<string, unknown> }): Promise<string> {
      return txManager.submitResult(
        taskId.toString(),
        params.resultRef,
        params.traceRef,
        {
          provider: (params.runtimeEnv.provider as string) || 'agent-daemon',
          model: (params.runtimeEnv.model as string) || 'default',
          runtime: (params.runtimeEnv.runtime as string) || 'node',
          version: (params.runtimeEnv.version as string) || '1.0.0',
        }
      );
    },

    async getNextTaskId(): Promise<bigint> {
      if (!txManager.getNextTaskId) {
        throw new Error('EvmTransactionManager does not expose getNextTaskId');
      }
      return txManager.getNextTaskId();
    },
  };
}

// Helper to predict next task ID from a public viem client.
// Used by the EVM event listener to correlate purchases.
export async function predictNextEvmTaskId(
  publicClient: { readContract: (args: any) => Promise<any> },
  agentArenaAddress: `0x${string}`
): Promise<bigint> {
  const abi = [
    {
      type: 'function',
      name: 'taskCount',
      inputs: [],
      outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
      stateMutability: 'view',
    },
  ] as const;

  const count = await publicClient.readContract({
    address: agentArenaAddress,
    abi,
    functionName: 'taskCount',
    args: [],
  });

  return (count as bigint) + 1n;
}
