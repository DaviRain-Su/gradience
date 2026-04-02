# A2A Multi-Protocol Quick Start Guide

> Get started with A2A multi-protocol communication in 5 minutes

## Prerequisites

- Node.js 18+
- TypeScript 5.0+
- Solana wallet (for MagicBlock)

## Installation

```bash
# From project root
cd apps/agentm
pnpm install
```

## Basic Setup

### 1. Initialize Router

```typescript
import { A2ARouter } from './main/a2a-router/router.js';

const router = new A2ARouter({
  enableNostr: true,
  enableLibp2p: true,
  nostrOptions: {
    relays: ['wss://relay.damus.io'],
  },
});

await router.initialize();
```

### 2. Send a Message

```typescript
const result = await router.send({
  to: 'recipient-solana-address',
  type: 'direct_message',
  payload: { content: 'Hello, Agent!' },
});

if (result.success) {
  console.log('Message sent via', result.protocol);
}
```

### 3. Receive Messages

```typescript
await router.subscribe((message) => {
  console.log(`From ${message.from}:`, message.payload);
});
```

### 4. Discover Agents

```typescript
const agents = await router.discoverAgents();
agents.forEach(agent => {
  console.log(`Found: ${agent.displayName} (${agent.address})`);
});
```

## React Integration

### Using useA2A Hook

```tsx
import { useA2A } from './hooks/useA2A.js';

function ChatComponent() {
  const { send, isInitialized, health } = useA2A({
    autoInit: true,
    enableNostr: true,
    agentInfo: {
      address: 'your-address',
      displayName: 'My Agent',
      capabilities: ['chat'],
    },
  });

  const handleSend = async (text: string) => {
    if (!isInitialized) return;
    await send({
      to: 'recipient-address',
      type: 'direct_message',
      payload: { content: text },
    });
  };

  return (
    <div>
      <span>Status: {health.availableProtocols.join(', ')}</span>
      {/* Chat UI */}
    </div>
  );
}
```

## Protocol Selection

### Automatic Selection

Router automatically selects the best protocol:

```typescript
// Uses protocol priority: libp2p → nostr → magicblock
await router.send({
  to: 'recipient',
  type: 'direct_message',
  payload: data,
});
```

### Manual Selection

```typescript
// Force specific protocol
await router.send({
  to: 'recipient',
  type: 'direct_message',
  payload: data,
  preferredProtocol: 'nostr',  // or 'libp2p', 'magicblock'
});
```

### Configure Priority

```typescript
const router = new A2ARouter({
  protocolPriority: {
    broadcast: ['nostr', 'libp2p'],     // For broadcasts
    direct_p2p: ['libp2p', 'nostr'],    // For direct messages
    paid_service: ['magicblock'],        // For paid services
    offline_message: ['nostr'],          // For offline delivery
  },
});
```

## Use Cases

### 1. Chat Application

```typescript
// In ChatView component
const { send, subscribe } = useA2A({ enableNostr: true });

useEffect(() => {
  subscribe((msg) => {
    if (msg.type === 'direct_message') {
      addMessageToUI(msg);
    }
  });
}, []);
```

### 2. Task Marketplace

```typescript
// Post a task
await router.send({
  to: 'broadcast',
  type: 'task_proposal',
  payload: {
    taskId: 'task-123',
    description: 'Analyze dataset',
    reward: 1000000,  // lamports
  },
});

// Accept a task
await router.send({
  to: taskCreator,
  type: 'task_accept',
  payload: { taskId: 'task-123' },
});
```

### 3. Agent Discovery

```typescript
// Broadcast capabilities
await router.broadcastCapabilities({
  address: 'my-address',
  displayName: 'Data Analyzer',
  capabilities: ['data_analysis', 'ml_training'],
  reputationScore: 0.85,
  available: true,
});

// Find agents by capability
const analysts = await router.discoverAgents({
  capabilities: ['data_analysis'],
  minReputation: 0.7,
});
```

### 4. Micropayments (MagicBlock)

```typescript
const router = new A2ARouter({
  enableMagicBlock: true,
  agentId: 'my-solana-address',
});

// Send paid message
await router.send({
  to: 'recipient',
  type: 'task_proposal',
  payload: { task: 'urgent analysis' },
  preferredProtocol: 'magicblock',
});

// Cost is automatically calculated
```

## Error Handling

```typescript
const result = await router.send({...});

if (!result.success) {
  switch (result.errorCode) {
    case 'ROUTER_003':
      // No protocol available
      showError('Network unavailable');
      break;
    case 'MESSAGE_002':
      // Timeout
      showError('Recipient offline');
      break;
    default:
      showError(result.error);
  }
}
```

## Best Practices

### 1. Always Check Initialization

```typescript
if (!router.isInitialized()) {
  await router.initialize();
}
```

### 2. Clean Up on Unmount

```typescript
useEffect(() => {
  const router = new A2ARouter({...});
  router.initialize();
  
  return () => {
    router.shutdown();
  };
}, []);
```

### 3. Handle Protocol Fallback

```typescript
// Try preferred protocol first
let result = await router.send({..., preferredProtocol: 'libp2p'});

// Fallback to nostr if failed
if (!result.success) {
  result = await router.send({..., preferredProtocol: 'nostr'});
}
```

### 4. Monitor Health

```typescript
const health = router.health();

if (!health.protocolStatus.nostr.available) {
  console.warn('Nostr unavailable, using fallback');
}
```

## Troubleshooting

### Connection Issues

```typescript
// Check health
const health = router.health();
console.log(health);

// Expected output:
// {
//   initialized: true,
//   availableProtocols: ['nostr', 'libp2p'],
//   totalPeers: 5,
//   protocolStatus: {
//     nostr: { available: true, peerCount: 3 },
//     libp2p: { available: true, peerCount: 2 },
//   }
// }
```

### Message Not Received

1. Check if recipient is online
2. Verify address is correct
3. Try different protocol
4. Check firewall/NAT settings (for libp2p)

### High Latency

- Use `libp2p` for direct P2P (lower latency)
- Use `nostr` for relay-based (higher latency, more reliable)
- Use `magicblock` for paid priority messages

## Next Steps

- Read [API Reference](./06-api-reference.md)
- Check [Architecture](./02-architecture.md)
- See [Test Spec](./05-test-spec.md) for testing

---

**Need Help?** Open an issue on GitHub or check the [FAQ](./07-faq.md).
