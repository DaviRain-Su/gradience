/**
 * Identity Binding Module — GRA-262
 *
 * Manages Gradience Account ↔ Wallet binding with anti-Sybil rules.
 *
 * @module identity/account-binding
 */

import type Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface AccountBindingRecord {
    accountId: string;
    primaryWallet: string;
    linkedWallets: string;
    oauthHash?: string;
    zkNullifier?: string;
    createdAt: number;
    lastWalletChangeAt: number;
}

export interface BindRequest {
    accountId: string;
    primaryWallet: string;
    oauthHash?: string;
    signature: string; // wallet signs nonce — validated externally
}

export interface TierPermission {
    maxTaskValue: bigint;
    canBeJudge: boolean;
    canPostHighValueTask: boolean;
}

export interface VerificationTier {
    tier: 'guest' | 'verified' | 'trusted' | 'pro';
    requirements: {
        walletAgeDays: number;
        oauth: boolean;
        zkKyc: boolean;
        minCompletedTasks: number;
        minReputationScore: number;
    };
    permissions: TierPermission;
}

// ============================================================================
// Default Tiers
// ============================================================================

export const DEFAULT_TIERS: VerificationTier[] = [
    {
        tier: 'guest',
        requirements: { walletAgeDays: 0, oauth: false, zkKyc: false, minCompletedTasks: 0, minReputationScore: 0 },
        permissions: { maxTaskValue: BigInt(0.1e18), canBeJudge: false, canPostHighValueTask: false },
    },
    {
        tier: 'verified',
        requirements: { walletAgeDays: 7, oauth: true, zkKyc: false, minCompletedTasks: 0, minReputationScore: 0 },
        permissions: { maxTaskValue: BigInt(1e18), canBeJudge: false, canPostHighValueTask: true },
    },
    {
        tier: 'trusted',
        requirements: { walletAgeDays: 14, oauth: true, zkKyc: false, minCompletedTasks: 3, minReputationScore: 60 },
        permissions: { maxTaskValue: BigInt(10e18), canBeJudge: true, canPostHighValueTask: true },
    },
    {
        tier: 'pro',
        requirements: { walletAgeDays: 30, oauth: true, zkKyc: true, minCompletedTasks: 10, minReputationScore: 75 },
        permissions: { maxTaskValue: BigInt(100e18), canBeJudge: true, canPostHighValueTask: true },
    },
];

export const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ============================================================================
// Schema
// ============================================================================

export const IDENTITY_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS account_bindings (
    account_id        TEXT PRIMARY KEY,
    primary_wallet    TEXT NOT NULL UNIQUE,
    linked_wallets    TEXT NOT NULL DEFAULT '[]',
    oauth_hash        TEXT UNIQUE,
    zk_nullifier      TEXT UNIQUE,
    created_at        INTEGER NOT NULL,
    last_wallet_change_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bindings_wallet ON account_bindings(primary_wallet);
CREATE INDEX IF NOT EXISTS idx_bindings_oauth  ON account_bindings(oauth_hash);
CREATE INDEX IF NOT EXISTS idx_bindings_zk     ON account_bindings(zk_nullifier);
`;

// ============================================================================
// Account Binding Store
// ============================================================================

export class AccountBindingStore {
    constructor(private db: Database.Database) {
        this.initTable();
    }

    private initTable(): void {
        try {
            this.db.exec(IDENTITY_SCHEMA_SQL);
            logger.debug('Identity bindings table initialized');
        } catch (error) {
            logger.error({ error }, 'Failed to initialize identity bindings table');
            throw error;
        }
    }

    /**
     * Bind a new account with a primary wallet.
     */
    bind(input: BindRequest): AccountBindingRecord {
        const now = Date.now();
        const record: AccountBindingRecord = {
            accountId: input.accountId,
            primaryWallet: input.primaryWallet.toLowerCase(),
            linkedWallets: JSON.stringify([]),
            oauthHash: input.oauthHash,
            createdAt: now,
            lastWalletChangeAt: now,
        };

        const stmt = this.db.prepare(`
      INSERT INTO account_bindings (
        account_id, primary_wallet, linked_wallets, oauth_hash, created_at, last_wallet_change_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            record.accountId,
            record.primaryWallet,
            record.linkedWallets,
            record.oauthHash ?? null,
            record.createdAt,
            record.lastWalletChangeAt,
        );

        logger.info({ accountId: record.accountId, wallet: record.primaryWallet }, 'Account bound');
        return record;
    }

    /**
     * Get binding by primary wallet.
     */
    getByWallet(wallet: string): AccountBindingRecord | null {
        const stmt = this.db.prepare('SELECT * FROM account_bindings WHERE primary_wallet = ?');
        const row = stmt.get(wallet.toLowerCase()) as Record<string, unknown> | undefined;
        return row ? this.mapRow(row) : null;
    }

    /**
     * Get binding by account ID.
     */
    getByAccountId(accountId: string): AccountBindingRecord | null {
        const stmt = this.db.prepare('SELECT * FROM account_bindings WHERE account_id = ?');
        const row = stmt.get(accountId) as Record<string, unknown> | undefined;
        return row ? this.mapRow(row) : null;
    }

    /**
     * Get binding by OAuth hash.
     */
    getByOAuthHash(oauthHash: string): AccountBindingRecord | null {
        const stmt = this.db.prepare('SELECT * FROM account_bindings WHERE oauth_hash = ?');
        const row = stmt.get(oauthHash) as Record<string, unknown> | undefined;
        return row ? this.mapRow(row) : null;
    }

    /**
     * Get binding by ZK nullifier.
     */
    getByZkNullifier(nullifier: string): AccountBindingRecord | null {
        const stmt = this.db.prepare('SELECT * FROM account_bindings WHERE zk_nullifier = ?');
        const row = stmt.get(nullifier) as Record<string, unknown> | undefined;
        return row ? this.mapRow(row) : null;
    }

    /**
     * Update ZK nullifier for an existing account.
     */
    setZkNullifier(accountId: string, nullifier: string): void {
        const stmt = this.db.prepare(`
      UPDATE account_bindings
      SET zk_nullifier = ?
      WHERE account_id = ?
    `);
        stmt.run(nullifier, accountId);
    }

    /**
     * Change primary wallet with cooldown enforcement.
     */
    changePrimaryWallet(accountId: string, newWallet: string): AccountBindingRecord {
        const existing = this.getByAccountId(accountId);
        if (!existing) {
            throw new Error(`Account ${accountId} not found`);
        }

        const elapsed = Date.now() - existing.lastWalletChangeAt;
        if (elapsed < COOLDOWN_MS) {
            const remainingDays = Math.ceil((COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000));
            throw new Error(`Wallet change cooldown: ${remainingDays} days remaining`);
        }

        // Ensure new wallet is not already bound
        const conflict = this.getByWallet(newWallet);
        if (conflict && conflict.accountId !== accountId) {
            throw new Error('Wallet already bound to another account');
        }

        const stmt = this.db.prepare(`
      UPDATE account_bindings
      SET primary_wallet = ?, last_wallet_change_at = ?
      WHERE account_id = ?
    `);
        stmt.run(newWallet.toLowerCase(), Date.now(), accountId);

        logger.info({ accountId, newWallet }, 'Primary wallet changed');
        return this.getByAccountId(accountId)!;
    }

    /**
     * Check if wallet or oauth hash is already bound.
     */
    isBound(wallet?: string, oauthHash?: string): boolean {
        if (wallet) {
            const byWallet = this.getByWallet(wallet);
            if (byWallet) return true;
        }
        if (oauthHash) {
            const byOAuth = this.getByOAuthHash(oauthHash);
            if (byOAuth) return true;
        }
        return false;
    }

    private mapRow(row: Record<string, unknown>): AccountBindingRecord {
        return {
            accountId: row.account_id as string,
            primaryWallet: row.primary_wallet as string,
            linkedWallets: row.linked_wallets as string,
            oauthHash: row.oauth_hash as string | undefined,
            zkNullifier: row.zk_nullifier as string | undefined,
            createdAt: row.created_at as number,
            lastWalletChangeAt: row.last_wallet_change_at as number,
        };
    }
}

// ============================================================================
// Verification Tier Resolver
// ============================================================================

export interface UserMetrics {
    walletAgeDays: number;
    oauthBound: boolean;
    zkKycBound: boolean;
    completedTasks: number;
    reputationScore: number;
}

export class VerificationTierResolver {
    constructor(private tiers: VerificationTier[] = DEFAULT_TIERS) {}

    resolve(metrics: UserMetrics): VerificationTier {
        // Iterate from highest to lowest tier and find the first one that matches
        for (let i = this.tiers.length - 1; i >= 0; i--) {
            const tier = this.tiers[i];
            const req = tier.requirements;
            if (
                metrics.walletAgeDays >= req.walletAgeDays &&
                (!req.oauth || metrics.oauthBound) &&
                (!req.zkKyc || metrics.zkKycBound) &&
                metrics.completedTasks >= req.minCompletedTasks &&
                metrics.reputationScore >= req.minReputationScore
            ) {
                return tier;
            }
        }
        return this.tiers[0]; // fallback to guest
    }

    canPostTask(metrics: UserMetrics, taskValue: bigint): boolean {
        const tier = this.resolve(metrics);
        return tier.permissions.canPostHighValueTask || taskValue <= tier.permissions.maxTaskValue;
    }

    canApplyAsJudge(metrics: UserMetrics): boolean {
        const tier = this.resolve(metrics);
        return tier.permissions.canBeJudge;
    }
}

// ============================================================================
// Factory
// ============================================================================

export function createAccountBindingStore(db: Database.Database): AccountBindingStore {
    return new AccountBindingStore(db);
}

export function createVerificationTierResolver(): VerificationTierResolver {
    return new VerificationTierResolver();
}
