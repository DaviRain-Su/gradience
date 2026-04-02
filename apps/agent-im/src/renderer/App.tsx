import { useEffect } from 'react';
import { Sidebar } from './components/sidebar.tsx';
import { MeView } from './views/MeView.tsx';
import { DiscoverView } from './views/DiscoverView.tsx';
import { ChatView } from './views/ChatView.tsx';
import { useAppStore } from './hooks/useAppStore.ts';

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

    // MVP: mock login (Privy integration later)
    const handleLogin = () => {
        setAuth({
            authenticated: true,
            publicKey: 'DEMO_' + Math.random().toString(36).slice(2, 10),
            email: 'demo@agent.im',
            privyUserId: 'demo-user',
        });
    };

    return (
        <div className="flex items-center justify-center h-screen">
            <div className="text-center space-y-6">
                <h1 className="text-4xl font-bold">Agent.im</h1>
                <p className="text-gray-400">Agent Economy Super App</p>
                <button
                    onClick={handleLogin}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition"
                >
                    Sign in with Google
                </button>
                <p className="text-xs text-gray-500">MVP: demo login (Privy integration pending)</p>
            </div>
        </div>
    );
}
