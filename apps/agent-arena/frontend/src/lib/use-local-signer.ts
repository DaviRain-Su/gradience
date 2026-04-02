'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TransactionSigner } from '@solana/kit';

import { clearSecret, loadSecret, saveSecret, signerFromSecret } from './wallet';

export interface LocalSignerState {
    signer: TransactionSigner | null;
    signerAddress: string | null;
    secretInput: string;
    setSecretInput: (value: string) => void;
    connecting: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
}

export function useLocalSigner(): LocalSignerState {
    const [secretInput, setSecretInput] = useState('');
    const [signer, setSigner] = useState<TransactionSigner | null>(null);
    const [connecting, setConnecting] = useState(false);

    useEffect(() => {
        const cached = loadSecret();
        if (!cached) {
            return;
        }
        setSecretInput(cached);
        setConnecting(true);
        void signerFromSecret(cached)
            .then(connectedSigner => {
                setSigner(connectedSigner);
            })
            .catch(() => {
                clearSecret();
                setSecretInput('');
                setSigner(null);
            })
            .finally(() => setConnecting(false));
    }, []);

    const connect = useCallback(async () => {
        setConnecting(true);
        try {
            const connectedSigner = await signerFromSecret(secretInput.trim());
            setSigner(connectedSigner);
            saveSecret(secretInput.trim());
        } finally {
            setConnecting(false);
        }
    }, [secretInput]);

    const disconnect = useCallback(() => {
        clearSecret();
        setSecretInput('');
        setSigner(null);
    }, []);

    const signerAddress = useMemo(() => (signer ? String(signer.address) : null), [signer]);

    return {
        signer,
        signerAddress,
        secretInput,
        setSecretInput,
        connecting,
        connect,
        disconnect,
    };
}
