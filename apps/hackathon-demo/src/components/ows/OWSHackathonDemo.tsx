/**
 * OWS Hackathon Demo - Main Application
 *
 * Complete demo showcasing:
 * - Wallet discovery and connection
 * - Multi-chain support (EVM + Solana)
 * - Agent integration
 * - Real-time interactions
 *
 * @module hackathon-demo
 */

import React, { useState, useEffect, useCallback } from 'react';
import { OWSAdapter, type OWSWallet, type OWSConnection } from './OWSAdapter';

// ============================================================================
// Types
// ============================================================================

interface DemoState {
    wallets: OWSWallet[];
    connected: boolean;
    connection: OWSConnection | null;
    currentProvider: string | null;
    loading: boolean;
    error: string | null;
    logs: LogEntry[];
}

interface LogEntry {
    id: string;
    timestamp: number;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    details?: string;
}

interface AgentAction {
    id: string;
    type: 'connect' | 'sign' | 'transaction' | 'message';
    status: 'pending' | 'completed' | 'failed';
    description: string;
    timestamp: number;
}

// ============================================================================
// Demo Component
// ============================================================================

export const OWSHackathonDemo: React.FC = () => {
    const [adapter] = useState(() => new OWSAdapter());
    const [state, setState] = useState<DemoState>({
        wallets: [],
        connected: false,
        connection: null,
        currentProvider: null,
        loading: false,
        error: null,
        logs: [],
    });
    const [agentActions, setAgentActions] = useState<AgentAction[]>([]);
    const [activeTab, setActiveTab] = useState<'wallet' | 'agent' | 'console'>('wallet');

    // Add log entry
    const addLog = useCallback((type: LogEntry['type'], message: string, details?: string) => {
        setState((prev) => ({
            ...prev,
            logs: [
                {
                    id: Math.random().toString(36).slice(2),
                    timestamp: Date.now(),
                    type,
                    message,
                    details,
                },
                ...prev.logs.slice(0, 49), // Keep last 50 logs
            ],
        }));
    }, []);

    // Discover wallets
    const discoverWallets = useCallback(async () => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        addLog('info', 'Discovering wallets...');

        try {
            const wallets = await adapter.discover();
            setState((prev) => ({
                ...prev,
                wallets,
                loading: false,
            }));
            addLog('success', `Discovered ${wallets.filter((w) => w.installed).length} installed wallets`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Discovery failed';
            setState((prev) => ({ ...prev, loading: false, error: message }));
            addLog('error', message);
        }
    }, [adapter, addLog]);

    // Connect wallet
    const connectWallet = useCallback(
        async (walletId: string) => {
            setState((prev) => ({ ...prev, loading: true, error: null }));
            addLog('info', `Connecting to ${walletId}...`);

            try {
                const connection = await adapter.connect(walletId);
                setState((prev) => ({
                    ...prev,
                    connected: true,
                    connection,
                    currentProvider: walletId,
                    loading: false,
                }));
                addLog('success', `Connected: ${connection.address.slice(0, 6)}...${connection.address.slice(-4)}`);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Connection failed';
                setState((prev) => ({ ...prev, loading: false, error: message }));
                addLog('error', message);
            }
        },
        [adapter, addLog],
    );

    // Disconnect wallet
    const disconnectWallet = useCallback(async () => {
        await adapter.disconnect();
        setState((prev) => ({
            ...prev,
            connected: false,
            connection: null,
            currentProvider: null,
        }));
        addLog('info', 'Disconnected from wallet');
    }, [adapter, addLog]);

    // Sign message
    const signMessage = useCallback(async () => {
        if (!state.connected) {
            addLog('warning', 'Please connect wallet first');
            return;
        }

        setState((prev) => ({ ...prev, loading: true }));
        addLog('info', 'Requesting message signature...');

        try {
            const message = `Gradience OWS Demo - ${Date.now()}`;
            const signature = await adapter.signMessage(message);
            addLog('success', 'Message signed successfully', `Signature: ${signature.slice(0, 20)}...`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Signing failed';
            addLog('error', message);
        } finally {
            setState((prev) => ({ ...prev, loading: false }));
        }
    }, [adapter, state.connected, addLog]);

    // Agent demo
    const runAgentDemo = useCallback(async () => {
        const actionId = Math.random().toString(36).slice(2);

        // Step 1: Auto-connect
        setAgentActions((prev) => [
            ...prev,
            {
                id: actionId,
                type: 'connect',
                status: 'pending',
                description: 'Agent discovering and connecting to wallet...',
                timestamp: Date.now(),
            },
        ]);
        addLog('info', '🤖 Agent: Starting auto-connection...');

        try {
            const wallets = await adapter.discover();
            const installedWallet = wallets.find((w) => w.installed);

            if (!installedWallet) {
                throw new Error('No wallet found for Agent');
            }

            addLog('info', `🤖 Agent: Found ${installedWallet.name}`);

            await adapter.connect(installedWallet.id);
            addLog('success', `🤖 Agent: Connected to ${installedWallet.name}`);

            setAgentActions((prev) => prev.map((a) => (a.id === actionId ? { ...a, status: 'completed' } : a)));

            // Step 2: Sign message
            const signActionId = Math.random().toString(36).slice(2);
            setAgentActions((prev) => [
                ...prev,
                {
                    id: signActionId,
                    type: 'sign',
                    status: 'pending',
                    description: 'Agent requesting message signature...',
                    timestamp: Date.now(),
                },
            ]);

            addLog('info', '🤖 Agent: Requesting signature...');
            const message = 'Agent authentication request';
            const signature = await adapter.signMessage(message);
            addLog('success', '🤖 Agent: Message signed!', `Sig: ${signature.slice(0, 16)}...`);

            setAgentActions((prev) => prev.map((a) => (a.id === signActionId ? { ...a, status: 'completed' } : a)));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Agent action failed';
            addLog('error', `🤖 Agent: ${message}`);
            setAgentActions((prev) => prev.map((a) => (a.id === actionId ? { ...a, status: 'failed' } : a)));
        }
    }, [adapter, addLog]);

    // Initial discovery
    useEffect(() => {
        discoverWallets();
    }, [discoverWallets]);

    // ============================================================================
    // Render
    // ============================================================================

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <header className="text-center mb-8">
                    <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        🚀 Gradience OWS Adapter
                    </h1>
                    <p className="text-slate-400">Open Wallet Standard Implementation for OWS Hackathon Miami</p>
                    <div className="flex justify-center gap-4 mt-4">
                        <span className="px-3 py-1 bg-purple-500/20 rounded-full text-sm">Multi-Chain</span>
                        <span className="px-3 py-1 bg-pink-500/20 rounded-full text-sm">Agent Ready</span>
                        <span className="px-3 py-1 bg-blue-500/20 rounded-full text-sm">Production Grade</span>
                    </div>
                </header>

                {/* Tabs */}
                <div className="flex justify-center mb-6">
                    <div className="bg-slate-800/50 rounded-lg p-1 flex gap-1">
                        {(['wallet', 'agent', 'console'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-md capitalize transition-all ${
                                    activeTab === tab ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Wallet Tab */}
                {activeTab === 'wallet' && (
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Wallet Discovery */}
                        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold">🔍 Wallet Discovery</h2>
                                <button
                                    onClick={discoverWallets}
                                    disabled={state.loading}
                                    className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg disabled:opacity-50 transition-colors"
                                >
                                    {state.loading ? 'Discovering...' : 'Refresh'}
                                </button>
                            </div>

                            <div className="space-y-3">
                                {state.wallets.map((wallet) => (
                                    <div
                                        key={wallet.id}
                                        className={`p-4 rounded-lg border transition-all ${
                                            wallet.installed
                                                ? 'bg-slate-700/50 border-slate-600 hover:border-purple-500'
                                                : 'bg-slate-800/30 border-slate-700 opacity-50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={wallet.icon}
                                                    alt={wallet.name}
                                                    className="w-10 h-10 rounded-full"
                                                />
                                                <div>
                                                    <h3 className="font-medium">{wallet.name}</h3>
                                                    <p className="text-sm text-slate-400">{wallet.chains.join(', ')}</p>
                                                </div>
                                            </div>

                                            {wallet.installed ? (
                                                state.connected && state.currentProvider === wallet.id ? (
                                                    <button
                                                        onClick={disconnectWallet}
                                                        className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
                                                    >
                                                        Disconnect
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => connectWallet(wallet.id)}
                                                        disabled={state.loading || state.connected}
                                                        className="px-4 py-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        Connect
                                                    </button>
                                                )
                                            ) : (
                                                <span className="text-sm text-slate-500">Not Installed</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Connection Status */}
                        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                            <h2 className="text-xl font-semibold mb-4">🔗 Connection Status</h2>

                            {state.connected && state.connection ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                                            <span className="text-green-400 font-medium">Connected</span>
                                        </div>
                                        <p className="text-sm text-slate-400 font-mono">{state.connection.address}</p>
                                        <p className="text-sm text-slate-500 mt-1">
                                            Chain ID: {state.connection.chainId}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={signMessage}
                                            disabled={state.loading}
                                            className="px-4 py-3 bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            ✍️ Sign Message
                                        </button>
                                        <button
                                            onClick={disconnectWallet}
                                            className="px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                        >
                                            🔌 Disconnect
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-slate-500">
                                    <p className="text-4xl mb-4">👛</p>
                                    <p>Connect a wallet to see details</p>
                                </div>
                            )}

                            {state.error && (
                                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                                    {state.error}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Agent Tab */}
                {activeTab === 'agent' && (
                    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-semibold">🤖 Agent Integration Demo</h2>
                                <p className="text-slate-400 text-sm">Watch how an AI Agent interacts with wallets</p>
                            </div>
                            <button
                                onClick={runAgentDemo}
                                disabled={state.loading}
                                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-medium transition-all disabled:opacity-50"
                            >
                                Run Agent Demo
                            </button>
                        </div>

                        <div className="space-y-3">
                            {agentActions.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <p className="text-4xl mb-4">🤖</p>
                                    <p>Click "Run Agent Demo" to see the Agent in action</p>
                                </div>
                            ) : (
                                agentActions.map((action) => (
                                    <div
                                        key={action.id}
                                        className={`p-4 rounded-lg border transition-all ${
                                            action.status === 'completed'
                                                ? 'bg-green-500/10 border-green-500/30'
                                                : action.status === 'failed'
                                                  ? 'bg-red-500/10 border-red-500/30'
                                                  : 'bg-purple-500/10 border-purple-500/30 animate-pulse'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">
                                                {action.status === 'completed'
                                                    ? '✅'
                                                    : action.status === 'failed'
                                                      ? '❌'
                                                      : '⏳'}
                                            </span>
                                            <div className="flex-1">
                                                <p className="font-medium">{action.description}</p>
                                                <p className="text-sm text-slate-400">
                                                    {new Date(action.timestamp).toLocaleTimeString()}
                                                </p>
                                            </div>
                                            <span
                                                className={`px-2 py-1 rounded text-xs ${
                                                    action.status === 'completed'
                                                        ? 'bg-green-500/20 text-green-400'
                                                        : action.status === 'failed'
                                                          ? 'bg-red-500/20 text-red-400'
                                                          : 'bg-purple-500/20 text-purple-400'
                                                }`}
                                            >
                                                {action.status}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-6 p-4 bg-slate-900/50 rounded-lg">
                            <h3 className="font-medium mb-2">💡 How it works</h3>
                            <ol className="text-sm text-slate-400 space-y-1 list-decimal list-inside">
                                <li>Agent discovers available wallets in the browser</li>
                                <li>Agent automatically connects to the first available wallet</li>
                                <li>Agent requests user confirmation for actions</li>
                                <li>All interactions follow OWS standard interface</li>
                            </ol>
                        </div>
                    </div>
                )}

                {/* Console Tab */}
                {activeTab === 'console' && (
                    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                        <h2 className="text-xl font-semibold mb-4">📋 Event Console</h2>

                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {state.logs.length === 0 ? (
                                <p className="text-slate-500 text-center py-8">No events yet...</p>
                            ) : (
                                state.logs.map((log) => (
                                    <div
                                        key={log.id}
                                        className={`p-3 rounded-lg text-sm ${
                                            log.type === 'success'
                                                ? 'bg-green-500/10 text-green-400'
                                                : log.type === 'error'
                                                  ? 'bg-red-500/10 text-red-400'
                                                  : log.type === 'warning'
                                                    ? 'bg-yellow-500/10 text-yellow-400'
                                                    : 'bg-slate-700/50 text-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-start gap-2">
                                            <span className="text-xs opacity-50">
                                                {new Date(log.timestamp).toLocaleTimeString()}
                                            </span>
                                            <div className="flex-1">
                                                <p>{log.message}</p>
                                                {log.details && (
                                                    <p className="text-xs opacity-70 mt-1">{log.details}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <footer className="mt-12 text-center text-slate-500 text-sm">
                    <p>Gradience Protocol - OWS Hackathon Miami 2026</p>
                    <p className="mt-1">Built with ❤️ for the Open Wallet Standard</p>
                </footer>
            </div>
        </div>
    );
};

export default OWSHackathonDemo;
