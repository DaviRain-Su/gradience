import assert from "node:assert/strict";
import { test } from "node:test";

import { AgentArenaAdapter } from "./adapters/agent-arena";
import { ChainHubAdapter } from "./adapters/chain-hub";
import { A2AOrchestrator } from "./orchestrator";
import { A2ARelayApi } from "./relay";
import { InMemoryRelayStore } from "./store";
import type { A2AProgramClient } from "./types";

function mockProgramClient(): A2AProgramClient {
  return {
    createSubtaskOrder: async () => "sig-create",
    submitSubtaskBid: async () => "sig-bid",
    assignSubtaskBid: async () => "sig-assign",
    submitSubtaskDelivery: async () => "sig-delivery",
    settleSubtask: async () => "sig-settle",
  };
}

test("orchestrator broadcasts subtask and publishes envelope", async () => {
  const store = new InMemoryRelayStore();
  const orchestrator = new A2AOrchestrator(mockProgramClient(), new A2ARelayApi(store));

  const signature = await orchestrator.broadcastSubtask({
    requester: "requester",
    parentTaskId: 11n,
    subtaskId: 1,
    budget: 1000n,
    bidDeadline: 2000n,
    executeDeadline: 3000n,
    requirementHash: "hash",
    escrowChannelId: 5n,
    threadId: 99n,
    policyHash: "policy-hash",
  });

  assert.equal(signature, "sig-create");
  const pull = store.pullEnvelopes("requester");
  assert.equal(pull.items.length, 1);
  assert.equal(pull.items[0]?.envelope.messageType, "subtask_opened");
});

test("orchestrator assignLowestBid picks smallest quote", async () => {
  const orchestrator = new A2AOrchestrator(
    mockProgramClient(),
    new A2ARelayApi(new InMemoryRelayStore()),
    {
      chainHubAdapter: new ChainHubAdapter({
        recordDelegationExecution: async () => "record",
        completeDelegationTask: async () => "complete",
      }),
    },
  );

  const result = await orchestrator.assignLowestBid({
    requester: "requester",
    parentTaskId: 42n,
    subtaskId: 3,
    threadId: 12n,
    policyHash: "h1",
    expectedPolicyHash: "h1",
    bids: [
      { bidder: "agent-b", quoteAmount: 120n },
      { bidder: "agent-a", quoteAmount: 80n },
    ],
  });

  assert.equal(result.signature, "sig-assign");
  assert.equal(result.winner, "agent-a");
});

test("orchestrator deliverAndSettle triggers adapters", async () => {
  let arenaCalls = 0;
  let chainHubCalls = 0;
  const orchestrator = new A2AOrchestrator(
    mockProgramClient(),
    new A2ARelayApi(new InMemoryRelayStore()),
    {
      agentArenaAdapter: new AgentArenaAdapter({
        recordSubtaskSettlement: async () => {
          arenaCalls += 1;
          return "arena-sig";
        },
      }),
      chainHubAdapter: new ChainHubAdapter({
        recordDelegationExecution: async () => {
          chainHubCalls += 1;
          return "record";
        },
        completeDelegationTask: async () => {
          chainHubCalls += 1;
          return "complete";
        },
      }),
    },
  );

  const result = await orchestrator.deliverAndSettle({
    actor: "requester",
    requester: "requester",
    selectedAgent: "agent-a",
    parentTaskId: 5n,
    subtaskId: 7,
    settleAmount: 200n,
    channelId: 77n,
    deliveryHash: "delivery-hash",
    policyHash: "policy",
  });

  assert.equal(result.deliverySignature, "sig-delivery");
  assert.equal(result.settleSignature, "sig-settle");
  assert.equal(arenaCalls, 1);
  assert.equal(chainHubCalls, 2);
});

test("orchestrator retries transient program failures", async () => {
  let attempts = 0;
  const flakyProgram: A2AProgramClient = {
    createSubtaskOrder: async () => {
      attempts += 1;
      if (attempts < 2) {
        throw new Error("transient");
      }
      return "sig-create";
    },
    submitSubtaskBid: async () => "sig-bid",
    assignSubtaskBid: async () => "sig-assign",
    submitSubtaskDelivery: async () => "sig-delivery",
    settleSubtask: async () => "sig-settle",
  };
  const orchestrator = new A2AOrchestrator(
    flakyProgram,
    new A2ARelayApi(new InMemoryRelayStore()),
    { retryPolicy: { maxAttempts: 3, baseDelayMs: 1 } },
  );

  const signature = await orchestrator.broadcastSubtask({
    requester: "requester",
    parentTaskId: 1n,
    subtaskId: 1,
    budget: 10n,
    bidDeadline: 20n,
    executeDeadline: 30n,
    requirementHash: "hash",
    escrowChannelId: 1n,
    threadId: 1n,
    policyHash: "policy",
  });

  assert.equal(signature, "sig-create");
  assert.equal(attempts, 2);
});
