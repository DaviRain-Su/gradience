import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { startRelayServer } from "./server";

test("relay server exposes health and relay endpoints", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "a2a-relay-server-"));
  try {
    const server = await startRelayServer({
      host: "127.0.0.1",
      port: 0,
      authToken: "token",
      storeMode: "file",
      storeFilePath: join(tempDir, "relay.json"),
      alertIntervalMs: 0,
    });
    try {
      const health = await fetch(`${server.baseUrl}/healthz`);
      assert.equal(health.status, 200);
      const healthBody = (await health.json()) as { ok: boolean };
      assert.equal(healthBody.ok, true);

      const publish = await fetch(`${server.baseUrl}/v1/envelopes/publish`, {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          envelope: {
            id: "1:1",
            threadId: "1",
            sequence: 1,
            from: "agent-a",
            to: "agent-b",
            messageType: "invite",
            nonce: "1",
            createdAt: 1,
            bodyHash: "a".repeat(64),
            signature: { r: "b".repeat(64), s: "c".repeat(64) },
            paymentMicrolamports: "100",
          },
          payload: { hello: "world" },
        }),
      });
      assert.equal(publish.status, 202);

      const pull = await fetch(
        `${server.baseUrl}/v1/envelopes/pull?agent=agent-b&limit=1`,
        {
          headers: {
            authorization: "Bearer token",
          },
        },
      );
      assert.equal(pull.status, 200);
      const pullBody = (await pull.json()) as {
        items: Array<{ envelope: { id: string; threadId: string } }>;
      };
      assert.equal(pullBody.items.length, 1);
      assert.equal(pullBody.items[0]?.envelope.id, "1:1");
      assert.equal(pullBody.items[0]?.envelope.threadId, "1");

      const alerts = await fetch(`${server.baseUrl}/v1/alerts`);
      assert.equal(alerts.status, 401);

      const drillUnauthorized = await fetch(`${server.baseUrl}/v1/alerts/test`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ severity: "critical" }),
      });
      assert.equal(drillUnauthorized.status, 401);

      const drill = await fetch(`${server.baseUrl}/v1/alerts/test`, {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          severity: "warning",
          message: "drill",
          observed: 2,
          threshold: 1,
        }),
      });
      assert.equal(drill.status, 202);
      const drillBody = (await drill.json()) as {
        accepted: boolean;
        dispatched: boolean;
        alert: { code: string; severity: string; message: string };
      };
      assert.equal(drillBody.accepted, true);
      assert.equal(drillBody.dispatched, false);
      assert.equal(drillBody.alert.code, "test_alert");
      assert.equal(drillBody.alert.severity, "warning");
      assert.equal(drillBody.alert.message, "drill");

      const replayUnauthorized = await fetch(
        `${server.baseUrl}/v1/alerts/replay-failed`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ maxItems: 50 }),
        },
      );
      assert.equal(replayUnauthorized.status, 401);

      const replay = await fetch(`${server.baseUrl}/v1/alerts/replay-failed`, {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ maxItems: 50 }),
      });
      assert.equal(replay.status, 200);
      const replayBody = (await replay.json()) as {
        ok: boolean;
        result: { processed: number; delivered: number; remaining: number };
      };
      assert.equal(replayBody.ok, true);
      assert.equal(replayBody.result.processed, 0);
      assert.equal(replayBody.result.delivered, 0);
    } finally {
      await server.close();
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("relay server rejects postgres mode without connection string", async () => {
  await assert.rejects(() =>
    startRelayServer({
      storeMode: "postgres",
    }),
  );
});
