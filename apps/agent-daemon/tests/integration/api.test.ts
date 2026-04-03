import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Daemon } from '../../src/daemon.js';
import { loadConfig } from '../../src/config.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('API Server Integration', () => {
    let daemon: Daemon;
    let token: string;
    let tmpDir: string;
    const port = 17420 + Math.floor(Math.random() * 1000);

    beforeAll(async () => {
        tmpDir = mkdtempSync(join(tmpdir(), 'agentd-integration-'));
        const config = loadConfig({
            port,
            host: '127.0.0.1',
            dbPath: join(tmpDir, 'test.db'),
            chainHubUrl: 'wss://localhost:1/fake',
            reconnectMaxAttempts: 1,
            reconnectBaseDelay: 500,
            reconnectMaxDelay: 1000,
        });
        daemon = new Daemon(config);
        await daemon.start();
        token = daemon.getAuthToken();
    });

    afterAll(async () => {
        await daemon.stop();
        rmSync(tmpDir, { recursive: true, force: true });
    });

    function apiUrl(path: string): string {
        return `http://127.0.0.1:${port}${path}`;
    }

    async function get(path: string, authToken?: string) {
        return fetch(apiUrl(path), {
            headers: { Authorization: `Bearer ${authToken ?? token}` },
        });
    }

    async function post(path: string, body: unknown, authToken?: string) {
        return fetch(apiUrl(path), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken ?? token}`,
            },
            body: JSON.stringify(body),
        });
    }

    // Auth tests
    it('S1: should return 401 without auth token', async () => {
        const res = await fetch(apiUrl('/api/v1/status'));
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe('AUTH_REQUIRED');
    });

    it('S2: should return 401 with wrong token', async () => {
        const res = await get('/api/v1/status', 'wrong-token');
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe('AUTH_INVALID');
    });

    it('S3: should return 200 with correct token', async () => {
        const res = await get('/api/v1/status');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe('running');
        expect(body.version).toBe('0.1.0');
    });

    // Status
    it('should return daemon status with task counts', async () => {
        const res = await get('/api/v1/status');
        const body = await res.json();
        expect(body.tasks).toBeDefined();
        expect(typeof body.tasks.queued).toBe('number');
        expect(typeof body.uptime).toBe('number');
    });

    // Tasks
    it('should return empty task list initially', async () => {
        const res = await get('/api/v1/tasks');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tasks).toEqual([]);
    });

    it('should return 404 for non-existent task', async () => {
        const res = await get('/api/v1/tasks/nonexistent');
        expect(res.status).toBe(404);
    });

    // Agents
    it('should register and list agents', async () => {
        const createRes = await post('/api/v1/agents', {
            id: 'test-agent-api',
            name: 'Test Agent',
            command: 'echo',
            args: ['hello'],
            autoStart: false,
            maxRestarts: 3,
        });
        expect(createRes.status).toBe(201);

        const listRes = await get('/api/v1/agents');
        const body = await listRes.json();
        expect(body.agents.length).toBeGreaterThan(0);
        expect(body.agents.some((a: { config: { id: string } }) => a.config.id === 'test-agent-api')).toBe(true);
    });

    it('should reject duplicate agent registration', async () => {
        await post('/api/v1/agents', {
            id: 'dup-agent',
            name: 'Dup',
            command: 'echo',
            args: [],
            autoStart: false,
            maxRestarts: 0,
        });
        const res = await post('/api/v1/agents', {
            id: 'dup-agent',
            name: 'Dup 2',
            command: 'echo',
            args: [],
            autoStart: false,
            maxRestarts: 0,
        });
        expect(res.status).toBe(409);
    });

    // Keys
    it('should return public key', async () => {
        const res = await get('/api/v1/keys/public');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.publicKey).toBeTruthy();
    });

    it('should sign a message', async () => {
        const msg = Buffer.from('test message').toString('base64');
        const res = await post('/api/v1/keys/sign', { message: msg });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.signature).toBeTruthy();
        expect(body.publicKey).toBeTruthy();
    });

    // Messages
    it('should return empty message list initially', async () => {
        const res = await get('/api/v1/messages');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.messages).toEqual([]);
    });
});
