import { AgentArenaAdapter } from "./adapters/agent-arena";
import { ChainHubAdapter } from "./adapters/chain-hub";
import { A2ARelayApi } from "./relay";
import type {
  A2AProgramClient,
  Address,
  SignedEnvelope,
  SubtaskBidInput,
  SubtaskBroadcastInput,
  SubtaskSettlementInput,
} from "./types";

export class A2AOrchestrator {
  private readonly threadSequence = new Map<string, number>();
  private readonly retryPolicy: { maxAttempts: number; baseDelayMs: number };

  constructor(
    private readonly program: A2AProgramClient,
    private readonly relay: A2ARelayApi,
    private readonly options: {
      agentArenaAdapter?: AgentArenaAdapter;
      chainHubAdapter?: ChainHubAdapter;
      retryPolicy?: { maxAttempts?: number; baseDelayMs?: number };
    } = {},
  ) {
    this.retryPolicy = {
      maxAttempts: options.retryPolicy?.maxAttempts ?? 3,
      baseDelayMs: options.retryPolicy?.baseDelayMs ?? 25,
    };
  }

  async broadcastSubtask(input: SubtaskBroadcastInput): Promise<string> {
    const signature = await this.withRetry(() => this.program.createSubtaskOrder(input));
    await this.publishEnvelope({
      threadId: input.threadId,
      sequence: this.nextSequence(input.threadId),
      from: input.requester,
      to: "*",
      messageType: "subtask_opened",
      nonce: BigInt(1 + this.nextNonceSalt(input.threadId)),
      payload: {
        parentTaskId: input.parentTaskId.toString(),
        subtaskId: input.subtaskId,
        budget: input.budget.toString(),
        policyHash: input.policyHash,
      },
    });
    return signature;
  }

  async submitBid(
    input: SubtaskBidInput & {
      threadId: bigint;
      requester: Address;
    },
  ): Promise<string> {
    const signature = await this.withRetry(() => this.program.submitSubtaskBid(input));
    await this.publishEnvelope({
      threadId: input.threadId,
      sequence: this.nextSequence(input.threadId),
      from: input.bidder,
      to: input.requester,
      messageType: "subtask_bid",
      nonce: BigInt(1 + this.nextNonceSalt(input.threadId)),
      payload: {
        parentTaskId: input.parentTaskId.toString(),
        subtaskId: input.subtaskId,
        quoteAmount: input.quoteAmount.toString(),
        etaSeconds: input.etaSeconds,
      },
    });
    return signature;
  }

  async assignLowestBid(input: {
    requester: Address;
    parentTaskId: bigint;
    subtaskId: number;
    threadId: bigint;
    policyHash: string;
    expectedPolicyHash: string;
    bids: Array<{ bidder: Address; quoteAmount: bigint }>;
  }): Promise<{ winner: Address; signature: string }> {
    if (input.bids.length === 0) {
      throw new Error("cannot assign bid: empty bids");
    }
    const winner = [...input.bids].sort((a, b) =>
      a.quoteAmount < b.quoteAmount ? -1 : a.quoteAmount > b.quoteAmount ? 1 : 0,
    )[0]!.bidder;

    this.options.chainHubAdapter?.verifyPolicyHash({
      expectedPolicyHash: input.expectedPolicyHash,
      actualPolicyHash: input.policyHash,
    });

    const signature = await this.withRetry(() =>
      this.program.assignSubtaskBid({
        requester: input.requester,
        parentTaskId: input.parentTaskId,
        subtaskId: input.subtaskId,
        winner,
      }),
    );

    await this.publishEnvelope({
      threadId: input.threadId,
      sequence: this.nextSequence(input.threadId),
      from: input.requester,
      to: winner,
      messageType: "subtask_assigned",
      nonce: BigInt(1 + this.nextNonceSalt(input.threadId)),
      payload: {
        parentTaskId: input.parentTaskId.toString(),
        subtaskId: input.subtaskId,
      },
    });
    return { winner, signature };
  }

  async deliverAndSettle(input: SubtaskSettlementInput): Promise<{
    deliverySignature: string;
    settleSignature: string;
  }> {
    if (input.settleAmount <= 0n) {
      throw new Error("settle amount must be positive");
    }
    const deliverySignature = await this.withRetry(() =>
      this.program.submitSubtaskDelivery({
        selectedAgent: input.selectedAgent,
        parentTaskId: input.parentTaskId,
        subtaskId: input.subtaskId,
        deliveryHash: input.deliveryHash,
      }),
    );
    const settleSignature = await this.withRetry(() =>
      this.program.settleSubtask({
        actor: input.actor,
        requester: input.requester,
        selectedAgent: input.selectedAgent,
        parentTaskId: input.parentTaskId,
        subtaskId: input.subtaskId,
        settleAmount: input.settleAmount,
        channelId: input.channelId,
      }),
    );

    await this.options.agentArenaAdapter?.onSubtaskSettled({
      parentTaskId: input.parentTaskId,
      subtaskId: input.subtaskId,
      winner: input.selectedAgent,
      settleAmount: input.settleAmount,
      deliveryHash: input.deliveryHash,
    });
    await this.options.chainHubAdapter?.onSubtaskSettled({
      taskId: input.parentTaskId,
      executionRefHash: input.deliveryHash,
    });

    return { deliverySignature, settleSignature };
  }

  private async publishEnvelope(input: {
    threadId: bigint;
    sequence: number;
    from: Address;
    to: Address;
    messageType: string;
    nonce: bigint;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const envelope = makeEnvelope(input);
    const response = await this.relay.handle({
      method: "POST",
      path: "/v1/envelopes/publish",
      body: {
        envelope,
        payload: input.payload,
      },
    });
    if (response.status !== 202) {
      throw new Error(`relay publish failed: ${response.status}`);
    }
  }

  private nextSequence(threadId: bigint): number {
    const key = threadId.toString();
    const next = (this.threadSequence.get(key) ?? 0) + 1;
    this.threadSequence.set(key, next);
    return next;
  }

  private nextNonceSalt(threadId: bigint): number {
    return this.threadSequence.get(threadId.toString()) ?? 1;
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let attempt = 0;
    for (;;) {
      attempt += 1;
      try {
        return await fn();
      } catch (error) {
        if (attempt >= this.retryPolicy.maxAttempts) {
          throw error;
        }
        const delayMs = this.retryPolicy.baseDelayMs * 2 ** (attempt - 1);
        await sleep(delayMs);
      }
    }
  }
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function makeEnvelope(input: {
  threadId: bigint;
  sequence: number;
  from: Address;
  to: Address;
  messageType: string;
  nonce: bigint;
  payload: Record<string, unknown>;
}): SignedEnvelope {
  const createdAt = Date.now();
  const payloadJson = JSON.stringify(input.payload);
  const bodyHash = fnv1a64Hex(payloadJson).padEnd(64, "0").slice(0, 64);
  const signatureSeed = fnv1a64Hex(
    `${input.from}:${input.threadId}:${input.sequence}:${input.nonce}`,
  )
    .padEnd(64, "0")
    .slice(0, 64);

  return {
    id: `${input.threadId.toString()}:${input.sequence}`,
    threadId: input.threadId,
    sequence: input.sequence,
    from: input.from,
    to: input.to,
    messageType: input.messageType,
    nonce: input.nonce,
    createdAt,
    bodyHash,
    signature: {
      r: signatureSeed.slice(0, 64),
      s: signatureSeed.slice(0, 64),
    },
    paymentMicrolamports: BigInt(payloadJson.length * 2 + 100),
  };
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
