'use client';

import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { ConnectionProvider as SolanaConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { ConnectionProvider as DaemonConnectionProvider } from '../../lib/connection/ConnectionContext';
import { ErrorBoundary } from '../../components/ErrorBoundary';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_GRADIENCE_RPC_ENDPOINT || clusterApiUrl('devnet');

export default function AppLayout({ children }: { children: ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const wallets = useMemo(() => [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
    ], []);

    if (!mounted) {
        return (
            <div style={{
                minHeight: '100vh',
                background: '#F3F3F8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <div style={{ color: '#16161A', opacity: 0.6 }}>Loading AgentM...</div>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <SolanaConnectionProvider endpoint={RPC_ENDPOINT}>
                <WalletProvider wallets={wallets} autoConnect>
                    <WalletModalProvider>
                        <DaemonConnectionProvider>
                            {children}
                        </DaemonConnectionProvider>
                    </WalletModalProvider>
                </WalletProvider>
            </SolanaConnectionProvider>
        </ErrorBoundary>
    );
}
