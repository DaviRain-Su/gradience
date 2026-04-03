'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import type { User } from '@privy-io/react-auth';
import Link from 'next/link';
import { useOWSBinding } from '@/hooks/useOWSBinding';
import { useOWSAgentRouter } from '@/hooks/useOWSAgentRouter';
import type { OWSAgentWalletBinding } from '@/lib/ows/agent-wallet';
import type { OWSAgentSubWallet } from '@/lib/ows/agent-router';

type ActiveView = 'discover' | 'me' | 'chat';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';
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
    if (!PRIVY_APP_ID) {
        return <DemoApp />;
    }

    return <PrivyApp />;
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
    const {
        state: routerState,
        activeSubWallet,
        error: routerError,
        createSubWallet,
        setActiveSubWallet,
    } = useOWSAgentRouter({
        accountKey,
        masterWallet,
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
            {view === 'chat' && <ChatPlaceholder />}
        </Shell>
    );
}

function DemoApp() {
    const [view, setView] = useState<ActiveView>('discover');
    const [demoAddr] = useState(() => 'DEMO_' + Math.random().toString(36).slice(2, 8));

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
            {view === 'chat' && <ChatPlaceholder />}
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
        { key: 'me', label: 'My Agent' },
        { key: 'chat', label: 'Chat' },
    ];

    return (
        <div className="flex h-screen">
            <aside className="w-52 bg-gray-900 border-r border-gray-800 flex flex-col">
                <div className="p-4">
                    <Link href="/" className="text-lg font-bold hover:text-blue-400 transition">AgentM</Link>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                        Login: {loginEmail ?? 'Google OAuth'}
                    </p>
                    {activeSubWallet && (
                        <p className="text-[10px] text-emerald-400 mt-1 truncate">
                            Active Agent: {activeSubWallet.handle}
                        </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1 font-mono truncate">{address?.slice(0, 16)}...</p>
                </div>
                {wallets.length > 1 && (
                    <div className="px-4 pb-3">
                        <label className="text-[10px] text-gray-500 uppercase tracking-wide">Agent Wallet</label>
                        <select
                            value={address ?? ''}
                            onChange={(event) => onWalletChange(event.target.value)}
                            className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs"
                        >
                            {wallets.map((wallet) => (
                                <option key={wallet.address} value={wallet.address}>
                                    {wallet.connectorType === 'embedded' ? 'Privy' : 'External'} · {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                <nav className="flex-1 px-2 space-y-1">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setView(t.key)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                                view === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </nav>
                <div className="p-4">
                    <p className="text-[10px] mb-2 text-gray-600">
                        OWS: {formatBindingStatus(bindingStatus)}
                    </p>
                    <button onClick={onLogout} className="text-sm text-gray-500 hover:text-white transition">
                        Logout
                    </button>
                </div>
            </aside>
            <main className="flex-1 overflow-hidden">{children}</main>
        </div>
    );
}

// ── Discover ─────────────────────────────────────────────────────────

function DiscoverView() {
    const [agents, setAgents] = useState<AgentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');

    useEffect(() => {
        fetch(`${resolveIndexerBase()}/api/judge-pool/0`, { signal: getTimeoutSignal(5000) })
            .then((r) => r.ok ? r.json() : [])
            .then((data) => setAgents(data as AgentRow[]))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const filtered = agents.filter((a) => !query || a.agent.toLowerCase().includes(query.toLowerCase()));

    const loadDemo = () => {
        setAgents([
            { agent: 'Alice_DeFi', weight: 1500, reputation: { global_avg_score: 92, global_completed: 47, win_rate: 0.94 } },
            { agent: 'Bob_Auditor', weight: 800, reputation: { global_avg_score: 85, global_completed: 23, win_rate: 0.82 } },
            { agent: 'Charlie_Data', weight: 600, reputation: { global_avg_score: 78, global_completed: 12, win_rate: 0.80 } },
        ]);
    };

    return (
        <div className="p-6 space-y-4 overflow-y-auto h-full">
            <h2 className="text-2xl font-bold">Discover Agents</h2>
            <input
                placeholder="Search agents..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            {loading && <p className="text-gray-500 text-sm">Loading...</p>}
            {!loading && agents.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-gray-500">No agents found. Indexer may be offline.</p>
                    <button onClick={loadDemo} className="mt-3 px-4 py-2 bg-blue-800 rounded hover:bg-blue-700 text-sm transition">
                        Load Demo Agents
                    </button>
                </div>
            )}
            <div className="space-y-2">
                {filtered.map((row, i) => (
                    <div key={row.agent} className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold">{i + 1}</div>
                            <div>
                                <p className="font-medium">{row.agent}</p>
                                <div className="flex gap-3 text-xs text-gray-500">
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

// ── Chat Placeholder ─────────────────────────────────────────────────

function ChatPlaceholder() {
    return (
        <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center space-y-2">
                <p className="text-lg">A2A Chat</p>
                <p className="text-sm">Coming soon. Connect with AI agents via A2A Protocol.</p>
            </div>
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
    if (INDEXER_BASE) {
        return trimTrailingSlash(INDEXER_BASE);
    }
    const host = window.location.hostname;
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

function trimTrailingSlash(value: string): string {
    return value.endsWith('/') ? value.slice(0, -1) : value;
}
