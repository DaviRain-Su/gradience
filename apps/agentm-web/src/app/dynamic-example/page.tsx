/**
 * Dynamic Integration Example Page
 *
 * 展示如何使用 Dynamic 替代 Privy
 */

'use client';

import { DynamicProvider, useDynamic } from '../lib/dynamic/provider';
import { DynamicLoginButton } from '../components/DynamicLoginButton';

// Dynamic 配置
const dynamicConfig = {
  environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID || 'your-env-id',
  rpcEndpoint: process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com',
  appName: 'AgentM',
  appIcon: 'https://your-app-icon.png',
  chains: ['solana'] as const,
  enableEmbeddedWallets: true,
  socialProviders: ['google', 'twitter', 'email'] as const,
};

// 包装整个应用
export default function DynamicExamplePage() {
  return (
    <DynamicProvider config={dynamicConfig}>
      <ExampleContent />
    </DynamicProvider>
  );
}

// 示例内容
function ExampleContent() {
  const {
    isInitialized,
    isLoading,
    isAuthenticated,
    user,
    wallet,
    error,
    signMessage,
    signAndSendTransaction,
  } = useDynamic();

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Initializing...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-semibold mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Dynamic Integration Example
          </h1>
          <p className="text-gray-500">
            替代 Privy 的嵌入式钱包解决方案
          </p>
        </div>

        {/* Login Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Authentication</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className={`font-medium ${isAuthenticated ? 'text-green-600' : 'text-gray-700'}`}>
                {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
              </p>
            </div>
            <DynamicLoginButton
              variant="primary"
              size="md"
              onLoginSuccess={() => console.log('Login success')}
              onLoginError={(err) => console.error('Login error:', err)}
            />
          </div>
        </div>

        {/* User Info */}
        {isAuthenticated && user && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">User Info</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">User ID</span>
                <span className="font-mono text-sm">{user.id}</span>
              </div>
              {user.email && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Email</span>
                  <span>{user.email}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Credentials</span>
                <span>{user.verifiedCredentials.length}</span>
              </div>
            </div>
          </div>
        )}

        {/* Wallet Info */}
        {wallet && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Wallet</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Address</span>
                <span className="font-mono text-sm">
                  {wallet.address.slice(0, 8)}...{wallet.address.slice(-8)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Chain</span>
                <span className="capitalize">{wallet.chain}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Connector</span>
                <span className="capitalize">{wallet.connector}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-3">
              <button
                onClick={async () => {
                  try {
                    const message = new TextEncoder().encode('Hello Dynamic!');
                    const signature = await signMessage(message);
                    console.log('Signature:', signature);
                    alert('Message signed! Check console for signature.');
                  } catch (err) {
                    alert('Failed to sign message: ' + (err instanceof Error ? err.message : 'Unknown error'));
                  }
                }}
                disabled={isLoading}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors"
              >
                Sign Message
              </button>
            </div>
          </div>
        )}

        {/* Features */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Features</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Social Login (Google, Twitter, Email)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Embedded Wallet (无需助记词)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Solana 支持</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>消息签名</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>交易签名和发送</span>
            </li>
          </ul>
        </div>

        {/* Comparison */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">vs Privy</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Feature</th>
                  <th className="text-center py-2">Privy</th>
                  <th className="text-center py-2">Dynamic</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2">Social Login</td>
                  <td className="text-center text-green-500">✓</td>
                  <td className="text-center text-green-500">✓</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Embedded Wallet</td>
                  <td className="text-center text-green-500">✓</td>
                  <td className="text-center text-green-500">✓</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Solana Support</td>
                  <td className="text-center text-green-500">✓</td>
                  <td className="text-center text-green-500">✓</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Pricing</td>
                  <td className="text-center">Free tier</td>
                  <td className="text-center">Free tier</td>
                </tr>
                <tr>
                  <td className="py-2">Ease of Integration</td>
                  <td className="text-center">⭐⭐⭐</td>
                  <td className="text-center">⭐⭐⭐⭐⭐</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
