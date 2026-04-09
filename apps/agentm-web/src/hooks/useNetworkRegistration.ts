// @ts-nocheck
'use client';

import { useEffect, useRef, useState } from 'react';
import { useConnection } from '@/lib/connection/ConnectionContext';
import { reverse } from '../lib/mocks/domain-resolver';
import type { OWSAgentSubWallet } from '@/lib/ows/agent-router';

/**
 * Registers the user (or their active agent sub-wallet) on the network.
 * Automatically looks up .sol domain for the active wallet address.
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
    const [solDomain, setSolDomain] = useState<string | null>(null);

    const agentPublicKey = activeSubWallet?.walletAddress ?? masterWallet;
    const agentDisplayName = activeSubWallet?.handle ?? displayName;
    const capabilities = activeSubWallet ? ['chat', 'social', 'agent-sub-wallet'] : ['chat', 'social'];

    // Reverse-lookup .sol domain for the active wallet
    useEffect(() => {
        if (!agentPublicKey) {
            setSolDomain(null);
            return;
        }
        let cancelled = false;
        reverse(agentPublicKey)
            .then((d) => {
                if (!cancelled) setSolDomain(d ?? null);
            })
            .catch(() => {
                if (!cancelled) setSolDomain(null);
            });
        return () => {
            cancelled = true;
        };
    }, [agentPublicKey]);

    // Register on network
    useEffect(() => {
        if (!sessionToken || !agentPublicKey) return;

        const regKey = `${agentPublicKey}:${agentDisplayName}:${solDomain ?? ''}`;
        if (registeredKeyRef.current === regKey) return;

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

        fetchApi('/api/v1/network/register', {
            method: 'POST',
            body: JSON.stringify({
                publicKey: agentPublicKey,
                displayName: solDomain || agentDisplayName,
                capabilities,
                version: '0.1.0',
                metadata: {
                    masterWallet,
                    isSubWallet: !!activeSubWallet,
                    handle: activeSubWallet?.handle ?? null,
                    subWalletCount: subWallets.length,
                    solDomain: solDomain ?? undefined,
                },
            }),
        }).catch((err) => {
            console.warn('Network registration failed:', err);
            registeredKeyRef.current = null;
        });

        if (heartbeatRef.current) clearInterval(heartbeatRef.current);

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
    }, [
        sessionToken,
        agentPublicKey,
        agentDisplayName,
        solDomain,
        masterWallet,
        activeSubWallet,
        subWallets.length,
        capabilities,
        fetchApi,
    ]);

    return { registeredAs: agentPublicKey, registeredName: solDomain || agentDisplayName, solDomain };
}
