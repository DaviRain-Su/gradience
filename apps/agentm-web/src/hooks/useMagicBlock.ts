'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useConnection } from '@/lib/connection/ConnectionContext';

export type SessionStatus = 'connecting' | 'active' | 'idle' | 'error';

export interface ExecutionSession {
  id: string;
  mode: 'l1' | 'er' | 'per';
  state: 'initializing' | 'delegated' | 'active' | 'committing' | 'closed';
  accountCount: number;
}

export interface ERMetrics {
  operationsExecuted: number;
  avgExecutionTimeMs: number;
  commitsToL1: number;
}

export interface MagicBlockConnection {
  status: 'disconnected' | 'connected' | 'unavailable';
}

export interface UseMagicBlockResult {
  connection: MagicBlockConnection;
  sessions: ExecutionSession[];
  metrics: ERMetrics | null;
  preferredSessionId: string | null;
  isAvailable: boolean;
  createSession: (mode: 'l1' | 'er' | 'per', accounts: string[]) => Promise<string>;
  closeSession: (sessionId: string) => void;
  setPreferredSession: (sessionId: string | null) => void;
  refreshSession: (sessionId: string) => Promise<void>;
}

function checkMagicBlockAvailability(): Promise<boolean> {
  return Promise.resolve(
    typeof window !== 'undefined' &&
      !!process.env.NEXT_PUBLIC_MAGICBLOCK_RPC
  );
}

export function useMagicBlock(): UseMagicBlockResult {
  const { fetchApi } = useConnection();
  const [connection, setConnection] = useState<MagicBlockConnection>({
    status: 'disconnected',
  });
  const [sessions, setSessions] = useState<ExecutionSession[]>([]);
  const [metrics] = useState<ERMetrics | null>({
    operationsExecuted: 0,
    avgExecutionTimeMs: 0,
    commitsToL1: 0,
  });
  const [preferredSessionId, setPreferredSessionId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    checkMagicBlockAvailability().then((available) => {
      if (!mounted) return;
      setConnection({ status: available ? 'connected' : 'unavailable' });
    });
    return () => {
      mounted = false;
    };
  }, []);

  const createSession = useCallback(
    async (mode: 'l1' | 'er' | 'per', accounts: string[]): Promise<string> => {
      if (!fetchApi) {
        // Fallback to client-side simulation when daemon is unreachable
        const id = `${mode}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const newSession: ExecutionSession = {
          id,
          mode,
          state: mode === 'l1' ? 'active' : 'initializing',
          accountCount: accounts.length,
        };
        setSessions((prev) => [...prev, newSession]);
        if (!preferredSessionId) setPreferredSessionId(id);
        if (mode !== 'l1') {
          setTimeout(() => {
            setSessions((prev) =>
              prev.map((s) => (s.id === id ? { ...s, state: 'active' as const } : s))
            );
          }, 800);
        }
        return id;
      }

      const res = await fetchApi<{ id: string; mode: string; state: string; createdAt: number }>(
        '/api/v1/magicblock/session',
        {
          method: 'POST',
          body: JSON.stringify({ mode, accounts }),
        }
      );
      if (!res) {
        throw new Error('Failed to create MagicBlock session');
      }

      const newSession: ExecutionSession = {
        id: res.id,
        mode: res.mode as 'l1' | 'er' | 'per',
        state: res.state as ExecutionSession['state'],
        accountCount: accounts.length,
      };
      setSessions((prev) => [...prev, newSession]);
      if (!preferredSessionId) setPreferredSessionId(res.id);
      return res.id;
    },
    [fetchApi, preferredSessionId]
  );

  const refreshSession = useCallback(
    async (sessionId: string): Promise<void> => {
      if (!fetchApi) return;
      const res = await fetchApi<{ id: string; mode: string; state: string; accounts: string[] }>(
        `/api/v1/magicblock/session/${encodeURIComponent(sessionId)}`
      );
      if (!res) return;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, state: res.state as ExecutionSession['state'], accountCount: res.accounts.length }
            : s
        )
      );
    },
    [fetchApi]
  );

  const closeSession = useCallback(
    async (sessionId: string) => {
      if (fetchApi) {
        await fetchApi(`/api/v1/magicblock/session/${encodeURIComponent(sessionId)}`, {
          method: 'DELETE',
        });
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setPreferredSessionId((prev) => (prev === sessionId ? null : prev));
    },
    [fetchApi]
  );

  const setPreferredSession = useCallback((sessionId: string | null) => {
    setPreferredSessionId(sessionId);
  }, []);

  const isAvailable = useMemo(
    () => connection.status === 'connected',
    [connection.status]
  );

  return {
    connection,
    sessions,
    metrics,
    preferredSessionId,
    isAvailable,
    createSession,
    closeSession,
    setPreferredSession,
    refreshSession,
  };
}
