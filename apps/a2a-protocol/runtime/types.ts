export type Address = string;

export interface RelayAgentDescriptor {
  agent: Address;
  capabilityMask: bigint;
  transportFlags: number;
  endpoint: string;
  heartbeatAt: number;
}

export interface SignedEnvelope {
  id: string;
  threadId: bigint;
  sequence: number;
  from: Address;
  to: Address;
  messageType: string;
  nonce: bigint;
  createdAt: number;
  bodyHash: string;
  signature: {
    r: string;
    s: string;
  };
  paymentMicrolamports: bigint;
}

export interface RelayEnvelopeRecord {
  envelope: SignedEnvelope;
  body: Record<string, unknown>;
  deliveredTo: Set<Address>;
}

export interface RelayRequest {
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string | undefined>;
  headers?: Record<string, string | undefined>;
  body?: unknown;
}

export interface RelayResponse {
  status: number;
  body: unknown;
}

export interface RelayPullResult {
  items: RelayEnvelopeRecord[];
  nextCursor: string | null;
}

export interface RelayMetrics {
  agentsUpserted: number;
  envelopesPublished: number;
  envelopesDeduplicated: number;
  envelopesDelivered: number;
  pullRequests: number;
  rejectedPayloads: number;
}

export interface SubtaskBroadcastInput {
  requester: Address;
  parentTaskId: bigint;
  subtaskId: number;
  budget: bigint;
  bidDeadline: bigint;
  executeDeadline: bigint;
  requirementHash: string;
  escrowChannelId: bigint;
  threadId: bigint;
  policyHash: string;
}

export interface SubtaskBidInput {
  bidder: Address;
  parentTaskId: bigint;
  subtaskId: number;
  quoteAmount: bigint;
  stakeAmount: bigint;
  etaSeconds: number;
  commitmentHash: string;
}

export interface SubtaskSettlementInput {
  actor: Address;
  requester: Address;
  selectedAgent: Address;
  parentTaskId: bigint;
  subtaskId: number;
  settleAmount: bigint;
  channelId: bigint;
  deliveryHash: string;
  policyHash: string;
}

export interface A2AProgramClient {
  createSubtaskOrder(input: SubtaskBroadcastInput): Promise<string>;
  submitSubtaskBid(input: SubtaskBidInput): Promise<string>;
  assignSubtaskBid(input: {
    requester: Address;
    parentTaskId: bigint;
    subtaskId: number;
    winner: Address;
  }): Promise<string>;
  submitSubtaskDelivery(input: {
    selectedAgent: Address;
    parentTaskId: bigint;
    subtaskId: number;
    deliveryHash: string;
  }): Promise<string>;
  settleSubtask(input: {
    actor: Address;
    requester: Address;
    selectedAgent: Address;
    parentTaskId: bigint;
    subtaskId: number;
    settleAmount: bigint;
    channelId: bigint;
  }): Promise<string>;
}
