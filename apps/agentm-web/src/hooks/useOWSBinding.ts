'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OWSDaemonClient, type DaemonWallet } from '@/lib/ows/daemon-client';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';

export interface OWSBindingState {
  // Legacy local binding (for backward compatibility)
  localBinding: {
    accountKey: string;
    loginEmail: string | null;
    provider: 'dynamic';
    chain: 'solana';
    masterWallet: string;
    owsDid: string;
    agentWalletId: string;
    source: 'local_persistence';
    boundAt: number;
    updatedAt: number;
  } | null;
  // Daemon-managed wallet
  daemonWallet: DaemonWallet | null;
  isBound: boolean;
  status: 'unbound' | 'bound' | 'wallet_changed';
}

const LEGACY_STORAGE_KEY = 'agentm:ows:agent-wallet-binding:v1';

/**
 * useOWSBinding - Enhanced to use Daemon API for real OWS wallet management
 * 
 * GRA-222: Upgraded to delegate wallet operations to daemon instead of
 * managing keys entirely in localStorage.
 */
export function useOWSBinding(params: {
  accountKey: string | null;
  loginEmail: string | null;
  selectedWallet: string | null;
}) {
  const { accountKey, loginEmail, selectedWallet } = params;
  const { daemonUrl, sessionToken } = useDaemonConnection();
  
  const [binding, setBinding] = useState<OWSBindingState['localBinding']>(null);
  const [daemonWallet, setDaemonWallet] = useState<DaemonWallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(() => {
    return new OWSDaemonClient(daemonUrl, sessionToken);
  }, [daemonUrl, sessionToken]);

  // Load legacy binding from localStorage
  useEffect(() => {
    if (!accountKey) {
      setBinding(null);
      return;
    }
    const legacy = loadLegacyBinding(accountKey);
    setBinding(legacy);
  }, [accountKey]);

  // Sync with daemon wallet list
  useEffect(() => {
    if (!sessionToken) {
      setDaemonWallet(null);
      return;
    }
    
    const syncDaemonWallet = async () => {
      try {
        const wallets = await client.listWallets();
        // Find wallet matching selectedWallet or binding
        const match = wallets.find(w => 
          w.accounts.some(a => a.address === selectedWallet) ||
          w.solanaAddress === selectedWallet ||
          (binding && w.accounts.some(a => a.address === binding.masterWallet))
        );
        setDaemonWallet(match || null);
      } catch {
        setDaemonWallet(null);
      }
    };
    
    syncDaemonWallet();
  }, [client, sessionToken, selectedWallet, binding]);

  /**
   * Bind selected wallet - creates daemon wallet via API
   * GRA-222 Task 1: Call daemon POST /api/v1/ows/wallets
   */
  const bindSelectedWallet = useCallback(async () => {
    if (!accountKey || !selectedWallet) {
      setError('Select a wallet before binding to OWS.');
      return null;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Try daemon first
      if (sessionToken) {
        const walletName = `agent-${selectedWallet.slice(0, 8)}`;
        const wallet = await client.createWallet(walletName);
        setDaemonWallet(wallet);
        
        // Also save legacy binding for compatibility
        const legacyBinding = saveLegacyBinding({
          accountKey,
          loginEmail,
          walletAddress: selectedWallet,
        });
        setBinding(legacyBinding);
        
        return {
          ...legacyBinding,
          daemonWallet: wallet,
        };
      }
      
      // Fallback: local only
      const legacyBinding = saveLegacyBinding({
        accountKey,
        loginEmail,
        walletAddress: selectedWallet,
      });
      setBinding(legacyBinding);
      return legacyBinding;
      
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OWS binding failed';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [accountKey, loginEmail, selectedWallet, client, sessionToken]);

  const unbind = useCallback(() => {
    if (!accountKey) return;
    
    // Clear local binding
    clearLegacyBinding(accountKey);
    setBinding(null);
    setDaemonWallet(null);
    
    // Note: Daemon wallet is not deleted, just unlinked from this session
  }, [accountKey]);

  const status = useMemo(() => {
    if (daemonWallet) return 'bound';
    if (binding && selectedWallet && binding.masterWallet === selectedWallet) return 'bound';
    if (binding && selectedWallet && binding.masterWallet !== selectedWallet) return 'wallet_changed';
    if (binding) return 'bound';
    return 'unbound';
  }, [binding, selectedWallet, daemonWallet]);

  const isBound = status === 'bound';
  const providerAvailable = typeof window !== 'undefined';

  return {
    binding,
    daemonWallet,
    isBound,
    error,
    loading,
    providerAvailable,
    status,
    bindSelectedWallet,
    unbind,
  } as const;
}

// ---- Legacy localStorage helpers (for backward compatibility) ----

function loadLegacyBinding(accountKey: string) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, OWSBindingState['localBinding']>;
    return map[accountKey] ?? null;
  } catch {
    return null;
  }
}

function saveLegacyBinding(input: {
  accountKey: string;
  loginEmail: string | null;
  walletAddress: string;
}) {
  const now = Date.now();
  const record = {
    accountKey: input.accountKey,
    loginEmail: input.loginEmail,
    provider: 'dynamic' as const,
    chain: 'solana' as const,
    masterWallet: input.walletAddress,
    owsDid: `did:ows:solana:${input.walletAddress}`,
    agentWalletId: `ows-agent:${input.walletAddress.slice(0, 8).toLowerCase()}`,
    source: 'local_persistence' as const,
    boundAt: now,
    updatedAt: now,
  };

  if (typeof window !== 'undefined') {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[input.accountKey] = record;
    window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(map));
  }
  
  return record;
}

function clearLegacyBinding(accountKey: string) {
  if (typeof window === 'undefined') return;
  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return;
  const map = JSON.parse(raw);
  delete map[accountKey];
  window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(map));
}
