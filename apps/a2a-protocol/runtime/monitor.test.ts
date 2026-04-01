import assert from "node:assert/strict";
import { test } from "node:test";

import {
  evaluateRelayAlerts,
  RelayAlertMonitor,
  type RelayAlertThresholds,
} from "./monitor";
import { InMemoryRelayStore } from "./store";
import type { RelayMetrics } from "./types";

test("evaluateRelayAlerts emits expected warnings", () => {
  const metrics: RelayMetrics = {
    agentsUpserted: 1,
    envelopesPublished: 10,
    envelopesDeduplicated: 10,
    envelopesDelivered: 0,
    pullRequests: 30,
    rejectedPayloads: 8,
    dbQueryCount: 100,
    dbQueryFailures: 15,
    dbAvgQueryLatencyMs: 280,
  };
  const thresholds: RelayAlertThresholds = {
    maxRejectedPayloads: 5,
    maxDedupRatio: 0.4,
    minAvgDeliveriesPerPull: 0.1,
    minPullRequestsForDeliveryCheck: 10,
    maxDbFailureRate: 0.1,
    maxDbAvgQueryLatencyMs: 200,
    minDbQueryCountForHealthCheck: 20,
  };

  const alerts = evaluateRelayAlerts(metrics, thresholds);
  assert.equal(alerts.length, 5);
  assert.deepEqual(
    alerts.map((item) => item.code).sort(),
    [
      "db_query_failure_rate_high",
      "db_query_latency_high",
      "dedup_ratio_high",
      "delivery_throughput_low",
      "rejected_payload_spike",
    ],
  );
});

test("RelayAlertMonitor captures alerts from store metrics", async () => {
  const store = new InMemoryRelayStore();
  await store.markPayloadRejected();
  await store.markPayloadRejected();
  await store.markPayloadRejected();

  const monitor = new RelayAlertMonitor(store, {
    thresholds: {
      maxRejectedPayloads: 2,
      maxDedupRatio: 1,
      minAvgDeliveriesPerPull: 0,
      minPullRequestsForDeliveryCheck: 100,
      maxDbFailureRate: 1,
      maxDbAvgQueryLatencyMs: 1000,
      minDbQueryCountForHealthCheck: 100,
    },
  });
  const snapshot = await monitor.checkNow();
  assert.equal(snapshot.alerts.length, 1);
  assert.equal(snapshot.alerts[0]?.code, "rejected_payload_spike");
});
