import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';

import { evaluateAlertGate, parsePrometheusMetrics, runAlertGate, type AlertGateSnapshot } from './t69-alert-gate.ts';

test('parsePrometheusMetrics parses gauge and labeled metrics', () => {
    const metrics = parsePrometheusMetrics(
        `
        # HELP sample comment
        gradience_indexer_events_processed_total 12
        gradience_judge_daemon_mode_info{mode="triton"} 1
        `,
    );
    assert.equal(metrics.get('gradience_indexer_events_processed_total'), 12);
    assert.equal(metrics.get('gradience_judge_daemon_mode_info{mode="triton"}'), 1);
});

test('evaluateAlertGate fails on threshold breaches', () => {
    const snapshot: AlertGateSnapshot = {
        evaluatedAt: 2_000,
        indexer: {
            healthOk: true,
            eventsProcessedTotal: 3,
            lastEventTimestamp: 1_000,
        },
        judgeDaemon: {
            healthOk: true,
            mode: 'triton',
            pendingWorkflows: 12,
            sourceErrorsTotal: 2,
            lastEventTimestamp: 1_000,
        },
    };
    const failures = evaluateAlertGate(snapshot, {
        indexerHealthUrl: '',
        indexerMetricsUrl: '',
        judgeHealthUrl: '',
        judgeMetricsUrl: '',
        maxPendingWorkflows: 10,
        maxSourceErrors: 1,
        maxEventStalenessSeconds: 500,
        requireEventActivity: true,
    });
    assert.ok(failures.some(item => item.includes('pending workflows too high')));
    assert.ok(failures.some(item => item.includes('source errors too high')));
    assert.ok(failures.some(item => item.includes('event timestamp stale')));
});

test('runAlertGate succeeds with healthy mock endpoints', async () => {
    const server = createServer((req, res) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        if (url.pathname === '/indexer/healthz') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
        }
        if (url.pathname === '/judge/healthz') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
        }
        if (url.pathname === '/indexer/metrics') {
            res.writeHead(200, { 'content-type': 'text/plain' });
            res.end(
                [
                    'gradience_indexer_events_processed_total 5',
                    `gradience_indexer_last_event_timestamp_unix ${Math.floor(Date.now() / 1000)}`,
                ].join('\n'),
            );
            return;
        }
        if (url.pathname === '/judge/metrics') {
            res.writeHead(200, { 'content-type': 'text/plain' });
            res.end(
                [
                    'gradience_judge_daemon_pending_workflows 0',
                    'gradience_judge_daemon_source_errors_total 0',
                    `gradience_judge_daemon_last_event_timestamp_unix ${Math.floor(Date.now() / 1000)}`,
                    'gradience_judge_daemon_mode_info{mode="triton"} 1',
                ].join('\n'),
            );
            return;
        }
        res.writeHead(404).end();
    });

    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;

    try {
        const result = await runAlertGate({
            indexerHealthUrl: `${base}/indexer/healthz`,
            indexerMetricsUrl: `${base}/indexer/metrics`,
            judgeHealthUrl: `${base}/judge/healthz`,
            judgeMetricsUrl: `${base}/judge/metrics`,
            maxPendingWorkflows: 5,
            maxSourceErrors: 1,
            maxEventStalenessSeconds: 120,
            requireEventActivity: true,
        });
        assert.equal(result.failures.length, 0);
        assert.equal(result.snapshot.judgeDaemon.mode, 'triton');
    } finally {
        server.close();
    }
});
