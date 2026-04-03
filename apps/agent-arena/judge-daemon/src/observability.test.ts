import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createMetricsTracker, renderPrometheusMetrics } from './observability.js';

test('metrics tracker snapshot and prometheus rendering', () => {
    const tracker = createMetricsTracker();
    tracker.setMode('triton');
    tracker.recordEvent({
        slot: 12,
        timestamp: 1_710_000_000,
        event: { event: 'task_created', task_id: 7 },
    });
    tracker.recordSourceError();
    tracker.recordWorkflowQueued();

    const snapshot = tracker.snapshot(2);
    assert.equal(snapshot.mode, 'triton');
    assert.equal(snapshot.eventsProcessedTotal, 1);
    assert.equal(snapshot.sourceErrorsTotal, 1);
    assert.equal(snapshot.workflowsQueuedTotal, 1);
    assert.equal(snapshot.pendingWorkflows, 2);

    const metrics = renderPrometheusMetrics(snapshot);
    assert.match(metrics, /gradience_judge_daemon_events_processed_total 1/);
    assert.match(metrics, /gradience_judge_daemon_mode_info\{mode="triton"\} 1/);
});
