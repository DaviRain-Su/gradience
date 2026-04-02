import { useEffect, useState } from 'react';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import type { User } from '@privy-io/react-auth';
import { useAppStore, store } from './hooks/useAppStore';
import { registerIdentity } from './lib/identity-registration';
import { Sidebar } from './components/sidebar';
import { MeView } from './views/MeView';
import { DiscoverView } from './views/DiscoverView';
import { ChatView } from './views/ChatView';
import { EMPTY_AUTH } from './types';

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID ?? '';

export function App() {
    if (!PRIVY_APP_ID) {
        return <DemoApp />;
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
            <PrivyApp />
        </PrivyProvider>
    );
}

function PrivyApp() {
    const { ready, authenticated, user, login, logout } = usePrivy();
    const setAuth = useAppStore((s) => s.setAuth);
    const activeView = useAppStore((s) => s.activeView);
    const setActiveView = useAppStore((s) => s.setActiveView);
    const getIdentityRegistrationStatus = useAppStore((s) => s.getIdentityRegistrationStatus);
    const setIdentityRegistrationStatus = useAppStore((s) => s.setIdentityRegistrationStatus);

    const currentAddress = authenticated && user ? extractSolanaAddress(user) : null;

    useEffect(() => {
        if (!ready || !authenticated || !user) return;
        setAuth({
            authenticated: true,
            publicKey: extractSolanaAddress(user),
            email: user.email?.address ?? null,
            privyUserId: user.id,
        });
    }, [ready, authenticated, user, setAuth]);

    // Auto identity registration
    useEffect(() => {
        if (!ready || !authenticated || !currentAddress) return;
        const existing = getIdentityRegistrationStatus(currentAddress);
        if (existing?.state === 'registered' || existing?.state === 'pending' || existing?.state === 'disabled') return;

        setIdentityRegistrationStatus({
            agent: currentAddress,
            state: 'pending',
            agentId: null,
            txHash: null,
            error: null,
            updatedAt: Date.now(),
        });
        registerIdentity({
            agent: currentAddress,
            email: user?.email?.address ?? null,
        }).then((status) => {
            setIdentityRegistrationStatus(status);
        });
    }, [ready, authenticated, currentAddress, user?.email?.address, getIdentityRegistrationStatus, setIdentityRegistrationStatus]);

    if (!ready) {
        return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>;
    }

    if (!authenticated) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center space-y-6">
                    <h1 className="text-4xl font-bold">AgentM</h1>
                    <p className="text-gray-400 max-w-md mx-auto">
                        AI Agent Economy — Find agents, delegate tasks, earn reputation.
                        Powered by Gradience Protocol on Solana.
                    </p>
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
            <Sidebar />
            <main className="flex-1 overflow-hidden">
                {activeView === 'me' && <MeView />}
                {activeView === 'discover' && <DiscoverView />}
                {activeView === 'chat' && <ChatView />}
            </main>
        </div>
    );
}

function DemoApp() {
    const activeView = useAppStore((s) => s.activeView);

    useEffect(() => {
        store.getState().setAuth({
            authenticated: true,
            publicKey: 'DEMO_WEB_' + Math.random().toString(36).slice(2, 10),
            email: 'demo@agentm.xyz',
            privyUserId: 'demo-web',
        });
    }, []);

    return (
        <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-hidden">
                {activeView === 'me' && <MeView />}
                {activeView === 'discover' && <DiscoverView />}
                {activeView === 'chat' && <ChatView />}
            </main>
        </div>
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
