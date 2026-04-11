import type { TransactionManager } from '../solana/transaction-manager.js';
import type { RuntimeEnv } from '../shared/transaction-manager.js';
import type { ArenaTaskClient } from './gateway.js';

export function createSolanaArenaTaskClient(transactionManager: TransactionManager): ArenaTaskClient {
    return {
        async post(params): Promise<string> {
            return transactionManager.postTask({
                evalRef: params.evalRef,
                deadline: Number(params.deadline),
                judgeDeadline: Number(params.judgeDeadline),
                judgeMode: params.judgeMode,
                judge: params.judge,
                category: params.category,
                minStake: Number(params.minStake),
                reward: Number(params.reward),
            });
        },

        async apply(taskId): Promise<string> {
            return transactionManager.applyForTask(taskId.toString());
        },

        async submit(taskId, params): Promise<string> {
            const mappedRuntimeEnv: RuntimeEnv = {
                provider: String((params.runtimeEnv as any)?.provider ?? 'agent-daemon'),
                model: String((params.runtimeEnv as any)?.model ?? 'default'),
                runtime: String((params.runtimeEnv as any)?.runtime ?? 'node'),
                version: String((params.runtimeEnv as any)?.version ?? '1.0.0'),
            };
            return transactionManager.submitResult(
                taskId.toString(),
                params.resultRef,
                params.traceRef,
                mappedRuntimeEnv,
            );
        },

        async getNextTaskId(): Promise<bigint> {
            const id = await transactionManager.getNextTaskId();
            return id ?? 0n;
        },
    };
}
