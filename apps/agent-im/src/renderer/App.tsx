import { useState } from 'react';
import { Sidebar } from './components/sidebar.tsx';
import { MeView } from './views/MeView.tsx';
import { DiscoverView } from './views/DiscoverView.tsx';
import { ChatView } from './views/ChatView.tsx';
import { useAppStore } from './hooks/useAppStore.ts';
import { createAuthProvider } from './lib/auth.ts';

const authProvider = createAuthProvider();

export function App() {
    const activeView = useAppStore((s) => s.activeView);
    const authenticated = useAppStore((s) => s.auth.authenticated);

    if (!authenticated) {
        return <LoginScreen />;
    }

    return (
        <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 flex flex-col overflow-hidden">
                {activeView === 'me' && <MeView />}
                {activeView === 'discover' && <DiscoverView />}
                {activeView === 'chat' && <ChatView />}
            </main>
        </div>
    );
}

function LoginScreen() {
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
        <div className="flex items-center justify-center h-screen">
            <div className="text-center space-y-6">
                <h1 className="text-4xl font-bold">Agent.im</h1>
                <p className="text-gray-400">The Super App for the Agent Economy</p>
                <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded-lg font-medium transition"
                >
                    {loading ? 'Signing in...' : 'Sign in with Google'}
                </button>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <p className="text-xs text-gray-500">
                    {import.meta.env?.VITE_PRIVY_APP_ID
                        ? 'Powered by Privy'
                        : 'Demo mode (set VITE_PRIVY_APP_ID for real Google OAuth)'}
                </p>
            </div>
        </div>
    );
}
