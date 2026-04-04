import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { AgentProfileApiClient } from './profile-api.ts';

let mockPort: number;
let mockServer: ReturnType<typeof createServer>;

before(async () => {
    mockServer = createServer(async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');

        if (req.method === 'GET' && url.pathname === '/api/agents/alice/profile') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(
                JSON.stringify({
                    profile: {
                        agent: 'alice',
                        display_name: 'Alice',
                        bio: 'DeFi strategy agent',
                        links: { website: 'https://alice.agent.im' },
                        onchain_ref: null,
                        publish_mode: 'manual',
                        updated_at: 1,
                    },
                }),
            );
            return;
        }

        if (req.method === 'GET' && url.pathname === '/api/agents/unknown/profile') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ profile: null }));
            return;
        }

        if (req.method === 'PUT' && url.pathname === '/api/agents/alice/profile') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            const payload = JSON.parse(Buffer.concat(chunks).toString()) as {
                display_name: string;
                bio: string;
            };
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(
                JSON.stringify({
                    profile: {
                        agent: 'alice',
                        display_name: payload.display_name,
                        bio: payload.bio,
                        links: {
                            github: 'https://github.com/alice',
                        },
                        onchain_ref: null,
                        publish_mode: 'manual',
                        updated_at: 2,
                    },
                }),
            );
            return;
        }

        if (req.method === 'POST' && url.pathname === '/api/agents/alice/profile/publish') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(
                JSON.stringify({
                    ok: true,
                    onchain_tx: 'sim-abc123',
                    profile: {
                        agent: 'alice',
                        display_name: 'Alice',
                        bio: 'DeFi strategy agent',
                        links: { website: 'https://alice.agent.im' },
                        onchain_ref: 'sha256:1234',
                        publish_mode: 'manual',
                        updated_at: 3,
                    },
                }),
            );
            return;
        }

        if (req.method === 'PUT' && url.pathname === '/api/agents/bad/profile') {
            res.writeHead(400, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid display_name' }));
            return;
        }

        res.writeHead(404).end();
    });

    await new Promise<void>((resolve) => {
        mockServer.listen(0, '127.0.0.1', () => {
            const addr = mockServer.address();
            mockPort = typeof addr === 'object' && addr ? addr.port : 0;
            resolve();
        });
    });
});

after(async () => {
    await new Promise<void>((resolve) => {
        mockServer.close(() => resolve());
    });
});

describe('AgentProfileApiClient', () => {
    it('getAgentProfile returns typed profile payload', async () => {
        const client = new AgentProfileApiClient(`http://127.0.0.1:${mockPort}`);
        const profile = await client.getAgentProfile('alice');
        assert.ok(profile);
        assert.equal(profile.displayName, 'Alice');
        assert.equal(profile.links.website, 'https://alice.agent.im');
    });

    it('getAgentProfile returns null when profile is missing', async () => {
        const client = new AgentProfileApiClient(`http://127.0.0.1:${mockPort}`);
        const profile = await client.getAgentProfile('unknown');
        assert.equal(profile, null);
    });

    it('upsertAgentProfile and publishProfile return normalized response', async () => {
        const client = new AgentProfileApiClient(`http://127.0.0.1:${mockPort}`);
        const updated = await client.upsertAgentProfile('alice', {
            display_name: 'Alice Updated',
            bio: 'Updated bio',
        });
        assert.equal(updated.displayName, 'Alice Updated');
        assert.equal(updated.links.github, 'https://github.com/alice');

        const published = await client.publishProfile('alice', { publish_mode: 'manual' });
        assert.equal(published.ok, true);
        assert.equal(published.onchain_tx, 'sim-abc123');
        assert.equal(published.profile.onchainRef, 'sha256:1234');
    });

    it('request errors include API error body', async () => {
        const client = new AgentProfileApiClient(`http://127.0.0.1:${mockPort}`);
        await assert.rejects(
            () =>
                client.upsertAgentProfile('bad', {
                    display_name: '',
                    bio: 'x',
                }),
            /Invalid display_name/,
        );
    });
});
