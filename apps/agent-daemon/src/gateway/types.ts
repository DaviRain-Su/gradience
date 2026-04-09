/**
 * Workflow Execution Gateway — Type Definitions
 */

export type PurchaseStatus =
    | 'PENDING'
    | 'TASK_CREATING'
    | 'TASK_CREATED'
    | 'APPLIED'
    | 'SUBMITTING'
    | 'SUBMITTED'
    | 'EXECUTING'
    | 'SETTLING'
    | 'SETTLED'
    | 'FAILED';

export interface PurchaseEvent {
    purchaseId: string;
    buyer: string;
    workflowId: string;
    amount: bigint;
    txSignature: string;
    blockTime: number;
    preferredAgent?: string;
}

export interface GatewayPurchaseRecord {
    purchaseId: string;
    buyer: string;
    workflowId: string;
    amount: string;
    txSignature: string;
    blockTime: number;
    preferredAgent?: string;
    status: PurchaseStatus;
    taskId?: string;
    agentId?: string;
    resultHash?: string;
    settlementTx?: string;
    score?: number;
    attempts: number;
    createdAt: string;
    updatedAt: string;
}

export interface PostTaskParams {
    taskId: bigint;
    evalRef: string;
    deadline: bigint;
    judgeDeadline: bigint;
    judgeMode: number;
    judge: string;
    category: number;
    minStake: bigint;
    reward: bigint;
}

// Lightweight WalletAdapter interface for Gateway usage
export interface WalletAdapter {
    publicKey: string;
    signAndSendTransaction(instructions: unknown[], options?: unknown): Promise<string>;
}

export interface GatewayConfig {
    marketplaceProgramId: string;
    arenaProgramId: string;
    rpcEndpoint: string;
    dbPath: string;
    posterWallet: WalletAdapter;
    agentWallet: WalletAdapter;
    defaultJudge: string;
    pollIntervalMs: number;
    maxRetries: number;
    retryDelayMs: number;
}

export const DEFAULT_POLL_INTERVAL_MS = 15_000;
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_RETRY_DELAY_MS = 5_000;
export const POST_TASK_DEADLINE_OFFSET_SEC = 3_600;
export const POST_TASK_JUDGE_DEADLINE_OFFSET_SEC = 7_200;
export const MIN_STAKE_LAMPORTS = 0n;
