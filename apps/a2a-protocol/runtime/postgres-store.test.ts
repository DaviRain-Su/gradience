import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPgPoolConfig, PostgresRelayStore } from "./postgres-store";

class MockSqlClient {
  private stateJson = "";

  constructor(
    private readonly role: {
      roleName?: string;
      rolsuper?: boolean;
      rolcreaterole?: boolean;
      rolcreatedb?: boolean;
    } = {},
  ) {}

  async query(sql: string, params?: unknown[]): Promise<{
    rows: Array<Record<string, unknown>>;
  }> {
    if (sql.includes("FROM pg_roles")) {
      return {
        rows: [
          {
            role_name: this.role.roleName ?? "a2a_runtime",
            rolsuper: this.role.rolsuper ?? false,
            rolcreaterole: this.role.rolcreaterole ?? false,
            rolcreatedb: this.role.rolcreatedb ?? false,
          },
        ],
      };
    }
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

test("postgres relay store rejects elevated roles when enabled", async () => {
  const client = new MockSqlClient({
    roleName: "postgres",
    rolsuper: true,
  });
  const store = new PostgresRelayStore(client, {
    rejectElevatedRole: true,
  });
  await assert.rejects(() => store.getMetrics(), /elevated/);
});

test("postgres pool config clamps invalid values", () => {
  const config = buildPgPoolConfig("postgres://localhost:5432/a2a", {
    poolMaxConnections: -1,
    poolIdleTimeoutMs: 0,
    poolConnectionTimeoutMs: Number.NaN,
    poolStatementTimeoutMs: 1_234,
    poolQueryTimeoutMs: -5,
  });
  assert.equal(config.connectionString, "postgres://localhost:5432/a2a");
  assert.equal(config.max, 10);
  assert.equal(config.idleTimeoutMillis, 30_000);
  assert.equal(config.connectionTimeoutMillis, 5_000);
  assert.equal(config.statement_timeout, 1_234);
  assert.equal(config.query_timeout, 20_000);
  assert.equal(config.keepAlive, true);
});
