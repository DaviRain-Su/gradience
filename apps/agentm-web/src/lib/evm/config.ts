/**
 * EVM chain configuration for AgentM Web.
 */

export const EVM_RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_EVM_RPC_ENDPOINT || 'https://sepolia.base.org';

export const EVM_CHAIN_ID = Number(process.env.NEXT_PUBLIC_EVM_CHAIN_ID || '84532');

export const AGENT_ARENA_EVM_ADDRESS =
  (process.env.NEXT_PUBLIC_AGENT_ARENA_EVM_ADDRESS as `0x${string}`) || '0x0000000000000000000000000000000000000000';

export const EVM_BLOCK_EXPLORER =
  process.env.NEXT_PUBLIC_EVM_BLOCK_EXPLORER || 'https://sepolia.basescan.org';
