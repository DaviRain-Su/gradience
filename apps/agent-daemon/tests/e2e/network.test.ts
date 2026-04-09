import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Daemon } from '../../src/daemon.js';
import { loadConfig } from '../../src/config.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

describe('Network (Agent Registry + Messages) E2E', () => {
    let daemon: Daemon;
    let daemonToken: string;
    let tmpDir: string;
    const port = 21000 + Math.floor(Math.random() * 1000);

    // Two agent wallets
    let kpA: nacl.SignKeyPair;
    let kpB: nacl.SignKeyPair;
    let addrA: string;
    let addrB: string;
    let tokenA: string;
    let tokenB: string;

    beforeAll(async () => {
        tmpDir = mkdtempSync(join(tmpdir(), 'agentd-network-e2e-'));
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

        // Create two wallets and get session tokens
        kpA = nacl.sign.keyPair();
        kpB = nacl.sign.keyPair();
        addrA = bs58.encode(kpA.publicKey);
        addrB = bs58.encode(kpB.publicKey);

        tokenA = await getSessionToken(kpA, addrA);
        tokenB = await getSessionToken(kpB, addrB);
    });

    afterAll(async () => {
        await daemon.stop();
        rmSync(tmpDir, { recursive: true, force: true });
    });

    function apiUrl(path: string): string {
        return `http://127.0.0.1:${port}${path}`;
    }

    async function getSessionToken(kp: nacl.SignKeyPair, address: string): Promise<string> {
        const challengeRes = await fetch(apiUrl('/api/v1/auth/challenge'), { method: 'POST' });
        const { challenge, message } = (await challengeRes.json()) as any;
        const sig = nacl.sign.detached(Buffer.from(message, 'utf-8'), kp.secretKey);
        const verifyRes = await fetch(apiUrl('/api/v1/auth/verify'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                walletAddress: address,
                challenge,
                signature: Buffer.from(sig).toString('base64'),
            }),
        });
        const { token } = (await verifyRes.json()) as any;
        return token;
    }

    async function post(path: string, body: unknown, token: string) {
        return fetch(apiUrl(path), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
    }

    async function get(path: string, token: string) {
        return fetch(apiUrl(path), {
            headers: { Authorization: `Bearer ${token}` },
        });
    }

    // u2500u2500 Agent Registry u2500u2500

    describe('Agent Registry', () => {
        it('should register Agent A', async () => {
            const res = await post(
                '/api/v1/network/register',
                {
                    publicKey: addrA,
                    displayName: 'Agent Alpha',
                    capabilities: ['coding', 'analysis'],
                    version: '0.1.0',
                },
                tokenA,
            );
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.agentId).toBe(addrA);
            expect(body.registeredAt).toBeGreaterThan(0);
        });

        it('should register Agent B', async () => {
            const res = await post(
                '/api/v1/network/register',
                {
                    publicKey: addrB,
                    displayName: 'Agent Beta',
                    capabilities: ['design', 'coding'],
                },
                tokenB,
            );
            expect(res.status).toBe(200);
        });

        it('should list both agents as online', async () => {
            const res = await get('/api/v1/network/agents', tokenA);
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.agents.length).toBe(2);
            expect(body.total).toBe(2);
            const keys = body.agents.map((a: any) => a.publicKey);
            expect(keys).toContain(addrA);
            expect(keys).toContain(addrB);
            expect(body.agents.every((a: any) => a.online)).toBe(true);
        });

        it('should get agent by publicKey', async () => {
            const res = await get(`/api/v1/network/agents/${addrA}`, tokenA);
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.displayName).toBe('Agent Alpha');
            expect(body.capabilities).toContain('coding');
        });

        it('should return 404 for unknown agent', async () => {
            const res = await get('/api/v1/network/agents/UnknownKey123', tokenA);
            expect(res.status).toBe(404);
        });

        it('should filter by capability', async () => {
            const res = await get('/api/v1/network/agents?capability=design', tokenA);
            const body = (await res.json()) as any;
            expect(body.agents.length).toBe(1);
            expect(body.agents[0].publicKey).toBe(addrB);
        });

        it('should search by name', async () => {
            const res = await get('/api/v1/network/agents?q=Alpha', tokenA);
            const body = (await res.json()) as any;
            expect(body.agents.length).toBe(1);
            expect(body.agents[0].displayName).toBe('Agent Alpha');
        });

        it('should handle heartbeat', async () => {
            const res = await post('/api/v1/network/heartbeat', { publicKey: addrA }, tokenA);
            expect(res.status).toBe(200);
        });

        it('should reject heartbeat for unregistered agent', async () => {
            const res = await post('/api/v1/network/heartbeat', { publicKey: 'nonexistent' }, tokenA);
            expect(res.status).toBe(404);
        });

        it('should remove agent', async () => {
            const res = await fetch(apiUrl(`/api/v1/network/agents/${addrB}`), {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${daemonToken}` },
            });
            expect(res.status).toBe(200);

            const listRes = await get('/api/v1/network/agents', tokenA);
            const body = (await listRes.json()) as any;
            expect(body.agents.length).toBe(1);
        });

        it('should re-register removed agent', async () => {
            await post(
                '/api/v1/network/register',
                {
                    publicKey: addrB,
                    displayName: 'Agent Beta v2',
                    capabilities: ['design'],
                },
                tokenB,
            );
            const res = await get(`/api/v1/network/agents/${addrB}`, tokenA);
            const body = (await res.json()) as any;
            expect(body.displayName).toBe('Agent Beta v2');
        });
    });

    // u2500u2500 Message Relay u2500u2500

    describe('Message Relay', () => {
        it('Agent A sends message to Agent B', async () => {
            const res = await post(
                '/api/v1/network/messages',
                {
                    from: addrA,
                    to: addrB,
                    type: 'chat',
                    payload: { text: 'Hello from Alpha!' },
                },
                tokenA,
            );
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.messageId).toBeTruthy();
        });

        it('Agent B fetches inbox and sees the message', async () => {
            const res = await get('/api/v1/network/messages/inbox', tokenB);
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.messages.length).toBe(1);
            expect(body.messages[0].from).toBe(addrA);
            expect(body.messages[0].type).toBe('chat');
            expect(body.messages[0].payload.text).toBe('Hello from Alpha!');
        });

        it('delivered messages should not appear again', async () => {
            const res = await get('/api/v1/network/messages/inbox', tokenB);
            const body = (await res.json()) as any;
            expect(body.messages.length).toBe(0);
        });

        it('Agent B can use since param to get messages after timestamp', async () => {
            const beforeSend = Date.now() - 1; // -1ms to avoid race
            await post(
                '/api/v1/network/messages',
                {
                    from: addrA,
                    to: addrB,
                    type: 'ping',
                    payload: {},
                },
                tokenA,
            );

            const res = await get(`/api/v1/network/messages/inbox?since=${beforeSend}`, tokenB);
            const body = (await res.json()) as any;
            expect(body.messages.length).toBe(1);
            expect(body.messages[0].type).toBe('ping');
        });

        it('Agent B acks a message', async () => {
            // Send another
            const sendRes = await post(
                '/api/v1/network/messages',
                {
                    from: addrA,
                    to: addrB,
                    type: 'task_proposal',
                    payload: { taskId: '123' },
                },
                tokenA,
            );
            const { messageId } = (await sendRes.json()) as any;

            // Fetch it
            await get('/api/v1/network/messages/inbox', tokenB);

            // Ack it
            const ackRes = await post(`/api/v1/network/messages/${messageId}/ack`, {}, tokenB);
            expect(ackRes.status).toBe(200);
        });

        it('should reject send without to/type', async () => {
            const res = await post('/api/v1/network/messages', { from: addrA, to: addrB }, tokenA);
            expect(res.status).toBe(400);
        });

        it('should reject inbox without auth', async () => {
            const res = await fetch(apiUrl('/api/v1/network/messages/inbox'));
            expect(res.status).toBe(401);
        });

        it('bidirectional: B sends to A, A receives', async () => {
            await post(
                '/api/v1/network/messages',
                {
                    from: addrB,
                    to: addrA,
                    type: 'chat',
                    payload: { text: 'Hi Alpha from Beta!' },
                },
                tokenB,
            );

            const res = await get('/api/v1/network/messages/inbox', tokenA);
            const body = (await res.json()) as any;
            expect(body.messages.length).toBeGreaterThanOrEqual(1);
            const msg = body.messages.find((m: any) => m.payload.text === 'Hi Alpha from Beta!');
            expect(msg).toBeTruthy();
            expect(msg.from).toBe(addrB);
        });
    });
});
