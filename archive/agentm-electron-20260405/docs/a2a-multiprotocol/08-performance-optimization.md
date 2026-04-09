# A2A Multi-Protocol Performance Optimization

> Performance tuning and optimization guidelines

## Table of Contents

- [Performance Metrics](#performance-metrics)
- [Protocol-Specific Optimizations](#protocol-specific-optimizations)
- [Router Optimizations](#router-optimizations)
- [Memory Management](#memory-management)
- [Network Optimization](#network-optimization)
- [Monitoring](#monitoring)

---

## Performance Metrics

### Target Metrics

| Metric                   | Target  | Measurement                  |
| ------------------------ | ------- | ---------------------------- |
| Message Latency (P2P)    | < 100ms | libp2p direct connection     |
| Message Latency (Relay)  | < 500ms | Nostr relay round-trip       |
| Discovery Time           | < 5s    | Agent discovery response     |
| Memory Usage             | < 100MB | Per protocol adapter         |
| Connection Establishment | < 3s    | libp2p peer connection       |
| Relay Reconnection       | < 10s   | Nostr relay failure recovery |

### Current Benchmarks

```typescript
// Benchmark results (local test)
const benchmarks = {
    nostr: {
        sendLatency: '250ms', // Relay round-trip
        receiveLatency: '50ms', // Event processing
        memoryPerConnection: '5MB', // Per relay
    },
    libp2p: {
        dialLatency: '500ms', // Initial connection
        sendLatency: '20ms', // Direct P2P
        memoryPerPeer: '2MB', // Per connected peer
    },
    magicblock: {
        estimateLatency: '1ms', // Local calculation
        sendLatency: '50ms', // In-memory transport
        memoryOverhead: '1MB', // Fixed overhead
    },
};
```

---

## Protocol-Specific Optimizations

### Nostr Optimizations

#### 1. Relay Pool Management

```typescript
// Optimize relay connections
const nostrOptions = {
    relays: ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol'],
    // Connection pooling
    maxConcurrentRequests: 10,
    relayTimeout: 5000, // 5s timeout
};
```

#### 2. Event Batch Processing

```typescript
// Batch subscribe requests
const batchSubscribe = async (filters: NostrFilter[]) => {
    const batch = filters.slice(0, 10); // Max 10 concurrent
    return Promise.all(batch.map((f) => nostr.subscribe(f)));
};
```

#### 3. Caching Strategy

```typescript
// Cache agent profiles
const profileCache = new Map<string, { profile: AgentProfile; expires: number }>();

const getCachedProfile = (pubkey: string): AgentProfile | null => {
    const cached = profileCache.get(pubkey);
    if (cached && cached.expires > Date.now()) {
        return cached.profile;
    }
    return null;
};
```

### libp2p Optimizations

#### 1. Connection Limits

```typescript
// Limit concurrent connections
const libp2pOptions = {
    maxConnections: 50, // Max peers
    minConnections: 5, // Maintain minimum
    maxPendingConnections: 10, // Pending dial queue
};
```

#### 2. DHT Client Mode

```typescript
// Use client mode for lighter footprint
const libp2pOptions = {
    dhtClientMode: true, // Don't store DHT records
};
```

#### 3. Protocol Selection

```typescript
// Prefer direct connections over relay
const connectionPriorities = [
    'webrtc-direct', // Best: direct WebRTC
    'webrtc', // Good: relayed WebRTC
    'wss', // Okay: WebSocket secure
    'ws', // Fallback: WebSocket
];
```

### MagicBlock Optimizations

#### 1. Payment Batching

```typescript
// Batch multiple payments
const batchPayments = async (payments: Payment[]) => {
    const total = payments.reduce((sum, p) => sum + p.amount, 0);
    return magicblock.sendBatch(payments, total);
};
```

#### 2. Transport Reuse

```typescript
// Reuse in-memory hub
const sharedHub = new InMemoryMagicBlockHub({ latencyMs: 10 });

const adapter1 = new MagicBlockAdapter({ hub: sharedHub, ... });
const adapter2 = new MagicBlockAdapter({ hub: sharedHub, ... });
```

---

## Router Optimizations

### 1. Protocol Selection Cache

```typescript
// Cache protocol selection results
class ProtocolSelector {
    private cache = new Map<string, ProtocolType>();
    private cacheTtl = 30000; // 30s

    select(intent: A2AIntent): ProtocolType {
        const key = `${intent.type}-${intent.to}`;
        const cached = this.cache.get(key);

        if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
            return cached.protocol;
        }

        const protocol = this.doSelect(intent);
        this.cache.set(key, { protocol, timestamp: Date.now() });
        return protocol;
    }
}
```

### 2. Message Batching

```typescript
// Batch small messages
class MessageBatcher {
    private batch: A2AMessage[] = [];
    private flushInterval = 100; // ms

    add(message: A2AMessage) {
        this.batch.push(message);
        if (this.batch.length >= 10) {
            this.flush();
        }
    }

    private flush() {
        if (this.batch.length === 0) return;
        router.sendBatch(this.batch);
        this.batch = [];
    }
}
```

### 3. Lazy Initialization

```typescript
// Initialize protocols on demand
class LazyRouter {
    private adapters = new Map<ProtocolType, ProtocolAdapter>();

    async getAdapter(protocol: ProtocolType): Promise<ProtocolAdapter> {
        let adapter = this.adapters.get(protocol);
        if (!adapter) {
            adapter = await this.createAdapter(protocol);
            this.adapters.set(protocol, adapter);
        }
        return adapter;
    }
}
```

---

## Memory Management

### 1. Subscription Cleanup

```typescript
// Always cleanup subscriptions
useEffect(() => {
    const unsubscribe = router.subscribe(handler);

    return () => {
        unsubscribe(); // Critical for memory
    };
}, []);
```

### 2. Message Retention

```typescript
// Limit message history
const MAX_MESSAGES = 1000;

const messageStore = {
    messages: [] as A2AMessage[],

    add(message: A2AMessage) {
        this.messages.push(message);
        if (this.messages.length > MAX_MESSAGES) {
            this.messages = this.messages.slice(-MAX_MESSAGES);
        }
    },
};
```

### 3. Connection Pool Cleanup

```typescript
// Periodic cleanup of idle connections
setInterval(() => {
    const now = Date.now();
    for (const [peerId, conn] of connections) {
        if (now - conn.lastActivity > 300000) {
            // 5min idle
            conn.close();
            connections.delete(peerId);
        }
    }
}, 60000); // Check every minute
```

---

## Network Optimization

### 1. Adaptive Timeouts

```typescript
// Adjust timeout based on protocol
const getTimeout = (protocol: ProtocolType): number => {
    switch (protocol) {
        case 'libp2p':
            return 5000; // Fast P2P
        case 'nostr':
            return 10000; // Relay-based
        case 'magicblock':
            return 3000; // Local
        default:
            return 10000;
    }
};
```

### 2. Retry Strategy

```typescript
// Exponential backoff
const retryWithBackoff = async (fn: () => Promise<void>, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await sleep(Math.pow(2, i) * 1000); // 1s, 2s, 4s
        }
    }
};
```

### 3. Protocol Fallback

```typescript
// Fast fallback on failure
const sendWithFallback = async (intent: A2AIntent) => {
    const protocols = ['libp2p', 'nostr', 'magicblock'];

    for (const protocol of protocols) {
        const result = await router.send({ ...intent, preferredProtocol: protocol });
        if (result.success) return result;
    }

    throw new Error('All protocols failed');
};
```

---

## Monitoring

### 1. Performance Metrics

```typescript
// Track key metrics
const metrics = {
    messagesSent: 0,
    messagesReceived: 0,
    averageLatency: 0,
    protocolDistribution: {
        nostr: 0,
        libp2p: 0,
        magicblock: 0,
    },
};

// Update on each message
router.subscribe((msg) => {
    metrics.messagesReceived++;
    metrics.protocolDistribution[msg.protocol!]++;
});
```

### 2. Health Checks

```typescript
// Periodic health monitoring
setInterval(() => {
    const health = router.health();

    // Alert on issues
    if (health.totalPeers === 0) {
        console.warn('No peers connected');
    }

    if (!health.protocolStatus.nostr.available) {
        console.warn('Nostr unavailable');
    }
}, 30000);
```

### 3. Memory Profiling

```typescript
// Monitor memory usage
const logMemory = () => {
    const usage = process.memoryUsage();
    console.log({
        rss: `${(usage.rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        external: `${(usage.external / 1024 / 1024).toFixed(2)} MB`,
    });
};

setInterval(logMemory, 60000);
```

---

## Optimization Checklist

### Development

- [ ] Use `dhtClientMode: true` for libp2p
- [ ] Limit `maxConnections` to 50
- [ ] Implement message batching
- [ ] Add subscription cleanup
- [ ] Cache protocol selection

### Production

- [ ] Monitor memory usage
- [ ] Set up health alerts
- [ ] Configure adaptive timeouts
- [ ] Implement retry with backoff
- [ ] Enable protocol fallback

### Testing

- [ ] Benchmark message latency
- [ ] Test with 100+ peers
- [ ] Measure memory over 24h
- [ ] Verify cleanup on unmount
- [ ] Test network failure recovery

---

## References

- [libp2p Performance](https://docs.libp2p.io/concepts/performance/)
- [Nostr Implementation Guide](https://github.com/nostr-protocol/nips)
- [Node.js Memory Management](https://nodejs.org/en/docs/guides/dont-block-the-event-loop/)
