import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type {
  Address,
  RelayAgentDescriptor,
  RelayEnvelopeRecord,
  RelayMetrics,
  RelayPullResult,
  RelayStore,
  SignedEnvelope,
} from "./types";

export class InMemoryRelayStore implements RelayStore {
  private readonly agents = new Map<Address, RelayAgentDescriptor>();
  private readonly envelopes: RelayEnvelopeRecord[] = [];
  private readonly maxAgents: number;
  private readonly maxEnvelopes: number;
  private readonly metrics: RelayMetrics = {
    agentsUpserted: 0,
    envelopesPublished: 0,
    envelopesDeduplicated: 0,
    envelopesDelivered: 0,
    pullRequests: 0,
    rejectedPayloads: 0,
    dbQueryCount: 0,
    dbQueryFailures: 0,
    dbAvgQueryLatencyMs: 0,
  };

  constructor(options: { maxAgents?: number; maxEnvelopes?: number } = {}) {
    this.maxAgents = options.maxAgents ?? 10_000;
    this.maxEnvelopes = options.maxEnvelopes ?? 50_000;
  }

  upsertAgent(descriptor: Omit<RelayAgentDescriptor, "heartbeatAt">): RelayAgentDescriptor {
    if (!this.agents.has(descriptor.agent) && this.agents.size >= this.maxAgents) {
      const oldest = this.agents.keys().next().value as Address | undefined;
      if (oldest) {
        this.agents.delete(oldest);
      }
    }
    const next: RelayAgentDescriptor = {
      ...descriptor,
      heartbeatAt: Date.now(),
    };
    this.agents.set(descriptor.agent, next);
    this.metrics.agentsUpserted += 1;
    return next;
  }

  listAgents(capabilityMask?: bigint): RelayAgentDescriptor[] {
    const values = Array.from(this.agents.values());
    if (capabilityMask === undefined) {
      return values;
    }
    return values.filter((agent) => (agent.capabilityMask & capabilityMask) === capabilityMask);
  }

  publishEnvelope(
    envelope: SignedEnvelope,
    body: Record<string, unknown>,
  ): RelayEnvelopeRecord {
    const existing = this.envelopes.find((item) => item.envelope.id === envelope.id);
    if (existing) {
      this.metrics.envelopesDeduplicated += 1;
      return existing;
    }
    const record: RelayEnvelopeRecord = {
      envelope,
      body,
      deliveredTo: new Set<Address>(),
    };
    if (this.envelopes.length >= this.maxEnvelopes) {
      this.envelopes.shift();
    }
    this.envelopes.push(record);
    this.envelopes.sort((a, b) => a.envelope.createdAt - b.envelope.createdAt);
    this.metrics.envelopesPublished += 1;
    return record;
  }

  pullEnvelopes(agent: Address, afterId?: string, limit = 100): RelayPullResult {
    this.metrics.pullRequests += 1;
    const startIndex =
      afterId === undefined
        ? 0
        : Math.max(
            0,
            this.envelopes.findIndex((item) => item.envelope.id === afterId) + 1,
          );

    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 100;
    const output: RelayEnvelopeRecord[] = [];
    let nextCursor: string | null = null;
    for (const record of this.envelopes.slice(startIndex)) {
      if (record.envelope.to !== agent && record.envelope.to !== "*") {
        continue;
      }
      record.deliveredTo.add(agent);
      output.push(record);
      this.metrics.envelopesDelivered += 1;
      if (output.length >= safeLimit) {
        nextCursor = record.envelope.id;
        break;
      }
    }
    return { items: output, nextCursor };
  }

  markPayloadRejected(): void {
    this.metrics.rejectedPayloads += 1;
  }

  getMetrics(): RelayMetrics {
    return { ...this.metrics };
  }
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

export class FileRelayStore implements RelayStore {
  private readonly agents = new Map<Address, RelayAgentDescriptor>();
  private readonly envelopes: RelayEnvelopeRecord[] = [];
  private readonly maxAgents: number;
  private readonly maxEnvelopes: number;
  private readonly metrics: RelayMetrics = {
    agentsUpserted: 0,
    envelopesPublished: 0,
    envelopesDeduplicated: 0,
    envelopesDelivered: 0,
    pullRequests: 0,
    rejectedPayloads: 0,
    dbQueryCount: 0,
    dbQueryFailures: 0,
    dbAvgQueryLatencyMs: 0,
  };

  constructor(
    private readonly filePath: string,
    options: { maxAgents?: number; maxEnvelopes?: number } = {},
  ) {
    this.maxAgents = options.maxAgents ?? 10_000;
    this.maxEnvelopes = options.maxEnvelopes ?? 50_000;
    this.hydrateFromDisk();
  }

  upsertAgent(descriptor: Omit<RelayAgentDescriptor, "heartbeatAt">): RelayAgentDescriptor {
    if (!this.agents.has(descriptor.agent) && this.agents.size >= this.maxAgents) {
      const oldest = this.agents.keys().next().value as Address | undefined;
      if (oldest) {
        this.agents.delete(oldest);
      }
    }
    const next: RelayAgentDescriptor = {
      ...descriptor,
      heartbeatAt: Date.now(),
    };
    this.agents.set(descriptor.agent, next);
    this.metrics.agentsUpserted += 1;
    this.persist();
    return next;
  }

  listAgents(capabilityMask?: bigint): RelayAgentDescriptor[] {
    const values = Array.from(this.agents.values());
    if (capabilityMask === undefined) {
      return values;
    }
    return values.filter((agent) => (agent.capabilityMask & capabilityMask) === capabilityMask);
  }

  publishEnvelope(envelope: SignedEnvelope, body: Record<string, unknown>): RelayEnvelopeRecord {
    const existing = this.envelopes.find((item) => item.envelope.id === envelope.id);
    if (existing) {
      this.metrics.envelopesDeduplicated += 1;
      this.persist();
      return existing;
    }
    const record: RelayEnvelopeRecord = {
      envelope,
      body,
      deliveredTo: new Set<Address>(),
    };
    if (this.envelopes.length >= this.maxEnvelopes) {
      this.envelopes.shift();
    }
    this.envelopes.push(record);
    this.envelopes.sort((a, b) => a.envelope.createdAt - b.envelope.createdAt);
    this.metrics.envelopesPublished += 1;
    this.persist();
    return record;
  }

  pullEnvelopes(agent: Address, afterId?: string, limit = 100): RelayPullResult {
    this.metrics.pullRequests += 1;
    const startIndex =
      afterId === undefined
        ? 0
        : Math.max(
            0,
            this.envelopes.findIndex((item) => item.envelope.id === afterId) + 1,
          );

    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 100;
    const output: RelayEnvelopeRecord[] = [];
    let nextCursor: string | null = null;
    for (const record of this.envelopes.slice(startIndex)) {
      if (record.envelope.to !== agent && record.envelope.to !== "*") {
        continue;
      }
      record.deliveredTo.add(agent);
      output.push(record);
      this.metrics.envelopesDelivered += 1;
      if (output.length >= safeLimit) {
        nextCursor = record.envelope.id;
        break;
      }
    }
    this.persist();
    return { items: output, nextCursor };
  }

  markPayloadRejected(): void {
    this.metrics.rejectedPayloads += 1;
    this.persist();
  }

  getMetrics(): RelayMetrics {
    return { ...this.metrics };
  }

  private hydrateFromDisk(): void {
    try {
      const raw = readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PersistedRelayState;
      if (parsed.version !== 1) {
        throw new Error(
          `unsupported relay state version: ${String((parsed as { version?: number }).version)}`,
        );
      }
      this.agents.clear();
      for (const agent of parsed.agents) {
        this.agents.set(agent.agent, {
          agent: agent.agent,
          capabilityMask: BigInt(agent.capabilityMask),
          transportFlags: agent.transportFlags,
          endpoint: agent.endpoint,
          heartbeatAt: agent.heartbeatAt,
        });
      }
      this.envelopes.length = 0;
      for (const item of parsed.envelopes) {
        this.envelopes.push({
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
        });
      }
      const metrics = normalizePersistedMetrics(parsed.metrics);
      this.metrics.agentsUpserted = metrics.agentsUpserted;
      this.metrics.envelopesPublished = metrics.envelopesPublished;
      this.metrics.envelopesDeduplicated = metrics.envelopesDeduplicated;
      this.metrics.envelopesDelivered = metrics.envelopesDelivered;
      this.metrics.pullRequests = metrics.pullRequests;
      this.metrics.rejectedPayloads = metrics.rejectedPayloads;
      this.metrics.dbQueryCount = metrics.dbQueryCount;
      this.metrics.dbQueryFailures = metrics.dbQueryFailures;
      this.metrics.dbAvgQueryLatencyMs = metrics.dbAvgQueryLatencyMs;
    } catch (error) {
      if (isFileNotFound(error)) {
        return;
      }
      throw error;
    }
  }

  private persist(): void {
    const state: PersistedRelayState = {
      version: 1,
      agents: Array.from(this.agents.values()).map((agent) => ({
        agent: agent.agent,
        capabilityMask: agent.capabilityMask.toString(),
        transportFlags: agent.transportFlags,
        endpoint: agent.endpoint,
        heartbeatAt: agent.heartbeatAt,
      })),
      envelopes: this.envelopes.map((item) => ({
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
      })),
      metrics: { ...this.metrics },
    };

    mkdirSync(dirname(this.filePath), { recursive: true });
    const tempFile = `${this.filePath}.tmp`;
    writeFileSync(tempFile, JSON.stringify(state), "utf8");
    renameSync(tempFile, this.filePath);
  }
}

function normalizePersistedMetrics(metrics: Partial<RelayMetrics> | undefined): RelayMetrics {
  return {
    agentsUpserted: clampMetric(metrics?.agentsUpserted),
    envelopesPublished: clampMetric(metrics?.envelopesPublished),
    envelopesDeduplicated: clampMetric(metrics?.envelopesDeduplicated),
    envelopesDelivered: clampMetric(metrics?.envelopesDelivered),
    pullRequests: clampMetric(metrics?.pullRequests),
    rejectedPayloads: clampMetric(metrics?.rejectedPayloads),
    dbQueryCount: clampMetric(metrics?.dbQueryCount),
    dbQueryFailures: clampMetric(metrics?.dbQueryFailures),
    dbAvgQueryLatencyMs: clampMetric(metrics?.dbAvgQueryLatencyMs),
  };
}

function clampMetric(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  return value;
}

function isFileNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
