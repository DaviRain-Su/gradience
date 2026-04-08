'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

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
}

function checkMagicBlockAvailability(): Promise<boolean> {
  return Promise.resolve(
    typeof window !== 'undefined' &&
      !!process.env.NEXT_PUBLIC_MAGICBLOCK_RPC
  );
}

export function useMagicBlock(): UseMagicBlockResult {
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
      const id = `${mode}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const newSession: ExecutionSession = {
        id,
        mode,
        state: mode === 'l1' ? 'active' : 'initializing',
        accountCount: accounts.length,
      };
      setSessions((prev) => [...prev, newSession]);
      if (!preferredSessionId) {
        setPreferredSessionId(id);
      }
      // Simulate delegation completion for ER/PER
      if (mode !== 'l1') {
        setTimeout(() => {
          setSessions((prev) =>
            prev.map((s) => (s.id === id ? { ...s, state: 'active' as const } : s))
          );
        }, 800);
      }
      return id;
    },
    [preferredSessionId]
  );

  const closeSession = useCallback((sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setPreferredSessionId((prev) => (prev === sessionId ? null : prev));
  }, []);

  const setPreferredSession = useCallback((sessionId: string | null) => {
    setPreferredSessionId(sessionId);
  }, []);

  const isAvailable = useMemo(() => connection.status === 'connected', [connection.status]);

  return {
    connection,
    sessions,
    metrics,
    preferredSessionId,
    isAvailable,
    createSession,
    closeSession,
    setPreferredSession,
  };
}
