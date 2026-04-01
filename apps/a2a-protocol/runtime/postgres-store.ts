import type {
  Address,
  RelayAgentDescriptor,
  RelayEnvelopeRecord,
  RelayMetrics,
  RelayPullResult,
  RelayStore,
  SignedEnvelope,
} from "./types";

interface SqlResult {
  rows: Array<Record<string, unknown>>;
}

interface SqlClientLike {
  query(sql: string, params?: unknown[]): Promise<SqlResult>;
}

interface PostgresPoolOptions {
  poolMaxConnections?: number;
  poolIdleTimeoutMs?: number;
  poolConnectionTimeoutMs?: number;
  poolStatementTimeoutMs?: number;
  poolQueryTimeoutMs?: number;
}

interface PgPoolConfig {
  connectionString: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  statement_timeout: number;
  query_timeout: number;
  keepAlive: boolean;
}

interface PersistedRelayState {
  version: 1;
  agents: Array<{
    agent: Address;
    capabilityMask: string;
    transportFlags: number;
    endpoint: string;
    heartbeatAt: number;
  }>;
  envelopes: Array<{
    envelope: {
      id: string;
      threadId: string;
      sequence: number;
      from: Address;
      to: Address;
      messageType: string;
      nonce: string;
      createdAt: number;
      bodyHash: string;
      signature: { r: string; s: string };
      paymentMicrolamports: string;
    };
    body: Record<string, unknown>;
    deliveredTo: Address[];
  }>;
  metrics: RelayMetrics;
}

const DEFAULT_STATE: PersistedRelayState = {
  version: 1,
  agents: [],
  envelopes: [],
  metrics: {
    agentsUpserted: 0,
    envelopesPublished: 0,
    envelopesDeduplicated: 0,
    envelopesDelivered: 0,
    pullRequests: 0,
    rejectedPayloads: 0,
  },
};

export class PostgresRelayStore implements RelayStore {
  private readyPromise: Promise<void>;
  private readonly tableName: string;
  private readonly singletonKey: string;
  private readonly maxAgents: number;
  private readonly maxEnvelopes: number;
  private readonly rejectElevatedRole: boolean;

  constructor(
    private readonly client: SqlClientLike,
    options: {
      tableName?: string;
      singletonKey?: string;
      maxAgents?: number;
      maxEnvelopes?: number;
      rejectElevatedRole?: boolean;
      poolMaxConnections?: number;
      poolIdleTimeoutMs?: number;
      poolConnectionTimeoutMs?: number;
      poolStatementTimeoutMs?: number;
      poolQueryTimeoutMs?: number;
    } = {},
  ) {
    this.tableName = sanitizeSqlIdentifier(options.tableName ?? "a2a_relay_state");
    this.singletonKey = options.singletonKey ?? "default";
    this.maxAgents = options.maxAgents ?? 10_000;
    this.maxEnvelopes = options.maxEnvelopes ?? 50_000;
    this.rejectElevatedRole = options.rejectElevatedRole ?? false;
    this.readyPromise = this.ensureInitialized();
  }

  static async connect(
    connectionString: string,
    options: {
      tableName?: string;
      singletonKey?: string;
      maxAgents?: number;
      maxEnvelopes?: number;
      rejectElevatedRole?: boolean;
      poolMaxConnections?: number;
      poolIdleTimeoutMs?: number;
      poolConnectionTimeoutMs?: number;
      poolStatementTimeoutMs?: number;
      poolQueryTimeoutMs?: number;
    } = {},
  ): Promise<PostgresRelayStore> {
    const pool = await createPgPool(connectionString, {
      poolMaxConnections: options.poolMaxConnections,
      poolIdleTimeoutMs: options.poolIdleTimeoutMs,
      poolConnectionTimeoutMs: options.poolConnectionTimeoutMs,
      poolStatementTimeoutMs: options.poolStatementTimeoutMs,
      poolQueryTimeoutMs: options.poolQueryTimeoutMs,
    });
    return new PostgresRelayStore(pool, options);
  }

  async upsertAgent(
    descriptor: Omit<RelayAgentDescriptor, "heartbeatAt">,
  ): Promise<RelayAgentDescriptor> {
    return this.withState(async (state) => {
      const existingIndex = state.agents.findIndex((item) => item.agent === descriptor.agent);
      if (existingIndex < 0 && state.agents.length >= this.maxAgents) {
        state.agents.shift();
      }
      const next = {
        ...descriptor,
        heartbeatAt: Date.now(),
      };
      const serialized = {
        agent: next.agent,
        capabilityMask: next.capabilityMask.toString(),
        transportFlags: next.transportFlags,
        endpoint: next.endpoint,
        heartbeatAt: next.heartbeatAt,
      };
      if (existingIndex >= 0) {
        state.agents[existingIndex] = serialized;
      } else {
        state.agents.push(serialized);
      }
      state.metrics.agentsUpserted += 1;
      return next;
    });
  }

  async listAgents(capabilityMask?: bigint): Promise<RelayAgentDescriptor[]> {
    const state = await this.readState();
    const all = state.agents.map(deserializeAgent);
    if (capabilityMask === undefined) {
      return all;
    }
    return all.filter((agent) => (agent.capabilityMask & capabilityMask) === capabilityMask);
  }

  async publishEnvelope(
    envelope: SignedEnvelope,
    body: Record<string, unknown>,
  ): Promise<RelayEnvelopeRecord> {
    return this.withState(async (state) => {
      const existing = state.envelopes.find((item) => item.envelope.id === envelope.id);
      if (existing) {
        state.metrics.envelopesDeduplicated += 1;
        return deserializeEnvelopeRecord(existing);
      }

      if (state.envelopes.length >= this.maxEnvelopes) {
        state.envelopes.shift();
      }
      state.envelopes.push(serializeEnvelopeRecord({ envelope, body, deliveredTo: new Set() }));
      state.envelopes.sort((a, b) => a.envelope.createdAt - b.envelope.createdAt);
      state.metrics.envelopesPublished += 1;
      const inserted = state.envelopes[state.envelopes.length - 1];
      return deserializeEnvelopeRecord(inserted!);
    });
  }

  async pullEnvelopes(
    agent: Address,
    afterId?: string,
    limit = 100,
  ): Promise<RelayPullResult> {
    return this.withState(async (state) => {
      state.metrics.pullRequests += 1;
      const startIndex =
        afterId === undefined
          ? 0
          : Math.max(
              0,
              state.envelopes.findIndex((item) => item.envelope.id === afterId) + 1,
            );
      const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 100;
      const output: RelayEnvelopeRecord[] = [];
      let nextCursor: string | null = null;
      for (const item of state.envelopes.slice(startIndex)) {
        if (item.envelope.to !== agent && item.envelope.to !== "*") {
          continue;
        }
        if (!item.deliveredTo.includes(agent)) {
          item.deliveredTo.push(agent);
        }
        output.push(deserializeEnvelopeRecord(item));
        state.metrics.envelopesDelivered += 1;
        if (output.length >= safeLimit) {
          nextCursor = item.envelope.id;
          break;
        }
      }
      return { items: output, nextCursor };
    });
  }

  async markPayloadRejected(): Promise<void> {
    await this.withState(async (state) => {
      state.metrics.rejectedPayloads += 1;
    });
  }

  async getMetrics(): Promise<RelayMetrics> {
    const state = await this.readState();
    return { ...state.metrics };
  }

  private async withState<T>(
    mutation: (state: PersistedRelayState) => Promise<T> | T,
  ): Promise<T> {
    const state = await this.readState();
    const result = await mutation(state);
    await this.writeState(state);
    return result;
  }

  private async ensureInitialized(): Promise<void> {
    await this.assertRolePolicy();
    const table = this.tableName;
    await this.client.query(
      `CREATE TABLE IF NOT EXISTS ${table} (
        singleton_key TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    );
    await this.client.query(
      `INSERT INTO ${table} (singleton_key, state_json)
       VALUES ($1, $2)
       ON CONFLICT (singleton_key) DO NOTHING`,
      [this.singletonKey, JSON.stringify(DEFAULT_STATE)],
    );
  }

  private async assertRolePolicy(): Promise<void> {
    const result = await this.client.query(
      `SELECT current_user AS role_name, rolsuper, rolcreaterole, rolcreatedb
       FROM pg_roles
       WHERE rolname = current_user`,
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error("unable to resolve current postgres role");
    }
    if (!this.rejectElevatedRole) {
      return;
    }
    const elevated = toBoolean(row.rolsuper) || toBoolean(row.rolcreaterole) || toBoolean(row.rolcreatedb);
    if (!elevated) {
      return;
    }
    const roleName =
      typeof row.role_name === "string" && row.role_name.trim() !== ""
        ? row.role_name
        : "unknown";
    throw new Error(
      `postgres role '${roleName}' is elevated (requires non-superuser, non-createdb, non-createrole)`,
    );
  }

  private async readState(): Promise<PersistedRelayState> {
    await this.readyPromise;
    const table = this.tableName;
    const result = await this.client.query(
      `SELECT state_json FROM ${table} WHERE singleton_key = $1`,
      [this.singletonKey],
    );
    const row = result.rows[0];
    const json =
      row && typeof row.state_json === "string"
        ? row.state_json
        : JSON.stringify(DEFAULT_STATE);
    const parsed = JSON.parse(json) as PersistedRelayState;
    if (parsed.version !== 1) {
      throw new Error(
        `unsupported relay state version: ${String((parsed as { version?: number }).version)}`,
      );
    }
    return parsed;
  }

  private async writeState(state: PersistedRelayState): Promise<void> {
    await this.readyPromise;
    const table = this.tableName;
    await this.client.query(
      `UPDATE ${table} SET state_json = $1, updated_at = NOW() WHERE singleton_key = $2`,
      [JSON.stringify(state), this.singletonKey],
    );
  }
}

async function createPgPool(
  connectionString: string,
  options: PostgresPoolOptions = {},
): Promise<SqlClientLike> {
  const pgModule = (await import("pg")) as {
    Pool: new (options: {
      connectionString: string;
      max?: number;
      idleTimeoutMillis?: number;
      connectionTimeoutMillis?: number;
      statement_timeout?: number;
      query_timeout?: number;
      keepAlive?: boolean;
    }) => SqlClientLike;
  };
  return new pgModule.Pool(buildPgPoolConfig(connectionString, options));
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "t" || normalized === "true" || normalized === "1";
  }
  if (typeof value === "number") {
    return value === 1;
  }
  return false;
}

function clampPositiveInt(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  const normalized = Math.floor(value);
  if (normalized <= 0) {
    return fallback;
  }
  return normalized;
}

export function buildPgPoolConfig(
  connectionString: string,
  options: PostgresPoolOptions = {},
): PgPoolConfig {
  return {
    connectionString,
    max: clampPositiveInt(options.poolMaxConnections, 10),
    idleTimeoutMillis: clampPositiveInt(options.poolIdleTimeoutMs, 30_000),
    connectionTimeoutMillis: clampPositiveInt(options.poolConnectionTimeoutMs, 5_000),
    statement_timeout: clampPositiveInt(options.poolStatementTimeoutMs, 20_000),
    query_timeout: clampPositiveInt(options.poolQueryTimeoutMs, 20_000),
    keepAlive: true,
  };
}

function sanitizeSqlIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`invalid sql identifier: ${value}`);
  }
  return value;
}

function deserializeAgent(agent: PersistedRelayState["agents"][number]): RelayAgentDescriptor {
  return {
    agent: agent.agent,
    capabilityMask: BigInt(agent.capabilityMask),
    transportFlags: agent.transportFlags,
    endpoint: agent.endpoint,
    heartbeatAt: agent.heartbeatAt,
  };
}

function deserializeEnvelopeRecord(
  item: PersistedRelayState["envelopes"][number],
): RelayEnvelopeRecord {
  return {
    envelope: {
      id: item.envelope.id,
      threadId: BigInt(item.envelope.threadId),
      sequence: item.envelope.sequence,
      from: item.envelope.from,
      to: item.envelope.to,
      messageType: item.envelope.messageType,
      nonce: BigInt(item.envelope.nonce),
      createdAt: item.envelope.createdAt,
      bodyHash: item.envelope.bodyHash,
      signature: {
        r: item.envelope.signature.r,
        s: item.envelope.signature.s,
      },
      paymentMicrolamports: BigInt(item.envelope.paymentMicrolamports),
    },
    body: item.body,
    deliveredTo: new Set(item.deliveredTo),
  };
}

function serializeEnvelopeRecord(
  item: RelayEnvelopeRecord,
): PersistedRelayState["envelopes"][number] {
  return {
    envelope: {
      id: item.envelope.id,
      threadId: item.envelope.threadId.toString(),
      sequence: item.envelope.sequence,
      from: item.envelope.from,
      to: item.envelope.to,
      messageType: item.envelope.messageType,
      nonce: item.envelope.nonce.toString(),
      createdAt: item.envelope.createdAt,
      bodyHash: item.envelope.bodyHash,
      signature: {
        r: item.envelope.signature.r,
        s: item.envelope.signature.s,
      },
      paymentMicrolamports: item.envelope.paymentMicrolamports.toString(),
    },
    body: item.body,
    deliveredTo: Array.from(item.deliveredTo),
  };
}
