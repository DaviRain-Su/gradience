import { getChainConfig, getDefaultEvmChainId } from './config';

export function getExplorerUrl(txHash: string, chainId?: number): string {
  const cfg = getChainConfig(chainId ?? getDefaultEvmChainId());
  const base = cfg.blockExplorer.replace(/\/$/, '');
  return `${base}/tx/${txHash}`;
}
