import assert from "node:assert/strict";
import { test } from "node:test";

import { AgentArenaAdapter } from "./agent-arena";
import { ChainHubAdapter, PolicyMismatchError } from "./chain-hub";

test("AgentArenaAdapter forwards settlement payload", async () => {
  let lastTask = 0n;
  const adapter = new AgentArenaAdapter({
    recordSubtaskSettlement: async (input: {
      parentTaskId: bigint;
      subtaskId: number;
      winner: string;
      settleAmount: bigint;
      deliveryHash: string;
    }) => {
      lastTask = input.parentTaskId;
      return "ok";
    },
  });

  const signature = await adapter.onSubtaskSettled({
    parentTaskId: 10n,
    subtaskId: 2,
    winner: "agent",
    settleAmount: 100n,
    deliveryHash: "hash",
  });
  assert.equal(signature, "ok");
  assert.equal(lastTask, 10n);
});

test("ChainHubAdapter rejects policy mismatch and records settlement", async () => {
  const adapter = new ChainHubAdapter({
    recordDelegationExecution: async () => "record-sig",
    completeDelegationTask: async () => "complete-sig",
  });

  assert.throws(
    () =>
      adapter.verifyPolicyHash({
        expectedPolicyHash: "h1",
        actualPolicyHash: "h2",
      }),
    PolicyMismatchError,
  );

  const result = await adapter.onSubtaskSettled({
    taskId: 1n,
    executionRefHash: "hash",
  });
  assert.equal(result.recordSignature, "record-sig");
  assert.equal(result.completeSignature, "complete-sig");
});
