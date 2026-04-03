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

// Re-export everything from the dedicated chain-hub-sdk package
export * from '@gradiences/chain-hub-sdk';
