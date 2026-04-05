/**
 * P2P Soul Handshake Protocol - Storage Layer
 * 
 * Manages persistence of handshake sessions and related data.
 * 
 * @module p2p-soul/storage
 */

import type {
  HandshakeSession,
  DisclosureRecord,
  MatchRecord,
} from './types.js';

// ============================================================================
// Storage Interface
// ============================================================================

export interface HandshakeStorage {
  // Session operations
  saveSession(session: HandshakeSession): Promise<void>;
  getSession(sessionId: string): Promise<HandshakeSession | undefined>;
  getSessionsByDid(did: string): Promise<HandshakeSession[]>;
  deleteSession(sessionId: string): Promise<void>;
  
  // Disclosure operations
  saveDisclosure(disclosure: DisclosureRecord): Promise<void>;
  getDisclosures(sessionId: string): Promise<DisclosureRecord[]>;
  
  // Match operations
  saveMatch(match: MatchRecord): Promise<void>;
  getMatch(sessionId: string): Promise<MatchRecord | undefined>;
  getMatchesByDid(did: string): Promise<MatchRecord[]>;
  
  // Cleanup
  cleanupExpired(): Promise<void>;
}

// ============================================================================
// SQLite Implementation
// ============================================================================

export interface Database {
  prepare(sql: string): Statement;
  exec(sql: string): void;
}

export interface Statement {
  run(...params: unknown[]): { lastInsertRowid: number; changes: number };
  get(...params: unknown[]): unknown | undefined;
  all(...params: unknown[]): unknown[];
}

export class SqliteHandshakeStorage implements HandshakeStorage {
  private db: Database;
  
  constructor(db: Database) {
    this.db = db;
    this.initializeSchema();
  }
  
  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS p2p_soul_sessions (
        id TEXT PRIMARY KEY,
        initiator_did TEXT NOT NULL,
        responder_did TEXT NOT NULL,
        current_state TEXT NOT NULL,
        current_level INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        encrypted_context TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_sessions_initiator 
        ON p2p_soul_sessions(initiator_did);
      CREATE INDEX IF NOT EXISTS idx_sessions_responder 
        ON p2p_soul_sessions(responder_did);
      CREATE INDEX IF NOT EXISTS idx_sessions_state 
        ON p2p_soul_sessions(current_state);
      
      CREATE TABLE IF NOT EXISTS p2p_soul_disclosures (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        level INTEGER NOT NULL,
        from_did TEXT NOT NULL,
        to_did TEXT NOT NULL,
        encrypted_data TEXT NOT NULL,
        zk_proof TEXT,
        verdict TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES p2p_soul_sessions(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_disclosures_session 
        ON p2p_soul_disclosures(session_id);
      
      CREATE TABLE IF NOT EXISTS p2p_soul_matches (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL UNIQUE,
        party_a_did TEXT NOT NULL,
        party_b_did TEXT NOT NULL,
        matched_at INTEGER NOT NULL,
        shared_level INTEGER NOT NULL,
        encrypted_contact_a TEXT,
        encrypted_contact_b TEXT,
        FOREIGN KEY (session_id) REFERENCES p2p_soul_sessions(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_matches_party_a 
        ON p2p_soul_matches(party_a_did);
      CREATE INDEX IF NOT EXISTS idx_matches_party_b 
        ON p2p_soul_matches(party_b_did);
    `);
  }
  
  async saveSession(session: HandshakeSession): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO p2p_soul_sessions 
        (id, initiator_did, responder_did, current_state, current_level,
         created_at, updated_at, expires_at, encrypted_context)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      session.id,
      session.initiatorDid,
      session.responderDid,
      session.currentState,
      session.currentLevel,
      session.createdAt,
      session.updatedAt,
      session.expiresAt,
      session.encryptedContext
    );
  }
  
  async getSession(sessionId: string): Promise<HandshakeSession | undefined> {
    const stmt = this.db.prepare(`
      SELECT * FROM p2p_soul_sessions WHERE id = ?
    `);
    
    const row = stmt.get(sessionId) as any;
    if (!row) return undefined;
    
    return this.rowToSession(row);
  }
  
  async getSessionsByDid(did: string): Promise<HandshakeSession[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM p2p_soul_sessions 
      WHERE initiator_did = ? OR responder_did = ?
      ORDER BY updated_at DESC
    `);
    
    const rows = stmt.all(did, did) as any[];
    return rows.map(r => this.rowToSession(r));
  }
  
  async deleteSession(sessionId: string): Promise<void> {
    const stmt = this.db.prepare(`
      DELETE FROM p2p_soul_sessions WHERE id = ?
    `);
    stmt.run(sessionId);
  }
  
  async saveDisclosure(disclosure: DisclosureRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO p2p_soul_disclosures
        (id, session_id, level, from_did, to_did, encrypted_data, zk_proof, verdict, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      disclosure.id,
      disclosure.sessionId,
      disclosure.level,
      disclosure.fromDid,
      disclosure.toDid,
      disclosure.encryptedData,
      disclosure.zkProof || null,
      disclosure.verdict,
      disclosure.createdAt
    );
  }
  
  async getDisclosures(sessionId: string): Promise<DisclosureRecord[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM p2p_soul_disclosures 
      WHERE session_id = ?
      ORDER BY level ASC, created_at ASC
    `);
    
    const rows = stmt.all(sessionId) as any[];
    return rows.map(r => this.rowToDisclosure(r));
  }
  
  async saveMatch(match: MatchRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO p2p_soul_matches
        (id, session_id, party_a_did, party_b_did, matched_at, shared_level,
         encrypted_contact_a, encrypted_contact_b)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      match.id,
      match.sessionId,
      match.partyADid,
      match.partyBDid,
      match.matchedAt,
      match.sharedLevel,
      match.encryptedContactA || null,
      match.encryptedContactB || null
    );
  }
  
  async getMatch(sessionId: string): Promise<MatchRecord | undefined> {
    const stmt = this.db.prepare(`
      SELECT * FROM p2p_soul_matches WHERE session_id = ?
    `);
    
    const row = stmt.get(sessionId) as any;
    if (!row) return undefined;
    
    return this.rowToMatch(row);
  }
  
  async getMatchesByDid(did: string): Promise<MatchRecord[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM p2p_soul_matches 
      WHERE party_a_did = ? OR party_b_did = ?
      ORDER BY matched_at DESC
    `);
    
    const rows = stmt.all(did, did) as any[];
    return rows.map(r => this.rowToMatch(r));
  }
  
  async cleanupExpired(): Promise<void> {
    const now = Date.now();
    
    // Delete expired sessions
    const sessionStmt = this.db.prepare(`
      DELETE FROM p2p_soul_sessions WHERE expires_at < ?
    `);
    sessionStmt.run(now);
    
    // Delete orphaned disclosures
    const disclosureStmt = this.db.prepare(`
      DELETE FROM p2p_soul_disclosures 
      WHERE session_id NOT IN (SELECT id FROM p2p_soul_sessions)
    `);
    disclosureStmt.run();
    
    // Delete orphaned matches
    const matchStmt = this.db.prepare(`
      DELETE FROM p2p_soul_matches 
      WHERE session_id NOT IN (SELECT id FROM p2p_soul_sessions)
    `);
    matchStmt.run();
  }
  
  private rowToSession(row: any): HandshakeSession {
    return {
      id: row.id,
      initiatorDid: row.initiator_did,
      responderDid: row.responder_did,
      currentState: row.current_state,
      currentLevel: row.current_level,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
      encryptedContext: row.encrypted_context,
    };
  }
  
  private rowToDisclosure(row: any): DisclosureRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      level: row.level,
      fromDid: row.from_did,
      toDid: row.to_did,
      encryptedData: row.encrypted_data,
      zkProof: row.zk_proof,
      verdict: row.verdict,
      createdAt: row.created_at,
    };
  }
  
  private rowToMatch(row: any): MatchRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      partyADid: row.party_a_did,
      partyBDid: row.party_b_did,
      matchedAt: row.matched_at,
      sharedLevel: row.shared_level,
      encryptedContactA: row.encrypted_contact_a,
      encryptedContactB: row.encrypted_contact_b,
    };
  }
}

// ============================================================================
// In-Memory Implementation (for testing)
// ============================================================================

export class InMemoryHandshakeStorage implements HandshakeStorage {
  private sessions: Map<string, HandshakeSession> = new Map();
  private disclosures: Map<string, DisclosureRecord[]> = new Map();
  private matches: Map<string, MatchRecord> = new Map();
  
  async saveSession(session: HandshakeSession): Promise<void> {
    this.sessions.set(session.id, { ...session });
  }
  
  async getSession(sessionId: string): Promise<HandshakeSession | undefined> {
    return this.sessions.get(sessionId);
  }
  
  async getSessionsByDid(did: string): Promise<HandshakeSession[]> {
    return Array.from(this.sessions.values())
      .filter(s => s.initiatorDid === did || s.responderDid === did)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
  
  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    this.disclosures.delete(sessionId);
    this.matches.delete(sessionId);
  }
  
  async saveDisclosure(disclosure: DisclosureRecord): Promise<void> {
    const list = this.disclosures.get(disclosure.sessionId) || [];
    list.push(disclosure);
    this.disclosures.set(disclosure.sessionId, list);
  }
  
  async getDisclosures(sessionId: string): Promise<DisclosureRecord[]> {
    return this.disclosures.get(sessionId) || [];
  }
  
  async saveMatch(match: MatchRecord): Promise<void> {
    this.matches.set(match.sessionId, match);
  }
  
  async getMatch(sessionId: string): Promise<MatchRecord | undefined> {
    return this.matches.get(sessionId);
  }
  
  async getMatchesByDid(did: string): Promise<MatchRecord[]> {
    return Array.from(this.matches.values())
      .filter(m => m.partyADid === did || m.partyBDid === did)
      .sort((a, b) => b.matchedAt - a.matchedAt);
  }
  
  async cleanupExpired(): Promise<void> {
    const now = Date.now();
    
    for (const [id, session] of this.sessions) {
      if (session.expiresAt < now) {
        this.sessions.delete(id);
        this.disclosures.delete(id);
        this.matches.delete(id);
      }
    }
  }
  
  clear(): void {
    this.sessions.clear();
    this.disclosures.clear();
    this.matches.clear();
  }
}
