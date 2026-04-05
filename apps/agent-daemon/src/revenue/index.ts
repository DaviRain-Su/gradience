/**
 * Revenue Module
 *
 * Revenue sharing and distribution functionality for the Agent Daemon.
 *
 * Revenue distribution model:
 * - Agent: 95%
 * - Judge: 3%
 * - Protocol: 2%
 *
 * @module revenue
 */

// Revenue Store
export {
  RevenueStore,
  createRevenueStore,
  REVENUE_SCHEMA_SQL,
  type RevenueDistributionRecord,
  type RevenueDistributionInput,
  type RevenueStats,
} from './revenue-store.js';

// Revenue Sharing Engine
export {
  RevenueSharingEngine,
  createRevenueSharingEngine,
  type RevenueEngineConfig,
  type RevenueEngineOptions,
  type RevenueCalculation,
  type TaskSettlementInfo,
  type SettlementTask,
} from './revenue-engine.js';

// Distribution (existing module)
export {
  DistributionBuilder,
  CPICaller,
  distribute,
  distributeTokens,
  DistributionValidator,
  RevenueDistributor,
  createRevenueDistributor,
  type DistributionConfig,
  type DistributionRequest,
  type DistributionResult,
  type TokenAccountInfo,
  type TokenAccounts,
  type DistributionBreakdown,
} from './distribution/index.js';
