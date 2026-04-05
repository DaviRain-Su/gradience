/**
 * OWS Wallet Manager for Agent Daemon
 *
 * Manages per-Agent OWS sub-wallets with reputation-driven policies.
 *
 * Core formula:
 *   dailyLimit = reputationScore * 10
 *   maxTransaction = reputationScore * 2
 *   requireApproval = reputationScore < 80
 *
 * @module wallet/ows-wallet-manager
 */

import type Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';
import type { ChainHubReputationClient } from '../integrations/chain-hub-reputation.js';

// ============================================================================
// Types
// ============================================================================

export interface OWSWallet {
  /** Unique wallet ID */
  id: string;
  /** Agent ID this wallet belongs to */
  agentId: string;
  /** Parent/master wallet address */
  parentWallet: string;
  /** Sub-wallet address (OWS) */
  address: string;
  /** Wallet name (e.g., "agent-123.sub") */
  name: string;
  /** Current reputation score (0-100) */
  reputationScore: number;
  /** Current policy */
  policy: WalletPolicy;
  /** Created timestamp */
  createdAt: number;
  /** Last updated */
  updatedAt: number;
}

export interface WalletPolicy {
  /** Daily spending limit in USD cents */
  dailyLimit: number;
  /** Maximum single transaction in USD cents */
  maxTransaction: number;
  /** Require manual approval */
  requireApproval: boolean;
  /** Allowed chains */
  allowedChains: string[];
  /** Allowed tokens (null = all) */
  allowedTokens: string[] | null;
}

export interface ReputationData {
  score: number;
  completed: number;
  totalApplied: number;
  winRate: number;
  totalEarned: number;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  agentId: string;
  type: 'incoming' | 'outgoing';
  amount: string;
  token: string;
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: number;
  confirmedAt?: number;
}

// ============================================================================
// Policy Calculation
// ============================================================================

/**
 * Calculate wallet policy from reputation score
 */
export function calculatePolicy(reputationScore: number): WalletPolicy {
  // Clamp score to 0-100
  const score = Math.max(0, Math.min(100, reputationScore));

  // Tier-based policy
  if (score >= 81) {
    // Platinum: High trust, minimal restrictions
    return {
      dailyLimit: score * 10,
      maxTransaction: score * 2,
      requireApproval: false,
      allowedChains: ['solana', 'ethereum', 'base', 'arbitrum'],
      allowedTokens: null, // All tokens
    };
  } else if (score >= 51) {
    // Gold: Medium trust, some restrictions
    return {
      dailyLimit: score * 10,
      maxTransaction: score * 2,
      requireApproval: false,
      allowedChains: ['solana', 'ethereum', 'base'],
      allowedTokens: ['USDC', 'USDT', 'ETH', 'SOL'],
    };
  } else if (score >= 31) {
    // Silver: Low-medium trust, more restrictions
    return {
      dailyLimit: score * 10,
      maxTransaction: score * 2,
      requireApproval: true,
      allowedChains: ['solana', 'ethereum'],
      allowedTokens: ['USDC', 'USDT', 'ETH'],
    };
  } else {
    // Bronze: Low trust, maximum restrictions
    return {
      dailyLimit: Math.max(300, score * 10),
      maxTransaction: Math.max(60, score * 2),
      requireApproval: true,
      allowedChains: ['solana'],
      allowedTokens: ['USDC', 'USDT'],
    };
  }
}

/**
 * Get tier name from reputation score
 */
export function getReputationTier(score: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
  if (score >= 81) return 'platinum';
  if (score >= 51) return 'gold';
  if (score >= 31) return 'silver';
  return 'bronze';
}

// ============================================================================
// OWS Wallet Manager
// ============================================================================

export class OWSWalletManager {
  private stmts: ReturnType<typeof OWSWalletManager.prepareStatements> | null = null;
  private reputationClient?: ChainHubReputationClient;

  constructor(
    private readonly db: Database.Database,
    options?: { reputationClient?: ChainHubReputationClient }
  ) {
    this.reputationClient = options?.reputationClient;
    this.initializeTables();
    this.stmts = OWSWalletManager.prepareStatements(db);
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  private initializeTables(): void {
    // Wallets table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ows_wallets (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL UNIQUE,
        parent_wallet TEXT NOT NULL,
        address TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        reputation_score INTEGER NOT NULL DEFAULT 50,
        policy_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Transactions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ows_wallet_transactions (
        id TEXT PRIMARY KEY,
        wallet_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('incoming', 'outgoing')),
        amount TEXT NOT NULL,
        token TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'confirmed', 'failed')),
        created_at INTEGER NOT NULL,
        confirmed_at INTEGER,
        FOREIGN KEY (wallet_id) REFERENCES ows_wallets(id)
      )
    `);

    // Daily spend tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ows_wallet_daily_spend (
        wallet_id TEXT NOT NULL,
        date TEXT NOT NULL,
        amount_usd_cents INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (wallet_id, date)
      )
    `);

    // Reputation history
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ows_wallet_reputation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_id TEXT NOT NULL,
        old_score INTEGER NOT NULL,
        new_score INTEGER NOT NULL,
        reason TEXT,
        changed_at INTEGER NOT NULL
      )
    `);

    logger.info('[OWSWalletManager] Tables initialized');
  }

  // -------------------------------------------------------------------------
  // Wallet Management
  // -------------------------------------------------------------------------

  /**
   * Create a new OWS sub-wallet for an Agent
   * GRA-225b: Auto-fetch reputation from Chain Hub
   */
  async createWallet(params: {
    agentId: string;
    parentWallet: string;
    name: string;
    agentAddress?: string; // Solana address for reputation lookup
    initialReputation?: number;
  }): Promise<OWSWallet> {
    // Check if wallet already exists
    const existing = this.stmts.getWalletByAgent.get(params.agentId) as
      | { id: string }
      | undefined;
    if (existing) {
      throw new DaemonError(
        ErrorCodes.WALLET_ALREADY_EXISTS,
        `Wallet already exists for agent ${params.agentId}`,
        409
      );
    }

    // GRA-225b: Fetch reputation from Chain Hub if agentAddress provided
    let reputationScore = params.initialReputation ?? 50;
    let reputationSource = 'default';

    if (this.reputationClient && params.agentAddress) {
      try {
        const reputation = await this.reputationClient.getReputation(params.agentAddress);
        if (reputation) {
          reputationScore = reputation.score;
          reputationSource = 'chain_hub';
          logger.info(
            { agentId: params.agentId, agentAddress: params.agentAddress, score: reputationScore },
            'Fetched reputation from Chain Hub for wallet creation'
          );
        }
      } catch (error) {
        logger.warn(
          { error, agentId: params.agentId, agentAddress: params.agentAddress },
          'Failed to fetch reputation from Chain Hub, using default'
        );
      }
    }

    const policy = calculatePolicy(reputationScore);

    // Generate wallet ID and address
    // In production, this would call OWS SDK to create actual sub-wallet
    const id = crypto.randomUUID();
    const address = this.generateSubWalletAddress(params.parentWallet, params.agentId);

    const now = Date.now();

    this.stmts.insertWallet.run(
      id,
      params.agentId,
      params.parentWallet,
      address,
      params.name,
      reputationScore,
      JSON.stringify(policy),
      now,
      now
    );

    // GRA-225b: Record reputation history entry
    this.stmts.insertReputationHistory.run(
      id,
      50, // default/old score
      reputationScore,
      `Wallet created with ${reputationSource} reputation`,
      now
    );

    logger.info(
      { walletId: id, agentId: params.agentId, reputation: reputationScore, tier: getReputationTier(reputationScore), source: reputationSource },
      'OWS wallet created with reputation-based policy'
    );

    return {
      id,
      agentId: params.agentId,
      parentWallet: params.parentWallet,
      address,
      name: params.name,
      reputationScore,
      policy,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get wallet by Agent ID
   */
  getWallet(agentId: string): OWSWallet | null {
    const row = this.stmts.getWalletByAgent.get(agentId) as
      | {
          id: string;
          agent_id: string;
          parent_wallet: string;
          address: string;
          name: string;
          reputation_score: number;
          policy_json: string;
          created_at: number;
          updated_at: number;
        }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      agentId: row.agent_id,
      parentWallet: row.parent_wallet,
      address: row.address,
      name: row.name,
      reputationScore: row.reputation_score,
      policy: JSON.parse(row.policy_json) as WalletPolicy,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get wallet by address
   */
  getWalletByAddress(address: string): OWSWallet | null {
    const row = this.stmts.getWalletByAddress.get(address) as
      | {
          id: string;
          agent_id: string;
          parent_wallet: string;
          address: string;
          name: string;
          reputation_score: number;
          policy_json: string;
          created_at: number;
          updated_at: number;
        }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      agentId: row.agent_id,
      parentWallet: row.parent_wallet,
      address: row.address,
      name: row.name,
      reputationScore: row.reputation_score,
      policy: JSON.parse(row.policy_json) as WalletPolicy,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * List all wallets for a parent wallet
   */
  listWallets(parentWallet: string): OWSWallet[] {
    const rows = this.stmts.listWalletsByParent.all(parentWallet) as Array<{
      id: string;
      agent_id: string;
      parent_wallet: string;
      address: string;
      name: string;
      reputation_score: number;
      policy_json: string;
      created_at: number;
      updated_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      parentWallet: row.parent_wallet,
      address: row.address,
      name: row.name,
      reputationScore: row.reputation_score,
      policy: JSON.parse(row.policy_json) as WalletPolicy,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  // -------------------------------------------------------------------------
  // Reputation & Policy Management
  // -------------------------------------------------------------------------

  /**
   * Update Agent reputation and recalculate policy
   */
  async updateReputation(
    agentId: string,
    newReputation: ReputationData,
    reason?: string
  ): Promise<OWSWallet | null> {
    const wallet = this.getWallet(agentId);
    if (!wallet) return null;

    const oldScore = wallet.reputationScore;
    const newScore = newReputation.score;

    // Only update if score changed
    if (oldScore === newScore) {
      return wallet;
    }

    const newPolicy = calculatePolicy(newScore);
    const now = Date.now();

    // Update wallet
    this.stmts.updateReputation.run(
      newScore,
      JSON.stringify(newPolicy),
      now,
      wallet.id
    );

    // Record history
    this.stmts.insertReputationHistory.run(
      wallet.id,
      oldScore,
      newScore,
      reason ?? 'reputation_update',
      now
    );

    logger.info(
      {
        walletId: wallet.id,
        agentId,
        oldScore,
        newScore,
        oldTier: getReputationTier(oldScore),
        newTier: getReputationTier(newScore),
      },
      'Reputation updated, policy recalculated'
    );

    return {
      ...wallet,
      reputationScore: newScore,
      policy: newPolicy,
      updatedAt: now,
    };
  }

  /**
   * Get reputation history for a wallet
   */
  getReputationHistory(walletId: string): Array<{
    oldScore: number;
    newScore: number;
    reason: string;
    changedAt: number;
  }> {
    const rows = this.stmts.getReputationHistory.all(walletId) as Array<{
      old_score: number;
      new_score: number;
      reason: string;
      changed_at: number;
    }>;

    return rows.map((row) => ({
      oldScore: row.old_score,
      newScore: row.new_score,
      reason: row.reason,
      changedAt: row.changed_at,
    }));
  }

  /**
   * Sync reputation from Chain Hub for a wallet
   * GRA-225b: Fetch latest reputation and update policy
   */
  async syncReputationFromChainHub(agentId: string): Promise<OWSWallet | null> {
    if (!this.reputationClient) {
      logger.warn('ChainHubReputationClient not configured, skipping sync');
      return null;
    }

    const wallet = this.getWallet(agentId);
    if (!wallet) return null;

    try {
      const reputation = await this.reputationClient.getReputation(wallet.address);
      if (!reputation) {
        logger.debug({ agentId, address: wallet.address }, 'No reputation found in Chain Hub');
        return wallet;
      }

      return this.updateReputation(
        agentId,
        {
          score: reputation.score,
          completed: reputation.completedTasks,
          totalApplied: reputation.completedTasks || 0,
          winRate: reputation.avgRating / 5, // Convert 0-5 rating to 0-1 winRate
          totalEarned: 0, // Not available in ReputationRecord
        },
        'sync_from_chain_hub'
      );
    } catch (error) {
      logger.error({ error, agentId, address: wallet.address }, 'Failed to sync reputation from Chain Hub');
      return null;
    }
  }

  /**
   * Batch sync reputations from Chain Hub for all wallets under a parent
   * GRA-225b: Batch reputation sync
   */
  async batchSyncReputations(parentWallet: string): Promise<{
    updated: number;
    failed: number;
    total: number;
  }> {
    if (!this.reputationClient) {
      logger.warn('ChainHubReputationClient not configured, skipping batch sync');
      return { updated: 0, failed: 0, total: 0 };
    }

    const wallets = this.listWallets(parentWallet);
    let updated = 0;
    let failed = 0;

    for (const wallet of wallets) {
      try {
        const result = await this.syncReputationFromChainHub(wallet.agentId);
        if (result) {
          updated++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        logger.error({ error, agentId: wallet.agentId }, 'Failed to sync reputation in batch');
      }
    }

    logger.info(
      { parentWallet, total: wallets.length, updated, failed },
      'Batch reputation sync completed'
    );

    return { updated, failed, total: wallets.length };
  }

  /**
   * Record a transaction
   */
  async recordTransaction(params: {
    walletId: string;
    agentId: string;
    type: 'incoming' | 'outgoing';
    amount: string;
    token: string;
    txHash: string;
  }): Promise<WalletTransaction> {
    const id = crypto.randomUUID();
    const now = Date.now();

    this.stmts.insertTransaction.run(
      id,
      params.walletId,
      params.agentId,
      params.type,
      params.amount,
      params.token,
      params.txHash,
      'pending',
      now
    );

    logger.info(
      { txId: id, walletId: params.walletId, type: params.type, amount: params.amount, token: params.token },
      'Transaction recorded'
    );

    return {
      id,
      walletId: params.walletId,
      agentId: params.agentId,
      type: params.type,
      amount: params.amount,
      token: params.token,
      txHash: params.txHash,
      status: 'pending',
      createdAt: now,
    };
  }

  /**
   * Confirm a transaction
   */
  async confirmTransaction(txId: string): Promise<void> {
    this.stmts.confirmTransaction.run(Date.now(), txId);
    logger.info({ txId }, 'Transaction confirmed');
  }

  /**
   * Mark transaction as failed
   */
  async failTransaction(txId: string): Promise<void> {
    this.stmts.failTransaction.run(txId);
    logger.info({ txId }, 'Transaction failed');
  }

  /**
   * Get transactions for a wallet
   */
  getTransactions(walletId: string, limit = 100): WalletTransaction[] {
    const rows = this.stmts.getTransactions.all(walletId, limit) as Array<{
      id: string;
      wallet_id: string;
      agent_id: string;
      type: string;
      amount: string;
      token: string;
      tx_hash: string;
      status: string;
      created_at: number;
      confirmed_at: number | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      walletId: row.wallet_id,
      agentId: row.agent_id,
      type: row.type as 'incoming' | 'outgoing',
      amount: row.amount,
      token: row.token,
      txHash: row.tx_hash,
      status: row.status as 'pending' | 'confirmed' | 'failed',
      createdAt: row.created_at,
      confirmedAt: row.confirmed_at ?? undefined,
    }));
  }

  // -------------------------------------------------------------------------
  // Spending Limits
  // -------------------------------------------------------------------------

  /**
   * Get daily spend for a wallet (USD cents)
   */
  getDailySpend(walletId: string): number {
    const today = new Date().toISOString().split('T')[0];
    const row = this.stmts.getDailySpend.get(walletId, today) as
      | { amount_usd_cents: number }
      | undefined;
    return row?.amount_usd_cents ?? 0;
  }

  /**
   * Record spend for daily tracking
   */
  recordSpend(walletId: string, amountUsdCents: number): void {
    const today = new Date().toISOString().split('T')[0];
    this.stmts.upsertDailySpend.run(walletId, today, amountUsdCents, amountUsdCents);
  }

  /**
   * Check if transaction is within policy limits
   */
  checkTransactionLimits(
    wallet: OWSWallet,
    amountUsdCents: number,
    chain: string,
    token: string
  ): { allowed: boolean; reason?: string } {
    // Check chain
    if (!wallet.policy.allowedChains.includes(chain)) {
      return { allowed: false, reason: `Chain ${chain} not allowed` };
    }

    // Check token
    if (wallet.policy.allowedTokens !== null && !wallet.policy.allowedTokens.includes(token)) {
      return { allowed: false, reason: `Token ${token} not allowed` };
    }

    // Check max transaction
    if (amountUsdCents > wallet.policy.maxTransaction) {
      return {
        allowed: false,
        reason: `Amount ${amountUsdCents} exceeds max transaction ${wallet.policy.maxTransaction}`,
      };
    }

    // Check daily limit
    const dailySpend = this.getDailySpend(wallet.id);
    if (dailySpend + amountUsdCents > wallet.policy.dailyLimit) {
      return {
        allowed: false,
        reason: `Daily limit exceeded: ${dailySpend + amountUsdCents} > ${wallet.policy.dailyLimit}`,
      };
    }

    return { allowed: true };
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  private generateSubWalletAddress(parentWallet: string, agentId: string): string {
    // In production, this would call OWS SDK to derive sub-wallet address
    // For now, generate deterministic address from parent + agentId
    const data = `${parentWallet}:${agentId}`;
    // Simple hash for demo (in production use proper derivation)
    return `ows_${Buffer.from(data).toString('base64url').slice(0, 32)}`;
  }

  private static prepareStatements(db: Database.Database) {
    return {
      // Wallet CRUD
      insertWallet: db.prepare(`
        INSERT INTO ows_wallets
          (id, agent_id, parent_wallet, address, name, reputation_score, policy_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      getWalletByAgent: db.prepare(`SELECT * FROM ows_wallets WHERE agent_id = ?`),
      getWalletByAddress: db.prepare(`SELECT * FROM ows_wallets WHERE address = ?`),
      listWalletsByParent: db.prepare(`SELECT * FROM ows_wallets WHERE parent_wallet = ? ORDER BY created_at DESC`),
      updateReputation: db.prepare(`
        UPDATE ows_wallets
        SET reputation_score = ?, policy_json = ?, updated_at = ?
        WHERE id = ?
      `),

      // Reputation history
      insertReputationHistory: db.prepare(`
        INSERT INTO ows_wallet_reputation_history
          (wallet_id, old_score, new_score, reason, changed_at)
        VALUES (?, ?, ?, ?, ?)
      `),
      getReputationHistory: db.prepare(`
        SELECT * FROM ows_wallet_reputation_history
        WHERE wallet_id = ? ORDER BY changed_at DESC
      `),

      // Transactions
      insertTransaction: db.prepare(`
        INSERT INTO ows_wallet_transactions
          (id, wallet_id, agent_id, type, amount, token, tx_hash, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      confirmTransaction: db.prepare(`
        UPDATE ows_wallet_transactions
        SET status = 'confirmed', confirmed_at = ?
        WHERE id = ?
      `),
      failTransaction: db.prepare(`
        UPDATE ows_wallet_transactions SET status = 'failed' WHERE id = ?
      `),
      getTransactions: db.prepare(`
        SELECT * FROM ows_wallet_transactions
        WHERE wallet_id = ? ORDER BY created_at DESC LIMIT ?
      `),

      // Daily spend
      getDailySpend: db.prepare(`
        SELECT amount_usd_cents FROM ows_wallet_daily_spend
        WHERE wallet_id = ? AND date = ?
      `),
      upsertDailySpend: db.prepare(`
        INSERT INTO ows_wallet_daily_spend (wallet_id, date, amount_usd_cents)
        VALUES (?, ?, ?)
        ON CONFLICT(wallet_id, date) DO UPDATE SET
          amount_usd_cents = amount_usd_cents + excluded.amount_usd_cents
      `),
    };
  }
}
