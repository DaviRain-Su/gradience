import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { randomBytes } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { TypedStatement, RunResult, DatabaseInstance } from '../types/database.js';
import { logger } from '../utils/logger.js';

const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface ChallengeRow {
    challenge: string;
    created_at: number;
    expires_at: number;
}

interface SessionRow {
    token: string;
    wallet_address: string;
    created_at: number;
    expires_at: number;
}

interface SessionStatements {
    insertChallenge: TypedStatement<[string, number, number], RunResult>;
    getChallenge: TypedStatement<[string, number], ChallengeRow | undefined>;
    deleteChallenge: TypedStatement<[string], RunResult>;
    pruneExpiredChallenges: TypedStatement<[number], RunResult>;
    insertSession: TypedStatement<[string, string, number, number], RunResult>;
    getSession: TypedStatement<[string, number], SessionRow | undefined>;
    deleteSession: TypedStatement<[string], RunResult>;
    pruneExpiredSessions: TypedStatement<[number], RunResult>;
}

export class SessionManager {
    private readonly stmts: SessionStatements;

    constructor(private readonly db: DatabaseInstance) {
        this.ensureTables();
        this.stmts = SessionManager.prepareStatements(db);
    }

    private ensureTables(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS session_challenges (
                challenge   TEXT PRIMARY KEY,
                created_at  INTEGER NOT NULL,
                expires_at  INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token           TEXT PRIMARY KEY,
                wallet_address  TEXT NOT NULL,
                created_at      INTEGER NOT NULL,
                expires_at      INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sessions_wallet ON sessions(wallet_address);
            CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
        `);
    }

    requestChallenge(): { challenge: string; message: string; expiresAt: number } {
        this.stmts.pruneExpiredChallenges.run(Date.now());

        const challenge = randomBytes(32).toString('base64');
        const now = Date.now();
        const expiresAt = now + CHALLENGE_TTL_MS;

        this.stmts.insertChallenge.run(challenge, now, expiresAt);

        const message = `Sign in to Gradience\nChallenge: ${challenge}`;
        logger.info({ prefix: challenge.slice(0, 8) }, 'Session challenge generated');

        return { challenge, message, expiresAt };
    }

    verifyAndCreateSession(params: { walletAddress: string; challenge: string; signature: string }): {
        token: string;
        walletAddress: string;
        expiresAt: number;
    } {
        // Validate wallet address
        let pubkeyBytes: Uint8Array;
        try {
            pubkeyBytes = bs58.decode(params.walletAddress);
        } catch {
            throw new Error('Invalid wallet address: not valid base58');
        }
        if (pubkeyBytes.length !== 32) {
            throw new Error('Invalid wallet address: expected 32 bytes');
        }

        // Check challenge exists and not expired
        const challengeRow = this.stmts.getChallenge.get(params.challenge, Date.now());
        if (!challengeRow) {
            throw new Error('Challenge not found or expired');
        }

        // Verify signature
        let sigBytes: Uint8Array;
        try {
            sigBytes = Buffer.from(params.signature, 'base64');
        } catch {
            throw new Error('Invalid signature: not valid base64');
        }
        if (sigBytes.length !== 64) {
            throw new Error('Invalid signature: expected 64 bytes');
        }

        const message = `Sign in to Gradience\nChallenge: ${params.challenge}`;
        const messageBytes = Buffer.from(message, 'utf-8');

        if (!nacl.sign.detached.verify(messageBytes, sigBytes, pubkeyBytes)) {
            throw new Error('Signature verification failed');
        }

        // Consume challenge
        this.stmts.deleteChallenge.run(params.challenge);

        // Create session token
        const token = randomBytes(32).toString('base64');
        const now = Date.now();
        const expiresAt = now + SESSION_TTL_MS;

        this.stmts.insertSession.run(token, params.walletAddress, now, expiresAt);

        logger.info({ wallet: params.walletAddress.slice(0, 8) }, 'Session created');

        return { token, walletAddress: params.walletAddress, expiresAt };
    }

    validateSession(token: string): { walletAddress: string } | null {
        const row = this.stmts.getSession.get(token, Date.now());
        if (!row) return null;
        return { walletAddress: row.wallet_address };
    }

    revokeSession(token: string): void {
        this.stmts.deleteSession.run(token);
    }

    pruneExpired(): void {
        this.stmts.pruneExpiredChallenges.run(Date.now());
        this.stmts.pruneExpiredSessions.run(Date.now());
    }

    private static prepareStatements(db: DatabaseInstance): SessionStatements {
        return {
            insertChallenge: db.prepare(
                'INSERT INTO session_challenges (challenge, created_at, expires_at) VALUES (?, ?, ?)',
            ),
            getChallenge: db.prepare('SELECT * FROM session_challenges WHERE challenge = ? AND expires_at > ? LIMIT 1'),
            deleteChallenge: db.prepare('DELETE FROM session_challenges WHERE challenge = ?'),
            pruneExpiredChallenges: db.prepare('DELETE FROM session_challenges WHERE expires_at <= ?'),
            insertSession: db.prepare(
                'INSERT INTO sessions (token, wallet_address, created_at, expires_at) VALUES (?, ?, ?, ?)',
            ),
            getSession: db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ? LIMIT 1'),
            deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
            pruneExpiredSessions: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
        };
    }
}
