import assert from "node:assert/strict";
import { createServer } from "node:http";
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

async function startWebhookReceiver(): Promise<{
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
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ ok: true }));
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
