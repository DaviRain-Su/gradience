/**
 * EVM Agent Registry Client for AgentMRegistry.sol
 *
 * Provides register user + create agent flows via viem.
 */

import { createPublicClient, createWalletClient, custom, http, decodeEventLog } from 'viem';
import { AGENT_M_REGISTRY_ABI } from './abi';
import { getChainConfig, getDefaultEvmChainId } from './config';

function getPublicClient(chainId?: number) {
  const id = chainId ?? getDefaultEvmChainId();
  const cfg = getChainConfig(id);
  return createPublicClient({
    chain: cfg.chain,
    transport: http(cfg.rpcEndpoint),
  });
}

function getWalletClient(ethereumProvider: unknown, chainId?: number) {
  const id = chainId ?? getDefaultEvmChainId();
  const cfg = getChainConfig(id);
  return createWalletClient({
    chain: cfg.chain,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transport: custom(ethereumProvider as any),
  });
}

export interface RegisterUserEVMParams {
  ethereumProvider: unknown;
  account: `0x${string}`;
  username: string;
  metadataURI: string;
  ensName?: string;
  chainId?: number;
}

export async function registerUserEVM(params: RegisterUserEVMParams): Promise<`0x${string}`> {
  const cfg = getChainConfig(params.chainId ?? getDefaultEvmChainId());
  const publicClient = getPublicClient(params.chainId);
  const walletClient = getWalletClient(params.ethereumProvider, params.chainId);

  const { request } = await publicClient.simulateContract({
    address: cfg.agentMRegistryAddress,
    abi: AGENT_M_REGISTRY_ABI,
    functionName: 'registerUser',
    args: [params.username, params.metadataURI, params.ensName ?? ''],
    account: params.account,
  });

  return walletClient.writeContract(request);
}

export interface CreateAgentEVMParams {
  ethereumProvider: unknown;
  account: `0x${string}`;
  metadataURI: string;
  chainId?: number;
}

export async function createAgentEVM(params: CreateAgentEVMParams): Promise<{ agentId: bigint; txHash: `0x${string}` }> {
  const cfg = getChainConfig(params.chainId ?? getDefaultEvmChainId());
  const publicClient = getPublicClient(params.chainId);
  const walletClient = getWalletClient(params.ethereumProvider, params.chainId);

  const { request } = await publicClient.simulateContract({
    address: cfg.agentMRegistryAddress,
    abi: AGENT_M_REGISTRY_ABI,
    functionName: 'createAgent',
    args: [params.metadataURI],
    account: params.account,
  });

  const txHash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  let agentId = 0n;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== cfg.agentMRegistryAddress.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: AGENT_M_REGISTRY_ABI,
        eventName: 'AgentCreated',
        data: log.data,
        topics: log.topics,
      });
      if (decoded && typeof decoded === 'object' && 'args' in decoded && decoded.args && 'agentId' in decoded.args) {
        agentId = decoded.args.agentId as bigint;
        break;
      }
    } catch {
      // ignore
    }
  }

  return { agentId, txHash };
}

export interface UpdateProfileEVMParams {
  ethereumProvider: unknown;
  account: `0x${string}`;
  metadataURI: string;
  ensName?: string;
  chainId?: number;
}

export async function updateProfileEVM(params: UpdateProfileEVMParams): Promise<`0x${string}`> {
  const cfg = getChainConfig(params.chainId ?? getDefaultEvmChainId());
  const publicClient = getPublicClient(params.chainId);
  const walletClient = getWalletClient(params.ethereumProvider, params.chainId);

  const { request } = await publicClient.simulateContract({
    address: cfg.agentMRegistryAddress,
    abi: AGENT_M_REGISTRY_ABI,
    functionName: 'updateProfile',
    args: [params.metadataURI, params.ensName ?? ''],
    account: params.account,
  });

  return walletClient.writeContract(request);
}

export interface UpdateAgentEVMParams {
  ethereumProvider: unknown;
  account: `0x${string}`;
  agentId: bigint;
  metadataURI: string;
  isActive: boolean;
  chainId?: number;
}

export async function updateAgentEVM(params: UpdateAgentEVMParams): Promise<`0x${string}`> {
  const cfg = getChainConfig(params.chainId ?? getDefaultEvmChainId());
  const publicClient = getPublicClient(params.chainId);
  const walletClient = getWalletClient(params.ethereumProvider, params.chainId);

  const { request } = await publicClient.simulateContract({
    address: cfg.agentMRegistryAddress,
    abi: AGENT_M_REGISTRY_ABI,
    functionName: 'updateAgent',
    args: [params.agentId, params.metadataURI, params.isActive],
    account: params.account,
  });

  return walletClient.writeContract(request);
}

export async function isUserRegisteredEVM(
  account: `0x${string}`,
  chainId?: number,
): Promise<boolean> {
  const cfg = getChainConfig(chainId ?? getDefaultEvmChainId());
  const publicClient = getPublicClient(chainId);
  const result = await publicClient.readContract({
    address: cfg.agentMRegistryAddress,
    abi: AGENT_M_REGISTRY_ABI,
    functionName: 'users',
    args: [account],
  });
  return result[0];
}

export async function resolveUsernameEVM(
  username: string,
  chainId?: number,
): Promise<`0x${string}` | null> {
  const cfg = getChainConfig(chainId ?? getDefaultEvmChainId());
  const publicClient = getPublicClient(chainId);
  try {
    const addr = await publicClient.readContract({
      address: cfg.agentMRegistryAddress,
      abi: AGENT_M_REGISTRY_ABI,
      functionName: 'usernameToAddress',
      args: [username],
    });
    return addr === '0x0000000000000000000000000000000000000000' ? null : addr;
  } catch {
    return null;
  }
}
