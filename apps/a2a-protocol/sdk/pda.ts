import { PublicKey } from "@solana/web3.js";
import type { Address } from "./types";

function toBuffer(value: string | number | bigint | Uint8Array): Buffer {
  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  if (typeof value === "number" || typeof value === "bigint") {
    const bn = BigInt.asUintN(64, BigInt(value));
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(bn, 0);
    return buf;
  }
  // Assume base58 address string
  return new PublicKey(value).toBuffer();
}

export interface PdaDerivationInput {
  seedPrefix: string;
  values: Array<string | number | bigint | Uint8Array>;
}

export function derivePda(programId: Address, input: PdaDerivationInput): Address {
  const seeds: Buffer[] = [Buffer.from(input.seedPrefix)];
  for (const value of input.values) {
    seeds.push(toBuffer(value));
  }
  const [pda] = PublicKey.findProgramAddressSync(seeds, new PublicKey(programId));
  return pda.toBase58();
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
