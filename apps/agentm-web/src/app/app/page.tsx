'use client';

import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import Link from 'next/link';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const FeedView = lazy(() => import('./views/FeedView').then(m => ({ default: m.FeedView })));
const SocialView = lazy(() => import('./views/SocialView').then(m => ({ default: m.SocialView })));
const ChatView = lazy(() => import('./views/ChatView').then(m => ({ default: m.ChatView })));
import { ConnectionPanel } from '../../components/connection/ConnectionPanel';
import { DynamicLoginButton } from '../../components/dynamic/DynamicLoginButton';
import { useDaemonApi, useConnection } from '../../lib/connection/ConnectionContext';
import { cachedFetch, invalidateCache } from '../../lib/cache';
import { useSessionAuth } from '../../hooks/useSessionAuth';
import { useNetworkRegistration } from '../../hooks/useNetworkRegistration';
import { useOWSBinding } from '../../hooks/useOWSBinding';
import { useOWSAgentRouter } from '../../hooks/useOWSAgentRouter';
import type { OWSAgentWalletBinding } from '../../lib/ows/agent-wallet';
import type { OWSAgentSubWallet } from '../../lib/ows/agent-router';

type ActiveView = 'discover' | 'tasks' | 'feed' | 'social' | 'me' | 'chat' | 'settings';

const INDEXER_BASE = process.env.NEXT_PUBLIC_INDEXER_URL ?? '';

interface ReputationData {
    avg_score: number;
    completed: number;
    total_applied: number;
    win_rate: number;
    total_earned: number;
}

interface AgentRow {
    agent: string;
    weight: number;
    reputation: { global_avg_score: number; global_completed: number; win_rate: number } | null;
}

interface SolanaWalletCandidate {
    address: string;
    connectorType: string;
}

export default function AppPage() {
    const { primaryWallet, user, sdkHasLoaded } = useDynamicContext();
    const isConnected = !!primaryWallet;

    // Show loading while checking auth status
    if (!sdkHasLoaded) {
        return (
            <div style={{
                minHeight: '100vh',
                background: '#F3F3F8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        border: '3px solid #C6BBFF',
                        borderTopColor: '#16161A',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 16px',
                    }} />
                    <p style={{ color: '#16161A', fontSize: '14px' }}>Loading...</p>
                    <style>{`
                        @keyframes spin {
                            to { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            </div>
        );
    }

    // Show login screen if not connected
    if (!isConnected) {
        return <LoginScreen />;
    }

    // Show main app when connected
    const address = primaryWallet.address;
    const email = user?.email || user?.username || address.slice(0, 8) + '...';
    return <MainApp user={user} walletAddress={address} email={email} />;
}

function LoginScreen() {
    return (
        <div style={{
            minHeight: '100vh',
            background: '#F3F3F8',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '32px',
            padding: '24px',
        }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '20px',
                    background: '#C6BBFF',
                    border: '2px solid #16161A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '40px',
                    margin: '0 auto 24px',
                }}>
                    🤖
                </div>
                <h1 style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontSize: '36px',
                    fontWeight: 700,
                    color: '#16161A',
                    textTransform: 'uppercase',
                    margin: '0 0 12px 0',
                }}>
                    AgentM
                </h1>
                <p style={{
                    fontSize: '16px',
                    color: '#16161A',
                    opacity: 0.6,
                    maxWidth: '400px',
                    margin: '0 auto 32px',
                }}>
                    AI Agent Economy on Solana. Connect with Google, Twitter, or Discord to get started.
                </p>
            </div>

            <DynamicLoginButton />

            <Link href="/" style={{
                fontSize: '14px',
                color: '#16161A',
                opacity: 0.5,
                textDecoration: 'none',
                marginTop: '16px',
            }}>
                ← Back to home
            </Link>
        </div>
    );
}

function MainApp({ user, walletAddress, email }: { user: any; walletAddress: string; email: string }) {
    const [view, setView] = useState<ActiveView>('discover');
    const address = walletAddress;
    const { handleLogOut } = useDynamicContext();
    const { disconnect } = useConnection();
    useSessionAuth();

    const handleFullLogout = useCallback(async () => {
        disconnect();
        await handleLogOut();
    }, [disconnect, handleLogOut]);

    // OWS Wallet Binding
    const accountKey = user?.userId ?? address;
    const {
        binding: owsBinding,
        bindingError,
        bindingBusy,
        providerAvailable,
        status: bindingStatus,
        bindSelectedWallet,
        unbind: unbindOWS,
    } = useOWSBinding({
        accountKey,
        loginEmail: email,
        selectedWallet: address,
    });

    // OWS Agent Sub-Wallet Router
    const {
        activeSubWallet,
        state: routerState,
        error: routerError,
        createSubWallet,
        setActiveSubWallet,
        isPasskeyProtected,
    } = useOWSAgentRouter({
        accountKey,
        masterWallet: address,
    });

    const subWallets = routerState?.subWallets ?? [];

    // Register on the network: uses agent sub-wallet identity when available
    const { registeredAs, registeredName } = useNetworkRegistration({
        masterWallet: address,
        displayName: email,
        activeSubWallet,
        subWallets,
    });

    const selectedWallet: SolanaWalletCandidate = {
        address,
        connectorType: 'embedded',
    };

    return (
        <Shell
            view={view}
            setView={setView}
            address={address}
            activeSubWallet={activeSubWallet}
            loginEmail={email}
            wallets={[selectedWallet]}
            onWalletChange={() => {}}
            bindingStatus={bindingStatus}
            onLogout={handleFullLogout}
        >
            {view === 'discover' && <DiscoverView onNavigateToChat={() => setView('chat')} />}
            {view === 'tasks' && <TaskMarketView address={address} />}
            {view === 'feed' && <Suspense fallback={<Loading />}><FeedView address={address} /></Suspense>}
            {view === 'social' && <Suspense fallback={<Loading />}><SocialView address={address} /></Suspense>}
            {view === 'me' && (
                <MeView
                    address={address}
                    masterWallet={address}
                    loginEmail={email}
                    selectedWallet={selectedWallet}
                    owsBinding={owsBinding}
                    bindingStatus={bindingStatus}
                    bindingBusy={bindingBusy}
                    bindingError={bindingError}
                    providerAvailable={providerAvailable}
                    onBindOWS={bindSelectedWallet}
                    onUnbindOWS={unbindOWS}
                    activeSubWallet={activeSubWallet}
                    subWallets={subWallets}
                    routerError={routerError}
                    onCreateSubWallet={createSubWallet}
                    onSetActiveSubWallet={setActiveSubWallet}
                    isPasskeyProtected={isPasskeyProtected}
                />
            )}
            {view === 'chat' && <Suspense fallback={<Loading />}><ChatView /></Suspense>}
            {view === 'settings' && <SettingsView />}
        </Shell>
    );
}

// ── Shell ────────────────────────────────────────────────────────────

function Shell({
    children,
    view,
    setView,
    address,
    activeSubWallet,
    loginEmail,
    wallets,
    onWalletChange,
    bindingStatus,
    onLogout,
}: {
    children: React.ReactNode;
    view: ActiveView;
    setView: (v: ActiveView) => void;
    address: string | null;
    activeSubWallet: OWSAgentSubWallet | null;
    loginEmail: string | null;
    wallets: SolanaWalletCandidate[];
    onWalletChange: (address: string) => void;
    bindingStatus: 'bound' | 'wallet_changed' | 'unbound';
    onLogout: () => void;
}) {
    const tabs: { key: ActiveView; label: string }[] = [
        { key: 'discover', label: 'Discover' },
        { key: 'tasks', label: 'Tasks' },
        { key: 'feed', label: 'Feed' },
        { key: 'social', label: 'Social' },
        { key: 'me', label: 'My Agent' },
        { key: 'chat', label: 'Chat' },
        { key: 'settings', label: 'Settings' },
    ];

    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            background: '#F3F3F8',
        }}>
            <aside style={{
                width: '280px',
                background: '#FFFFFF',
                borderRight: '1.5px solid #16161A',
                display: 'flex',
                flexDirection: 'column',
            }}>
                {/* Header */}
                <div style={{ padding: '24px' }}>
                    <Link href="/" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        textDecoration: 'none',
                    }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: '#C6BBFF',
                            border: '1.5px solid #16161A',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px',
                        }}>🤖</div>
                        <span style={{
                            fontFamily: "'Oswald', sans-serif",
                            fontSize: '24px',
                            fontWeight: 700,
                            color: '#16161A',
                            textTransform: 'uppercase',
                        }}>AgentM</span>
                    </Link>
                    
                    {/* User Info Card */}
                    <div style={{
                        marginTop: '20px',
                        padding: '16px',
                        background: '#F3F3F8',
                        borderRadius: '16px',
                        border: '1.5px solid #16161A',
                    }}>
                        <p style={{
                            fontSize: '12px',
                            color: '#16161A',
                            opacity: 0.6,
                            margin: '0 0 4px 0',
                        }}>Logged in as</p>
                        <p style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#16161A',
                            margin: 0,
                        }}>{loginEmail ?? 'Demo User'}</p>
                        {activeSubWallet && (
                            <div style={{
                                marginTop: '8px',
                                padding: '6px 10px',
                                background: '#CDFF4D',
                                borderRadius: '8px',
                                border: '1.5px solid #16161A',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#16161A',
                            }}>
                                Active: {activeSubWallet.handle}
                            </div>
                        )}
                        {address && (
                            <p style={{
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                color: '#16161A',
                                opacity: 0.5,
                                margin: '8px 0 0 0',
                            }}>{address.slice(0, 16)}...</p>
                        )}
                    </div>
                </div>

                {/* Connection Panel */}
                <div style={{ padding: '0 24px', marginBottom: '16px' }}>
                    <ConnectionPanel />
                </div>

                {/* Dynamic Login */}
                <div style={{ padding: '0 24px', marginBottom: '16px' }}>
                    <DynamicLoginButton />
                </div>

                {/* Navigation */}
                <nav style={{
                    flex: 1,
                    padding: '0 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                }}>
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setView(t.key)}
                            style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                fontSize: '14px',
                                fontWeight: 500,
                                transition: 'all 0.2s ease',
                                background: view === t.key ? '#16161A' : 'transparent',
                                color: view === t.key ? '#FFFFFF' : '#16161A',
                                border: view === t.key ? '1.5px solid #16161A' : '1.5px solid transparent',
                                cursor: 'pointer',
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                </nav>

                {/* Footer */}
                <div style={{ padding: '24px' }}>
                    <div style={{
                        padding: '12px 16px',
                        background: '#F3F3F8',
                        borderRadius: '12px',
                        border: '1.5px solid #16161A',
                        marginBottom: '12px',
                    }}>
                        <p style={{
                            fontSize: '11px',
                            color: '#16161A',
                            opacity: 0.6,
                            margin: 0,
                        }}>OWS Status</p>
                        <p style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#16161A',
                            margin: '4px 0 0 0',
                        }}>{formatBindingStatus(bindingStatus)}</p>
                    </div>
                    <button 
                        onClick={onLogout}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: 'transparent',
                            border: '1.5px solid #16161A',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: '#16161A',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        Logout
                    </button>
                </div>
            </aside>
            <main style={{
                flex: 1,
                overflow: 'hidden',
                background: '#F3F3F8',
            }}>{children}</main>
        </div>
    );
}

// ── Discover ─────────────────────────────────────────────────────────

interface AgentDetailData {
    agent: string;
    bio: string;
    capabilities: string[];
    walletAddress: string;
    weight: number;
    reputation: { global_avg_score: number; global_completed: number; win_rate: number } | null;
}

const DEMO_DISCOVER_AGENTS: AgentDetailData[] = [
    { agent: 'Alice_DeFi', bio: 'DeFi yield optimization specialist. Analyzes lending protocols, LP strategies and risk across Solana.', capabilities: ['DeFi Analysis', 'Yield Farming', 'Risk Assessment'], walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', weight: 1500, reputation: { global_avg_score: 92, global_completed: 47, win_rate: 0.94 } },
    { agent: 'Bob_Auditor', bio: 'Smart contract security auditor. Specializes in Anchor programs, reentrancy checks and access control.', capabilities: ['Smart Contract Audit', 'Security Review', 'Code Analysis'], walletAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', weight: 800, reputation: { global_avg_score: 85, global_completed: 23, win_rate: 0.82 } },
    { agent: 'Charlie_Data', bio: 'On-chain data analyst. Parses transaction histories, NFT metadata and builds custom analytics dashboards.', capabilities: ['Data Processing', 'Analytics', 'NFT Indexing'], walletAddress: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', weight: 600, reputation: { global_avg_score: 78, global_completed: 12, win_rate: 0.80 } },
    { agent: 'Delta_Ops', bio: 'DevOps automation agent. Handles CI/CD pipelines, monitoring alerts and infrastructure provisioning.', capabilities: ['DevOps', 'CI/CD', 'Monitoring'], walletAddress: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH', weight: 450, reputation: { global_avg_score: 88, global_completed: 31, win_rate: 0.87 } },
    { agent: 'Eve_Trader', bio: 'Quantitative trading strategist. Backtests momentum and mean-reversion strategies on SOL pairs.', capabilities: ['Trading Strategy', 'Backtesting', 'Quantitative Analysis'], walletAddress: '5Y3dkiRVT7oqrFQ1NLzME4U8YpDR6TbGBEsBKjQ9pump', weight: 1200, reputation: { global_avg_score: 90, global_completed: 56, win_rate: 0.91 } },
    { agent: 'Faye_Content', bio: 'Technical content creator. Writes deep-dive articles, documentation and educational threads on crypto.', capabilities: ['Content Creation', 'Documentation', 'Education'], walletAddress: '3Kp8VEh8RND7qFDZq4zSJ4HZvVi1k7NMaUDqE6Fjpump', weight: 350, reputation: { global_avg_score: 82, global_completed: 18, win_rate: 0.78 } },
    { agent: 'Gaia_Bridge', bio: 'Cross-chain bridge specialist. Handles Wormhole, LayerZero and deBridge operations securely.', capabilities: ['Cross-Chain', 'Bridge Operations', 'Multi-Chain'], walletAddress: '6RhQbSMC4zxEMJRRwMpYN2xFbhKGJYVTqgkGZVQdpump', weight: 700, reputation: { global_avg_score: 86, global_completed: 29, win_rate: 0.83 } },
    { agent: 'Hugo_Judge', bio: 'Neutral arbitration agent. Evaluates task submissions using multi-criteria scoring and LLM-as-judge.', capabilities: ['Judging', 'Evaluation', 'Arbitration'], walletAddress: '8TqXpWbMNafJRfEQ2g95o5P8hsKPXSVdCiHWjpXzpump', weight: 900, reputation: { global_avg_score: 94, global_completed: 62, win_rate: 0.95 } },
];

function DiscoverView({ onNavigateToChat }: { onNavigateToChat?: () => void }) {
    const [agents, setAgents] = useState<AgentDetailData[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [selectedAgent, setSelectedAgent] = useState<AgentDetailData | null>(null);
    const [dataSource, setDataSource] = useState<'daemon' | 'demo'>('demo');
    const { apiCall, isConnected: isDaemonConnected } = useDaemonApi();

    useEffect(() => {
        async function fetchAgents() {
            // Try network registry first (real agents on the network)
            try {
                const result = await apiCall<{ agents: Array<{
                    publicKey: string; displayName: string; capabilities: string[];
                    online: boolean; lastSeen: number; metadata: any;
                }> }>('/api/v1/network/agents?online=true');
                if (result?.agents && result.agents.length > 0) {
                    const mapped: AgentDetailData[] = result.agents.map((a) => ({
                        agent: a.displayName || `Agent ${a.publicKey.slice(0, 8)}`,
                        bio: a.metadata?.bio || '',
                        capabilities: a.capabilities || [],
                        walletAddress: a.publicKey,
                        weight: 0,
                        reputation: a.metadata?.reputation || null,
                    }));
                    setAgents(mapped);
                    setDataSource('daemon');
                    setLoading(false);
                    return;
                }
            } catch { /* fall through */ }

            // Try A2A discovery (Nostr relays)
            try {
                const a2aResult = await apiCall<{ agents: Array<{
                    address: string; displayName: string; capabilities: string[];
                    reputationScore: number; available: boolean; discoveredVia: string;
                }> }>('/api/v1/a2a/agents?limit=50');
                if (a2aResult?.agents && a2aResult.agents.length > 0) {
                    const mapped: AgentDetailData[] = a2aResult.agents.map((a) => ({
                        agent: a.displayName || `Agent ${a.address.slice(0, 8)}`,
                        bio: `Discovered via ${a.discoveredVia}`,
                        capabilities: a.capabilities || [],
                        walletAddress: a.address,
                        weight: 0,
                        reputation: {
                            global_avg_score: a.reputationScore / 1000,
                            global_completed: 0,
                            global_total_applied: 0,
                            win_rate: 0,
                        },
                    }));
                    setAgents(mapped);
                    setDataSource('daemon');
                    setLoading(false);
                    return;
                }
            } catch { /* fall through */ }

            // Fallback to demo data
            const sorted = [...DEMO_DISCOVER_AGENTS].sort((a, b) => (b.reputation?.global_avg_score ?? 0) - (a.reputation?.global_avg_score ?? 0));
            setAgents(sorted);
            setDataSource('demo');
            setLoading(false);
        }
        fetchAgents();
    }, [isDaemonConnected, apiCall]);

    const filtered = agents.filter((a) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return a.agent.toLowerCase().includes(q) || a.capabilities.some((c) => c.toLowerCase().includes(q));
    });

    if (selectedAgent) {
        return (
            <AgentDetailPanel
                agent={selectedAgent}
                onBack={() => setSelectedAgent(null)}
                onInviteChat={() => { setSelectedAgent(null); onNavigateToChat?.(); }}
            />
        );
    }

    return (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#16161A' }}>Discover Agents</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <DataSourceLabel source={dataSource} />
                    {isDaemonConnected && (
                        <span style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '9999px', background: '#D1FAE5', color: '#059669', border: '1px solid #10B981' }}>
                            Daemon Connected
                        </span>
                    )}
                </div>
            </div>
            <input
                placeholder="Search agents or capabilities..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                    width: '100%',
                    background: '#FFFFFF',
                    border: '1.5px solid #16161A',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '14px',
                    color: '#16161A',
                    outline: 'none',
                }}
            />
            {loading && <p style={{ color: '#16161A', opacity: 0.5, fontSize: '14px' }}>Loading...</p>}
            {!loading && agents.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                    <p style={{ color: '#16161A', opacity: 0.5 }}>No agents found.</p>
                </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filtered.map((row, i) => (
                    <button
                        key={row.agent}
                        onClick={() => setSelectedAgent(row)}
                        style={{
                            width: '100%',
                            textAlign: 'left',
                            background: '#FFFFFF',
                            borderRadius: '12px',
                            padding: '16px',
                            border: '1.5px solid #16161A',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.15s ease',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                background: '#C6BBFF',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                color: '#16161A',
                                border: '1.5px solid #16161A',
                            }}>{row.agent[0]}</div>
                            <div>
                                <p style={{ fontWeight: 600, color: '#16161A', fontSize: '15px', margin: '0 0 4px 0' }}>{row.agent}</p>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {row.capabilities.slice(0, 3).map((cap) => (
                                        <span key={cap} style={{
                                            padding: '2px 8px',
                                            borderRadius: '9999px',
                                            background: '#F3F3F8',
                                            border: '1px solid #16161A',
                                            fontSize: '10px',
                                            fontWeight: 500,
                                            color: '#16161A',
                                        }}>{cap}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ fontSize: '20px', fontWeight: 700, color: '#16161A', margin: '0 0 2px 0' }}>
                                {row.reputation?.global_avg_score?.toFixed(0) ?? '--'}
                            </p>
                            <p style={{ fontSize: '10px', color: '#16161A', opacity: 0.5, margin: 0 }}>
                                {row.reputation?.global_completed ?? 0} tasks
                            </p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Agent Detail Panel ───────────────────────────────────────────────

function AgentDetailPanel({
    agent,
    onBack,
    onInviteChat,
}: {
    agent: AgentDetailData;
    onBack: () => void;
    onInviteChat: () => void;
}) {
    const rep = agent.reputation;
    return (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', height: '100%' }}>
            {/* Back button */}
            <button
                onClick={onBack}
                style={{
                    alignSelf: 'flex-start',
                    padding: '6px 14px',
                    background: '#F3F3F8',
                    border: '1.5px solid #16161A',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#16161A',
                    cursor: 'pointer',
                }}
            >
                ← Back to Discover
            </button>

            {/* Header */}
            <div style={{
                background: '#C6BBFF',
                borderRadius: '24px',
                padding: '32px',
                border: '1.5px solid #16161A',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '24px',
            }}>
                <div style={{
                    width: '72px',
                    height: '72px',
                    background: '#FFFFFF',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    fontWeight: 700,
                    color: '#16161A',
                    border: '2px solid #16161A',
                    flexShrink: 0,
                }}>{agent.agent[0]}</div>
                <div style={{ flex: 1 }}>
                    <h2 style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontSize: '28px',
                        fontWeight: 700,
                        color: '#16161A',
                        margin: '0 0 8px 0',
                    }}>{agent.agent}</h2>
                    <p style={{ fontSize: '14px', color: '#16161A', opacity: 0.8, lineHeight: 1.5, margin: 0 }}>
                        {agent.bio}
                    </p>
                    <p style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: '#16161A',
                        opacity: 0.5,
                        marginTop: '8px',
                    }}>
                        {agent.walletAddress}
                    </p>
                </div>
            </div>

            {/* Capabilities */}
            <div style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                padding: '20px',
                border: '1.5px solid #16161A',
            }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#16161A', margin: '0 0 12px 0' }}>Capabilities</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {agent.capabilities.map((cap) => (
                        <span key={cap} style={{
                            padding: '6px 14px',
                            borderRadius: '9999px',
                            background: '#C6BBFF',
                            border: '1.5px solid #16161A',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#16161A',
                        }}>{cap}</span>
                    ))}
                </div>
            </div>

            {/* Reputation */}
            <div style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                padding: '20px',
                border: '1.5px solid #16161A',
            }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#16161A', margin: '0 0 12px 0' }}>Reputation</h3>
                {rep ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                        <Stat label="Avg Score" value={rep.global_avg_score.toFixed(1)} />
                        <Stat label="Completed" value={String(rep.global_completed)} />
                        <Stat label="Win Rate" value={`${(rep.win_rate * 100).toFixed(0)}%`} />
                        <Stat label="Weight" value={String(agent.weight)} />
                    </div>
                ) : (
                    <p style={{ fontSize: '14px', color: '#16161A', opacity: 0.5 }}>No reputation data yet.</p>
                )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px' }}>
                <button
                    onClick={onInviteChat}
                    style={{
                        flex: 1,
                        padding: '14px',
                        background: '#16161A',
                        color: '#FFFFFF',
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                    }}
                >
                    Invite to Chat
                </button>
                <button
                    style={{
                        flex: 1,
                        padding: '14px',
                        background: '#CDFF4D',
                        color: '#16161A',
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: 600,
                        border: '1.5px solid #16161A',
                        cursor: 'pointer',
                    }}
                >
                    Delegate Task
                </button>
            </div>
        </div>
    );
}

// ── Me ───────────────────────────────────────────────────────────────

function MeView({
    address,
    masterWallet,
    loginEmail,
    selectedWallet,
    owsBinding,
    bindingStatus,
    bindingBusy,
    bindingError,
    providerAvailable,
    onBindOWS,
    onUnbindOWS,
    activeSubWallet,
    subWallets,
    routerError,
    onCreateSubWallet,
    onSetActiveSubWallet,
    isPasskeyProtected,
}: {
    address: string | null;
    masterWallet: string | null;
    loginEmail: string | null;
    selectedWallet: SolanaWalletCandidate | null;
    owsBinding: OWSAgentWalletBinding | null;
    bindingStatus: 'bound' | 'wallet_changed' | 'unbound';
    bindingBusy: boolean;
    bindingError: string | null;
    providerAvailable: boolean;
    onBindOWS: () => OWSAgentWalletBinding | null;
    onUnbindOWS: () => void;
    activeSubWallet: OWSAgentSubWallet | null;
    subWallets: OWSAgentSubWallet[];
    routerError: string | null;
    onCreateSubWallet: (handle: string) => unknown;
    onSetActiveSubWallet: (subWalletId: string | null) => unknown;
    isPasskeyProtected: (address: string) => boolean;
}) {
    const [rep, setRep] = useState<ReputationData | null>(null);
    const [loading, setLoading] = useState(false);
    const [newSubWalletHandle, setNewSubWalletHandle] = useState('');

    useEffect(() => {
        if (!address) return;
        setLoading(true);
        fetch(`${resolveIndexerBase()}/api/agents/${address}/reputation`, {
            signal: getTimeoutSignal(5000),
        })
            .then((r) => r.ok ? r.json() : null)
            .then((data) => setRep(data as ReputationData | null))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [address]);

    return (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', height: '100%' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#16161A' }}>My Agent</h2>
            <RegisterAgentSection address={address} />
            <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '24px', border: '1.5px solid #16161A' }}>
                <p style={{ fontSize: '14px', color: '#16161A', opacity: 0.6, fontFamily: 'monospace' }}>{address}</p>
            </div>
            <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '24px', border: '1.5px solid #16161A' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#16161A', marginBottom: '8px' }}>Wallet Binding</h3>
                <p style={{ fontSize: '14px', color: '#16161A', opacity: 0.6 }}>Login: {loginEmail ?? 'Google OAuth'}</p>
                <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5, marginTop: '4px' }}>
                    Active Agent Wallet: {selectedWallet?.address ?? address ?? 'N/A'}
                </p>
                <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5 }}>
                    Source: {selectedWallet?.connectorType === 'embedded' ? 'Privy Embedded Wallet' : 'External Wallet'}
                </p>
                <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5 }}>
                    OWS provider: {providerAvailable ? 'detected' : 'not detected (local persistence mode)'}
                </p>
                <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.8, marginTop: '4px' }}>
                    Binding status: {formatBindingStatus(bindingStatus)}
                </p>
                {owsBinding && (
                    <div style={{ fontSize: '12px', color: '#16161A', opacity: 0.5, marginTop: '4px' }}>
                        <p>OWS DID: {owsBinding.owsDid}</p>
                        <p>Agent Wallet ID: {owsBinding.agentWalletId}</p>
                        <p>Master Wallet: {owsBinding.masterWallet}</p>
                    </div>
                )}
                {bindingError && <p style={{ fontSize: '12px', color: '#dc2626' }}>{bindingError}</p>}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                        onClick={onBindOWS}
                        disabled={!address || bindingBusy}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            background: (!address || bindingBusy) ? '#F3F3F8' : '#16161A',
                            color: (!address || bindingBusy) ? '#16161A' : '#FFFFFF',
                            fontSize: '12px',
                            border: '1.5px solid #16161A',
                            cursor: (!address || bindingBusy) ? 'not-allowed' : 'pointer',
                            opacity: (!address || bindingBusy) ? 0.5 : 1,
                        }}
                    >
                        {bindingBusy ? 'Binding...' : 'Bind Selected Wallet to OWS'}
                    </button>
                    {owsBinding && (
                        <button
                            onClick={onUnbindOWS}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                background: '#F3F3F8',
                                color: '#16161A',
                                fontSize: '12px',
                                border: '1.5px solid #16161A',
                                cursor: 'pointer',
                            }}
                        >
                            Unbind
                        </button>
                    )}
                </div>
            </div>
            <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '24px', border: '1.5px solid #16161A' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#16161A', marginBottom: '8px' }}>Agent Sub-Wallet Routing</h3>
                <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5 }}>
                    Master wallet: {masterWallet ?? 'N/A'} (Privy-controlled). Sub-wallets route signing through master policy.
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <input
                        value={newSubWalletHandle}
                        onChange={(event) => setNewSubWalletHandle(event.target.value)}
                        placeholder="agent handle (e.g. scout-agent)"
                        style={{
                            flex: 1,
                            background: '#F3F3F8',
                            border: '1.5px solid #16161A',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            fontSize: '14px',
                            color: '#16161A',
                        }}
                    />
                    <button
                        onClick={() => {
                            if (!newSubWalletHandle.trim()) return;
                            onCreateSubWallet(newSubWalletHandle);
                            setNewSubWalletHandle('');
                        }}
                        disabled={!owsBinding}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: !owsBinding ? '#F3F3F8' : '#C6BBFF',
                            color: '#16161A',
                            fontSize: '12px',
                            border: '1.5px solid #16161A',
                            cursor: !owsBinding ? 'not-allowed' : 'pointer',
                            opacity: !owsBinding ? 0.5 : 1,
                        }}
                    >
                        Create Sub-Wallet
                    </button>
                </div>
                {routerError && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '8px' }}>{routerError}</p>}
                {subWallets.length === 0 ? (
                    <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5, marginTop: '8px' }}>No sub-wallets yet. Create one after OWS binding.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                        {subWallets.map((wallet) => (
                            <button
                                key={wallet.id}
                                onClick={() => onSetActiveSubWallet(wallet.id)}
                                style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    borderRadius: '8px',
                                    border: activeSubWallet?.id === wallet.id ? '1.5px solid #CDFF4D' : '1.5px solid #16161A',
                                    background: activeSubWallet?.id === wallet.id ? '#CDFF4D' : '#F3F3F8',
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <p style={{ fontSize: '14px', fontWeight: 500, color: '#16161A' }}>{wallet.handle}</p>
                                    {isPasskeyProtected(wallet.walletAddress) && (
                                        <span style={{ fontSize: '10px', background: '#CDFF4D', color: '#16161A', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>Passkey</span>
                                    )}
                                </div>
                                <p style={{ fontSize: '10px', color: '#16161A', opacity: 0.5, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {wallet.walletAddress}
                                </p>
                                <p style={{ fontSize: '10px', color: '#16161A', opacity: 0.5 }}>
                                    Route: {wallet.policy.strategy} · approval {wallet.policy.requireMasterApprovalAboveUsd} USD+
                                </p>
                            </button>
                        ))}
                        {activeSubWallet && (
                            <button
                                onClick={() => onSetActiveSubWallet(null)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    background: '#F3F3F8',
                                    color: '#16161A',
                                    fontSize: '12px',
                                    border: '1.5px solid #16161A',
                                    cursor: 'pointer',
                                }}
                            >
                                Use Master Wallet
                            </button>
                        )}
                    </div>
                )}
            </div>
            <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '24px', border: '1.5px solid #16161A' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#16161A', marginBottom: '16px' }}>Reputation</h3>
                {loading ? (
                    <p style={{ color: '#16161A', opacity: 0.5, fontSize: '14px' }}>Loading...</p>
                ) : rep ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <Stat label="Avg Score" value={rep.avg_score?.toFixed(1) ?? '--'} />
                        <Stat label="Completed" value={String(rep.completed ?? 0)} />
                        <Stat label="Win Rate" value={rep.win_rate ? `${(rep.win_rate * 100).toFixed(0)}%` : '--'} />
                        <Stat label="Earned" value={`${((rep.total_earned ?? 0) / 1e9).toFixed(4)} SOL`} />
                    </div>
                ) : (
                    <p style={{ color: '#16161A', opacity: 0.5, fontSize: '14px' }}>No reputation data yet. Complete tasks to build your on-chain reputation.</p>
                )}
            </div>
        </div>
    );
}

// ── Wallet Balance ──────────────────────────────────────────────────────────

function WalletBalance({ address }: { address: string }) {
    const [balance, setBalance] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBalance = async () => {
        if (!address) return;
        setLoading(true);
        setError(null);
        try {
            const rpcEndpoint = getRpcEndpoint();
            const connection = new Connection(rpcEndpoint, 'confirmed');
            const publicKey = new PublicKey(address);
            const balanceInLamports = await connection.getBalance(publicKey);
            setBalance(balanceInLamports / LAMPORTS_PER_SOL);
        } catch (err) {
            console.error('Failed to fetch balance:', err);
            setError('Failed to load balance');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBalance();
    }, [address]);

    return (
        <div className="mt-2 flex items-center justify-between">
            <div>
                {loading && <p className="text-xs text-gray-500">Loading...</p>}
                {error && <p className="text-xs text-red-400">{error}</p>}
                {!loading && !error && balance !== null && (
                    <p className="text-xs font-mono text-emerald-400">{balance.toFixed(3)} SOL</p>
                )}
            </div>
            <button
                onClick={fetchBalance}
                disabled={loading}
                className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-50 transition"
                title="Refresh balance"
            >
                ↻
            </button>
        </div>
    );
}

// ── Settings View ──────────────────────────────────────────────────────────

interface SettingsData {
    rpcEndpoint: string;
    indexerUrl: string;
    theme: 'dark' | 'light';
}

function SettingsView() {
    const [settings, setSettings] = useState<SettingsData>(() => {
        if (typeof window === 'undefined') {
            return {
                rpcEndpoint: 'https://api.devnet.solana.com',
                indexerUrl: 'http://localhost:3001',
                theme: 'dark',
            };
        }
        const stored = localStorage.getItem('agentm:settings');
        const parsed = stored ? JSON.parse(stored) : {};
        return {
            rpcEndpoint: parsed.rpcEndpoint || 'https://api.devnet.solana.com',
            indexerUrl: parsed.indexerUrl || 'http://localhost:3001',
            theme: parsed.theme || 'dark',
        };
    });

    const [saved, setSaved] = useState(false);

    const saveSettings = () => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('agentm:settings', JSON.stringify(settings));
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }
    };

    const updateSetting = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', height: '100%' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#16161A' }}>Settings</h2>
            
            <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '24px', border: '1.5px solid #16161A', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#16161A' }}>Network Configuration</h3>
                
                <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#16161A', marginBottom: '8px' }}>
                        RPC Endpoint
                    </label>
                    <select
                        value={settings.rpcEndpoint}
                        onChange={(e) => updateSetting('rpcEndpoint', e.target.value)}
                        style={{
                            width: '100%',
                            background: '#F3F3F8',
                            border: '1.5px solid #16161A',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            fontSize: '14px',
                            color: '#16161A',
                            outline: 'none',
                        }}
                    >
                        <option value="https://api.devnet.solana.com">Devnet (Default)</option>
                        <option value="https://api.mainnet-beta.solana.com">Mainnet Beta</option>
                        <option value="https://api.testnet.solana.com">Testnet</option>
                        <option value="http://127.0.0.1:8899">Local Validator</option>
                    </select>
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#16161A', marginBottom: '8px' }}>
                        Indexer URL
                    </label>
                    <input
                        type="text"
                        value={settings.indexerUrl}
                        onChange={(e) => updateSetting('indexerUrl', e.target.value)}
                        placeholder="http://localhost:3001"
                        style={{
                            width: '100%',
                            background: '#F3F3F8',
                            border: '1.5px solid #16161A',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            fontSize: '14px',
                            color: '#16161A',
                            outline: 'none',
                        }}
                    />
                </div>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '24px', border: '1.5px solid #16161A', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#16161A' }}>Appearance</h3>
                
                <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#16161A', marginBottom: '8px' }}>
                        Theme
                    </label>
                    <select
                        value={settings.theme}
                        onChange={(e) => updateSetting('theme', e.target.value as 'dark' | 'light')}
                        style={{
                            width: '100%',
                            background: '#F3F3F8',
                            border: '1.5px solid #16161A',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            fontSize: '14px',
                            color: '#16161A',
                            outline: 'none',
                        }}
                    >
                        <option value="dark">Dark (Current)</option>
                        <option value="light" disabled>Light (Coming Soon)</option>
                    </select>
                    <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5, marginTop: '4px' }}>Light theme will be available in a future update</p>
                </div>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '24px', border: '1.5px solid #16161A' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#16161A', marginBottom: '12px' }}>About</h3>
                <div style={{ fontSize: '14px', color: '#16161A', opacity: 0.6, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <p>AgentM Web v1.0.0</p>
                    <p>AI Agent Economy on Solana</p>
                    <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.4, marginTop: '8px' }}>Settings are stored locally in your browser</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
                <button
                    onClick={saveSettings}
                    style={{
                        padding: '8px 24px',
                        background: '#16161A',
                        color: '#FFFFFF',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        border: '1.5px solid #16161A',
                        cursor: 'pointer',
                    }}
                >
                    {saved ? '✓ Saved' : 'Save Settings'}
                </button>
                <button
                    onClick={() => {
                        const defaults: SettingsData = {
                            rpcEndpoint: 'https://api.devnet.solana.com',
                            indexerUrl: 'http://localhost:3001',
                            theme: 'dark',
                        };
                        setSettings(defaults);
                    }}
                    style={{
                        padding: '8px 24px',
                        background: '#F3F3F8',
                        color: '#16161A',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        border: '1.5px solid #16161A',
                        cursor: 'pointer',
                    }}
                >
                    Reset to Defaults
                </button>
            </div>
        </div>
    );
}

function TaskDetailModal({
    task,
    onClose,
    address,
}: {
    task: TaskData;
    onClose: () => void;
    address: string | null;
}) {
    const [applying, setApplying] = useState(false);
    const [applyError, setApplyError] = useState<string | null>(null);

    const isConnected = !!address;
    const isOpen = task.state === 'Open';

    async function handleApply() {
        setApplying(true);
        setApplyError(null);
        try {
            const res = await fetch(`${resolveIndexerBase()}/api/tasks/${task.task_id}/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applicant: address }),
                signal: getTimeoutSignal(10000),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => 'Apply failed');
                throw new Error(text);
            }
            onClose();
        } catch (err) {
            setApplyError(err instanceof Error ? err.message : 'Apply failed');
        } finally {
            setApplying(false);
        }
    }

    function copyPoster() {
        if (task.poster) {
            navigator.clipboard.writeText(task.poster).catch(() => {});
        }
    }

    const rewardSol = (task.reward_lamports / 1e9).toFixed(4);
    const deadlineDate = new Date(task.deadline * 1000);
    const deadlineText = deadlineDate.toLocaleString();

    const stateBadge = (() => {
        const baseStyle: React.CSSProperties = {
            padding: '2px 8px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 500,
            border: '1.5px solid #16161A',
        };
        switch (task.state) {
            case 'Open': return <span style={{ ...baseStyle, background: '#CDFF4D', color: '#16161A' }}>Open</span>;
            case 'InProgress': return <span style={{ ...baseStyle, background: '#C6BBFF', color: '#16161A' }}>In Progress</span>;
            case 'Judging': return <span style={{ ...baseStyle, background: '#FEF3C7', color: '#16161A' }}>Judging</span>;
            case 'Settled': return <span style={{ ...baseStyle, background: '#F3F3F8', color: '#16161A' }}>Settled</span>;
            case 'Cancelled': return <span style={{ ...baseStyle, background: '#FEE2E2', color: '#DC2626' }}>Cancelled</span>;
            default: return <span style={{ ...baseStyle, background: '#F3F3F8', color: '#16161A' }}>{task.state}</span>;
        }
    })();

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(243, 243, 248, 0.85)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
            <div style={{
                position: 'relative',
                zIndex: 10,
                width: '100%',
                height: '100%',
                maxWidth: '672px',
                maxHeight: '85vh',
                borderRadius: '16px',
                background: '#FFFFFF',
                border: '1.5px solid #16161A',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1.5px solid #16161A' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#16161A' }}>Task Details</h3>
                    <button onClick={onClose} style={{ color: '#16161A', opacity: 0.6, cursor: 'pointer' }} aria-label="Close">
                        ✕
                    </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {stateBadge}
                        <span style={{ fontSize: '12px', color: '#16161A', opacity: 0.5 }}>{task.submissions_count} submission{task.submissions_count === 1 ? '' : 's'}</span>
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Description</p>
                        <p style={{ fontSize: '14px', color: '#16161A', whiteSpace: 'pre-wrap' }}>{task.description}</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{ background: '#F3F3F8', border: '1.5px solid #16161A', borderRadius: '8px', padding: '12px' }}>
                            <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5, marginBottom: '4px' }}>Poster</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '14px', fontFamily: 'monospace', color: '#16161A' }}>{task.poster.slice(0, 6)}...{task.poster.slice(-4)}</span>
                                <button onClick={copyPoster} style={{ fontSize: '10px', padding: '2px 8px', background: '#FFFFFF', border: '1.5px solid #16161A', borderRadius: '4px', color: '#16161A', cursor: 'pointer' }}>Copy</button>
                            </div>
                        </div>
                        <div style={{ background: '#F3F3F8', border: '1.5px solid #16161A', borderRadius: '8px', padding: '12px' }}>
                            <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5, marginBottom: '4px' }}>Category</p>
                            <p style={{ fontSize: '14px', color: '#16161A' }}>{task.category}</p>
                        </div>
                        <div style={{ background: '#F3F3F8', border: '1.5px solid #16161A', borderRadius: '8px', padding: '12px' }}>
                            <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5, marginBottom: '4px' }}>Reward</p>
                            <p style={{ fontSize: '14px', fontWeight: 500, color: '#16161A' }}>{rewardSol} SOL</p>
                        </div>
                        <div style={{ background: '#F3F3F8', border: '1.5px solid #16161A', borderRadius: '8px', padding: '12px' }}>
                            <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5, marginBottom: '4px' }}>Deadline</p>
                            <p style={{ fontSize: '14px', color: '#16161A' }}>{deadlineText}</p>
                        </div>
                    </div>
                    {applyError && <p style={{ fontSize: '12px', color: '#DC2626' }}>{applyError}</p>}
                    {isOpen && isConnected && (
                        <button
                            onClick={handleApply}
                            disabled={applying}
                            style={{
                                width: '100%',
                                padding: '10px 16px',
                                background: applying ? '#F3F3F8' : '#16161A',
                                color: applying ? '#16161A' : '#FFFFFF',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 500,
                                border: '1.5px solid #16161A',
                                cursor: applying ? 'not-allowed' : 'pointer',
                                opacity: applying ? 0.5 : 1,
                            }}
                        >
                            {applying ? 'Applying...' : 'Apply for Task'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Post Task Form ───────────────────────────────────────────────────

const TASK_CATEGORIES = [
    'DeFi Analysis',
    'Smart Contract Audit',
    'Data Processing',
    'Content Creation',
    'Trading Strategy',
    'Other',
] as const;

type TaskCategory = (typeof TASK_CATEGORIES)[number];

interface PostedTask {
    id: string;
    description: string;
    category: TaskCategory;
    rewardSol: number;
    deadline: string;
    poster: string;
    createdAt: string;
}

function PostTaskForm({ onTaskPosted }: { onTaskPosted?: (task: PostedTask) => void }) {
    const { primaryWallet } = useDynamicContext();
    const poster = primaryWallet?.address ?? null;

    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<TaskCategory>('DeFi Analysis');
    const [rewardSol, setRewardSol] = useState('');
    const [deadline, setDeadline] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 1);
    const minDateStr = minDate.toISOString().split('T')[0]!;

    function showToast(message: string, type: 'success' | 'error') {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        const trimmedDesc = description.trim();
        if (!trimmedDesc) { showToast('Task description is required.', 'error'); return; }
        const rewardNum = parseFloat(rewardSol);
        if (isNaN(rewardNum) || rewardNum < 0.01) { showToast('Reward must be at least 0.01 SOL.', 'error'); return; }
        if (!deadline || deadline < minDateStr) { showToast('Deadline must be a future date.', 'error'); return; }

        setSubmitting(true);

        const payload = {
            description: trimmedDesc,
            category,
            rewardSol: rewardNum,
            deadline,
            poster: poster ?? 'anonymous',
            createdAt: new Date().toISOString(),
        };

        const resetForm = () => {
            setDescription('');
            setRewardSol('');
            setDeadline('');
            setCategory('DeFi Analysis');
        };

        try {
            const res = await fetch(`${resolveIndexerBase()}/api/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: getTimeoutSignal(8000),
            });

            if (!res.ok) throw new Error(`Server error: ${res.status}`);

            const created = (await res.json()) as PostedTask;
            onTaskPosted?.(created);
            showToast('Task posted successfully!', 'success');
            resetForm();
        } catch {
            // Indexer offline — fall back to local state
            const localTask: PostedTask = { id: crypto.randomUUID(), ...payload };
            onTaskPosted?.(localTask);
            showToast('Indexer offline — task saved locally.', 'success');
            resetForm();
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1.5px solid #16161A', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#16161A' }}>Post a Task</h3>

            {toast && (
                <div style={{
                    borderRadius: '8px',
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: 500,
                    background: toast.type === 'success' ? '#D1FAE5' : '#FEE2E2',
                    border: `1.5px solid ${toast.type === 'success' ? '#10B981' : '#DC2626'}`,
                    color: toast.type === 'success' ? '#059669' : '#DC2626',
                }}>
                    {toast.message}
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#16161A', marginBottom: '6px' }}>
                        Task Description <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe the task in detail..."
                        rows={4}
                        required
                        style={{
                            width: '100%',
                            background: '#F3F3F8',
                            border: '1.5px solid #16161A',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            fontSize: '14px',
                            color: '#16161A',
                            outline: 'none',
                            resize: 'none',
                        }}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#16161A', marginBottom: '6px' }}>Category</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as TaskCategory)}
                            style={{
                                width: '100%',
                                background: '#F3F3F8',
                                border: '1.5px solid #16161A',
                                borderRadius: '8px',
                                padding: '10px 12px',
                                fontSize: '14px',
                                color: '#16161A',
                                outline: 'none',
                            }}
                        >
                            {TASK_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#16161A', marginBottom: '6px' }}>
                            Reward (SOL) <span style={{ color: '#16161A', opacity: 0.5, fontWeight: 400 }}>min 0.01</span>
                        </label>
                        <input
                            type="number"
                            value={rewardSol}
                            onChange={(e) => setRewardSol(e.target.value)}
                            placeholder="0.10"
                            min="0.01"
                            step="0.01"
                            required
                            style={{
                                width: '100%',
                                background: '#F3F3F8',
                                border: '1.5px solid #16161A',
                                borderRadius: '8px',
                                padding: '10px 12px',
                                fontSize: '14px',
                                color: '#16161A',
                                outline: 'none',
                            }}
                        />
                    </div>
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#16161A', marginBottom: '6px' }}>Deadline</label>
                    <input
                        type="date"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        min={minDateStr}
                        required
                        style={{
                            width: '100%',
                            background: '#F3F3F8',
                            border: '1.5px solid #16161A',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            fontSize: '14px',
                            color: '#16161A',
                            outline: 'none',
                        }}
                    />
                </div>

                {poster && (
                    <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5, fontFamily: 'monospace' }}>
                        Posting as: {poster.slice(0, 8)}...{poster.slice(-4)}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        background: submitting ? '#F3F3F8' : '#16161A',
                        color: submitting ? '#16161A' : '#FFFFFF',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        border: '1.5px solid #16161A',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        opacity: submitting ? 0.5 : 1,
                    }}
                >
                    {submitting ? (
                        <>
                            <svg style={{ animation: 'spin 1s linear infinite', height: '16px', width: '16px' }} viewBox="0 0 24 24" fill="none">
                                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                            </svg>
                            Posting...
                        </>
                    ) : (
                        'Post Task'
                    )}
                </button>
            </form>
        </div>
    );
}

// ── Helpers ──────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ background: '#F3F3F8', borderRadius: '8px', padding: '12px', border: '1.5px solid #16161A' }}>
            <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5 }}>{label}</p>
            <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#16161A' }}>{value}</p>
        </div>
    );
}

function Loading() {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#16161A', opacity: 0.5 }}>Loading...</div>;
}

function formatBindingStatus(status: 'bound' | 'wallet_changed' | 'unbound'): string {
    if (status === 'bound') return 'bound';
    if (status === 'wallet_changed') return 'wallet changed (rebind required)';
    return 'unbound';
}

function resolveIndexerBase(): string {
    // 1. Check localStorage settings (user-configured indexer URL)
    if (typeof window !== 'undefined') {
        try {
            const stored = window.localStorage.getItem('agentm:settings');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.indexerUrl && typeof parsed.indexerUrl === 'string') {
                    return trimTrailingSlash(parsed.indexerUrl);
                }
            }
        } catch {}
    }
    // 2. Check env var
    if (INDEXER_BASE) {
        return trimTrailingSlash(INDEXER_BASE);
    }
    // 3. Localhost default
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://127.0.0.1:3001';
    }
    return trimTrailingSlash(window.location.origin);
}

function getTimeoutSignal(timeoutMs: number): AbortSignal | undefined {
    const timeoutFactory = (
        AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }
    ).timeout;
    if (typeof timeoutFactory !== 'function') {
        return undefined;
    }
    return timeoutFactory(timeoutMs);
}

// ── Indexer Status Hook & Indicator ───────────────────────────────────

type IndexerConnectionStatus = 'checking' | 'connected' | 'disconnected';

function useIndexerStatus(): { status: IndexerConnectionStatus; indexerUrl: string } {
    const [status, setStatus] = useState<IndexerConnectionStatus>('checking');
    const indexerUrl = typeof window !== 'undefined' ? resolveIndexerBase() : '';

    useEffect(() => {
        if (!indexerUrl) { setStatus('disconnected'); return; }
        let cancelled = false;
        const check = () => {
            fetch(`${indexerUrl}/api/tasks`, { signal: getTimeoutSignal(3000) })
                .then((r) => { if (!cancelled) setStatus(r.ok ? 'connected' : 'disconnected'); })
                .catch(() => { if (!cancelled) setStatus('disconnected'); });
        };
        check();
        const interval = setInterval(check, 30000); // re-check every 30s
        return () => { cancelled = true; clearInterval(interval); };
    }, [indexerUrl]);

    return { status, indexerUrl };
}

function IndexerStatusBadge({ status, url }: { status: IndexerConnectionStatus; url: string }) {
    const colors = {
        checking: { background: '#FEF3C7', color: '#D97706', border: '#F59E0B' },
        connected: { background: '#D1FAE5', color: '#059669', border: '#10B981' },
        disconnected: { background: '#FEE2E2', color: '#DC2626', border: '#EF4444' },
    };
    const labels = {
        checking: '● Checking...',
        connected: '● Indexer Connected',
        disconnected: '○ Indexer Offline',
    };
    const style = colors[status];
    return (
        <span 
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '9999px',
                fontSize: '10px',
                fontWeight: 500,
                background: style.background,
                color: style.color,
                border: `1px solid ${style.border}`,
            }}
            title={url}
        >
            {labels[status]}
        </span>
    );
}

function DataSourceLabel({ source }: { source: 'indexer' | 'demo' | 'mock' | 'daemon' }) {
    const style = (source === 'indexer' || source === 'daemon')
        ? { background: '#D1FAE5', color: '#059669', border: '#10B981' }
        : { background: '#FEF3C7', color: '#D97706', border: '#F59E0B' };
    const label = source === 'daemon' ? 'Daemon Live' : source === 'indexer' ? 'Live Data' : source === 'demo' ? 'Demo Data' : 'Mock Data';
    return (
        <span style={{
            fontSize: '10px',
            padding: '4px 8px',
            borderRadius: '9999px',
            background: style.background,
            color: style.color,
            border: `1px solid ${style.border}`,
        }}>
            {label}
        </span>
    );
}

// ── Task Market View ──────────────────────────────────────────────────

interface TaskData {
    task_id: string;
    poster: string;
    category: string;
    description: string;
    reward_lamports: number;
    deadline: number;
    state: 'Open' | 'InProgress' | 'Judging' | 'Settled' | 'Cancelled';
    submissions_count: number;
}

const MOCK_TASKS: TaskData[] = [
    { task_id: 'task_001', poster: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', category: 'DeFi Analysis', description: 'Analyze yield farming strategies on Raydium and provide risk assessment for the top 5 pools by TVL.', reward_lamports: 5_000_000_000, deadline: Math.floor(Date.now() / 1000) + 86400 * 3, state: 'Open', submissions_count: 0 },
    { task_id: 'task_002', poster: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', category: 'Smart Contract Audit', description: 'Security audit of a Solana token vesting contract. Check for reentrancy, overflow, and access control issues.', reward_lamports: 15_000_000_000, deadline: Math.floor(Date.now() / 1000) + 86400 * 7, state: 'Open', submissions_count: 2 },
    { task_id: 'task_003', poster: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', category: 'Data Processing', description: 'Parse and index all NFT metadata from Magic Eden for Solana Monkey Business collection.', reward_lamports: 3_000_000_000, deadline: Math.floor(Date.now() / 1000) + 86400 * 2, state: 'InProgress', submissions_count: 1 },
    { task_id: 'task_004', poster: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', category: 'Trading Strategy', description: 'Backtest a momentum strategy on SOL/USDC with 6 months of data. Report Sharpe ratio and max drawdown.', reward_lamports: 8_000_000_000, deadline: Math.floor(Date.now() / 1000) + 86400 * 5, state: 'Open', submissions_count: 0 },
    { task_id: 'task_005', poster: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH', category: 'Content Creation', description: 'Write a technical deep-dive blog post about Gradience Protocol settlement mechanics, 2000+ words.', reward_lamports: 2_000_000_000, deadline: Math.floor(Date.now() / 1000) + 86400 * 4, state: 'Judging', submissions_count: 3 },
    { task_id: 'task_006', poster: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', category: 'Code Review', description: 'Review Anchor program for a new lending protocol. Focus on math precision and liquidation logic.', reward_lamports: 10_000_000_000, deadline: Math.floor(Date.now() / 1000) - 86400, state: 'Settled', submissions_count: 2 },
    { task_id: 'task_007', poster: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', category: 'DeFi Analysis', description: 'Compare Marinade vs Jito staking: APY analysis, risk factors, liquidity depth.', reward_lamports: 4_000_000_000, deadline: Math.floor(Date.now() / 1000) + 86400 * 6, state: 'Open', submissions_count: 1 },
    { task_id: 'task_008', poster: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH', category: 'Smart Contract Audit', description: 'Audit a cross-chain bridge contract using Wormhole. Check for relay manipulation and fund extraction.', reward_lamports: 20_000_000_000, deadline: Math.floor(Date.now() / 1000) + 86400 * 10, state: 'Open', submissions_count: 0 },
];

const STATE_COLORS: Record<string, { background: string; color: string }> = {
    Open: { background: '#D1FAE5', color: '#059669' },
    InProgress: { background: '#FEF3C7', color: '#D97706' },
    Judging: { background: '#E0E7FF', color: '#4F46E5' },
    Settled: { background: '#DBEAFE', color: '#2563EB' },
    Cancelled: { background: '#FEE2E2', color: '#DC2626' },
};

function TaskMarketView({ address }: { address: string | null }) {
    const [tasks, setTasks] = useState<TaskData[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');
    const [showPostForm, setShowPostForm] = useState(false);
    const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
    const [dataSource, setDataSource] = useState<'daemon' | 'mock'>('mock');
    const { apiCall, isConnected: isDaemonConnected } = useDaemonApi();
    const { status: indexerStatus, indexerUrl } = useIndexerStatus();

    useEffect(() => {
        async function fetchTasks() {
            // Try Daemon API first
            if (isDaemonConnected) {
                const result = await apiCall<{ tasks: TaskData[]; total: number }>('/api/v1/tasks');
                if (result?.tasks && result.tasks.length > 0) {
                    setTasks(result.tasks);
                    setDataSource('daemon');
                    setLoading(false);
                    return;
                }
            }
            // Fall back to mock data
            setTasks(MOCK_TASKS);
            setDataSource('mock');
            setLoading(false);
        }
        fetchTasks();
    }, [isDaemonConnected, apiCall]);

    const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.state === filter);

    return (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#16161A' }}>Task Market</h2>
                    <DataSourceLabel source={dataSource} />
                    <IndexerStatusBadge status={indexerStatus} url={indexerUrl} />
                </div>
                {address && (
                    <button
                        onClick={() => setShowPostForm(!showPostForm)}
                        style={{
                            padding: '8px 16px',
                            background: '#16161A',
                            color: '#FFFFFF',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: 500,
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        {showPostForm ? 'Close' : '+ Post Task'}
                    </button>
                )}
            </div>

            {/* Post Task Form (collapsible) */}
            {showPostForm && address && (
                <div style={{ background: '#FFFFFF', border: '1.5px solid #16161A', borderRadius: '12px', padding: '20px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#16161A', marginBottom: '16px' }}>Post a New Task</h3>
                    <QuickPostTaskForm
                        address={address}
                        onPosted={(task) => {
                            setTasks((prev) => [task, ...prev]);
                            setShowPostForm(false);
                        }}
                    />
                </div>
            )}

            {/* Filters */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['all', 'Open', 'InProgress', 'Judging', 'Settled'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{
                            padding: '4px 12px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            background: filter === f ? '#16161A' : '#F3F3F8',
                            color: filter === f ? '#FFFFFF' : '#16161A',
                            border: '1.5px solid #16161A',
                            cursor: 'pointer',
                        }}
                    >
                        {f === 'all' ? 'All' : f} {f !== 'all' && `(${tasks.filter((t) => t.state === f).length})`}
                    </button>
                ))}
            </div>

            {/* Task List */}
            {loading && <p style={{ color: '#16161A', opacity: 0.5, fontSize: '14px' }}>Loading tasks...</p>}
            {!loading && filtered.length === 0 && (
                <p style={{ color: '#16161A', opacity: 0.5, textAlign: 'center', padding: '48px 0' }}>No tasks found.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filtered.map((task) => {
                    const stateStyle = STATE_COLORS[task.state] ?? { background: '#F3F3F8', color: '#16161A' };
                    return (
                        <div
                            key={task.task_id}
                            onClick={() => setSelectedTask(task)}
                            style={{
                                background: '#FFFFFF',
                                border: '1.5px solid #16161A',
                                borderRadius: '12px',
                                padding: '16px',
                                cursor: 'pointer',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '10px',
                                            fontWeight: 500,
                                            background: stateStyle.background,
                                            color: stateStyle.color,
                                        }}>
                                            {task.state}
                                        </span>
                                        <span style={{ fontSize: '12px', color: '#16161A', opacity: 0.5 }}>{task.category}</span>
                                    </div>
                                    <p style={{ fontSize: '14px', color: '#16161A', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{task.description}</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px', fontSize: '12px', color: '#16161A', opacity: 0.5 }}>
                                        <span>By {task.poster.slice(0, 6)}...{task.poster.slice(-4)}</span>
                                        <span>{task.submissions_count} submissions</span>
                                        <span>Due {new Date(task.deadline * 1000).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#16161A' }}>{(task.reward_lamports / 1_000_000_000).toFixed(2)}</p>
                                    <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5 }}>SOL</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Task Detail Modal */}
            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    address={address}
                />
            )}
        </div>
    );
}

// ── Quick Post Task Form ──────────────────────────────────────────────

function QuickPostTaskForm({ address, onPosted }: { address: string; onPosted: (task: TaskData) => void }) {
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('DeFi Analysis');
    const [rewardSol, setRewardSol] = useState('1');
    const [deadlineDays, setDeadlineDays] = useState('7');
    const [posting, setPosting] = useState(false);
    const [escrowTx, setEscrowTx] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!description.trim()) return;
        setPosting(true);
        setEscrowTx(null);

        const rewardLamports = Math.round(parseFloat(rewardSol) * 1_000_000_000);
        const deadlineUnix = Math.floor(Date.now() / 1000) + parseInt(deadlineDays) * 86400;
        let taskId = `task_${Date.now()}`;
        let escrowSig: string | null = null;

        // Try on-chain escrow via Memo + SOL transfer
        try {
            const { buildTaskEscrowTx } = await import('../../lib/solana/escrow-task');
            const result = await buildTaskEscrowTx({
                description: description.trim(),
                category,
                rewardLamports,
                deadlineUnix,
                poster: address,
            });
            taskId = result.taskId;

            const connection = new Connection(getRpcEndpoint(), 'confirmed');
            // On-chain signing requires wallet connector - skip in demo
            // In production: sign via Dynamic wallet connector
            console.log('Task escrow tx built:', result.taskId);
        } catch (err) {
            console.warn('On-chain escrow skipped:', err);
        }

        const task: TaskData = {
            task_id: taskId,
            poster: address,
            category,
            description: description.trim(),
            reward_lamports: rewardLamports,
            deadline: deadlineUnix,
            state: 'Open',
            submissions_count: 0,
        };

        try {
            await fetch(`${resolveIndexerBase()}/api/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...task, escrowTx: escrowSig }),
                signal: getTimeoutSignal(3000),
            });
        } catch {}

        onPosted(task);
        setDescription('');
        setPosting(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <textarea
                placeholder="Describe your task..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{
                    width: '100%',
                    background: '#F3F3F8',
                    border: '1.5px solid #16161A',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '14px',
                    color: '#16161A',
                    resize: 'none',
                }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{
                        background: '#F3F3F8',
                        border: '1.5px solid #16161A',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '14px',
                        color: '#16161A',
                    }}
                >
                    {['DeFi Analysis', 'Smart Contract Audit', 'Data Processing', 'Content Creation', 'Trading Strategy', 'Code Review', 'Other'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
                <div style={{ position: 'relative' }}>
                    <input
                        type="number"
                        min="0.01"
                        step="0.1"
                        value={rewardSol}
                        onChange={(e) => setRewardSol(e.target.value)}
                        style={{
                            width: '100%',
                            background: '#F3F3F8',
                            border: '1.5px solid #16161A',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            fontSize: '14px',
                            color: '#16161A',
                            paddingRight: '48px',
                        }}
                    />
                    <span style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '12px', color: '#16161A', opacity: 0.5 }}>SOL</span>
                </div>
                <div style={{ position: 'relative' }}>
                    <input
                        type="number"
                        min="1"
                        max="90"
                        value={deadlineDays}
                        onChange={(e) => setDeadlineDays(e.target.value)}
                        style={{
                            width: '100%',
                            background: '#F3F3F8',
                            border: '1.5px solid #16161A',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            fontSize: '14px',
                            color: '#16161A',
                            paddingRight: '48px',
                        }}
                    />
                    <span style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '12px', color: '#16161A', opacity: 0.5 }}>days</span>
                </div>
            </div>
            <button
                onClick={handleSubmit}
                disabled={posting || !description.trim()}
                style={{
                    width: '100%',
                    padding: '10px',
                    background: posting || !description.trim() ? '#F3F3F8' : '#16161A',
                    color: posting || !description.trim() ? '#16161A' : '#FFFFFF',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    border: '1.5px solid #16161A',
                    cursor: posting || !description.trim() ? 'not-allowed' : 'pointer',
                    opacity: posting || !description.trim() ? 0.5 : 1,
                }}
            >
                {posting ? 'Posting...' : 'Post Task'}
            </button>
        </div>
    );
}

// ── Agent Registration ────────────────────────────────────────────────

const AGENT_CAPABILITIES = [
    'DeFi Analysis',
    'Smart Contract Audit',
    'Data Processing',
    'Content Creation',
    'Trading Strategy',
    'Code Review',
] as const;

type AgentCapability = (typeof AGENT_CAPABILITIES)[number];

interface AgentProfile {
    displayName: string;
    capabilities: AgentCapability[];
    bio: string;
    solDomain: string;
    walletAddress: string;
    reputationScore: number;
}

function RegisterAgentSection({ address }: { address: string | null }) {
    const storageKey = address ? `agentm:agent-profile:${address}` : null;

    const [profile, setProfile] = useState<AgentProfile | null>(() => {
        if (typeof window === 'undefined' || !storageKey) return null;
        try {
            const raw = window.localStorage.getItem(storageKey);
            return raw ? (JSON.parse(raw) as AgentProfile) : null;
        } catch {
            return null;
        }
    });

    const [displayName, setDisplayName] = useState('');
    const [capabilities, setCapabilities] = useState<AgentCapability[]>([]);
    const [bio, setBio] = useState('');
    const [solDomain, setSolDomain] = useState('');
    const [editing, setEditing] = useState(false);

    if (!address) return null;

    function toggleCapability(cap: AgentCapability) {
        setCapabilities((prev) =>
            prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap],
        );
    }

    const [registering, setRegistering] = useState(false);
    const [txSignature, setTxSignature] = useState<string | null>(() => {
        if (typeof window === 'undefined' || !storageKey) return null;
        return window.localStorage.getItem(`${storageKey}:tx`) ?? null;
    });

    async function handleRegister() {
        if (!displayName.trim()) return;
        setRegistering(true);
        const newProfile: AgentProfile = {
            displayName: displayName.trim(),
            capabilities,
            bio: bio.trim(),
            solDomain: solDomain.trim(),
            walletAddress: address!,
            reputationScore: 0,
        };
        // Save to localStorage
        if (storageKey) {
            try {
                window.localStorage.setItem(storageKey, JSON.stringify(newProfile));
            } catch {}
        }
        // Try on-chain registration via Memo program
        try {
            const { buildAgentRegistrationTx, getExplorerUrl } = await import('../../lib/solana/register-agent');
            const tx = await buildAgentRegistrationTx(address!, {
                displayName: newProfile.displayName,
                capabilities: newProfile.capabilities,
                bio: newProfile.bio,
                solDomain: newProfile.solDomain,
            });
            const rpcEndpoint = getRpcEndpoint();
            const connection = new Connection(rpcEndpoint, 'confirmed');
            // Sign via Dynamic wallet connector
            const { primaryWallet } = (window as any).__dynamicContext ?? {};
            if (primaryWallet?.connector) {
                const signer = await (primaryWallet.connector as any).getSigner();
                const signedTx = await signer.signTransaction(tx);
                const sig = await connection.sendRawTransaction(signedTx.serialize());
                setTxSignature(sig);
                if (storageKey) {
                    window.localStorage.setItem(`${storageKey}:tx`, sig);
                }
            }
        } catch (err) {
            console.warn('On-chain registration skipped:', err);
        }
        // Also try posting to the indexer
        try {
            await fetch(`${resolveIndexerBase()}/api/agents/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pubkey: address,
                    name: newProfile.displayName,
                    capabilities: newProfile.capabilities,
                    bio: newProfile.bio,
                    domain: newProfile.solDomain,
                }),
                signal: getTimeoutSignal(5000),
            });
        } catch {}
        setProfile(newProfile);
        setEditing(false);
        setRegistering(false);
    }

    function handleEdit(current: AgentProfile) {
        setDisplayName(current.displayName);
        setCapabilities(current.capabilities);
        setBio(current.bio);
        setSolDomain(current.solDomain);
        setEditing(true);
        setProfile(null);
    }

    if (profile && !editing) {
        return <AgentProfileCard profile={profile} onEdit={() => handleEdit(profile)} txSignature={txSignature} />;
    }

    return (
        <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '24px', border: '1.5px solid #16161A' }}>
            <div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#16161A' }}>
                    {editing ? 'Edit Agent Profile' : 'Register as Agent'}
                </h3>
                <p style={{ fontSize: '14px', color: '#16161A', opacity: 0.6, marginTop: '4px' }}>
                    {editing
                        ? 'Update your on-chain agent profile.'
                        : 'Set up your agent profile to start accepting tasks and building reputation.'}
                </p>
            </div>

            <div style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '12px', color: '#16161A', opacity: 0.6, fontWeight: 500 }}>Display Name *</label>
                <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. AlphaScout"
                    style={{
                        width: '100%',
                        background: '#F3F3F8',
                        border: '1.5px solid #16161A',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '14px',
                        color: '#16161A',
                        marginTop: '4px',
                    }}
                />
            </div>

            <div style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '12px', color: '#16161A', opacity: 0.6, fontWeight: 500 }}>Capabilities</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                    {AGENT_CAPABILITIES.map((cap) => (
                        <label
                            key={cap}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                        >
                            <input
                                type="checkbox"
                                checked={capabilities.includes(cap)}
                                onChange={() => toggleCapability(cap)}
                                style={{ width: '16px', height: '16px', accentColor: '#16161A' }}
                            />
                            <span style={{ fontSize: '14px', color: '#16161A' }}>{cap}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '12px', color: '#16161A', opacity: 0.6, fontWeight: 500 }}>Bio (optional)</label>
                <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Describe your agent's specialties and experience..."
                    rows={3}
                    style={{
                        width: '100%',
                        background: '#F3F3F8',
                        border: '1.5px solid #16161A',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '14px',
                        color: '#16161A',
                        resize: 'none',
                        marginTop: '4px',
                    }}
                />
            </div>

            <div style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '12px', color: '#16161A', opacity: 0.6, fontWeight: 500 }}>SOL Domain (optional)</label>
                <input
                    value={solDomain}
                    onChange={(e) => setSolDomain(e.target.value)}
                    placeholder="e.g. myagent.sol"
                    style={{
                        width: '100%',
                        background: '#F3F3F8',
                        border: '1.5px solid #16161A',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '14px',
                        color: '#16161A',
                        marginTop: '4px',
                    }}
                />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                    onClick={handleRegister}
                    disabled={!displayName.trim() || registering}
                    style={{
                        flex: 1,
                        padding: '10px',
                        background: (!displayName.trim() || registering) ? '#F3F3F8' : '#16161A',
                        color: (!displayName.trim() || registering) ? '#16161A' : '#FFFFFF',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        border: '1.5px solid #16161A',
                        cursor: (!displayName.trim() || registering) ? 'not-allowed' : 'pointer',
                        opacity: (!displayName.trim() || registering) ? 0.5 : 1,
                    }}
                >
                    {registering ? 'Registering on-chain...' : editing ? 'Save Changes' : 'Register Agent'}
                </button>
                {editing && (
                    <button
                        onClick={() => setEditing(false)}
                        style={{
                            padding: '10px 16px',
                            background: '#F3F3F8',
                            color: '#16161A',
                            borderRadius: '8px',
                            fontSize: '14px',
                            border: '1.5px solid #16161A',
                            cursor: 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                )}
            </div>

            <p style={{ fontSize: '10px', color: '#16161A', opacity: 0.4, marginTop: '12px' }}>
                Saved locally + synced to indexer. On-chain registration via Solana Memo program (devnet).
            </p>
        </div>
    );
}

function AgentProfileCard({ profile, onEdit, txSignature }: { profile: AgentProfile; onEdit: () => void; txSignature?: string | null }) {
    return (
        <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '24px', border: '1.5px solid #16161A' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#16161A' }}>{profile.displayName}</h3>
                    {profile.solDomain && (
                        <p style={{ fontSize: '14px', color: '#C6BBFF', marginTop: '2px' }}>{profile.solDomain}</p>
                    )}
                    <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5, fontFamily: 'monospace', marginTop: '4px', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {profile.walletAddress}
                    </p>
                    {txSignature && (
                        <a
                            href={`https://solana.fm/tx/${txSignature}?cluster=devnet-solana`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '11px', color: '#059669', marginTop: '4px', display: 'inline-block' }}
                        >
                            On-chain: {txSignature.slice(0, 12)}... (view on Solana FM)
                        </a>
                    )}
                </div>
                <button
                    onClick={onEdit}
                    style={{
                        padding: '6px 12px',
                        background: '#F3F3F8',
                        color: '#16161A',
                        borderRadius: '8px',
                        fontSize: '12px',
                        border: '1.5px solid #16161A',
                        cursor: 'pointer',
                    }}
                >
                    Edit Profile
                </button>
            </div>

            {profile.bio && (
                <p style={{ fontSize: '14px', color: '#16161A', opacity: 0.8, lineHeight: 1.6, marginTop: '12px' }}>{profile.bio}</p>
            )}

            {profile.capabilities.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                    {profile.capabilities.map((cap) => (
                        <span
                            key={cap}
                            style={{
                                padding: '4px 10px',
                                borderRadius: '9999px',
                                background: '#C6BBFF',
                                border: '1.5px solid #16161A',
                                fontSize: '12px',
                                color: '#16161A',
                            }}
                        >
                            {cap}
                        </span>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                <div style={{ background: '#F3F3F8', borderRadius: '8px', padding: '8px 16px', textAlign: 'center', border: '1.5px solid #16161A' }}>
                    <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5 }}>Reputation</p>
                    <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#16161A' }}>{profile.reputationScore}</p>
                </div>
                <p style={{ fontSize: '12px', color: '#16161A', opacity: 0.5 }}>
                    Complete tasks to build your on-chain reputation score.
                </p>
            </div>
        </div>
    );
}


function trimTrailingSlash(value: string): string {
    return value.endsWith('/') ? value.slice(0, -1) : value;
}

function getRpcEndpoint(): string {
    // Try to get from localStorage settings first
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('agentm:settings');
        if (stored) {
            const settings = JSON.parse(stored);
            if (settings.rpcEndpoint) return settings.rpcEndpoint;
        }
    }
    
    // Fall back to environment variables or defaults
    const envRpc = process.env.NEXT_PUBLIC_GRADIENCE_RPC_ENDPOINT;
    if (envRpc) return envRpc;
    
    // Default to devnet
    return 'https://api.devnet.solana.com';
}
