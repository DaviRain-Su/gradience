/**
 * Arena Task Factory
 *
 * Constructs Agent Arena post_task parameters from a Gateway purchase record.
 */

import type { GatewayPurchaseRecord, PostTaskParams } from './types.js';
import { POST_TASK_DEADLINE_OFFSET_SEC, POST_TASK_JUDGE_DEADLINE_OFFSET_SEC, MIN_STAKE_LAMPORTS } from './types.js';

export class DefaultArenaTaskFactory {
    private defaultJudge: string;

    constructor(defaultJudge: string) {
        this.defaultJudge = defaultJudge;
    }

    buildPostTaskParams(record: GatewayPurchaseRecord, nextTaskId: bigint): PostTaskParams {
        const now = BigInt(Math.floor(Date.now() / 1000));
        return {
            taskId: nextTaskId,
            evalRef: buildEvalRef(record.workflowId, record.purchaseId),
            deadline: now + BigInt(POST_TASK_DEADLINE_OFFSET_SEC),
            judgeDeadline: now + BigInt(POST_TASK_JUDGE_DEADLINE_OFFSET_SEC),
            judgeMode: 0, // single judge
            judge: this.defaultJudge,
            category: 0, // General
            minStake: MIN_STAKE_LAMPORTS,
            reward: BigInt(record.amount),
        };
    }
}

export function buildEvalRef(workflowId: string, purchaseId: string): string {
    const wf = workflowId.slice(0, 16);
    const pid = purchaseId.slice(0, 24);
    return `wf:${wf}:${pid}`;
}
