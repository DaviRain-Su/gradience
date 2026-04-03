'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { ActiveView } from '@/types';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useProStore } from '@/lib/store';
import { DashboardView } from '@/views/DashboardView';

const ProfilesView = dynamic(() => import('@/views/ProfilesView').then((module) => module.ProfilesView), {
    loading: () => <ViewLoading label="Loading Profiles..." />,
});
const StatsView = dynamic(() => import('@/views/StatsView').then((module) => module.StatsView), {
    loading: () => <ViewLoading label="Loading Stats..." />,
});
const SettingsView = dynamic(() => import('@/views/SettingsView').then((module) => module.SettingsView), {
    loading: () => <ViewLoading label="Loading Settings..." />,
});
const OWSView = dynamic(() => import('@/views/OWSView').then((module) => module.OWSView), {
    loading: () => <ViewLoading label="Loading Wallet..." />,
});

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

export default function ProAppPage() {
    if (!PRIVY_APP_ID) {
        return <ProShell demoMode />;
    }

    return <PrivyShell />;
}

function PrivyShell() {
    const { ready, authenticated, login, logout, publicKey, email, user } = useAuth();

    if (!ready) {
        return <LoadingScreen />;
    }

    if (!authenticated) {
        return <LoginScreen onLogin={login} />;
    }

    return (
        <ProShell
            demoMode={false}
            address={publicKey}
            email={email}
            privyUserId={user?.id ?? null}
            onLogin={login}
            onLogout={logout}
        />
    );
}

function ProShell({
    demoMode,
    address,
    email,
    privyUserId,
    onLogin,
    onLogout,
}: {
    demoMode: boolean;
    address?: string | null;
    email?: string | null;
    privyUserId?: string | null;
    onLogin?: () => void;
    onLogout?: () => void;
}) {
    const activeView = useProStore((state) => state.activeView);
    const setActiveView = useProStore((state) => state.setActiveView);
    const setAuth = useProStore((state) => state.setAuth);
    const demoAddress = useMemo(() => 'DEMO_' + Math.random().toString(36).slice(2, 8), []);

    useEffect(() => {
        setAuth({
            authenticated: !demoMode,
            publicKey: address ?? null,
            email: email ?? null,
            privyUserId: privyUserId ?? null,
        });
    }, [address, demoMode, email, privyUserId, setAuth]);

    return (
        <Layout
            activeView={activeView}
            onViewChange={setActiveView}
            address={address ?? demoAddress}
            email={email ?? null}
            demoMode={demoMode}
            onLogin={onLogin ?? (() => {})}
            onLogout={onLogout ?? (() => {})}
        >
            {renderView(activeView, address ?? demoAddress)}
        </Layout>
    );
}

function renderView(activeView: ActiveView, owner: string): ReactNode {
    switch (activeView) {
        case 'dashboard':
            return <DashboardView />;
        case 'profiles':
            return <ProfilesView owner={owner} />;
        case 'stats':
            return <StatsView owner={owner} />;
        case 'wallet':
            return <OWSView />;
        case 'settings':
            return <SettingsView />;
        default:
            return <DashboardView />;
    }
}

function LoadingScreen() {
    return <div className="h-screen flex items-center justify-center text-gray-400">Loading AgentM Pro...</div>;
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
    return (
        <div className="h-screen flex items-center justify-center px-6">
            <div className="max-w-md text-center space-y-6">
                <h1 className="text-4xl font-bold">AgentM Pro</h1>
                <p className="text-gray-400">
                    Sign in to manage agent profiles, versions, and protocol integrations.
                </p>
                <button
                    onClick={onLogin}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-lg font-medium transition"
                >
                    Sign In
                </button>
                <p className="text-xs text-gray-600">
                    <Link href="/" className="hover:text-gray-400">
                        Back to landing
                    </Link>
                </p>
            </div>
        </div>
    );
}

function ViewLoading({ label }: { label: string }) {
    return <div className="text-sm text-gray-500">{label}</div>;
}
