import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { ProcessManager } from '../../src/agents/process-manager.js';
import { DaemonError } from '../../src/utils/errors.js';

describe('ProcessManager', () => {
    let db: Database.Database;
    let pm: ProcessManager;

    beforeEach(() => {
        db = new Database(':memory:');
        db.exec(`
            CREATE TABLE agents (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, command TEXT NOT NULL,
                args TEXT NOT NULL DEFAULT '[]', cwd TEXT, env TEXT NOT NULL DEFAULT '{}',
                auto_start INTEGER NOT NULL DEFAULT 0, max_restarts INTEGER NOT NULL DEFAULT 3,
                cpu_limit REAL, memory_limit INTEGER,
                created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
            );
        `);
        pm = new ProcessManager(db, 4);
    });

    afterEach(async () => {
        await pm.shutdown();
        db.close();
    });

    it('should register a new agent', () => {
        const config = pm.register({
            id: 'test-agent',
            name: 'Test Agent',
            command: 'echo',
            args: ['hello'],
            autoStart: false,
            maxRestarts: 3,
        });
        expect(config.id).toBe('test-agent');
    });

    it('should reject duplicate agent registration', () => {
        pm.register({ id: 'a1', name: 'A1', command: 'echo', args: [], autoStart: false, maxRestarts: 3 });
        expect(() => {
            pm.register({ id: 'a1', name: 'A1 dup', command: 'echo', args: [], autoStart: false, maxRestarts: 3 });
        }).toThrow(DaemonError);
    });

    it('should list agents', () => {
        pm.register({ id: 'a1', name: 'A1', command: 'echo', args: [], autoStart: false, maxRestarts: 3 });
        pm.register({ id: 'a2', name: 'A2', command: 'echo', args: [], autoStart: false, maxRestarts: 3 });
        expect(pm.list()).toHaveLength(2);
    });

    it('H1: should start an agent and return pid', async () => {
        pm.register({ id: 'a1', name: 'A1', command: 'echo', args: ['test'], autoStart: false, maxRestarts: 3 });
        const pid = await pm.start('a1');
        expect(pid).toBeGreaterThan(0);
    });

    it('should throw AGENT_NOT_FOUND for nonexistent agent', async () => {
        await expect(pm.start('nonexistent')).rejects.toThrow(DaemonError);
    });

    it('B1: should reject start when at max capacity', async () => {
        const smallPm = new ProcessManager(db, 1);
        smallPm.register({ id: 'a1', name: 'A1', command: 'sleep', args: ['10'], autoStart: false, maxRestarts: 0 });
        smallPm.register({ id: 'a2', name: 'A2', command: 'sleep', args: ['10'], autoStart: false, maxRestarts: 0 });

        await smallPm.start('a1');
        await expect(smallPm.start('a2')).rejects.toThrow(DaemonError);

        await smallPm.shutdown();
    });

    it('E1: should fail for nonexistent command', async () => {
        pm.register({
            id: 'bad',
            name: 'Bad',
            command: 'this-command-does-not-exist-xyz',
            args: [],
            autoStart: false,
            maxRestarts: 0,
        });
        // spawn of a nonexistent command will either throw or emit an error event
        await expect(pm.start('bad')).rejects.toThrow();
    });
});
