import type { AccountMeta, Address, InstructionEnvelope } from "./types";

export const A2A_INSTRUCTION = {
  initializeNetworkConfig: 0,
  upsertAgentProfile: 1,
  createThread: 2,
  postMessage: 3,
  archiveThread: 4,
  openChannel: 5,
  cooperativeCloseChannel: 6,
  openChannelDispute: 7,
  resolveChannelDispute: 8,
  createSubtaskOrder: 9,
  submitSubtaskBid: 10,
  assignSubtaskBid: 11,
  submitSubtaskDelivery: 12,
  settleSubtask: 13,
  cancelSubtaskOrder: 14,
} as const;

export type A2AInstructionName = keyof typeof A2A_INSTRUCTION;

export function buildInstruction<T extends Record<string, unknown>>(
  name: A2AInstructionName,
  accounts: AccountMeta[],
  data: T,
): InstructionEnvelope<T> {
  return {
    discriminator: A2A_INSTRUCTION[name],
    name,
    accounts,
    data,
  };
}

export function writableSigner(address: Address): AccountMeta {
  return { address, writable: true, signer: true };
}

export function writable(address: Address): AccountMeta {
  return { address, writable: true, signer: false };
}

export function readonlyAccount(address: Address): AccountMeta {
  return { address, writable: false, signer: false };
}
