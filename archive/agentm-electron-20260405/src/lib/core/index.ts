/**
 * Core Integration Module
 *
 * Provides React integration with the AgentM Core Solana program SDK.
 * Includes context provider, hooks, and service layer for on-chain operations.
 *
 * @module lib/core
 *
 * @example
 * ```tsx
 * // In your app root
 * import { CoreProvider } from './lib/core';
 *
 * function App() {
 *   return (
 *     <CoreProvider config={{ network: 'devnet' }} autoConnect>
 *       <YourApp />
 *     </CoreProvider>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // In a component
 * import { useCore, useAgent, useProfile } from './lib/core';
 *
 * function AgentDashboard({ agentAddress }: { agentAddress: string }) {
 *   const { core } = useCore();
 *   const { agent, reputation, loading } = useAgent(agentAddress);
 *
 *   if (loading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <h2>{agent?.name}</h2>
 *       <p>Score: {reputation?.avgScore.toFixed(1)}</p>
 *       <button onClick={() => core?.createAgent({ name: 'New Agent' })}>
 *         Create Agent
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */

// Provider and context
export {
    CoreProvider,
    useCoreContext,
    useCoreAvailable,
    type CoreProviderProps,
} from './CoreProvider.tsx';

// Hooks
export {
    useCore,
    useAgent,
    useProfile,
    useCoreReputation,
    useUserAgents,
    useConnectionState,
    usePendingTransactions,
    type UseAgentOptions,
    type UseProfileOptions,
    type UseCoreReputationOptions,
} from './useCore.ts';

// Service
export {
    CoreService,
    getCoreService,
    resetCoreService,
} from './CoreService.ts';

// Types
export type {
    // Agent types
    AgentType,
    CreateAgentInput,
    UpdateAgentConfigInput,
    AgentAccountData,

    // Profile types
    UpdateProfileInput,
    UserProfileData,

    // Reputation types
    UpdateReputationInput,
    ReputationAccount,
    ReputationData,

    // Configuration types
    CoreConfig,
    CoreConnectionState,
    CoreContextValue,

    // Transaction types
    TransactionStatus,
    TransactionResult,
    PendingTransaction,

    // Hook return types
    UseCoreResult,
    UseAgentResult,
    UseProfileResult,
} from './types.ts';

// Utility exports
export {
    AGENT_TYPE_LABELS,
    AGENT_TYPE_DESCRIPTIONS,
    bpsToPercent,
    percentToBps,
    bpsToRatio,
    ratioToBps,
} from './types.ts';
