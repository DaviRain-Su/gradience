/**
 * Indexer Sync Service
 * 
 * Synchronizes data from Indexer API to local SQLite
 * Implements the ideal architecture: Web → Daemon → SQLite (synced from Indexer)
 */

import Database from 'better-sqlite3';

export interface SyncConfig {
  indexerUrl: string;
  syncIntervalMs: number;
  batchSize: number;
}

export interface TaskData {
  taskId: number;
  poster: string;
  evalRef: string;
  reward: string;
  deadline: string;
  state: string;
  category: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentData {
  address: string;
  displayName: string;
  bio: string;
  reputation: number;
  followersCount: number;
  followingCount: number;
  updatedAt: string;
}

export class IndexerSyncService {
  private db: Database.Database;
  private config: SyncConfig;
  private syncTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(db: Database.Database, config: Partial<SyncConfig> = {}) {
    this.db = db;
    this.config = {
      indexerUrl: config.indexerUrl || process.env.INDEXER_URL || 'https://api.gradiences.xyz/indexer',
      syncIntervalMs: config.syncIntervalMs || 30000, // 30 seconds
      batchSize: config.batchSize || 100,
    };
    this.initTables();
  }

  private initTables(): void {
    // Tasks cache table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS indexed_tasks (
        task_id INTEGER PRIMARY KEY,
        poster TEXT NOT NULL,
        eval_ref TEXT NOT NULL,
        reward TEXT NOT NULL,
        deadline TEXT NOT NULL,
        state TEXT NOT NULL,
        category INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Agents cache table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS indexed_agents (
        address TEXT PRIMARY KEY,
        display_name TEXT,
        bio TEXT,
        reputation INTEGER DEFAULT 0,
        followers_count INTEGER DEFAULT 0,
        following_count INTEGER DEFAULT 0,
        updated_at TEXT,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sync metadata
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[IndexerSync] Starting sync service...');
    
    // Initial sync
    await this.syncAll();
    
    // Periodic sync
    this.syncTimer = setInterval(() => {
      this.syncAll().catch(err => {
        console.error('[IndexerSync] Sync failed:', err);
      });
    }, this.config.syncIntervalMs);
  }

  stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.isRunning = false;
    console.log('[IndexerSync] Sync service stopped');
  }

  private async syncAll(): Promise<void> {
    console.log('[IndexerSync] Syncing from indexer...');
    
    try {
      await Promise.all([
        this.syncTasks(),
        this.syncAgents(),
      ]);
      
      this.updateSyncMetadata('last_sync', new Date().toISOString());
      console.log('[IndexerSync] Sync completed');
    } catch (err) {
      console.error('[IndexerSync] Sync error:', err);
      throw err;
    }
  }

  private async syncTasks(): Promise<void> {
    const lastSync = this.getSyncMetadata('tasks_last_sync') || '0';
    
    try {
      const response = await fetch(
        `${this.config.indexerUrl}/api/tasks?limit=${this.config.batchSize}&after=${lastSync}`,
        { signal: AbortSignal.timeout(10000) }
      );
      
      if (!response.ok) {
        throw new Error(`Indexer returned ${response.status}`);
      }
      
      const tasks: TaskData[] = await response.json();
      
      if (tasks.length === 0) return;
      
      const insert = this.db.prepare(`
        INSERT OR REPLACE INTO indexed_tasks 
        (task_id, poster, eval_ref, reward, deadline, state, category, created_at, updated_at, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      const transaction = this.db.transaction((items: TaskData[]) => {
        for (const task of items) {
          insert.run(
            task.taskId,
            task.poster,
            task.evalRef,
            task.reward,
            task.deadline,
            task.state,
            task.category,
            task.createdAt,
            task.updatedAt
          );
        }
      });
      
      transaction(tasks);
      
      // Update last sync cursor
      const maxUpdated = Math.max(...tasks.map(t => parseInt(t.updatedAt)));
      this.updateSyncMetadata('tasks_last_sync', maxUpdated.toString());
      
      console.log(`[IndexerSync] Synced ${tasks.length} tasks`);
    } catch (err) {
      console.error('[IndexerSync] Tasks sync failed:', err);
    }
  }

  private async syncAgents(): Promise<void> {
    try {
      const response = await fetch(
        `${this.config.indexerUrl}/api/agents?limit=${this.config.batchSize}`,
        { signal: AbortSignal.timeout(10000) }
      );
      
      if (!response.ok) {
        throw new Error(`Indexer returned ${response.status}`);
      }
      
      const agents: AgentData[] = await response.json();
      
      if (agents.length === 0) return;
      
      const insert = this.db.prepare(`
        INSERT OR REPLACE INTO indexed_agents 
        (address, display_name, bio, reputation, followers_count, following_count, updated_at, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      const transaction = this.db.transaction((items: AgentData[]) => {
        for (const agent of items) {
          insert.run(
            agent.address,
            agent.displayName,
            agent.bio,
            agent.reputation,
            agent.followersCount,
            agent.followingCount,
            agent.updatedAt
          );
        }
      });
      
      transaction(agents);
      
      console.log(`[IndexerSync] Synced ${agents.length} agents`);
    } catch (err) {
      console.error('[IndexerSync] Agents sync failed:', err);
    }
  }

  // Query methods (used by API routes)
  getCachedTasks(limit: number = 50): TaskData[] {
    const stmt = this.db.prepare(`
      SELECT 
        task_id as taskId,
        poster,
        eval_ref as evalRef,
        reward,
        deadline,
        state,
        category,
        created_at as createdAt,
        updated_at as updatedAt
      FROM indexed_tasks
      ORDER BY updated_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as TaskData[];
  }

  getCachedAgents(limit: number = 50): AgentData[] {
    const stmt = this.db.prepare(`
      SELECT 
        address,
        display_name as displayName,
        bio,
        reputation,
        followers_count as followersCount,
        following_count as followingCount,
        updated_at as updatedAt
      FROM indexed_agents
      ORDER BY reputation DESC
      LIMIT ?
    `);
    return stmt.all(limit) as AgentData[];
  }

  getSyncStatus(): { lastSync: string | null; isRunning: boolean } {
    return {
      lastSync: this.getSyncMetadata('last_sync'),
      isRunning: this.isRunning,
    };
  }

  private updateSyncMetadata(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO sync_metadata (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(key, value);
  }

  private getSyncMetadata(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM sync_metadata WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }
}

export default IndexerSyncService;
