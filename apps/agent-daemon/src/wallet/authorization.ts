import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { randomBytes } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { TypedStatement, RunResult, DatabaseInstance } from '../types/database.js';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';

export interface SigningPolicy {
    dailyLimitLamports: number;
    requireMasterApprovalAbove: number;
    /** Empty array means all programs are allowed. */
    allowedPrograms: string[];
    /** Unix ms timestamp, or null for no expiry. */
    expiresAt: number | null;
}

export const DEFAULT_POLICY: Readonly<SigningPolicy> = {
    dailyLimitLamports: 1_000_000,       // 0.001 SOL
    requireMasterApprovalAbove: 100_000_000, // 0.1 SOL
    allowedPrograms: [],
    expiresAt: null,
};

/** How long a challenge is valid before it expires. */
const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ---------------------------------------------------------------------------
// Internal DB row shapes
// ---------------------------------------------------------------------------

interface AuthorizationRow {
    agent_wallet: string;
    master_wallet: string;
    authorized: number;
    policy: string;
    authorized_at: number;
    expires_at: number | null;
}

interface ChallengeRow {
    challenge: string;
    created_at: number;
    expires_at: number;
}

interface SpendSumRow {
    total: number;
}

// ---------------------------------------------------------------------------
// AuthorizationManager
// ---------------------------------------------------------------------------

/**
 * Manages the trust link between a user's master wallet and this daemon's
 * agent keypair.
 *
 * Authorization flow:
 *   1. Frontend calls POST /api/v1/wallet/request-authorization
 *      → daemon creates a one-time challenge and returns { agentPubkey, challenge, message }
 *   2. Frontend presents `message` to the user's Solana wallet for signing
 *   3. Frontend calls POST /api/v1/wallet/authorize with the signature
 *      → daemon verifies signature, persists policy, sets authorized = true
 *
 * Policy enforcement:
 *   - checkTransaction() must be called before every transaction
 *   - recordSpend() must be called after every successful transaction
 */
interface AuthStatements {
    upsertAuth: TypedStatement<[string, string, string, number, number | null], RunResult>;
    getAuth: TypedStatement<[string], AuthorizationRow | undefined>;
    revokeAuth: TypedStatement<[string], RunResult>;
    insertChallenge: TypedStatement<[string, number, number], RunResult>;
    getChallenge: TypedStatement<[string, number], ChallengeRow | undefined>;
    deleteChallenge: TypedStatement<[string], RunResult>;
    pruneExpiredChallenges: TypedStatement<[number], RunResult>;
    insertSpend: TypedStatement<[string, number, string, string, number], RunResult>;
    getDailySpend: TypedStatement<[number], SpendSumRow | undefined>;
}

export class AuthorizationManager {
    masterWallet: string | null = null;
    readonly agentWallet: string;
    authorized: boolean = false;
    policy: SigningPolicy = { ...DEFAULT_POLICY };

    private readonly stmts: AuthStatements;

    constructor(
        private readonly db: DatabaseInstance,
        agentWallet: string,
    ) {
        this.agentWallet = agentWallet;
        this.stmts = AuthorizationManager.prepareStatements(db);
        this.loadFromDb();
    }

    // -------------------------------------------------------------------------
    // Authorization flow
    // -------------------------------------------------------------------------

    /**
     * Generate a one-time challenge for the frontend to sign.
     *
     * Returns the exact UTF-8 `message` that the frontend must pass to
     * `wallet.signMessage(new TextEncoder().encode(message))`.
     */
    requestAuthorization(): {
        agentPubkey: string;
        challenge: string;
        message: string;
        expiresAt: number;
    } {
        this.stmts.pruneExpiredChallenges.run(Date.now());

        const challenge = randomBytes(32).toString('base64');
        const now = Date.now();
        const expiresAt = now + CHALLENGE_TTL_MS;

        this.stmts.insertChallenge.run(challenge, now, expiresAt);

        const message = this.buildChallengeMessage(challenge);
        logger.info({ prefix: challenge.slice(0, 8) }, 'Authorization challenge generated');

        return { agentPubkey: this.agentWallet, challenge, message, expiresAt };
    }

    /**
     * Verify the master wallet's signature and store the authorization.
     *
     * @throws DaemonError on any validation failure.
     */
    authorize(params: {
        masterWallet: string;
        challenge: string;
        /** Base64-encoded ed25519 signature of the challenge message. */
        signature: string;
        policy?: Partial<SigningPolicy>;
    }): void {
        const masterPubkeyBytes = this.decodePubkey(params.masterWallet, 'masterWallet');

        const challengeRow = this.stmts.getChallenge.get(params.challenge, Date.now());
        if (!challengeRow) {
            throw new DaemonError(ErrorCodes.AUTH_INVALID, 'Challenge not found or expired', 401);
        }

        const signatureBytes = this.decodeSignature(params.signature);

        const messageBytes = Buffer.from(this.buildChallengeMessage(params.challenge), 'utf-8');
        if (!nacl.sign.detached.verify(messageBytes, signatureBytes, masterPubkeyBytes)) {
            throw new DaemonError(ErrorCodes.AUTH_INVALID, 'Signature verification failed', 401);
        }

        // Consume the challenge so it cannot be replayed.
        this.stmts.deleteChallenge.run(params.challenge);

        const policy = this.buildPolicy(params.policy);

        const now = Date.now();
        this.stmts.upsertAuth.run(
            params.masterWallet,
            this.agentWallet,
            JSON.stringify(policy),
            now,
            policy.expiresAt ?? null,
        );

        this.masterWallet = params.masterWallet;
        this.authorized = true;
        this.policy = policy;

        logger.info({ masterWallet: params.masterWallet, agentWallet: this.agentWallet }, 'Authorization granted');
    }

    /**
     * Revoke authorization immediately.
     *
     * This endpoint is already protected by the daemon's bearer token, so no
     * additional signature is required.  The master wallet can trigger revocation
     * through any frontend that holds the bearer token.
     */
    revoke(): void {
        this.stmts.revokeAuth.run(this.agentWallet);
        const prev = this.masterWallet;
        this.masterWallet = null;
        this.authorized = false;
        this.policy = { ...DEFAULT_POLICY };
        logger.info({ agentWallet: this.agentWallet, masterWallet: prev }, 'Authorization revoked');
    }

    // -------------------------------------------------------------------------
    // Policy enforcement
    // -------------------------------------------------------------------------

    /**
     * Verify that a proposed transaction complies with the current policy.
     *
     * Must be called before signing or submitting any transaction.
     * Throws DaemonError (403) on any policy violation.
     *
     * @param programId  Base58-encoded Solana program ID being invoked.
     * @param amountLamports  Lamports transferred or at risk in this tx.
     */
    checkTransaction(programId: string, amountLamports: number): void {
        if (!this.authorized) {
            throw new DaemonError(ErrorCodes.WALLET_NOT_AUTHORIZED, 'Agent wallet is not authorized', 403);
        }

        if (this.policy.expiresAt !== null && this.policy.expiresAt < Date.now()) {
            // Lazily revoke; persistent state updated on next DB write.
            this.authorized = false;
            this.stmts.revokeAuth.run(this.agentWallet);
            throw new DaemonError(ErrorCodes.WALLET_AUTHORIZATION_EXPIRED, 'Authorization has expired', 403);
        }

        // allowedPrograms: empty = all programs allowed.
        if (this.policy.allowedPrograms.length > 0 && !this.policy.allowedPrograms.includes(programId)) {
            throw new DaemonError(
                ErrorCodes.WALLET_PROGRAM_NOT_ALLOWED,
                `Program ${programId} is not in the allowed list`,
                403,
            );
        }

        if (amountLamports > this.policy.requireMasterApprovalAbove) {
            throw new DaemonError(
                ErrorCodes.WALLET_REQUIRES_MASTER_APPROVAL,
                `Transaction of ${amountLamports} lamports exceeds the auto-approval threshold of ${this.policy.requireMasterApprovalAbove}; master wallet approval required`,
                403,
            );
        }

        const dailySpend = this.getDailySpend();
        if (dailySpend + amountLamports > this.policy.dailyLimitLamports) {
            throw new DaemonError(
                ErrorCodes.WALLET_DAILY_LIMIT_EXCEEDED,
                `Daily spend limit exceeded: ${dailySpend + amountLamports} > ${this.policy.dailyLimitLamports} lamports`,
                403,
            );
        }
    }

    /**
     * Record the lamport cost of a successfully submitted transaction.
     * Must be called after every transaction that passes checkTransaction().
     */
    recordSpend(params: {
        amountLamports: number;
        program: string;
        txSignature: string;
    }): void {
        const id = randomBytes(16).toString('hex');
        this.stmts.insertSpend.run(id, params.amountLamports, params.program, params.txSignature, Date.now());
    }

    // -------------------------------------------------------------------------
    // Status helpers
    // -------------------------------------------------------------------------

    /** Total lamports spent today (UTC day boundary). */
    getDailySpend(): number {
        const row = this.stmts.getDailySpend.get(this.utcDayStartMs());
        return row?.total ?? 0;
    }

    getStatus(): {
        agentWallet: string;
        masterWallet: string | null;
        authorized: boolean;
        policy: SigningPolicy | null;
        dailySpendLamports: number;
    } {
        return {
            agentWallet: this.agentWallet,
            masterWallet: this.masterWallet,
            authorized: this.authorized,
            policy: this.authorized ? this.policy : null,
            dailySpendLamports: this.authorized ? this.getDailySpend() : 0,
        };
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private loadFromDb(): void {
        const row = this.stmts.getAuth.get(this.agentWallet);
        if (!row || !row.authorized) return;

        if (row.expires_at !== null && row.expires_at < Date.now()) {
            logger.info('Stored authorization has expired, skipping load');
            return;
        }

        this.masterWallet = row.master_wallet;
        this.authorized = true;
        this.policy = JSON.parse(row.policy) as SigningPolicy;
        logger.info({ masterWallet: this.masterWallet }, 'Authorization loaded from database');
    }

    /** Returns the message that must be signed verbatim by the Solana wallet adapter. */
    private buildChallengeMessage(challenge: string): string {
        return (
            `Authorize agent ${this.agentWallet} as your signing delegate.\n` +
            `Challenge: ${challenge}`
        );
    }

    private decodePubkey(pubkey: string, fieldName: string): Uint8Array {
        let bytes: Uint8Array;
        try {
            bytes = bs58.decode(pubkey);
        } catch {
            throw new DaemonError(ErrorCodes.INVALID_REQUEST, `Invalid ${fieldName}: not valid base58`, 400);
        }
        if (bytes.length !== 32) {
            throw new DaemonError(ErrorCodes.INVALID_REQUEST, `Invalid ${fieldName}: expected 32-byte ed25519 pubkey`, 400);
        }
        return bytes;
    }

    private decodeSignature(signature: string): Uint8Array {
        let bytes: Uint8Array;
        try {
            bytes = Buffer.from(signature, 'base64');
        } catch {
            throw new DaemonError(ErrorCodes.INVALID_REQUEST, 'Invalid signature: not valid base64', 400);
        }
        if (bytes.length !== 64) {
            throw new DaemonError(ErrorCodes.INVALID_REQUEST, 'Invalid signature: expected 64-byte ed25519 signature', 400);
        }
        return bytes;
    }

    private buildPolicy(partial?: Partial<SigningPolicy>): SigningPolicy {
        const base: SigningPolicy = { ...DEFAULT_POLICY, ...partial };

        if (!Number.isInteger(base.dailyLimitLamports) || base.dailyLimitLamports < 0) {
            throw new DaemonError(ErrorCodes.INVALID_REQUEST, 'dailyLimitLamports must be a non-negative integer', 400);
        }
        if (!Number.isInteger(base.requireMasterApprovalAbove) || base.requireMasterApprovalAbove < 0) {
            throw new DaemonError(ErrorCodes.INVALID_REQUEST, 'requireMasterApprovalAbove must be a non-negative integer', 400);
        }
        if (!Array.isArray(base.allowedPrograms)) {
            throw new DaemonError(ErrorCodes.INVALID_REQUEST, 'allowedPrograms must be an array', 400);
        }
        for (const p of base.allowedPrograms) {
            if (typeof p !== 'string' || p.length === 0) {
                throw new DaemonError(ErrorCodes.INVALID_REQUEST, 'allowedPrograms entries must be non-empty strings', 400);
            }
            // Validate each entry is a plausible base58 pubkey.
            try {
                const decoded = bs58.decode(p);
                if (decoded.length !== 32) throw new Error();
            } catch {
                throw new DaemonError(ErrorCodes.INVALID_REQUEST, `allowedPrograms entry "${p}" is not a valid base58 pubkey`, 400);
            }
        }
        if (base.expiresAt !== null) {
            if (!Number.isInteger(base.expiresAt) || base.expiresAt <= Date.now()) {
                throw new DaemonError(ErrorCodes.INVALID_REQUEST, 'expiresAt must be a future Unix millisecond timestamp', 400);
            }
        }

        return base;
    }

    private utcDayStartMs(): number {
        const d = new Date();
        d.setUTCHours(0, 0, 0, 0);
        return d.getTime();
    }

    // -------------------------------------------------------------------------
    // Prepared statements (static so we can type the return value)
    // -------------------------------------------------------------------------

    private static prepareStatements(db: DatabaseInstance): AuthStatements {
        return {
            upsertAuth: db.prepare(`
                INSERT INTO wallet_authorizations
                    (master_wallet, agent_wallet, authorized, policy, authorized_at, expires_at)
                VALUES (?, ?, 1, ?, ?, ?)
                ON CONFLICT(agent_wallet) DO UPDATE SET
                    master_wallet = excluded.master_wallet,
                    authorized = 1,
                    policy = excluded.policy,
                    authorized_at = excluded.authorized_at,
                    expires_at = excluded.expires_at
            `),
            getAuth: db.prepare(
                `SELECT * FROM wallet_authorizations WHERE agent_wallet = ? LIMIT 1`
            ),
            revokeAuth: db.prepare(
                `UPDATE wallet_authorizations SET authorized = 0 WHERE agent_wallet = ?`
            ),
            insertChallenge: db.prepare(
                `INSERT INTO wallet_challenges (challenge, created_at, expires_at) VALUES (?, ?, ?)`
            ),
            getChallenge: db.prepare(
                `SELECT * FROM wallet_challenges WHERE challenge = ? AND expires_at > ? LIMIT 1`
            ),
            deleteChallenge: db.prepare(
                `DELETE FROM wallet_challenges WHERE challenge = ?`
            ),
            pruneExpiredChallenges: db.prepare(
                `DELETE FROM wallet_challenges WHERE expires_at <= ?`
            ),
            insertSpend: db.prepare(
                `INSERT INTO wallet_spend_log (id, amount_lamports, program, tx_signature, created_at) VALUES (?, ?, ?, ?, ?)`
            ),
            getDailySpend: db.prepare(
                `SELECT COALESCE(SUM(amount_lamports), 0) AS total FROM wallet_spend_log WHERE created_at >= ?`
            ),
        };
    }
}
