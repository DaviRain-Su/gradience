import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Daemon } from '../../src/daemon.js';
import { loadConfig } from '../../src/config.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

describe('Session Auth (Wallet Connect) E2E', () => {
    let daemon: Daemon;
    let daemonToken: string;
    let tmpDir: string;
    const port = 19000 + Math.floor(Math.random() * 1000);

    beforeAll(async () => {
        tmpDir = mkdtempSync(join(tmpdir(), 'agentd-auth-e2e-'));
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
    });

    afterAll(async () => {
        await daemon.stop();
        rmSync(tmpDir, { recursive: true, force: true });
    });

    function apiUrl(path: string): string {
        return `http://127.0.0.1:${port}${path}`;
    }

    // u2500u2500 Challenge Endpoint u2500u2500

    describe('POST /api/v1/auth/challenge', () => {
        it('should return challenge without auth (public endpoint)', async () => {
            const res = await fetch(apiUrl('/api/v1/auth/challenge'), { method: 'POST' });
            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.challenge).toBeTruthy();
            expect(body.message).toContain('Sign in to Gradience');
            expect(body.message).toContain(body.challenge);
            expect(body.expiresAt).toBeGreaterThan(Date.now());
        });

        it('should return unique challenges each time', async () => {
            const res1 = await fetch(apiUrl('/api/v1/auth/challenge'), { method: 'POST' });
            const res2 = await fetch(apiUrl('/api/v1/auth/challenge'), { method: 'POST' });
            const body1 = await res1.json() as any;
            const body2 = await res2.json() as any;
            expect(body1.challenge).not.toBe(body2.challenge);
        });
    });

    // u2500u2500 Full Auth Flow u2500u2500

    describe('Full wallet sign-in flow', () => {
        let kp: nacl.SignKeyPair;
        let walletAddress: string;
        let sessionToken: string;

        beforeAll(() => {
            kp = nacl.sign.keyPair();
            walletAddress = bs58.encode(kp.publicKey);
        });

        it('step 1: get challenge', async () => {
            const res = await fetch(apiUrl('/api/v1/auth/challenge'), { method: 'POST' });
            expect(res.status).toBe(200);
        });

        it('step 2: sign challenge and verify -> get session token', async () => {
            const challengeRes = await fetch(apiUrl('/api/v1/auth/challenge'), { method: 'POST' });
            const { challenge, message } = await challengeRes.json() as any;

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
            expect(verifyRes.status).toBe(200);
            const body = await verifyRes.json() as any;
            expect(body.token).toBeTruthy();
            expect(body.walletAddress).toBe(walletAddress);
            expect(body.expiresAt).toBeGreaterThan(Date.now());
            sessionToken = body.token;
        });

        it('step 3: use session token to access protected endpoints', async () => {
            const res = await fetch(apiUrl('/api/v1/status'), {
                headers: { Authorization: `Bearer ${sessionToken}` },
            });
            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.status).toBe('running');
        });

        it('step 4: /auth/me returns wallet address', async () => {
            const res = await fetch(apiUrl('/api/v1/auth/me'), {
                headers: { Authorization: `Bearer ${sessionToken}` },
            });
            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.walletAddress).toBe(walletAddress);
        });

        it('step 5: logout revokes session', async () => {
            const logoutRes = await fetch(apiUrl('/api/v1/auth/logout'), {
                method: 'POST',
                headers: { Authorization: `Bearer ${sessionToken}` },
            });
            expect(logoutRes.status).toBe(200);

            // Session should now be invalid
            const meRes = await fetch(apiUrl('/api/v1/auth/me'), {
                headers: { Authorization: `Bearer ${sessionToken}` },
            });
            expect(meRes.status).toBe(401);
        });
    });

    // u2500u2500 Error Cases u2500u2500

    describe('Auth error handling', () => {
        it('should reject verify with missing fields', async () => {
            const res = await fetch(apiUrl('/api/v1/auth/verify'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: 'abc' }),
            });
            expect(res.status).toBe(400);
        });

        it('should reject verify with wrong signature', async () => {
            const kp = nacl.sign.keyPair();
            const address = bs58.encode(kp.publicKey);

            const challengeRes = await fetch(apiUrl('/api/v1/auth/challenge'), { method: 'POST' });
            const { challenge } = await challengeRes.json() as any;

            // Sign with wrong message
            const wrongSig = nacl.sign.detached(Buffer.from('wrong message', 'utf-8'), kp.secretKey);

            const res = await fetch(apiUrl('/api/v1/auth/verify'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: address,
                    challenge,
                    signature: Buffer.from(wrongSig).toString('base64'),
                }),
            });
            expect(res.status).toBe(401);
            const body = await res.json() as any;
            expect(body.error).toBe('AUTH_FAILED');
        });

        it('should reject verify with expired/invalid challenge', async () => {
            const kp = nacl.sign.keyPair();
            const address = bs58.encode(kp.publicKey);
            const fakeChallenge = 'nonexistent-challenge';
            const message = `Sign in to Gradience\nChallenge: ${fakeChallenge}`;
            const sig = nacl.sign.detached(Buffer.from(message, 'utf-8'), kp.secretKey);

            const res = await fetch(apiUrl('/api/v1/auth/verify'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: address,
                    challenge: fakeChallenge,
                    signature: Buffer.from(sig).toString('base64'),
                }),
            });
            expect(res.status).toBe(401);
        });

        it('should reject challenge replay (same challenge used twice)', async () => {
            const kp = nacl.sign.keyPair();
            const address = bs58.encode(kp.publicKey);

            const challengeRes = await fetch(apiUrl('/api/v1/auth/challenge'), { method: 'POST' });
            const { challenge, message } = await challengeRes.json() as any;
            const sig = nacl.sign.detached(Buffer.from(message, 'utf-8'), kp.secretKey);
            const sigB64 = Buffer.from(sig).toString('base64');

            // First use: should succeed
            const res1 = await fetch(apiUrl('/api/v1/auth/verify'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: address, challenge, signature: sigB64 }),
            });
            expect(res1.status).toBe(200);

            // Replay: should fail
            const res2 = await fetch(apiUrl('/api/v1/auth/verify'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: address, challenge, signature: sigB64 }),
            });
            expect(res2.status).toBe(401);
        });

        it('should reject invalid wallet address format', async () => {
            const challengeRes = await fetch(apiUrl('/api/v1/auth/challenge'), { method: 'POST' });
            const { challenge, message } = await challengeRes.json() as any;

            const kp = nacl.sign.keyPair();
            const sig = nacl.sign.detached(Buffer.from(message, 'utf-8'), kp.secretKey);

            const res = await fetch(apiUrl('/api/v1/auth/verify'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: 'not-valid-base58!!!',
                    challenge,
                    signature: Buffer.from(sig).toString('base64'),
                }),
            });
            expect(res.status).toBe(401);
        });
    });

    // u2500u2500 Daemon Token vs Session Token u2500u2500

    describe('Dual auth: daemon token + session token', () => {
        it('daemon token still works for all endpoints', async () => {
            const res = await fetch(apiUrl('/api/v1/status'), {
                headers: { Authorization: `Bearer ${daemonToken}` },
            });
            expect(res.status).toBe(200);
        });

        it('random token is rejected', async () => {
            const res = await fetch(apiUrl('/api/v1/status'), {
                headers: { Authorization: 'Bearer random-garbage-token' },
            });
            expect(res.status).toBe(401);
        });

        it('no auth header is rejected on protected routes', async () => {
            const res = await fetch(apiUrl('/api/v1/status'));
            expect(res.status).toBe(401);
        });
    });
});
