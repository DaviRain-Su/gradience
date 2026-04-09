'use client';

import { useCallback } from 'react';
import { useConnection } from '@/lib/connection/ConnectionContext';

export interface TierInfo {
    tier: 'guest' | 'verified' | 'trusted' | 'pro';
    permissions: {
        maxTaskValue: string;
        canBeJudge: boolean;
        canPostHighValueTask: boolean;
    };
    requirements: {
        walletAgeDays: number;
        oauth: boolean;
        zkKyc: boolean;
        minCompletedTasks: number;
        minReputationScore: number;
    };
    metrics: {
        walletAgeDays: number;
        oauthBound: boolean;
        zkKycBound: boolean;
        completedTasks: number;
        reputationScore: number;
    };
}

export interface BindingInfo {
    accountId: string;
    primaryWallet: string;
    oauthBound: boolean;
    zkKycBound: boolean;
    createdAt: number;
    cooldownRemainingMs: number;
}

export function useIdentity() {
    const { fetchApi } = useConnection();

    const bindWallet = useCallback(
        async (params: {
            accountId: string;
            primaryWallet: string;
            oauthHash?: string;
            signature: string;
        }): Promise<{ accountId: string; primaryWallet: string; createdAt: number } | null> => {
            if (!fetchApi) return null;
            return fetchApi<{ accountId: string; primaryWallet: string; createdAt: number }>('/api/v1/identity/bind', {
                method: 'POST',
                body: JSON.stringify(params),
            });
        },
        [fetchApi],
    );

    const getTier = useCallback(
        async (accountId: string): Promise<TierInfo | null> => {
            if (!fetchApi) return null;
            return fetchApi<TierInfo>(`/api/v1/identity/tier/${encodeURIComponent(accountId)}`);
        },
        [fetchApi],
    );

    const getBinding = useCallback(
        async (wallet: string): Promise<BindingInfo | null> => {
            if (!fetchApi) return null;
            return fetchApi<BindingInfo>(`/api/v1/identity/binding/${encodeURIComponent(wallet)}`);
        },
        [fetchApi],
    );

    const verifyZkKyc = useCallback(
        async (
            accountId: string,
            nullifierHash: string,
        ): Promise<{ accountId: string; zkVerified: boolean; nullifierHash: string } | null> => {
            if (!fetchApi) return null;
            return fetchApi<{ accountId: string; zkVerified: boolean; nullifierHash: string }>(
                '/api/v1/identity/zk-verify',
                {
                    method: 'POST',
                    body: JSON.stringify({ accountId, nullifierHash }),
                },
            );
        },
        [fetchApi],
    );

    return { bindWallet, getTier, getBinding, verifyZkKyc };
}
