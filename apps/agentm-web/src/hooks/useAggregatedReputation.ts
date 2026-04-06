'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOWSDaemon } from './useOWSDaemon';
import { 
  calculateAggregateReputation, 
  calculatePolicyFromReputation,
  formatReputation,
  type ReputationTier 
} from '@/lib/ows/reputation-policy';

export interface AgentReputation {
  walletId: string;
  address: string;
  handle: string;
  score: number;
  tier: ReputationTier;
  completedTasks: number;
  avgRating: number;
  weight: number; // For aggregation
}

export interface AggregatedReputation {
  masterWallet: string;
  aggregateScore: number;
  tier: ReputationTier;
  agentCount: number;
  totalCompletedTasks: number;
  agents: AgentReputation[];
  derivedPolicy: {
    dailyLimitUsd: number;
    allowedChains: string[];
    autoApprove: boolean;
  };
}

/**
 * useAggregatedReputation - GRA-225
 * 
 * Fetches reputation for all agent wallets under a master wallet
 * and calculates an aggregate score.
 * 
 * Master Wallet Reputation = Weighted average of agent reputations
 * Weight = Number of completed tasks (more tasks = more weight)
 */
export function useAggregatedReputation(masterWallet: string | null) {
  const { wallets, client } = useOWSDaemon();
  const [reputations, setReputations] = useState<Record<string, {
    score: number;
    completedTasks: number;
    avgRating: number;
  }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch reputation for each wallet
  const fetchReputations = useCallback(async () => {
    if (!masterWallet || wallets.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const reps: Record<string, {
        score: number;
        completedTasks: number;
        avgRating: number;
      }> = {};
      
      for (const wallet of wallets) {
        if (wallet.solanaAddress) {
          try {
            // Fetch from daemon's reputation endpoint
            const rep = await client.getWalletReputation(wallet.id);
            reps[wallet.id] = {
              score: rep.reputationScore,
              completedTasks: rep.completedTasks || 0,
              avgRating: rep.avgRating || 0,
            };
          } catch {
            // If not found, default to bronze
            reps[wallet.id] = {
              score: 0,
              completedTasks: 0,
              avgRating: 0,
            };
          }
        }
      }
      
      setReputations(reps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reputations');
    } finally {
      setLoading(false);
    }
  }, [masterWallet, wallets, client]);

  useEffect(() => {
    fetchReputations();
  }, [fetchReputations]);

  // Calculate aggregated reputation
  const aggregated = useMemo((): AggregatedReputation | null => {
    if (!masterWallet || wallets.length === 0) return null;
    
    const agents: AgentReputation[] = wallets.map(w => {
      const rep = reputations[w.id] || { score: 0, completedTasks: 0, avgRating: 0 };
      const formatted = formatReputation(rep.score);
      
      return {
        walletId: w.id,
        address: w.solanaAddress || '',
        handle: w.name,
        score: rep.score,
        tier: formatted.tier,
        completedTasks: rep.completedTasks,
        avgRating: rep.avgRating,
        weight: Math.max(rep.completedTasks, 1),
      };
    });
    
    const aggregate = calculateAggregateReputation(
      agents.map(a => ({ score: a.score, completedTasks: a.completedTasks }))
    );
    
    const policy = calculatePolicyFromReputation(aggregate.score);
    
    return {
      masterWallet,
      aggregateScore: aggregate.score,
      tier: aggregate.tier,
      agentCount: agents.length,
      totalCompletedTasks: agents.reduce((sum, a) => sum + a.completedTasks, 0),
      agents,
      derivedPolicy: {
        dailyLimitUsd: policy.dailyLimitUsd,
        allowedChains: policy.allowedChains,
        autoApprove: policy.autoApprove,
      },
    };
  }, [masterWallet, wallets, reputations]);

  // Refresh function
  const refresh = useCallback(async () => {
    await fetchReputations();
  }, [fetchReputations]);

  return {
    aggregated,
    loading,
    error,
    refresh,
  };
}
