/**
 * Workflow Execution Gateway
 *
 * Core orchestrator: purchase event → arena task → execution → settlement
 */

import type { PurchaseEvent, GatewayPurchaseRecord, GatewayConfig } from './types.js';
import { GatewayStore } from './store.js';
import { transition } from './state-machine.js';
import { DefaultArenaTaskFactory } from './arena-factory.js';
import {
    GatewayError,
    GW_PURCHASE_EXISTS,
    GW_PURCHASE_NOT_FOUND,
} from './errors.js';
import type { PollingMarketplaceEventListener } from './event-listener.js';
import type { PurchaseStatus } from './types.js';
import type { StateHandler, StateTransitionResult } from './handlers/types.js';
import { PendingHandler } from './handlers/pending-handler.js';
import { TaskCreatingHandler } from './handlers/task-creating-handler.js';
import { TaskCreatedHandler } from './handlers/task-created-handler.js';
import { ApplyingHandler } from './handlers/applying-handler.js';
import { ExecutingHandler } from './handlers/executing-handler.js';
import { SettlingHandler } from './handlers/settling-handler.js';

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
    private handlers: Record<PurchaseStatus, StateHandler | null>;

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

        this.handlers = {
            PENDING: new PendingHandler(),
            TASK_CREATING: new TaskCreatingHandler(arenaClient, factory),
            TASK_CREATED: new TaskCreatedHandler(arenaClient, config),
            APPLIED: new ApplyingHandler(arenaClient),
            SUBMITTING: null, // not driven by gateway loop in current flow
            SUBMITTED: new ExecutingHandler(executionClient),
            EXECUTING: null, // terminal transition handled inside ExecutingHandler
            SETTLING: new SettlingHandler(),
            SETTLED: null,
            FAILED: null,
        };
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
            const handler = this.handlers[current.status];
            if (!handler) {
                // Terminal or unmanaged state
                break;
            }

            const result = await handler.handle(current);
            const now = new Date().toISOString();
            this.store.update(current.purchaseId, {
                ...result.patch,
                status: result.nextState,
                updatedAt: now,
            });

            if (result.delayMs) {
                await new Promise((r) => setTimeout(r, result.delayMs));
            }

            if (result.nextState === 'SETTLED' || result.nextState === 'FAILED') {
                break;
            }

            current = this.store.getByPurchaseId(current.purchaseId)!;
        }
    }
}
