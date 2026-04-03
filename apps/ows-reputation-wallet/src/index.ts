/**
 * OWS Reputation-Powered Wallet MVP
 * 
 * A demonstration of reputation-driven wallet for the OWS Hackathon.
 * 
 * Features:
 * - Displays reputation score and tier
 * - Shows credentials from completed tasks
 * - Calculates credit limit based on reputation
 * - Provides reputation-based access control
 * 
 * @example
 * ```typescript
 * import { ReputationWallet } from '@gradiences/ows-reputation-wallet';
 * import { OWSWalletAdapter } from '@gradiences/ows-adapter';
 * 
 * const owsAdapter = new OWSWalletAdapter({
 *   network: 'devnet',
 *   defaultChain: 'solana'
 * });
 * 
 * const wallet = new ReputationWallet(owsAdapter);
 * await wallet.initialize();
 * 
 * console.log(wallet.displaySummary());
 * ```
 */

export { ReputationWallet, ReputationScore, ReputationTier } from './wallet';
export { runDemo } from './demo';

// Version
export const VERSION = '0.1.0';
