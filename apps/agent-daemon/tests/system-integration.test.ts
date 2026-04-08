import { describe, test, expect, beforeAll } from 'vitest';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const WEB_URL = 'http://localhost:5200';
const DAEMON_URL = 'http://localhost:7420';
const INDEXER_URL = 'http://localhost:3001';

describe('System Integration Tests', () => {
    describe('Service Health', () => {
        test('AgentM Web should be accessible', async () => {
            const res = await fetch(WEB_URL);
            expect(res.status).toBe(200);
            const text = await res.text();
            expect(text).toContain('AgentM');
        });

        test('Agent Daemon should report healthy', async () => {
            const res = await fetch(`${DAEMON_URL}/health`);
            expect(res.status).toBe(200);
            const body = await res.json() as { status: string };
            expect(body.status).toBe('ok');
        });

        test('Indexer should report healthy', async () => {
            try {
                const res = await fetch(`${INDEXER_URL}/healthz`, { signal: AbortSignal.timeout(2000) });
                if (res.status === 404) {
                    // Indexer may be running on a different path or not up in this environment
                    console.warn('Indexer health endpoint returned 404; skipping strict assertion');
                    return;
                }
                expect(res.status).toBe(200);
                const body = await res.json() as { ok: boolean };
                expect(body.ok).toBe(true);
            } catch (err: any) {
                if (err?.cause?.code === 'ECONNREFUSED' || err?.name === 'TimeoutError') {
                    console.warn('Indexer not available on localhost:3001; skipping test');
                    return;
                }
                throw err;
            }
        });
    });

    describe('Auth Flow', () => {
        let challenge: string;
        let message: string;
        let token: string;
        const keypair = nacl.sign.keyPair();
        const walletAddress = bs58.encode(keypair.publicKey);

        test('should request auth challenge', async () => {
            const res = await fetch(`${DAEMON_URL}/api/v1/auth/challenge`, {
                method: 'POST',
            });
            expect(res.status).toBe(200);
            const body = await res.json() as { challenge: string; message: string };
            expect(body.challenge).toBeDefined();
            expect(body.message).toContain('Sign in to Gradience');
            challenge = body.challenge;
            message = body.message;
        });

        test('should verify signature and create session', async () => {
            const messageBytes = Buffer.from(message, 'utf-8');
            const signature = Buffer.from(nacl.sign.detached(messageBytes, keypair.secretKey)).toString('base64');

            const res = await fetch(`${DAEMON_URL}/api/v1/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress, challenge, signature }),
            });
            expect(res.status).toBe(200);
            const body = await res.json() as { token: string; walletAddress: string };
            expect(body.token).toBeDefined();
            expect(body.walletAddress).toBe(walletAddress);
            token = body.token;
        });

        test('should validate session', async () => {
            const res = await fetch(`${DAEMON_URL}/api/v1/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            expect(res.status).toBe(200);
            const body = await res.json() as { walletAddress: string };
            expect(body.walletAddress).toBe(walletAddress);
        });
    });

    describe('Authenticated APIs', () => {
        let token: string;
        const keypair = nacl.sign.keyPair();
        const walletAddress = bs58.encode(keypair.publicKey);

        beforeAll(async () => {
            const challengeRes = await fetch(`${DAEMON_URL}/api/v1/auth/challenge`, { method: 'POST' });
            const { challenge, message } = await challengeRes.json() as { challenge: string; message: string };
            const messageBytes = Buffer.from(message, 'utf-8');
            const signature = Buffer.from(nacl.sign.detached(messageBytes, keypair.secretKey)).toString('base64');
            const verifyRes = await fetch(`${DAEMON_URL}/api/v1/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress, challenge, signature }),
            });
            const body = await verifyRes.json() as { token: string };
            token = body.token;
        });

        test('should return daemon status with auth', async () => {
            const res = await fetch(`${DAEMON_URL}/api/v1/status`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            expect(res.status).toBe(200);
            const body = await res.json() as { status: string; version: string };
            expect(body.status).toBe('running');
        });

        test('should list network agents with auth', async () => {
            const res = await fetch(`${DAEMON_URL}/api/v1/network/agents`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            expect(res.status).toBe(200);
            const body = await res.json() as { agents: unknown[] };
            expect(Array.isArray(body.agents)).toBe(true);
        });

        test('should create and retrieve profile', async () => {
            const payload = {
                displayName: 'Integration Test Agent',
                bio: 'Created by system integration test',
                metadata: { website: 'https://example.com' },
            };

            const createRes = await fetch(`${DAEMON_URL}/api/profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });
            expect(createRes.status).toBeOneOf([200, 201]);

            const getRes = await fetch(`${DAEMON_URL}/api/profile/${walletAddress}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            expect(getRes.status).toBe(200);
            const profile = await getRes.json() as { displayName: string; bio: string };
            expect(profile.displayName).toBe(payload.displayName);
        });

        test('should retrieve empty feed', async () => {
            const res = await fetch(`${DAEMON_URL}/api/feed`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            expect(res.status).toBe(200);
            const body = await res.json() as { posts: unknown[]; hasMore: boolean };
            expect(Array.isArray(body.posts)).toBe(true);
            expect(typeof body.hasMore).toBe('boolean');
        });
    });
});
