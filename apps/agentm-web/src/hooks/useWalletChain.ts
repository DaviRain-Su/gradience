'use client';

import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useMemo } from 'react';

export type WalletChainFamily = 'solana' | 'evm' | null;

export interface WalletChainInfo {
  /** High-level chain family */
  chain: WalletChainFamily;
  /** Active EVM chainId when chain === 'evm'; undefined otherwise */
  chainId: number | undefined;
  address: string | null;
  /** Returns the Dynamic primary wallet object if available */
  primaryWallet: ReturnType<typeof useDynamicContext>['primaryWallet'];
}

export function useWalletChain(): WalletChainInfo {
  const { primaryWallet } = useDynamicContext();

  return useMemo((): WalletChainInfo => {
    if (!primaryWallet) {
      return { chain: null, chainId: undefined, address: null, primaryWallet: null };
    }

    const connectedChain = primaryWallet.connector?.connectedChain;
    let chain: WalletChainFamily = null;
    let chainId: number | undefined;

    if (connectedChain === 'SOL') {
      chain = 'solana';
    } else if (connectedChain === 'ETH' || connectedChain === 'EVM') {
      chain = 'evm';
      const network = primaryWallet.connector?.getNetwork;
      // Dynamic may expose network via connector metadata or async getNetwork()
      // Fallback to reading from primaryWallet.network or the connector's enabled networks
      if ((primaryWallet as any).network) {
        const n = Number((primaryWallet as any).network);
        if (!Number.isNaN(n)) chainId = n;
      }
      // If still undefined, rely on callers to default via getDefaultEvmChainId()
    }

    return {
      chain,
      chainId,
      address: primaryWallet.address || null,
      primaryWallet,
    };
  }, [primaryWallet]);
}
