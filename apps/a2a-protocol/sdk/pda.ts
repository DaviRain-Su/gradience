import type { Address } from "./types";

export interface PdaDerivationInput {
  seedPrefix: string;
  values: Array<string | number | bigint | Uint8Array>;
}

export function derivePda(programId: Address, input: PdaDerivationInput): Address {
  let buffer = `${programId}:${input.seedPrefix}`;
  for (const value of input.values) {
    buffer += ":";
    if (value instanceof Uint8Array) {
      buffer += Array.from(value)
        .map((item) => item.toString(16).padStart(2, "0"))
        .join("");
    } else {
      buffer += String(value);
    }
  }
  return `pda_${fnv1a64Hex(buffer).padEnd(44, "0").slice(0, 44)}`;
}

export function networkConfigPda(programId: Address): Address {
  return derivePda(programId, { seedPrefix: "a2a_config", values: [] });
}

export function agentProfilePda(programId: Address, agent: Address): Address {
  return derivePda(programId, {
    seedPrefix: "agent_profile",
    values: [agent],
  });
}

export function threadPda(
  programId: Address,
  creator: Address,
  counterparty: Address,
  threadId: bigint,
): Address {
  return derivePda(programId, {
    seedPrefix: "thread",
    values: [creator, counterparty, threadId],
  });
}

export function envelopePda(
  programId: Address,
  threadId: bigint,
  sequence: number,
): Address {
  return derivePda(programId, {
    seedPrefix: "msg",
    values: [threadId, sequence],
  });
}

export function channelPda(
  programId: Address,
  payer: Address,
  payee: Address,
  channelId: bigint,
): Address {
  return derivePda(programId, {
    seedPrefix: "channel",
    values: [payer, payee, channelId],
  });
}

export function subtaskPda(
  programId: Address,
  parentTaskId: bigint,
  subtaskId: number,
): Address {
  return derivePda(programId, {
    seedPrefix: "subtask",
    values: [parentTaskId, subtaskId],
  });
}

export function bidPda(
  programId: Address,
  parentTaskId: bigint,
  subtaskId: number,
  bidder: Address,
): Address {
  return derivePda(programId, {
    seedPrefix: "bid",
    values: [parentTaskId, subtaskId, bidder],
  });
}

function fnv1a64Hex(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const char of input) {
    hash ^= BigInt(char.codePointAt(0) ?? 0);
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash.toString(16);
}
