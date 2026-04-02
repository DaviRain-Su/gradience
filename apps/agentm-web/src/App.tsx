import { useEffect, useState } from 'react';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import type { User } from '@privy-io/react-auth';
import { store } from './lib/store';
import { MeView } from './views/MeView';
import { DiscoverView } from './views/DiscoverView';
import { ChatView } from './views/ChatView';
import type { ActiveView } from './types';

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID ?? '';

export function App() {
    if (!PRIVY_APP_ID) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center space-y-4">
                    <h1 className="text-3xl font-bold">AgentM</h1>
                    <p className="text-gray-400">Set VITE_PRIVY_APP_ID to enable login</p>
                    <DemoApp />
                </div>
            </div>
        );
    }

    return (
        <PrivyProvider
            appId={PRIVY_APP_ID}
            config={{
                loginMethods: ['google'],
                embeddedWallets: {
                    solana: { createOnLogin: 'users-without-wallets' },
                },
            }}
        >
            <AuthenticatedApp />
        </PrivyProvider>
    );
}

function AuthenticatedApp() {
    const { ready, authenticated, user, login, logout } = usePrivy();
    const [activeView, setActiveView] = useState<ActiveView>('discover');

    useEffect(() => {
        if (!ready || !authenticated || !user) return;
        const address = extractSolanaAddress(user);
        store.getState().setAuth({
            authenticated: true,
            publicKey: address,
            email: user.email?.address ?? null,
            privyUserId: user.id,
        });
    }, [ready, authenticated, user]);

    if (!ready) {
        return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>;
    }

    if (!authenticated) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center space-y-6">
                    <h1 className="text-4xl font-bold">AgentM</h1>
                    <p className="text-gray-400">AI Agent Economy — Find agents, delegate tasks, earn reputation</p>
                    <button
                        onClick={login}
                        className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-lg font-medium transition"
                    >
                        Sign in with Google
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen">
            <Sidebar activeView={activeView} setActiveView={setActiveView} onLogout={logout} />
            <main className="flex-1 overflow-hidden">
                {activeView === 'me' && <MeView />}
                {activeView === 'discover' && <DiscoverView />}
                {activeView === 'chat' && <ChatView />}
            </main>
        </div>
    );
}

function DemoApp() {
    const [activeView, setActiveView] = useState<ActiveView>('discover');

    useEffect(() => {
        store.getState().setAuth({
            authenticated: true,
            publicKey: 'DEMO_WEB_' + Math.random().toString(36).slice(2, 10),
            email: 'demo@agentm.xyz',
            privyUserId: 'demo-web',
        });
    }, []);

    return (
        <div className="flex h-[80vh] w-[90vw] border border-gray-800 rounded-2xl overflow-hidden mt-4">
            <Sidebar activeView={activeView} setActiveView={setActiveView} onLogout={() => {}} />
            <main className="flex-1 overflow-hidden">
                {activeView === 'me' && <MeView />}
                {activeView === 'discover' && <DiscoverView />}
                {activeView === 'chat' && <ChatView />}
            </main>
        </div>
    );
}

function Sidebar({
    activeView,
    setActiveView,
    onLogout,
}: {
    activeView: ActiveView;
    setActiveView: (v: ActiveView) => void;
    onLogout: () => void;
}) {
    const tabs: { key: ActiveView; label: string }[] = [
        { key: 'discover', label: 'Discover' },
        { key: 'me', label: 'My Agent' },
        { key: 'chat', label: 'Chat' },
    ];

    return (
        <aside className="w-48 bg-gray-900 border-r border-gray-800 flex flex-col">
            <div className="p-4">
                <h2 className="text-lg font-bold">AgentM</h2>
                <p className="text-xs text-gray-500">Web</p>
            </div>
            <nav className="flex-1 px-2 space-y-1">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveView(tab.key)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                            activeView === tab.key
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:bg-gray-800'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>
            <div className="p-4">
                <button
                    onClick={onLogout}
                    className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-white transition"
                >
                    Logout
                </button>
            </div>
        </aside>
    );
}

function extractSolanaAddress(user: User): string {
    const solanaWallet = user.linkedAccounts?.find(
        (a) => a.type === 'wallet' && a.chainType === 'solana',
    );
    if (solanaWallet && 'address' in solanaWallet) {
        return solanaWallet.address as string;
    }
    return user.id;
}
