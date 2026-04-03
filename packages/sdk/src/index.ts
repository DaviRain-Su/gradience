/**
 * @gradiences/sdk — Unified Gradience Protocol SDK
 *
 * Entry point exposing:
 *  - {@link Gradience}  High-level 3-line client (arena + chain hub)
 *  - Arena SDK          Full on-chain instruction builders via `@gradiences/sdk/arena`
 *  - Chain Hub SDK      Off-chain reputation / routing via `@gradiences/sdk/chain-hub`
 *  - Wallet adapters    KeypairAdapter + stubs via `@gradiences/sdk/wallet`
 *
 * @example
 * ```ts
 * import { Gradience, KeypairAdapter } from '@gradiences/sdk';
 *
 * const wallet = new KeypairAdapter({ signer, rpcEndpoint });
 * const client = new Gradience({ rpcEndpoint, indexerEndpoint, wallet });
 * const { taskId, signature } = await client.postTask({
 *   description: 'Summarise this PDF',
 *   reward: 500_000_000n,
 *   category: 1,
 * });
 * ```
 */

import { GradienceSDK } from '@gradiences/arena-sdk';
import { ChainHubClient } from '../../apps/chain-hub/sdk/client';
import type { Address } from '@solana/kit';
import type {
    WalletAdapter,
    PostTaskSimpleResult,
    SubmitTaskResultRequest,
    TaskApi,
    SubmissionApi,
    ReputationOnChain,
} from '@gradiences/arena-sdk';
import type { ReputationData } from '../../apps/chain-hub/sdk/client';
import type {
    GradienceClientOptions,
    PostTaskOptions,
    PostTaskResult,
} from './types';

// ── Re-exports ────────────────────────────────────────────────────────────────

export * from './types';
export * from './wallet';

// Selectively re-export arena SDK to avoid name collisions with chain-hub
export {
    GradienceSDK,
    GRADIENCE_PROGRAM_ADDRESS,
} from '@gradiences/arena-sdk';

// Chain Hub — re-export from the sub-path to keep this entry-point slim
export { ChainHubClient, ChainHubError } from '../../apps/chain-hub/sdk/client';
export type { ChainHubClientConfig, ReputationData, AgentInfo, SqlQueryResult } from '../../apps/chain-hub/sdk/client';

// ── Gradience unified client ──────────────────────────────────────────────────

/**
 * Top-level Gradience client.  Composes the Agent Arena SDK (on-chain) with
 * the Chain Hub client (off-chain) behind a single, easy-to-use interface.
 *
 * ```ts
 * const client = new Gradience({ rpcEndpoint, indexerEndpoint, wallet });
 * await client.postTask({ description, reward, category });
 * ```
 */
export class Gradience {
    /** Direct access to the full Agent Arena on-chain SDK */
    readonly arena: GradienceSDK;
    /** Direct access to the Chain Hub off-chain client */
    readonly hub: ChainHubClient;
    private defaultWallet?: WalletAdapter;

    constructor(options: GradienceClientOptions = {}) {
        this.arena = new GradienceSDK({
            rpcEndpoint: options.rpcEndpoint,
            indexerEndpoint: options.indexerEndpoint,
            attestationEndpoint: options.attestationEndpoint,
            programAddress: options.programAddress as Address | undefined,
        });

        this.hub = new ChainHubClient({
            baseUrl: options.indexerEndpoint,
        });

        this.defaultWallet = options.wallet;
    }

    // ── On-chain task operations ──────────────────────────────────────────────

    /**
     * Post a new task on-chain using the high-level simple path.
     *
     * Maps `description` to the on-chain `evalRef` field and fills in
     * sensible deadline defaults.
     *
     * @param options - Task parameters (see {@link PostTaskOptions})
     * @param wallet  - Override the wallet for this call (falls back to
     *                  the wallet passed to the constructor)
     */
    async postTask(options: PostTaskOptions, wallet?: WalletAdapter): Promise<PostTaskResult> {
        const signer = wallet ?? this.defaultWallet;
        if (!signer) {
            throw new Error(
                'A wallet is required for postTask. ' +
                'Pass one to new Gradience({ wallet }) or as the second argument.',
            );
        }
        const result: PostTaskSimpleResult = await this.arena.task.postSimple(signer, {
            evalRef: options.description,
            reward: options.reward,
            category: options.category,
            deadline: options.deadline,
            judgeDeadlineOffsetSeconds: options.judgeDeadlineOffsetSeconds,
            judgeMode: options.judgeMode,
            judge: options.judge as Address | undefined,
            minStake: options.minStake,
            mint: options.mint as Address | undefined,
        });
        return result;
    }

    /**
     * Apply for an existing open task (staking the required minimum).
     */
    async applyTask(
        taskId: number | bigint,
        wallet?: WalletAdapter,
    ): Promise<string> {
        const signer = wallet ?? this.defaultWallet;
        if (!signer) throw new Error('A wallet is required for applyTask.');
        return this.arena.task.apply(signer, { taskId });
    }

    /**
     * Submit a result for a task the calling agent applied to.
     */
    async submitResult(
        options: SubmitTaskResultRequest,
        wallet?: WalletAdapter,
    ): Promise<string> {
        const signer = wallet ?? this.defaultWallet;
        if (!signer) throw new Error('A wallet is required for submitResult.');
        return this.arena.task.submit(signer, options);
    }

    // ── Off-chain queries (no wallet needed) ─────────────────────────────────

    /**
     * Fetch the reputation record for an agent from the indexer.
     * Returns `null` when the agent has no recorded activity.
     */
    async getReputation(agent: string): Promise<ReputationData | null> {
        return this.hub.getReputation(agent);
    }

    /**
     * Fetch a single task by ID from the indexer.
     */
    async getTask(taskId: number): Promise<TaskApi> {
        return this.hub.getTask(taskId) as Promise<TaskApi>;
    }

    /**
     * List tasks, optionally filtering by state or poster.
     */
    async getTasks(params?: {
        state?: 'open' | 'completed' | 'refunded';
        poster?: string;
        limit?: number;
    }): Promise<TaskApi[]> {
        return this.hub.getTasks(params) as Promise<TaskApi[]>;
    }

    /**
     * Fetch all submissions for a task.
     */
    async getSubmissions(taskId: number): Promise<SubmissionApi[]> {
        return this.hub.getTaskSubmissions(taskId) as Promise<SubmissionApi[]>;
    }

    /**
     * Fetch on-chain reputation PDA directly from Solana.
     */
    async getReputationOnChain(agent: string): Promise<ReputationOnChain | null> {
        return this.arena.reputation.get(agent as Address);
    }

    /**
     * Check indexer health.
     */
    async healthCheck(): Promise<boolean> {
        return this.hub.healthCheck();
    }
}
