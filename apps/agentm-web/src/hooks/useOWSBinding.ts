'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OWSAgentWalletManager, type OWSAgentWalletBinding } from '@/lib/ows/agent-wallet';

export function useOWSBinding(params: {
    accountKey: string | null;
    loginEmail: string | null;
    selectedWallet: string | null;
}) {
    const { accountKey, loginEmail, selectedWallet } = params;
    const managerRef = useRef(new OWSAgentWalletManager());
    const [binding, setBinding] = useState<OWSAgentWalletBinding | null>(null);
    const [bindingError, setBindingError] = useState<string | null>(null);
    const [bindingBusy, setBindingBusy] = useState(false);

    useEffect(() => {
        if (!accountKey) {
            setBinding(null);
            return;
        }
        setBinding(managerRef.current.getBinding(accountKey));
    }, [accountKey]);

    const bindSelectedWallet = useCallback(() => {
        if (!accountKey || !selectedWallet) {
            setBindingError('Select a wallet before binding to OWS.');
            return null;
        }
        setBindingBusy(true);
        setBindingError(null);
        try {
            const next = managerRef.current.bindMasterWallet({
                accountKey,
                loginEmail,
                walletAddress: selectedWallet,
            });
            setBinding(next);
            return next;
        } catch (err) {
            setBindingError(err instanceof Error ? err.message : 'OWS binding failed');
            return null;
        } finally {
            setBindingBusy(false);
        }
    }, [accountKey, loginEmail, selectedWallet]);

    const unbind = useCallback(() => {
        if (!accountKey) return;
        managerRef.current.unbind(accountKey);
        setBinding(null);
        setBindingError(null);
    }, [accountKey]);

    const providerAvailable = managerRef.current.isProviderAvailable();
    const status = useMemo(() => {
        if (binding && selectedWallet && binding.masterWallet === selectedWallet) return 'bound';
        if (binding && selectedWallet && binding.masterWallet !== selectedWallet) return 'wallet_changed';
        if (binding) return 'bound';
        return 'unbound';
    }, [binding, selectedWallet]);

    return {
        binding,
        bindingError,
        bindingBusy,
        providerAvailable,
        status,
        bindSelectedWallet,
        unbind,
    } as const;
}
