import {
    getApplyForTaskInstructionAsync,
    getCancelTaskInstructionAsync,
    getForceRefundInstructionAsync,
    getJudgeAndPayInstructionAsync,
    getPostTaskInstructionAsync,
    getRefundExpiredInstructionAsync,
    getSubmitResultInstructionAsync,
    type RuntimeEnvInputArgs,
} from '../generated/index.js';
import {
    AccountRole,
    getAddressEncoder,
    getProgramDerivedAddress,
    type AccountMeta,
    type Address,
    type Instruction,
    type TransactionSigner,
} from '@solana/kit';

// Re-export types that are used by TasksResource
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

export interface TokenContext {
    isSpl: boolean;
    mint?: Address;
    tokenProgram?: Address;
    ownerTokenAccount?: Address;
    escrowAta?: Address;
    associatedTokenProgram?: Address;
    mintBytes: number[];
}

export interface JudgeTokenContext {
    isSpl: boolean;
    mint?: Address;
    tokenProgram?: Address;
    judgeTokenAccount?: Address;
    winnerTokenAccount?: Address;
    posterTokenAccount?: Address;
    treasuryAta?: Address;
    escrowAta?: Address;
    associatedTokenProgram?: Address;
}

export interface ForceRefundTokenContext {
    isSpl: boolean;
    mint?: Address;
    tokenProgram?: Address;
    posterTokenAccount?: Address;
    mostActiveAgentTokenAccount?: Address;
    treasuryAta?: Address;
    escrowAta?: Address;
    associatedTokenProgram?: Address;
}

type QueryValue = string | number | undefined;

/**
 * Resource class for task-related operations in the Gradience SDK.
 * Handles posting, applying, submitting, judging, and managing tasks.
 */
export class TasksResource {
    constructor(
        private readonly programAddress: Address,
        private readonly findConfigPda: () => Promise<readonly [Address, number]>,
        private readonly findTaskPda: (taskId: bigint) => Promise<readonly [Address, number]>,
        private readonly findEscrowPda: (taskId: bigint) => Promise<readonly [Address, number]>,
        private readonly findJudgePoolPda: (category: number) => Promise<readonly [Address, number]>,
        private readonly findApplicationPda: (taskId: bigint, agent: Address) => Promise<readonly [Address, number]>,
        private readonly findSubmissionPda: (taskId: bigint, agent: Address) => Promise<readonly [Address, number]>,
        private readonly findReputationPda: (agent: Address) => Promise<readonly [Address, number]>,
        private readonly findStakePda: (judge: Address) => Promise<readonly [Address, number]>,
        private readonly findTreasuryPda: () => Promise<readonly [Address, number]>,
        private readonly findAssociatedTokenAddress: (
            owner: Address,
            mint: Address,
            tokenProgram: Address,
            associatedTokenProgram: Address,
        ) => Promise<readonly [Address, number]>,
        private readonly resolveTokenContext: (params: {
            owner: Address;
            escrow: Address;
            mint?: Address;
            tokenProgram?: Address;
            ownerTokenAccount?: Address;
            escrowAta?: Address;
        }) => Promise<TokenContext>,
        private readonly resolveJudgeTokenContext: (params: {
            mint?: Address;
            tokenProgram?: Address;
            escrow: Address;
            judge: Address;
            winner: Address;
            poster: Address;
            judgeTokenAccount?: Address;
            winnerTokenAccount?: Address;
            posterTokenAccount?: Address;
            treasuryAta?: Address;
            escrowAta?: Address;
        }) => Promise<JudgeTokenContext>,
        private readonly resolveForceRefundTokenContext: (params: {
            mint?: Address;
            tokenProgram?: Address;
            escrow: Address;
            poster: Address;
            mostActiveAgent: Address;
            treasury: Address;
            posterTokenAccount?: Address;
            mostActiveAgentTokenAccount?: Address;
            escrowAta?: Address;
            treasuryAta?: Address;
        }) => Promise<ForceRefundTokenContext>,
        private readonly resolveRefundPairs: (
            taskId: bigint,
            recipients: StakeRefundRecipient[] | undefined,
            options: { mint?: Address; tokenProgram?: Address },
        ) => Promise<{ metas: AccountMeta[]; addresses: Address[] }>,
        private readonly resolveSendOptions: (
            wallet: WalletAdapter,
            taskId: bigint,
            remainingAddresses: Address[],
        ) => Promise<SendTransactionOptions | undefined>,
        private readonly stripOptionalTail: <TInstruction extends Instruction>(
            instruction: TInstruction,
            optionalTailCount: number,
            placeholderAddress: Address,
        ) => TInstruction,
        private readonly removeAccountsAtIndexes: <TInstruction extends Instruction>(
            instruction: TInstruction,
            indexes: number[],
        ) => TInstruction,
        private readonly appendRemainingAccounts: <TInstruction extends Instruction>(
            instruction: TInstruction,
            remainingAccounts: AccountMeta[],
        ) => TInstruction,
        private readonly addressToBytes: (value: Address | undefined) => number[],
        private readonly getProgramConfigOnChain: () => Promise<{ taskCount: bigint } | null>,
        private readonly getJson: <T>(path: string, query?: Record<string, QueryValue>) => Promise<T>,
        private readonly getJsonOrNull: <T>(path: string, query?: Record<string, QueryValue>) => Promise<T | null>,
    ) {}

    /**
     * Post a new task on-chain.
     */
    async postTask(wallet: WalletAdapter, request: PostTaskRequest): Promise<string> {
        const taskId = BigInt(request.taskId);
        const [config] = await this.findConfigPda();
        const [task] = await this.findTaskPda(taskId);
        const [escrow] = await this.findEscrowPda(taskId);
        const [judgePool] = await this.findJudgePoolPda(request.category);

        // Derive MagicBlock Permission PDA for the task
        const PERMISSION_PROGRAM_ADDRESS = 'ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1' as Address;
        const addressEncoder = getAddressEncoder();
        const [permissionPda] = await getProgramDerivedAddress({
            programAddress: PERMISSION_PROGRAM_ADDRESS,
            seeds: [new TextEncoder().encode('permission:'), addressEncoder.encode(task)],
        });

        const tokenCtx = await this.resolveTokenContext({
            owner: wallet.signer.address,
            escrow,
            mint: request.mint,
            tokenProgram: request.tokenProgram,
            ownerTokenAccount: request.posterTokenAccount,
            escrowAta: request.escrowAta,
        });

        const instruction = await getPostTaskInstructionAsync({
            poster: wallet.signer,
            config,
            task,
            escrow,
            judgePool,
            gradienceProgram: this.programAddress,
            evalRef: request.evalRef,
            deadline: request.deadline,
            judgeDeadline: request.judgeDeadline,
            judgeMode: request.judgeMode,
            judge: this.addressToBytes(request.judge),
            category: request.category,
            mint: tokenCtx.mintBytes,
            minStake: request.minStake,
            reward: request.reward,
            posterTokenAccount: tokenCtx.ownerTokenAccount,
            escrowAta: tokenCtx.escrowAta,
            mintAccount: tokenCtx.mint,
            tokenProgram: tokenCtx.tokenProgram,
            associatedTokenProgram: tokenCtx.associatedTokenProgram,
        });

        // Patch instruction accounts to include PER permission + permission_program
        // They are inserted after gradienceProgram (index 7) and before optional SPL accounts.
        const patchedInstruction: Instruction = {
            ...instruction,
            accounts: [
                ...instruction.accounts.slice(0, 8),
                { address: permissionPda, role: AccountRole.WRITABLE },
                { address: PERMISSION_PROGRAM_ADDRESS, role: AccountRole.READONLY },
                ...instruction.accounts.slice(8),
            ],
        };

        const normalizedInstruction = tokenCtx.isSpl
            ? patchedInstruction
            : this.stripOptionalTail(patchedInstruction, 5, this.programAddress);
        return wallet.signAndSendTransaction([normalizedInstruction]);
    }

    /**
     * High-level helper: derive next task id from on-chain config and post task
     * with sensible deadline defaults.
     */
    async postTaskSimple(wallet: WalletAdapter, request: PostTaskSimpleRequest): Promise<PostTaskSimpleResult> {
        const judgeMode = request.judgeMode ?? 1;
        if (judgeMode === 0 && !request.judge) {
            throw new Error('judge is required when judgeMode=0 (designated)');
        }
        const now = BigInt(Math.floor(Date.now() / 1000));
        const deadline = request.deadline
            ? BigInt(request.deadline)
            : now + BigInt(request.deadlineOffsetSeconds ?? 3_600);
        const judgeDeadline = request.judgeDeadline
            ? BigInt(request.judgeDeadline)
            : deadline + BigInt(request.judgeDeadlineOffsetSeconds ?? 3_600);

        const config = await this.getProgramConfigOnChain();
        if (!config) {
            throw new Error('Program config account not found; initialize program before posting');
        }
        const taskId = config.taskCount;
        const signature = await this.postTask(wallet, {
            taskId,
            evalRef: request.evalRef,
            deadline,
            judgeDeadline,
            judgeMode,
            judge: request.judge,
            category: request.category,
            minStake: request.minStake ?? 0,
            reward: request.reward,
            mint: request.mint,
            tokenProgram: request.tokenProgram,
            posterTokenAccount: request.posterTokenAccount,
            escrowAta: request.escrowAta,
        });
        return { taskId, signature };
    }

    /**
     * Apply to an existing task on-chain.
     */
    async applyForTask(wallet: WalletAdapter, request: ApplyTaskRequest): Promise<string> {
        const taskId = BigInt(request.taskId);
        const [task] = await this.findTaskPda(taskId);
        const [escrow] = await this.findEscrowPda(taskId);
        const [application] = await this.findApplicationPda(taskId, wallet.signer.address);
        const [reputation] = await this.findReputationPda(wallet.signer.address);

        const tokenCtx = await this.resolveTokenContext({
            owner: wallet.signer.address,
            escrow,
            mint: request.mint,
            tokenProgram: request.tokenProgram,
            ownerTokenAccount: request.agentTokenAccount,
            escrowAta: request.escrowAta,
        });

        const instruction = await getApplyForTaskInstructionAsync({
            agent: wallet.signer,
            task,
            escrow,
            application,
            reputation,
            gradienceProgram: this.programAddress,
            agentTokenAccount: tokenCtx.ownerTokenAccount,
            escrowAta: tokenCtx.escrowAta,
            mintAccount: tokenCtx.mint,
            tokenProgram: tokenCtx.tokenProgram,
        });

        const normalizedInstruction = tokenCtx.isSpl
            ? instruction
            : this.stripOptionalTail(instruction, 4, this.programAddress);
        return wallet.signAndSendTransaction([normalizedInstruction]);
    }

    /**
     * Submit task result on-chain.
     */
    async submitResult(wallet: WalletAdapter, request: SubmitTaskResultRequest): Promise<string> {
        const taskId = BigInt(request.taskId);
        const [task] = await this.findTaskPda(taskId);
        const [application] = await this.findApplicationPda(taskId, wallet.signer.address);
        const [submission] = await this.findSubmissionPda(taskId, wallet.signer.address);

        const instruction = await getSubmitResultInstructionAsync({
            agent: wallet.signer,
            task,
            application,
            submission,
            gradienceProgram: this.programAddress,
            resultRef: request.resultRef,
            traceRef: request.traceRef,
            runtimeEnv: request.runtimeEnv,
        });

        return wallet.signAndSendTransaction([instruction]);
    }

    /**
     * Judge a task and settle funds on-chain.
     */
    async judgeTask(wallet: WalletAdapter, request: JudgeTaskRequest): Promise<string> {
        const taskId = BigInt(request.taskId);
        const [task] = await this.findTaskPda(taskId);
        const [escrow] = await this.findEscrowPda(taskId);
        const [winnerApplication] = await this.findApplicationPda(taskId, request.winner);
        const [winnerSubmission] = await this.findSubmissionPda(taskId, request.winner);
        const [winnerReputation] = await this.findReputationPda(request.winner);
        const [judgeStake] = await this.findStakePda(wallet.signer.address);
        const [treasury] = await this.findTreasuryPda();

        const tokenCtx = await this.resolveJudgeTokenContext({
            mint: request.mint,
            tokenProgram: request.tokenProgram,
            escrow,
            judge: wallet.signer.address,
            winner: request.winner,
            poster: request.poster,
            judgeTokenAccount: request.judgeTokenAccount,
            winnerTokenAccount: request.winnerTokenAccount,
            posterTokenAccount: request.posterTokenAccount,
            treasuryAta: request.treasuryAta,
            escrowAta: request.escrowAta,
        });

        const remaining = await this.resolveRefundPairs(taskId, request.losers, {
            mint: request.mint,
            tokenProgram: tokenCtx.tokenProgram,
        });

        const instruction = await getJudgeAndPayInstructionAsync({
            judge: wallet.signer,
            task,
            escrow,
            posterAccount: request.poster,
            winnerAccount: request.winner,
            winnerApplication,
            winnerSubmission,
            winnerReputation,
            judgeStake,
            treasury,
            gradienceProgram: this.programAddress,
            winner: this.addressToBytes(request.winner),
            score: request.score,
            reasonRef: request.reasonRef,
            judgeTokenAccount: tokenCtx.judgeTokenAccount,
            escrowAta: tokenCtx.escrowAta,
            winnerTokenAccount: tokenCtx.winnerTokenAccount,
            posterTokenAccount: tokenCtx.posterTokenAccount,
            treasuryAta: tokenCtx.treasuryAta,
            mintAccount: tokenCtx.mint,
            tokenProgram: tokenCtx.tokenProgram,
            associatedTokenProgram: tokenCtx.associatedTokenProgram,
        });

        const normalizedInstruction = tokenCtx.isSpl
            ? instruction
            : this.stripOptionalTail(instruction, 8, this.programAddress);
        const instructionWithRemaining = this.appendRemainingAccounts(normalizedInstruction, remaining.metas);
        const sendOptions = await this.resolveSendOptions(wallet, taskId, remaining.addresses);
        return wallet.signAndSendTransaction([instructionWithRemaining], sendOptions);
    }

    /**
     * Cancel a task and refund stakes/reward on-chain.
     */
    async cancelTask(wallet: WalletAdapter, request: CancelTaskRequest): Promise<string> {
        const taskId = BigInt(request.taskId);
        const [task] = await this.findTaskPda(taskId);
        const [escrow] = await this.findEscrowPda(taskId);
        const [treasury] = await this.findTreasuryPda();

        const tokenCtx = await this.resolveTokenContext({
            owner: wallet.signer.address,
            escrow,
            mint: request.mint,
            tokenProgram: request.tokenProgram,
            ownerTokenAccount: request.posterTokenAccount,
            escrowAta: request.escrowAta,
        });

        const ASSOCIATED_TOKEN_PROGRAM_ADDRESS = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address;
        const treasuryAta =
            tokenCtx.isSpl && tokenCtx.mint && tokenCtx.tokenProgram
                ? (request.treasuryAta ??
                  (
                      await this.findAssociatedTokenAddress(
                          treasury,
                          tokenCtx.mint,
                          tokenCtx.tokenProgram,
                          ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
                      )
                  )[0])
                : undefined;

        const remaining = await this.resolveRefundPairs(taskId, request.refunds, {
            mint: request.mint,
            tokenProgram: tokenCtx.tokenProgram,
        });

        const instruction = await getCancelTaskInstructionAsync({
            poster: wallet.signer,
            task,
            escrow,
            treasury,
            gradienceProgram: this.programAddress,
            posterTokenAccount: tokenCtx.ownerTokenAccount,
            escrowAta: tokenCtx.escrowAta,
            treasuryAta,
            mintAccount: tokenCtx.mint,
            tokenProgram: tokenCtx.tokenProgram,
            associatedTokenProgram: tokenCtx.associatedTokenProgram,
        });

        const normalizedInstruction = tokenCtx.isSpl
            ? instruction
            : this.stripOptionalTail(instruction, 6, this.programAddress);
        const instructionWithRemaining = this.appendRemainingAccounts(normalizedInstruction, remaining.metas);
        const sendOptions = await this.resolveSendOptions(wallet, taskId, remaining.addresses);
        return wallet.signAndSendTransaction([instructionWithRemaining], sendOptions);
    }

    /**
     * Refund expired task on-chain.
     */
    async refundExpiredTask(wallet: WalletAdapter, request: RefundExpiredRequest): Promise<string> {
        const taskId = BigInt(request.taskId);
        const [task] = await this.findTaskPda(taskId);
        const [escrow] = await this.findEscrowPda(taskId);

        const tokenCtx = await this.resolveTokenContext({
            owner: request.poster,
            escrow,
            mint: request.mint,
            tokenProgram: request.tokenProgram,
            ownerTokenAccount: request.posterTokenAccount,
            escrowAta: request.escrowAta,
        });
        const remaining = await this.resolveRefundPairs(taskId, request.refunds, {
            mint: request.mint,
            tokenProgram: tokenCtx.tokenProgram,
        });

        const instruction = await getRefundExpiredInstructionAsync({
            anyone: wallet.signer,
            poster: tokenCtx.isSpl ? undefined : request.poster,
            task,
            escrow,
            gradienceProgram: this.programAddress,
            posterTokenAccount: tokenCtx.ownerTokenAccount,
            escrowAta: tokenCtx.escrowAta,
            mintAccount: tokenCtx.mint,
            tokenProgram: tokenCtx.tokenProgram,
        });

        const normalizedInstruction = tokenCtx.isSpl
            ? this.removeAccountsAtIndexes(instruction, [1])
            : this.stripOptionalTail(instruction, 4, this.programAddress);
        const instructionWithRemaining = this.appendRemainingAccounts(normalizedInstruction, remaining.metas);
        const sendOptions = await this.resolveSendOptions(wallet, taskId, remaining.addresses);
        return wallet.signAndSendTransaction([instructionWithRemaining], sendOptions);
    }

    /**
     * Force refund path on-chain with judge slash logic.
     */
    async forceRefundTask(wallet: WalletAdapter, request: ForceRefundRequest): Promise<string> {
        const taskId = BigInt(request.taskId);
        const [config] = await this.findConfigPda();
        const [task] = await this.findTaskPda(taskId);
        const [escrow] = await this.findEscrowPda(taskId);
        const [judgeStake] = await this.findStakePda(request.judge);
        const [judgeReputation] = await this.findReputationPda(request.judge);
        const [treasury] = await this.findTreasuryPda();

        const tokenCtx = await this.resolveForceRefundTokenContext({
            mint: request.mint,
            tokenProgram: request.tokenProgram,
            escrow,
            poster: request.poster,
            mostActiveAgent: request.mostActiveAgent,
            posterTokenAccount: request.posterTokenAccount,
            mostActiveAgentTokenAccount: request.mostActiveAgentTokenAccount,
            escrowAta: request.escrowAta,
            treasuryAta: request.treasuryAta,
            treasury,
        });
        const judgePools = await Promise.all(
            request.judgeCategories.map(category => this.findJudgePoolPda(category)),
        );
        const judgePoolMetas: AccountMeta[] = judgePools.map(([pool]) => ({
            address: pool,
            role: AccountRole.WRITABLE,
        }));

        const remaining = await this.resolveRefundPairs(taskId, request.refunds, {
            mint: request.mint,
            tokenProgram: tokenCtx.tokenProgram,
        });

        const instruction = await getForceRefundInstructionAsync({
            anyone: wallet.signer,
            posterAccount: request.poster,
            mostActiveAgent: request.mostActiveAgent,
            config,
            task,
            escrow,
            judgeStake,
            judgeAccount: request.judge,
            judgeReputation,
            treasury,
            gradienceProgram: this.programAddress,
            posterTokenAccount: tokenCtx.posterTokenAccount,
            mostActiveAgentTokenAccount: tokenCtx.mostActiveAgentTokenAccount,
            escrowAta: tokenCtx.escrowAta,
            treasuryAta: tokenCtx.treasuryAta,
            mintAccount: tokenCtx.mint,
            tokenProgram: tokenCtx.tokenProgram,
            associatedTokenProgram: tokenCtx.associatedTokenProgram,
        });

        const normalizedInstruction = tokenCtx.isSpl
            ? instruction
            : this.stripOptionalTail(instruction, 7, this.programAddress);
        const instructionWithRemaining = this.appendRemainingAccounts(normalizedInstruction, [
            ...judgePoolMetas,
            ...remaining.metas,
        ]);
        const sendOptions = await this.resolveSendOptions(wallet, taskId, [
            ...judgePools.map(([pool]) => pool),
            ...remaining.addresses,
        ]);
        return wallet.signAndSendTransaction([instructionWithRemaining], sendOptions);
    }

    /**
     * Fetch tasks from indexer.
     */
    async getTasks(
        params: {
            status?: 'open' | 'completed' | 'refunded';
            category?: number;
            mint?: string;
            poster?: string;
            limit?: number;
            offset?: number;
        } = {},
    ): Promise<TaskApi[]> {
        return this.getJson<TaskApi[]>('/api/tasks', params);
    }

    /**
     * Fetch a single task from indexer.
     * Returns `null` when the task is not found.
     */
    async getTask(taskId: number): Promise<TaskApi | null> {
        return this.getJsonOrNull<TaskApi>(`/api/tasks/${taskId}`);
    }

    /**
     * Fetch submissions for a task from indexer.
     * Returns `null` when the task is not found.
     */
    async getTaskSubmissions(
        taskId: number,
        params: { sort?: 'score' | 'slot' } = {},
    ): Promise<SubmissionApi[] | null> {
        return this.getJsonOrNull<SubmissionApi[]>(`/api/tasks/${taskId}/submissions`, params);
    }
}
