/**
 * OWS (Open Wallet Standard) Adapter for Gradience Protocol
 *
 * This package provides integration between Gradience Protocol and Open Wallet Standard (OWS),
 * enabling agent-native identity, credential management, and cross-chain capabilities.
 *
 * @example
 * ```typescript
 * import { OWSWalletAdapter } from '@gradiences/ows-adapter';
 *
 * const adapter = new OWSWalletAdapter({
 *   network: 'devnet',
 *   defaultChain: 'solana',
 *   rpcEndpoint: 'https://api.devnet.solana.com'
 * });
 *
 * const wallet = await adapter.connect();
 * const identity = await adapter.getIdentity();
 *
 * // Derive a sub-wallet
 * const subWallet = adapter.deriveSubWallet(1);
 *
 * // Sign a Solana transaction
 * const signedTx = await adapter.signTransaction(transaction);
 *
 * // Sign an authentication message
 * const auth = await adapter.signAuthMessage({
 *   domain: 'example.com',
 *   address: wallet.address,
 *   nonce: 'random-nonce',
 *   issuedAt: Date.now()
 * });
 *
 * // Check balance
 * const balance = await adapter.checkBalance();
 * ```
 */

export { OWSWalletAdapter } from './wallet';
export * from './types';
export * from './derive';
export * from './transaction';
export * from './message';
export * from './balance';

// Version
export const VERSION = '0.1.0';
