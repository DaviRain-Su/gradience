/**
 * App Utilities
 *
 * Helper functions for the main app page.
 */

import { INDEXER_BASE, PRODUCTION_INDEXER_URL } from './constants';
import type { BindingStatus } from './types';

/**
 * Format binding status for display
 */
export function formatBindingStatus(status: BindingStatus): string {
  const statusMap: Record<BindingStatus, string> = {
    bound: 'Connected',
    wallet_changed: 'Wallet Changed',
    unbound: 'Not Connected',
  };
  return statusMap[status] ?? status;
}

/**
 * Resolve indexer base URL based on environment
 */
export function resolveIndexerBase(): string {
  if (typeof window === 'undefined') {
    return PRODUCTION_INDEXER_URL;
  }

  const isLocal = window.location.hostname === 'localhost';
  const isVercel = window.location.hostname.includes('vercel.app');

  if (isLocal) {
    return 'http://localhost:3001';
  }

  if (INDEXER_BASE) {
    return INDEXER_BASE;
  }

  if (isVercel) {
    return PRODUCTION_INDEXER_URL;
  }

  return window.location.origin + '/indexer';
}

/**
 * Get timeout signal for fetch requests
 */
export function getTimeoutSignal(timeoutMs: number): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

/**
 * Format SOL amount with proper decimals
 */
export function formatSol(lamports: number | bigint): string {
  const sol = Number(lamports) / 1e9;
  return sol.toFixed(4);
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, start = 6, end = 4): string {
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

/**
 * Format timestamp to relative time
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp * 1000;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

/**
 * Format date for display
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculate win rate percentage
 */
export function calculateWinRate(completed: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((completed / total) * 100)}%`;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Check if code is running on client side
 */
export function isClient(): boolean {
  return typeof window !== 'undefined';
}
