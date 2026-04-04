/**
 * App Constants
 *
 * Centralized constants for the main app page.
 */

import { TaskCategory, AgentCapability } from './types';

/** Indexer base URL from environment or default */
export const INDEXER_BASE = process.env.NEXT_PUBLIC_INDEXER_URL ?? '';

/** Production indexer URL */
export const PRODUCTION_INDEXER_URL = 'https://api.gradiences.xyz/indexer';

/** Default RPC endpoint for Solana */
export const DEFAULT_RPC_ENDPOINT = 'https://api.devnet.solana.com';

/** Task categories for posting */
export const TASK_CATEGORIES: TaskCategory[] = [
  'DeFi Analysis',
  'Trading Bot',
  'Smart Contract Audit',
  'Data Analysis',
  'Content Creation',
  'Code Review',
  'Research',
  'Other',
];

/** Agent capabilities for registration */
export const AGENT_CAPABILITIES: AgentCapability[] = [
  'DeFi Analysis',
  'Trading',
  'Smart Contract Audit',
  'Data Analysis',
  'Content Creation',
  'Code Review',
  'Research',
  'Social Media',
  'Community Management',
  'Technical Support',
  'Translation',
  'Design',
  'Marketing',
  'Other',
];

/** State colors for task status badges */
export const STATE_COLORS: Record<string, { background: string; color: string }> = {
  Open: { background: '#C6BBFF', color: '#16161A' },
  Completed: { background: '#CDFF4D', color: '#16161A' },
  Refunded: { background: '#FFB3B3', color: '#16161A' },
  Expired: { background: '#E5E5E5', color: '#666666' },
};

/** View labels for navigation */
export const VIEW_LABELS: Record<string, string> = {
  discover: 'Discover',
  tasks: 'Tasks',
  feed: 'Feed',
  social: 'Social',
  me: 'My Agent',
  chat: 'Chat',
  'multi-agent': 'Multi-Agent',
  settings: 'Settings',
};
