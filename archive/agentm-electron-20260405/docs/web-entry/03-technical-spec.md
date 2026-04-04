# Phase 3: Technical Spec — AgentM Web Entry + Local Agent Voice

> **目的**: 给出可直接实现的 Web 入口/Bridge/语音技术契约  
> **输入**: `web-entry/02-architecture.md`  
> **输出物**: 本文档

---

## 3.1 数据结构定义（必填）

### 3.1.1 链下数据结构

```typescript
type PairCodeState = 'issued' | 'consumed' | 'expired';

interface PairCodeRecord {
  pairCode: string;          // 8 chars, base32, uppercase
  userId: string;            // privy user id
  sessionId: string;         // web session id
  expiresAt: number;         // unix ms
  state: PairCodeState;
  consumedByBridgeId: string | null;
}

interface BridgeSession {
  bridgeId: string;          // uuid
  userId: string;
  sessionId: string;
  machineName: string;
  connectedAt: number;
  lastHeartbeatAt: number;
  status: 'online' | 'offline';
}

interface AgentPresence {
  agentId: string;           // local agent public key / id
  bridgeId: string;
  displayName: string | null;
  status: 'idle' | 'busy' | 'offline';
  capabilities: Array<'text' | 'voice'>;
  updatedAt: number;
}

interface ChatEventEnvelope<TPayload = unknown> {
  id: string;                // uuid
  sessionId: string;
  agentId: string;
  type: string;
  nonce: string;
  ts: number;
  payload: TPayload;
}
```

### 3.1.2 配置与常量

| 常量名 | 值 | 类型 | 说明 | 可变性 |
|--------|----|------|------|--------|
| `PAIR_CODE_TTL_MS` | 120000 | number | 配对码有效期 120 秒 | configurable |
| `PAIR_CODE_LEN` | 8 | number | 配对码长度 | immutable |
| `BRIDGE_HEARTBEAT_MS` | 10000 | number | Bridge 心跳周期 | configurable |
| `BRIDGE_TIMEOUT_MS` | 30000 | number | 判定离线阈值 | configurable |
| `WS_MAX_MESSAGE_BYTES` | 65536 | number | WS 单包上限 | configurable |
| `VOICE_CHUNK_MS` | 200 | number | 语音分片时长 | configurable |

## 3.2 接口定义（必填）

### 3.2.1 REST API

#### `POST /web/session/pair`

Request:
```json
{}
```

Response 200:
```json
{
  "pairCode": "AB12CD34",
  "expiresAt": 1760000000000
}
```

Errors:
- `401 AUTH_REQUIRED`
- `429 TOO_MANY_REQUESTS`

#### `POST /local/bridge/attach`

Request:
```json
{
  "pairCode": "AB12CD34",
  "machineName": "MacBook-Pro",
  "bridgeVersion": "0.1.0"
}
```

Response 200:
```json
{
  "bridgeId": "uuid",
  "bridgeToken": "jwt-or-signed-token",
  "sessionId": "session-id",
  "userId": "privy-user-id"
}
```

Errors:
- `400 PAIR_CODE_INVALID`
- `409 PAIR_CODE_ALREADY_CONSUMED`
- `410 PAIR_CODE_EXPIRED`

#### `GET /web/agents`

Response 200:
```json
{
  "items": [
    {
      "agentId": "agent-1",
      "displayName": "Local Judge Agent",
      "status": "idle",
      "capabilities": ["text", "voice"],
      "updatedAt": 1760000001000
    }
  ]
}
```

Errors:
- `401 AUTH_REQUIRED`
- `404 BRIDGE_NOT_CONNECTED`

### 3.2.2 WebSocket 接口

#### `WS /web/chat/:agentId`

客户端可发事件：
- `chat.message.send` `{ text: string }`
- `voice.start` `{ codec: "pcm16" | "opus" }`
- `voice.chunk` `{ seq: number, dataBase64: string }`
- `voice.stop` `{}`

服务端回事件：
- `chat.message.ack` `{ messageId: string }`
- `chat.message.delta` `{ messageId: string, delta: string }`
- `chat.message.final` `{ messageId: string, text: string }`
- `voice.transcript.partial` `{ text: string }`
- `voice.transcript.final` `{ text: string }`
- `voice.tts.chunk` `{ seq: number, dataBase64: string, done: boolean }`
- `error` `{ code: string, message: string }`

#### `WS /bridge/realtime`

Bridge 发：
- `bridge.heartbeat` `{ bridgeId: string }`
- `bridge.agent.presence` `{ agents: AgentPresence[] }`
- `bridge.chat.result` / `bridge.voice.result`

Gateway 发：
- `bridge.chat.request`
- `bridge.voice.request`

## 3.3 错误码定义（必填）

| 错误码 | 名称 | 触发条件 | 用户提示 |
|--------|------|---------|---------|
| WB-1001 | AUTH_REQUIRED | 未登录访问 Web API | 请先登录 AgentM |
| WB-1002 | PAIR_CODE_INVALID | 配对码格式或内容无效 | 配对码无效 |
| WB-1003 | PAIR_CODE_EXPIRED | 配对码超时 | 配对码已过期，请重新生成 |
| WB-1004 | PAIR_CODE_ALREADY_CONSUMED | 配对码重复使用 | 配对码已使用 |
| WB-1005 | BRIDGE_NOT_CONNECTED | 无在线 Bridge | 本地 Bridge 未连接 |
| WB-1006 | AGENT_NOT_FOUND | 指定 agentId 不存在 | 未找到本地 Agent |
| WB-1007 | WS_MESSAGE_TOO_LARGE | WS 包超限 | 消息体过大 |
| WB-1008 | VOICE_STREAM_TIMEOUT | 语音流超时 | 语音会话超时，请重试 |
| WB-1009 | RATE_LIMITED | 请求过频 | 操作过快，请稍后再试 |

## 3.4 状态机精确定义（必填）

| 当前状态 | 触发动作 | 条件 | 新状态 | 副作用 |
|---------|---------|------|--------|--------|
| unpaired | issue_pair_code | 用户已登录 | pair_code_issued | 写入 PairCodeRecord |
| pair_code_issued | consume_pair_code | 未过期且未消费 | paired | 创建 BridgeSession |
| pair_code_issued | consume_pair_code | 已过期 | unpaired | 标记 expired |
| paired | bridge_online | WS 鉴权成功 | connected | 更新 BridgePresence |
| connected | heartbeat_timeout | > 30s 无心跳 | paired | 清理 agent presence |
| connected | chat_open | agent 在线 | chatting | 创建 ChatSession |
| chatting | chat_close | 用户关闭或异常 | connected | 释放会话资源 |
| chatting | voice_start | capabilities 含 voice | voice_streaming | 开始语音会话 |
| voice_streaming | voice_stop | 正常结束 | chatting | 返回最终转写/回复 |

## 3.5 算法与计算（必填）

### 配对码生成与校验

```text
pairCode = randomBase32(8)
expiresAt = now + PAIR_CODE_TTL_MS

validatePairCode(input):
  if format invalid -> WB-1002
  rec = lookup(input)
  if !rec -> WB-1002
  if rec.state == consumed -> WB-1004
  if now > rec.expiresAt -> set expired; WB-1003
  set consumed + consumedByBridgeId
```

### Bridge 在线判定

```text
on heartbeat:
  lastHeartbeatAt = now

every 5s:
  if now - lastHeartbeatAt > BRIDGE_TIMEOUT_MS
    status = offline
    remove related agent presence
```

## 3.6 安全规则（必填）

| 规则 | 实现方式 | 验证方法 |
|------|---------|---------|
| 配对码一次性 | 状态机 `issued -> consumed` 单向 | 单元测试 + 集成测试 |
| 会话绑定 | `bridge.userId == web.userId` 校验 | API/WS 鉴权测试 |
| 防重放 | 事件 `nonce` 幂等缓存 2 分钟 | 重放攻击测试 |
| 输入限制 | 文本长度、WS 包大小上限 | 边界测试 |
| 最小暴露 | Bridge 仅出站连接网关 | 部署检查 |

## 3.7 地址/标识推导（必填）

| 用途 | 规则 | 说明 |
|------|------|------|
| `bridgeId` | UUIDv4 | Bridge 实例主键 |
| `sessionId` | 复用 Web 会话 ID | Web/Bridge 绑定键 |
| `chatEvent.id` | UUIDv4 | 全链路追踪 |

## 3.8 升级与迁移（可选）

- 桌面单入口迁移到双入口时，保留原本地 API；新增 Gateway/Bridge 层
- 现有桌面用户数据（任务流、消息）不做破坏性迁移

## 3.9 边界条件清单（必填）

| # | 边界条件 | 预期行为 | 备注 |
|---|---------|---------|------|
| 1 | 配对码长度错误 | 返回 `WB-1002` | 400 |
| 2 | 配对码过期 | 返回 `WB-1003` | 410 |
| 3 | 配对码重复消费 | 返回 `WB-1004` | 409 |
| 4 | 同一用户多 Bridge 并发 | 允许，但按 bridgeId 隔离 agent 列表 | |
| 5 | Bridge 断线重连 | 恢复在线状态并重建 presence | |
| 6 | agentId 不存在 | 返回 `WB-1006` | |
| 7 | 文本超长（>16KB） | 拒绝并返回错误 | |
| 8 | 语音流中断 | 触发 `WB-1008`，会话回到 chatting | |
| 9 | WS 包超限 | 断开连接并报 `WB-1007` | |
| 10 | 未登录访问 `/web/agents` | 返回 `WB-1001` | 401 |
| 11 | 心跳抖动（短暂丢包） | 容忍 1 个周期后再判离线 | |
| 12 | 同 nonce 重放 | 幂等丢弃，不重复执行 | |

---

## ✅ Phase 3 验收标准

- [x] 数据结构、常量、接口、错误码定义完成
- [x] 状态机与核心算法无歧义
- [x] 安全规则映射到实现与验证路径
- [x] 边界条件 ≥ 10（共 12 条）
- [ ] 团队评审通过

**验收通过后，进入 Phase 4: Task Breakdown →**
