'use client';

import { usePrivy } from '@privy-io/react-auth';
import { motion } from 'framer-motion';
import { Wallet, Mail, LogOut } from 'lucide-react';

export function PrivyLogin() {
  const { 
    login, 
    logout, 
    authenticated, 
    user,
    ready 
  } = usePrivy();

  if (!ready) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (authenticated && user) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-xl p-6 border border-purple-500/30"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xl">
            {user.email?.address?.[0] || user.wallet?.address?.[0] || '👤'}
          </div>
          <div>
            <h3 className="font-bold text-white">Authenticated</h3>
            <p className="text-sm text-gray-400">
              {user.email?.address || 
               (user.wallet?.address && `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`) ||
               'Unknown User'}
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-green-400" />
            <span className="text-gray-300">
              {user.linkedAccounts?.length || 0} linked accounts
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Wallet className="w-4 h-4 text-blue-400" />
            <span className="text-gray-300">
              {user.wallet?.walletClientType === 'privy' 
                ? 'Embedded Wallet (Privy)' 
                : 'External Wallet'}
            </span>
          </div>
        </div>

        {user.wallet && (
          <div className="bg-black/30 rounded-lg p-3 mb-4">
            <p className="text-xs text-gray-500 mb-1">Wallet Address</p>
            <p className="text-sm font-mono text-green-400 break-all">
              {user.wallet.address}
            </p>
          </div>
        )}

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-xl p-6 border border-purple-500/30"
    >
      <h2 className="text-xl font-bold text-white mb-2">
        Connect with Privy
      </h2>
      <p className="text-gray-400 text-sm mb-6">
        Social login + Wallet infrastructure
      </p>

      <button
        onClick={login}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02]"
      >
        <Wallet className="w-5 h-5" />
        Connect Wallet
      </button>

      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500">
        <span>Google</span>
        <span>•</span>
        <span>Email</span>
        <span>•</span>
        <span>MetaMask</span>
      </div>
    </motion.div>
  );
}
