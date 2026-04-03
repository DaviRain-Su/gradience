/**
 * Engine module exports
 */

export { StepExecutor, executeStep } from './step-executor.js';
export type {
  ActionHandler,
  ExecutionContext,
  StepExecutionOptions,
} from './step-executor.js';

export {
  WorkflowEngine,
  createWorkflowEngine,
  type WorkflowExecutionOptions,
} from './workflow-engine.js';

// Re-export revenue share types for convenience
export type {
  RevenueDistribution,
  RevenueRecipient,
  DistributionOptions,
  DistributionResult,
  RevenueDistributor,
  RevenueEntry,
  RevenueShareValidation,
} from '../revenue-share.js';

export {
  MockRevenueDistributor,
  SolanaRevenueDistributor,
  RevenueTracker,
  createRevenueSystem,
  validateRevenueShare,
  calculateDistribution,
  calculateWorkflowRevenue,
  createRevenueShare,
  PROTOCOL_SHARE_BPS,
  JUDGE_SHARE_BPS,
  TOTAL_BPS,
  DEFAULT_REVENUE_SHARE,
} from '../revenue-share.js';

// Package version
export const ENGINE_VERSION = '0.1.0';
