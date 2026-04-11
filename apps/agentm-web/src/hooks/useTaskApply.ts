'use client';

import { useState, useCallback } from 'react';
import { applyForTask, type WalletAdapter } from '@/lib/solana/arena-client';
import { createDynamicAdapter } from '@/lib/solana/dynamic-wallet-adapter';
import { useConnection } from '@/lib/connection/ConnectionContext';
import { useIdentity } from './useIdentity';

export interface UseTaskApplyResult {
    apply: (taskId: number | bigint, stake?: string) => Promise<string | null>;
    loading: boolean;
    error: string | null;
    lastSignature: string | null;
}

export function useTaskApply(walletAddress: string | null): UseTaskApplyResult {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSignature, setLastSignature] = useState<string | null>(null);
    const { fetchApi } = useConnection();
    const { getTier } = useIdentity();

    const apply = useCallback(
        async (taskId: number | bigint, _stake?: string): Promise<string | null> => {
            if (!walletAddress) {
                setError('Wallet not connected');
                return null;
            }
            setLoading(true);
            setError(null);
            try {
                // Pre-check 1: On-chain risk assessment
                if (fetchApi) {
                    const riskResult = await fetchApi<{
                        allowed: boolean;
                        score: number;
                        overallRisk: string;
                        signals: Array<{ category: string; severity: string; evidence: string }>;
                    }>('/api/v1/risk/assess', {
                        method: 'POST',
                        body: JSON.stringify({ wallet: walletAddress, chain: 'solana' }),
                    });
                    if (riskResult && !riskResult.allowed) {
                        const reasons = riskResult.signals.map((s) => s.evidence).join('; ');
                        throw new Error(
                            `Risk assessment failed (${riskResult.overallRisk}, score ${riskResult.score}). ${reasons}`,
                        );
                    }
                }

                // Pre-check 2: Verification tier
                const tier = await getTier(walletAddress);
                if (tier && !tier.permissions.canPostHighValueTask && !tier.permissions.canBeJudge) {
                    // Guests cannot apply for any task on Solana until they bind OAuth
                    if (tier.tier === 'guest') {
                        throw new Error(
                            'Account verification required. Please link a social account in Settings to apply for tasks.',
                        );
                    }
                }

                const wallet: WalletAdapter = createDynamicAdapter(walletAddress);
                const sig = await applyForTask({ wallet, taskId });
                setLastSignature(sig);
                return sig;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to apply for task');
                return null;
            } finally {
                setLoading(false);
            }
        },
        [walletAddress, fetchApi, getTier],
    );

    return { apply, loading, error, lastSignature };
}
