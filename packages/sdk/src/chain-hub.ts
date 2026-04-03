/**
 * Chain Hub SDK re-exports.
 *
 * The Chain Hub provides off-chain reputation, registry, SQL query, and
 * protocol-routing primitives.  These are all read-only / REST-based and
 * do not require a wallet.
 *
 * @example
 * import { ChainHubClient } from '@gradiences/sdk/chain-hub';
 *
 * const hub = new ChainHubClient({ baseUrl: 'https://indexer.gradiences.xyz' });
 * const rep = await hub.getReputation('AgentPubkey...');
 */

// Client and config
export { ChainHubClient, ChainHubError } from '../../apps/chain-hub/sdk/client';
export type {
    ChainHubClientConfig,
    ReputationData,
    AgentInfo,
    RegistryEntry,
    SqlQueryResult,
} from '../../apps/chain-hub/sdk/client';

// Protocol routing
export { ChainHubRouter, InvokeRouteError, DefaultHttpClient } from '../../apps/chain-hub/sdk/router';

// Key vault
export { EnvKeyVaultAdapter, KeyVaultError, PolicyViolationError } from '../../apps/chain-hub/sdk/key-vault';
export type { KeyVaultAdapter } from '../../apps/chain-hub/sdk/key-vault';

// Royalty distribution
export { calculateRoyaltyDistribution } from '../../apps/chain-hub/sdk/royalty';
export type { RoyaltyInput, RoyaltyBreakdown } from '../../apps/chain-hub/sdk/royalty';

// Risk scoring
export { GoldRushClient } from '../../apps/chain-hub/sdk/goldrush';
export type {
    GoldRushRiskMetrics,
    GoldRushClientOptions,
    ChainHubReputationSnapshot,
    CounterpartyTrustSnapshot,
} from '../../apps/chain-hub/sdk/goldrush';

// SQL permission guard
export { SqlPermissionGuard } from '../../apps/chain-hub/sdk/sql-permissions';

// Shared types
export type {
    ProtocolMetadata,
    ProtocolType,
    ProtocolStatus,
    AuthMode,
    InvokeInput,
    RestInvokeInput,
    CpiInvokeInput,
    VaultPolicy,
    InvokeResult,
    TransactionRecord,
    TransactionQuery,
    CpiInvoker,
    HttpClient,
} from '../../apps/chain-hub/sdk/types';
