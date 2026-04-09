# Phase 3: Technical Spec — A2A Multi-Protocol Communication Layer

> **目的**: 将架构设计转化为可直接编码的精确规格
> **输入**: `02-architecture.md`
> **输出物**: 本文档，代码必须与本文档 100% 一致

---

## 3.1 常量定义

### 3.1.1 Nostr 配置常量

```typescript
// apps/agentm/src/main/a2a-router/constants.ts

export const NOSTR_CONFIG = {
    // 默认 relay 列表
    DEFAULT_RELAYS: ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol', 'wss://relay.snort.social'],

    // Event kinds
    KINDS: {
        AGENT_PRESENCE: 10002, // 自定义: Agent 存在广播
        AGENT_CAPABILITY: 10003, // 自定义: Agent 能力声明
        ENCRYPTED_DM: 4, // nip-04 加密私信
        REPUTATION_PROOF: 10004, // 自定义: 声誉证明
    },

    // 超时配置
    TIMEOUTS: {
        PUBLISH: 5000, // 5s
        SUBSCRIBE: 10000, // 10s
        CONNECT: 5000, // 5s
    },

    // 重试配置
    RETRY: {
        MAX_ATTEMPTS: 3,
        BACKOFF_MS: 1000,
    },
} as const;
```

### 3.1.2 libp2p 配置常量

```typescript
export const LIBP2P_CONFIG = {
    // Bootstrap 节点
    BOOTSTRAP_LIST: [
        '/dns4/bootstrap.libp2p.io/tcp/443/wss/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
        // 可添加自建节点
    ],

    // PubSub 主题
    TOPICS: {
        AGENT_DISCOVERY: 'gradience/agent/discovery/v1',
        TASK_NEGOTIATION: 'gradience/task/negotiation/v1',
        REPUTATION_QUERY: 'gradience/reputation/query/v1',
    },

    // DHT 配置
    DHT: {
        PROTOCOL_PREFIX: '/gradience/kad/1.0.0',
        ANNOUNCE_INTERVAL_MS: 60000, // 60s
    },

    // 连接配置
    CONNECTION: {
        MAX_CONNECTIONS: 50,
        MIN_CONNECTIONS: 5,
        AUTO_DIAL_INTERVAL: 10000,
    },
} as const;
```

### 3.1.3 A2A Router 配置常量

```typescript
export const ROUTER_CONFIG = {
    // 协议选择优先级
    PROTOCOL_PRIORITY: {
        BROADCAST: ['nostr', 'libp2p'],
        DIRECT_P2P: ['libp2p', 'nostr'],
        PAID_SERVICE: ['magicblock'],
        OFFLINE_MESSAGE: ['nostr'],
    },

    // 健康检查间隔
    HEALTH_CHECK_INTERVAL_MS: 30000, // 30s

    // 消息超时
    MESSAGE_TIMEOUT_MS: 30000, // 30s
} as const;
```

---

## 3.2 数据结构定义

### 3.2.1 Nostr Event 结构

```typescript
// apps/agentm/src/shared/nostr-types.ts

import type { Event as NostrEvent } from 'nostr-tools';

export interface AgentPresenceEvent {
    kind: 10002;
    pubkey: string; // Agent's Nostr pubkey
    created_at: number;
    content: string; // JSON stringified AgentPresenceContent
    tags: string[][];
}

export interface AgentPresenceContent {
    agent: string; // Solana address
    display_name: string;
    capabilities: string[]; // ['defi', 'coding', 'writing']
    reputation_score: number;
    available: boolean;
    endpoint?: string; // Optional: libp2p multiaddr
}

export interface EncryptedDMEvent {
    kind: 4;
    pubkey: string;
    created_at: number;
    content: string; // nip-04 encrypted
    tags: [['p', string]]; // recipient pubkey
}

export interface EncryptedDMContent {
    type: 'NEGOTIATION' | 'CHAT' | 'SYSTEM';
    payload: unknown;
    timestamp: number;
}
```

### 3.2.2 libp2p 消息结构

```typescript
// apps/agentm/src/shared/libp2p-types.ts

export interface Libp2pMessage {
    version: '1.0';
    type: Libp2pMessageType;
    from: string; // Agent Solana address
    timestamp: number;
    payload: Uint8Array;
    signature: string; // Solana signature for verification
}

export type Libp2pMessageType =
    | 'CAPABILITY_OFFER'
    | 'TASK_NEGOTIATION'
    | 'REPUTATION_QUERY'
    | 'REPUTATION_RESPONSE'
    | 'FILE_TRANSFER';

export interface CapabilityOfferPayload {
    agent: string;
    capabilities: string[];
    pricing: Record<string, number>;
    endpoint: string; // multiaddr
}

export interface TaskNegotiationPayload {
    task_id?: string; // Optional: existing task
    task_type: string;
    requirements: string;
    budget: number;
    deadline: number;
    counter_offer?: boolean;
}
```

### 3.2.3 A2A Router 数据结构

```typescript
// apps/agentm/src/shared/a2a-router-types.ts

export interface A2AIntent {
    id: string; // UUID
    type: A2AIntentType;
    from: string; // Agent address
    to?: string; // Target agent (optional for broadcast)
    payload: unknown;
    metadata: IntentMetadata;
}

export type A2AIntentType = 'BROADCAST' | 'DIRECT_P2P' | 'PAID_SERVICE' | 'OFFLINE_MESSAGE';

export interface IntentMetadata {
    timestamp: number;
    timeout?: number;
    priority?: 'high' | 'normal' | 'low';
    retryPolicy?: RetryPolicy;
}

export interface RetryPolicy {
    maxAttempts: number;
    backoffMs: number;
}

export interface A2AResult {
    success: boolean;
    intentId: string;
    protocol: string;
    latencyMs: number;
    error?: A2AError;
}

export interface A2AError {
    code: string;
    message: string;
    retryable: boolean;
}
```

---

## 3.3 接口定义

### 3.3.1 NostrClient 接口

```typescript
// apps/agentm/src/main/a2a-router/nostr-client.ts

export interface NostrClient {
    // 连接管理
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;

    // 身份
    getPublicKey(): string;

    // 广播
    publishPresence(profile: AgentProfile): Promise<string>; // returns event id
    publishCapability(capability: Capability): Promise<string>;

    // 私信
    sendDM(to: string, content: string): Promise<string>;
    subscribeDMs(callback: (event: EncryptedDMEvent) => void): Promise<() => void>;

    // 发现
    subscribePresence(filter: PresenceFilter, callback: (event: AgentPresenceEvent) => void): Promise<() => void>;
    queryPresence(filter: PresenceFilter, limit: number): Promise<AgentPresenceEvent[]>;

    // 健康
    health(): Promise<NostrHealthStatus>;
}

export interface NostrHealthStatus {
    connected: boolean;
    relayCount: number;
    activeSubscriptions: number;
    lastEventAt?: number;
}

export interface PresenceFilter {
    capabilities?: string[];
    minReputation?: number;
    availableOnly?: boolean;
}
```

### 3.3.2 Libp2pNode 接口

```typescript
// apps/agentm/src/main/a2a-router/libp2p-node.ts

export interface Libp2pNode {
    // 生命周期
    start(): Promise<void>;
    stop(): Promise<void>;
    isRunning(): boolean;

    // 身份
    getPeerId(): string;
    getMultiaddrs(): string[];

    // 连接
    dial(peerId: string): Promise<Connection>;
    dial(multiaddr: string): Promise<Connection>;
    hangUp(peerId: string): Promise<void>;
    getConnections(): Connection[];

    // PubSub
    publish(topic: string, data: Uint8Array): Promise<void>;
    subscribe(topic: string, handler: (msg: Message) => void): Promise<void>;
    unsubscribe(topic: string): Promise<void>;

    // DHT
    findPeer(peerId: string): Promise<PeerInfo>;
    provide(cid: string): Promise<void>;
    findProviders(cid: string): Promise<PeerInfo[]>;

    // 健康
    health(): Promise<Libp2pHealthStatus>;
}

export interface Libp2pHealthStatus {
    running: boolean;
    peerCount: number;
    topics: string[];
    dhtSize: number;
}
```

### 3.3.3 A2ARouter 接口

```typescript
// apps/agentm/src/main/a2a-router/router.ts

export interface A2ARouter {
    // 初始化
    initialize(): Promise<void>;
    shutdown(): Promise<void>;

    // 发送
    send(intent: A2AIntent): Promise<A2AResult>;
    sendBroadcast(profile: AgentProfile): Promise<A2AResult>;
    sendDM(to: string, message: string): Promise<A2AResult>;
    sendP2P(to: string, payload: unknown): Promise<A2AResult>;
    sendPaidService(to: string, service: string, payment: PaymentTerms): Promise<A2AResult>;

    // 接收
    onMessage(handler: (message: A2AMessage) => void): () => void;
    onPresence(handler: (presence: AgentPresence) => void): () => void;

    // 发现
    discoverAgents(filter: DiscoveryFilter): Promise<AgentPresence[]>;

    // 状态
    getStatus(): RouterStatus;
}

export interface RouterStatus {
    initialized: boolean;
    protocols: Record<string, ProtocolStatus>;
    messageCount: number;
    errorCount: number;
}

export interface ProtocolStatus {
    available: boolean;
    health: 'healthy' | 'degraded' | 'unhealthy';
    latencyMs: number;
    lastUsedAt?: number;
}
```

---

## 3.4 算法与计算

### 3.4.1 协议选择算法

```typescript
function selectProtocol(intent: A2AIntent, statuses: ProtocolStatus[]): ProtocolAdapter {
    // 1. 根据意图类型获取候选协议优先级
    const candidates = ROUTER_CONFIG.PROTOCOL_PRIORITY[intent.type];

    // 2. 过滤不可用的协议
    const available = candidates.filter((name) => {
        const status = statuses.find((s) => s.name === name);
        return status?.available && status.health !== 'unhealthy';
    });

    // 3. 选择延迟最低的可用协议
    if (available.length > 0) {
        return available
            .map((name) => ({ name, status: statuses.find((s) => s.name === name)! }))
            .sort((a, b) => a.status.latencyMs - b.status.latencyMs)[0];
    }

    // 4. 无可用协议，尝试 fallback
    throw new A2AError('NO_AVAILABLE_PROTOCOL', 'All protocols unavailable', false);
}
```

### 3.4.2 Nostr Relay 选择算法

```typescript
function selectRelays(relays: RelayStatus[], minCount: number = 3): string[] {
    // 1. 按健康状态排序
    const healthy = relays.filter((r) => r.connected && r.latencyMs < 1000).sort((a, b) => a.latencyMs - b.latencyMs);

    // 2. 选择前 N 个
    const selected = healthy.slice(0, minCount);

    // 3. 如果不足，添加降级 relay
    if (selected.length < minCount) {
        const degraded = relays.filter((r) => r.connected && !healthy.includes(r)).slice(0, minCount - selected.length);
        selected.push(...degraded);
    }

    return selected.map((r) => r.url);
}
```

### 3.4.3 libp2p Peer 验证算法

```typescript
async function verifyPeer(peerId: string, agentAddress: string): Promise<boolean> {
    // 1. 从 DHT 获取 peer 的 Agent 声明
    const record = await dht.get(`/${LIBP2P_CONFIG.DHT.PROTOCOL_PREFIX}/agent/${peerId}`);
    if (!record) return false;

    // 2. 验证声明中的 Solana 签名
    const { agent, signature, timestamp } = decode(record);

    // 3. 检查时间戳（防止重放）
    if (Date.now() - timestamp > 86400000) return false; // 24h expiry

    // 4. 验证签名
    const valid = await solanaVerify(agent, signature, peerId);
    if (!valid) return false;

    // 5. 验证与声称的 Agent 地址匹配
    return agent === agentAddress;
}
```

---

## 3.5 错误处理

### 3.5.1 错误码定义

```typescript
export const A2A_ERROR_CODES = {
    // 协议层错误 (1000-1999)
    NOSTR_PUBLISH_FAILED: 1000,
    NOSTR_RELAY_UNAVAILABLE: 1001,
    NOSTR_ENCRYPTION_FAILED: 1002,

    LIBP2P_DIAL_FAILED: 1100,
    LIBP2P_PEER_NOT_FOUND: 1101,
    LIBP2P_PUBLISH_FAILED: 1102,

    MAGICBLOCK_PAYMENT_FAILED: 1200,
    MAGICBLOCK_INSUFFICIENT_BALANCE: 1201,

    // 路由层错误 (2000-2999)
    NO_AVAILABLE_PROTOCOL: 2000,
    PROTOCOL_SELECTION_FAILED: 2001,
    INTENT_TIMEOUT: 2002,
    INVALID_INTENT: 2003,

    // 安全层错误 (3000-3999)
    PEER_VERIFICATION_FAILED: 3000,
    SIGNATURE_INVALID: 3001,
    REPLAY_ATTACK_DETECTED: 3002,
} as const;
```

---

## 3.6 边界条件

| #   | 边界条件                       | 预期行为                                     |
| --- | ------------------------------ | -------------------------------------------- |
| 1   | 所有 Nostr relay 离线          | fallback 到 libp2p 广播，标记状态为 degraded |
| 2   | libp2p NAT 穿透失败            | 使用 relay 节点中转，或 fallback 到 Nostr    |
| 3   | 消息超过 Nostr 大小限制 (64KB) | 分片发送，或切换到 libp2p                    |
| 4   | 接收方离线超过 7 天            | Nostr 消息保留，但提示可能延迟               |
| 5   | 同时收到同一 Agent 的多条消息  | 按时间戳排序，去重处理                       |
| 6   | 协议切换时消息丢失             | 实现至少一次交付，支持幂等                   |

---

## 3.7 性能指标

| 指标            | 目标                | 测量方法                       |
| --------------- | ------------------- | ------------------------------ |
| Nostr 广播延迟  | <3s (到 3 个 relay) | 记录 publish 到收到 ok 的时间  |
| libp2p 连接建立 | <5s                 | 从 dial 到 connection open     |
| 协议选择延迟    | <10ms               | Router selectProtocol 执行时间 |
| 消息吞吐量      | >100 msg/s          | 压力测试                       |
| 内存占用        | <200MB              | Node.js heap 监控              |

---

## ✅ Phase 3 验收标准

- [x] 3.1 所有常量定义完成（Nostr/libp2p/Router）
- [x] 3.2 数据结构定义完整（Event/Message/Intent）
- [x] 3.3 接口定义精确（NostrClient/Libp2pNode/A2ARouter）
- [x] 3.4 算法逻辑清晰（协议选择/relay 选择/peer 验证）
- [x] 3.5 错误码定义完整
- [x] 3.6 边界条件清单（6 条）
- [x] 3.7 性能指标可测量（5 项）

**验收通过后，进入 Phase 4: Task Breakdown →**
