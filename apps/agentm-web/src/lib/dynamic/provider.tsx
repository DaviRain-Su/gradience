/**
 * Dynamic Wallet Integration
 *
 * 使用真实的 @dynamic-labs/sdk-react-core
 *
 * @module dynamic/provider
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import {
  DynamicContextProvider,
  useDynamicContext,
  type UserProfile,
} from '@dynamic-labs/sdk-react-core';
import { SolanaWalletConnectors } from '@dynamic-labs/solana';

// ============================================================================
// Types
// ============================================================================

export interface DynamicWallet {
  address: string;
  publicKey: PublicKey;
  chain: 'solana';
  connector: 'embedded' | 'phantom' | 'solflare' | 'backpack';
}

export interface DynamicContextType {
  // 状态
  isInitialized: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  user: UserProfile | null;
  wallet: DynamicWallet | null;
  primaryWallet: any | null;
  error: string | null;

  // 方法
  login: () => Promise<void>;
  logout: () => Promise<void>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
  signAndSendTransaction: (transaction: Transaction | VersionedTransaction) => Promise<string>;
}

export interface DynamicConfig {
  /** Dynamic Environment ID */
  environmentId: string;
  /** Solana RPC endpoint */
  rpcEndpoint: string;
  /** 应用名称 */
  appName: string;
  /** 应用图标 */
  appIcon?: string;
  /** 支持的链 */
  chains: ('solana' | 'evm')[];
  /** 是否启用嵌入式钱包 */
  enableEmbeddedWallets: boolean;
  /** 社交登录提供商 */
  socialProviders: ('google' | 'twitter' | 'email')[];
}

// ============================================================================
// Context
// ============================================================================

const DynamicContext = createContext<DynamicContextType | null>(null);

export function useDynamic(): DynamicContextType {
  const context = useContext(DynamicContext);
  if (!context) {
    throw new Error('useDynamic must be used within DynamicProvider');
  }
  return context;
}

// ============================================================================
// Internal Provider
// ============================================================================

function DynamicProviderInternal({
  children,
  config,
}: {
  children: React.ReactNode;
  config: DynamicConfig;
}) {
  const {
    user,
    primaryWallet,
    sdkHasLoaded,
    setShowAuthFlow,
    handleLogOut,
  } = useDynamicContext();
  const isAuthenticated = !!user;
  const isLoading = !sdkHasLoaded;

  const [error, setError] = useState<string | null>(null);
  const [connection] = useState(() => new Connection(config.rpcEndpoint));

  // 转换 wallet 格式
  const wallet: DynamicWallet | null = primaryWallet?.address
    ? {
        address: primaryWallet.address,
        publicKey: new PublicKey(primaryWallet.address),
        chain: 'solana',
        connector: primaryWallet.connector?.name?.toLowerCase().includes('embedded')
          ? 'embedded'
          : 'phantom',
      }
    : null;

  // 登录
  const login = useCallback(async () => {
    try {
      setShowAuthFlow(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    }
  }, [setShowAuthFlow]);

  // 登出
  const logout = useCallback(async () => {
    try {
      await handleLogOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logout failed');
      throw err;
    }
  }, [handleLogOut]);

  // 签名消息
  const signMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array> => {
      if (!primaryWallet) {
        throw new Error('No wallet connected');
      }

      try {
        const signer = await (primaryWallet as any).getSigner();
        const signature = await signer.signMessage(message);
        return signature;
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Failed to sign message');
      }
    },
    [primaryWallet]
  );

  // 签名交易
  const signTransaction = useCallback(
    async (
      transaction: Transaction | VersionedTransaction
    ): Promise<Transaction | VersionedTransaction> => {
      if (!primaryWallet) {
        throw new Error('No wallet connected');
      }

      try {
        const signer = await (primaryWallet as any).getSigner();
        const signed = await signer.signTransaction(transaction);
        return signed;
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Failed to sign transaction');
      }
    },
    [primaryWallet]
  );

  // 签名并发送交易
  const signAndSendTransaction = useCallback(
    async (transaction: Transaction | VersionedTransaction): Promise<string> => {
      if (!primaryWallet) {
        throw new Error('No wallet connected');
      }

      try {
        const signer = await (primaryWallet as any).getSigner();
        const signature = await signer.signAndSendTransaction(transaction);
        return signature;
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Failed to send transaction');
      }
    },
    [primaryWallet, connection]
  );

  const value: DynamicContextType = {
    isInitialized: true,
    isLoading: isLoading ?? false,
    isAuthenticated: isAuthenticated ?? false,
    user: user ?? null,
    wallet,
    primaryWallet,
    error,
    login,
    logout,
    signMessage,
    signTransaction,
    signAndSendTransaction,
  };

  return <DynamicContext.Provider value={value}>{children}</DynamicContext.Provider>;
}

// ============================================================================
// External Provider
// ============================================================================

interface DynamicProviderProps {
  children: React.ReactNode;
  config: DynamicConfig;
}

export function DynamicProvider({ children, config }: DynamicProviderProps) {
  const dynamicSettings = {
    environmentId: config.environmentId,
    appName: config.appName,
    appLogoUrl: config.appIcon,
    walletConnectors: [SolanaWalletConnectors],
    enableEmbeddedWallets: config.enableEmbeddedWallets,
  };

  return (
    <DynamicContextProvider settings={dynamicSettings}>
      <DynamicProviderInternal config={config}>{children}</DynamicProviderInternal>
    </DynamicContextProvider>
  );
}
