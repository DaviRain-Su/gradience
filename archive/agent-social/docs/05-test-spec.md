# Phase 5: Test Spec — agent-social

---

## 1. 当前测试文件

| 文件                     | 测试数 | 测试内容                 | 状态 |
| ------------------------ | ------ | ------------------------ | ---- |
| `magicblock-a2a.test.ts` | 5      | A2A 协议、传输层、微支付 | ✅   |
| `ranking.test.ts`        | 2      | Agent 发现排名算法       | ✅   |

---

## 2. 运行方式

```bash
cd apps/agent-social/frontend
tsx --test src/lib/magicblock-a2a.test.ts
tsx --test src/lib/ranking.test.ts
```

---

## 3. 已覆盖场景（✅）

| 场景                                         | 测试文件               |
| -------------------------------------------- | ---------------------- |
| Alice → Bob 消息传递，时延 < 500ms           | magicblock-a2a.test.ts |
| 微支付计算：`100 + byte_len × 2` 确定性      | magicblock-a2a.test.ts |
| 发出方 delivery 含 paymentMicrolamports > 0  | magicblock-a2a.test.ts |
| `parseA2AEnvelope` 拒绝 createdAt=NaN        | magicblock-a2a.test.ts |
| BroadcastChannel 传输层过滤非 Envelope 消息  | magicblock-a2a.test.ts |
| 排名：score 高者优先，weight 作为 tiebreaker | ranking.test.ts        |
| 排名：无声誉 Agent 排在最后                  | ranking.test.ts        |

---

## 4. 缺失场景

### P0（必须补充）

| 场景                                                 | 说明         |
| ---------------------------------------------------- | ------------ |
| 接收方过滤：`to !== agentId` 的消息被丢弃            | 核心安全规则 |
| `parseA2AEnvelope` 完整字段缺失各一个 → null         | 验证完整性   |
| `paymentMicrolamports` 为负数 → null                 | 边界值       |
| InMemoryTransport：多 agent 广播，各自只收自己的消息 | 隔离性       |
| `sortAndFilterAgents` query 过滤（大小写不敏感）     | 搜索正确性   |

### P1（应补充）

| 场景                                                             | 说明       |
| ---------------------------------------------------------------- | ---------- |
| `sendInvite` 同时发送 10 条消息，顺序保持 FIFO                   | 并发有序性 |
| `createDefaultMagicBlockTransport` 在非浏览器环境降级到 InMemory | 环境适配   |
| `toDiscoveryRows` reputation 为 null 时的 row 结构               | 空值处理   |
| AgentProfile 双数据源并发失败时的局部展示                        | 容错性     |

### P2（暂缓）

- LLM 社交匹配对话测试（待功能实现）
- 师徒制流程端到端测试（待功能实现）
- 大量 Agent（200+）排名性能基准

---

## 5. 测试策略

- **tsx --test**（Node.js），无第三方框架
- **InMemoryTransport** 用于所有协议单元测试（可控延迟）
- **BroadcastChannel** 测试需要浏览器环境或 jsdom
- **SDK 调用全部 mock**：`getJudgePool` / `getReputation` 返回固定 fixture
- **时间注入**：`MagicBlockA2AAgent` 接受 `now?: () => number` 参数，便于时延测试
