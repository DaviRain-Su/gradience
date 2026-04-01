import type { RelayMetrics, RelayStore } from "./types";

export interface RelayAlertThresholds {
  maxRejectedPayloads: number;
  maxDedupRatio: number;
  minAvgDeliveriesPerPull: number;
  minPullRequestsForDeliveryCheck: number;
  maxDbFailureRate: number;
  maxDbAvgQueryLatencyMs: number;
  minDbQueryCountForHealthCheck: number;
}

export interface RelayAlert {
  code:
    | "rejected_payload_spike"
    | "dedup_ratio_high"
    | "delivery_throughput_low"
    | "db_query_failure_rate_high"
    | "db_query_latency_high"
    | "test_alert";
  severity: "warning" | "critical";
  message: string;
  observed: number;
  threshold: number;
}

export const DEFAULT_RELAY_ALERT_THRESHOLDS: RelayAlertThresholds = {
  maxRejectedPayloads: 50,
  maxDedupRatio: 0.35,
  minAvgDeliveriesPerPull: 0.2,
  minPullRequestsForDeliveryCheck: 25,
  maxDbFailureRate: 0.05,
  maxDbAvgQueryLatencyMs: 200,
  minDbQueryCountForHealthCheck: 20,
};

export function evaluateRelayAlerts(
  metrics: RelayMetrics,
  thresholds: RelayAlertThresholds = DEFAULT_RELAY_ALERT_THRESHOLDS,
): RelayAlert[] {
  const alerts: RelayAlert[] = [];

  if (metrics.rejectedPayloads >= thresholds.maxRejectedPayloads) {
    alerts.push({
      code: "rejected_payload_spike",
      severity: "critical",
      message: "Rejected payload count exceeded threshold.",
      observed: metrics.rejectedPayloads,
      threshold: thresholds.maxRejectedPayloads,
    });
  }

  const totalPublishAttempts =
    metrics.envelopesPublished + metrics.envelopesDeduplicated;
  const dedupRatio =
    totalPublishAttempts === 0
      ? 0
      : metrics.envelopesDeduplicated / totalPublishAttempts;
  if (dedupRatio >= thresholds.maxDedupRatio) {
    alerts.push({
      code: "dedup_ratio_high",
      severity: "warning",
      message: "Envelope dedup ratio exceeded threshold.",
      observed: dedupRatio,
      threshold: thresholds.maxDedupRatio,
    });
  }

  if (metrics.pullRequests >= thresholds.minPullRequestsForDeliveryCheck) {
    const avgDeliveries =
      metrics.pullRequests === 0 ? 0 : metrics.envelopesDelivered / metrics.pullRequests;
    if (avgDeliveries <= thresholds.minAvgDeliveriesPerPull) {
      alerts.push({
        code: "delivery_throughput_low",
        severity: "warning",
        message: "Average envelope deliveries per pull dropped below threshold.",
        observed: avgDeliveries,
        threshold: thresholds.minAvgDeliveriesPerPull,
      });
    }
  }

  if (metrics.dbQueryCount >= thresholds.minDbQueryCountForHealthCheck) {
    const failureRate =
      metrics.dbQueryCount === 0 ? 0 : metrics.dbQueryFailures / metrics.dbQueryCount;
    if (failureRate >= thresholds.maxDbFailureRate) {
      alerts.push({
        code: "db_query_failure_rate_high",
        severity: "critical",
        message: "Database query failure rate exceeded threshold.",
        observed: failureRate,
        threshold: thresholds.maxDbFailureRate,
      });
    }
    if (metrics.dbAvgQueryLatencyMs >= thresholds.maxDbAvgQueryLatencyMs) {
      alerts.push({
        code: "db_query_latency_high",
        severity: "warning",
        message: "Database average query latency exceeded threshold.",
        observed: metrics.dbAvgQueryLatencyMs,
        threshold: thresholds.maxDbAvgQueryLatencyMs,
      });
    }
  }

  return alerts;
}

export class RelayAlertMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly store: RelayStore,
    private readonly options: {
      thresholds?: RelayAlertThresholds;
      intervalMs?: number;
      onAlerts?: (alerts: RelayAlert[], metrics: RelayMetrics) => void | Promise<void>;
    } = {},
  ) {}

  async checkNow(): Promise<{ alerts: RelayAlert[]; metrics: RelayMetrics }> {
    const metrics = await this.store.getMetrics();
    const alerts = evaluateRelayAlerts(
      metrics,
      this.options.thresholds ?? DEFAULT_RELAY_ALERT_THRESHOLDS,
    );
    return { alerts, metrics };
  }

  start(): void {
    if (this.timer) {
      return;
    }
    const intervalMs = this.options.intervalMs ?? 30_000;
    if (intervalMs <= 0) {
      return;
    }
    this.timer = setInterval(() => {
      void this.checkNow().then(({ alerts, metrics }) => {
        if (alerts.length === 0) {
          return;
        }
        if (this.options.onAlerts) {
          Promise.resolve(this.options.onAlerts(alerts, metrics)).catch((error) => {
            console.error("[a2a-relay-alert] delivery failed", error);
          });
          return;
        }
        for (const alert of alerts) {
          console.warn(
            `[a2a-relay-alert] code=${alert.code} severity=${alert.severity} observed=${String(
              alert.observed,
            )} threshold=${String(alert.threshold)}`,
          );
        }
      }).catch((error) => {
        console.error("[a2a-relay-alert] monitor tick failed", error);
      });
    }, intervalMs);
  }

  stop(): void {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = null;
  }
}
