'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import type { User } from '@privy-io/react-auth';
import Link from 'next/link';

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

export default function AppPage() {
    if (!PRIVY_APP_ID) {
        return <DemoApp />;
    }

    return <PrivyApp />;
}

function PrivyApp() {
    const { ready, authenticated, login, logout, user } = usePrivy();
    const [view, setView] = useState<ActiveView>('discover');
    const address = authenticated && user ? extractSolanaAddress(user) : null;

    if (!ready) {
        return <Loading />;
    }

    if (!authenticated) {
        return <LoginScreen onLogin={login} />;
    }

    return (
        <Shell view={view} setView={setView} address={address} onLogout={logout}>
            {view === 'discover' && <DiscoverView />}
            {view === 'me' && <MeView address={address} />}
            {view === 'chat' && <ChatPlaceholder />}
        </Shell>
    );
}

function DemoApp() {
    const [view, setView] = useState<ActiveView>('discover');
    const [demoAddr] = useState(() => 'DEMO_' + Math.random().toString(36).slice(2, 8));

    return (
        <Shell view={view} setView={setView} address={demoAddr} onLogout={() => {}}>
            {view === 'discover' && <DiscoverView />}
            {view === 'me' && <MeView address={demoAddr} />}
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
    onLogout,
}: {
    children: React.ReactNode;
    view: ActiveView;
    setView: (v: ActiveView) => void;
    address: string | null;
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
                    <p className="text-xs text-gray-500 mt-1 font-mono truncate">{address?.slice(0, 16)}...</p>
                </div>
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

function MeView({ address }: { address: string | null }) {
    const [rep, setRep] = useState<ReputationData | null>(null);
    const [loading, setLoading] = useState(false);

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

function extractSolanaAddress(user: User): string {
    const w = user.linkedAccounts?.find((a) => a.type === 'wallet' && a.chainType === 'solana');
    if (w && 'address' in w) return w.address as string;
    return user.id;
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
