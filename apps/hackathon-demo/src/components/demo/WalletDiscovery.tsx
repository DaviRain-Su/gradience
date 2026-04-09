'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Link2 } from 'lucide-react';
import { owsAdapter, OWSWallet } from '../ows/OWSAdapter';

export function WalletDiscovery() {
    const [wallets, setWallets] = useState<OWSWallet[]>([]);
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState<string | null>(null);
    const [connection, setConnection] = useState<any>(null);

    useEffect(() => {
        discoverWallets();
    }, []);

    const discoverWallets = async () => {
        setLoading(true);
        try {
            const discovered = await owsAdapter.discover();
            setWallets(discovered);
        } catch (error) {
            console.error('Discovery error:', error);
        } finally {
            setLoading(false);
        }
    };

    const connectWallet = async (walletId: string) => {
        try {
            const conn = await owsAdapter.connect(walletId);
            setConnected(walletId);
            setConnection(conn);
            console.log('Connected:', conn);
        } catch (error: any) {
            alert(error.message || 'Failed to connect');
        }
    };

    const disconnectWallet = async () => {
        await owsAdapter.disconnect();
        setConnected(null);
        setConnection(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-gradient-to-br from-gray-900/50 to-black/50 rounded-xl p-6 border border-gray-700/50"
        >
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white">OWS Wallet Discovery</h2>
                    <p className="text-gray-400 text-sm">Open Wallet Standard - Universal wallet connector</p>
                </div>
                <button
                    onClick={discoverWallets}
                    className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                    Refresh
                </button>
            </div>

            {connected && connection && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-400 font-semibold">Connected</p>
                            <p className="text-sm text-gray-400 font-mono break-all">{connection.address}</p>
                            <p className="text-xs text-gray-500 mt-1">Chain ID: {connection.chainId}</p>
                        </div>
                        <button
                            onClick={disconnectWallet}
                            className="px-3 py-1 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                        >
                            Disconnect
                        </button>
                    </div>
                </motion.div>
            )}

            <div className="space-y-3">
                {wallets.map((wallet) => (
                    <motion.div
                        key={wallet.id}
                        whileHover={{ scale: 1.02 }}
                        className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                            connected === wallet.id
                                ? 'bg-green-500/10 border-green-500/50'
                                : wallet.installed
                                  ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                                  : 'bg-gray-900/30 border-gray-800 opacity-60'
                        }`}
                    >
                        <img
                            src={wallet.icon}
                            alt={wallet.name}
                            className="w-10 h-10 rounded-full bg-white/10"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="2"/></svg>';
                            }}
                        />

                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-white">{wallet.name}</h3>
                                {wallet.installed ? (
                                    <span className="flex items-center gap-1 text-xs text-green-400">
                                        <Check className="w-3 h-3" />
                                        Installed
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-xs text-gray-500">
                                        <X className="w-3 h-3" />
                                        Not installed
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {wallet.features.map((feature) => (
                                    <span
                                        key={feature}
                                        className="text-xs px-2 py-0.5 bg-gray-700/50 rounded-full text-gray-400"
                                    >
                                        {feature}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {wallet.installed && (
                            <button
                                onClick={() => connectWallet(wallet.id)}
                                disabled={connected === wallet.id}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                    connected === wallet.id
                                        ? 'bg-green-500/20 text-green-400 cursor-default'
                                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                                }`}
                            >
                                <Link2 className="w-4 h-4" />
                                {connected === wallet.id ? 'Connected' : 'Connect'}
                            </button>
                        )}
                    </motion.div>
                ))}
            </div>

            {wallets.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                    No wallets discovered. Install MetaMask, Phantom, or OKX Wallet to try.
                </div>
            )}
        </motion.div>
    );
}
