# Phase 5: Test Spec — AgentM Web Entry + Local Agent Voice

> **目的**: 在实现前定义 Web/Bridge/语音的测试契约（TDD）  
> **输入**: `web-entry/03-technical-spec.md`, `web-entry/04-task-breakdown.md`  
> **输出物**: 本文档

---

## 5.1 测试策略（必填）

| 测试类型 | 覆盖范围 | 工具 | 运行环境 |
|---------|---------|------|---------|
| 单元测试 | pair code、鉴权、状态机、错误码 | `tsx --test` | Node |
| 集成测试 | REST + WS + Bridge mock 联动 | `tsx --test` | Node |
| 端到端测试 | Web 登录→配对→文本→语音 smoke | Playwright/脚本（后续） | 本地开发栈 |
| 安全测试 | 重放、越权、限流、TTL | `tsx --test` | Node |
| 性能测试 | 文本 RTT/语音首包 | 脚本采样 | 本地/测试环境 |

## 5.2 测试用例表（必填）

### 5.2.1 Pairing API

**Happy Path**

| # | 测试名称 | 输入 | 预期输出 | 预期状态变化 |
|---|---------|------|---------|-------------|
| H1 | issue pair code success | 登录态调用 `/web/session/pair` | 返回 pairCode/expiresAt | state=issued |
| H2 | consume pair code success | Bridge 调 `/local/bridge/attach` | 返回 bridgeToken | state=consumed |

**Boundary**

| # | 测试名称 | 输入 | 预期行为 | 备注 |
|---|---------|------|---------|------|
| B1 | pair code format invalid | 长度!=8 | `WB-1002` | 400 |
| B2 | pair code expired | now > expiresAt | `WB-1003` | 410 |
| B3 | pair code reuse | 已 consumed | `WB-1004` | 409 |

**Error/Attack**

| # | 测试名称 | 输入/操作 | 预期错误码 | 攻击类型 |
|---|---------|----------|-----------|---------|
| E1 | unauth issue pair code | 未登录调用 | `WB-1001` | 越权 |
| E2 | brute force pair code | 高频错误尝试 | `WB-1009` | 暴力猜测 |

### 5.2.2 Bridge Presence + Agents API

| # | 测试名称 | 输入 | 预期输出 |
|---|---------|------|---------|
| H1 | heartbeat keeps online | 10s 心跳 | bridge=online |
| H2 | presence report visible | 上报 2 agents | `/web/agents` 返回 2 条 |
| B1 | heartbeat timeout offline | 30s 无心跳 | bridge=offline, agents 清空 |
| E1 | wrong bridge token | WS 鉴权失败 | 401 + 断开 |

### 5.2.3 Chat WS

| # | 测试名称 | 输入 | 预期输出 |
|---|---------|------|---------|
| H1 | text send ack | `chat.message.send` | `chat.message.ack` |
| H2 | text streaming | bridge 回传 delta/final | Web 正确拼接 |
| B1 | message too large | >16KB 文本 | `WB-1007` |
| E1 | replay nonce | 同 nonce 重发 | 幂等丢弃 |
| E2 | unknown agentId | chat open 到不存在 agent | `WB-1006` |

### 5.2.4 Voice WS

| # | 测试名称 | 输入 | 预期输出 |
|---|---------|------|---------|
| H1 | start/chunk/stop flow | `voice.start/chunk/stop` | transcript partial/final |
| H2 | tts chunks playback metadata | 返回 `voice.tts.chunk` 序列 | seq 连续，done=true 结束 |
| B1 | chunk gap | seq 不连续 | 错误并中断会话 |
| E1 | stream timeout | stop 缺失超时 | `WB-1008` |

## 5.3 集成测试场景（必填）

| # | 场景名称 | 步骤 | 预期结果 |
|---|---------|------|---------|
| I1 | 登录配对闭环 | Web 登录→签发配对码→Bridge attach | Web 能看到在线 agents |
| I2 | 文本对话闭环 | 连接 chat WS→发送消息→Bridge 回传 | Web 收到 final 回复 |
| I3 | 语音单轮闭环 | voice start→chunk→stop→Agent 回复 | transcript + tts 事件完整 |

## 5.4 安全测试场景（必填）

| # | 攻击名称 | 攻击方式 | 预期防御 | 验证方法 |
|---|---------|---------|---------|---------|
| S1 | 配对码重放 | 重复消费同 pairCode | `WB-1004` | 集成测试 |
| S2 | 未登录访问 agents | 无会话调用 `/web/agents` | `WB-1001` | API 测试 |
| S3 | WS 伪造身份 | 无效 token 连接 bridge/chat | 拒绝连接 | WS 测试 |
| S4 | 超大包注入 | 发送超限 WS 包 | `WB-1007` + 断开 | 边界测试 |

## 5.5 测试代码骨架（必填）

```typescript
// src/web-entry/pairing.test.ts
describe('pairing', () => {
  it('H1: should issue pair code for authenticated user', async () => {});
  it('B2: should fail with WB-1003 when pair code expired', async () => {});
  it('E2: should rate limit brute force attempts', async () => {});
});

// src/web-entry/chat-ws.test.ts
describe('chat websocket', () => {
  it('H1: should ack after chat.message.send', async () => {});
  it('E1: should dedupe replay nonce', async () => {});
});

// src/web-entry/voice-ws.test.ts
describe('voice websocket', () => {
  it('H1: should produce partial and final transcript events', async () => {});
  it('E1: should timeout with WB-1008 when stream hangs', async () => {});
});
```

## 5.6 测试覆盖目标（必填）

| 指标 | 目标 |
|------|------|
| 语句覆盖率 | ≥ 90% |
| 分支覆盖率 | ≥ 85% |
| Web/Bridge 关键接口覆盖 | 100%（Pairing + Agents + Chat + Voice） |
| 安全场景 | 100% 执行通过 |

---

## ✅ Phase 5 验收标准

- [x] 关键接口均有 Happy/Boundary/Error 用例
- [x] 集成场景 ≥ 3
- [x] 安全测试映射完成
- [x] 测试骨架定义完成（待代码落地）
- [x] 覆盖目标明确

**验收通过后，进入 Phase 6: Implementation →**
