/**
 * Revenue Distribution Module
 *
 * Unified exports for distribution functionality.
 *
 * @module revenue/distribution
 */

// Types
export * from './types.js';

// Modules
export { DistributionBuilder } from './builder.js';
export { CPICaller, distribute, distributeTokens } from './cpi-caller.js';
export { DistributionValidator } from './validator.js';

// Legacy exports for backward compatibility
export { RevenueDistributor, createRevenueDistributor } from '../distribution.js';
