/**
 * Agent Arena SDK re-exports.
 *
 * Re-exports the full @gradiences/arena-sdk surface so consumers can import
 * everything from a single package while still using tree-shaking to trim
 * what they don't need.
 *
 * @example
 * import { GradienceSDK, KeypairAdapter } from '@gradiences/sdk/arena';
 */

// Full Agent Arena SDK: GradienceSDK class, all Codama-generated instruction
// builders, account decoders, PDA helpers, and type definitions.
export * from '@gradiences/arena-sdk';
