# Phase 5: Test Spec — A2A Multi-Protocol Communication Layer

> **目的**: 定义测试策略、测试用例和验收标准
> **输入**: `03-technical-spec.md`, `04-task-breakdown.md`
> **输出物**: 本文档

---

## 5.1 测试策略

### 5.1.1 测试金字塔

```
        /\
       /  \     E2E Tests (5%)  - 完整用户流程
      /____\
     /      \   Integration Tests (15%) - 协议交互
    /________\
   /          \ Unit Tests (80%) - 函数/方法级别
  /____________\
```

### 5.1.2 测试类型

| 类型     | 范围          | 工具                  | 目标覆盖率    |
| -------- | ------------- | --------------------- | ------------- |
| 单元测试 | 单个函数/类   | tsx --test            | ≥80%          |
| 集成测试 | 模块间交互    | tsx --test + 真实网络 | ≥70%          |
| E2E 测试 | 完整用户流程  | Playwright            | 核心流程 100% |
| 性能测试 | 延迟/吞吐量   | k6 / autocannon       | 指标达标      |
| 安全测试 | 签名/加密验证 | 自定义脚本            | 关键路径 100% |

---

## 5.2 单元测试规范

### 5.2.1 NostrClient 测试

```typescript
// nostr-client.test.ts

describe('NostrClient', () => {
    describe('connect', () => {
        it('should connect to at least 3 relays', async () => {
            // Given
            const client = new NostrClient();

            // When
            await client.connect();

            // Then
            expect(client.getConnectedRelayCount()).toBeGreaterThanOrEqual(3);
        });

        it('should retry failed relays up to MAX_ATTEMPTS', async () => {
            // Given: 模拟 relay 失败
            const faultyRelay = 'wss://faulty.relay';

            // When/Then: 重试后成功或标记为失败
        });

        it('should timeout after CONNECT timeout', async () => {
            // Given: 模拟网络延迟
            // When/Then: 超时后抛出错误
        });
    });

    describe('publishPresence', () => {
        it('should publish to all connected relays', async () => {
            // Given
            const profile = createMockProfile();

            // When
            const eventId = await client.publishPresence(profile);

            // Then
            expect(eventId).toBeDefined();
            expect(mockRelays[0].published).toContain(eventId);
            expect(mockRelays[1].published).toContain(eventId);
            expect(mockRelays[2].published).toContain(eventId);
        });

        it('should sign event with correct kind (10002)', async () => {
            // Given/When
            const eventId = await client.publishPresence(profile);

            // Then
            const event = mockRelays[0].getEvent(eventId);
            expect(event.kind).toBe(10002);
        });
    });

    describe('sendDM', () => {
        it('should encrypt content with nip-04', async () => {
            // Given
            const to = 'recipient-pubkey';
            const message = 'secret message';

            // When
            await client.sendDM(to, message);

            // Then
            const published = mockRelays[0].lastEvent;
            expect(published.kind).toBe(4);
            expect(published.content).not.toContain(message); // 已加密
            expect(published.tags).toContainEqual(['p', to]);
        });

        it('should decrypt received DMs correctly', async () => {
            // Given: 模拟收到加密消息

            // When
            const decrypted = await client.decryptDM(encryptedEvent);

            // Then
            expect(decrypted).toBe(originalMessage);
        });
    });

    describe('subscribePresence', () => {
        it('should receive presence updates in real-time', async () => {
            // Given
            const handler = vi.fn();
            await client.subscribePresence({}, handler);

            // When: 模拟收到 presence 事件
            mockRelays[0].emit('event', mockPresenceEvent);

            // Then
            expect(handler).toHaveBeenCalledWith(mockPresenceEvent);
        });

        it('should filter by capabilities', async () => {
            // Given
            const handler = vi.fn();
            await client.subscribePresence({ capabilities: ['defi'] }, handler);

            // When: 收到不同 capability 的事件

            // Then: 只有匹配的触发 handler
        });
    });
});
```

### 5.2.2 Libp2pNode 测试

```typescript
// libp2p-node.test.ts

describe('Libp2pNode', () => {
    describe('start/stop', () => {
        it('should start and be running', async () => {
            const node = createLibp2pNode();
            await node.start();
            expect(node.isRunning()).toBe(true);
        });

        it('should generate valid peerId', async () => {
            await node.start();
            expect(node.getPeerId()).toMatch(/^12D3Koo/); // libp2p peerId 格式
        });

        it('should stop gracefully', async () => {
            await node.start();
            await node.stop();
            expect(node.isRunning()).toBe(false);
        });
    });

    describe('dial', () => {
        it('should connect to peer by peerId', async () => {
            // Given
            const targetPeer = '/p2p/12D3Koo...';

            // When
            const conn = await node.dial(targetPeer);

            // Then
            expect(conn).toBeDefined();
            expect(node.getConnections()).toHaveLength(1);
        });

        it('should timeout after CONNECTION timeout', async () => {
            // Given: 不可达 peer

            // When/Then: 超时抛出错误
            await expect(node.dial('/p2p/unreachable')).rejects.toThrow('Timeout');
        });
    });

    describe('pubsub', () => {
        it('should publish and receive messages', async () => {
            // Given: 两个节点
            const node1 = createLibp2pNode();
            const node2 = createLibp2pNode();
            await Promise.all([node1.start(), node2.start()]);

            // When
            const received: Message[] = [];
            await node2.subscribe('test-topic', (msg) => received.push(msg));
            await node1.publish('test-topic', uint8ArrayFromString('hello'));

            // Then
            await waitFor(() => received.length > 0);
            expect(received[0].data.toString()).toBe('hello');
        });
    });

    describe('DHT', () => {
        it('should find peer through DHT', async () => {
            // Given: 节点 A 已注册
            await nodeA.provide('/agent/test-agent');

            // When
            const providers = await nodeB.findProviders('/agent/test-agent');

            // Then
            expect(providers).toContainEqual(
                expect.objectContaining({
                    id: nodeA.getPeerId(),
                }),
            );
        });
    });

    describe('verifyPeer', () => {
        it('should verify valid peer', async () => {
            // Given: 有效的 Agent 声明

            // When
            const valid = await node.verifyPeer(peerId, agentAddress);

            // Then
            expect(valid).toBe(true);
        });

        it('should reject peer with invalid signature', async () => {
            // Given: 无效的签名

            // When
            const valid = await node.verifyPeer(peerId, agentAddress);

            // Then
            expect(valid).toBe(false);
        });

        it('should reject expired declaration', async () => {
            // Given: 超过 24h 的声明

            // When
            const valid = await node.verifyPeer(peerId, agentAddress);

            // Then
            expect(valid).toBe(false);
        });
    });
});
```

### 5.2.3 A2ARouter 测试

```typescript
// router.test.ts

describe('A2ARouter', () => {
  describe('protocol selection', () => {
    it('should select Nostr for BROADCAST intent', async () => {
      // Given
      const intent: A2AIntent = { type: 'BROADCAST', ... };

      // When
      const result = await router.send(intent);

      // Then
      expect(result.protocol).toBe('nostr');
    });

    it('should select libp2p for DIRECT_P2P intent', async () => {
      const intent: A2AIntent = { type: 'DIRECT_P2P', ... };
      const result = await router.send(intent);
      expect(result.protocol).toBe('libp2p');
    });

    it('should select MagicBlock for PAID_SERVICE intent', async () => {
      const intent: A2AIntent = { type: 'PAID_SERVICE', ... };
      const result = await router.send(intent);
      expect(result.protocol).toBe('magicblock');
    });

    it('should fallback when primary protocol unavailable', async () => {
      // Given: libp2p 不可用
      mockLibp2p.health = () => ({ available: false });
      const intent: A2AIntent = { type: 'DIRECT_P2P', ... };

      // When
      const result = await router.send(intent);

      // Then: fallback 到 Nostr
      expect(result.protocol).toBe('nostr');
    });

    it('should throw when all protocols unavailable', async () => {
      // Given: 所有协议不可用

      // When/Then
      await expect(router.send(intent)).rejects.toThrow('NO_AVAILABLE_PROTOCOL');
    });
  });

  describe('health check', () => {
    it('should check all protocols periodically', async () => {
      // Given
      vi.useFakeTimers();

      // When: 推进 30s
      vi.advanceTimersByTime(30000);

      // Then: 所有协议的 health 被调用
      expect(mockNostr.health).toHaveBeenCalled();
      expect(mockLibp2p.health).toHaveBeenCalled();
    });

    it('should mark degraded protocol', async () => {
      // Given: Nostr 延迟高
      mockNostr.health = () => ({ latencyMs: 5000 });

      // When
      const status = router.getStatus();

      // Then
      expect(status.protocols.nostr.health).toBe('degraded');
    });
  });

  describe('error handling', () => {
    it('should retry retryable errors', async () => {
      // Given: 第一次失败，第二次成功
      mockNostr.send
        .mockRejectedValueOnce(new Error('TEMPORARY'))
        .mockResolvedValueOnce({ success: true });

      // When
      const result = await router.send(intent);

      // Then
      expect(result.success).toBe(true);
      expect(mockNostr.send).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      // Given: 签名错误（不可重试）
      mockNostr.send.mockRejectedValue(new Error('SIGNATURE_INVALID'));

      // When
      await router.send(intent);

      // Then: 只调用一次
      expect(mockNostr.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('discoverAgents', () => {
    it('should aggregate agents from all protocols', async () => {
      // Given: 两个协议返回不同 Agent
      mockNostr.discover = () => [{ agent: 'A' }];
      mockLibp2p.discover = () => [{ agent: 'B' }];

      // When
      const agents = await router.discoverAgents({});

      // Then
      expect(agents).toHaveLength(2);
      expect(agents).toContainEqual(expect.objectContaining({ agent: 'A' }));
      expect(agents).toContainEqual(expect.objectContaining({ agent: 'B' }));
    });

    it('should deduplicate agents by address', async () => {
      // Given: 两个协议返回同一 Agent
      mockNostr.discover = () => [{ agent: 'A', reputation: 100 }];
      mockLibp2p.discover = () => [{ agent: 'A', reputation: 100 }];

      // When
      const agents = await router.discoverAgents({});

      // Then
      expect(agents).toHaveLength(1);
    });
  });
});
```

---

## 5.3 集成测试规范

### 5.3.1 Nostr 集成测试

```typescript
// nostr-integration.test.ts

describe('Nostr Integration', () => {
    it('should publish and receive across multiple relays', async () => {
        // Given: 真实 relay 列表（测试环境）
        const relays = ['wss://relay.damus.io', 'wss://nos.lol'];
        const clientA = new NostrClient(relays);
        const clientB = new NostrClient(relays);

        // When: A 广播，B 订阅
        await clientA.connect();
        await clientB.connect();

        const received: AgentPresenceEvent[] = [];
        await clientB.subscribePresence({}, (e) => received.push(e));

        await clientA.publishPresence(mockProfile);

        // Then: B 在 5s 内收到
        await waitFor(() => received.length > 0, { timeout: 5000 });
        expect(received[0].content).toContain(mockProfile.agent);
    });

    it('should maintain DM conversation between two agents', async () => {
        // Given: 两个已连接客户端

        // When: 双向发送消息
        await clientA.sendDM(clientB.getPublicKey(), 'Hello from A');
        await clientB.sendDM(clientA.getPublicKey(), 'Hello from B');

        // Then: 双方都能接收
        // ... 验证
    });

    it('should handle relay disconnection gracefully', async () => {
        // Given: 已连接
        await client.connect();

        // When: 断开一个 relay
        mockRelays[0].disconnect();

        // Then: 仍可通过其他 relay 通信
        const result = await client.publishPresence(profile);
        expect(result).toBeDefined();
    });
});
```

### 5.3.2 libp2p 集成测试

```typescript
// libp2p-integration.test.ts

describe('libp2p Integration', () => {
    it('should form mesh network with 3+ nodes', async () => {
        // Given: 3 个节点
        const nodes = await Promise.all([createAndStartNode(), createAndStartNode(), createAndStartNode()]);

        // When: 等待 DHT 发现
        await waitFor(() => nodes.every((n) => n.getConnections().length >= 1), { timeout: 10000 });

        // Then: 每个节点至少连接一个其他节点
        nodes.forEach((node) => {
            expect(node.getConnections().length).toBeGreaterThanOrEqual(1);
        });
    });

    it('should route messages through intermediate nodes', async () => {
        // Given: 线性拓扑 A - B - C
        // When: A 向 C 发送
        // Then: C 收到消息（通过 B 转发）
    });

    it('should verify peer identity via DHT', async () => {
        // Given: 节点已注册 Agent 声明

        // When: 查询 DHT
        const providers = await node.findProviders('/agent/test');

        // Then: 可验证声明签名
        const valid = await verifyAgentDeclaration(providers[0]);
        expect(valid).toBe(true);
    });
});
```

### 5.3.3 跨协议集成测试

```typescript
// cross-protocol-integration.test.ts

describe('Cross-Protocol Integration', () => {
  it('should discover agent via Nostr and negotiate via libp2p', async () => {
    // Given: Agent A 在 Nostr 广播
    await agentA.nostr.publishPresence(profileA);

    // When: Agent B 发现后通过 libp2p 协商
    const agents = await agentB.router.discoverAgents({});
    const target = agents.find(a => a.agent === profileA.agent);

    await agentB.router.send({
      type: 'DIRECT_P2P',
      to: target.endpoint,
      payload: { type: 'NEGOTIATION', terms: {...} },
    });

    // Then: Agent A 收到协商请求
    // ... 验证
  });

  it('should fallback from libp2p to Nostr when P2P fails', async () => {
    // Given: libp2p 连接失败

    // When: 发送 DIRECT_P2P 意图

    // Then: 自动 fallback 到 Nostr 离线消息
  });

  it('should complete full flow: discover → negotiate → pay → settle', async () => {
    // 完整 E2E 流程测试
  });
});
```

---

## 5.4 E2E 测试规范

### 5.4.1 用户场景测试

```typescript
// e2e/a2a-communication.spec.ts

test('Agent discovers and negotiates via A2A', async ({ page }) => {
    // Given: 两个 Agent 已登录
    await loginAsAgent(page, 'Agent A');
    const pageB = await openNewPage();
    await loginAsAgent(pageB, 'Agent B');

    // When: Agent A 广播能力
    await page.click('[data-testid="broadcast-presence"]');

    // And: Agent B 发现并发起协商
    await pageB.click('[data-testid="discover-tab"]');
    await pageB.click(`[data-testid="agent-${agentAAddress}"]`);
    await pageB.fill('[data-testid="negotiation-input"]', 'Can you do X for $100?');
    await pageB.click('[data-testid="send-negotiation"]');

    // Then: Agent A 收到协商请求
    await expect(page.locator('[data-testid="chat-message"]')).toContainText('Can you do X');

    // When: Agent A 接受
    await page.click('[data-testid="accept-negotiation"]');

    // Then: Agent B 收到接受确认
    await expect(pageB.locator('[data-testid="chat-message"]')).toContainText('Accepted');
});

test('Agent sends offline message to offline peer', async ({ page }) => {
    // Given: Agent B 离线

    // When: Agent A 发送消息
    await sendMessage(page, 'Agent B', 'Hello offline friend');

    // Then: 显示"已发送，对方上线后接收"
    await expect(page.locator('[data-testid="message-status"]')).toContainText('pending');

    // When: Agent B 上线
    const pageB = await openNewPage();
    await loginAsAgent(pageB, 'Agent B');

    // Then: Agent B 收到离线消息
    await expect(pageB.locator('[data-testid="chat-message"]')).toContainText('Hello offline friend');

    // And: Agent A 状态更新为"已送达"
    await expect(page.locator('[data-testid="message-status"]')).toContainText('delivered');
});
```

---

## 5.5 性能测试规范

### 5.5.1 负载测试

```typescript
// load-test.ts

export const options = {
    stages: [
        { duration: '1m', target: 10 }, // 渐进到 10 VU
        { duration: '3m', target: 50 }, // 保持 50 VU
        { duration: '1m', target: 100 }, // 峰值 100 VU
        { duration: '1m', target: 0 }, // 下降
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% 请求 <500ms
        http_req_failed: ['rate<0.01'], // 错误率 <1%
    },
};

export default function () {
    // 模拟 Agent 广播
    const res = http.post(
        `${BASE_URL}/a2a/broadcast`,
        JSON.stringify({
            profile: generateRandomProfile(),
        }),
    );

    check(res, {
        'broadcast success': (r) => r.status === 200,
        'broadcast fast': (r) => r.timings.duration < 3000,
    });

    sleep(1);
}
```

### 5.5.2 性能指标验收

| 指标            | 目标   | 测试方法          |
| --------------- | ------ | ----------------- |
| Nostr 广播延迟  | <3s    | k6 负载测试       |
| libp2p 连接建立 | <5s    | 单元测试计时      |
| 协议选择延迟    | <10ms  | benchmark         |
| 内存使用        | <200MB | Node.js heap dump |
| 并发连接        | 50+    | 压力测试          |

---

## 5.6 安全测试规范

### 5.6.1 签名验证测试

```typescript
// security.test.ts

describe('Security', () => {
    it('should reject message with invalid signature', async () => {
        // Given: 篡改的消息
        const tamperedMessage = { ...validMessage, payload: 'tampered' };

        // When/Then: 验证失败
        await expect(verifyMessage(tamperedMessage)).rejects.toThrow('SIGNATURE_INVALID');
    });

    it('should reject replayed message', async () => {
        // Given: 已处理过的消息
        await router.receiveMessage(message);

        // When: 再次接收相同消息
        const result = await router.receiveMessage(message);

        // Then: 被识别为重复
        expect(result.duplicate).toBe(true);
    });

    it('should reject expired peer declaration', async () => {
        // Given: 24h+ 前的声明
        const oldDeclaration = createDeclaration({ timestamp: Date.now() - 86400001 });

        // When
        const valid = await verifyPeerDeclaration(oldDeclaration);

        // Then
        expect(valid).toBe(false);
    });

    it('should encrypt DM content', async () => {
        // Given
        const message = 'secret';

        // When
        const encrypted = await encryptDM(message, recipientPubkey);

        // Then: 无法直接读取
        expect(encrypted).not.toContain('secret');

        // And: 正确接收方可解密
        const decrypted = await decryptDM(encrypted, recipientPrivateKey);
        expect(decrypted).toBe('secret');
    });
});
```

---

## 5.7 测试环境

### 5.7.1 本地测试

```bash
# 单元测试
pnpm test

# 集成测试（需要本地 relay）
docker run -p 8080:8080 scsibug/nostr-rs-relay
NOSTR_TEST_RELAY=ws://localhost:8080 pnpm test:integration

# E2E 测试
pnpm test:e2e
```

### 5.7.2 CI 测试

```yaml
# .github/workflows/a2a-test.yml
test:
    runs-on: ubuntu-latest
    services:
        nostr-relay:
            image: scsibug/nostr-rs-relay
            ports:
                - 8080:8080
    steps:
        - uses: actions/checkout@v4
        - run: pnpm install
        - run: pnpm test:unit
        - run: pnpm test:integration
        - run: pnpm test:e2e
```

---

## 5.8 测试数据

### 5.8.1 Mock 数据工厂

```typescript
// test/factories.ts

export function createMockProfile(overrides?: Partial<AgentProfile>): AgentProfile {
    return {
        agent: `agent-${randomHex(8)}`,
        displayName: `Test Agent ${randomInt(100)}`,
        capabilities: ['coding', 'writing'],
        reputationScore: randomInt(100),
        available: true,
        ...overrides,
    };
}

export function createMockNostrEvent(overrides?: Partial<NostrEvent>): NostrEvent {
    return {
        id: randomHex(64),
        pubkey: randomHex(64),
        created_at: Math.floor(Date.now() / 1000),
        kind: 10002,
        tags: [],
        content: JSON.stringify(createMockProfile()),
        sig: randomHex(128),
        ...overrides,
    };
}
```

---

## ✅ Phase 5 验收标准

- [x] 5.1 测试策略定义（金字塔 + 类型）
- [x] 5.2 单元测试规范（Nostr/libp2p/Router）
- [x] 5.3 集成测试规范（单协议 + 跨协议）
- [x] 5.4 E2E 测试规范（用户场景）
- [x] 5.5 性能测试规范（负载 + 指标）
- [x] 5.6 安全测试规范（签名/加密/防重放）
- [x] 5.7 测试环境配置（本地 + CI）
- [x] 5.8 测试数据工厂

**验收通过后，进入 Phase 6: Implementation →**
