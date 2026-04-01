import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { startRelayServer } from "./server";

test("relay dispatches test alert to webhook sink", async () => {
  const receiver = await startWebhookReceiver();
  const relay = await startRelayServer({
    host: "127.0.0.1",
    port: 0,
    authToken: "token",
    alertWebhookUrl: receiver.url,
    alertIntervalMs: 0,
    alertDispatchCooldownMs: 0,
  });
  try {
    const response = await fetch(`${relay.baseUrl}/v1/alerts/test`, {
      method: "POST",
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        severity: "critical",
        message: "integration-drill",
      }),
    });
    assert.equal(response.status, 202);
    await waitFor(() => receiver.requests.length >= 1);
    const payload = receiver.requests[0] as {
      alerts: Array<{ code: string; message: string }>;
    };
    assert.equal(payload.alerts[0]?.code, "test_alert");
    assert.equal(payload.alerts[0]?.message, "integration-drill");
  } finally {
    await relay.close();
    await receiver.close();
  }
});

test("relay monitor dispatches threshold alerts to webhook sink", async () => {
  const receiver = await startWebhookReceiver();
  const relay = await startRelayServer({
    host: "127.0.0.1",
    port: 0,
    alertWebhookUrl: receiver.url,
    alertDispatchCooldownMs: 0,
    alertIntervalMs: 20,
    alertThresholds: {
      maxRejectedPayloads: 1,
      maxDedupRatio: 1,
      minAvgDeliveriesPerPull: 0,
      minPullRequestsForDeliveryCheck: 9999,
      maxDbFailureRate: 1,
      maxDbAvgQueryLatencyMs: 10_000,
      minDbQueryCountForHealthCheck: 9999,
    },
  });
  try {
    const invalid = await fetch(`${relay.baseUrl}/v1/envelopes/publish`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });
    assert.equal(invalid.status, 400);

    await waitFor(() =>
      receiver.requests.some((item) =>
        Array.isArray((item as { alerts?: unknown }).alerts) &&
        (item as { alerts: Array<{ code: string }> }).alerts.some(
          (alert) => alert.code === "rejected_payload_spike",
        ),
      ),
    );
  } finally {
    await relay.close();
    await receiver.close();
  }
});

test("relay replays failed alert queue through authenticated endpoint", async () => {
  const queueDir = mkdtempSync(join(tmpdir(), "a2a-alert-replay-"));
  const queuePath = join(queueDir, "alert-failures.ndjson");
  try {
    let online = false;
    const receiver = await startWebhookReceiver({
      shouldFail: () => !online,
    });
    const relay = await startRelayServer({
      host: "127.0.0.1",
      port: 0,
      authToken: "token",
      alertWebhookUrl: receiver.url,
      alertRetryAttempts: 1,
      alertRetryBaseDelayMs: 0,
      alertDispatchCooldownMs: 0,
      alertFailureQueueFilePath: queuePath,
      alertIntervalMs: 0,
    });
    try {
      const initial = await fetch(`${relay.baseUrl}/v1/alerts/test`, {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: "queue-me",
        }),
      });
      assert.equal(initial.status, 500);

      online = true;
      const replay = await fetch(`${relay.baseUrl}/v1/alerts/replay-failed`, {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          maxItems: 10,
        }),
      });
      assert.equal(replay.status, 200);
      const replayBody = (await replay.json()) as {
        ok: boolean;
        result: { processed: number; delivered: number; remaining: number };
      };
      assert.equal(replayBody.ok, true);
      assert.equal(replayBody.result.processed, 1);
      assert.equal(replayBody.result.delivered, 1);
      assert.equal(replayBody.result.remaining, 0);
    } finally {
      await relay.close();
      await receiver.close();
    }
  } finally {
    rmSync(queueDir, { recursive: true, force: true });
  }
});

async function startWebhookReceiver(options: {
  shouldFail?: () => boolean;
} = {}): Promise<{
  url: string;
  requests: unknown[];
  close: () => Promise<void>;
}> {
  return startWebhookReceiverWithOptions(options);
}

async function startWebhookReceiverWithOptions(options: {
  shouldFail?: () => boolean;
}): Promise<{
  url: string;
  requests: unknown[];
  close: () => Promise<void>;
}> {
  const requests: unknown[] = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += String(chunk);
    });
    request.on("end", () => {
      try {
        requests.push(JSON.parse(body));
      } catch {
        requests.push(body);
      }
      if (options.shouldFail?.()) {
        response.statusCode = 500;
        response.end(JSON.stringify({ ok: false }));
      } else {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ ok: true }));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    url: `http://127.0.0.1:${String(port)}/alerts`,
    requests,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error?: unknown) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

async function waitFor(check: () => boolean, timeoutMs = 2000): Promise<void> {
  const startedAt = Date.now();
  for (;;) {
    if (check()) {
      return;
    }
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("timeout waiting for condition");
    }
    await sleep(25);
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}
