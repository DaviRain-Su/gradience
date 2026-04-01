import assert from "node:assert/strict";
import { test } from "node:test";

import { A2ARelayApi } from "./relay";
import { InMemoryRelayStore } from "./store";

test("relay announce and list agents with capability filter", async () => {
  const relay = new A2ARelayApi(new InMemoryRelayStore());
  await relay.handle({
    method: "POST",
    path: "/v1/discovery/announce",
    body: {
      agent: "agent-a",
      capabilityMask: "3",
      transportFlags: 1,
      endpoint: "ws://agent-a",
    },
  });
  await relay.handle({
    method: "POST",
    path: "/v1/discovery/announce",
    body: {
      agent: "agent-b",
      capabilityMask: "1",
      transportFlags: 1,
      endpoint: "ws://agent-b",
    },
  });

  const response = await relay.handle({
    method: "GET",
    path: "/v1/discovery/agents",
    query: { capabilityMask: "2" },
  });
  const payload = response.body as { items: Array<{ agent: string }> };
  assert.equal(response.status, 200);
  assert.deepEqual(payload.items.map((item) => item.agent), ["agent-a"]);
});

test("relay publish and pull envelopes", async () => {
  const relay = new A2ARelayApi(new InMemoryRelayStore(), {
    authToken: "secret",
    maxPayloadBytes: 1024,
  });
  const publish = await relay.handle({
    method: "POST",
    path: "/v1/envelopes/publish",
    headers: { authorization: "Bearer secret" },
    body: {
      envelope: {
        id: "1:1",
        threadId: 1n,
        sequence: 1,
        from: "agent-a",
        to: "agent-b",
        messageType: "invite",
        nonce: 1n,
        createdAt: 1,
        bodyHash: "a".repeat(64),
        signature: { r: "b".repeat(64), s: "c".repeat(64) },
        paymentMicrolamports: 100n,
      },
      payload: { hello: "world" },
    },
  });
  assert.equal(publish.status, 202);

  const pull = await relay.handle({
    method: "GET",
    path: "/v1/envelopes/pull",
    headers: { authorization: "Bearer secret" },
    query: { agent: "agent-b", limit: "1" },
  });
  const body = pull.body as { items: Array<{ envelope: { id: string } }>; nextCursor: string | null };
  assert.equal(pull.status, 200);
  assert.deepEqual(body.items.map((item) => item.envelope.id), ["1:1"]);
  assert.equal(body.nextCursor, "1:1");

  const metrics = await relay.handle({
    method: "GET",
    path: "/v1/metrics",
    headers: { authorization: "Bearer secret" },
  });
  const metricBody = metrics.body as { envelopesPublished: number; pullRequests: number };
  assert.equal(metricBody.envelopesPublished, 1);
  assert.equal(metricBody.pullRequests, 1);
});

test("relay rejects unauthorized and invalid envelope payloads", async () => {
  const relay = new A2ARelayApi(new InMemoryRelayStore(), {
    authToken: "token",
    maxPayloadBytes: 8,
  });

  const unauthorized = await relay.handle({
    method: "POST",
    path: "/v1/envelopes/publish",
    body: {},
  });
  assert.equal(unauthorized.status, 401);

  const invalid = await relay.handle({
    method: "POST",
    path: "/v1/envelopes/publish",
    headers: { "x-relay-token": "token" },
    body: {
      envelope: {
        id: "bad",
        threadId: 1n,
        sequence: 0,
        from: "a",
        to: "b",
        messageType: "invite",
        nonce: 0n,
        createdAt: 0,
        bodyHash: "bad",
        signature: { r: "r", s: "s" },
        paymentMicrolamports: 1n,
      },
      payload: { very: "large payload" },
    },
  });
  assert.equal(invalid.status, 413);
});
