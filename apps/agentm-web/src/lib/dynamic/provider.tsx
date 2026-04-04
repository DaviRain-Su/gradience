/**
 * Dynamic Wallet Integration
 *
 * 替代 Privy 的嵌入式钱包解决方案
 * 支持 Solana + 社交登录 (Google/Twitter/Email)
 *
 * @module dynamic/provider
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

// ============================================================================
// Types
// ============================================================================

export interface DynamicUser {
  id: string;
  email?: string;
  verifiedCredentials: Array<{
    id: string;
    email?: string;
    walletName?: string;
    publicAddress?: string;
    chain: 'solana' | 'evm';
  }>;
}

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
  user: DynamicUser | null;
  wallet: DynamicWallet | null;
  error: string | null;

  // 方法
  login: (options?: LoginOptions) => Promise<void>;
  logout: () => Promise<void>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
  signAndSendTransaction: (transaction: Transaction | VersionedTransaction) => Promise<string>;
}

export interface LoginOptions {
  provider?: 'google' | 'twitter' | 'email';
  email?: string;
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
// Provider
// ============================================================================

interface DynamicProviderProps {
  children: React.ReactNode;
  config: DynamicConfig;
}

export function DynamicProvider({ children, config }: DynamicProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<DynamicUser | null>(null);
  const [wallet, setWallet] = useState<DynamicWallet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connection] = useState(() => new Connection(config.rpcEndpoint));

  // 初始化 Dynamic SDK
  useEffect(() => {
    const init = async () => {
      try {
        // 加载 Dynamic SDK
        await loadDynamicSDK();
        
        // 初始化配置
        await initializeDynamic(config);
        
        setIsInitialized(true);
        
        // 检查是否有已登录的用户
        const existingUser = await checkExistingSession();
        if (existingUser) {
          setUser(existingUser);
          setIsAuthenticated(true);
          
          // 获取钱包
          const primaryWallet = await getPrimaryWallet(existingUser);
          if (primaryWallet) {
            setWallet(primaryWallet);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize Dynamic');
      }
    };

    init();
  }, [config.environmentId]);

  // 登录
  const login = useCallback(async (options?: LoginOptions) => {
    setIsLoading(true);
    setError(null);

    try {
      // 调用 Dynamic 登录
      const authResult = await dynamicLogin(options);
      
      if (!authResult.user) {
        throw new Error('Login failed');
      }

      setUser(authResult.user);
      setIsAuthenticated(true);

      // 获取或创建钱包
      let userWallet = await getPrimaryWallet(authResult.user);
      
      if (!userWallet && config.enableEmbeddedWallets) {
        // 创建嵌入式钱包
        userWallet = await createEmbeddedWallet(authResult.user);
      }

      if (userWallet) {
        setWallet(userWallet);
      }

      // 存储 session
      localStorage.setItem('dynamic_session', JSON.stringify({
        userId: authResult.user.id,
        timestamp: Date.now(),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [config.enableEmbeddedWallets]);

  // 登出
  const logout = useCallback(async () => {
    setIsLoading(true);
    
    try {
      await dynamicLogout();
      
      setUser(null);
      setWallet(null);
      setIsAuthenticated(false);
      localStorage.removeItem('dynamic_session');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logout failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 签名消息
  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      const signature = await dynamicSignMessage(message, wallet.address);
      return signature;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to sign message');
    }
  }, [wallet]);

  // 签名交易
  const signTransaction = useCallback(async (
    transaction: Transaction | VersionedTransaction
  ): Promise<Transaction | VersionedTransaction> => {
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      const signed = await dynamicSignTransaction(transaction, wallet.address);
      return signed;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to sign transaction');
    }
  }, [wallet]);

  // 签名并发送交易
  const signAndSendTransaction = useCallback(async (
    transaction: Transaction | VersionedTransaction
  ): Promise<string> => {
    if (!wallet) {
      throw new Error('No wallet connected');
    }

    try {
      // 签名
      const signed = await dynamicSignTransaction(transaction, wallet.address);
      
      // 发送
      const signature = await connection.sendRawTransaction(
        signed.serialize(),
        { skipPreflight: false, preflightCommitment: 'confirmed' }
      );

      // 确认
      await connection.confirmTransaction(signature, 'confirmed');
      
      return signature;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to send transaction');
    }
  }, [wallet, connection]);

  const value: DynamicContextType = {
    isInitialized,
    isLoading,
    isAuthenticated,
    user,
    wallet,
    error,
    login,
    logout,
    signMessage,
    signTransaction,
    signAndSendTransaction,
  };

  return (
    <DynamicContext.Provider value={value}>
      {children}
    </DynamicContext.Provider>
  );
}

// ============================================================================
// SDK 加载和初始化
// ============================================================================

async function loadDynamicSDK(): Promise<void> {
  // 检查是否已经加载
  if (typeof window !== 'undefined' && (window as any).Dynamic) {
    return;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://app.dynamic.xyz/api/v0/sdk/dynamic.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Dynamic SDK'));
    document.head.appendChild(script);
  });
}

async function initializeDynamic(config: DynamicConfig): Promise<void> {
  const Dynamic = (window as any).Dynamic;
  if (!Dynamic) {
    throw new Error('Dynamic SDK not loaded');
  }

  await Dynamic.init({
    environmentId: config.environmentId,
    appName: config.appName,
    appIcon: config.appIcon,
    wallets: {
      solana: {
        enabled: config.chains.includes('solana'),
      },
      evm: {
        enabled: config.chains.includes('evm'),
      },
    },
    socialProviders: config.socialProviders,
    enableEmbeddedWallets: config.enableEmbeddedWallets,
  });
}

// ============================================================================
// 模拟的 Dynamic SDK 方法 (实际实现需要替换为真实的 SDK 调用)
// ============================================================================

async function checkExistingSession(): Promise<DynamicUser | null> {
  const session = localStorage.getItem('dynamic_session');
  if (!session) return null;

  try {
    const { userId } = JSON.parse(session);
    // 实际应该调用 Dynamic SDK 验证 session
    return null;
  } catch {
    return null;
  }
}

async function dynamicLogin(options?: LoginOptions): Promise<{ user: DynamicUser | null }> {
  // 实际实现：调用 Dynamic SDK 的登录方法
  // 这里返回模拟数据
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        user: {
          id: 'user_' + Math.random().toString(36).slice(2),
          email: options?.email || 'user@example.com',
          verifiedCredentials: [],
        },
      });
    }, 1000);
  });
}

async function dynamicLogout(): Promise<void> {
  // 实际实现：调用 Dynamic SDK 的登出方法
  return Promise.resolve();
}

async function getPrimaryWallet(user: DynamicUser): Promise<DynamicWallet | null> {
  // 实际实现：从 Dynamic SDK 获取用户的主钱包
  const solanaCredential = user.verifiedCredentials.find(
    cred => cred.chain === 'solana' && cred.publicAddress
  );

  if (solanaCredential?.publicAddress) {
    return {
      address: solanaCredential.publicAddress,
      publicKey: new PublicKey(solanaCredential.publicAddress),
      chain: 'solana',
      connector: 'embedded',
    };
  }

  return null;
}

async function createEmbeddedWallet(user: DynamicUser): Promise<DynamicWallet> {
  // 实际实现：调用 Dynamic SDK 创建嵌入式钱包
  const mockAddress = '5Y3d' + Math.random().toString(36).slice(2, 30);
  
  return {
    address: mockAddress,
    publicKey: new PublicKey(mockAddress),
    chain: 'solana',
    connector: 'embedded',
  };
}

async function dynamicSignMessage(
  message: Uint8Array,
  walletAddress: string
): Promise<Uint8Array> {
  // 实际实现：调用 Dynamic SDK 签名
  return crypto.getRandomValues(new Uint8Array(64));
}

async function dynamicSignTransaction(
  transaction: Transaction | VersionedTransaction,
  walletAddress: string
): Promise<Transaction | VersionedTransaction> {
  // 实际实现：调用 Dynamic SDK 签名交易
  return transaction;
}
