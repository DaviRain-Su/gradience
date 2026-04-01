import assert from "node:assert/strict";
import { test } from "node:test";

import { PostgresRelayStore } from "./postgres-store";

class MockSqlClient {
  private stateJson = "";

  async query(sql: string, params?: unknown[]): Promise<{
    rows: Array<Record<string, unknown>>;
  }> {
    if (sql.startsWith("CREATE TABLE")) {
      return { rows: [] };
    }
    if (sql.startsWith("INSERT INTO")) {
      if (this.stateJson === "") {
        this.stateJson = String(params?.[1] ?? "");
      }
      return { rows: [] };
    }
    if (sql.startsWith("SELECT state_json")) {
      if (this.stateJson === "") {
        return { rows: [] };
      }
      return { rows: [{ state_json: this.stateJson }] };
    }
    if (sql.startsWith("UPDATE")) {
      this.stateJson = String(params?.[0] ?? "");
      return { rows: [] };
    }
    throw new Error(`unexpected sql: ${sql}`);
  }
}

test("postgres relay store persists state in sql row", async () => {
  const client = new MockSqlClient();
  const storeA = new PostgresRelayStore(client);

  await storeA.upsertAgent({
    agent: "agent-a",
    capabilityMask: 3n,
    transportFlags: 1,
    endpoint: "ws://agent-a",
  });
  await storeA.publishEnvelope(
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

  const storeB = new PostgresRelayStore(client);
  const agents = await storeB.listAgents(1n);
  assert.equal(agents.length, 1);
  assert.equal(agents[0]?.agent, "agent-a");

  const pull = await storeB.pullEnvelopes("agent-b", undefined, 10);
  assert.equal(pull.items.length, 1);
  assert.equal(pull.items[0]?.envelope.id, "1:1");

  const metrics = await storeB.getMetrics();
  assert.equal(metrics.agentsUpserted >= 1, true);
  assert.equal(metrics.envelopesPublished >= 1, true);
});
