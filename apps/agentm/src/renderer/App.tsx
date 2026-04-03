import { useEffect, useMemo, useState, useCallback } from 'react';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import type { User } from '@privy-io/react-auth';
import { Sidebar } from './components/sidebar.tsx';
import { MeView } from './views/MeView.tsx';
import { DiscoverView } from './views/DiscoverView.tsx';
import { ChatView } from './views/ChatView.tsx';
import { SocialView } from './views/SocialView.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { useAppStore, store } from './hooks/useAppStore.ts';
import { MockAuthProvider } from './lib/auth.ts';
import { EMPTY_AUTH, type ActiveView } from '../shared/types.ts';

// Get Privy App ID from env
const PRIVY_APP_ID = (import.meta as unknown as { env?: { VITE_PRIVY_APP_ID?: string } }).env?.VITE_PRIVY_APP_ID ?? '';

export function App() {
    return (
        <ErrorBoundary>
            {PRIVY_APP_ID ? (
                <PrivyProvider
                    appId={PRIVY_APP_ID}
                    config={{
                        loginMethods: ['google'],
                        embeddedWallets: {
                            solana: { createOnLogin: 'users-without-wallets' },
                        },
                    }}
                >
                    <PrivyAppContent />
                </PrivyProvider>
            ) : (
                <DemoAppContent />
            )}
        </ErrorBoundary>
    );
}

// Demo mode without Privy
function DemoAppContent() {
    const [authState, setAuthState] = useState(() => store.getState().auth);
    const activeView = useAppStore((s) => s.activeView);
    
    const authProvider = useMemo(() => new MockAuthProvider(), []);

    // Sync with store once on mount
    useEffect(() => {
        const unsubscribe = store.subscribe((state) => {
            setAuthState(state.auth);
        });
        return unsubscribe;
    }, []);

    const handleLogin = useCallback(async () => {
        try {
            const state = await authProvider.login();
            store.setState({ auth: state });
        } catch (e) {
            console.error('Login failed:', e);
        }
    }, [authProvider]);

    if (!authState.authenticated) {
        return (
            <LoginScreen
                onLogin={handleLogin}
                modeLabel="Demo mode (set VITE_PRIVY_APP_ID for real Google OAuth)"
            />
        );
    }

    return <AppShell activeView={activeView} />;
}

// Privy mode
function PrivyAppContent() {
    const { ready, authenticated, user, login } = usePrivy();
    const activeView = useAppStore((s) => s.activeView);
    const [authState, setAuthState] = useState(() => store.getState().auth);

    // Sync auth state with store
    useEffect(() => {
        if (!ready) return;

        if (!authenticated || !user) {
            if (store.getState().auth.authenticated) {
                store.setState({ auth: EMPTY_AUTH });
            }
            return;
        }

        const address = extractSolanaAddress(user);
        const currentAuth = store.getState().auth;
        
        // Only update if changed
        if (currentAuth.publicKey !== address || !currentAuth.authenticated) {
            store.setState({
                auth: {
                    authenticated: true,
                    publicKey: address,
                    email: user.email?.address ?? null,
                    privyUserId: user.id,
                }
            });
        }
    }, [ready, authenticated, user?.id]);

    // Subscribe to store changes
    useEffect(() => {
        const unsubscribe = store.subscribe((state) => {
            setAuthState(state.auth);
        });
        return unsubscribe;
    }, []);

    const handleLogin = useCallback(async () => {
        try {
            await login();
        } catch (e) {
            console.error('Login failed:', e);
        }
    }, [login]);

    if (!ready) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p className="text-sm text-gray-400">Initializing...</p>
            </div>
        );
    }

    if (!authenticated || !authState.authenticated) {
        return (
            <LoginScreen
                onLogin={handleLogin}
                modeLabel="Powered by Privy (Google OAuth + embedded Solana wallet)"
            />
        );
    }

    return <AppShell activeView={activeView} />;
}

function AppShell({ activeView }: { activeView: ActiveView }) {
    return (
        <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 flex flex-col overflow-hidden">
                {activeView === 'me' && <MeView />}
                {activeView === 'discover' && <DiscoverView />}
                {activeView === 'chat' && <ChatView />}
                {activeView === 'social' && <SocialView />}
            </main>
        </div>
    );
}

function LoginScreen({ 
    onLogin, 
    modeLabel 
}: { 
    onLogin: () => void | Promise<void>;
    modeLabel: string;
}) {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = useCallback(async () => {
        setIsLoading(true);
        try {
            await onLogin();
        } finally {
            setIsLoading(false);
        }
    }, [onLogin]);

    return (
        <div className="flex items-center justify-center h-screen">
            <div className="text-center space-y-6">
                <h1 className="text-4xl font-bold">AgentM</h1>
                <p className="text-gray-400">The Super App for the Agent Economy</p>
                <button
                    onClick={handleClick}
                    disabled={isLoading}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded-lg font-medium transition"
                >
                    {isLoading ? 'Signing in...' : 'Sign in with Google'}
                </button>
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
