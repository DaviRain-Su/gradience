/**
 * Workflow Engine Types
 * Based on docs/workflow-engine/03-technical-spec.md
 */

/** Supported chains (aligned with Chain Hub) */
export type SupportedChain =
  | 'solana'
  | 'tempo'
  | 'xlayer'
  | 'sui'
  | 'near'
  | 'ethereum'
  | 'arbitrum'
  | 'base';

/** Supported workflow actions */
export type WorkflowAction =
  // DeFi
  | 'swap'
  | 'bridge'
  | 'transfer'
  | 'yieldFarm'
  | 'stake'
  | 'unstake'
  | 'borrow'
  | 'repay'
  // Payment
  | 'x402Payment'
  | 'mppStreamReward'
  | 'teePrivateSettle'
  | 'zeroGasExecute'
  // Identity
  | 'zkProveIdentity'
  | 'zkProveReputation'
  | 'verifyCredential'
  | 'linkIdentity'
  // AI
  | 'nearIntent'
  | 'aiAnalyze'
  | 'aiDecide'
  // Utility
  | 'httpRequest'
  | 'wait'
  | 'condition'
  | 'parallel'
  | 'loop'
  | 'setVariable'
  | 'log';

/** Pricing model types */
export type PricingModel = 'free' | 'oneTime' | 'subscription' | 'perUse' | 'revenueShare';

/** Subscription period */
export type SubscriptionPeriod = 'day' | 'week' | 'month' | 'year';

/** Condition behavior when false */
export type ConditionOnFalse = 'skip' | 'abort' | 'goto';

/** Token amount */
export interface TokenAmount {
  mint: string;
  amount: string;
}

/** Step execution condition */
export interface StepCondition {
  expression: string;
  onFalse: ConditionOnFalse;
  gotoStep?: string;
}

/** Single workflow step */
export interface WorkflowStep {
  id: string;
  name: string;
  description?: string;
  chain: SupportedChain;
  action: WorkflowAction;
  params: Record<string, unknown>;
  condition?: StepCondition;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  next?: string;
  onError?: string;
  optional?: boolean;
}

/** DAG edge */
export interface DAGEdge {
  from: string;
  to: string;
  condition?: string;
}

/** Workflow DAG (Directed Acyclic Graph) */
export interface WorkflowDAG {
  nodes: WorkflowStep[];
  edges: DAGEdge[];
}

/** Workflow configuration variable */
export interface WorkflowConfig {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'address';
  required: boolean;
  default?: unknown;
  description?: string;
}

/** Pricing strategy */
export interface WorkflowPricing {
  model: PricingModel;
  oneTimePrice?: TokenAmount;
  subscription?: {
    price: TokenAmount;
    period: SubscriptionPeriod;
  };
  perUsePrice?: TokenAmount;
  creatorShareBps?: number;
}

/** Revenue share configuration (total must = 10000) */
export interface RevenueShare {
  creator: number;
  user: number;
  agent: number;
  protocol: 200;
  judge: 300;
}

/** ZK proof requirement */
export interface ZKRequirement {
  type: 'kyc' | 'accredited' | 'custom';
  verifier?: string;
}

/** Token holding requirement */
export interface TokenRequirement {
  mint: string;
  minAmount: string;
}

/** Workflow requirements */
export interface WorkflowRequirements {
  minReputation?: number;
  tokens?: TokenRequirement[];
  zkProofs?: ZKRequirement[];
  whitelist?: string[];
}

/** Complete Workflow definition */
export interface GradienceWorkflow {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  steps: WorkflowStep[];
  dag?: WorkflowDAG;
  config?: WorkflowConfig[];
  pricing: WorkflowPricing;
  revenueShare: RevenueShare;
  requirements: WorkflowRequirements;
  isPublic: boolean;
  isTemplate: boolean;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  contentHash: string;
  signature: string;
}

/** Validation result */
export interface ValidationResult {
  success: boolean;
  error?: {
    code: number;
    message: string;
    path?: string[];
  };
}

/** Step execution result */
export interface StepResult {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
  chain: SupportedChain;
  action: WorkflowAction;
  output?: Record<string, unknown>;
  txHash?: string;
  duration: number;
  gasUsed?: string;
  error?: string;
  retryCount: number;
}

/** Workflow execution result */
export interface WorkflowExecutionResult {
  executionId: string;
  workflowId: string;
  executor: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  stepResults: StepResult[];
  duration: number;
  totalGas: string;
  totalRevenue?: TokenAmount;
  error?: {
    stepId: string;
    code: number;
    message: string;
  };
  startedAt: number;
  completedAt?: number;
}
