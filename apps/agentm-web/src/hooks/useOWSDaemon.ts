'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { OWSDaemonClient, type DaemonWallet, type DaemonPolicy, type DaemonApiKey } from '@/lib/ows/daemon-client';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';

export function useOWSDaemon() {
    const { daemonUrl, sessionToken } = useDaemonConnection();
    const [wallets, setWallets] = useState<DaemonWallet[]>([]);
    const [policies, setPolicies] = useState<DaemonPolicy[]>([]);
    const [apiKeys, setApiKeys] = useState<DaemonApiKey[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const client = useMemo(() => {
        const c = new OWSDaemonClient(daemonUrl, sessionToken);
        return c;
    }, [daemonUrl, sessionToken]);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [w, p, k] = await Promise.all([
                client.listWallets().catch(() => [] as DaemonWallet[]),
                client.listPolicies().catch(() => [] as DaemonPolicy[]),
                client.listApiKeys().catch(() => [] as DaemonApiKey[]),
            ]);
            setWallets(w);
            setPolicies(p);
            setApiKeys(k);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load OWS data');
        } finally {
            setLoading(false);
        }
    }, [client]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const createWallet = useCallback(
        async (name: string, passphrase?: string) => {
            setError(null);
            try {
                const wallet = await client.createWallet(name, passphrase);
                setWallets((prev) => [wallet, ...prev]);
                return wallet;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to create wallet');
                return null;
            }
        },
        [client],
    );

    const deleteWallet = useCallback(
        async (id: string) => {
            try {
                await client.deleteWallet(id);
                setWallets((prev) => prev.filter((w) => w.id !== id));
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to delete wallet');
            }
        },
        [client],
    );

    const exportWallet = useCallback(
        async (nameOrId: string, passphrase?: string) => {
            try {
                return await client.exportWallet(nameOrId, passphrase);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to export wallet');
                return null;
            }
        },
        [client],
    );

    const importMnemonic = useCallback(
        async (name: string, mnemonic: string, passphrase?: string) => {
            try {
                const wallet = await client.importMnemonic(name, mnemonic, passphrase);
                setWallets((prev) => [wallet, ...prev]);
                return wallet;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to import wallet');
                return null;
            }
        },
        [client],
    );

    const createPolicy = useCallback(
        async (policy: { id: string; name: string; rules?: Array<{ type: string; [key: string]: unknown }> }) => {
            try {
                await client.createPolicy(policy);
                await refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to create policy');
            }
        },
        [client, refresh],
    );

    const deletePolicy = useCallback(
        async (id: string) => {
            try {
                await client.deletePolicy(id);
                setPolicies((prev) => prev.filter((p) => p.id !== id));
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to delete policy');
            }
        },
        [client],
    );

    const createApiKey = useCallback(
        async (params: {
            name: string;
            walletIds: string[];
            policyIds: string[];
            passphrase: string;
            expiresAt?: string;
        }) => {
            try {
                const result = await client.createApiKey(params);
                setApiKeys((prev) => [result, ...prev]);
                return result;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to create API key');
                return null;
            }
        },
        [client],
    );

    const revokeApiKey = useCallback(
        async (id: string) => {
            try {
                await client.revokeApiKey(id);
                setApiKeys((prev) => prev.filter((k) => k.id !== id));
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to revoke API key');
            }
        },
        [client],
    );

    const signMessage = useCallback(
        async (params: {
            wallet: string;
            chain: string;
            message: string;
            credential?: string;
            policyIds?: string[];
        }) => {
            try {
                return await client.signMessage(params);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Signing failed');
                return null;
            }
        },
        [client],
    );

    const signTransaction = useCallback(
        async (params: {
            wallet: string;
            chain: string;
            txHex: string;
            credential?: string;
            policyIds?: string[];
            amount?: number;
        }) => {
            try {
                return await client.signTransaction(params);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Signing failed');
                return null;
            }
        },
        [client],
    );

    const getAuditLog = useCallback(
        async (limit = 50) => {
            try {
                return await client.getAuditLog(limit);
            } catch {
                return [];
            }
        },
        [client],
    );

    return {
        wallets,
        policies,
        apiKeys,
        loading,
        error,
        refresh,
        createWallet,
        deleteWallet,
        exportWallet,
        importMnemonic,
        createPolicy,
        deletePolicy,
        createApiKey,
        revokeApiKey,
        signMessage,
        signTransaction,
        getAuditLog,
        client,
    } as const;
}
