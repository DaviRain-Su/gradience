import type {
  Address,
  RelayAgentDescriptor,
  RelayEnvelopeRecord,
  RelayMetrics,
  RelayPullResult,
  SignedEnvelope,
} from "./types";

export class InMemoryRelayStore {
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
