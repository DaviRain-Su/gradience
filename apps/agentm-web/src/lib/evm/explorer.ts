import { EVM_BLOCK_EXPLORER } from './config';

export function getExplorerUrl(txHash: string): string {
  const base = EVM_BLOCK_EXPLORER.replace(/\/$/, '');
  return `${base}/tx/${txHash}`;
}
