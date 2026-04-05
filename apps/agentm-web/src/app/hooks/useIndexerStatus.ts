'use client';

import { useState, useEffect } from 'react';
import { resolveIndexerBase } from '../utils';
import type { IndexerConnectionStatus } from '../types';

/**
 * Hook to check indexer connection status
 */
export function useIndexerStatus(): { status: IndexerConnectionStatus; indexerUrl: string } {
  const [status, setStatus] = useState<IndexerConnectionStatus>('checking');
  const indexerUrl = resolveIndexerBase();

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${indexerUrl}/healthz`, {
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!cancelled) {
          setStatus(response.ok ? 'connected' : 'disconnected');
        }
      } catch {
        if (!cancelled) {
          setStatus('disconnected');
        }
      }
    }

    checkStatus();

    // Re-check every 30 seconds
    const interval = setInterval(checkStatus, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [indexerUrl]);

  return { status, indexerUrl };
}
