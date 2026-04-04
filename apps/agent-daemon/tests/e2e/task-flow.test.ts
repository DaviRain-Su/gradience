import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Daemon } from '../../src/daemon.js';
import { loadConfig } from '../../src/config.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

describe('Task Flow E2E', () => {
    let daemon: Daemon;
    let daemonToken: string;
    let sessionToken: string;
    let walletAddress: string;
    let tmpDir: string;
    const port = 20000 + Math.floor(Math.random() * 1000);

    beforeAll(async () => {
        tmpDir = mkdtempSync(join(tmpdir(), 'agentd-task-e2e-'));
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
        daemonToken = daemon.getAuthToken();

        // Create session via wallet signature
        const kp = nacl.sign.keyPair();
        walletAddress = bs58.encode(kp.publicKey);

        const challengeRes = await fetch(apiUrl('/api/v1/auth/challenge'), { method: 'POST' });
        const { challenge, message } = await challengeRes.json() as { challenge: string; message: string };
        const sig = nacl.sign.detached(Buffer.from(message, 'utf-8'), kp.secretKey);

        const verifyRes = await fetch(apiUrl('/api/v1/auth/verify'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                walletAddress,
                challenge,
                signature: Buffer.from(sig).toString('base64'),
            }),
        });
        const session = await verifyRes.json() as { token: string };
        sessionToken = session.token;
    });

    afterAll(async () => {
        await daemon.stop();
        rmSync(tmpDir, { recursive: true, force: true });
    });

    function apiUrl(path: string): string {
        return `http://127.0.0.1:${port}${path}`;
    }

    async function get(path: string, token?: string) {
        return fetch(apiUrl(path), {
            headers: { Authorization: `Bearer ${token ?? sessionToken}` },
        });
    }

    async function post(path: string, body: unknown, token?: string) {
        return fetch(apiUrl(path), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token ?? sessionToken}`,
            },
            body: JSON.stringify(body),
        });
    }

    // u2500u2500 Task Listing u2500u2500

    describe('Task listing', () => {
        it('should return empty task list initially', async () => {
            const res = await get('/api/v1/tasks');
            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.tasks).toEqual([]);
            expect(body.total).toBe(0);
        });

        it('should accept pagination params', async () => {
            const res = await get('/api/v1/tasks?limit=10&offset=0');
            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.tasks).toBeDefined();
        });

        it('should accept state filter', async () => {
            const res = await get('/api/v1/tasks?state=queued');
            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.tasks).toEqual([]);
        });

        it('should return 404 for non-existent task', async () => {
            const res = await get('/api/v1/tasks/nonexistent-task-id');
            expect(res.status).toBe(404);
            const body = await res.json() as any;
            expect(body.error).toBe('TASK_NOT_FOUND');
        });
    });

    // u2500u2500 Task access control u2500u2500

    describe('Task access control', () => {
        it('should reject task listing without auth', async () => {
            const res = await fetch(apiUrl('/api/v1/tasks'));
            expect(res.status).toBe(401);
        });

        it('should allow task listing with session token', async () => {
            const res = await get('/api/v1/tasks');
            expect(res.status).toBe(200);
        });

        it('should allow task listing with daemon token', async () => {
            const res = await get('/api/v1/tasks', daemonToken);
            expect(res.status).toBe(200);
        });
    });

    // u2500u2500 Task cancel u2500u2500

    describe('Task cancel', () => {
        it('should return error for cancelling non-existent task', async () => {
            const res = await post('/api/v1/tasks/fake-id/cancel', {});
            // TaskQueue.cancel throws DaemonError for not found
            expect([400, 404]).toContain(res.status);
        });
    });

    // u2500u2500 Agent registration & task lifecycle u2500u2500

    describe('Agent registration', () => {
        it('should register an agent', async () => {
            const res = await post('/api/v1/agents', {
                id: 'e2e-agent',
                name: 'E2E Test Agent',
                command: 'echo',
                args: ['hello'],
                autoStart: false,
                maxRestarts: 0,
            });
            expect(res.status).toBe(201);
        });

        it('should list registered agents', async () => {
            const res = await get('/api/v1/agents');
            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.agents.length).toBeGreaterThanOrEqual(1);
            const agent = body.agents.find((a: any) => a.config.id === 'e2e-agent');
            expect(agent).toBeTruthy();
            expect(agent.config.name).toBe('E2E Test Agent');
        });

        it('should reject duplicate agent', async () => {
            const res = await post('/api/v1/agents', {
                id: 'e2e-agent',
                name: 'Dup',
                command: 'echo',
                args: [],
                autoStart: false,
                maxRestarts: 0,
            });
            expect(res.status).toBe(409);
        });
    });

    // u2500u2500 Wallet authorization flow u2500u2500

    describe('Wallet authorization', () => {
        it('should request wallet authorization challenge', async () => {
            const res = await post('/api/v1/wallet/request-authorization', {}, daemonToken);
            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.agentPubkey).toBeTruthy();
            expect(body.challenge).toBeTruthy();
            expect(body.message).toContain('Authorize agent');
        });

        it('should show wallet status as not authorized', async () => {
            const res = await get('/api/v1/wallet/status', daemonToken);
            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.authorized).toBe(false);
            expect(body.agentWallet).toBeTruthy();
        });

        it('should complete full wallet authorization flow', async () => {
            // Step 1: Get challenge
            const challengeRes = await post('/api/v1/wallet/request-authorization', {}, daemonToken);
            const { challenge, message, agentPubkey } = await challengeRes.json() as any;

            // Step 2: Sign with master wallet
            const masterKp = nacl.sign.keyPair();
            const masterAddress = bs58.encode(masterKp.publicKey);
            const sig = nacl.sign.detached(Buffer.from(message, 'utf-8'), masterKp.secretKey);

            // Step 3: Authorize
            const authRes = await post('/api/v1/wallet/authorize', {
                masterWallet: masterAddress,
                challenge,
                signature: Buffer.from(sig).toString('base64'),
            }, daemonToken);
            expect(authRes.status).toBe(200);
            const authBody = await authRes.json() as any;
            expect(authBody.ok).toBe(true);
            expect(authBody.masterWallet).toBe(masterAddress);
            expect(authBody.agentWallet).toBe(agentPubkey);

            // Step 4: Verify status
            const statusRes = await get('/api/v1/wallet/status', daemonToken);
            const status = await statusRes.json() as any;
            expect(status.authorized).toBe(true);
            expect(status.masterWallet).toBe(masterAddress);
        });

        it('should get wallet policy after authorization', async () => {
            const res = await get('/api/v1/wallet/policy', daemonToken);
            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.policy).toBeDefined();
            expect(body.policy.dailyLimitLamports).toBeGreaterThan(0);
            expect(body.dailySpendLamports).toBe(0);
        });

        it('should revoke wallet authorization', async () => {
            const revokeRes = await post('/api/v1/wallet/revoke', {}, daemonToken);
            expect(revokeRes.status).toBe(200);

            const statusRes = await get('/api/v1/wallet/status', daemonToken);
            const status = await statusRes.json() as any;
            expect(status.authorized).toBe(false);
        });

        it('should reject policy request when not authorized', async () => {
            const res = await get('/api/v1/wallet/policy', daemonToken);
            expect(res.status).toBe(403);
        });
    });
});
