import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { createAlertSignature, RelayAlertSink } from "./alert-sink";
import type { RelayAlert } from "./monitor";
import type { RelayMetrics } from "./types";

const metrics: RelayMetrics = {
  agentsUpserted: 1,
  envelopesPublished: 1,
  envelopesDeduplicated: 0,
  envelopesDelivered: 1,
  pullRequests: 1,
  rejectedPayloads: 0,
  dbQueryCount: 0,
  dbQueryFailures: 0,
  dbAvgQueryLatencyMs: 0,
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
  const sent: Array<{ url: string; payload: unknown; headers: Record<string, string> }> = [];
  const sink = new RelayAlertSink({
    webhookUrl: "https://example.com/webhook",
    slackWebhookUrl: "https://hooks.slack.com/services/test",
    minSeverity: "critical",
    cooldownMs: 0,
    postJson: async (url, payload, headers) => {
      sent.push({ url, payload, headers });
    },
  });

  await sink.notify([warningAlert, criticalAlert], metrics);
  assert.equal(sent.length, 2);
  assert.equal(sent[0]?.url, "https://example.com/webhook");
  assert.equal(sent[1]?.url, "https://hooks.slack.com/services/test");
});

test("relay alert sink applies cooldown per alert code", async () => {
  let clock = 1_000;
  const sent: Array<{ url: string; payload: unknown; headers: Record<string, string> }> = [];
  const sink = new RelayAlertSink({
    webhookUrl: "https://example.com/webhook",
    cooldownMs: 5_000,
    now: () => clock,
    postJson: async (url, payload, headers) => {
      sent.push({ url, payload, headers });
    },
  });

  await sink.notify([criticalAlert], metrics);
  await sink.notify([criticalAlert], metrics);
  assert.equal(sent.length, 1);

  clock += 5_001;
  await sink.notify([criticalAlert], metrics);
  assert.equal(sent.length, 2);
});

test("relay alert sink adds signature headers when signing secret configured", async () => {
  const sent: Array<{ payload: unknown; headers: Record<string, string> }> = [];
  const sink = new RelayAlertSink({
    webhookUrl: "https://example.com/webhook",
    signingSecret: "secret",
    cooldownMs: 0,
    now: () => 1234,
    postJson: async (_url, payload, headers) => {
      sent.push({ payload, headers });
    },
  });

  await sink.notify([criticalAlert], metrics);
  assert.equal(sent.length, 1);
  const headers = sent[0]?.headers ?? {};
  assert.equal(headers["x-a2a-alert-timestamp"], "1234");
  assert.equal(headers["x-a2a-alert-source"], "a2a-relay");
  const expected = createAlertSignature("secret", 1234, sent[0]?.payload);
  assert.equal(headers["x-a2a-alert-signature"], expected);
});

test("relay alert sink retries and persists failures for replay", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "a2a-alert-queue-"));
  const queuePath = join(tempDir, "failed-alerts.ndjson");
  try {
    let attempt = 0;
    const sink = new RelayAlertSink({
      webhookUrl: "https://example.com/webhook",
      failureQueueFilePath: queuePath,
      retryAttempts: 2,
      retryBaseDelayMs: 0,
      cooldownMs: 0,
      postJson: async () => {
        attempt += 1;
        throw new Error("down");
      },
    });

    await assert.rejects(() => sink.notify([criticalAlert], metrics));
    assert.equal(attempt, 2);
    const queued = readFileSync(queuePath, "utf8");
    assert.equal(queued.includes("example.com/webhook"), true);

    let replayAttempt = 0;
    const replaySink = new RelayAlertSink({
      webhookUrl: "https://example.com/webhook",
      failureQueueFilePath: queuePath,
      retryAttempts: 1,
      retryBaseDelayMs: 0,
      cooldownMs: 0,
      postJson: async () => {
        replayAttempt += 1;
      },
    });
    const result = await replaySink.drainFailureQueue();
    assert.equal(result.processed, 1);
    assert.equal(result.delivered, 1);
    assert.equal(result.remaining, 0);
    assert.equal(replayAttempt, 1);
    assert.equal(readFileSync(queuePath, "utf8"), "");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
