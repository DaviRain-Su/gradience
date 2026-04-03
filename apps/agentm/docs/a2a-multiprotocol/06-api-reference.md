# A2A Multi-Protocol API Documentation

> API reference for A2A Router and protocol adapters

## Table of Contents

- [A2ARouter](#a2arouter)
- [Protocol Adapters](#protocol-adapters)
- [React Hook](#react-hook)
- [Types](#types)
- [Error Handling](#error-handling)

---

## A2ARouter

Main router class for multi-protocol A2A communication.

### Constructor

```typescript
import { A2ARouter } from './a2a-router/router.js';

const router = new A2ARouter({
  // Protocol enablement
  enableNostr: true,      // Enable Nostr protocol (default: true)
  enableLibp2p: true,     // Enable libp2p protocol (default: true)
  enableMagicBlock: false, // Enable MagicBlock protocol (default: false)
  
  // Protocol options
  nostrOptions: {
    relays: ['wss://relay.example.com'],
    privateKey: 'nsec1...',
  },
  libp2pOptions: {
    bootstrapList: ['/ip4/.../tcp/.../p2p/...'],
    topics: ['agent-presence'],
  },
  magicblockOptions: {
    agentId: 'solana-address',
    paymentPolicy: {
      baseMicrolamports: 100,
      perByteMicrolamports: 2,
    },
  },
  
  // Router options
  agentId: 'your-solana-address',
  protocolPriority: {
    broadcast: ['nostr', 'libp2p'],
    direct_p2p: ['libp2p', 'nostr'],
    paid_service: ['magicblock'],
    offline_message: ['nostr'],
  },
  healthCheckInterval: 30000,  // ms
  messageTimeout: 10000,       // ms
});
```

### Methods

#### `initialize(): Promise<void>`

Initialize the router and all enabled protocol adapters.

```typescript
try {
  await router.initialize();
  console.log('Router initialized');
} catch (error) {
  console.error('Initialization failed:', error);
}
```

#### `shutdown(): Promise<void>`

Shutdown the router and all protocol adapters.

```typescript
await router.shutdown();
```

#### `isInitialized(): boolean`

Check if router is initialized.

```typescript
if (router.isInitialized()) {
  // Router is ready
}
```

#### `send(intent: A2AIntent): Promise<A2AResult>`

Send a message via the best available protocol.

```typescript
const result = await router.send({
  to: 'recipient-solana-address',
  type: 'direct_message',
  payload: { content: 'Hello!' },
  preferredProtocol: 'nostr',  // optional
  timeout: 5000,               // optional
});

if (result.success) {
  console.log('Sent via', result.protocol);
} else {
  console.error('Failed:', result.error);
}
```

#### `subscribe(handler): Promise<() => Promise<void>>`

Subscribe to incoming messages.

```typescript
const unsubscribe = await router.subscribe((message) => {
  console.log('Received:', message);
  // message: { id, from, to, type, timestamp, payload, protocol }
});

// Later: unsubscribe
await unsubscribe();
```

#### `discoverAgents(filter?): Promise<AgentInfo[]>`

Discover agents via all available protocols.

```typescript
const agents = await router.discoverAgents({
  capabilities: ['task_execution'],
  minReputation: 0.5,
});

agents.forEach(agent => {
  console.log(agent.address, agent.displayName);
});
```

#### `broadcastCapabilities(agentInfo): Promise<void>`

Broadcast agent capabilities to the network.

```typescript
await router.broadcastCapabilities({
  address: 'your-solana-address',
  displayName: 'My Agent',
  capabilities: ['task_execution', 'data_analysis'],
  reputationScore: 0.85,
  available: true,
});
```

#### `health(): RouterHealthStatus`

Get router health status.

```typescript
const health = router.health();
console.log({
  initialized: health.initialized,
  protocols: health.availableProtocols,
  peers: health.totalPeers,
  nostr: health.protocolStatus.nostr,
  libp2p: health.protocolStatus.libp2p,
  magicblock: health.protocolStatus.magicblock,
});
```

---

## Protocol Adapters

### NostrAdapter

Nostr relay-based communication.

```typescript
import { NostrAdapter } from './a2a-router/adapters/nostr-adapter.js';

const adapter = new NostrAdapter({
  relays: ['wss://relay.damus.io', 'wss://relay.nostr.band'],
  privateKey: 'nsec1...',  // Optional: auto-generated if not provided
});

await adapter.initialize();
```

**Features:**
- Relay-based messaging
- NIP-01 compatible
- Automatic relay reconnection
- Public key-based addressing

### Libp2pAdapter

Direct P2P communication.

```typescript
import { Libp2pAdapter } from './a2a-router/adapters/libp2p-adapter.js';

const adapter = new Libp2pAdapter({
  bootstrapList: ['/ip4/127.0.0.1/tcp/4001/p2p/...'],
  topics: ['agent-presence'],
  dhtClientMode: true,
  maxConnections: 50,
});

await adapter.initialize();
```

**Features:**
- Direct peer-to-peer connections
- DHT-based peer discovery
- PubSub messaging
- NAT traversal support

### MagicBlockAdapter

Micropayment-based messaging.

```typescript
import { MagicBlockAdapter } from './a2a-router/adapters/magicblock-adapter.js';

const adapter = new MagicBlockAdapter({
  agentId: 'solana-address',
  paymentPolicy: {
    baseMicrolamports: 100,
    perByteMicrolamports: 2,
  },
});

await adapter.initialize();

// Estimate payment
const cost = adapter.estimatePayment('task_proposal', 'task data');
console.log(`Cost: ${cost} microlamports`);
```

**Features:**
- Automatic micropayment calculation
- Per-byte billing
- In-memory transport (default)
- Custom transport support

---

## React Hook

### useA2A

React hook for A2A communication in components.

```typescript
import { useA2A } from './hooks/useA2A.js';

function MyComponent() {
  const {
    router,
    isInitialized,
    isLoading,
    error,
    initialize,
    shutdown,
    send,
    subscribe,
    discoverAgents,
    broadcastCapabilities,
    health,
    agents,
    refreshAgents,
  } = useA2A({
    autoInit: true,
    enableNostr: true,
    enableLibp2p: true,
    agentInfo: {
      address: 'your-address',
      displayName: 'My Agent',
      capabilities: ['task_execution'],
    },
  });

  // Send message
  const handleSend = async () => {
    const result = await send({
      to: 'recipient-address',
      type: 'direct_message',
      payload: { content: 'Hello!' },
    });
  };

  // Subscribe to messages
  useEffect(() => {
    if (!isInitialized) return;
    
    let unsubscribe: (() => Promise<void>) | null = null;
    
    subscribe((message) => {
      console.log('Received:', message);
    }).then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isInitialized]);

  return (
    <div>
      {isLoading && <span>Loading...</span>}
      {error && <span>Error: {error.message}</span>}
      <span>Protocols: {health.availableProtocols.join(', ')}</span>
      <span>Peers: {health.totalPeers}</span>
    </div>
  );
}
```

---

## Types

### A2AMessage

```typescript
interface A2AMessage {
  id: string;
  from: string;           // Sender Solana address
  to: string;             // Recipient Solana address
  type: A2AMessageType;
  timestamp: number;      // Unix ms
  payload: unknown;
  protocol?: ProtocolType;
}

type A2AMessageType =
  | 'capability_offer'
  | 'capability_query'
  | 'task_proposal'
  | 'task_accept'
  | 'task_reject'
  | 'task_counter'
  | 'direct_message'
  | 'reputation_query'
  | 'reputation_response'
  | 'payment_request'
  | 'payment_confirm';

type ProtocolType = 'nostr' | 'libp2p' | 'magicblock';
```

### A2AIntent

```typescript
interface A2AIntent {
  to: string;
  type: A2AMessageType;
  payload: unknown;
  preferredProtocol?: ProtocolType;
  requireReceipt?: boolean;
  timeout?: number;
}
```

### A2AResult

```typescript
interface A2AResult {
  success: boolean;
  messageId: string;
  protocol: ProtocolType;
  error?: string;
  errorCode?: string;
  timestamp: number;
}
```

### AgentInfo

```typescript
interface AgentInfo {
  address: string;           // Solana address
  displayName?: string;
  capabilities: string[];
  reputationScore: number;   // 0-1
  available: boolean;
  lastSeenAt?: number;       // Unix ms
}
```

### RouterHealthStatus

```typescript
interface RouterHealthStatus {
  initialized: boolean;
  availableProtocols: ProtocolType[];
  protocolStatus: Record<ProtocolType, ProtocolHealthStatus>;
  totalPeers: number;
  activeSubscriptions: number;
  lastError?: string;
}

interface ProtocolHealthStatus {
  available: boolean;
  peerCount: number;
  subscribedTopics: string[];
  lastActivityAt?: number;
  error?: string;
}
```

---

## Error Handling

### Error Codes

| Code | Description |
|------|-------------|
| `ROUTER_001` | Router not initialized |
| `ROUTER_002` | Router already initialized |
| `ROUTER_003` | No protocol available |
| `ROUTER_004` | Send failed |
| `ROUTER_005` | Discover failed |
| `PROTOCOL_001` | Protocol not available |
| `PROTOCOL_002` | Protocol send failed |
| `PROTOCOL_003` | Protocol subscribe failed |
| `PROTOCOL_004` | Protocol discover failed |
| `MESSAGE_001` | Invalid message |
| `MESSAGE_002` | Message timeout |
| `MESSAGE_003` | Message rejected |

### Handling Errors

```typescript
const result = await router.send({
  to: 'recipient',
  type: 'direct_message',
  payload: { content: 'Hello' },
});

if (!result.success) {
  switch (result.errorCode) {
    case 'ROUTER_003':
      console.error('No protocol available - check network connection');
      break;
    case 'PROTOCOL_002':
      console.error('Send failed - retry with different protocol');
      break;
    case 'MESSAGE_002':
      console.error('Message timeout - recipient may be offline');
      break;
    default:
      console.error('Unknown error:', result.error);
  }
}
```

---

## Examples

### Basic Messaging

```typescript
const router = new A2ARouter({ enableNostr: true });
await router.initialize();

// Send
await router.send({
  to: 'recipient-address',
  type: 'direct_message',
  payload: { content: 'Hello!' },
});

// Receive
await router.subscribe((msg) => {
  console.log(`${msg.from}: ${msg.payload}`);
});
```

### Multi-Protocol Fallback

```typescript
const router = new A2ARouter({
  enableNostr: true,
  enableLibp2p: true,
  enableMagicBlock: true,
  protocolPriority: {
    direct_p2p: ['libp2p', 'nostr'],  // Try libp2p first
    paid_service: ['magicblock'],      // Use MagicBlock for paid services
  },
});
```

### Agent Discovery

```typescript
// Broadcast presence
await router.broadcastCapabilities({
  address: 'my-address',
  displayName: 'Task Executor',
  capabilities: ['task_execution', 'code_review'],
  reputationScore: 0.9,
  available: true,
});

// Discover agents
const agents = await router.discoverAgents({
  capabilities: ['task_execution'],
  minReputation: 0.7,
});
```

---

## See Also

- [Architecture](./02-architecture.md)
- [Technical Spec](./03-technical-spec.md)
- [Test Spec](./05-test-spec.md)
