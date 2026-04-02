# Phase 5: Test Spec — Agent.im

---

## 1. 测试文件规划

| 文件 | 测试数 | 测试内容 | 优先级 |
|------|--------|---------|--------|
| `a2a-client.test.ts` | 8 | A2A 消息收发、微支付、传输层 | P0 |
| `ranking.test.ts` | 3 | Agent 发现排名（迁移自 agent-social，扩展） | P0 |
| `store.test.ts` | 6 | Zustand 状态管理、对话/消息 CRUD | P0 |
| `api-server.test.ts` | 7 | localhost:3939 API 端点 | P0 |
| `indexer-api.test.ts` | 4 | Indexer 客户端、离线降级 | P1 |
| `voice-engine.test.ts` | 3 | 语音识别/合成、降级逻辑 | P1 |
| `auth.test.ts` | 3 | 认证状态管理（Privy mock） | P1 |

---

## 2. 运行方式

```bash
cd apps/agent-im

# 全部测试
pnpm test

# 单文件
pnpm exec tsx --test src/renderer/lib/a2a-client.test.ts
pnpm exec tsx --test src/renderer/lib/ranking.test.ts
pnpm exec tsx --test src/renderer/lib/store.test.ts
pnpm exec tsx --test src/main/api-server.test.ts
pnpm exec tsx --test src/renderer/lib/indexer-api.test.ts
pnpm exec tsx --test src/main/voice-engine.test.ts
pnpm exec tsx --test src/main/auth.test.ts
```

---

## 3. 覆盖场景

### 3.1 a2a-client.test.ts（P0）

| # | 场景 | 预期结果 |
|---|------|---------|
| 1 | 发送消息 → envelope 字段完整 | from/to/topic/message/createdAt/paymentMicrolamports 全部正确 |
| 2 | 微支付计算：`100 + byte_len * 2` 确定性 | `estimateMicropayment('defi', 'run strategy')` = 132 |
| 3 | 接收方过滤：`to !== agentId` 的消息被丢弃 | 监听器不触发 |
| 4 | `parseA2AEnvelope` 拒绝 createdAt=NaN | 返回 null |
| 5 | `parseA2AEnvelope` 拒绝 paymentMicrolamports < 0 | 返回 null |
| 6 | `parseA2AEnvelope` 各字段缺失 → null | 逐字段验证 |
| 7 | InMemoryTransport：多 Agent 广播，各自只收自己的 | 隔离性验证 |
| 8 | 发送后 direction='outgoing'，接收后 direction='incoming' | 方向正确 |

### 3.2 ranking.test.ts（P0）

| # | 场景 | 预期结果 |
|---|------|---------|
| 1 | score 高者排在前，weight 作为 tiebreaker | 排序正确 |
| 2 | 无声誉 Agent 排在最后 | reputation=null 排末尾 |
| 3 | query 过滤大小写不敏感 | `'alice'` 匹配 `'ALICE_ADDR'` |

### 3.3 store.test.ts（P0）

| # | 场景 | 预期结果 |
|---|------|---------|
| 1 | `addMessage` 新消息 → 对话列表自动更新 | conversation.lastMessage 更新 |
| 2 | `addMessage` incoming → unreadCount +1 | 计数正确 |
| 3 | `setActiveConversation` → unreadCount 归零 | 已读清除 |
| 4 | `setAuth` 登录 → authenticated=true | 状态正确 |
| 5 | `setAuth` 登出 → publicKey=null，conversations 保留 | 消息不丢 |
| 6 | `setDiscoveryQuery` → discoveryRows 实时过滤 | 过滤结果正确 |

### 3.4 api-server.test.ts（P0）

| # | 场景 | 预期结果 |
|---|------|---------|
| 1 | `POST /a2a/send` 合法请求 → 200 + envelope | ok=true |
| 2 | `POST /a2a/send` 缺少 `to` 字段 → 400 | 错误信息清晰 |
| 3 | `GET /a2a/messages?peer=addr` → 消息列表 | 按时间倒序 |
| 4 | `GET /discover/agents?category=0` → 排名列表 | 排序与 ranking.ts 一致 |
| 5 | `GET /me/reputation` 已登录 → 声誉数据 | 4 个指标正确 |
| 6 | `GET /me/reputation` 未登录 → 401 | 未认证错误 |
| 7 | `GET /status` → 运行状态 | version + uptime 正确 |

### 3.5 indexer-api.test.ts（P1）

| # | 场景 | 预期结果 |
|---|------|---------|
| 1 | `getReputation(addr)` → 正确解析 Indexer 响应 | 4 个指标正确 |
| 2 | `getReputation(unknown)` → null（不抛异常） | 404 静默处理 |
| 3 | `getTasks` 分页参数正确传递 | limit/offset 在 URL 中 |
| 4 | Indexer 不可用 → 返回缓存数据或空数组 | 不崩溃，显示离线提示 |

### 3.6 voice-engine.test.ts（P1）

| # | 场景 | 预期结果 |
|---|------|---------|
| 1 | Whisper WASM 不可用 → 降级到 Web Speech API | 自动降级，不报错 |
| 2 | `stopAndTranscribe()` 返回文字 | string 非空 |
| 3 | `speak(text)` 调用 speechSynthesis | TTS 被调用 |

### 3.7 auth.test.ts（P1）

| # | 场景 | 预期结果 |
|---|------|---------|
| 1 | Privy 登录成功 → AuthState 正确 | publicKey 非空，authenticated=true |
| 2 | Privy 登录失败 → 错误提示 | authenticated=false，error 有值 |
| 3 | 登出 → 清除会话，保留本地数据 | publicKey=null，messages 不变 |

---

## 4. 测试策略

- **运行时**：`tsx --test`（Node.js），与项目其他模块一致
- **无浏览器依赖**：所有测试在 Node.js 环境运行，UI 组件不测渲染（测逻辑）
- **A2A 协议**：使用 `InMemoryMagicBlockHub`（可控延迟），不依赖 BroadcastChannel
- **Indexer**：mock HTTP 响应（`nock` 或 Node.js 原生 mock）
- **Privy**：mock `usePrivy()` 返回值，不实际调用 OAuth
- **语音**：mock `speechSynthesis` 和 Whisper WASM，测试逻辑而非硬件
- **API 服务**：启动真实 Bun HTTP server（`localhost:0` 随机端口），用 `fetch` 测试
- **状态管理**：直接测试 Zustand store，不渲染 React 组件

---

## 5. 缺失场景（后续补充）

### P1（MVP 后）

| 场景 | 说明 |
|------|------|
| 语音意图识别 | "发布任务" vs "发送消息" 判断准确性 |
| 任务发布 E2E | `POST /tasks/post` → SDK `task.post` → 链上 |
| 消息持久化恢复 | 关闭应用 → 重新打开 → 消息历史完整 |

### P2（长期）

| 场景 | 说明 |
|------|------|
| Electrobun 打包验证 | macOS/Windows/Linux 三平台打包成功 |
| 多用户并发 A2A | 10 个 Agent 同时发消息 |
| DashDomain 连接 | 本地 Agent 进程连接器 |
| 8004 注册验证 | Agent 注册后 8004scan.io 可发现 |
