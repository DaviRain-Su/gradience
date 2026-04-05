/**
 * Revenue Store
 *
 * SQLite storage for revenue distribution records.
 * Tracks all revenue distributions with their on-chain settlement status.
 *
 * @module revenue/revenue-store
 */

import type Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface RevenueDistributionRecord {
  id: string;
  taskId: string;
  paymentId: string;
  agentAddress: string;
  judgeAddress: string;
  tokenMint: string;
  totalAmount: string; // Stored as string for bigint
  agentAmount: string;
  judgeAmount: string;
  protocolAmount: string;
  agentPercentage: number; // basis points (9500 = 95%)
  judgePercentage: number; // basis points (300 = 3%)
  protocolPercentage: number; // basis points (200 = 2%)
  escrowAccount: string;
  txSignature: string | null;
  status: 'pending' | 'processing' | 'confirmed' | 'failed';
  error?: string;
  createdAt: number;
  updatedAt: number;
  confirmedAt?: number;
}

export interface RevenueDistributionInput {
  id: string;
  taskId: string;
  paymentId: string;
  agentAddress: string;
  judgeAddress: string;
  tokenMint: string;
  totalAmount: bigint;
  agentAmount: bigint;
  judgeAmount: bigint;
  protocolAmount: bigint;
  agentPercentage: number;
  judgePercentage: number;
  protocolPercentage: number;
  escrowAccount: string;
}

export interface RevenueStats {
  totalDistributions: number;
  totalAmountDistributed: bigint;
  pendingCount: number;
  confirmedCount: number;
  failedCount: number;
  agentTotal: bigint;
  judgeTotal: bigint;
  protocolTotal: bigint;
}

// ============================================================================
// Database Schema
// ============================================================================

export const REVENUE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS revenue_distributions (
    id                TEXT PRIMARY KEY,
    task_id           TEXT NOT NULL,
    payment_id        TEXT NOT NULL,
    agent_address     TEXT NOT NULL,
    judge_address     TEXT NOT NULL,
    token_mint        TEXT NOT NULL,
    total_amount      TEXT NOT NULL,
    agent_amount      TEXT NOT NULL,
    judge_amount      TEXT NOT NULL,
    protocol_amount   TEXT NOT NULL,
    agent_percentage  INTEGER NOT NULL DEFAULT 9500,
    judge_percentage  INTEGER NOT NULL DEFAULT 300,
    protocol_percentage INTEGER NOT NULL DEFAULT 200,
    escrow_account    TEXT NOT NULL,
    tx_signature      TEXT,
    status            TEXT NOT NULL DEFAULT 'pending',
    error             TEXT,
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL,
    confirmed_at      INTEGER,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_revenue_task_id ON revenue_distributions(task_id);
CREATE INDEX IF NOT EXISTS idx_revenue_status ON revenue_distributions(status);
CREATE INDEX IF NOT EXISTS idx_revenue_created_at ON revenue_distributions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_tx_signature ON revenue_distributions(tx_signature);
`;

// ============================================================================
// Revenue Store
// ============================================================================

export class RevenueStore {
  constructor(private db: Database.Database) {
    this.initTable();
  }

  private initTable(): void {
    try {
      this.db.exec(REVENUE_SCHEMA_SQL);
      logger.debug('Revenue distributions table initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize revenue distributions table');
      throw error;
    }
  }

  /**
   * Record a new revenue distribution
   */
  recordDistribution(input: RevenueDistributionInput): RevenueDistributionRecord {
    const now = Date.now();
    const record: RevenueDistributionRecord = {
      id: input.id,
      taskId: input.taskId,
      paymentId: input.paymentId,
      agentAddress: input.agentAddress,
      judgeAddress: input.judgeAddress,
      tokenMint: input.tokenMint,
      totalAmount: input.totalAmount.toString(),
      agentAmount: input.agentAmount.toString(),
      judgeAmount: input.judgeAmount.toString(),
      protocolAmount: input.protocolAmount.toString(),
      agentPercentage: input.agentPercentage,
      judgePercentage: input.judgePercentage,
      protocolPercentage: input.protocolPercentage,
      escrowAccount: input.escrowAccount,
      txSignature: null,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO revenue_distributions (
        id, task_id, payment_id, agent_address, judge_address, token_mint,
        total_amount, agent_amount, judge_amount, protocol_amount,
        agent_percentage, judge_percentage, protocol_percentage,
        escrow_account, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.taskId,
      record.paymentId,
      record.agentAddress,
      record.judgeAddress,
      record.tokenMint,
      record.totalAmount,
      record.agentAmount,
      record.judgeAmount,
      record.protocolAmount,
      record.agentPercentage,
      record.judgePercentage,
      record.protocolPercentage,
      record.escrowAccount,
      record.status,
      record.createdAt,
      record.updatedAt
    );

    logger.info(
      { distributionId: record.id, taskId: record.taskId, totalAmount: record.totalAmount },
      'Revenue distribution recorded'
    );

    return record;
  }

  /**
   * Update distribution status to processing
   */
  markProcessing(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE revenue_distributions
      SET status = 'processing', updated_at = ?
      WHERE id = ?
    `);
    stmt.run(Date.now(), id);
    logger.debug({ distributionId: id }, 'Distribution marked as processing');
  }

  /**
   * Mark distribution as confirmed with transaction signature
   */
  markConfirmed(id: string, txSignature: string): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE revenue_distributions
      SET status = 'confirmed', tx_signature = ?, confirmed_at = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(txSignature, now, now, id);
    logger.info({ distributionId: id, txSignature }, 'Distribution confirmed on-chain');
  }

  /**
   * Mark distribution as failed
   */
  markFailed(id: string, error: string): void {
    const stmt = this.db.prepare(`
      UPDATE revenue_distributions
      SET status = 'failed', error = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(error, Date.now(), id);
    logger.error({ distributionId: id, error }, 'Distribution failed');
  }

  /**
   * Get distribution by ID
   */
  getById(id: string): RevenueDistributionRecord | null {
    const stmt = this.db.prepare('SELECT * FROM revenue_distributions WHERE id = ?');
    const row = stmt.get(id) as RevenueDistributionRecord | undefined;
    return row ?? null;
  }

  /**
   * Get distribution by task ID
   */
  getByTaskId(taskId: string): RevenueDistributionRecord | null {
    const stmt = this.db.prepare('SELECT * FROM revenue_distributions WHERE task_id = ?');
    const row = stmt.get(taskId) as RevenueDistributionRecord | undefined;
    return row ?? null;
  }

  /**
   * Get distribution by transaction signature
   */
  getByTxSignature(txSignature: string): RevenueDistributionRecord | null {
    const stmt = this.db.prepare('SELECT * FROM revenue_distributions WHERE tx_signature = ?');
    const row = stmt.get(txSignature) as RevenueDistributionRecord | undefined;
    return row ?? null;
  }

  /**
   * List distributions with optional filters
   */
  list(options: {
    status?: RevenueDistributionRecord['status'];
    taskId?: string;
    limit?: number;
    offset?: number;
  } = {}): RevenueDistributionRecord[] {
    let sql = 'SELECT * FROM revenue_distributions WHERE 1=1';
    const params: (string | number)[] = [];

    if (options.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }

    if (options.taskId) {
      sql += ' AND task_id = ?';
      params.push(options.taskId);
    }

    sql += ' ORDER BY created_at DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as RevenueDistributionRecord[];
  }

  /**
   * Get pending distributions that need on-chain settlement
   */
  getPending(): RevenueDistributionRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM revenue_distributions
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `);
    return stmt.all() as RevenueDistributionRecord[];
  }

  /**
   * Get revenue statistics
   */
  getStats(): RevenueStats {
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM revenue_distributions');
    const { count: totalDistributions } = totalStmt.get() as { count: number };

    const pendingStmt = this.db.prepare("SELECT COUNT(*) as count FROM revenue_distributions WHERE status = 'pending'");
    const { count: pendingCount } = pendingStmt.get() as { count: number };

    const confirmedStmt = this.db.prepare("SELECT COUNT(*) as count FROM revenue_distributions WHERE status = 'confirmed'");
    const { count: confirmedCount } = confirmedStmt.get() as { count: number };

    const failedStmt = this.db.prepare("SELECT COUNT(*) as count FROM revenue_distributions WHERE status = 'failed'");
    const { count: failedCount } = failedStmt.get() as { count: number };

    // Sum all amounts
    const amountsStmt = this.db.prepare(`
      SELECT
        COALESCE(SUM(CAST(total_amount AS INTEGER)), 0) as total,
        COALESCE(SUM(CAST(agent_amount AS INTEGER)), 0) as agent_total,
        COALESCE(SUM(CAST(judge_amount AS INTEGER)), 0) as judge_total,
        COALESCE(SUM(CAST(protocol_amount AS INTEGER)), 0) as protocol_total
      FROM revenue_distributions
      WHERE status = 'confirmed'
    `);
    const amounts = amountsStmt.get() as {
      total: number;
      agent_total: number;
      judge_total: number;
      protocol_total: number;
    };

    return {
      totalDistributions,
      totalAmountDistributed: BigInt(amounts.total),
      pendingCount,
      confirmedCount,
      failedCount,
      agentTotal: BigInt(amounts.agent_total),
      judgeTotal: BigInt(amounts.judge_total),
      protocolTotal: BigInt(amounts.protocol_total),
    };
  }

  /**
   * Delete old records (for cleanup)
   */
  cleanup(olderThanMs: number): number {
    const cutoff = Date.now() - olderThanMs;
    const stmt = this.db.prepare('DELETE FROM revenue_distributions WHERE created_at < ? AND status = ?');
    const result = stmt.run(cutoff, 'confirmed');
    logger.info({ deleted: result.changes, cutoff }, 'Revenue distribution cleanup completed');
    return result.changes;
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createRevenueStore(db: Database.Database): RevenueStore {
  return new RevenueStore(db);
}
