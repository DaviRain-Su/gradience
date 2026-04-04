'use client';

import { useEffect, useRef } from 'react';
import { useConnection } from '@/lib/connection/ConnectionContext';
import type { OWSAgentSubWallet } from '@/lib/ows/agent-router';

/**
 * Registers the user (or their active agent sub-wallet) on the network.
 * When an active sub-wallet exists, the network identity becomes the
 * sub-wallet's handle and address instead of the master wallet.
 */
export function useNetworkRegistration(params: {
    masterWallet: string | null;
    displayName: string;
    activeSubWallet: OWSAgentSubWallet | null;
    subWallets: OWSAgentSubWallet[];
}) {
    const { masterWallet, displayName, activeSubWallet, subWallets } = params;
    const { sessionToken, fetchApi } = useConnection();
    const registeredKeyRef = useRef<string | null>(null);
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Determine the identity to register
    const agentPublicKey = activeSubWallet?.walletAddress ?? masterWallet;
    const agentDisplayName = activeSubWallet?.handle ?? displayName;
    const capabilities = activeSubWallet
        ? ['chat', 'social', 'agent-sub-wallet']
        : ['chat', 'social'];

    useEffect(() => {
        if (!sessionToken || !agentPublicKey) return;

        const regKey = `${agentPublicKey}:${agentDisplayName}`;
        if (registeredKeyRef.current === regKey) return;

        // If previously registered a different identity, unregister it
        const prevKey = registeredKeyRef.current;
        if (prevKey) {
            const prevPubkey = prevKey.split(':')[0];
            if (prevPubkey && prevPubkey !== agentPublicKey) {
                fetchApi(`/api/v1/network/agents/${prevPubkey}`, {
                    method: 'DELETE',
                }).catch(() => {});
            }
        }

        registeredKeyRef.current = regKey;

        // Register with current identity
        fetchApi('/api/v1/network/register', {
            method: 'POST',
            body: JSON.stringify({
                publicKey: agentPublicKey,
                displayName: agentDisplayName,
                capabilities,
                version: '0.1.0',
                metadata: {
                    masterWallet,
                    isSubWallet: !!activeSubWallet,
                    handle: activeSubWallet?.handle ?? null,
                    subWalletCount: subWallets.length,
                },
            }),
        }).catch(err => {
            console.warn('Network registration failed:', err);
            registeredKeyRef.current = null;
        });

        // Clear old heartbeat
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);

        // Start heartbeat for current identity
        heartbeatRef.current = setInterval(() => {
            fetchApi('/api/v1/network/heartbeat', {
                method: 'POST',
                body: JSON.stringify({ publicKey: agentPublicKey }),
            }).catch(() => {});
        }, 60_000);

        return () => {
            if (heartbeatRef.current) {
                clearInterval(heartbeatRef.current);
                heartbeatRef.current = null;
            }
        };
    }, [sessionToken, agentPublicKey, agentDisplayName, masterWallet, activeSubWallet, subWallets.length, capabilities, fetchApi]);

    return { registeredAs: agentPublicKey, registeredName: agentDisplayName };
}
