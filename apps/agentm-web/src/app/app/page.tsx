'use client';

import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { lazy, Suspense } from 'react';

// Lazy load the heavy MainApp component with all its dependencies
const MainAppLazy = lazy(() => import('./MainAppLazy'));
const LoginScreen = lazy(() => import('@/app/components/LoginScreen').then((m) => ({ default: m.LoginScreen })));

// Simple loading spinner component
function LoadingSpinner({ text = 'Loading...' }: { text?: string }) {
    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#F3F3F8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <div style={{ textAlign: 'center' }}>
                <div
                    style={{
                        width: '48px',
                        height: '48px',
                        border: '3px solid #C6BBFF',
                        borderTopColor: '#16161A',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 16px',
                    }}
                />
                <p style={{ color: '#16161A', fontSize: '14px' }}>{text}</p>
                <style>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        </div>
    );
}

export default function AppPage() {
    const { primaryWallet, user, sdkHasLoaded } = useDynamicContext();
    const isConnected = !!primaryWallet;

    // Show loading while checking auth status
    if (!sdkHasLoaded) {
        return <LoadingSpinner text="Initializing..." />;
    }

    // Show login screen if not connected
    if (!isConnected) {
        return (
            <Suspense fallback={<LoadingSpinner text="Loading Login..." />}>
                <LoginScreen />
            </Suspense>
        );
    }

    // Show main app when connected - lazy loaded
    const address = primaryWallet.address;
    const email = user?.email || user?.username || address.slice(0, 8) + '...';

    return (
        <Suspense fallback={<LoadingSpinner text="Loading App..." />}>
            <MainAppLazy user={user} walletAddress={address} email={email} />
        </Suspense>
    );
}
