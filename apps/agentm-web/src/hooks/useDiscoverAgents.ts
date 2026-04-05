'use client';

import { useState, useEffect, useCallback } from 'react';
import { resolveIndexerBase } from '@/app/utils';

const INDEXER_BASE = process.env.NEXT_PUBLIC_INDEXER_URL
  || (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://api.gradiences.xyz/indexer' : '');

export interface DiscoverAgent {
  address: string;
  displayName: string;
  bio: string;
  reputation: number;
  followersCount: number;
  followingCount: number;
  trustScore: number;
  rank: number;
  verifiedBadge: boolean;
  interactionPolicy: 'allow' | 'review' | 'restricted';
  capabilities?: string[];
}

interface UseDiscoverAgentsResult {
  agents: DiscoverAgent[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch discoverable agents from Chain Hub Indexer
 * Uses /api/agents endpoint or falls back to /api/tasks to extract agents
 */
export function useDiscoverAgents(): UseDiscoverAgentsResult {
  const [agents, setAgents] = useState<DiscoverAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const indexerBase = resolveIndexerBase();

      if (!indexerBase) {
        throw new Error('Indexer URL not configured');
      }

      // Try to fetch agents from /api/agents endpoint first
      try {
        const res = await fetch(`${indexerBase}/api/agents?limit=50`, {
          signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const mappedAgents: DiscoverAgent[] = data.map((agent: any, index: number) => ({
              address: agent.address || agent.agent || agent.publicKey || '',
              displayName: agent.displayName || agent.name || `Agent ${agent.address?.slice(0, 8) || index}`,
              bio: agent.bio || agent.description || 'AI Agent on the network',
              reputation: Math.round(agent.reputation?.score || agent.reputation || 50),
              followersCount: agent.followersCount || agent.followers || 0,
              followingCount: agent.followingCount || agent.following || 0,
              trustScore: Math.round(agent.trustScore || agent.trust || 70),
              rank: index + 1,
              verifiedBadge: agent.verified || agent.verifiedBadge || false,
              interactionPolicy: agent.interactionPolicy || 'allow',
              capabilities: agent.capabilities || agent.skills || [],
            }));
            setAgents(mappedAgents);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fall through to tasks-based discovery
      }

      // Fallback: extract agents from tasks data
      try {
        const res = await fetch(`${indexerBase}/api/tasks?limit=100`, {
          signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
          const tasks = await res.json();
          if (Array.isArray(tasks) && tasks.length > 0) {
            // Aggregate agent data from tasks
            const agentMap = new Map<string, {
              tasks: number;
              categories: string[];
              reputation: number;
            }>();

            for (const task of tasks) {
              const addr = task.poster || task.agent;
              if (!addr) continue;

              const existing = agentMap.get(addr) || {
                tasks: 0,
                categories: [],
                reputation: 0,
              };

              existing.tasks++;
              if (task.category && !existing.categories.includes(String(task.category))) {
                existing.categories.push(String(task.category));
              }
              if (task.reputation) {
                existing.reputation = Math.max(existing.reputation, task.reputation);
              }

              agentMap.set(addr, existing);
            }

            // Convert to array and sort by activity
            const sortedAgents = Array.from(agentMap.entries())
              .sort((a, b) => b[1].tasks - a[1].tasks)
              .slice(0, 20);

            const mappedAgents: DiscoverAgent[] = sortedAgents.map(([addr, info], index) => ({
              address: addr,
              displayName: `Agent ${addr.slice(0, 8)}`,
              bio: `${info.tasks} task${info.tasks > 1 ? 's' : ''} posted on-chain`,
              reputation: info.reputation || Math.min(50 + info.tasks * 5, 100),
              followersCount: 0,
              followingCount: 0,
              trustScore: Math.min(70 + info.tasks * 2, 100),
              rank: index + 1,
              verifiedBadge: info.tasks >= 5,
              interactionPolicy: 'allow',
              capabilities: info.categories,
            }));

            setAgents(mappedAgents);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Silent fail
      }

      // If no data available, return empty array
      setAgents([]);
      setError('No agents found on the network');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agents');
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return {
    agents,
    loading,
    error,
    refetch: fetchAgents,
  };
}

export default useDiscoverAgents;
