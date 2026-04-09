/**
 * Workflow Execution Engine
 *
 * Executes protected workflows with:
 * 1. Tiered pricing enforcement
 * 2. Encrypted step execution
 * 3. Revenue distribution
 */

import type { Database } from 'better-sqlite3';
import { WorkflowProtectionService } from './protection.js';
import type { ProtectedWorkflow, WorkflowStep } from './protection.js';

export interface ExecutionContext {
    workflowId: string;
    userId: string;
    paymentAuth: string; // X402 authorization
    selectedSteps?: string[]; // Optional: partial execution
    executionKey: string; // Ephemeral key for decryption
}

export interface ExecutionResult {
    success: boolean;
    stepResults: Map<string, any>;
    totalCost: bigint;
    revenueDistribution: {
        recipient: string;
        amount: bigint;
        reason: string;
    }[];
    error?: string;
    executionTime: number;
}

export interface StepExecutionResult {
    success: boolean;
    output: any;
    cost: bigint;
    actualLogic?: string; // Only in debug mode
}

export class WorkflowExecutionEngine {
    private db: Database;
    private protectionService: WorkflowProtectionService;
    private a2aRouter: any; // For calling atomic skills
    private x402Manager: any; // For payments

    constructor(db: Database, protectionService: WorkflowProtectionService, a2aRouter: any, x402Manager: any) {
        this.db = db;
        this.protectionService = protectionService;
        this.a2aRouter = a2aRouter;
        this.x402Manager = x402Manager;
        this.initTables();
    }

    private initTables(): void {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_executions (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        total_cost TEXT NOT NULL,
        status TEXT,              -- 'success', 'failed', 'partial'
        step_count INTEGER,
        error_step TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    }

    /**
     * Execute workflow with tiered pricing
     *
     * Flow:
     * 1. Calculate cost (free steps + premium steps)
     * 2. Verify payment authorization covers cost
     * 3. Execute steps in sequence
     * 4. For encrypted steps: decrypt → execute → discard
     * 5. Distribute revenue to step authors
     */
    async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
        const startTime = Date.now();
        const executionId = crypto.randomUUID();

        try {
            // 1. Load workflow
            const workflow = this.loadWorkflow(ctx.workflowId);
            if (!workflow) {
                throw new Error(`Workflow not found: ${ctx.workflowId}`);
            }

            // 2. Calculate execution cost
            const cost = this.protectionService.calculateExecutionCost(workflow, ctx.selectedSteps);

            // 3. Verify payment covers cost
            const paymentChannel = this.x402Manager.getChannel(ctx.paymentAuth);
            if (!paymentChannel || paymentChannel.maxAmount < cost.total) {
                throw new Error('Insufficient payment authorization');
            }

            // 4. Execute steps
            const stepResults = new Map<string, any>();
            const revenueDistribution: ExecutionResult['revenueDistribution'] = [];
            let executedSteps = 0;

            const stepsToExecute = ctx.selectedSteps
                ? workflow.steps.filter((s) => ctx.selectedSteps!.includes(s.id))
                : workflow.steps;

            for (const step of stepsToExecute) {
                try {
                    const result = await this.executeStep(step, ctx.executionKey);

                    if (result.success) {
                        stepResults.set(step.id, result.output);
                        executedSteps++;

                        // Record revenue for this step
                        if (result.cost > 0) {
                            revenueDistribution.push({
                                recipient: workflow.author, // Should be step author
                                amount: result.cost,
                                reason: `Step: ${step.name}`,
                            });
                        }
                    } else {
                        // Step failed - rollback and stop
                        await this.x402Manager.rollback(ctx.paymentAuth);

                        this.recordExecution(executionId, ctx, cost.total, 'partial', step.id);

                        return {
                            success: false,
                            stepResults,
                            totalCost: cost.total,
                            revenueDistribution,
                            error: `Step failed: ${step.name} - ${result.output?.error || 'Unknown error'}`,
                            executionTime: Date.now() - startTime,
                        };
                    }
                } catch (err) {
                    // Critical error - rollback
                    await this.x402Manager.rollback(ctx.paymentAuth);
                    throw err;
                }
            }

            // 5. All steps successful - settle payment
            const actualCost = revenueDistribution.reduce((sum, r) => sum + r.amount, 0n);

            await this.x402Manager.settle(ctx.paymentAuth, actualCost);

            // 6. Distribute revenue (in real implementation, this would be atomic)
            await this.distributeRevenue(revenueDistribution);

            this.recordExecution(executionId, ctx, actualCost, 'success');

            return {
                success: true,
                stepResults,
                totalCost: actualCost,
                revenueDistribution,
                executionTime: Date.now() - startTime,
            };
        } catch (err) {
            this.recordExecution(executionId, ctx, 0n, 'failed');

            return {
                success: false,
                stepResults: new Map(),
                totalCost: 0n,
                revenueDistribution: [],
                error: err instanceof Error ? err.message : 'Execution failed',
                executionTime: Date.now() - startTime,
            };
        }
    }

    /**
     * Execute single step
     * Handles both public and encrypted steps
     */
    private async executeStep(step: WorkflowStep, executionKey: string): Promise<StepExecutionResult> {
        const startTime = Date.now();

        try {
            let logic: string;
            let params: Record<string, any>;

            // Handle visibility levels
            if (step.visibility === 'encrypted' || step.visibility === 'protected') {
                // Decrypt step logic
                const decrypted = await this.protectionService.decryptStep(step, executionKey);
                logic = decrypted.logic;
                params = decrypted.params;
            } else {
                // Public step - use as-is
                logic = step.publicInterface.description; // Fallback for public
                params = {};
            }

            // Execute via A2A router
            const result = await this.a2aRouter.callSkill({
                skillRef: step.skillRef,
                logic: logic, // Only available for this execution
                params: params,
            });

            // Clear sensitive data immediately
            logic = ''; // Memory clear
            params = {};

            return {
                success: result.success,
                output: result.data,
                cost: step.price || 0n,
                actualLogic: process.env.DEBUG_MODE ? logic : undefined, // Only in debug
            };
        } catch (err) {
            return {
                success: false,
                output: { error: err instanceof Error ? err.message : 'Step execution failed' },
                cost: 0n,
            };
        }
    }

    private loadWorkflow(id: string): ProtectedWorkflow | null {
        // Load from database or on-chain
        const stmt = this.db.prepare('SELECT * FROM workflows WHERE id = ?');
        const row = stmt.get(id) as any;

        if (!row) return null;

        return JSON.parse(row.data) as ProtectedWorkflow;
    }

    private async distributeRevenue(distribution: ExecutionResult['revenueDistribution']): Promise<void> {
        // In real implementation:
        // 1. Create batch transfer transaction
        // 2. Sign and submit
        // 3. Or use escrow for delayed settlement

        for (const item of distribution) {
            console.log(`[Revenue] ${item.recipient} receives ${item.amount} for ${item.reason}`);
        }
    }

    private recordExecution(id: string, ctx: ExecutionContext, cost: bigint, status: string, errorStep?: string): void {
        const stmt = this.db.prepare(`
      INSERT INTO workflow_executions 
      (id, workflow_id, user_id, total_cost, status, step_count, error_step)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            id,
            ctx.workflowId,
            ctx.userId,
            cost.toString(),
            status,
            0, // step_count not tracked here
            errorStep || null,
        );
    }

    /**
     * Preview execution without actually running
     * Shows cost breakdown and step details
     */
    previewExecution(
        workflowId: string,
        selectedSteps?: string[],
    ): {
        workflow: ProtectedWorkflow;
        cost: {
            baseCost: bigint;
            premiumSteps: { id: string; name: string; price: bigint }[];
            total: bigint;
        };
        steps: {
            id: string;
            name: string;
            tier: string;
            visibility: string;
            description: string;
        }[];
    } | null {
        const workflow = this.loadWorkflow(workflowId);
        if (!workflow) return null;

        const cost = this.protectionService.calculateExecutionCost(workflow, selectedSteps);

        const stepsToShow = selectedSteps ? workflow.steps.filter((s) => selectedSteps.includes(s.id)) : workflow.steps;

        return {
            workflow,
            cost: {
                baseCost: cost.baseCost,
                premiumSteps: cost.premiumSteps.map((p) => ({
                    id: p.id,
                    name: workflow.steps.find((s) => s.id === p.id)?.name || p.id,
                    price: p.price,
                })),
                total: cost.total,
            },
            steps: stepsToShow.map((s) => ({
                id: s.id,
                name: s.name,
                tier: s.tier,
                visibility: s.visibility,
                description: s.publicInterface.description,
            })),
        };
    }
}

export default WorkflowExecutionEngine;
