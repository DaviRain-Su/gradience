import type { EventEnvelope } from './types.js';
import type { ListenerMode } from './daemon.js';

export interface JudgeDaemonObservabilitySnapshot {
    uptimeSeconds: number;
    mode: ListenerMode | null;
    eventsProcessedTotal: number;
    sourceErrorsTotal: number;
    workflowsQueuedTotal: number;
    pendingWorkflows: number;
    lastEventSlot: number;
    lastEventTimestamp: number;
}

export interface JudgeDaemonMetricsTracker {
    recordEvent(event: EventEnvelope): void;
    recordSourceError(): void;
    recordWorkflowQueued(): void;
    setMode(mode: ListenerMode): void;
    snapshot(pendingWorkflows: number): JudgeDaemonObservabilitySnapshot;
}

export function createMetricsTracker(): JudgeDaemonMetricsTracker {
    const startedAt = Date.now();
    let mode: ListenerMode | null = null;
    let eventsProcessedTotal = 0;
    let sourceErrorsTotal = 0;
    let workflowsQueuedTotal = 0;
    let lastEventSlot = 0;
    let lastEventTimestamp = 0;

    return {
        recordEvent(event: EventEnvelope): void {
            eventsProcessedTotal += 1;
            lastEventSlot = event.slot;
            lastEventTimestamp = event.timestamp;
        },
        recordSourceError(): void {
            sourceErrorsTotal += 1;
        },
        recordWorkflowQueued(): void {
            workflowsQueuedTotal += 1;
        },
        setMode(nextMode: ListenerMode): void {
            mode = nextMode;
        },
        snapshot(pendingWorkflows: number): JudgeDaemonObservabilitySnapshot {
            return {
                uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
                mode,
                eventsProcessedTotal,
                sourceErrorsTotal,
                workflowsQueuedTotal,
                pendingWorkflows,
                lastEventSlot,
                lastEventTimestamp,
            };
        },
    };
}

export function renderPrometheusMetrics(snapshot: JudgeDaemonObservabilitySnapshot): string {
    const modeValue = snapshot.mode ?? 'none';
    return (
        '# HELP gradience_judge_daemon_uptime_seconds Judge daemon process uptime in seconds\n' +
        '# TYPE gradience_judge_daemon_uptime_seconds gauge\n' +
        `gradience_judge_daemon_uptime_seconds ${snapshot.uptimeSeconds}\n` +
        '# HELP gradience_judge_daemon_events_processed_total Number of consumed source events\n' +
        '# TYPE gradience_judge_daemon_events_processed_total counter\n' +
        `gradience_judge_daemon_events_processed_total ${snapshot.eventsProcessedTotal}\n` +
        '# HELP gradience_judge_daemon_source_errors_total Number of source errors\n' +
        '# TYPE gradience_judge_daemon_source_errors_total counter\n' +
        `gradience_judge_daemon_source_errors_total ${snapshot.sourceErrorsTotal}\n` +
        '# HELP gradience_judge_daemon_workflows_queued_total Number of queued workflows\n' +
        '# TYPE gradience_judge_daemon_workflows_queued_total counter\n' +
        `gradience_judge_daemon_workflows_queued_total ${snapshot.workflowsQueuedTotal}\n` +
        '# HELP gradience_judge_daemon_pending_workflows Pending workflow count\n' +
        '# TYPE gradience_judge_daemon_pending_workflows gauge\n' +
        `gradience_judge_daemon_pending_workflows ${snapshot.pendingWorkflows}\n` +
        '# HELP gradience_judge_daemon_last_event_slot Last observed source event slot\n' +
        '# TYPE gradience_judge_daemon_last_event_slot gauge\n' +
        `gradience_judge_daemon_last_event_slot ${snapshot.lastEventSlot}\n` +
        '# HELP gradience_judge_daemon_last_event_timestamp_unix Last observed source event timestamp\n' +
        '# TYPE gradience_judge_daemon_last_event_timestamp_unix gauge\n' +
        `gradience_judge_daemon_last_event_timestamp_unix ${snapshot.lastEventTimestamp}\n` +
        '# HELP gradience_judge_daemon_mode_info Active source mode\n' +
        '# TYPE gradience_judge_daemon_mode_info gauge\n' +
        `gradience_judge_daemon_mode_info{mode="${modeValue}"} 1\n`
    );
}
