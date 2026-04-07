/**
 * EVM chain configuration for AgentM Web.
 *
 * Designed as a multi-chain lookup table so new EVM L2s can be added
 * without touching business logic.
 */

import { baseSepolia, arbitrumSepolia, type Chain } from 'viem/chains';

export interface EvmChainConfig {
  chain: Chain;
  rpcEndpoint: string;
  agentArenaAddress: `0x${string}`;
  blockExplorer: string;
}

const defaultChains: Record<number, EvmChainConfig> = {
  [baseSepolia.id]: {
    chain: baseSepolia,
    rpcEndpoint: 'https://sepolia.base.org',
    agentArenaAddress: '0x0000000000000000000000000000000000000000',
    blockExplorer: 'https://sepolia.basescan.org',
  },
  [arbitrumSepolia.id]: {
    chain: arbitrumSepolia,
    rpcEndpoint: 'https://sepolia-rollup.arbitrum.io/rpc',
    agentArenaAddress: '0x0000000000000000000000000000000000000000',
    blockExplorer: 'https://sepolia.arbiscan.io',
  },
};

function getChainConfig(chainId: number): EvmChainConfig {
  const envRpc = process.env.NEXT_PUBLIC_EVM_RPC_ENDPOINT;
  const envAddress = process.env.NEXT_PUBLIC_AGENT_ARENA_EVM_ADDRESS as `0x${string}` | undefined;
  const envExplorer = process.env.NEXT_PUBLIC_EVM_BLOCK_EXPLORER;

  const base = defaultChains[chainId] ?? {
    chain: { ...baseSepolia, id: chainId, name: `EVM Chain ${chainId}` } as Chain,
    rpcEndpoint: envRpc || 'https://sepolia.base.org',
    agentArenaAddress: envAddress || '0x0000000000000000000000000000000000000000',
    blockExplorer: envExplorer || 'https://sepolia.basescan.org',
  };

  return {
    chain: base.chain,
    rpcEndpoint: envRpc || base.rpcEndpoint,
    agentArenaAddress: envAddress || base.agentArenaAddress,
    blockExplorer: envExplorer || base.blockExplorer,
  };
}

/**
 * Backward-compatible helpers for the first supported EVM chain.
 * Prefer `getChainConfig(currentChainId)` in multi-chain code.
 */
export function getDefaultEvmChainId(): number {
  return Number(process.env.NEXT_PUBLIC_EVM_CHAIN_ID || baseSepolia.id);
}

/** @deprecated Use getChainConfig(chainId).rpcEndpoint */
export const EVM_RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_EVM_RPC_ENDPOINT || getChainConfig(getDefaultEvmChainId()).rpcEndpoint;

/** @deprecated Use getChainConfig(chainId).agentArenaAddress */
export const AGENT_ARENA_EVM_ADDRESS =
  (process.env.NEXT_PUBLIC_AGENT_ARENA_EVM_ADDRESS as `0x${string}`) || getChainConfig(getDefaultEvmChainId()).agentArenaAddress;

/** @deprecated Use getChainConfig(chainId).blockExplorer */
export const EVM_BLOCK_EXPLORER =
  process.env.NEXT_PUBLIC_EVM_BLOCK_EXPLORER || getChainConfig(getDefaultEvmChainId()).blockExplorer;

export { getChainConfig, baseSepolia, arbitrumSepolia };
