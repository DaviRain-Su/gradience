import { useEffect, useMemo, useState } from 'react';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import type { User } from '@privy-io/react-auth';
import { Sidebar } from './components/sidebar.tsx';
import { MeView } from './views/MeView.tsx';
import { DiscoverView } from './views/DiscoverView.tsx';
import { ChatView } from './views/ChatView.tsx';
import { useAppStore } from './hooks/useAppStore.ts';
import { MockAuthProvider } from './lib/auth.ts';
import { EMPTY_AUTH, type ActiveView } from '../shared/types.ts';

export function App() {
    const privyAppId = (
        import.meta as unknown as { env?: { VITE_PRIVY_APP_ID?: string } }
    ).env?.VITE_PRIVY_APP_ID;

    if (privyAppId) {
        return (
            <PrivyProvider
                appId={privyAppId}
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

    return <DemoApp />;
}

function DemoApp() {
    const activeView = useAppStore((s) => s.activeView);
    const authenticated = useAppStore((s) => s.auth.authenticated);
    const setAuth = useAppStore((s) => s.setAuth);
    const authProvider = useMemo(() => new MockAuthProvider(), []);

    if (!authenticated) {
        return <DemoLoginScreen authProvider={authProvider} />;
    }

    const handleLogout = async () => {
        await authProvider.logout();
        setAuth(EMPTY_AUTH);
    };

    return <AppShell activeView={activeView} onLogout={handleLogout} />;
}

function PrivyApp() {
    const activeView = useAppStore((s) => s.activeView);
    const setAuth = useAppStore((s) => s.setAuth);

    const { ready, authenticated, user, login, logout } = usePrivy();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!ready) return;

        if (!authenticated || !user) {
            setAuth(EMPTY_AUTH);
            return;
        }

        setAuth({
            authenticated: true,
            publicKey: extractSolanaAddress(user),
            email: user.email?.address ?? null,
            privyUserId: user.id,
        });
    }, [ready, authenticated, user, setAuth]);

    if (!ready) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p className="text-sm text-gray-400">Initializing Privy...</p>
            </div>
        );
    }

    const handleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            await login();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        setLoading(true);
        setError(null);
        try {
            await logout();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Logout failed');
        } finally {
            setAuth(EMPTY_AUTH);
            setLoading(false);
        }
    };

    if (!authenticated) {
        return (
            <PrivyLoginScreen
                loading={loading}
                error={error}
                onLogin={handleLogin}
            />
        );
    }

    return (
        <>
            {error && (
                <p className="fixed top-2 right-2 z-50 text-xs text-red-300 bg-red-950/80 border border-red-700 rounded px-2 py-1">
                    {error}
                </p>
            )}
            <AppShell activeView={activeView} onLogout={handleLogout} />
        </>
    );
}

function AppShell({
    activeView,
    onLogout,
}: {
    activeView: ActiveView;
    onLogout: () => Promise<void>;
}) {
    return (
        <div className="flex h-screen">
            <Sidebar onLogout={onLogout} />
            <main className="flex-1 flex flex-col overflow-hidden">
                {activeView === 'me' && <MeView />}
                {activeView === 'discover' && <DiscoverView />}
                {activeView === 'chat' && <ChatView />}
            </main>
        </div>
    );
}

function DemoLoginScreen({ authProvider }: { authProvider: MockAuthProvider }) {
    const setAuth = useAppStore((s) => s.setAuth);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            const state = await authProvider.login();
            setAuth(state);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <LoginScreenLayout
            loading={loading}
            error={error}
            onLogin={handleLogin}
            modeLabel="Demo mode (set VITE_PRIVY_APP_ID for real Google OAuth)"
        />
    );
}

function PrivyLoginScreen({
    loading,
    error,
    onLogin,
}: {
    loading: boolean;
    error: string | null;
    onLogin: () => Promise<void>;
}) {
    return (
        <LoginScreenLayout
            loading={loading}
            error={error}
            onLogin={onLogin}
            modeLabel="Powered by Privy (Google OAuth + embedded Solana wallet)"
        />
    );
}

function LoginScreenLayout({
    loading,
    error,
    onLogin,
    modeLabel,
}: {
    loading: boolean;
    error: string | null;
    onLogin: () => void | Promise<void>;
    modeLabel: string;
}) {
    return (
        <div className="flex items-center justify-center h-screen">
            <div className="text-center space-y-6">
                <h1 className="text-4xl font-bold">Agent.im</h1>
                <p className="text-gray-400">The Super App for the Agent Economy</p>
                <button
                    onClick={onLogin}
                    disabled={loading}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded-lg font-medium transition"
                >
                    {loading ? 'Signing in...' : 'Sign in with Google'}
                </button>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <p className="text-xs text-gray-500">{modeLabel}</p>
            </div>
        </div>
    );
}

function extractSolanaAddress(user: User): string | null {
    const linkedSolana = user.linkedAccounts.find(
        (account) =>
            account.type === 'wallet' &&
            'chainType' in account &&
            account.chainType === 'solana' &&
            'address' in account &&
            typeof account.address === 'string',
    );
    if (linkedSolana && 'address' in linkedSolana && typeof linkedSolana.address === 'string') {
        return linkedSolana.address;
    }

    if (user.wallet?.chainType === 'solana') {
        return user.wallet.address;
    }
    return null;
}
