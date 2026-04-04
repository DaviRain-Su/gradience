/**
 * OWS Integration Module
 *
 * Open Wallet Standard (OWS) integration for AgentM.
 * Provides wallet connection, identity management, and reputation integration
 * with the Chain Hub indexer.
 *
 * @module lib/ows
 *
 * @example
 * ```tsx
 * import { OWSProvider, useOWS, useReputation, ReputationBadge } from '@/lib/ows';
 *
 * function App() {
 *   return (
 *     <OWSProvider config={{ network: 'devnet' }}>
 *       <WalletButton />
 *       <ProfileSection />
 *     </OWSProvider>
 *   );
 * }
 *
 * function WalletButton() {
 *   const { state, connect, disconnect } = useOWS();
 *
 *   if (state.connected) {
 *     return (
 *       <button onClick={() => disconnect()}>
 *         Disconnect ({state.identity?.address.slice(0, 8)}...)
 *       </button>
 *     );
 *   }
 *
 *   return (
 *     <button onClick={() => connect()} disabled={state.connecting}>
 *       {state.connecting ? 'Connecting...' : 'Connect Wallet'}
 *     </button>
 *   );
 * }
 *
 * function ProfileSection() {
 *   const { state, reputation } = useOWS();
 *
 *   if (!state.connected) return null;
 *
 *   return <ReputationBadge reputation={reputation} showDetails />;
 * }
 * ```
 */

// Types
export type {
    OWSNetwork,
    OWSChain,
    OWSConfig,
    OWSCredentialType,
    OWSCredential,
    OWSIdentity,
    OWSWalletState,
    ReputationData,
    CategoryReputation,
    ReputationTier,
    ReputationBadgeData,
    OWSContextValue,
} from './types.ts';

// Service
export { OWSService, getOWSService, resetOWSService } from './OWSService.ts';

// Provider
export { OWSProvider, useOWS, useOWSAvailable } from './OWSProvider.tsx';
export type { OWSProviderProps } from './OWSProvider.tsx';

// Hooks
export {
    useReputation,
    useReputationBatch,
    getTier,
    getTierConfig,
    formatWinRate,
    formatScore,
} from './useReputation.ts';
export type { UseReputationOptions, UseReputationResult } from './useReputation.ts';

// Components
export {
    ReputationBadge,
    ReputationBadgeCompact,
    ReputationCard,
} from './ReputationBadge.tsx';
export type {
    ReputationBadgeProps,
    ReputationBadgeCompactProps,
    ReputationCardProps,
} from './ReputationBadge.tsx';
