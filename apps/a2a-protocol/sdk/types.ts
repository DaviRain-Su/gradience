export type Address = string;

export interface AccountMeta {
  address: Address;
  writable?: boolean;
  signer?: boolean;
}

export interface InstructionEnvelope<T = Record<string, unknown>> {
  discriminator: number;
  name: string;
  accounts: AccountMeta[];
  data: T;
}

export interface A2AInstructionTransport {
  send(instruction: InstructionEnvelope): Promise<string>;
}

export interface A2AQueryTransport {
  getAccount<T>(address: Address): Promise<T | null>;
}

export interface A2ATransport extends A2AInstructionTransport, A2AQueryTransport {}

export interface NetworkConfigAccount {
  upgradeAuthority: Address;
  arbitrationAuthority: Address;
  minChannelDeposit: bigint;
  minBidStake: bigint;
  maxMessageBytes: number;
  maxDisputeSlots: bigint;
}

export interface AgentProfileAccount {
  agent: Address;
  authority: Address;
  capabilityMask: bigint;
  transportFlags: number;
  heartbeatSlot: bigint;
  status: number;
}

export interface MessageThreadAccount {
  threadId: bigint;
  creator: Address;
  counterparty: Address;
  policyHash: string;
  messageCount: number;
  status: number;
}

export interface PaymentChannelAccount {
  channelId: bigint;
  payer: Address;
  payee: Address;
  mediator: Address;
  depositAmount: bigint;
  spentAmount: bigint;
  nonce: bigint;
  status: number;
}

export interface SubtaskOrderAccount {
  parentTaskId: bigint;
  subtaskId: number;
  requester: Address;
  selectedAgent: Address;
  budget: bigint;
  status: number;
}

export interface SubtaskBidAccount {
  parentTaskId: bigint;
  subtaskId: number;
  bidder: Address;
  quoteAmount: bigint;
  status: number;
}

export interface A2ASdkConfig {
  programId: Address;
  transport: A2ATransport;
}
