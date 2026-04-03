'use client';

import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import Link from 'next/link';
// Privy imports — kept for future use when Privy is configured
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { usePrivy } from '@privy-io/react-auth';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { User } from '@privy-io/react-auth';
import { useOWSBinding } from '@/hooks/useOWSBinding';
import { useOWSAgentRouter } from '@/hooks/useOWSAgentRouter';
import { useMasterCosign } from '@/lib/ows/cosign';
import { AesGcmEncryption, type EncryptionProvider } from '@/lib/ows/encrypted-store';
import type { OWSAgentWalletBinding } from '@/lib/ows/agent-wallet';
import type { OWSAgentSubWallet } from '@/lib/ows/agent-router';

import { FeedView } from './views/FeedView';
import { SocialView } from './views/SocialView';
import { ChatView } from './views/ChatView';

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
    connectorType: string | null;
    walletClientType: string | null;
    walletIndex: number | null;
}

export default function AppPage() {
    // Privy is available → use full Privy flow
    // Otherwise → use direct Solana wallet adapter
    try {
        // If Privy provider is available in the tree, use PrivyApp
        return <PrivyOrWalletApp />;
    } catch {
        return <DemoApp />;
    }
}

/** Try Privy first; fall back to direct wallet adapter */
function PrivyOrWalletApp() {
    const wallet = useWallet();
    const [view, setView] = useState<ActiveView>('discover');
    const address = wallet.publicKey?.toBase58() ?? null;

    // Not connected → show connect prompt
    if (!wallet.connected) {
        return (
            <div style={{ minHeight: '100vh', background: '#F3F3F8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: '#16161A' }}>AgentM</h1>
                    <p style={{ color: '#16161A', opacity: 0.6, maxWidth: '28rem', marginTop: '12px' }}>
                        AI Agent Economy on Solana. Find agents, delegate tasks, earn reputation.
                    </p>
                </div>
                <WalletMultiButton />
                <Link href="/" style={{ fontSize: '14px', color: '#16161A', opacity: 0.5, textDecoration: 'none' }}>
                    Back to home
                </Link>
            </div>
        );
    }

    return (
        <Shell
            view={view}
            setView={setView}
            address={address}
            activeSubWallet={null}
            loginEmail={null}
            wallets={[]}
            onWalletChange={() => {}}
            bindingStatus="unbound"
            onLogout={() => wallet.disconnect()}
        >
            {view === 'discover' && <DiscoverView />}
            {view === 'tasks' && <TaskMarketView address={address} />}
            {view === 'feed' && <FeedView address={address} />}
            {view === 'social' && <SocialView address={address} />}
            {view === 'me' && (
                <MeView
                    address={address}
                    masterWallet={address}
                    loginEmail={null}
                    selectedWallet={null}
                    owsBinding={null}
                    bindingStatus="unbound"
                    bindingBusy={false}
                    bindingError={null}
                    providerAvailable={false}
                    onBindOWS={() => null}
                    onUnbindOWS={() => {}}
                    activeSubWallet={null}
                    subWallets={[]}
                    routerError={null}
                    onCreateSubWallet={() => null}
                    onSetActiveSubWallet={() => null}
                />
            )}
            {view === 'chat' && <ChatView />}
            {view === 'settings' && <SettingsView />}
        </Shell>
    );
}

function PrivyApp() {
    const { ready, authenticated, login, logout, user } = usePrivy();
    const [view, setView] = useState<ActiveView>('discover');
    const [selectedWalletAddress, setSelectedWalletAddress] = useState<string | null>(null);
    const wallets = authenticated && user ? extractSolanaWallets(user) : [];
    const preferredWallet = selectPreferredSolanaWallet(wallets);
    const loginEmail = authenticated && user ? extractGoogleLoginEmail(user) : null;
    const address = selectedWalletAddress
        ? wallets.find((wallet) => wallet.address === selectedWalletAddress)?.address ?? preferredWallet?.address ?? null
        : preferredWallet?.address ?? null;
    const selectedWallet = wallets.find((wallet) => wallet.address === address) ?? preferredWallet ?? null;
    const accountKey = authenticated && user ? buildAccountKey(user, loginEmail) : null;
    const {
        binding,
        bindingError,
        bindingBusy,
        providerAvailable,
        status: bindingStatus,
        bindSelectedWallet,
        unbind,
    } = useOWSBinding({
        accountKey,
        loginEmail,
        selectedWallet: address,
    });
    const masterWallet = binding?.masterWallet ?? address ?? null;

    const { cosign, deriveEncryptionSeed, ready: cosignReady } = useMasterCosign();
    const [encProvider, setEncProvider] = useState<EncryptionProvider | null>(null);
    const [encDerived, setEncDerived] = useState(false);

    useEffect(() => {
        if (!cosignReady || !binding || encDerived) return;
        let cancelled = false;
        deriveEncryptionSeed().then(async (seed) => {
            if (cancelled || !seed) return;
            const provider = await AesGcmEncryption.fromSeed(seed);
            setEncProvider(provider);
            setEncDerived(true);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [cosignReady, binding, encDerived, deriveEncryptionSeed]);

    const {
        state: routerState,
        activeSubWallet,
        error: routerError,
        createSubWallet,
        setActiveSubWallet,
        signActiveRoute,
    } = useOWSAgentRouter({
        accountKey,
        masterWallet,
        cosign: cosignReady ? cosign : null,
        encryptionProvider: encProvider,
        indexerBase: INDEXER_BASE || null,
    });
    const runtimeAddress = activeSubWallet?.walletAddress ?? address;

    useEffect(() => {
        if (!authenticated) {
            setSelectedWalletAddress(null);
            return;
        }
        const stored = typeof window !== 'undefined' ? window.localStorage.getItem('agentm:selected-wallet') : null;
        const target = wallets.find((wallet) => wallet.address === stored)?.address ?? preferredWallet?.address ?? null;
        setSelectedWalletAddress(target);
    }, [authenticated, wallets, preferredWallet]);

    useEffect(() => {
        if (!selectedWalletAddress || typeof window === 'undefined') return;
        window.localStorage.setItem('agentm:selected-wallet', selectedWalletAddress);
    }, [selectedWalletAddress]);

    if (!ready) {
        return <Loading />;
    }

    if (!authenticated) {
        return <LoginScreen onLogin={login} />;
    }

    return (
        <Shell
            view={view}
            setView={setView}
            address={runtimeAddress}
            loginEmail={loginEmail}
            wallets={wallets}
            onWalletChange={setSelectedWalletAddress}
            bindingStatus={bindingStatus}
            activeSubWallet={activeSubWallet}
            onLogout={logout}
        >
            {view === 'discover' && <DiscoverView />}
            {view === 'feed' && <FeedView address={runtimeAddress} />}
            {view === 'social' && <SocialView address={runtimeAddress} />}
            {view === 'me' && (
                <MeView
                    address={runtimeAddress}
                    masterWallet={masterWallet}
                    loginEmail={loginEmail}
                    selectedWallet={selectedWallet}
                    owsBinding={binding}
                    bindingStatus={bindingStatus}
                    bindingBusy={bindingBusy}
                    bindingError={bindingError}
                    providerAvailable={providerAvailable}
                    onBindOWS={bindSelectedWallet}
                    onUnbindOWS={unbind}
                    activeSubWallet={activeSubWallet}
                    subWallets={routerState?.subWallets ?? []}
                    routerError={routerError}
                    onCreateSubWallet={createSubWallet}
                    onSetActiveSubWallet={setActiveSubWallet}
                />
            )}
            {view === 'chat' && <ChatView />}
            {view === 'settings' && <SettingsView />}
        </Shell>
    );
}

function DemoApp() {
    const [view, setView] = useState<ActiveView>('discover');
    const [demoAddr] = useState('DEMO_ha1w01');

    return (
        <Shell
            view={view}
            setView={setView}
            address={demoAddr}
            activeSubWallet={null}
            loginEmail="demo@agentm.local"
            wallets={[]}
            onWalletChange={() => {}}
            bindingStatus="unbound"
            onLogout={() => {}}
        >
            {view === 'discover' && <DiscoverView />}
            {view === 'feed' && <FeedView address={demoAddr} />}
            {view === 'social' && <SocialView address={demoAddr} />}
            {view === 'me' && (
                <MeView
                    address={demoAddr}
                    masterWallet={demoAddr}
                    loginEmail="demo@agentm.local"
                    selectedWallet={null}
                    owsBinding={null}
                    bindingStatus="unbound"
                    bindingBusy={false}
                    bindingError={null}
                    providerAvailable={false}
                    onBindOWS={() => null}
                    onUnbindOWS={() => {}}
                    activeSubWallet={null}
                    subWallets={[]}
                    routerError={null}
                    onCreateSubWallet={() => null}
                    onSetActiveSubWallet={() => null}
                />
            )}
            {view === 'chat' && <ChatView />}
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

const DEMO_DISCOVER_AGENTS: AgentRow[] = [
    { agent: 'Alice_DeFi', weight: 1500, reputation: { global_avg_score: 92, global_completed: 47, win_rate: 0.94 } },
    { agent: 'Bob_Auditor', weight: 800, reputation: { global_avg_score: 85, global_completed: 23, win_rate: 0.82 } },
    { agent: 'Charlie_Data', weight: 600, reputation: { global_avg_score: 78, global_completed: 12, win_rate: 0.80 } },
];

function DiscoverView() {
    const [agents, setAgents] = useState<AgentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [dataSource, setDataSource] = useState<'indexer' | 'demo'>('demo');
    const { status: indexerStatus, indexerUrl } = useIndexerStatus();

    useEffect(() => {
        const base = resolveIndexerBase();
        fetch(`${base}/api/judge-pool/0`, { signal: getTimeoutSignal(5000) })
            .then((r) => r.ok ? r.json() : [])
            .then((data) => {
                if (Array.isArray(data) && data.length > 0) {
                    setAgents(data as AgentRow[]);
                    setDataSource('indexer');
                } else {
                    // Try alternative endpoint: registered agents
                    return fetch(`${base}/api/agents`, { signal: getTimeoutSignal(3000) })
                        .then((r2) => r2.ok ? r2.json() : null)
                        .then((agents2) => {
                            if (Array.isArray(agents2) && agents2.length > 0) {
                                // Map to AgentRow format
                                const mapped: AgentRow[] = agents2.map((a: Record<string, unknown>) => ({
                                    agent: (a.name as string) || (a.pubkey as string) || 'Unknown',
                                    weight: (a.weight as number) || 0,
                                    reputation: a.reputation ? a.reputation as AgentRow['reputation'] : null,
                                }));
                                setAgents(mapped);
                                setDataSource('indexer');
                            } else {
                                setAgents(DEMO_DISCOVER_AGENTS);
                                setDataSource('demo');
                            }
                        });
                }
            })
            .catch(() => {
                setAgents(DEMO_DISCOVER_AGENTS);
                setDataSource('demo');
            })
            .finally(() => setLoading(false));
    }, []);

    const filtered = agents.filter((a) => !query || a.agent.toLowerCase().includes(query.toLowerCase()));

    const loadDemo = () => {
        setAgents(DEMO_DISCOVER_AGENTS);
        setDataSource('demo');
    };

    return (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#16161A' }}>Discover Agents</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <DataSourceLabel source={dataSource} />
                    <IndexerStatusBadge status={indexerStatus} url={indexerUrl} />
                </div>
            </div>
            <input
                placeholder="Search agents..."
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
                    <p style={{ color: '#16161A', opacity: 0.5 }}>No agents found. Indexer may be offline.</p>
                    <button 
                        onClick={loadDemo} 
                        style={{
                            marginTop: '12px',
                            padding: '8px 16px',
                            background: '#16161A',
                            color: '#FFFFFF',
                            borderRadius: '8px',
                            fontSize: '14px',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        Load Demo Agents
                    </button>
                </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filtered.map((row, i) => (
                    <div 
                        key={row.agent} 
                        style={{
                            background: '#FFFFFF',
                            borderRadius: '12px',
                            padding: '16px',
                            border: '1.5px solid #16161A',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                background: '#F3F3F8',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                color: '#16161A',
                                border: '1.5px solid #16161A',
                            }}>{i + 1}</div>
                            <div>
                                <p style={{ fontWeight: 500, color: '#16161A' }}>{row.agent}</p>
                                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#16161A', opacity: 0.6 }}>
                                    <span>Score: {row.reputation?.global_avg_score?.toFixed(1) ?? 'N/A'}</span>
                                    <span>Tasks: {row.reputation?.global_completed ?? 0}</span>
                                    <span>Win: {row.reputation?.win_rate ? `${(row.reputation.win_rate * 100).toFixed(0)}%` : 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
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
        <div className="p-6 space-y-6 overflow-y-auto h-full">
            <h2 className="text-2xl font-bold">My Agent</h2>
            <RegisterAgentSection address={address} />
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <p className="text-sm text-gray-500 font-mono">{address}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-2">
                <h3 className="text-lg font-semibold">Wallet Binding</h3>
                <p className="text-sm text-gray-400">Login: {loginEmail ?? 'Google OAuth'}</p>
                <p className="text-xs text-gray-500">
                    Active Agent Wallet: {selectedWallet?.address ?? address ?? 'N/A'}
                </p>
                <p className="text-xs text-gray-500">
                    Source: {selectedWallet?.connectorType === 'embedded' ? 'Privy Embedded Wallet' : 'External Wallet'}
                </p>
                <p className="text-xs text-gray-500">
                    OWS provider: {providerAvailable ? 'detected' : 'not detected (local persistence mode)'}
                </p>
                <p className="text-xs text-blue-400">
                    Binding status: {formatBindingStatus(bindingStatus)}
                </p>
                {owsBinding && (
                    <div className="text-xs text-gray-500 space-y-1 pt-1">
                        <p>OWS DID: {owsBinding.owsDid}</p>
                        <p>Agent Wallet ID: {owsBinding.agentWalletId}</p>
                        <p>Master Wallet: {owsBinding.masterWallet}</p>
                    </div>
                )}
                {bindingError && <p className="text-xs text-red-400">{bindingError}</p>}
                <div className="flex gap-2 pt-1">
                    <button
                        onClick={onBindOWS}
                        disabled={!address || bindingBusy}
                        className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:bg-blue-900 text-xs"
                    >
                        {bindingBusy ? 'Binding...' : 'Bind Selected Wallet to OWS'}
                    </button>
                    {owsBinding && (
                        <button
                            onClick={onUnbindOWS}
                            className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs"
                        >
                            Unbind
                        </button>
                    )}
                </div>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-3">
                <h3 className="text-lg font-semibold">Agent Sub-Wallet Routing</h3>
                <p className="text-xs text-gray-500">
                    Master wallet: {masterWallet ?? 'N/A'} (Privy-controlled). Sub-wallets route signing through master policy.
                </p>
                <div className="flex gap-2">
                    <input
                        value={newSubWalletHandle}
                        onChange={(event) => setNewSubWalletHandle(event.target.value)}
                        placeholder="agent handle (e.g. scout-agent)"
                        className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                        onClick={() => {
                            if (!newSubWalletHandle.trim()) return;
                            onCreateSubWallet(newSubWalletHandle);
                            setNewSubWalletHandle('');
                        }}
                        disabled={!owsBinding}
                        className="px-3 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 disabled:bg-indigo-900 text-xs"
                    >
                        Create Sub-Wallet
                    </button>
                </div>
                {routerError && <p className="text-xs text-red-400">{routerError}</p>}
                {subWallets.length === 0 ? (
                    <p className="text-xs text-gray-500">No sub-wallets yet. Create one after OWS binding.</p>
                ) : (
                    <div className="space-y-2">
                        {subWallets.map((wallet) => (
                            <button
                                key={wallet.id}
                                onClick={() => onSetActiveSubWallet(wallet.id)}
                                className={`w-full text-left rounded-lg border px-3 py-2 ${
                                    activeSubWallet?.id === wallet.id
                                        ? 'border-emerald-500 bg-emerald-950/20'
                                        : 'border-gray-800 bg-gray-950'
                                }`}
                            >
                                <p className="text-sm font-medium">{wallet.handle}</p>
                                <p className="text-[10px] text-gray-500 font-mono truncate">
                                    {wallet.walletAddress}
                                </p>
                                <p className="text-[10px] text-gray-500">
                                    Route: {wallet.policy.strategy} · approval {wallet.policy.requireMasterApprovalAboveUsd} USD+
                                </p>
                            </button>
                        ))}
                        {activeSubWallet && (
                            <button
                                onClick={() => onSetActiveSubWallet(null)}
                                className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs"
                            >
                                Use Master Wallet
                            </button>
                        )}
                    </div>
                )}
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-semibold mb-4">Reputation</h3>
                {loading ? (
                    <p className="text-gray-500 text-sm">Loading...</p>
                ) : rep ? (
                    <div className="grid grid-cols-2 gap-4">
                        <Stat label="Avg Score" value={rep.avg_score?.toFixed(1) ?? '--'} />
                        <Stat label="Completed" value={String(rep.completed ?? 0)} />
                        <Stat label="Win Rate" value={rep.win_rate ? `${(rep.win_rate * 100).toFixed(0)}%` : '--'} />
                        <Stat label="Earned" value={`${((rep.total_earned ?? 0) / 1e9).toFixed(4)} SOL`} />
                    </div>
                ) : (
                    <p className="text-gray-500 text-sm">No reputation data yet. Complete tasks to build your on-chain reputation.</p>
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
            const publicKey = new (await import('@solana/web3.js')).PublicKey(address);
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
        <div className="p-6 space-y-6 overflow-y-auto h-full">
            <h2 className="text-2xl font-bold">Settings</h2>
            
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-4">
                <h3 className="text-lg font-semibold">Network Configuration</h3>
                
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        RPC Endpoint
                    </label>
                    <select
                        value={settings.rpcEndpoint}
                        onChange={(e) => updateSetting('rpcEndpoint', e.target.value)}
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    >
                        <option value="https://api.devnet.solana.com">Devnet (Default)</option>
                        <option value="https://api.mainnet-beta.solana.com">Mainnet Beta</option>
                        <option value="https://api.testnet.solana.com">Testnet</option>
                        <option value="http://127.0.0.1:8899">Local Validator</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Indexer URL
                    </label>
                    <input
                        type="text"
                        value={settings.indexerUrl}
                        onChange={(e) => updateSetting('indexerUrl', e.target.value)}
                        placeholder="http://localhost:3001"
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                </div>
            </div>

            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-4">
                <h3 className="text-lg font-semibold">Appearance</h3>
                
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Theme
                    </label>
                    <select
                        value={settings.theme}
                        onChange={(e) => updateSetting('theme', e.target.value as 'dark' | 'light')}
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    >
                        <option value="dark">Dark (Current)</option>
                        <option value="light" disabled>Light (Coming Soon)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Light theme will be available in a future update</p>
                </div>
            </div>

            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-semibold mb-3">About</h3>
                <div className="text-sm text-gray-400 space-y-1">
                    <p>AgentM Web v1.0.0</p>
                    <p>AI Agent Economy on Solana</p>
                    <p className="text-xs text-gray-600 mt-2">Settings are stored locally in your browser</p>
                </div>
            </div>

            <div className="flex gap-3">
                <button
                    onClick={saveSettings}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition"
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
                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition"
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
        const base = 'px-2 py-0.5 rounded-full text-xs font-medium border';
        switch (task.state) {
            case 'Open': return <span className={`${base} bg-emerald-900/30 text-emerald-400 border-emerald-800`}>Open</span>;
            case 'InProgress': return <span className={`${base} bg-blue-900/30 text-blue-400 border-blue-800`}>In Progress</span>;
            case 'Judging': return <span className={`${base} bg-amber-900/30 text-amber-400 border-amber-800`}>Judging</span>;
            case 'Settled': return <span className={`${base} bg-purple-900/30 text-purple-400 border-purple-800`}>Settled</span>;
            case 'Cancelled': return <span className={`${base} bg-red-900/30 text-red-400 border-red-800`}>Cancelled</span>;
            default: return <span className={`${base} bg-gray-800 text-gray-400 border-gray-700`}>{task.state}</span>;
        }
    })();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full h-full md:h-auto md:max-w-2xl md:max-h-[85vh] md:rounded-2xl bg-gray-900 border-0 md:border md:border-gray-700 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                    <h3 className="text-lg font-semibold">Task Details</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition" aria-label="Close">
                        ✕
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    <div className="flex items-center justify-between">
                        {stateBadge}
                        <span className="text-xs text-gray-500">{task.submissions_count} submission{task.submissions_count === 1 ? '' : 's'}</span>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Description</p>
                        <p className="text-sm text-gray-200 whitespace-pre-wrap">{task.description}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Poster</p>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-mono text-gray-300 truncate">{task.poster.slice(0, 6)}...{task.poster.slice(-4)}</span>
                                <button onClick={copyPoster} className="text-[10px] px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 transition">Copy</button>
                            </div>
                        </div>
                        <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Category</p>
                            <p className="text-sm text-gray-300">{task.category}</p>
                        </div>
                        <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Reward</p>
                            <p className="text-sm font-medium text-gray-200">{rewardSol} SOL</p>
                        </div>
                        <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Deadline</p>
                            <p className="text-sm text-gray-300">{deadlineText}</p>
                        </div>
                    </div>
                    {applyError && <p className="text-xs text-red-400">{applyError}</p>}
                    {isOpen && isConnected && (
                        <button
                            onClick={handleApply}
                            disabled={applying}
                            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 rounded-lg text-sm font-medium transition"
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
    const { publicKey } = useWallet();
    const poster = publicKey?.toBase58() ?? null;

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
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 space-y-5">
            <h3 className="text-lg font-semibold text-white">Post a Task</h3>

            {toast && (
                <div
                    className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
                        toast.type === 'success'
                            ? 'bg-emerald-900/50 border border-emerald-700 text-emerald-300'
                            : 'bg-red-900/50 border border-red-700 text-red-300'
                    }`}
                >
                    {toast.message}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        Task Description <span className="text-red-400">*</span>
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe the task in detail..."
                        rows={4}
                        required
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Category</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as TaskCategory)}
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                        >
                            {TASK_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                            Reward (SOL) <span className="text-gray-500 font-normal">min 0.01</span>
                        </label>
                        <input
                            type="number"
                            value={rewardSol}
                            onChange={(e) => setRewardSol(e.target.value)}
                            placeholder="0.10"
                            min="0.01"
                            step="0.01"
                            required
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Deadline</label>
                    <input
                        type="date"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        min={minDateStr}
                        required
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                </div>

                {poster && (
                    <p className="text-xs text-gray-500 font-mono">
                        Posting as: {poster.slice(0, 8)}...{poster.slice(-4)}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-400 rounded-lg text-sm font-medium text-white transition"
                >
                    {submitting ? (
                        <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
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
        <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl font-bold">{value}</p>
        </div>
    );
}

function Loading() {
    return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>;
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
    return (
        <div className="flex items-center justify-center h-screen">
            <div className="text-center space-y-6">
                <h1 className="text-4xl font-bold">AgentM</h1>
                <p className="text-gray-400 max-w-md mx-auto">
                    AI Agent Economy on Solana. Find agents, delegate tasks, earn reputation.
                </p>
                <button
                    onClick={onLogin}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-lg font-medium transition"
                >
                    Sign in with Google
                </button>
                <p className="text-xs text-gray-600">
                    <Link href="/" className="hover:text-gray-400">Back to home</Link>
                </p>
            </div>
        </div>
    );
}

function extractGoogleLoginEmail(user: User): string | null {
    const google = user.linkedAccounts?.find((account) => account.type === 'google_oauth');
    if (google && 'email' in google && typeof google.email === 'string') {
        return google.email;
    }
    const emailAccount = user.linkedAccounts?.find((account) => account.type === 'email');
    if (emailAccount && 'address' in emailAccount && typeof emailAccount.address === 'string') {
        return emailAccount.address;
    }
    return null;
}

function extractSolanaWallets(user: User): SolanaWalletCandidate[] {
    const linked = user.linkedAccounts ?? [];
    const wallets: SolanaWalletCandidate[] = [];

    for (const account of linked) {
        if (account.type !== 'wallet') continue;
        const chainType = readStringField(account, 'chain_type') ?? readStringField(account, 'chainType');
        if (chainType !== 'solana') continue;

        const address = readStringField(account, 'address');
        if (!address) continue;

        wallets.push({
            address,
            connectorType: readStringField(account, 'connector_type') ?? readStringField(account, 'connectorType'),
            walletClientType: readStringField(account, 'wallet_client_type') ?? readStringField(account, 'walletClientType'),
            walletIndex: readNumberField(account, 'wallet_index') ?? readNumberField(account, 'walletIndex'),
        });
    }

    return wallets;
}

function selectPreferredSolanaWallet(wallets: SolanaWalletCandidate[]): SolanaWalletCandidate | null {
    if (wallets.length === 0) return null;
    const sorted = [...wallets].sort((left, right) => scoreWallet(right) - scoreWallet(left));
    return sorted[0] ?? null;
}

function scoreWallet(wallet: SolanaWalletCandidate): number {
    let score = 0;
    if (wallet.connectorType === 'embedded') score += 100;
    if (wallet.walletClientType === 'privy') score += 50;
    if (wallet.walletIndex === 0) score += 10;
    return score;
}

function buildAccountKey(user: User, loginEmail: string | null): string {
    if (typeof user.id === 'string' && user.id) {
        return `privy:${user.id}`;
    }
    if (loginEmail) {
        return `email:${loginEmail.toLowerCase()}`;
    }
    return 'anonymous';
}

function formatBindingStatus(status: 'bound' | 'wallet_changed' | 'unbound'): string {
    if (status === 'bound') return 'bound';
    if (status === 'wallet_changed') return 'wallet changed (rebind required)';
    return 'unbound';
}

function readStringField<T extends object>(obj: T, key: string): string | null {
    const value = (obj as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : null;
}

function readNumberField<T extends object>(obj: T, key: string): number | null {
    const value = (obj as Record<string, unknown>)[key];
    return typeof value === 'number' ? value : null;
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
        checking: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
        connected: 'bg-emerald-900/50 text-emerald-400 border-emerald-800',
        disconnected: 'bg-red-900/50 text-red-400 border-red-800',
    };
    const labels = {
        checking: '● Checking...',
        connected: '● Indexer Connected',
        disconnected: '○ Indexer Offline',
    };
    return (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border ${colors[status]}`} title={url}>
            {labels[status]}
        </div>
    );
}

function DataSourceLabel({ source }: { source: 'indexer' | 'demo' | 'mock' }) {
    if (source === 'indexer') {
        return <span className="text-[10px] text-emerald-500 bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-800">Live Data</span>;
    }
    if (source === 'demo') {
        return <span className="text-[10px] text-yellow-500 bg-yellow-900/30 px-2 py-0.5 rounded-full border border-yellow-800">Demo Data</span>;
    }
    return <span className="text-[10px] text-yellow-500 bg-yellow-900/30 px-2 py-0.5 rounded-full border border-yellow-800">Mock Data</span>;
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

const STATE_COLORS: Record<string, string> = {
    Open: 'bg-green-900 text-green-300',
    InProgress: 'bg-yellow-900 text-yellow-300',
    Judging: 'bg-purple-900 text-purple-300',
    Settled: 'bg-blue-900 text-blue-300',
    Cancelled: 'bg-red-900 text-red-300',
};

function TaskMarketView({ address }: { address: string | null }) {
    const [tasks, setTasks] = useState<TaskData[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');
    const [showPostForm, setShowPostForm] = useState(false);
    const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
    const [dataSource, setDataSource] = useState<'indexer' | 'mock'>('mock');
    const { status: indexerStatus, indexerUrl } = useIndexerStatus();

    useEffect(() => {
        fetch(`${resolveIndexerBase()}/api/tasks`, { signal: getTimeoutSignal(3000) })
            .then((r) => r.ok ? r.json() : [])
            .then((data) => {
                if (Array.isArray(data) && data.length > 0) {
                    setTasks(data as TaskData[]);
                    setDataSource('indexer');
                } else {
                    setTasks(MOCK_TASKS);
                    setDataSource('mock');
                }
            })
            .catch(() => { setTasks(MOCK_TASKS); setDataSource('mock'); })
            .finally(() => setLoading(false));
    }, []);

    const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.state === filter);

    return (
        <div className="p-6 space-y-4 overflow-y-auto h-full">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold">Task Market</h2>
                    <DataSourceLabel source={dataSource} />
                    <IndexerStatusBadge status={indexerStatus} url={indexerUrl} />
                </div>
                {address && (
                    <button
                        onClick={() => setShowPostForm(!showPostForm)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition"
                    >
                        {showPostForm ? 'Close' : '+ Post Task'}
                    </button>
                )}
            </div>

            {/* Post Task Form (collapsible) */}
            {showPostForm && address && (
                <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold">Post a New Task</h3>
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
            <div className="flex gap-2 flex-wrap">
                {['all', 'Open', 'InProgress', 'Judging', 'Settled'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1 rounded-full text-xs transition ${
                            filter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                    >
                        {f === 'all' ? 'All' : f} {f !== 'all' && `(${tasks.filter((t) => t.state === f).length})`}
                    </button>
                ))}
            </div>

            {/* Task List */}
            {loading && <p className="text-gray-500 text-sm">Loading tasks...</p>}
            {!loading && filtered.length === 0 && (
                <p className="text-gray-500 text-center py-12">No tasks found.</p>
            )}
            <div className="space-y-3">
                {filtered.map((task) => (
                    <div
                        key={task.task_id}
                        onClick={() => setSelectedTask(task)}
                        className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 cursor-pointer transition"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATE_COLORS[task.state] ?? 'bg-gray-800 text-gray-400'}`}>
                                        {task.state}
                                    </span>
                                    <span className="text-xs text-gray-500">{task.category}</span>
                                </div>
                                <p className="text-sm text-gray-200 line-clamp-2">{task.description}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                    <span>By {task.poster.slice(0, 6)}...{task.poster.slice(-4)}</span>
                                    <span>{task.submissions_count} submissions</span>
                                    <span>Due {new Date(task.deadline * 1000).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-lg font-bold text-blue-400">{(task.reward_lamports / 1_000_000_000).toFixed(2)}</p>
                                <p className="text-xs text-gray-500">SOL</p>
                            </div>
                        </div>
                    </div>
                ))}
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

    const handleSubmit = async () => {
        if (!description.trim()) return;
        setPosting(true);
        const task: TaskData = {
            task_id: `task_${Date.now()}`,
            poster: address,
            category,
            description: description.trim(),
            reward_lamports: Math.round(parseFloat(rewardSol) * 1_000_000_000),
            deadline: Math.floor(Date.now() / 1000) + parseInt(deadlineDays) * 86400,
            state: 'Open',
            submissions_count: 0,
        };

        try {
            await fetch(`${resolveIndexerBase()}/api/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(task),
                signal: getTimeoutSignal(3000),
            });
        } catch {
            // Indexer offline — task still added locally
        }

        onPosted(task);
        setDescription('');
        setPosting(false);
    };

    return (
        <div className="space-y-3">
            <textarea
                placeholder="Describe your task..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
            <div className="grid grid-cols-3 gap-3">
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                >
                    {['DeFi Analysis', 'Smart Contract Audit', 'Data Processing', 'Content Creation', 'Trading Strategy', 'Code Review', 'Other'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
                <div className="relative">
                    <input
                        type="number"
                        min="0.01"
                        step="0.1"
                        value={rewardSol}
                        onChange={(e) => setRewardSol(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm pr-12"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-gray-500">SOL</span>
                </div>
                <div className="relative">
                    <input
                        type="number"
                        min="1"
                        max="90"
                        value={deadlineDays}
                        onChange={(e) => setDeadlineDays(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm pr-12"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-gray-500">days</span>
                </div>
            </div>
            <button
                onClick={handleSubmit}
                disabled={posting || !description.trim()}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition"
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

    async function handleRegister() {
        if (!displayName.trim()) return;
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
        } catch {
            // Indexer offline — profile saved locally only
        }
        setProfile(newProfile);
        setEditing(false);
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
        return <AgentProfileCard profile={profile} onEdit={() => handleEdit(profile)} />;
    }

    return (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-700 space-y-5">
            <div>
                <h3 className="text-lg font-semibold">
                    {editing ? 'Edit Agent Profile' : 'Register as Agent'}
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                    {editing
                        ? 'Update your on-chain agent profile.'
                        : 'Set up your agent profile to start accepting tasks and building reputation.'}
                </p>
            </div>

            <div className="space-y-1">
                <label className="text-xs text-gray-400 font-medium">Display Name *</label>
                <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. AlphaScout"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
            </div>

            <div className="space-y-2">
                <label className="text-xs text-gray-400 font-medium">Capabilities</label>
                <div className="grid grid-cols-2 gap-2">
                    {AGENT_CAPABILITIES.map((cap) => (
                        <label
                            key={cap}
                            className="flex items-center gap-2 cursor-pointer select-none"
                        >
                            <input
                                type="checkbox"
                                checked={capabilities.includes(cap)}
                                onChange={() => toggleCapability(cap)}
                                className="w-4 h-4 accent-blue-500 rounded"
                            />
                            <span className="text-sm text-gray-300">{cap}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-xs text-gray-400 font-medium">Bio (optional)</label>
                <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Describe your agent's specialties and experience..."
                    rows={3}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none focus:border-blue-500 focus:outline-none"
                />
            </div>

            <div className="space-y-1">
                <label className="text-xs text-gray-400 font-medium">SOL Domain (optional)</label>
                <input
                    value={solDomain}
                    onChange={(e) => setSolDomain(e.target.value)}
                    placeholder="e.g. myagent.sol"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
            </div>

            <div className="flex gap-3">
                <button
                    onClick={handleRegister}
                    disabled={!displayName.trim()}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition"
                >
                    {editing ? 'Save Changes' : 'Register Agent'}
                </button>
                {editing && (
                    <button
                        onClick={() => setEditing(false)}
                        className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition"
                    >
                        Cancel
                    </button>
                )}
            </div>

            <p className="text-[10px] text-gray-600">
                Saved locally + synced to indexer when available. Future: calls AgentM Core program register_user + create_agent.
            </p>
        </div>
    );
}

function AgentProfileCard({ profile, onEdit }: { profile: AgentProfile; onEdit: () => void }) {
    return (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-700 space-y-4">
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-xl font-bold">{profile.displayName}</h3>
                    {profile.solDomain && (
                        <p className="text-sm text-blue-400 mt-0.5">{profile.solDomain}</p>
                    )}
                    <p className="text-xs text-gray-500 font-mono mt-1 truncate max-w-[260px]">
                        {profile.walletAddress}
                    </p>
                </div>
                <button
                    onClick={onEdit}
                    className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs transition"
                >
                    Edit Profile
                </button>
            </div>

            {profile.bio && (
                <p className="text-sm text-gray-300 leading-relaxed">{profile.bio}</p>
            )}

            {profile.capabilities.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {profile.capabilities.map((cap) => (
                        <span
                            key={cap}
                            className="px-2.5 py-1 rounded-full bg-blue-950 border border-blue-800 text-xs text-blue-300"
                        >
                            {cap}
                        </span>
                    ))}
                </div>
            )}

            <div className="flex items-center gap-3 pt-1">
                <div className="bg-gray-800 rounded-lg px-4 py-2 text-center">
                    <p className="text-xs text-gray-500">Reputation</p>
                    <p className="text-lg font-bold text-blue-400">{profile.reputationScore}</p>
                </div>
                <p className="text-xs text-gray-500">
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
