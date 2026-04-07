'use client';

import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useMemo } from 'react';

export type WalletChain = 'solana' | 'evm' | null;

export interface WalletChainInfo {
  chain: WalletChain;
  address: string | null;
  /** Returns the Dynamic primary wallet object if available */
  primaryWallet: ReturnType<typeof useDynamicContext>['primaryWallet'];
}

export function useWalletChain(): WalletChainInfo {
  const { primaryWallet } = useDynamicContext();

  return useMemo((): WalletChainInfo => {
    if (!primaryWallet) {
      return { chain: null, address: null, primaryWallet: null };
    }

    const connectedChain = primaryWallet.connector?.connectedChain;
    let chain: WalletChain = null;
    if (connectedChain === 'SOL') {
      chain = 'solana';
    } else if (connectedChain === 'ETH' || connectedChain === 'EVM') {
      chain = 'evm';
    }

    return {
      chain,
      address: primaryWallet.address || null,
      primaryWallet,
    };
  }, [primaryWallet]);
}
