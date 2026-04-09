import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Daemon } from '../../src/daemon.js';
import { loadConfig } from '../../src/config.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

describe('Social API E2E', () => {
    let daemon: Daemon;
    let daemonToken: string;
    let sessionToken: string;
    let walletAddress: string;
    let tmpDir: string;
    const port = 18000 + Math.floor(Math.random() * 1000);

    beforeAll(async () => {
        tmpDir = mkdtempSync(join(tmpdir(), 'agentd-social-e2e-'));
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

        // Create a wallet keypair and get a session token via challenge/verify
        const kp = nacl.sign.keyPair();
        walletAddress = bs58.encode(kp.publicKey);

        const challengeRes = await fetch(apiUrl('/api/v1/auth/challenge'), { method: 'POST' });
        const { challenge, message } = (await challengeRes.json()) as { challenge: string; message: string };

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
        const session = (await verifyRes.json()) as { token: string };
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

    // ── Profile ──

    describe('Profile', () => {
        it('should return default profile for unknown address', async () => {
            const res = await get('/api/profile/UnknownAddr123');
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.address).toBe('UnknownAddr123');
            expect(body.displayName).toContain('Agent');
            expect(body.followers).toBe(0);
        });

        it('should create/update profile', async () => {
            const res = await post('/api/profile', {
                displayName: 'TestAgent',
                bio: 'E2E test agent',
                avatar: 'https://example.com/avatar.png',
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.success).toBe(true);
        });

        it('should retrieve created profile', async () => {
            const res = await get(`/api/profile/${walletAddress}`);
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.displayName).toBe('TestAgent');
            expect(body.bio).toBe('E2E test agent');
            expect(body.avatar).toBe('https://example.com/avatar.png');
        });

        it('should reject profile update without auth', async () => {
            const res = await fetch(apiUrl('/api/profile'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayName: 'Hacker' }),
            });
            expect(res.status).toBe(401);
        });
    });

    // ── Feed / Posts ──

    describe('Feed & Posts', () => {
        let postId: string;

        it('should return empty feed initially', async () => {
            const res = await get('/api/feed');
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.posts).toEqual([]);
            expect(body.hasMore).toBe(false);
        });

        it('should create a post', async () => {
            const res = await post('/api/posts', {
                content: 'Hello from E2E test!',
                media: [{ type: 'image', url: 'https://example.com/img.png' }],
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.success).toBe(true);
            expect(body.id).toBeTruthy();
            postId = body.id;
        });

        it('should reject post without content', async () => {
            const res = await post('/api/posts', { content: '' });
            expect(res.status).toBe(400);
        });

        it('should reject post without auth', async () => {
            const res = await fetch(apiUrl('/api/posts'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: 'no auth' }),
            });
            expect(res.status).toBe(401);
        });

        it('should appear in feed', async () => {
            const res = await get('/api/feed');
            const body = (await res.json()) as any;
            expect(body.posts.length).toBe(1);
            expect(body.posts[0].id).toBe(postId);
            expect(body.posts[0].content).toBe('Hello from E2E test!');
            expect(body.posts[0].authorAddress).toBe(walletAddress);
            expect(body.posts[0].authorName).toBe('TestAgent');
        });

        it('should get post by id', async () => {
            const res = await get(`/api/posts/${postId}`);
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.content).toBe('Hello from E2E test!');
            expect(body.media).toHaveLength(1);
        });

        it('should return 404 for unknown post', async () => {
            const res = await get('/api/posts/nonexistent');
            expect(res.status).toBe(404);
        });

        it('should like and unlike a post', async () => {
            // Like
            const likeRes = await post(`/api/posts/${postId}/like`, {});
            expect(likeRes.status).toBe(200);
            const likeBody = (await likeRes.json()) as any;
            expect(likeBody.liked).toBe(true);

            // Verify like count
            let postRes = await get(`/api/posts/${postId}`);
            let postBody = (await postRes.json()) as any;
            expect(postBody.likes).toBe(1);

            // Unlike (toggle)
            const unlikeRes = await post(`/api/posts/${postId}/like`, {});
            const unlikeBody = (await unlikeRes.json()) as any;
            expect(unlikeBody.liked).toBe(false);

            postRes = await get(`/api/posts/${postId}`);
            postBody = (await postRes.json()) as any;
            expect(postBody.likes).toBe(0);
        });

        it('should paginate feed', async () => {
            // Create 3 more posts
            for (let i = 0; i < 3; i++) {
                await post('/api/posts', { content: `Post #${i + 2}` });
            }

            const page1 = await get('/api/feed?limit=2&page=1');
            const body1 = (await page1.json()) as any;
            expect(body1.posts.length).toBe(2);
            expect(body1.hasMore).toBe(true);

            const page2 = await get('/api/feed?limit=2&page=2');
            const body2 = (await page2.json()) as any;
            expect(body2.posts.length).toBe(2);
            expect(body2.hasMore).toBe(false);
        });
    });

    // ── Follows ──

    describe('Following', () => {
        const targetAddress = 'TargetAgent111111111111111111111111111111111';
        const targetAddress2 = 'TargetAgent222222222222222222222222222222222';

        it('should follow a target', async () => {
            const res = await post('/api/follow', { targetAddress });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.success).toBe(true);
        });

        it('should reject following without auth', async () => {
            const res = await fetch(apiUrl('/api/follow'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetAddress }),
            });
            expect(res.status).toBe(401);
        });

        it('should reject following yourself', async () => {
            const res = await post('/api/follow', { targetAddress: walletAddress });
            expect(res.status).toBe(400);
        });

        it('should reject follow without targetAddress', async () => {
            const res = await post('/api/follow', {});
            expect(res.status).toBe(400);
        });

        it('should list following', async () => {
            await post('/api/follow', { targetAddress: targetAddress2 });

            const res = await get(`/api/following/${walletAddress}`);
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.following.length).toBe(2);
            const addresses = body.following.map((f: any) => f.address);
            expect(addresses).toContain(targetAddress);
            expect(addresses).toContain(targetAddress2);
        });

        it('should list followers', async () => {
            const res = await get(`/api/followers/${targetAddress}`);
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.followers.length).toBe(1);
            expect(body.followers[0].address).toBe(walletAddress);
        });

        it('should update profile follower counts', async () => {
            const res = await get(`/api/profile/${walletAddress}`);
            const body = (await res.json()) as any;
            expect(body.following).toBe(2);
        });

        it('should unfollow', async () => {
            const res = await post('/api/unfollow', { targetAddress });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.success).toBe(true);

            const followingRes = await get(`/api/following/${walletAddress}`);
            const followingBody = (await followingRes.json()) as any;
            expect(followingBody.following.length).toBe(1);
        });
    });
});
