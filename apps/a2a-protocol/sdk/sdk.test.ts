import assert from "node:assert/strict";
import { test } from "node:test";

import { A2ASdk } from "./client";
import { A2A_INSTRUCTION } from "./instructions";
import { derivePda } from "./pda";
import type { A2ATransport, InstructionEnvelope } from "./types";

class MockTransport implements A2ATransport {
  lastInstruction: InstructionEnvelope | null = null;
  readonly accounts = new Map<string, unknown>();

  async send(instruction: InstructionEnvelope): Promise<string> {
    this.lastInstruction = instruction;
    return "sig_mock";
  }

  async getAccount<T>(address: string): Promise<T | null> {
    const value = this.accounts.get(address);
    return (value as T | undefined) ?? null;
  }
}

test("derivePda is deterministic for same inputs", () => {
  const pdaA = derivePda("program", { seedPrefix: "thread", values: ["a", "b", 1] });
  const pdaB = derivePda("program", { seedPrefix: "thread", values: ["a", "b", 1] });
  assert.equal(pdaA, pdaB);
});

test("sdk openChannel sends expected discriminator", async () => {
  const transport = new MockTransport();
  const sdk = new A2ASdk({ programId: "prog", transport });

  await sdk.openChannel({
    payer: "payer",
    payee: "payee",
    channelId: 7n,
    mediator: "mediator",
    tokenMint: "mint",
    depositAmount: 100n,
    expiresAt: 1_000n,
  });

  assert.ok(transport.lastInstruction);
  assert.equal(transport.lastInstruction?.discriminator, A2A_INSTRUCTION.openChannel);
  assert.equal(transport.lastInstruction?.accounts.length, 5);
});

test("sdk assignSubtaskBid builds subtask and bid accounts", async () => {
  const transport = new MockTransport();
  const sdk = new A2ASdk({ programId: "prog", transport });

  await sdk.assignSubtaskBid({
    requester: "requester",
    parentTaskId: 9n,
    subtaskId: 2,
    winner: "winner",
  });

  assert.ok(transport.lastInstruction);
  assert.equal(transport.lastInstruction?.discriminator, A2A_INSTRUCTION.assignSubtaskBid);
  assert.equal(transport.lastInstruction?.accounts.length, 3);
});

test("sdk openChannelDispute uses config account", async () => {
  const transport = new MockTransport();
  const sdk = new A2ASdk({ programId: "prog", transport });

  await sdk.openChannelDispute({
    complainant: "payer",
    payer: "payer",
    payee: "payee",
    channelId: 1n,
    nonce: 2n,
    spentAmount: 3n,
    disputeDeadline: 4n,
    payerSig: { r: "a", s: "b" },
    payeeSig: { r: "c", s: "d" },
  });

  assert.ok(transport.lastInstruction);
  assert.equal(transport.lastInstruction?.discriminator, A2A_INSTRUCTION.openChannelDispute);
  assert.equal(transport.lastInstruction?.accounts.length, 3);
});
