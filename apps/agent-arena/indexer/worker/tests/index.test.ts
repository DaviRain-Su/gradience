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

type DbCall = { query: string; values: unknown[] };

function makeSpyEnv(
    token?: string,
    options: {
        firstResult?: (query: string, values: unknown[]) => unknown | null;
        allResult?: (query: string, values: unknown[]) => unknown[];
    } = {},
): { env: Parameters<typeof worker.fetch>[1]; calls: DbCall[] } {
    const calls: DbCall[] = [];
    const env = {
        DB: {
            prepare: (query: string) => ({
                bind: (...values: unknown[]) => {
                    calls.push({ query, values });
                    return {
                        all: async () => ({ results: options.allResult?.(query, values) ?? [] }),
                        first: async () => options.firstResult?.(query, values) ?? null,
                        run: async () => ({}),
                    };
                },
            }),
        },
        WEBHOOK_AUTH_TOKEN: token,
    } as unknown as Parameters<typeof worker.fetch>[1];
    return { env, calls };
}

describe('indexer worker webhook auth', () => {
    it('rejects webhook when auth token is not configured', async () => {
        const request = new Request('https://worker.example/webhook/triton', {
            method: 'POST',
            body: JSON.stringify({}),
        });

        const response = await worker.fetch(request, makeMockEnv() as Parameters<typeof worker.fetch>[1]);
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

describe('indexer worker task query contract', () => {
    it('rejects invalid /api/tasks sort value', async () => {
        const request = new Request('https://worker.example/api/tasks?sort=created_at_desc', {
            method: 'GET',
        });
        const response = await worker.fetch(
            request,
            makeMockEnv('expected-token') as Parameters<typeof worker.fetch>[1],
        );
        const payload = (await response.json()) as { error: string };
        expect(response.status).toBe(400);
        expect(payload.error).toBe('invalid sort value: created_at_desc (expected task_id_desc|task_id_asc)');
    });

    it('accepts page alias for /api/tasks pagination', async () => {
        const { env, calls } = makeSpyEnv('expected-token');
        const request = new Request('https://worker.example/api/tasks?page=2&limit=10', {
            method: 'GET',
        });
        const response = await worker.fetch(request, env);
        expect(response.status).toBe(200);
        const payload = (await response.json()) as unknown[];
        expect(Array.isArray(payload)).toBe(true);
        const taskQuery = calls.find(entry => entry.query.includes('FROM tasks'));
        expect(taskQuery).toBeDefined();
        expect(taskQuery?.values[4]).toBe(10);
        expect(taskQuery?.values[5]).toBe(10);
    });

    it('rejects non-numeric limit for /api/tasks', async () => {
        const request = new Request('https://worker.example/api/tasks?limit=abc', {
            method: 'GET',
        });
        const response = await worker.fetch(
            request,
            makeMockEnv('expected-token') as Parameters<typeof worker.fetch>[1],
        );
        const payload = (await response.json()) as { error: string };
        expect(response.status).toBe(400);
        expect(payload.error).toBe('limit must be an integer');
    });

    it('rejects non-numeric category for /api/tasks', async () => {
        const request = new Request('https://worker.example/api/tasks?category=xyz', {
            method: 'GET',
        });
        const response = await worker.fetch(
            request,
            makeMockEnv('expected-token') as Parameters<typeof worker.fetch>[1],
        );
        const payload = (await response.json()) as { error: string };
        expect(response.status).toBe(400);
        expect(payload.error).toBe('category must be an integer');
    });

    it('uses ascending order when sort=task_id_asc', async () => {
        const { env, calls } = makeSpyEnv('expected-token');
        const request = new Request('https://worker.example/api/tasks?sort=task_id_asc', {
            method: 'GET',
        });
        const response = await worker.fetch(request, env);
        expect(response.status).toBe(200);
        const taskQuery = calls.find(entry => entry.query.includes('FROM tasks'));
        expect(taskQuery?.query).toContain('ORDER BY task_id ASC');
    });

    it('accepts submissions sort alias submission_slot_desc', async () => {
        const { env, calls } = makeSpyEnv('expected-token', {
            firstResult: query => (query.includes('SELECT task_id FROM tasks') ? { task_id: 1 } : null),
        });
        const request = new Request('https://worker.example/api/tasks/1/submissions?sort=submission_slot_desc', {
            method: 'GET',
        });
        const response = await worker.fetch(request, env);
        expect(response.status).toBe(200);
        const submissionsQuery = calls.find(entry => entry.query.includes('FROM submissions'));
        expect(submissionsQuery?.query).toContain('ORDER BY submission_slot DESC');
    });
});

describe('indexer worker task detail/submissions contract', () => {
    it('returns 400 for negative task id on /api/tasks/:id', async () => {
        const request = new Request('https://worker.example/api/tasks/-1', {
            method: 'GET',
        });
        const response = await worker.fetch(
            request,
            makeMockEnv('expected-token') as Parameters<typeof worker.fetch>[1],
        );
        const payload = (await response.json()) as { error: string };
        expect(response.status).toBe(400);
        expect(payload.error).toBe('task_id must be >= 0');
    });

    it('returns 400 for non-numeric task id on /api/tasks/:id', async () => {
        const request = new Request('https://worker.example/api/tasks/not-a-number', {
            method: 'GET',
        });
        const response = await worker.fetch(
            request,
            makeMockEnv('expected-token') as Parameters<typeof worker.fetch>[1],
        );
        const payload = (await response.json()) as { error: string };
        expect(response.status).toBe(400);
        expect(payload.error).toBe('invalid task_id');
    });

    it('returns 404 when task does not exist on /api/tasks/:id', async () => {
        const request = new Request('https://worker.example/api/tasks/999', {
            method: 'GET',
        });
        const response = await worker.fetch(
            request,
            makeMockEnv('expected-token') as Parameters<typeof worker.fetch>[1],
        );
        const payload = (await response.json()) as { error: string };
        expect(response.status).toBe(404);
        expect(payload.error).toBe('task 999 not found');
    });

    it('returns 404 when task does not exist on /api/tasks/:id/submissions', async () => {
        const request = new Request('https://worker.example/api/tasks/999/submissions', {
            method: 'GET',
        });
        const response = await worker.fetch(
            request,
            makeMockEnv('expected-token') as Parameters<typeof worker.fetch>[1],
        );
        const payload = (await response.json()) as { error: string };
        expect(response.status).toBe(404);
        expect(payload.error).toBe('task 999 not found');
    });

    it('returns 400 for invalid submissions sort', async () => {
        const request = new Request('https://worker.example/api/tasks/1/submissions?sort=invalid', {
            method: 'GET',
        });
        const response = await worker.fetch(
            request,
            makeMockEnv('expected-token') as Parameters<typeof worker.fetch>[1],
        );
        const payload = (await response.json()) as { error: string };
        expect(response.status).toBe(400);
        expect(payload.error).toBe('invalid sort value: invalid (expected score|slot)');
    });

    it('returns 400 for non-numeric task id on /api/tasks/:id/submissions', async () => {
        const request = new Request('https://worker.example/api/tasks/abc/submissions', {
            method: 'GET',
        });
        const response = await worker.fetch(
            request,
            makeMockEnv('expected-token') as Parameters<typeof worker.fetch>[1],
        );
        const payload = (await response.json()) as { error: string };
        expect(response.status).toBe(400);
        expect(payload.error).toBe('invalid task_id');
    });
});
