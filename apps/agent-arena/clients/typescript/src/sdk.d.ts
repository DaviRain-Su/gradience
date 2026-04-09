import {
    getApplyForTaskInstruction,
    getCancelTaskInstruction,
    getForceRefundInstruction,
    getInitializeInstruction,
    getJudgeAndPayInstruction,
    getPostTaskInstruction,
    getRefundExpiredInstruction,
    getRegisterJudgeInstruction,
    getSubmitResultInstruction,
    getUnstakeJudgeInstruction,
    getUpgradeConfigInstruction,
    type RuntimeEnvInputArgs,
} from './generated/index.js';
import { fetchEncodedAccount, type Address, type Instruction, type TransactionSigner } from '@solana/kit';
export interface GradienceSdkOptions {
    indexerEndpoint?: string;
    attestationEndpoint?: string;
    programAddress?: Address;
    rpc?: Parameters<typeof fetchEncodedAccount>[0];
    rpcEndpoint?: string;
}
export interface WalletAdapter {
    signer: TransactionSigner;
    sign?(instructions: readonly Instruction[], options?: SendTransactionOptions): Promise<unknown>;
    signAndSendTransaction(instructions: readonly Instruction[], options?: SendTransactionOptions): Promise<string>;
    ensureAddressLookupTable?(request: EnsureLookupTableRequest): Promise<Address | null>;
}
export interface SendTransactionOptions {
    addressLookupTableAddresses?: Address[];
    useVersionedTransaction?: boolean;
}
export interface EnsureLookupTableRequest {
    taskId: bigint;
    addresses: Address[];
}
export interface StakeRefundRecipient {
    agent: Address;
    account?: Address;
}
export interface PostTaskRequest {
    taskId: number | bigint;
    evalRef: string;
    deadline: number | bigint;
    judgeDeadline: number | bigint;
    judgeMode: number;
    judge?: Address;
    category: number;
    minStake: number | bigint;
    reward: number | bigint;
    mint?: Address;
    tokenProgram?: Address;
    posterTokenAccount?: Address;
    escrowAta?: Address;
}
export interface ApplyTaskRequest {
    taskId: number | bigint;
    mint?: Address;
    tokenProgram?: Address;
    agentTokenAccount?: Address;
    escrowAta?: Address;
}
export interface SubmitTaskResultRequest {
    taskId: number | bigint;
    resultRef: string;
    traceRef: string;
    runtimeEnv: RuntimeEnvInputArgs;
}
export interface JudgeTaskRequest {
    taskId: number | bigint;
    winner: Address;
    poster: Address;
    score: number;
    reasonRef: string;
    mint?: Address;
    tokenProgram?: Address;
    judgeTokenAccount?: Address;
    winnerTokenAccount?: Address;
    posterTokenAccount?: Address;
    treasuryAta?: Address;
    escrowAta?: Address;
    losers?: StakeRefundRecipient[];
}
export interface CancelTaskRequest {
    taskId: number | bigint;
    mint?: Address;
    tokenProgram?: Address;
    posterTokenAccount?: Address;
    treasuryAta?: Address;
    escrowAta?: Address;
    refunds?: StakeRefundRecipient[];
}
export interface RefundExpiredRequest {
    taskId: number | bigint;
    poster: Address;
    mint?: Address;
    tokenProgram?: Address;
    posterTokenAccount?: Address;
    escrowAta?: Address;
    refunds?: StakeRefundRecipient[];
}
export interface ForceRefundRequest {
    taskId: number | bigint;
    poster: Address;
    mostActiveAgent: Address;
    judge: Address;
    judgeCategories: number[];
    mint?: Address;
    tokenProgram?: Address;
    posterTokenAccount?: Address;
    mostActiveAgentTokenAccount?: Address;
    treasuryAta?: Address;
    escrowAta?: Address;
    refunds?: StakeRefundRecipient[];
}
export interface TaskApi {
    task_id: number;
    poster: string;
    judge: string;
    judge_mode: 'designated' | 'pool' | 'unknown';
    reward: number;
    mint: string;
    min_stake: number;
    state: 'open' | 'completed' | 'refunded' | 'unknown';
    category: number;
    eval_ref: string;
    deadline: number;
    judge_deadline: number;
    submission_count: number;
    winner: string | null;
    created_at: number;
    slot: number;
}
export interface SubmissionApi {
    task_id: number;
    agent: string;
    result_ref: string;
    trace_ref: string;
    runtime_provider: string;
    runtime_model: string;
    runtime_runtime: string;
    runtime_version: string;
    submission_slot: number;
    submitted_at: number;
}
export interface ReputationApi {
    agent: string;
    global_avg_score: number;
    global_win_rate: number;
    global_completed: number;
    global_total_applied: number;
    total_earned: number;
    updated_slot: number;
}
export interface JudgePoolEntryApi {
    judge: string;
    stake: number;
    weight: number;
}
export interface ReputationCategoryOnChain {
    category: number;
    avgScore: number;
    completed: number;
}
export interface ReputationOnChain {
    agent: Address;
    totalEarned: bigint;
    completed: number;
    totalApplied: number;
    avgScore: number;
    winRate: number;
    byCategory: ReputationCategoryOnChain[];
    bump: number;
}
export interface JudgePoolMemberOnChain {
    judge: Address;
    weight: number;
}
export interface ProgramConfigOnChain {
    treasury: Address;
    upgradeAuthority: Address;
    minJudgeStake: bigint;
    taskCount: bigint;
    bump: number;
}
export interface PostTaskSimpleRequest {
    evalRef: string;
    reward: number | bigint;
    category: number;
    minStake?: number | bigint;
    judgeMode?: number;
    judge?: Address;
    deadline?: number | bigint;
    judgeDeadline?: number | bigint;
    deadlineOffsetSeconds?: number | bigint;
    judgeDeadlineOffsetSeconds?: number | bigint;
    mint?: Address;
    tokenProgram?: Address;
    posterTokenAccount?: Address;
    escrowAta?: Address;
}
export interface PostTaskSimpleResult {
    taskId: bigint;
    signature: string;
}
export interface TaskCompletionAttestationApi {
    task_id: number;
    task_category: number;
    judge_method: number;
    score: number;
    reward_amount: string;
    completed_at: number;
    credential: string;
    schema: string;
    signature?: string;
}
export interface TaskCompletionAttestationData {
    taskId: bigint;
    taskCategory: number;
    judgeMethod: number;
    score: number;
    rewardAmount: bigint;
    completedAt: bigint;
}
export interface TaskCompletionAttestationRecord extends TaskCompletionAttestationData {
    credential: string;
    schema: string;
    signature?: string;
}
export interface AgentProfileLinks {
    website?: string;
    github?: string;
    x?: string;
}
export type ProfilePublishMode = 'manual' | 'git-sync';
export interface AgentProfileApi {
    agent: string;
    display_name: string;
    bio: string;
    links: AgentProfileLinks;
    onchain_ref: string | null;
    publish_mode: ProfilePublishMode;
    updated_at: number;
}
export interface AgentProfileUpdate {
    display_name: string;
    bio: string;
    links?: AgentProfileLinks;
}
export declare class GradienceSDK {
    private indexerEndpoint;
    private attestationEndpoint;
    private programAddress;
    private rpc;
    constructor(options?: GradienceSdkOptions);
    setIndexerEndpoint(endpoint: string): void;
    setAttestationEndpoint(endpoint: string): void;
    setRpc(rpc: Parameters<typeof fetchEncodedAccount>[0]): void;
    readonly instructions: {
        readonly initialize: (
            input: Parameters<typeof getInitializeInstruction>[0],
            config?: Parameters<typeof getInitializeInstruction>[1],
        ) => import('./generated/index.js').InitializeInstruction<Address, string, string, string, string, []>;
        readonly postTask: (
            input: Parameters<typeof getPostTaskInstruction>[0],
            config?: Parameters<typeof getPostTaskInstruction>[1],
        ) => import('./generated/index.js').PostTaskInstruction<
            Address,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            []
        >;
        readonly applyForTask: (
            input: Parameters<typeof getApplyForTaskInstruction>[0],
            config?: Parameters<typeof getApplyForTaskInstruction>[1],
        ) => import('./generated/index.js').ApplyForTaskInstruction<
            Address,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            []
        >;
        readonly submitResult: (
            input: Parameters<typeof getSubmitResultInstruction>[0],
            config?: Parameters<typeof getSubmitResultInstruction>[1],
        ) => import('./generated/index.js').SubmitResultInstruction<
            Address,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            []
        >;
        readonly judgeAndPay: (
            input: Parameters<typeof getJudgeAndPayInstruction>[0],
            config?: Parameters<typeof getJudgeAndPayInstruction>[1],
        ) => import('./generated/index.js').JudgeAndPayInstruction<
            Address,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            []
        >;
        readonly cancelTask: (
            input: Parameters<typeof getCancelTaskInstruction>[0],
            config?: Parameters<typeof getCancelTaskInstruction>[1],
        ) => import('./generated/index.js').CancelTaskInstruction<
            Address,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            []
        >;
        readonly refundExpired: (
            input: Parameters<typeof getRefundExpiredInstruction>[0],
            config?: Parameters<typeof getRefundExpiredInstruction>[1],
        ) => import('./generated/index.js').RefundExpiredInstruction<
            Address,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            []
        >;
        readonly forceRefund: (
            input: Parameters<typeof getForceRefundInstruction>[0],
            config?: Parameters<typeof getForceRefundInstruction>[1],
        ) => import('./generated/index.js').ForceRefundInstruction<
            Address,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            []
        >;
        readonly registerJudge: (
            input: Parameters<typeof getRegisterJudgeInstruction>[0],
            config?: Parameters<typeof getRegisterJudgeInstruction>[1],
        ) => import('./generated/index.js').RegisterJudgeInstruction<
            Address,
            string,
            string,
            string,
            string,
            string,
            string,
            string,
            []
        >;
        readonly unstakeJudge: (
            input: Parameters<typeof getUnstakeJudgeInstruction>[0],
            config?: Parameters<typeof getUnstakeJudgeInstruction>[1],
        ) => import('./generated/index.js').UnstakeJudgeInstruction<
            Address,
            string,
            string,
            string,
            string,
            string,
            []
        >;
        readonly upgradeConfig: (
            input: Parameters<typeof getUpgradeConfigInstruction>[0],
            config?: Parameters<typeof getUpgradeConfigInstruction>[1],
        ) => import('./generated/index.js').UpgradeConfigInstruction<Address, string, string, []>;
    };
    readonly task: {
        /** Post a new task on-chain. */
        readonly post: (wallet: WalletAdapter, request: PostTaskRequest) => Promise<string>;
        /**
         * High-level helper: derive next task id from on-chain config and post task
         * with sensible deadline defaults.
         */
        readonly postSimple: (wallet: WalletAdapter, request: PostTaskSimpleRequest) => Promise<PostTaskSimpleResult>;
        /** Apply to an existing task on-chain. */
        readonly apply: (wallet: WalletAdapter, request: ApplyTaskRequest) => Promise<string>;
        /** Submit task result on-chain. */
        readonly submit: (wallet: WalletAdapter, request: SubmitTaskResultRequest) => Promise<string>;
        /** Judge a task and settle funds on-chain. */
        readonly judge: (wallet: WalletAdapter, request: JudgeTaskRequest) => Promise<string>;
        /** Cancel a task and refund stakes/reward on-chain. */
        readonly cancel: (wallet: WalletAdapter, request: CancelTaskRequest) => Promise<string>;
        /** Refund expired task on-chain. */
        readonly refund: (wallet: WalletAdapter, request: RefundExpiredRequest) => Promise<string>;
        /** Force refund path on-chain with judge slash logic. */
        readonly forceRefund: (wallet: WalletAdapter, request: ForceRefundRequest) => Promise<string>;
        /**
         * Fetch submissions for a task from indexer.
         * Returns `null` when the task is not found.
         */
        readonly submissions: (
            taskId: number,
            params?: {
                sort?: 'score' | 'slot';
            },
        ) => Promise<SubmissionApi[] | null>;
    };
    readonly reputation: {
        /**
         * Fetch on-chain reputation PDA.
         * Returns `null` when the account does not exist.
         */
        readonly get: (agent: Address) => Promise<ReputationOnChain | null>;
    };
    readonly judgePool: {
        /**
         * Fetch on-chain judge pool PDA members for a category.
         * Returns `null` when the pool account does not exist.
         */
        readonly list: (category: number) => Promise<JudgePoolMemberOnChain[] | null>;
    };
    readonly config: {
        /**
         * Fetch on-chain ProgramConfig PDA.
         * Returns `null` when the config account does not exist.
         */
        readonly get: () => Promise<ProgramConfigOnChain | null>;
    };
    readonly profile: {
        /** Fetch agent profile from Indexer. Returns `null` when not found. */
        readonly get: (agent: string) => Promise<AgentProfileApi | null>;
        /** Update agent profile via Indexer. */
        readonly update: (
            agent: string,
            data: AgentProfileUpdate,
        ) => Promise<{
            ok: boolean;
        }>;
    };
    readonly attestations: {
        /**
         * Fetch TaskCompletion attestations for a given agent.
         * Returns `null` when the attestation endpoint or agent record is not found.
         */
        readonly list: (agent: string) => Promise<TaskCompletionAttestationApi[] | null>;
        /**
         * Fetch and normalize TaskCompletion attestations to strongly-typed bigint fields.
         * Returns `null` when the attestation endpoint or agent record is not found.
         */
        readonly listDecoded: (agent: string) => Promise<TaskCompletionAttestationRecord[] | null>;
        /**
         * Decode on-chain TaskCompletion attestation payload bytes
         * ordered as [U64, U8, U8, U8, U64, I64].
         */
        readonly decode: typeof decodeTaskCompletionAttestation;
    };
    postTask(wallet: WalletAdapter, request: PostTaskRequest): Promise<string>;
    postTaskSimple(wallet: WalletAdapter, request: PostTaskSimpleRequest): Promise<PostTaskSimpleResult>;
    applyForTask(wallet: WalletAdapter, request: ApplyTaskRequest): Promise<string>;
    submitResult(wallet: WalletAdapter, request: SubmitTaskResultRequest): Promise<string>;
    judgeTask(wallet: WalletAdapter, request: JudgeTaskRequest): Promise<string>;
    cancelTask(wallet: WalletAdapter, request: CancelTaskRequest): Promise<string>;
    refundExpiredTask(wallet: WalletAdapter, request: RefundExpiredRequest): Promise<string>;
    forceRefundTask(wallet: WalletAdapter, request: ForceRefundRequest): Promise<string>;
    getTasks(params?: {
        status?: 'open' | 'completed' | 'refunded';
        category?: number;
        mint?: string;
        poster?: string;
        limit?: number;
        offset?: number;
    }): Promise<TaskApi[]>;
    getTask(taskId: number): Promise<TaskApi | null>;
    getTaskSubmissions(
        taskId: number,
        params?: {
            sort?: 'score' | 'slot';
        },
    ): Promise<SubmissionApi[] | null>;
    getReputation(agent: string): Promise<ReputationApi | null>;
    getJudgePool(category: number): Promise<JudgePoolEntryApi[] | null>;
    getAgentAttestations(agent: string): Promise<TaskCompletionAttestationApi[] | null>;
    getDecodedAgentAttestations(agent: string): Promise<TaskCompletionAttestationRecord[] | null>;
    getAgentProfile(agent: string): Promise<AgentProfileApi | null>;
    updateAgentProfile(
        agent: string,
        data: AgentProfileUpdate,
    ): Promise<{
        ok: boolean;
    }>;
    getReputationOnChain(agent: Address): Promise<ReputationOnChain | null>;
    getJudgePoolOnChain(category: number): Promise<JudgePoolMemberOnChain[] | null>;
    getProgramConfigOnChain(): Promise<ProgramConfigOnChain | null>;
    private getJson;
    private getJsonWithBase;
    private getJsonOrNull;
    private resolveTokenContext;
    private resolveJudgeTokenContext;
    private resolveForceRefundTokenContext;
    private resolveRefundPairs;
    private resolveSendOptions;
}
export declare const SAS_PROGRAM_ID: Address<'22zoJMtdu4rFKKrUQT8cNdqKouMXGMnqxdLY8nzaVmXq'>;
export declare function normalizeTaskCompletionAttestation(
    attestation: TaskCompletionAttestationApi,
): TaskCompletionAttestationRecord;
export declare function decodeTaskCompletionAttestation(raw: Uint8Array): TaskCompletionAttestationData;
