import type { RelayMetrics, RelayStore } from "./types";

export interface RelayAlertThresholds {
  maxRejectedPayloads: number;
  maxDedupRatio: number;
  minAvgDeliveriesPerPull: number;
  minPullRequestsForDeliveryCheck: number;
}

export interface RelayAlert {
  code:
    | "rejected_payload_spike"
    | "dedup_ratio_high"
    | "delivery_throughput_low"
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

  checkNow(): { alerts: RelayAlert[]; metrics: RelayMetrics } {
    const metrics = this.store.getMetrics();
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
      const { alerts, metrics } = this.checkNow();
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
