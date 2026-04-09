/**
 * React Hook for Passkey Agent Wallet
 *
 * @module hooks/usePasskeyWallet
 */

import { useState, useCallback, useEffect } from 'react';
import {
    createPasskeyWalletManager,
    type PasskeyWalletConfig,
    type AgentWalletCredential,
    type RecoveredWallet,
} from '../lib/ows/passkey-wallet';
import {
    isWebAuthnSupported,
    isPasskeySupported,
    getUserFriendlyErrorMessage,
    type WebAuthnError,
} from '../lib/webauthn/utils';

export interface UsePasskeyWalletOptions {
    rpId: string;
    rpName: string;
    userId: string;
    userName: string;
}

export interface UsePasskeyWalletReturn {
    // 状态
    isSupported: boolean;
    isLoading: boolean;
    error: string | null;
    credentials: AgentWalletCredential[];
    recoveredWallet: RecoveredWallet | null;

    // 方法
    createWallet: (params: {
        agentId: string;
        masterWalletAddress: string;
        derivationIndex?: number;
    }) => Promise<AgentWalletCredential | null>;

    recoverWallet: () => Promise<RecoveredWallet | null>;

    checkSupport: () => Promise<boolean>;

    clearError: () => void;
}

export function usePasskeyWallet(options: UsePasskeyWalletOptions): UsePasskeyWalletReturn {
    const [manager] = useState(() =>
        createPasskeyWalletManager({
            rpId: options.rpId,
            rpName: options.rpName,
            userId: options.userId,
            userName: options.userName,
        }),
    );

    const [isSupported, setIsSupported] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [credentials, setCredentials] = useState<AgentWalletCredential[]>([]);
    const [recoveredWallet, setRecoveredWallet] = useState<RecoveredWallet | null>(null);

    // 检查支持情况
    const checkSupport = useCallback(async (): Promise<boolean> => {
        const supported = isWebAuthnSupported();
        const passkeySupported = await isPasskeySupported();
        setIsSupported(supported && passkeySupported);
        return supported && passkeySupported;
    }, []);

    // 初始检查
    useEffect(() => {
        checkSupport();
    }, [checkSupport]);

    // 创建钱包
    const createWallet = useCallback(
        async (params: {
            agentId: string;
            masterWalletAddress: string;
            derivationIndex?: number;
        }): Promise<AgentWalletCredential | null> => {
            setIsLoading(true);
            setError(null);

            try {
                const credential = await manager.createPasskeyWallet({
                    agentId: params.agentId,
                    masterWalletAddress: params.masterWalletAddress,
                    derivationIndex: params.derivationIndex ?? 0,
                });

                setCredentials((prev) => [...prev, credential]);
                return credential;
            } catch (err) {
                const message =
                    err instanceof Error ? getUserFriendlyErrorMessage(err as WebAuthnError) : '创建钱包失败';
                setError(message);
                return null;
            } finally {
                setIsLoading(false);
            }
        },
        [manager],
    );

    // 恢复钱包
    const recoverWallet = useCallback(async (): Promise<RecoveredWallet | null> => {
        setIsLoading(true);
        setError(null);

        try {
            const wallet = await manager.recoverWallet();
            setRecoveredWallet(wallet);
            return wallet;
        } catch (err) {
            const message = err instanceof Error ? getUserFriendlyErrorMessage(err as WebAuthnError) : '恢复钱包失败';
            setError(message);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [manager]);

    // 清除错误
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        isSupported,
        isLoading,
        error,
        credentials,
        recoveredWallet,
        createWallet,
        recoverWallet,
        checkSupport,
        clearError,
    };
}
