/**
 * Shared TransactionManager interface for Solana and EVM adapters.
 */

export interface PostTaskParams {
    evalRef: string;
    deadline: number;
    judgeDeadline: number;
    judgeMode: number;
    judge?: string;
    category: number;
    mint?: string;
    minStake: number;
    reward: number;
}

export interface RuntimeEnv {
    provider: string;
    model: string;
    runtime: string;
    version: string;
}

export interface ITransactionManager {
    getBalance(): Promise<number>;
    postTask(params: PostTaskParams): Promise<string>;
    applyForTask(taskId: string): Promise<string>;
    submitResult(taskId: string, resultCid: string, traceCid?: string, runtimeEnv?: RuntimeEnv): Promise<string>;
    claimReward(taskId: string): Promise<string>;
}
