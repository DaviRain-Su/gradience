// @ts-nocheck
/**
 * Passkey Wallet Recovery Component
 *
 * 用于在新设备上恢复 Agent Wallet
 *
 * @module components/PasskeyWalletRecovery
 */

import React from 'react';
import { usePasskeyWallet } from '../../hooks/usePasskeyWallet';

interface PasskeyWalletRecoveryProps {
  rpId: string;
  rpName: string;
  userId: string;
  userName: string;
  onRecovered?: (wallet: {
    agentId: string;
    subWalletAddress: string;
    masterWalletAddress: string;
  }) => void;
  onError?: (error: string) => void;
}

export const PasskeyWalletRecovery: React.FC<PasskeyWalletRecoveryProps> = ({
  rpId,
  rpName,
  userId,
  userName,
  onRecovered,
  onError,
}) => {
  const {
    isSupported,
    isLoading,
    error,
    recoveredWallet,
    recoverWallet,
    checkSupport,
    clearError,
  } = usePasskeyWallet({
    rpId,
    rpName,
    userId,
    userName,
  });

  const handleRecover = async () => {
    clearError();
    const wallet = await recoverWallet();

    if (wallet) {
      onRecovered?.({
        agentId: wallet.agentId,
        subWalletAddress: wallet.subWalletAddress,
        masterWalletAddress: wallet.masterWalletAddress,
      });
    }
  };

  // 不支持 Passkey
  if (!isSupported) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">⚠️</span>
          <h3 className="text-lg font-semibold text-red-800">
            设备不支持 Passkey
          </h3>
        </div>
        <p className="text-red-600 mb-4">
          您的浏览器或设备不支持 Passkey。请使用以下浏览器之一：
        </p>
        <ul className="list-disc list-inside text-red-600 space-y-1">
          <li>Chrome 108+</li>
          <li>Safari 16+</li>
          <li>Edge 108+</li>
        </ul>
        <button
          onClick={checkSupport}
          className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
        >
          重新检测
        </button>
      </div>
    );
  }

  // 恢复成功
  if (recoveredWallet) {
    return (
      <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">✅</span>
          <h3 className="text-lg font-semibold text-green-800">
            钱包恢复成功
          </h3>
        </div>
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-gray-500">Agent ID:</span>{' '}
            <span className="font-mono text-green-700">
              {recoveredWallet.agentId}
            </span>
          </p>
          <p>
            <span className="text-gray-500">子钱包地址:</span>{' '}
            <span className="font-mono text-green-700">
              {recoveredWallet.subWalletAddress.slice(0, 12)}...
              {recoveredWallet.subWalletAddress.slice(-8)}
            </span>
          </p>
          <p>
            <span className="text-gray-500">主钱包:</span>{' '}
            <span className="font-mono text-green-700">
              {recoveredWallet.masterWalletAddress.slice(0, 8)}...
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="text-center mb-6">
        <span className="text-4xl mb-3 block">🔐</span>
        <h3 className="text-lg font-semibold text-gray-800">
          恢复 Agent Wallet
        </h3>
        <p className="text-gray-500 text-sm mt-1">
          使用 Passkey 恢复您的 Agent 钱包
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={handleRecover}
          disabled={isLoading}
          className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="animate-spin">⏳</span>
              正在恢复...
            </>
          ) : (
            <>
              <span>🔑</span>
              使用 Passkey 恢复
            </>
          )}
        </button>

        <div className="text-center">
          <p className="text-xs text-gray-400">
            需要使用之前创建钱包时的设备或已同步的 Passkey
          </p>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100">
        <h4 className="text-sm font-medium text-gray-700 mb-2">如何工作？</h4>
        <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
          <li>点击"使用 Passkey 恢复"按钮</li>
          <li>使用 Face ID / Touch ID / Windows Hello 验证</li>
          <li>系统自动恢复您的 Agent 钱包</li>
        </ol>
      </div>
    </div>
  );
};

export default PasskeyWalletRecovery;
