# Nostr DVM 替代自建 Indexer — 调研报告

> **调研日期**: 2026-04-03
> **结论**: 可行且强烈推荐。用 NIP-90 DVM + NIP-89 发现协议替代自建 Indexer，
> 同时升级 NIP-04 → NIP-44/17/59，实现完全去中心化的 Agent 通信层。

---

## 一、核心思路

**Before (当前架构)**:

```
Agent A → [自建 Indexer 服务器] → Agent B
          ↑ 中心化，需要运维
          ↑ 单点故障
          ↑ Agent 发现、声誉查询都依赖它
```

**After (Nostr 架构)**:

```
Agent A → [Nostr Relay 网络] → Agent B
          ↑ 去中心化，无需运维
          ↑ 任何 relay 挂了，切换到另一个
          ↑ Agent 发现用 NIP-89，任务协商用 NIP-90
```

**分层设计**:

```
┌─────────────────────────────────────────────────┐
│ 结算层 (Settlement)    Solana / ChainHub 合约    │ ← 链上，不变
├─────────────────────────────────────────────────┤
│ 通信层 (Messaging)     Nostr (NIP-17/44/59)     │ ← 替代自建 Indexer
│ 服务发现 (Discovery)   Nostr (NIP-89/90)        │ ← 替代自建 Indexer
│ 任务协商 (Negotiation) Nostr (NIP-90 DVM)       │ ← 替代自建 Indexer
├─────────────────────────────────────────────────┤
│ 支付层 (Payment)       Lightning + Solana        │ ← 新增 Lightning
└─────────────────────────────────────────────────┘
```

---

## 二、NIP-90 Data Vending Machine (DVM) — 任务市场协议

### 概念

DVM 就是 Nostr 上的 "数据自动售货机"。口号是 **"Money in, data out"**。
Customer 在 relay 上发布任务请求，Service Provider (Agent) 看到后处理并返回结果。

这和 Gradience Arena 的任务匹配完全一致，但不需要中心化服务器。

### Event Kind 范围

| Kind 范围 | 用途                                              |
| --------- | ------------------------------------------------- |
| 5000-5999 | Job Request (客户发布)                            |
| 6000-6999 | Job Result (Provider 返回，kind = request + 1000) |
| 7000      | Job Feedback (状态更新)                           |

### 已定义的 Job 类型

| Kind      | 用途           |
| --------- | -------------- |
| 5000/6000 | 语音转文字     |
| 5001/6001 | 摘要           |
| 5002/6002 | 翻译           |
| 5005/6005 | 内容发现/推荐  |
| 5050/6050 | 文本生成 (LLM) |
| 5100/6100 | 图片生成       |
| 5800/6800 | 通用/自定义    |

**Gradience 可以注册自己的 kind 范围，或使用 5800 通用类型。**

### Job Request 格式 (kind 5xxx)

```json
{
    "kind": 5050,
    "content": "",
    "tags": [
        ["i", "<input-data>", "<input-type>", "<relay>", "<marker>"],
        ["output", "<mime-type>"],
        ["param", "<param-name>", "<param-value>"],
        ["relays", "wss://relay1", "wss://relay2"],
        ["bid", "<amount-in-msats>"],
        ["t", "<hashtag>"],
        ["p", "<specific-provider-pubkey>"]
    ]
}
```

关键 tag:

- `"i"`: 输入数据。类型可以是 text/url/event/job (job 用于链式任务)
- `"bid"`: 愿意支付的最高金额 (毫聪)
- `"p"`: 可选，指定特定 Agent 处理
- `"output"`: 期望输出的 MIME 类型

### Job Result 格式 (kind 6xxx)

```json
{
    "kind": 6050,
    "content": "<result-data>",
    "tags": [
        ["request", "<json-stringified-original-request>"],
        ["e", "<job-request-event-id>"],
        ["p", "<customer-pubkey>"],
        ["amount", "<msats>", "<bolt11-invoice>"]
    ]
}
```

### Job Feedback 格式 (kind 7000)

```json
{
    "kind": 7000,
    "content": "<optional-message>",
    "tags": [
        ["status", "<status-value>", "<extra-info>"],
        ["e", "<job-request-event-id>"],
        ["p", "<customer-pubkey>"],
        ["amount", "<msats>", "<bolt11-invoice>"]
    ]
}
```

Status 值:

- `"payment-required"` — 需要先付款，附带 bolt11 invoice
- `"processing"` — 正在处理
- `"partial"` — 部分结果 (流式)
- `"error"` — 失败
- `"success"` — 完成

### 完整协议流程

```
1. [发现] Agent 通过 NIP-89 kind:31990 发现可用的 DVM/Agent
2. [请求] Customer 发布 kind 5xxx 任务请求到 relay
3. [接收] Agent (DVM) 订阅相关 kind，看到请求
4. [报价] Agent 发送 kind 7000 feedback，status="payment-required"，附 bolt11
5. [付款] Customer 通过以下方式付款:
   - 直接支付 Lightning invoice
   - Zap NIP-57
   - NWC (Nostr Wallet Connect) 自动支付
6. [处理] Agent 发送 kind 7000，status="processing"
7. [结果] Agent 发布 kind 6xxx 结果
8. [可选] 后付款模式: Agent 先交付结果，结果里附带 invoice
```

### Job Chaining (链式任务)

```json
["i", "<previous-job-event-id>", "job"]
```

前一个 DVM 的输出可以作为下一个 DVM 的输入，支持 Agent 流水线！

### 隐私模式

对私密任务，`"i"` 和 `"param"` tag 可以用 NIP-44 加密后放入 content 字段。

---

## 三、NIP-89 — Agent 发现 (替代 Indexer 的核心)

### kind 31990: Agent/DVM 公告

由 **Agent (Service Provider)** 发布，广告自己的能力：

```json
{
    "kind": 31990,
    "content": "{\"name\":\"Agent-Alpha\",\"about\":\"DeFi分析Agent\",\"image\":\"...\"}",
    "tags": [
        ["d", "agent-alpha-v1"],
        ["k", "5050"],
        ["k", "5100"],
        ["t", "defi"],
        ["t", "analysis"],
        ["web", "https://agent-alpha.xyz", "web"]
    ]
}
```

- `"k"` tag: 该 Agent 支持的 job kind
- `"t"` tag: 能力标签
- content: Agent 元数据 (名称、描述、头像、定价等)

### kind 31989: Agent 推荐

由 **用户** 发布，推荐自己用过的好 Agent：

```json
{
    "kind": 31989,
    "tags": [
        ["d", "5050"],
        ["a", "31990:<agent-pubkey>:<d-tag>"]
    ]
}
```

### 发现流程

```
1. Agent 发布 kind:31990 公告
2. 用户使用后发布 kind:31989 推荐
3. 客户端查询 kind:31990 + 过滤 "k" tag → 找到能处理特定任务的 Agent
4. 客户端查询 kind:31989 from 关注列表 → 社交信任发现
```

**这完全替代了 Indexer 的 Agent 发现功能！**

---

## 四、NIP-44 — 新一代加密 (替换 NIP-04)

### 当前问题

你们的 NostrAdapter 用的 NIP-04 已被社区标记为 **deprecated 且有安全漏洞**。

### NIP-44 v2 加密流程

```
1. ECDH: sender_sk × recipient_pk → shared_x (32 bytes)
2. Conversation Key: HKDF-extract(SHA256, salt="nip44-v2", ikm=shared_x) → 32 bytes
3. Message Keys: HKDF-expand(conversation_key, nonce) → 76 bytes
   ├── chacha_key (32 bytes)
   ├── chacha_nonce (12 bytes)
   └── hmac_key (32 bytes)
4. Padding: 隐藏消息精确长度 (2的幂次方填充)
5. Encryption: ChaCha20
6. Authentication: HMAC-SHA256(nonce || ciphertext)
7. Payload: base64(0x02 || nonce(32) || ciphertext || mac(32))
```

优势:

- ✅ 更强加密 (ChaCha20 + HMAC-SHA256)
- ✅ 消息长度填充 (防元数据泄露)
- ✅ 版本化设计
- ✅ Conversation key 可缓存 (同一对密钥对)

---

## 五、NIP-17 + NIP-59 — 隐私通信 (Agent 间加密消息)

### NIP-59 Gift Wrap: 三层洋葱加密

```
Layer 1 - Rumor (kind:14):
  ├── 真实消息内容
  ├── 真实发送者 pubkey
  └── 未签名 (可否认性)

Layer 2 - Seal (kind:13):
  ├── NIP-44 加密的 Rumor
  ├── 真实发送者签名
  ├── created_at 随机化 (±48小时)
  └── tags 为空 (无元数据泄露)

Layer 3 - Gift Wrap (kind:1059):
  ├── NIP-44 加密的 Seal
  ├── 临时随机密钥签名 (不是发送者！)
  ├── created_at 随机化
  └── tags: ["p", recipient_pubkey] (仅用于路由)
```

### 元数据隔离效果

| 层级      | Relay 能看到             | 接收者能看到    |
| --------- | ------------------------ | --------------- |
| Gift Wrap | 接收者 pubkey + 大致时间 | 一切            |
| Seal      | ❌                       | 发送者 + 内容   |
| Rumor     | ❌                       | 内容 (但可否认) |

**对 Agent 间的敏感协商 (报价、谈判、任务细节) 极其重要。**

### NIP-17: 私密 DM

在 NIP-59 Gift Wrap 之上:

- 内层 Rumor 使用 kind:14 (替代 NIP-04 的 kind:4)
- 支持群聊: 为每个参与者生成独立的 Gift Wrap
- 支持回复线程

---

## 六、NIP-46 — Agent 远程签名

### 架构

```
Agent 运行环境 (无私钥) ←→ Remote Signer (持有私钥)
                        via kind:24133 events (NIP-44 加密)
```

### 连接方式

```
bunker://<signer-pubkey>?relay=<relay>&secret=<optional>
nostrconnect://<client-pubkey>?relay=<relay>&metadata=<app-info>
```

### 可用方法

- `connect` — 建立会话
- `sign_event` — 签名事件
- `get_public_key` — 获取公钥
- `nip44_encrypt/decrypt` — 加密解密
- `ping` — 检查连接

**对多 Agent 部署场景特别有用: Agent 可以在不持有私钥的情况下签名发送 Nostr 事件。**

---

## 七、TypeScript 生态 (可直接用)

### @nostr/tools (官方库)

```typescript
// NIP-44 加密
import { nip44 } from '@nostr/tools';
nip44.encrypt(plaintext, conversationKey);
nip44.decrypt(payload, conversationKey);

// NIP-59 Gift Wrap
import { createRumor, createSeal, createWrap, unwrapEvent } from '@nostr/tools/nip59';
const rumor = createRumor(event);
const seal = createSeal(rumor, senderSk, recipientPk);
const wrap = createWrap(seal, recipientPk);
const decrypted = unwrapEvent(giftWrap, recipientSk);

// NIP-46 Remote Signing
import { BunkerSigner, parseBunkerInput } from '@nostr/tools/nip46';
const signer = new BunkerSigner(clientSk, await parseBunkerInput('bunker://...'));
await signer.connect();
await signer.signEvent(eventTemplate);
```

底层密码学依赖: `@noble/curves` + `@noble/ciphers` + `@noble/hashes` (已审计)

### NDK (Nostr Development Kit)

```
npm install @nostr-dev-kit/ndk
```

- TypeScript 主流 Nostr 开发库 (v3.0.3+)
- **内置 NIP-90 DVM 支持** (DVMRequest 类)
- 有 React 版本 NDK-React，适合 AgentM Web/Pro

### DVM 实现

- **Python**: `believethehype/nostrdvm` (pip install nostr-dvm) — 最成熟
- **TypeScript**: NDK 内置 DVM 支持，或 `pablof7z/nostr-data-vending-machine` 参考实现
- **DVMCP**: `gzuuus/dvmcp` — 把 MCP Server 桥接到 Nostr DVM 生态

---

## 八、Gradience 映射方案

### 用 NIP-89/90 替换 Indexer 功能

| 现有 Indexer 功能 | Nostr 替代方案                                      |
| ----------------- | --------------------------------------------------- |
| Agent 注册        | Agent 发布 kind:31990 公告                          |
| Agent 发现        | 查询 kind:31990 + 过滤 "k"/"t" tag                  |
| Agent 声誉查询    | kind:10004 (Gradience 自定义) + kind:31989 社交推荐 |
| 任务发布          | kind 5xxx Job Request                               |
| 任务匹配          | Agent 订阅相关 kind，自动接单                       |
| 任务状态更新      | kind 7000 Job Feedback                              |
| 任务结果提交      | kind 6xxx Job Result                                |
| Agent 间通信      | NIP-17 Private DM (kind:14 via Gift Wrap)           |

### 保留的 Gradience 自定义 Kind

| Kind  | 用途             | 保留原因                              |
| ----- | ---------------- | ------------------------------------- |
| 10002 | Agent Presence   | 实时在线状态 (NIP-89 是静态公告)      |
| 10003 | Agent Capability | 详细能力声明 (补充 NIP-89 的基础信息) |
| 10004 | Reputation Proof | 链上声誉证明 (Gradience 特有)         |

### 支付整合

```
小额/即时支付 → Lightning Network (via bolt11 in NIP-90)
大额/链上结算 → Solana / ChainHub 合约

NIP-90 原生支持 Lightning:
  - DVM 在 kind 7000 feedback 里附带 bolt11 invoice
  - Customer 用 Lightning 支付
  - 或通过 NWC (Nostr Wallet Connect) 自动支付
```

---

## 九、已有先例

1. **TrueMatch** — 用 NIP-04 + NIP-90 做 Agent 匹配网络 (Reddit 上的项目)
2. **FEDSTR** (学术论文) — 用 NIP-90 DVM 做去中心化联邦学习/LLM训练市场
3. **nostr-dvm** — 有人已运行 8 小时 DVM 提供文本生成和翻译服务，定价 50-100 sats/任务
4. **toll-booth-dvm** — 把任何 HTTP API 包装成 NIP-90 DVM
5. **DVMCP** — 把 MCP Server 桥接到 Nostr DVM (和 Gradience 的 A2A 理念非常契合)

---

## 十、实施建议

### Phase 1: 升级加密 (1-2 天)

```
现有 NIP-04 → NIP-44 + NIP-17 + NIP-59
- 替换 nostr-adapter.ts 中的 NIP-04 加密为 NIP-44
- 引入 Gift Wrap 三层加密
- 更新 nostr-types.ts: kind:4 → kind:14
```

### Phase 2: 引入 NIP-89 Agent 发现 (2-3 天)

```
- Agent 启动时发布 kind:31990 公告
- 实现 Agent 发现查询 (替代 Indexer API)
- 保留 kind:10002/10003/10004 作为补充
- 移除对 Indexer 服务的依赖
```

### Phase 3: 引入 NIP-90 DVM 任务市场 (3-5 天)

```
- 定义 Gradience 专用 job kind (或使用 5800 通用)
- 实现 Job Request / Result / Feedback 流程
- 集成 Lightning 支付 (可选，先用 Solana)
- 替代 Arena 的中心化任务匹配
```

### Phase 4: 清理 (1 天)

```
- 移除 packages/indexer-mock
- 移除 Indexer 相关 task (GRA-65 等)
- 更新架构文档
- 更新白皮书
```

---

## 十一、风险与注意

1. **Relay 可靠性**: 公共 relay 可能不稳定，建议同时连接 3-4 个
2. **延迟**: Nostr relay 中继比直连 Indexer 稍慢 (~100-500ms)
3. **搜索能力有限**: Nostr relay 的过滤能力比不上数据库查询，
   复杂搜索可能需要本地缓存
4. **Lightning 集成复杂度**: 如果要支持 Lightning 微支付，
   需要额外集成 LN 钱包 (可以先期只用 Solana)

---

## 结论

**强烈推荐采用此方案。** 理由:

1. ✅ 彻底消除 Indexer 服务器依赖
2. ✅ 与比特币/Lightning 生态原生兼容
3. ✅ 成熟的 TypeScript 库支持 (nostr-tools, NDK)
4. ✅ 已有真实运行的 DVM 市场先例
5. ✅ 你们已有 Nostr Adapter 基础，改造成本低
6. ✅ 完美对齐 "去信任结算层" 的协议定位
