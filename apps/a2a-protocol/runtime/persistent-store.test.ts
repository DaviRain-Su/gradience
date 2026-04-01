import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { FileRelayStore } from "./store";

test("file relay store persists agents, envelopes, and metrics", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "a2a-relay-store-"));
  const filePath = join(tempDir, "relay-state.json");
  try {
    const storeA = new FileRelayStore(filePath);
    storeA.upsertAgent({
      agent: "agent-a",
      capabilityMask: 3n,
      transportFlags: 1,
      endpoint: "ws://agent-a",
    });
    storeA.publishEnvelope(
      {
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
        paymentMicrolamports: 10n,
      },
      { hello: "world" },
    );
    storeA.pullEnvelopes("agent-b", undefined, 1);

    const storeB = new FileRelayStore(filePath);
    const agents = storeB.listAgents(1n);
    assert.equal(agents.length, 1);
    assert.equal(agents[0]?.agent, "agent-a");

    const pull = storeB.pullEnvelopes("agent-b", undefined, 10);
    assert.equal(pull.items.length, 1);
    assert.equal(pull.items[0]?.envelope.id, "1:1");

    const metrics = await storeB.getMetrics();
    assert.equal(metrics.agentsUpserted, 1);
    assert.equal(metrics.envelopesPublished, 1);
    assert.equal(metrics.pullRequests >= 1, true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
