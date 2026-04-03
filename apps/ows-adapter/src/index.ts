/**
 * OWS (Open Wallet Standard) Adapter for Gradience Protocol
 * 
 * This package provides integration between Gradience Protocol and Open Wallet Standard (OWS),
 * enabling agent-native identity, credential management, and cross-chain capabilities.
 * 
 * @example
 * ```typescript
 * import { OWSWalletAdapter } from '@gradience/ows-adapter';
 * 
 * const adapter = new OWSWalletAdapter({
 *   network: 'devnet',
 *   defaultChain: 'solana'
 * });
 * 
 * const wallet = await adapter.connect();
 * const identity = await adapter.getIdentity();
 * ```
 */

export { OWSWalletAdapter } from './wallet';
export * from './types';

// Version
export const VERSION = '0.1.0';
