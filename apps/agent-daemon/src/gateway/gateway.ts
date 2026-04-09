/**
 * Workflow Execution Gateway
 *
 * Core orchestrator: purchase event → arena task → execution → settlement
 */

import type { PurchaseEvent, GatewayPurchaseRecord, GatewayConfig } from './types.js';
import { GatewayStore } from './store.js';
import { transition } from './state-machine.js';
import { DefaultArenaTaskFactory, buildEvalRef } from './arena-factory.js';
import {
    GatewayError,
    GW_PURCHASE_EXISTS,
    GW_PURCHASE_NOT_FOUND,
    GW_POST_TASK_FAILED,
    GW_EXECUTION_FAILED,
    GW_SETTLEMENT_FAILED,
    GW_TASK_ID_UNAVAILABLE,
} from './errors.js';
import type { PollingMarketplaceEventListener } from './event-listener.js';

// Minimal abstraction over Arena SDK task operations
export interface ArenaTaskClient {
    post(params: {
        taskId: bigint;
        evalRef: string;
        deadline: bigint;
        judgeDeadline: bigint;
        judgeMode: number;
        judge: string;
        category: number;
        minStake: bigint;
        reward: bigint;
    }): Promise<string>;
    apply(taskId: bigint): Promise<string>;
    submit(
        taskId: bigint,
        params: { resultRef: string; traceRef: string; runtimeEnv: Record<string, unknown> },
    ): Promise<string>;
    getNextTaskId(): Promise<bigint>;
}

// Minimal abstraction over VEL execution
export interface ExecutionClient {
    runAndSettle(request: {
        workflowId: string;
        workflowDefinition: { version: '1.0'; name: string; steps: any[] };
        inputs: Record<string, unknown>;
        taskId: number;
        executorAddress: string;
        timeoutMs: number;
    }): Promise<string>;
}

export class DefaultWorkflowExecutionGateway {
    private store: GatewayStore;
    private factory: DefaultArenaTaskFactory;
    private arenaClient: ArenaTaskClient;
    private executionClient: ExecutionClient;
    private config: GatewayConfig;
    private running = false;

    constructor(
        store: GatewayStore,
        factory: DefaultArenaTaskFactory,
        arenaClient: ArenaTaskClient,
        executionClient: ExecutionClient,
        config: GatewayConfig,
    ) {
        this.store = store;
        this.factory = factory;
        this.arenaClient = arenaClient;
        this.executionClient = executionClient;
        this.config = config;
        this.running = true;
    }

    async processPurchase(event: PurchaseEvent): Promise<void> {
        const now = new Date().toISOString();
        const record: GatewayPurchaseRecord = {
            purchaseId: event.purchaseId,
            buyer: event.buyer,
            workflowId: event.workflowId,
            amount: event.amount.toString(),
            txSignature: event.txSignature,
            blockTime: event.blockTime,
            preferredAgent: event.preferredAgent,
            status: 'PENDING',
            attempts: 0,
            createdAt: now,
            updatedAt: now,
        };

        try {
            this.store.insert(record);
        } catch (err) {
            if (err instanceof GatewayError && err.code === GW_PURCHASE_EXISTS) {
                return; // idempotent
            }
            throw err;
        }

        // Drive the state machine forward
        await this.drive(record);
    }

    async retry(purchaseId: string): Promise<boolean> {
        const record = this.store.getByPurchaseId(purchaseId);
        if (!record) {
            throw new GatewayError(GW_PURCHASE_NOT_FOUND, `Purchase ${purchaseId} not found`);
        }

        const nextStatus = transition(record, 'retry', this.config.maxRetries);
        this.store.update(purchaseId, {
            status: nextStatus,
            attempts: record.attempts + 1,
            updatedAt: new Date().toISOString(),
        });

        const updated = this.store.getByPurchaseId(purchaseId)!;
        await this.drive(updated);
        return true;
    }

    async getStatus(purchaseId: string): Promise<GatewayPurchaseRecord | null> {
        return this.store.getByPurchaseId(purchaseId);
    }

    stop(): void {
        this.running = false;
    }

    private async drive(record: GatewayPurchaseRecord): Promise<void> {
        if (!this.running) return;

        let current = record;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (current.status === 'PENDING' || current.status === 'TASK_CREATING') {
                if (current.status === 'PENDING') {
                    const taskCreating = transition(current, 'processPurchase', this.config.maxRetries);
                    this.store.update(current.purchaseId, {
                        status: taskCreating,
                        updatedAt: new Date().toISOString(),
                    });
                    current = this.store.getByPurchaseId(current.purchaseId)!;
                }

                try {
                    const nextTaskId = await this.arenaClient.getNextTaskId();
                    const postParams = this.factory.buildPostTaskParams(current, nextTaskId);
                    await this.arenaClient.post(postParams);

                    const taskCreated = transition(current, 'postTaskSuccess', this.config.maxRetries);
                    this.store.update(current.purchaseId, {
                        status: taskCreated,
                        taskId: nextTaskId.toString(),
                        updatedAt: new Date().toISOString(),
                    });
                    current = this.store.getByPurchaseId(current.purchaseId)!;
                    continue; // loop to handle next state
                } catch (err) {
                    console.error('post_task failed:', err);
                    const failed = transition(current, 'postTaskFail', this.config.maxRetries);
                    this.store.update(current.purchaseId, { status: failed, updatedAt: new Date().toISOString() });
                    break;
                }
            }

            if (current.status === 'TASK_CREATED') {
                if (!current.taskId) {
                    this.store.update(current.purchaseId, { status: 'FAILED', updatedAt: new Date().toISOString() });
                    break;
                }
                try {
                    await this.arenaClient.apply(BigInt(current.taskId));
                    const applied = transition(current, 'autoApplySuccess', this.config.maxRetries);
                    this.store.update(current.purchaseId, {
                        status: applied,
                        agentId: this.config.agentWallet.publicKey,
                        updatedAt: new Date().toISOString(),
                    });
                    current = this.store.getByPurchaseId(current.purchaseId)!;
                    continue;
                } catch (err) {
                    console.error('apply failed:', err);
                    const failed = transition(current, 'autoApplyFail', this.config.maxRetries);
                    this.store.update(current.purchaseId, { status: failed, updatedAt: new Date().toISOString() });
                    break;
                }
            }

            if (current.status === 'APPLIED') {
                try {
                    if (!current.taskId) throw new Error('taskId missing');
                    await this.arenaClient.submit(BigInt(current.taskId), {
                        resultRef: `ipfs://result-${current.purchaseId}`,
                        traceRef: `ipfs://trace-${current.purchaseId}`,
                        runtimeEnv: { provider: 'gateway-e2e', model: 'gpt-4', runtime: 'node', version: '1.0' },
                    });

                    const submitted = transition(current, 'submitSuccess', this.config.maxRetries);
                    this.store.update(current.purchaseId, { status: submitted, updatedAt: new Date().toISOString() });
                    current = this.store.getByPurchaseId(current.purchaseId)!;
                    continue;
                } catch (err) {
                    console.error('submit failed:', err);
                    const failed = transition(current, 'submitFail', this.config.maxRetries);
                    this.store.update(current.purchaseId, { status: failed, updatedAt: new Date().toISOString() });
                    break;
                }
            }

            if (current.status === 'SUBMITTED') {
                const executing = transition(current, 'startExecution', this.config.maxRetries);
                this.store.update(current.purchaseId, { status: executing, updatedAt: new Date().toISOString() });
                current = this.store.getByPurchaseId(current.purchaseId)!;

                try {
                    const txSig = await this.executionClient.runAndSettle({
                        workflowId: current.workflowId,
                        workflowDefinition: {
                            version: '1.0',
                            name: `workflow-${current.workflowId}`,
                            steps: [{ type: 'swap', params: { inputMint: 'A', outputMint: 'B', amount: 100n } }],
                        },
                        inputs: {},
                        taskId: Number(current.taskId ?? 0),
                        executorAddress: current.agentId ?? this.config.agentWallet.publicKey,
                        timeoutMs: 15_000,
                    });

                    const settling = transition(current, 'executionSuccess', this.config.maxRetries);
                    this.store.update(current.purchaseId, { status: settling, updatedAt: new Date().toISOString() });
                    current = this.store.getByPurchaseId(current.purchaseId)!;

                    const settled = transition(current, 'settlementSuccess', this.config.maxRetries);
                    this.store.update(current.purchaseId, {
                        status: settled,
                        settlementTx: txSig,
                        score: 100,
                        updatedAt: new Date().toISOString(),
                    });
                    current = this.store.getByPurchaseId(current.purchaseId)!;
                    continue;
                } catch (err) {
                    console.error('execution/settlement failed:', err);
                    const failed = transition(current, 'executionFail', this.config.maxRetries);
                    this.store.update(current.purchaseId, { status: failed, updatedAt: new Date().toISOString() });
                    break;
                }
            }

            if (current.status === 'SETTLED' || current.status === 'FAILED') {
                break;
            }

            // For any other unexpected state, break to avoid tight loop
            break;
        }
    }
}
