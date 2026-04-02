import assert from "node:assert/strict";
import { test } from "node:test";

import {
  evaluateRelayAlerts,
  RelayAlertMonitor,
  type RelayAlertThresholds,
} from "./monitor";
import { InMemoryRelayStore } from "./store";
import type { RelayDbAlertState, RelayMetrics } from "./types";

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
    criticalDbFailureRate: 0.2,
    maxDbAvgQueryLatencyMs: 200,
    criticalDbAvgQueryLatencyMs: 400,
    minDbQueryCountForHealthCheck: 20,
    dbConsecutiveUnhealthyChecksToAlert: 2,
    dbConsecutiveHealthyChecksToRecover: 2,
    dbIncidentRepeatCooldownChecks: 3,
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
  const failureAlert = alerts.find((item) => item.code === "db_query_failure_rate_high");
  const latencyAlert = alerts.find((item) => item.code === "db_query_latency_high");
  assert.equal(failureAlert?.severity, "warning");
  assert.equal(latencyAlert?.severity, "warning");
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
      criticalDbFailureRate: 1,
      maxDbAvgQueryLatencyMs: 1000,
      criticalDbAvgQueryLatencyMs: 2000,
      minDbQueryCountForHealthCheck: 100,
      dbConsecutiveUnhealthyChecksToAlert: 2,
      dbConsecutiveHealthyChecksToRecover: 2,
      dbIncidentRepeatCooldownChecks: 3,
    },
  });
  const snapshot = await monitor.checkNow();
  assert.equal(snapshot.alerts.length, 1);
  assert.equal(snapshot.alerts[0]?.code, "rejected_payload_spike");
});

test("RelayAlertMonitor applies DB hysteresis for alert and recovery", async () => {
  let snapshotIndex = 0;
  const snapshots: RelayMetrics[] = [
    {
      agentsUpserted: 1,
      envelopesPublished: 1,
      envelopesDeduplicated: 0,
      envelopesDelivered: 1,
      pullRequests: 1,
      rejectedPayloads: 0,
      dbQueryCount: 100,
      dbQueryFailures: 30,
      dbAvgQueryLatencyMs: 800,
    },
    {
      agentsUpserted: 1,
      envelopesPublished: 1,
      envelopesDeduplicated: 0,
      envelopesDelivered: 1,
      pullRequests: 1,
      rejectedPayloads: 0,
      dbQueryCount: 101,
      dbQueryFailures: 20,
      dbAvgQueryLatencyMs: 700,
    },
    {
      agentsUpserted: 1,
      envelopesPublished: 2,
      envelopesDeduplicated: 0,
      envelopesDelivered: 2,
      pullRequests: 2,
      rejectedPayloads: 0,
      dbQueryCount: 120,
      dbQueryFailures: 1,
      dbAvgQueryLatencyMs: 90,
    },
    {
      agentsUpserted: 1,
      envelopesPublished: 2,
      envelopesDeduplicated: 0,
      envelopesDelivered: 2,
      pullRequests: 2,
      rejectedPayloads: 0,
      dbQueryCount: 121,
      dbQueryFailures: 1,
      dbAvgQueryLatencyMs: 80,
    },
  ];
  const store = {
    upsertAgent: () => {
      throw new Error("not used");
    },
    listAgents: () => {
      throw new Error("not used");
    },
    publishEnvelope: () => {
      throw new Error("not used");
    },
    pullEnvelopes: () => {
      throw new Error("not used");
    },
    markPayloadRejected: () => {
      throw new Error("not used");
    },
    getDbAlertState: async () => ({
      unhealthyStreak: 0,
      healthyStreak: 0,
      incidentActive: false,
      incidentRepeatCounter: 0,
      lastIncidentSignature: null,
    }),
    setDbAlertState: async () => {
      return;
    },
    getMetrics: async () => snapshots[Math.min(snapshotIndex++, snapshots.length - 1)]!,
  };
  const monitor = new RelayAlertMonitor(store, {
    thresholds: {
      maxRejectedPayloads: 999,
      maxDedupRatio: 1,
      minAvgDeliveriesPerPull: 0,
      minPullRequestsForDeliveryCheck: 999,
      maxDbFailureRate: 0.05,
      criticalDbFailureRate: 0.2,
      maxDbAvgQueryLatencyMs: 200,
      criticalDbAvgQueryLatencyMs: 600,
      minDbQueryCountForHealthCheck: 20,
      dbConsecutiveUnhealthyChecksToAlert: 2,
      dbConsecutiveHealthyChecksToRecover: 2,
      dbIncidentRepeatCooldownChecks: 3,
    },
  });

  const unhealthyFirst = await monitor.checkNow();
  assert.equal(
    unhealthyFirst.alerts.some((item) => item.code === "db_query_failure_rate_high"),
    false,
  );

  const unhealthySecond = await monitor.checkNow();
  assert.equal(
    unhealthySecond.alerts.some((item) => item.code === "db_query_failure_rate_high"),
    true,
  );

  const recovering = await monitor.checkNow();
  assert.equal(
    recovering.alerts.some((item) => item.code === "db_health_recovered"),
    false,
  );

  const recovered = await monitor.checkNow();
  assert.equal(
    recovered.alerts.some((item) => item.code === "db_health_recovered"),
    true,
  );
});

test("RelayAlertMonitor deduplicates repeated DB incident alerts with cooldown and emits on escalation", async () => {
  let snapshotIndex = 0;
  const snapshots: RelayMetrics[] = [
    {
      agentsUpserted: 1,
      envelopesPublished: 1,
      envelopesDeduplicated: 0,
      envelopesDelivered: 1,
      pullRequests: 1,
      rejectedPayloads: 0,
      dbQueryCount: 120,
      dbQueryFailures: 12,
      dbAvgQueryLatencyMs: 210,
    },
    {
      agentsUpserted: 1,
      envelopesPublished: 1,
      envelopesDeduplicated: 0,
      envelopesDelivered: 1,
      pullRequests: 1,
      rejectedPayloads: 0,
      dbQueryCount: 121,
      dbQueryFailures: 12,
      dbAvgQueryLatencyMs: 220,
    },
    {
      agentsUpserted: 1,
      envelopesPublished: 1,
      envelopesDeduplicated: 0,
      envelopesDelivered: 1,
      pullRequests: 1,
      rejectedPayloads: 0,
      dbQueryCount: 122,
      dbQueryFailures: 12,
      dbAvgQueryLatencyMs: 230,
    },
    {
      agentsUpserted: 1,
      envelopesPublished: 1,
      envelopesDeduplicated: 0,
      envelopesDelivered: 1,
      pullRequests: 1,
      rejectedPayloads: 0,
      dbQueryCount: 123,
      dbQueryFailures: 12,
      dbAvgQueryLatencyMs: 240,
    },
    {
      agentsUpserted: 1,
      envelopesPublished: 1,
      envelopesDeduplicated: 0,
      envelopesDelivered: 1,
      pullRequests: 1,
      rejectedPayloads: 0,
      dbQueryCount: 124,
      dbQueryFailures: 40,
      dbAvgQueryLatencyMs: 700,
    },
  ];
  const store = {
    upsertAgent: () => {
      throw new Error("not used");
    },
    listAgents: () => {
      throw new Error("not used");
    },
    publishEnvelope: () => {
      throw new Error("not used");
    },
    pullEnvelopes: () => {
      throw new Error("not used");
    },
    markPayloadRejected: () => {
      throw new Error("not used");
    },
    getDbAlertState: async () => ({
      unhealthyStreak: 0,
      healthyStreak: 0,
      incidentActive: false,
      incidentRepeatCounter: 0,
      lastIncidentSignature: null,
    }),
    setDbAlertState: async () => {
      return;
    },
    getMetrics: async () => snapshots[Math.min(snapshotIndex++, snapshots.length - 1)]!,
  };
  const monitor = new RelayAlertMonitor(store, {
    thresholds: {
      maxRejectedPayloads: 999,
      maxDedupRatio: 1,
      minAvgDeliveriesPerPull: 0,
      minPullRequestsForDeliveryCheck: 999,
      maxDbFailureRate: 0.05,
      criticalDbFailureRate: 0.2,
      maxDbAvgQueryLatencyMs: 200,
      criticalDbAvgQueryLatencyMs: 600,
      minDbQueryCountForHealthCheck: 20,
      dbConsecutiveUnhealthyChecksToAlert: 1,
      dbConsecutiveHealthyChecksToRecover: 1,
      dbIncidentRepeatCooldownChecks: 3,
    },
  });

  const first = await monitor.checkNow();
  assert.equal(
    first.alerts.some((item) => item.code === "db_query_failure_rate_high"),
    true,
  );
  const second = await monitor.checkNow();
  assert.equal(second.alerts.some((item) => item.code === "db_query_failure_rate_high"), false);
  const third = await monitor.checkNow();
  assert.equal(third.alerts.some((item) => item.code === "db_query_failure_rate_high"), false);
  const fourth = await monitor.checkNow();
  assert.equal(
    fourth.alerts.some((item) => item.code === "db_query_failure_rate_high"),
    true,
  );
  const escalated = await monitor.checkNow();
  const dbAlerts = escalated.alerts.filter(
    (item) => item.code === "db_query_failure_rate_high" || item.code === "db_query_latency_high",
  );
  assert.equal(dbAlerts.length >= 1, true);
  assert.equal(dbAlerts.some((item) => item.severity === "critical"), true);
});

test("RelayAlertMonitor keeps DB incident dedupe context after monitor restart", async () => {
  let snapshotIndex = 0;
  const snapshots: RelayMetrics[] = [
    {
      agentsUpserted: 1,
      envelopesPublished: 1,
      envelopesDeduplicated: 0,
      envelopesDelivered: 1,
      pullRequests: 1,
      rejectedPayloads: 0,
      dbQueryCount: 200,
      dbQueryFailures: 20,
      dbAvgQueryLatencyMs: 220,
    },
    {
      agentsUpserted: 1,
      envelopesPublished: 1,
      envelopesDeduplicated: 0,
      envelopesDelivered: 1,
      pullRequests: 1,
      rejectedPayloads: 0,
      dbQueryCount: 201,
      dbQueryFailures: 20,
      dbAvgQueryLatencyMs: 225,
    },
  ];
  let persistedDbState: RelayDbAlertState = {
    unhealthyStreak: 0,
    healthyStreak: 0,
    incidentActive: false,
    incidentRepeatCounter: 0,
    lastIncidentSignature: null,
  };
  const store = {
    upsertAgent: () => {
      throw new Error("not used");
    },
    listAgents: () => {
      throw new Error("not used");
    },
    publishEnvelope: () => {
      throw new Error("not used");
    },
    pullEnvelopes: () => {
      throw new Error("not used");
    },
    markPayloadRejected: () => {
      throw new Error("not used");
    },
    getMetrics: async () => snapshots[Math.min(snapshotIndex++, snapshots.length - 1)]!,
    getDbAlertState: async () => ({ ...persistedDbState }),
    setDbAlertState: async (state: RelayDbAlertState) => {
      persistedDbState = { ...state };
    },
  };
  const thresholds: RelayAlertThresholds = {
    maxRejectedPayloads: 999,
    maxDedupRatio: 1,
    minAvgDeliveriesPerPull: 0,
    minPullRequestsForDeliveryCheck: 999,
    maxDbFailureRate: 0.05,
    criticalDbFailureRate: 0.2,
    maxDbAvgQueryLatencyMs: 200,
    criticalDbAvgQueryLatencyMs: 600,
    minDbQueryCountForHealthCheck: 20,
    dbConsecutiveUnhealthyChecksToAlert: 1,
    dbConsecutiveHealthyChecksToRecover: 1,
    dbIncidentRepeatCooldownChecks: 3,
  };
  const monitorA = new RelayAlertMonitor(store, { thresholds });
  const first = await monitorA.checkNow();
  assert.equal(first.alerts.some((item) => item.code === "db_query_failure_rate_high"), true);
  assert.equal(persistedDbState.incidentActive, true);
  assert.equal(persistedDbState.incidentRepeatCounter, 0);

  const monitorB = new RelayAlertMonitor(store, { thresholds });
  const second = await monitorB.checkNow();
  assert.equal(second.alerts.some((item) => item.code === "db_query_failure_rate_high"), false);
  assert.equal(persistedDbState.incidentRepeatCounter, 1);
});

test("RelayAlertMonitor continues when db alert state persistence fails", async () => {
  const store = {
    upsertAgent: () => {
      throw new Error("not used");
    },
    listAgents: () => {
      throw new Error("not used");
    },
    publishEnvelope: () => {
      throw new Error("not used");
    },
    pullEnvelopes: () => {
      throw new Error("not used");
    },
    markPayloadRejected: () => {
      throw new Error("not used");
    },
    getMetrics: async () => ({
      agentsUpserted: 1,
      envelopesPublished: 1,
      envelopesDeduplicated: 0,
      envelopesDelivered: 1,
      pullRequests: 1,
      rejectedPayloads: 0,
      dbQueryCount: 50,
      dbQueryFailures: 15,
      dbAvgQueryLatencyMs: 250,
    }),
    getDbAlertState: async () => ({
      unhealthyStreak: 0,
      healthyStreak: 0,
      incidentActive: false,
      incidentRepeatCounter: 0,
      lastIncidentSignature: null,
    }),
    setDbAlertState: async () => {
      throw new Error("write unavailable");
    },
  };
  const monitor = new RelayAlertMonitor(store, {
    thresholds: {
      maxRejectedPayloads: 999,
      maxDedupRatio: 1,
      minAvgDeliveriesPerPull: 0,
      minPullRequestsForDeliveryCheck: 999,
      maxDbFailureRate: 0.1,
      criticalDbFailureRate: 0.2,
      maxDbAvgQueryLatencyMs: 400,
      criticalDbAvgQueryLatencyMs: 900,
      minDbQueryCountForHealthCheck: 20,
      dbConsecutiveUnhealthyChecksToAlert: 1,
      dbConsecutiveHealthyChecksToRecover: 1,
      dbIncidentRepeatCooldownChecks: 3,
    },
  });

  const snapshot = await monitor.checkNow();
  assert.equal(
    snapshot.alerts.some((item) => item.code === "db_query_failure_rate_high"),
    true,
  );
});
