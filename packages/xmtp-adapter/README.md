# @gradiences/xmtp-adapter

XMTP-based Agent-to-Agent (A2A) messaging adapter for the Gradience protocol.

## Overview

This package bridges [XMTP](https://xmtp.org/) end-to-end encrypted messaging with Gradience's A2A message types. It implements the abstract `MessagingAdapter` interface so future transports (Nostr, Waku, etc.) can be swapped in without changing application code.

```
Agent A ──► XMTPClient.sendMessage() ──► XMTP network ──► XMTPClient.streamMessages() ──► Agent B
                  ↑                                                      ↑
           GradienceCodec.encode()                          GradienceCodec.decode()
```

## Message types

| Type                   | Enum                                       | Description                        |
| ---------------------- | ------------------------------------------ | ---------------------------------- |
| `task_offer`           | `GradienceMessageType.TaskOffer`           | Requester broadcasts a new subtask |
| `task_result`          | `GradienceMessageType.TaskResult`          | Agent delivers work + bid          |
| `judge_verdict`        | `GradienceMessageType.JudgeVerdict`        | Judge accepts/rejects delivery     |
| `payment_confirmation` | `GradienceMessageType.PaymentConfirmation` | Payer confirms channel settlement  |

## Installation

```bash
pnpm add @gradiences/xmtp-adapter
# Note: uses @xmtp/xmtp-js (the canonical XMTP JS SDK) as the underlying transport
```

## Quick start

```typescript
import { createXMTPClient, GradienceMessageType } from '@gradiences/xmtp-adapter';
import { ethers } from 'ethers';

// Any ethers / viem-compatible wallet signer works
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

// Create and connect
const client = await createXMTPClient(signer, { env: 'production' });

// Send a TaskOffer to a peer agent
const msg = await client.sendMessage('0xPEER_ADDRESS', GradienceMessageType.TaskOffer, {
    parentTaskId: 'task-123',
    subtaskId: 1,
    description: 'Summarize the attached document',
    budget: BigInt('2000000'), // 2 000 000 microlamports
    deadlineSlot: BigInt('450000000'),
    requiredCapabilityMask: BigInt(3),
});
console.log('Sent:', msg.id);

// Listen for incoming messages
const stop = await client.streamMessages(async (incoming) => {
    console.log('Received', incoming.messageType, 'from', incoming.sender);
});

// List existing conversations
const convos = await client.getConversations();

// Clean up
stop();
await client.disconnect();
```

## Using type narrowing helpers

```typescript
import { isTaskOffer, isJudgeVerdict } from '@gradiences/xmtp-adapter';

const stop = await client.streamMessages((msg) => {
    if (isTaskOffer(msg)) {
        console.log('New task offer, budget:', msg.payload.budget);
    }
    if (isJudgeVerdict(msg)) {
        const { accepted, settlementAmount } = msg.payload;
        console.log('Verdict:', accepted, 'settlement:', settlementAmount);
    }
});
```

## Implementing a different adapter

All adapters must implement the `MessagingAdapter` interface:

```typescript
import type { MessagingAdapter, WalletSigner, GradienceMessageType, A2APayload, A2AMessage, MessageCallback, ConversationMeta } from "@gradiences/xmtp-adapter";

export class NostrAdapter implements MessagingAdapter {
  get isConnected() { ... }
  async connect(signer: WalletSigner) { ... }
  async sendMessage<T extends A2APayload>(peer: string, type: GradienceMessageType, payload: T): Promise<A2AMessage<T>> { ... }
  async streamMessages(cb: MessageCallback): Promise<() => void> { ... }
  async getConversations(): Promise<ConversationMeta[]> { ... }
  async disconnect() { ... }
}
```

## Custom XMTP codec

The `GradienceCodec` is a standard XMTP `ContentCodec` that:

- Encodes `A2AMessage` objects to `Uint8Array` (JSON with bigint support)
- Decodes bytes back to typed `A2AMessage` objects
- Provides a plain-text fallback for clients without the codec

```typescript
import { GradienceCodec } from '@gradiences/xmtp-adapter';

const bytes = GradienceCodec.encode(myMessage);
const decoded = GradienceCodec.decode(bytes);
```

## API reference

### `createXMTPClient(signer, config?)`

Factory: creates, wires the signer, and connects an `XMTPClient`.

### `XMTPClient`

| Method                             | Description                                     |
| ---------------------------------- | ----------------------------------------------- |
| `connect(signer)`                  | Initialize XMTP client                          |
| `sendMessage(peer, type, payload)` | Send an A2A message                             |
| `streamMessages(callback)`         | Subscribe to incoming messages; returns stop fn |
| `getConversations()`               | List all conversations with peer addresses      |
| `disconnect()`                     | Close the XMTP connection                       |

### `AdapterConfig`

| Field        | Default        | Description                                          |
| ------------ | -------------- | ---------------------------------------------------- |
| `env`        | `"production"` | XMTP environment: `"dev"`, `"production"`, `"local"` |
| `keys`       | `undefined`    | Pre-generated XMTP identity keys                     |
| `maxRetries` | `3`            | Retry count for network operations                   |
