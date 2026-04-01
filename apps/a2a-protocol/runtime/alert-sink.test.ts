import assert from "node:assert/strict";
import { test } from "node:test";

import { RelayAlertSink } from "./alert-sink";
import type { RelayAlert } from "./monitor";
import type { RelayMetrics } from "./types";

const metrics: RelayMetrics = {
  agentsUpserted: 1,
  envelopesPublished: 1,
  envelopesDeduplicated: 0,
  envelopesDelivered: 1,
  pullRequests: 1,
  rejectedPayloads: 0,
};

const warningAlert: RelayAlert = {
  code: "dedup_ratio_high",
  severity: "warning",
  message: "test-warning",
  observed: 0.5,
  threshold: 0.3,
};

const criticalAlert: RelayAlert = {
  code: "rejected_payload_spike",
  severity: "critical",
  message: "test-critical",
  observed: 8,
  threshold: 4,
};

test("relay alert sink filters by severity and sends to both sinks", async () => {
  const sent: Array<{ url: string; payload: unknown }> = [];
  const sink = new RelayAlertSink({
    webhookUrl: "https://example.com/webhook",
    slackWebhookUrl: "https://hooks.slack.com/services/test",
    minSeverity: "critical",
    cooldownMs: 0,
    postJson: async (url, payload) => {
      sent.push({ url, payload });
    },
  });

  await sink.notify([warningAlert, criticalAlert], metrics);
  assert.equal(sent.length, 2);
  assert.equal(sent[0]?.url, "https://example.com/webhook");
  assert.equal(sent[1]?.url, "https://hooks.slack.com/services/test");
});

test("relay alert sink applies cooldown per alert code", async () => {
  let clock = 1_000;
  const sent: Array<{ url: string; payload: unknown }> = [];
  const sink = new RelayAlertSink({
    webhookUrl: "https://example.com/webhook",
    cooldownMs: 5_000,
    now: () => clock,
    postJson: async (url, payload) => {
      sent.push({ url, payload });
    },
  });

  await sink.notify([criticalAlert], metrics);
  await sink.notify([criticalAlert], metrics);
  assert.equal(sent.length, 1);

  clock += 5_001;
  await sink.notify([criticalAlert], metrics);
  assert.equal(sent.length, 2);
});
