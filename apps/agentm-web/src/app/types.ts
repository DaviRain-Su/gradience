/**
 * Type definitions for the App page
 * Extracted from page.tsx for better modularity and reusability
 */

import type { OWSAgentWalletBinding } from '../lib/ows/agent-wallet';
import type { OWSAgentSubWallet } from '../lib/ows/agent-router';
import type { DaemonWallet } from '../lib/ows/daemon-client';
import type { AgentSubWallet } from '../hooks/useOWSAgentRouter';

/**
 * Available views in the app navigation
 */
export type ActiveView = 'discover' | 'tasks' | 'feed' | 'social' | 'me' | 'chat' | 'settings';

/**
 * Reputation data for an agent
 */
export interface ReputationData {
    avg_score: number;
    completed: number;
    total_applied: number;
    win_rate: number;
    total_earned: number;
}

/**
 * Agent row data structure for agent listings
 */
export interface AgentRow {
    agent: string;
    weight: number;
    reputation: { global_avg_score: number; global_completed: number; win_rate: number } | null;
}

/**
 * Solana wallet candidate for wallet selection
 */
export interface SolanaWalletCandidate {
    address: string;
    connectorType: string;
}

/**
 * Detailed agent data for agent profile views
 */
export interface AgentDetailData {
    agent: string;
    bio: string;
    capabilities: string[];
    walletAddress: string;
    weight: number;
    reputation: { global_avg_score: number; global_completed: number; win_rate: number } | null;
}

/**
 * User settings data structure
 */
export interface SettingsData {
    rpcEndpoint: string;
    indexerUrl: string;
    theme: 'dark' | 'light';
}

/**
 * Task category options
 */
export const TASK_CATEGORIES = [
    'DeFi Analysis',
    'Smart Contract Audit',
    'Data Processing',
    'Content Creation',
    'Trading Strategy',
    'Other',
] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];

/**
 * Posted task data structure
 */
export interface PostedTask {
    id: string;
    description: string;
    category: TaskCategory;
    rewardSol: number;
    deadline: string;
    poster: string;
    createdAt: string;
}

/**
 * Task data structure from the indexer/daemon
 */
export interface TaskData {
    task_id: string;
    poster: string;
    category: string;
    description: string;
    reward_lamports: number;
    deadline: number;
    state: 'Open' | 'InProgress' | 'Judging' | 'Settled' | 'Cancelled';
    submissions_count: number;
}

/**
 * Indexer connection status
 */
export type IndexerConnectionStatus = 'checking' | 'connected' | 'disconnected';

/**
 * Data source type for agent/task listings
 */
export type DataSource = 'indexer' | 'demo' | 'mock' | 'daemon';

/**
 * Agent capability options
 */
export const AGENT_CAPABILITIES = [
    'DeFi Analysis',
    'Smart Contract Audit',
    'Data Processing',
    'Content Creation',
    'Trading Strategy',
    'Code Review',
] as const;

export type AgentCapability = (typeof AGENT_CAPABILITIES)[number];

/**
 * Agent profile data structure
 */
export interface AgentProfile {
    displayName: string;
    capabilities: AgentCapability[];
    bio: string;
    solDomain: string;
    walletAddress: string;
    reputationScore: number;
}

/**
 * OWS binding status
 */
export type BindingStatus = 'bound' | 'wallet_changed' | 'unbound';

/**
 * Props for the Shell component
 */
export interface ShellProps {
    children: React.ReactNode;
    view: ActiveView;
    setView: (v: ActiveView) => void;
    address: string | null;
    activeSubWallet: (OWSAgentSubWallet | AgentSubWallet) | null;
    loginEmail: string | null;
    wallets: SolanaWalletCandidate[];
    onWalletChange: (address: string) => void;
    bindingStatus: BindingStatus;
    onLogout: () => void;
}

/**
 * Props for the MainApp component
 */
export interface MainAppProps {
    user: any;
    walletAddress: string;
    email: string;
}

/**
 * Props for the MeView component
 */
export interface MeViewProps {
    address: string | null;
    masterWallet: string | null;
    loginEmail: string | null;
    selectedWallet: SolanaWalletCandidate | null;
    owsBinding: OWSAgentWalletBinding | null;
    bindingStatus: BindingStatus;
    bindingBusy: boolean;
    bindingError: string | null;
    providerAvailable: boolean;
    onBindOWS: () => Promise<OWSAgentWalletBinding | { daemonWallet: DaemonWallet } | null>;
    onUnbindOWS: () => void;
    activeSubWallet: (OWSAgentSubWallet | AgentSubWallet) | null;
    subWallets: (OWSAgentSubWallet | AgentSubWallet)[];
    routerError: string | null;
    onCreateSubWallet: (handle: string) => unknown;
    onSetActiveSubWallet: (subWalletId: string | null) => unknown;
    isPasskeyProtected: (address: string) => boolean;
}

/**
 * Props for the DiscoverView component
 */
export interface DiscoverViewProps {
    onNavigateToChat?: () => void;
    onNavigateToTasks?: () => void;
}

/**
 * Props for the AgentDetailPanel component
 */
export interface AgentDetailPanelProps {
    agent: AgentDetailData;
    onBack: () => void;
    onInviteChat: () => void;
    onDelegateTask: () => void;
}

/**
 * Props for the TaskMarketView component
 */
export interface TaskMarketViewProps {
    address: string | null;
}

/**
 * Props for the TaskDetailModal component
 */
export interface TaskDetailModalProps {
    task: TaskData;
    onClose: () => void;
    address: string | null;
}

/**
 * Props for the PostTaskForm component
 */
export interface PostTaskFormProps {
    onTaskPosted?: (task: PostedTask) => void;
}

/**
 * Props for the QuickPostTaskForm component
 */
export interface QuickPostTaskFormProps {
    address: string;
    onPosted: (task: TaskData) => void;
}

/**
 * Props for the RegisterAgentSection component
 */
export interface RegisterAgentSectionProps {
    address: string | null;
}

/**
 * Props for the AgentProfileCard component
 */
export interface AgentProfileCardProps {
    profile: AgentProfile;
    onEdit: () => void;
    txSignature?: string | null;
}

/**
 * Props for the WalletBalance component
 */
export interface WalletBalanceProps {
    address: string;
}

/**
 * Props for the Stat component
 */
export interface StatProps {
    label: string;
    value: string;
}

/**
 * Props for the IndexerStatusBadge component
 */
export interface IndexerStatusBadgeProps {
    status: IndexerConnectionStatus;
    url: string;
}

/**
 * Props for the DataSourceLabel component
 */
export interface DataSourceLabelProps {
    source: DataSource;
}

/**
 * State colors for task states
 */
export interface StateColor {
    background: string;
    color: string;
}

export const STATE_COLORS: Record<string, StateColor> = {
    Open: { background: '#D1FAE5', color: '#059669' },
    InProgress: { background: '#FEF3C7', color: '#D97706' },
    Judging: { background: '#E0E7FF', color: '#4F46E5' },
    Settled: { background: '#DBEAFE', color: '#2563EB' },
    Cancelled: { background: '#FEE2E2', color: '#DC2626' },
};

/**
 * Toast notification type
 */
export interface Toast {
    message: string;
    type: 'success' | 'error';
}
