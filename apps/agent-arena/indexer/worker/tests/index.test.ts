import { describe, expect, it } from 'bun:test';

import worker from '../src/index';

function makeMockEnv(token?: string): Record<string, unknown> {
    return {
        DB: {
            prepare: () => ({
                bind: () => ({
                    all: async () => ({ results: [] }),
                    first: async () => null,
                    run: async () => ({}),
                }),
            }),
        },
        WEBHOOK_AUTH_TOKEN: token,
    };
}

describe('indexer worker webhook auth', () => {
    it('rejects webhook when auth token is not configured', async () => {
        const request = new Request('https://worker.example/webhook/triton', {
            method: 'POST',
            body: JSON.stringify({}),
        });

        const response = await worker.fetch(
            request,
            makeMockEnv() as Parameters<typeof worker.fetch>[1],
        );
        const payload = (await response.json()) as { error: string };

        expect(response.status).toBe(503);
        expect(payload.error).toBe('webhook auth not configured');
        expect(response.headers.get('access-control-allow-origin')).toBe('*');
    });

    it('rejects webhook with invalid bearer token', async () => {
        const request = new Request('https://worker.example/webhook/events', {
            method: 'POST',
            headers: { authorization: 'Bearer wrong-token' },
            body: JSON.stringify({}),
        });

        const response = await worker.fetch(
            request,
            makeMockEnv('expected-token') as Parameters<typeof worker.fetch>[1],
        );
        const payload = (await response.json()) as { error: string };

        expect(response.status).toBe(401);
        expect(payload.error).toBe('invalid webhook authorization');
    });
});

describe('indexer worker internal error sanitization', () => {
    it('returns generic internal error body for webhook parser failures', async () => {
        const request = new Request('https://worker.example/webhook/helius', {
            method: 'POST',
            headers: { authorization: 'Bearer expected-token' },
            body: JSON.stringify({ unsupported: true }),
        });

        const response = await worker.fetch(
            request,
            makeMockEnv('expected-token') as Parameters<typeof worker.fetch>[1],
        );
        const payload = (await response.json()) as { error: string };

        expect(response.status).toBe(500);
        expect(payload.error).toBe('internal error');
    });
});

describe('indexer worker CORS preflight', () => {
    it('responds to OPTIONS with CORS headers', async () => {
        const request = new Request('https://worker.example/api/tasks', {
            method: 'OPTIONS',
        });
        const response = await worker.fetch(
            request,
            makeMockEnv('expected-token') as Parameters<typeof worker.fetch>[1],
        );

        expect(response.status).toBe(204);
        expect(response.headers.get('access-control-allow-origin')).toBe('*');
        expect(response.headers.get('access-control-allow-methods')).toContain('GET');
        expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    });
});
