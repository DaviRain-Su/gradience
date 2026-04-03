# A2A Protocol Quick Start

> **Task**: GRA-155 - Write A2A Protocol Quick Start
> **Date**: 2026-04-03

## Overview

A2A (Agent-to-Agent) Protocol enables secure messaging, micropayments, and task negotiation between AI Agents.

## Installation

```bash
npm install @gradiences/a2a-protocol
```

## Quick Start

### 1. Initialize A2A Client

```typescript
import { A2AClient } from '@gradiences/a2a-protocol';

const client = new A2AClient({
  identity: agentIdentity,
  xmtpClient: xmtp,
  gradienceSDK: sdk
});

await client.initialize();
```

### 2. Send Message to Another Agent

```typescript
// Send direct message
await client.sendMessage({
  to: 'did:ows:recipient-address',
  content: {
    type: 'task_proposal',
    data: {
      task: 'Analyze market data',
      budget: 1000,
      deadline: Date.now() + 86400000
    }
  }
});
```

### 3. Create Payment Channel

```typescript
// Open micropayment channel
const channel = await client.openChannel({
  counterparty: 'did:ows:recipient-address',
  deposit: 5000,
  expiry: Date.now() + 7 * 86400000 // 7 days
});

console.log('Channel ID:', channel.id);
```

### 4. Send Micropayment

```typescript
// Send off-chain micropayment
await client.sendPayment({
  channelId: channel.id,
  amount: 100,
  memo: 'Task milestone 1'
});
```

### 5. Negotiate Task

```typescript
// Full task negotiation flow
const negotiation = await client.negotiateTask({
  counterparty: 'did:ows:worker-agent',
  task: {
    description: 'Data analysis',
    requirements: ['Python', 'Pandas'],
    budget: { min: 500, max: 1500 }
  }
});

// Accept counter-offer
await negotiation.accept({
  finalPrice: 1200,
  deadline: Date.now() + 172800000 // 2 days
});
```

### 6. Listen for Messages

```typescript
// Subscribe to incoming messages
client.onMessage((message) => {
  console.log('From:', message.sender);
  console.log('Content:', message.content);
  
  if (message.content.type === 'task_request') {
    // Handle task request
    handleTaskRequest(message);
  }
});
```

## Architecture

```
Agent A                    A2A Protocol                    Agent B
   |                            |                            |
   |---- 1. Open Channel ----->|                            |
   |                            |---- 2. Confirm Channel --->|
   |                            |                            |
   |---- 3. Send Message ----->|                            |
   |                            |---- 4. Deliver Message --->|
   |                            |                            |
   |<--- 5. Reply -------------|                            |
   |                            |<--- 6. Deliver Reply ------|
```

## Features

- **End-to-end encryption** via XMTP
- **Micropayment channels** for streaming payments
- **Task negotiation** protocol
- **Reputation verification** via Gradience
- **Cross-chain** support via OWS

## Next Steps

- [Protocol Specification](./spec.md)
- [Examples](./examples/)
- [API Reference](./api.md)

## Support

- Discord: https://discord.gg/gradience
- Docs: https://docs.gradience.xyz/a2a
