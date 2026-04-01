# Phase 3: Technical Spec（技术规格）

> **目的**: 将架构设计转化为可直接编码的精确规格  
> **输入**: `apps/a2a-protocol/docs/02-architecture.md`  
> **输出物**: `apps/a2a-protocol/docs/03-technical-spec.md`

---

## 3.1 数据结构定义（必填）

### 3.1.1 链上数据结构（Solana Program）

统一账户头：`[discriminator: u8, version: u8]`（2 bytes），`version = 1`。  
Program 风格：Pinocchio/no_std，Borsh 序列化。

#### NetworkConfig（PDA: `[b"a2a_config"]`）

| 字段 | 类型 | 大小 (bytes) | 约束 | 说明 |
|------|------|-------------|------|------|
| discriminator | u8 | 1 | 固定 `0xA1` | 账户类型 |
| version | u8 | 1 | 固定 `1` | 版本 |
| upgrade_authority | [u8;32] | 32 | 非零 | 升级权限 |
| arbitration_authority | [u8;32] | 32 | 非零 | 争议裁决权限 |
| min_channel_deposit | u64 | 8 | >0 | 通道最小押金 |
| min_bid_stake | u64 | 8 | >=0 | 子任务竞标最小押金 |
| max_message_bytes | u32 | 4 | `<= 4096` | 消息体最大字节 |
| max_dispute_slots | u64 | 8 | >0 | 争议窗口 |
| bump | u8 | 1 | PDA bump | |
| **总计** |  | **94** |  | |

#### AgentProfile（PDA: `[b"agent_profile", agent_pubkey]`）

| 字段 | 类型 | 大小 | 约束 | 说明 |
|------|------|------|------|------|
| discriminator/version | u8/u8 | 2 | 固定 | |
| agent | [u8;32] | 32 | 非零 | Agent 地址 |
| authority | [u8;32] | 32 | signer 匹配 | profile 管理者 |
| capability_mask | u64 | 8 | bitmask | 能力声明 |
| transport_flags | u16 | 2 | bitmask | ws/http/p2p 支持 |
| last_heartbeat_slot | u64 | 8 | 单调递增 | 活跃度 |
| metadata_uri_hash | [u8;32] | 32 | 可零 | 元数据哈希 |
| status | u8 | 1 | 0/1 | inactive/active |
| bump | u8 | 1 | | |
| **总计** |  | **118** |  | |

#### MessageThread（PDA: `[b"thread", creator, counterparty, &thread_id_le]`）

| 字段 | 类型 | 大小 | 约束 | 说明 |
|------|------|------|------|------|
| discriminator/version | u8/u8 | 2 | 固定 | |
| thread_id | u64 | 8 | 单调递增 | 线程 ID |
| creator | [u8;32] | 32 | 非零 | 创建者 |
| counterparty | [u8;32] | 32 | 可零 | 广播时可零 |
| policy_hash | [u8;32] | 32 | 可零 | 策略快照 |
| message_count | u32 | 4 | 单调递增 | 信封计数 |
| latest_message_slot | u64 | 8 | 单调递增 | |
| status | u8 | 1 | 0/1/2 | draft/active/archived |
| bump | u8 | 1 | | |
| **总计** |  | **120** |  | |

#### MessageEnvelope（PDA: `[b"msg", &thread_id_le, &sequence_le]`）

| 字段 | 类型 | 大小 | 约束 | 说明 |
|------|------|------|------|------|
| discriminator/version | u8/u8 | 2 | 固定 | |
| thread_id | u64 | 8 | 关联 thread | |
| sequence | u32 | 4 | `= thread.message_count + 1` | 序号 |
| from_agent | [u8;32] | 32 | 非零 | 发送方 |
| to_agent | [u8;32] | 32 | 可零 | 广播可零 |
| message_type | u8 | 1 | 枚举 | invite/bid/delivery/... |
| codec | u8 | 1 | 枚举 | 0=json,1=cbor |
| nonce | u64 | 8 | 单调 | 防重放 |
| created_at | i64 | 8 | unix sec | |
| body_hash | [u8;32] | 32 | 非零 | 仅上链哈希 |
| sig_r | [u8;32] | 32 | 非零 | Ed25519 签名片段 |
| sig_s | [u8;32] | 32 | 非零 | Ed25519 签名片段 |
| payment_microlamports | u64 | 8 | >=0 | 计费字段 |
| flags | u16 | 2 | bitmask | ack/disputed/... |
| bump | u8 | 1 | | |
| **总计** |  | **203** |  | |

#### PaymentChannel（PDA: `[b"channel", payer, payee, &channel_id_le]`）

| 字段 | 类型 | 大小 | 约束 | 说明 |
|------|------|------|------|------|
| discriminator/version | u8/u8 | 2 | 固定 | |
| channel_id | u64 | 8 | 单调递增 | |
| payer | [u8;32] | 32 | 非零 | 出资方 |
| payee | [u8;32] | 32 | 非零 | 收款方 |
| mediator | [u8;32] | 32 | 非零 | 仲裁方 |
| token_mint | [u8;32] | 32 | 可零 | 零表示 SOL |
| deposit_amount | u64 | 8 | >= min | 初始押金 |
| spent_amount | u64 | 8 | `<= deposit` | 已花费 |
| nonce | u64 | 8 | 单调递增 | 通道状态号 |
| expires_at | i64 | 8 | > now | 到期时间 |
| dispute_deadline | i64 | 8 | >=0 | dispute 截止 |
| status | u8 | 1 | 0..4 | open/closing/disputed/settled/cancelled |
| pending_settle_amount | u64 | 8 | >=0 | 待结算金额 |
| bump | u8 | 1 | | |
| **总计** |  | **196** |  | |

#### SubtaskOrder（PDA: `[b"subtask", &parent_task_id_le, &subtask_id_le]`）

| 字段 | 类型 | 大小 | 约束 | 说明 |
|------|------|------|------|------|
| discriminator/version | u8/u8 | 2 | 固定 | |
| parent_task_id | u64 | 8 | 非零 | 对应 Arena task |
| subtask_id | u32 | 4 | 单调递增 | 子任务序号 |
| requester | [u8;32] | 32 | signer | 需求方 |
| selected_agent | [u8;32] | 32 | 可零 | 分配后写入 |
| budget | u64 | 8 | >0 | 子任务预算 |
| bid_deadline | i64 | 8 | > now | 竞标截止 |
| execute_deadline | i64 | 8 | > bid_deadline | 执行截止 |
| requirement_hash | [u8;32] | 32 | 非零 | 需求文档哈希 |
| delivery_hash | [u8;32] | 32 | 可零 | 交付物哈希 |
| escrow_channel_id | u64 | 8 | 可零 | 关联通道 |
| status | u8 | 1 | 0..6 | drafting/bidding/assigned/delivered/settled/disputed/cancelled |
| bump | u8 | 1 | | |
| **总计** |  | **176** |  | |

#### SubtaskBid（PDA: `[b"bid", &parent_task_id_le, &subtask_id_le, bidder]`）

| 字段 | 类型 | 大小 | 约束 | 说明 |
|------|------|------|------|------|
| discriminator/version | u8/u8 | 2 | 固定 | |
| parent_task_id | u64 | 8 | 非零 | |
| subtask_id | u32 | 4 | 非零 | |
| bidder | [u8;32] | 32 | signer | 报价方 |
| quote_amount | u64 | 8 | >0 | 报价 |
| stake_amount | u64 | 8 | >= min_bid_stake | 押金 |
| eta_seconds | u32 | 4 | >0 | 预计耗时 |
| commitment_hash | [u8;32] | 32 | 非零 | 报价承诺 |
| status | u8 | 1 | 0/1/2 | open/won/lost |
| bump | u8 | 1 | | |
| **总计** |  | **100** |  | |

### 3.1.2 链下数据结构

```sql
CREATE TABLE relay_envelopes (
  id TEXT PRIMARY KEY,                 -- thread_id:sequence
  thread_id BIGINT NOT NULL,
  sequence INTEGER NOT NULL,
  from_agent TEXT NOT NULL,
  to_agent TEXT,
  message_type INTEGER NOT NULL,
  body_json TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  signature_hex TEXT NOT NULL,
  received_at BIGINT NOT NULL,
  delivery_state TEXT NOT NULL         -- queued/delivered/failed
);

CREATE TABLE channel_signed_states (
  channel_id BIGINT NOT NULL,
  nonce BIGINT NOT NULL,
  spent_amount BIGINT NOT NULL,
  payer_sig TEXT NOT NULL,
  payee_sig TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (channel_id, nonce)
);
```

### 3.1.3 配置与常量

| 常量名 | 值 | 类型 | 说明 | 可变性 |
|--------|----|------|------|--------|
| ACCOUNT_VERSION_V1 | 1 | u8 | 账户版本 | immutable |
| MAX_MESSAGE_BYTES | 4096 | u32 | 单条消息体上限 | configurable |
| MAX_BID_PER_SUBTASK | 128 | u16 | 子任务最大竞标数 | configurable |
| DEFAULT_DISPUTE_SLOTS | 43200 | u64 | 约 1 天争议窗口 | configurable |
| SCORE_SCALE | 10_000 | u64 | 竞标评分缩放因子 | immutable |

## 3.2 接口定义（必填）

### 3.2.1 Program 指令

#### `initialize_network_config`
- 调用者：upgrade authority signer  
- 前置：config PDA 未初始化  
- 后置：写入 NetworkConfig

参数：`arbitration_authority: [u8;32]`, `min_channel_deposit: u64`, `min_bid_stake: u64`, `max_message_bytes: u32`, `max_dispute_slots: u64`

账户：`[authority signer, config mut, system_program]`

---

#### `upsert_agent_profile`
- 调用者：agent authority signer  
- 前置：authority 与 profile.agent 匹配  
- 后置：创建或更新 AgentProfile

参数：`capability_mask: u64`, `transport_flags: u16`, `metadata_uri_hash: [u8;32]`, `status: u8`

账户：`[authority signer, profile mut, config, system_program]`

---

#### `create_thread`
参数：`thread_id: u64`, `counterparty: [u8;32]`, `policy_hash: [u8;32]`  
账户：`[creator signer, thread mut, system_program]`

#### `post_message`
参数：`thread_id: u64`, `sequence: u32`, `message_type: u8`, `codec: u8`, `nonce: u64`, `created_at: i64`, `body_hash: [u8;32]`, `sig_r: [u8;32]`, `sig_s: [u8;32]`, `payment_microlamports: u64`, `flags: u16`  
账户：`[sender signer, thread mut, envelope mut, sender_profile, system_program]`

#### `archive_thread`
参数：`thread_id: u64`  
账户：`[actor signer, thread mut]`

---

#### `open_channel`
参数：`channel_id: u64`, `deposit_amount: u64`, `expires_at: i64`, `token_mint: [u8;32]`, `mediator: [u8;32]`  
账户：`[payer signer mut, payee, channel mut, vault mut, config, token/system_program]`

#### `cooperative_close_channel`
参数：`channel_id: u64`, `nonce: u64`, `spent_amount: u64`, `payer_sig`, `payee_sig`  
账户：`[payer signer, payee signer, channel mut, vault mut]`

#### `open_channel_dispute`
参数：`channel_id: u64`, `nonce: u64`, `spent_amount: u64`, `payer_sig`, `payee_sig`  
账户：`[complainant signer, channel mut]`

#### `resolve_channel_dispute`
参数：`channel_id: u64`, `final_spent_amount: u64`  
账户：`[arbitration_authority signer, channel mut, vault mut]`

---

#### `create_subtask_order`
参数：`parent_task_id: u64`, `subtask_id: u32`, `budget: u64`, `bid_deadline: i64`, `execute_deadline: i64`, `requirement_hash: [u8;32]`, `escrow_channel_id: u64`  
账户：`[requester signer, subtask mut, config, system_program]`

#### `submit_subtask_bid`
参数：`parent_task_id: u64`, `subtask_id: u32`, `quote_amount: u64`, `stake_amount: u64`, `eta_seconds: u32`, `commitment_hash: [u8;32]`  
账户：`[bidder signer mut, bid mut, subtask mut, bidder_profile, config, system_program]`

#### `assign_subtask_bid`
参数：`parent_task_id: u64`, `subtask_id: u32`, `winner: [u8;32]`  
账户：`[requester signer, subtask mut, winning_bid mut]`

#### `submit_subtask_delivery`
参数：`parent_task_id: u64`, `subtask_id: u32`, `delivery_hash: [u8;32]`  
账户：`[selected_agent signer, subtask mut]`

#### `settle_subtask`
参数：`parent_task_id: u64`, `subtask_id: u32`, `settle_amount: u64`  
账户：`[requester signer OR arbitration_authority signer, subtask mut, channel mut, vault mut]`

#### `cancel_subtask_order`
参数：`parent_task_id: u64`, `subtask_id: u32`  
账户：`[requester signer, subtask mut]`

### 3.2.2 REST API（A2A Runtime）

**`POST /v1/discovery/announce`**  
Body: `{ agent: string, capabilityMask: number, transportFlags: number, endpoint: string }`  
Resp: `200 { ok: true, seenAt: number }`

**`GET /v1/discovery/agents?capabilityMask=&limit=&cursor=`**  
Resp: `200 { items: AgentDescriptor[], nextCursor?: string }`

**`POST /v1/envelopes/publish`**  
Body: `{ envelope: SignedEnvelope, body: object }`  
Resp: `202 { accepted: true, relayId: string }`

**`GET /v1/envelopes/pull?agent=&after=`**  
Resp: `200 { items: RelayEnvelope[] }`

### 3.2.3 SDK 公开接口

```typescript
export interface A2ASDK {
  upsertAgentProfile(input: UpsertAgentProfileInput): Promise<string>;
  createThread(input: CreateThreadInput): Promise<string>;
  postMessage(input: PostMessageInput): Promise<string>;
  openChannel(input: OpenChannelInput): Promise<string>;
  cooperativeCloseChannel(input: CooperativeCloseInput): Promise<string>;
  createSubtask(input: CreateSubtaskInput): Promise<string>;
  submitBid(input: SubmitBidInput): Promise<string>;
  assignBid(input: AssignBidInput): Promise<string>;
  settleSubtask(input: SettleSubtaskInput): Promise<string>;
}
```

### 3.2.4 事件 / 回调

| 事件名 | 触发时机 | 数据格式 |
|--------|---------|---------|
| AgentDiscovered | profile upsert 成功 | `{ agent, capabilityMask, slot }` |
| MessagePosted | envelope 上链 | `{ threadId, sequence, from, to, bodyHash }` |
| ChannelStatusChanged | channel 状态变化 | `{ channelId, status, nonce, spentAmount }` |
| SubtaskStatusChanged | 子任务状态变化 | `{ parentTaskId, subtaskId, status, selectedAgent }` |

## 3.3 错误码定义（必填）

| 错误码 | 名称 | 触发条件 | 用户提示 |
|--------|------|---------|---------|
| 8100 | InvalidVersion | 账户版本不匹配 | 账户版本不兼容 |
| 8101 | Unauthorized | signer/authority 不匹配 | 权限不足 |
| 8102 | InvalidStateTransition | 非法状态流转 | 状态不允许该操作 |
| 8103 | InvalidSignature | 信封或通道签名非法 | 签名校验失败 |
| 8104 | NonceReplay | nonce 非单调递增 | 检测到重放 |
| 8105 | MessageTooLarge | body 超过 max_message_bytes | 消息过大 |
| 8106 | ChannelInsufficientDeposit | spent/deposit 关系非法 | 通道余额不足 |
| 8107 | DisputeWindowClosed | 超过争议窗口 | 争议窗口已关闭 |
| 8108 | BidWindowClosed | 超过竞标截止 | 竞标已截止 |
| 8109 | InvalidBidStake | 押金低于最小值 | 押金不足 |
| 8110 | SubtaskAlreadyAssigned | 重复分配 | 子任务已分配 |
| 8111 | SubtaskNotAssigned | 交付时未分配 | 子任务未分配 |
| 8112 | SettlementAmountInvalid | 结算金额越界 | 结算金额非法 |
| 8113 | DeadlineInvalid | 各类 deadline 非法 | 截止时间非法 |
| 8114 | HashEmpty | 哈希字段为空 | 哈希不能为空 |

## 3.4 状态机精确定义（必填）

### ThreadStatus

| 当前状态 | 触发动作 | 条件 | 新状态 | 副作用 |
|---------|---------|------|--------|--------|
| draft | post_message | 首条消息成功 | active | `message_count += 1` |
| active | archive_thread | creator/counterparty | archived | 禁止新消息 |

### ChannelStatus

| 当前状态 | 触发动作 | 条件 | 新状态 | 副作用 |
|---------|---------|------|--------|--------|
| open | cooperative_close | 双签名 + nonce 更新 | closing | 记录待结算金额 |
| open | open_channel_dispute | 有效证据 | disputed | 写 dispute_deadline |
| closing | settle_close | nonce 匹配 | settled | 分账 + 释放资金 |
| disputed | resolve_channel_dispute | arbitration signer | settled | 仲裁金额分账 |

### SubtaskStatus

| 当前状态 | 触发动作 | 条件 | 新状态 | 副作用 |
|---------|---------|------|--------|--------|
| drafting | create_subtask_order | 参数合法 | bidding | 打开竞标窗口 |
| bidding | assign_subtask_bid | 截止后或强制分配 | assigned | 写 selected_agent |
| assigned | submit_subtask_delivery | selected_agent signer | delivered | 写 delivery_hash |
| delivered | settle_subtask | requester/arbiter | settled | 触发通道支付 |
| bidding/assigned | cancel_subtask_order | requester signer | cancelled | 退回押金 |
| delivered | open_channel_dispute | 证据冲突 | disputed | 进入仲裁 |

## 3.5 算法与计算（必填）

### 信封签名消息

```
signing_payload = keccak256(
  thread_id || sequence || from_agent || to_agent || message_type ||
  codec || nonce || created_at || body_hash || payment_microlamports || flags
)
verify_ed25519(from_agent_pubkey, sig, signing_payload)
```

### 通道结算

```
require(spent_amount <= deposit_amount)
payee_receive = spent_amount
payer_refund = deposit_amount - spent_amount
```

### 子任务竞标评分（用于 assign 默认建议）

```
price_score = (budget * SCORE_SCALE) / quote_amount              // 越低价越高分
rep_score   = min(global_avg_score_bps, 10000)                   // 来自 Arena/Indexer
eta_score   = min((target_eta * SCORE_SCALE) / eta_seconds, 10000)
final_score = price_score*40% + rep_score*40% + eta_score*20%
```

精度：全部使用整数缩放，向下取整；tie-break：`higher rep_score` -> `earlier bid slot`。

## 3.6 安全规则（必填）

| 规则 | 实现方式 | 验证方法 |
|------|---------|---------|
| 版本防护 | 读取账户强制校验 `version==1` | 单测 + 集成测 |
| 防重放 | thread/channel nonce 单调递增 | 单测 |
| 权限校验 | 每条 ix 明确 signer + authority | 单测 |
| 双签结算 | cooperative_close 需要 payer/payee 双签 | 单测 |
| 争议可裁决 | disputed 仅 arbitration authority 可 resolve | 单测 |
| 数据完整性 | 大 payload 仅存 hash，上链字段固定长度 | 单测 |

## 3.7 PDA / 地址推导（必填）

| PDA 用途 | 种子 | Bump | 说明 |
|---------|------|------|------|
| NetworkConfig | `[b"a2a_config"]` | stored | 全局配置 |
| AgentProfile | `[b"agent_profile", agent]` | stored | Agent 声明 |
| MessageThread | `[b"thread", creator, counterparty, &thread_id_le]` | stored | 会话线程 |
| MessageEnvelope | `[b"msg", &thread_id_le, &sequence_le]` | stored | 消息索引 |
| PaymentChannel | `[b"channel", payer, payee, &channel_id_le]` | stored | 通道 |
| SubtaskOrder | `[b"subtask", &parent_task_id_le, &subtask_id_le]` | stored | 子任务 |
| SubtaskBid | `[b"bid", &parent_task_id_le, &subtask_id_le, bidder]` | stored | 竞标 |

## 3.8 升级与迁移（可选）

- `version` 字节用于 future migration。  
- v2 引入新字段时：新增指令 `migrate_account_v1_to_v2`，旧版只读不写。

## 3.9 边界条件清单（必填）

| # | 边界条件 | 预期行为 | 备注 |
|---|---------|---------|------|
| 1 | `max_message_bytes = 0` | 初始化拒绝 | `DeadlineInvalid/MessageTooLarge` |
| 2 | `post_message` body_hash 全 0 | 拒绝 | `HashEmpty` |
| 3 | 同一 `(thread,sequence)` 重复写 | 拒绝 | account already initialized |
| 4 | nonce 回退 | 拒绝 | `NonceReplay` |
| 5 | 通道 `spent > deposit` | 拒绝 | `ChannelInsufficientDeposit` |
| 6 | dispute 超时后再提交 | 拒绝 | `DisputeWindowClosed` |
| 7 | `bid_deadline >= execute_deadline` | 拒绝 | `DeadlineInvalid` |
| 8 | 竞标截止后 submit_bid | 拒绝 | `BidWindowClosed` |
| 9 | 未分配 agent 提交 delivery | 拒绝 | `SubtaskNotAssigned` |
| 10 | settle 金额 > subtask budget | 拒绝 | `SettlementAmountInvalid` |
| 11 | 非仲裁方 resolve dispute | 拒绝 | `Unauthorized` |
| 12 | account version != 1 | 拒绝反序列化 | `InvalidVersion` |

---

## ✅ Phase 3 验收标准

- [x] 数据结构精确到字段类型和字节大小  
- [x] 接口有参数、返回值、错误码定义  
- [x] 错误码统一编号  
- [x] 状态机转换条件精确  
- [x] 关键计算有公式和精度说明  
- [x] 安全规则映射到实现  
- [x] PDA 种子定义完整  
- [x] 边界条件 ≥ 10 条  
- [ ] 团队/相关人评审确认后进入 Phase 4

**验收通过后，进入 Phase 4: Task Breakdown →**
