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
 * Hook to fetch discoverable agents
 * 
 * Architecture: Web → Daemon (localhost:7420) → Indexer (optional sync)
 * This ensures local-first data flow, not direct cloud connection.
 */
export function useDiscoverAgents(): UseDiscoverAgentsResult {
  const [agents, setAgents] = useState<DiscoverAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'full' | 'readonly' | 'offline'>('offline');

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Try to connect to local daemon (preferred)
      const daemonUrl = process.env.NEXT_PUBLIC_DAEMON_URL || 'http://localhost:7420';
      
      try {
        const healthRes = await fetch(`${daemonUrl}/health`, {
          signal: AbortSignal.timeout(3000),
        });

        if (healthRes.ok) {
          setMode('full');
          
          // Fetch agents through daemon proxy
          const res = await fetch(`${daemonUrl}/api/v1/indexer/agents?limit=50`, {
            signal: AbortSignal.timeout(8000),
          });

          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              const mappedAgents: DiscoverAgent[] = data.map((agent: any, index: number) => ({
                address: agent.address || agent.agent || '',
                displayName: agent.displayName || `Agent ${agent.address?.slice(0, 8) || index}`,
                bio: agent.bio || 'AI Agent on the network',
                reputation: Math.round(agent.reputation || 50),
                followersCount: agent.followersCount || 0,
                followingCount: agent.followingCount || 0,
                trustScore: Math.round(agent.trustScore || 70),
                rank: index + 1,
                verifiedBadge: agent.verified || false,
                interactionPolicy: agent.interactionPolicy || 'allow',
                capabilities: agent.capabilities || [],
              }));
              setAgents(mappedAgents);
              setLoading(false);
              return;
            }
          }
        }
      } catch {
        // Daemon not available, enter readonly mode
        setMode('readonly');
      }

      // Step 2: Readonly mode - fetch from public indexer (limited data)
      // Note: This is a fallback for browsing only, no private data
      const indexerBase = process.env.NEXT_PUBLIC_INDEXER_URL;
      
      if (!indexerBase) {
        setMode('offline');
        setAgents([]);
        setError('Local daemon not running. Install and start agent-daemon to see full data.');
        setLoading(false);
        return;
      }

      // Fetch public agents data (limited, no private info)
      const res = await fetch(`${indexerBase}/api/agents?limit=50`, {
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mappedAgents: DiscoverAgent[] = data.map((agent: any, index: number) => ({
            address: agent.address || '',
            displayName: agent.displayName || `Agent ${agent.address?.slice(0, 8) || index}`,
            bio: agent.bio || 'AI Agent on the network (limited view)',
            reputation: Math.round(agent.reputation || 50),
            followersCount: 0, // Private data not available in readonly mode
            followingCount: 0, // Private data not available
            trustScore: Math.round(agent.trustScore || 70),
            rank: index + 1,
            verifiedBadge: agent.verified || false,
            interactionPolicy: 'allow',
            capabilities: agent.capabilities || [],
          }));
          setAgents(mappedAgents);
        }
      } else {
        setAgents([]);
        setError('Unable to fetch agents. Please start your local daemon for full access.');
      }

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
