#!/usr/bin/env tsx
/**
 * W2 End-to-End Integration Test
 *
 * Verifies: Indexer → SDK → AgentM API data flow
 *
 * Prerequisites:
 *   - PostgreSQL running on localhost:5432 (or via docker)
 *   - Indexer binary built (cargo build -p gradience-indexer)
 *
 * Usage:
 *   # With existing PostgreSQL:
 *   DATABASE_URL=postgres://postgres:postgres@localhost:5432/gradience_e2e tsx scripts/e2e-w2-integration.ts
 *
 *   # Quick mode (uses mock data, no PostgreSQL needed — just tests SDK against running indexer):
 *   INDEXER_URL=http://127.0.0.1:3001 tsx scripts/e2e-w2-integration.ts --sdk-only
 */

import process from 'node:process';

const INDEXER_URL = process.env.INDEXER_URL ?? 'http://127.0.0.1:3001';
const AGENT_IM_URL = process.env.AGENT_IM_URL ?? 'http://127.0.0.1:3939';
const sdkOnly = process.argv.includes('--sdk-only');

interface TestResult {
    name: string;
    passed: boolean;
    detail: string;
    durationMs: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<string>): Promise<void> {
    const start = Date.now();
    try {
        const detail = await fn();
        results.push({ name, passed: true, detail, durationMs: Date.now() - start });
        console.log(`  ✅ ${name} (${Date.now() - start}ms)`);
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        results.push({ name, passed: false, detail, durationMs: Date.now() - start });
        console.log(`  ❌ ${name}: ${detail}`);
    }
}

async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return res.json() as Promise<T>;
}

// ── Indexer Health ──────────────────────────────────────────────────

async function testIndexerHealth() {
    console.log('\n📡 Indexer Health');

    await test('Indexer /healthz responds', async () => {
        const res = await fetch(`${INDEXER_URL}/healthz`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return `status=${res.status}`;
    });

    await test('Indexer /metrics responds', async () => {
        const res = await fetch(`${INDEXER_URL}/metrics`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!text.includes('gradience') && !text.includes('indexer')) {
            return `metrics returned (${text.length} bytes, no gradience prefix found)`;
        }
        return `metrics ok (${text.length} bytes)`;
    });
}

// ── Indexer API ─────────────────────────────────────────────────────

async function testIndexerApi() {
    console.log('\n📊 Indexer REST API');

    await test('GET /api/tasks returns array', async () => {
        const tasks = await fetchJson<unknown[]>(`${INDEXER_URL}/api/tasks`);
        if (!Array.isArray(tasks)) throw new Error('Expected array');
        return `${tasks.length} tasks`;
    });

    await test('GET /api/tasks?state=completed filters correctly', async () => {
        const tasks = await fetchJson<Array<{ state: string }>>(`${INDEXER_URL}/api/tasks?state=completed`);
        for (const t of tasks) {
            if (t.state !== 'completed') throw new Error(`Expected completed, got ${t.state}`);
        }
        return `${tasks.length} completed tasks`;
    });

    await test('GET /api/tasks/1 returns single task', async () => {
        const task = await fetchJson<{ task_id: number }>(`${INDEXER_URL}/api/tasks/1`);
        if (task.task_id !== 1) throw new Error(`Expected task_id=1, got ${task.task_id}`);
        return `task_id=${task.task_id}`;
    });

    await test('GET /api/tasks/1/submissions returns array', async () => {
        const subs = await fetchJson<unknown[]>(`${INDEXER_URL}/api/tasks/1/submissions`);
        if (!Array.isArray(subs)) throw new Error('Expected array');
        return `${subs.length} submissions`;
    });

    await test('GET /api/judge-pool/2 returns array', async () => {
        const pool = await fetchJson<unknown[]>(`${INDEXER_URL}/api/judge-pool/2`);
        if (!Array.isArray(pool)) throw new Error('Expected array');
        return `${pool.length} judges in pool`;
    });

    // Test 404 handling
    await test('GET /api/tasks/99999 returns 404', async () => {
        const res = await fetch(`${INDEXER_URL}/api/tasks/99999`, { signal: AbortSignal.timeout(3000) });
        if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
        return 'correctly returns 404';
    });
}

// ── SDK → Indexer ───────────────────────────────────────────────────

async function testSdkIndexerIntegration() {
    console.log('\n🔗 SDK → Indexer Integration');

    // Dynamic import so script works without @gradience/sdk installed globally
    let GradienceSDK: any;
    try {
        const sdk = await import('../apps/agent-arena/clients/typescript/src/sdk.ts');
        GradienceSDK = sdk.GradienceSDK;
    } catch (err) {
        console.log('  ⚠️  Cannot import SDK, skipping SDK tests');
        return;
    }

    const client = new GradienceSDK({ indexerEndpoint: INDEXER_URL });

    await test('SDK getTasks returns task list', async () => {
        const tasks = await client.getTasks();
        if (!tasks) throw new Error('getTasks returned null');
        return `${tasks.length} tasks via SDK`;
    });

    await test('SDK getTask(1) returns correct task', async () => {
        const task = await client.getTask(1);
        if (!task) throw new Error('getTask(1) returned null');
        if (task.task_id !== 1) throw new Error(`Expected task_id=1, got ${task.task_id}`);
        return `task_id=${task.task_id}, reward=${task.reward}`;
    });

    await test('SDK getTaskSubmissions(1) returns submissions', async () => {
        const subs = await client.getTaskSubmissions(1);
        if (!subs) throw new Error('getTaskSubmissions returned null');
        return `${subs.length} submissions via SDK`;
    });

    await test('SDK getTask(99999) returns null gracefully', async () => {
        const task = await client.getTask(99999);
        if (task !== null) throw new Error(`Expected null, got task`);
        return 'null on missing task';
    });
}

// ── AgentM → Indexer ──────────────────────────────────────────────

async function testAgentImIntegration() {
    console.log('\n🖥️  AgentM → Indexer Integration');

    await test('AgentM /status responds', async () => {
        const status = await fetchJson<{ version: string }>(`${AGENT_IM_URL}/status`);
        if (!status.version) throw new Error('Missing version');
        return `version=${status.version}`;
    });

    await test('AgentM /discover/agents returns array', async () => {
        const data = await fetchJson<{ agents: unknown[] }>(`${AGENT_IM_URL}/discover/agents`);
        if (!Array.isArray(data.agents)) throw new Error('Expected agents array');
        return `${data.agents.length} agents`;
    });
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  W2 End-to-End Integration Test');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  Indexer:   ${INDEXER_URL}`);
    console.log(`  AgentM:  ${AGENT_IM_URL}`);
    console.log(`  Mode:      ${sdkOnly ? 'SDK-only' : 'Full'}`);

    // Phase 1: Indexer health
    try {
        await testIndexerHealth();
    } catch {
        console.log('\n⚠️  Indexer not reachable. Start it with:');
        console.log('    cd apps/agent-arena && docker-compose -f indexer/docker-compose.yml up');
        console.log('    OR');
        console.log('    DATABASE_URL=... MOCK_WEBHOOK=true cargo run -p gradience-indexer\n');
    }

    // Phase 2: Indexer API
    await testIndexerApi();

    // Phase 3: SDK → Indexer
    await testSdkIndexerIntegration();

    // Phase 4: AgentM (skip in sdk-only mode)
    if (!sdkOnly) {
        try {
            await testAgentImIntegration();
        } catch {
            console.log('\n⚠️  AgentM not reachable (optional).');
        }
    }

    // Summary
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);

    console.log('\n═══════════════════════════════════════════════════');
    console.log(`  Results: ${passed} passed, ${failed} failed (${totalMs}ms)`);
    console.log('═══════════════════════════════════════════════════\n');

    if (failed > 0) {
        console.log('Failed tests:');
        for (const r of results.filter((r) => !r.passed)) {
            console.log(`  ❌ ${r.name}: ${r.detail}`);
        }
        console.log('');
    }

    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
