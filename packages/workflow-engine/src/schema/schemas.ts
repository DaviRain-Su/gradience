/**
 * Zod Schemas for Workflow Validation
 */
import { z } from 'zod';

// Constants
export const MAX_STEPS = 50;
export const MAX_NAME_LENGTH = 64;
export const MAX_DESCRIPTION_LENGTH = 2048;
export const MAX_VERSION_LENGTH = 16;
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 32;
export const MAX_STEP_ID_LENGTH = 32;
export const MAX_STEP_NAME_LENGTH = 64;
export const MAX_STEP_DESC_LENGTH = 256;
export const MAX_EXPRESSION_LENGTH = 256;
export const DEFAULT_TIMEOUT = 60000;
export const MAX_TIMEOUT = 600000;
export const MAX_RETRIES = 5;
export const MAX_RETRY_DELAY = 30000;

// Supported chains
export const SupportedChainSchema = z.enum([
    'solana',
    'tempo',
    'xlayer',
    'sui',
    'near',
    'ethereum',
    'arbitrum',
    'base',
]);

// Supported actions
export const WorkflowActionSchema = z.enum([
    // DeFi
    'swap',
    'bridge',
    'transfer',
    'yieldFarm',
    'stake',
    'unstake',
    'borrow',
    'repay',
    // Payment
    'x402Payment',
    'mppStreamReward',
    'teePrivateSettle',
    'zeroGasExecute',
    // Identity
    'zkProveIdentity',
    'zkProveReputation',
    'verifyCredential',
    'linkIdentity',
    // AI
    'nearIntent',
    'aiAnalyze',
    'aiDecide',
    // Utility
    'httpRequest',
    'wait',
    'condition',
    'parallel',
    'loop',
    'setVariable',
    'log',
]);

// Token amount
export const TokenAmountSchema = z.object({
    mint: z.string().min(1),
    amount: z.string().min(1),
});

// Step condition
export const StepConditionSchema = z.object({
    expression: z.string().max(MAX_EXPRESSION_LENGTH),
    onFalse: z.enum(['skip', 'abort', 'goto']),
    gotoStep: z.string().max(MAX_STEP_ID_LENGTH).optional(),
});

// Workflow step
export const WorkflowStepSchema = z.object({
    id: z.string().min(1).max(MAX_STEP_ID_LENGTH),
    name: z.string().min(1).max(MAX_STEP_NAME_LENGTH),
    description: z.string().max(MAX_STEP_DESC_LENGTH).optional(),
    chain: SupportedChainSchema,
    action: WorkflowActionSchema,
    params: z.record(z.unknown()),
    condition: StepConditionSchema.optional(),
    timeout: z.number().min(0).max(MAX_TIMEOUT).optional(),
    retries: z.number().min(0).max(MAX_RETRIES).optional(),
    retryDelay: z.number().min(0).max(MAX_RETRY_DELAY).optional(),
    next: z.string().max(MAX_STEP_ID_LENGTH).optional(),
    onError: z.string().max(MAX_STEP_ID_LENGTH).optional(),
    optional: z.boolean().optional(),
});

// DAG edge
export const DAGEdgeSchema = z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    condition: z.string().optional(),
});

// Workflow DAG
export const WorkflowDAGSchema = z.object({
    nodes: z.array(WorkflowStepSchema).min(1).max(MAX_STEPS),
    edges: z.array(DAGEdgeSchema),
});

// Workflow config variable
export const WorkflowConfigSchema = z.object({
    key: z.string().min(1),
    type: z.enum(['string', 'number', 'boolean', 'address']),
    required: z.boolean(),
    default: z.unknown().optional(),
    description: z.string().optional(),
});

// Pricing
export const WorkflowPricingSchema = z.object({
    model: z.enum(['free', 'oneTime', 'subscription', 'perUse', 'revenueShare']),
    oneTimePrice: TokenAmountSchema.optional(),
    subscription: z
        .object({
            price: TokenAmountSchema,
            period: z.enum(['day', 'week', 'month', 'year']),
        })
        .optional(),
    perUsePrice: TokenAmountSchema.optional(),
    creatorShareBps: z.number().min(0).max(10000).optional(),
});

// Revenue share (must sum to 10000)
export const RevenueShareSchema = z
    .object({
        creator: z.number().min(0).max(10000),
        user: z.number().min(0).max(10000),
        agent: z.number().min(0).max(10000),
        protocol: z.literal(200),
        judge: z.literal(300),
    })
    .refine((data) => data.creator + data.user + data.agent + data.protocol + data.judge === 10000, {
        message: 'Revenue share must sum to 10000 (100%)',
    });

// ZK requirement
export const ZKRequirementSchema = z.object({
    type: z.enum(['kyc', 'accredited', 'custom']),
    verifier: z.string().optional(),
});

// Token requirement
export const TokenRequirementSchema = z.object({
    mint: z.string().min(1),
    minAmount: z.string().min(1),
});

// Requirements
export const WorkflowRequirementsSchema = z.object({
    minReputation: z.number().min(0).max(100).optional(),
    tokens: z.array(TokenRequirementSchema).optional(),
    zkProofs: z.array(ZKRequirementSchema).optional(),
    whitelist: z.array(z.string()).optional(),
});

// Complete workflow schema
export const GradienceWorkflowSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(MAX_NAME_LENGTH),
    description: z.string().max(MAX_DESCRIPTION_LENGTH),
    author: z.string().min(1),
    version: z.string().min(1).max(MAX_VERSION_LENGTH),
    steps: z.array(WorkflowStepSchema).min(1).max(MAX_STEPS),
    dag: WorkflowDAGSchema.optional(),
    config: z.array(WorkflowConfigSchema).optional(),
    pricing: WorkflowPricingSchema,
    revenueShare: RevenueShareSchema,
    requirements: WorkflowRequirementsSchema,
    isPublic: z.boolean(),
    isTemplate: z.boolean(),
    tags: z.array(z.string().max(MAX_TAG_LENGTH)).max(MAX_TAGS),
    createdAt: z.number(),
    updatedAt: z.number(),
    contentHash: z.string().min(1),
    signature: z.string().min(1),
});

export type GradienceWorkflowInput = z.infer<typeof GradienceWorkflowSchema>;
