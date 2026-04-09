import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import type { MagicBlockExecutionEngine } from './magicblock-engine.js';

export interface JudgeTaskInput {
    taskPda: PublicKey;
    escrowPda: PublicKey;
    winnerPda: PublicKey;
    signature: string;
}

export interface BatchJudgeResult {
    txSignatures: string[];
    delegatedAccounts: PublicKey[];
    count: number;
}

export interface ERMetrics {
    sessionsCreated: number;
    operationsExecuted: number;
    commitsToL1: number;
    avgExecutionTimeMs: number;
    avgCommitTimeMs: number;
}

/**
 * MagicBlock Batch Settler
 *
 * Orchestrates high-throughput judgeAndPay batches using MagicBlock ER.
 * This is an architectural stub: the real implementation needs a concrete
 * `buildJudgeAndPayIx` for the Gradience Arena program and a live ER RPC
 * transport.
 */
export class MagicBlockBatchSettler {
    private metrics: ERMetrics = {
        sessionsCreated: 0,
        operationsExecuted: 0,
        commitsToL1: 0,
        avgExecutionTimeMs: 0,
        avgCommitTimeMs: 0,
    };

    constructor(private engine: MagicBlockExecutionEngine) {}

    /**
     * Batch judge in ER.
     *
     * 1. Delegates all relevant accounts.
    
     * 2. Appends each judgeAndPay instruction.
     * 3. Builds a final commit-and-undelegate ix (stub).
     *
     * In reality the transaction(s) must be sent to the ER RPC endpoint
     * between steps 1 and 3.
     */
    async batchJudgeInER(
        payer: PublicKey,
        tasks: JudgeTaskInput[],
        buildJudgeAndPayIx: (t: JudgeTaskInput) => Promise<TransactionInstruction>,
    ): Promise<BatchJudgeResult> {
        if (tasks.length === 0) {
            return { txSignatures: [], delegatedAccounts: [], count: 0 };
        }

        const delegatedAccounts = tasks.flatMap((t) => [t.taskPda, t.escrowPda, t.winnerPda]);
        const uniqueDelegatedAccounts = [...new Set(delegatedAccounts.map((a) => a.toBase58()))].map(
            (a) => new PublicKey(a),
        );

        const judgeIxs = await Promise.all(tasks.map((t) => buildJudgeAndPayIx(t)));

        // Step 1: delegate all accounts + append operations in a single tx envelope.
        // In production this would be split into setup tx (delegation on L1),
        // followed by sending user instructions to the ER RPC endpoint.
        const _delegatedTx = this.engine.prepareDelegatedTransaction({
            payer,
            delegatedAccounts: uniqueDelegatedAccounts,
            userInstructions: judgeIxs,
        });

        // TODO: integrate ER RPC transport wrapper to send `_delegatedTx`
        // to the MagicBlock ER endpoint and receive execution signatures.

        this.metrics.sessionsCreated += 1;
        this.metrics.operationsExecuted += tasks.length;

        // Step 2: build commit-and-undelegate instructions for each unique account
        const ownerProgram = (this.engine as any).config?.ownerProgramId ?? '';
        const _commitIxs = uniqueDelegatedAccounts.map((acc) =>
            this.engine.buildCommitAndUndelegateIx({
                payer,
                delegatedAccount: acc,
                ownerProgram: new PublicKey(ownerProgram),
            }),
        );

        return {
            txSignatures: [], // populated after live ER RPC integration
            delegatedAccounts,
            count: tasks.length,
        };
    }

    getMetrics(): ERMetrics {
        return { ...this.metrics };
    }
}
