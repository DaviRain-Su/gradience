/**
 * EVM Subgraph configuration for AgentM Web.
 *
 * Supports per-chain endpoints so each EVM L2 can have its own subgraph.
 */

import { getDefaultEvmChainId } from './config';

const SUBGRAPH_ENDPOINTS: Record<number, string> = {
  // Base Sepolia
  84532: process.env.NEXT_PUBLIC_EVM_SUBGRAPH_ENDPOINT_BASE_SEPOLIA ||
         process.env.NEXT_PUBLIC_EVM_SUBGRAPH_ENDPOINT || '',
  // Arbitrum Sepolia
  421614: process.env.NEXT_PUBLIC_EVM_SUBGRAPH_ENDPOINT_ARB_SEPOLIA || '',
};

export function getSubgraphEndpoint(chainId?: number): string {
  const id = chainId ?? getDefaultEvmChainId();
  return SUBGRAPH_ENDPOINTS[id] || process.env.NEXT_PUBLIC_EVM_SUBGRAPH_ENDPOINT || '';
}
