# Phase 5: Test Spec — A2A Protocol v0.1

> **输入**:  
> `apps/a2a-protocol/docs/03-technical-spec.md`  
> `apps/a2a-protocol/docs/04-task-breakdown.md`

---

## 5.1 测试策略

| 测试类型         | 覆盖范围                             | 工具                      | 运行环境 |
| ---------------- | ------------------------------------ | ------------------------- | -------- |
| Program 单元测试 | 常量、长度、反序列化、错误映射       | `cargo test`              | 本地     |
| Program 集成测试 | 指令状态机（thread/channel/subtask） | LiteSVM                   | 本地     |
| SDK 单测         | 参数编码、账户推导、错误映射         | `tsx --test`              | Node/Bun |
| Runtime 集成测试 | relay API + 存储 + 编排流程          | `tsx --test`              | Node/Bun |
| 端到端测试       | A2A-0/1/2 全流程联动                 | Local validator + runtime | 本地     |
| 安全测试         | 签名重放、越权、争议窗口、竞标攻击   | LiteSVM + tsx             | 本地     |
| 性能测试         | relay 拉取分页、高并发竞标           | benchmark 脚本            | 本地     |

## 5.2 测试用例表

### 5.2.1 `initialize_network_config`

**Happy**

- H1: 正常初始化 config 成功，字段与输入一致
- H2: 读取 config version/discriminator 正确

**Boundary**

- B1: `max_message_bytes = 1` 可初始化
- B2: `max_dispute_slots = 1` 可初始化

**Error**

- E1: 非 signer 调用 -> `Unauthorized`
- E2: 重复初始化 -> `AccountAlreadyInitialized`
- E3: arbitration_authority = zero -> `Unauthorized/HashEmpty`（按实现错误码）

### 5.2.2 `upsert_agent_profile`

**Happy**

- H1: 首次 upsert 创建 profile
- H2: 再次 upsert 更新 capability 与 heartbeat

**Boundary**

- B1: capability_mask 最小非零
- B2: transport_flags 最大值

**Error**

- E1: 非 authority 更新 -> `Unauthorized`
- E2: profile PDA 不匹配 -> `InvalidSeeds`

### 5.2.3 `create_thread` / `post_message` / `archive_thread`

**Happy**

- H1: create_thread 成功，初始 `message_count=0`
- H2: post_message 成功，`message_count+1`
- H3: archive_thread 后状态为 archived

**Boundary**

- B1: `payment_microlamports=0` 允许
- B2: `body_hash` 固定 32 bytes 最小有效值

**Error**

- E1: sequence 非连续 -> `InvalidStateTransition`
- E2: nonce 回退 -> `NonceReplay`
- E3: archived 后 post_message -> `InvalidStateTransition`
- E4: body 超限 -> `MessageTooLarge`

### 5.2.4 `open_channel` / `cooperative_close_channel`

**Happy**

- H1: open_channel 成功并锁定押金
- H2: cooperative_close 双签名成功，状态 closing/settled
- H3: 结算金额计算正确（payee+payer_refund=deposit）

**Boundary**

- B1: deposit = min_channel_deposit
- B2: spent_amount = deposit（全额支付）

**Error**

- E1: deposit < min -> `ChannelInsufficientDeposit`
- E2: spent > deposit -> `SettlementAmountInvalid`
- E3: 签名无效 -> `InvalidSignature`

### 5.2.5 `open_channel_dispute` / `resolve_channel_dispute`

**Happy**

- H1: open dispute 成功写入 dispute_deadline
- H2: arbitration authority resolve 成功并 settled

**Boundary**

- B1: 在 dispute_deadline 最后一个 slot resolve 成功

**Error**

- E1: 非 arbitration authority resolve -> `Unauthorized`
- E2: dispute window 关闭后再操作 -> `DisputeWindowClosed`

### 5.2.6 `create_subtask_order` / `submit_subtask_bid`

**Happy**

- H1: create_subtask_order 进入 bidding
- H2: submit_subtask_bid 成功，bid 账户写入

**Boundary**

- B1: `budget=1`
- B2: `stake=min_bid_stake`
- B3: `bid_deadline = now+1`

**Error**

- E1: `execute_deadline <= bid_deadline` -> `DeadlineInvalid`
- E2: 截止后提交 bid -> `BidWindowClosed`
- E3: stake 不足 -> `InvalidBidStake`

### 5.2.7 `assign_bid` / `submit_subtask_delivery` / `settle_subtask` / `cancel_subtask_order`

**Happy**

- H1: assign_bid 后 `selected_agent` 生效
- H2: selected_agent submit_delivery 成功
- H3: settle_subtask 成功，状态 settled
- H4: cancel_subtask_order 在 bidding/assigned 成功

**Boundary**

- B1: settle_amount = quote_amount
- B2: cancel 在 assigned 边界状态成功

**Error**

- E1: 非 selected_agent 交付 -> `SubtaskNotAssigned/Unauthorized`
- E2: 重复 settle -> `InvalidStateTransition`
- E3: settle_amount > budget -> `SettlementAmountInvalid`

### 5.2.8 SDK 与 Runtime

**Happy**

- H1: SDK 每个 API 正确编码指令
- H2: Runtime relay publish/pull 成功
- H3: 编排器从 bidding 自动推进到 assigned/delivered/settled

**Boundary**

- B1: relay pull 分页边界（空页、最后一页）
- B2: 同 envelope 幂等重投

**Error**

- E1: Runtime 收到非法 envelope 丢弃并记录
- E2: Adapter 回写失败时进入重试队列

## 5.3 集成测试场景（必填）

| #   | 场景名称         | 步骤                                                        | 预期结果           |
| --- | ---------------- | ----------------------------------------------------------- | ------------------ |
| I1  | A2A-0 消息闭环   | upsert profile → create thread → post message → archive     | 线程与消息状态一致 |
| I2  | A2A-1 通道闭环   | open channel → off-chain signed updates → cooperative close | 结算金额准确       |
| I3  | A2A-1 争议闭环   | open channel → dispute → resolve                            | 非法方无法裁决     |
| I4  | A2A-2 子任务闭环 | create subtask → multi bids → assign → delivery → settle    | 子任务完成并结算   |
| I5  | 跨模块联动       | settle subtask → Arena/ChainHub adapter 回写                | 外部状态同步正确   |

## 5.4 安全测试场景（必填）

| #   | 攻击名称            | 攻击方式                   | 预期防御                 | 验证方法               |
| --- | ------------------- | -------------------------- | ------------------------ | ---------------------- |
| S1  | Envelope 重放       | 重发旧 nonce 消息          | `NonceReplay`            | Program 集成测试       |
| S2  | 未授权 profile 篡改 | 非 authority upsert        | `Unauthorized`           | Program 集成测试       |
| S3  | 通道旧状态提交      | 提交低 nonce close/dispute | 拒绝并保持当前状态       | Program 集成测试       |
| S4  | 仲裁越权            | 非仲裁方 resolve           | `Unauthorized`           | Program 集成测试       |
| S5  | 竞标刷单            | 低 stake 高频 bid          | `InvalidBidStake` + 限流 | 集成+压力测试          |
| S6  | 超大 payload DOS    | body > max bytes           | `MessageTooLarge`        | Program + Runtime 测试 |
| S7  | Adapter 权限绕过    | 构造伪造回写请求           | adapter 拒绝并记录       | Runtime 测试           |

## 5.5 测试代码骨架（必填）

### Rust（Program）

- `apps/a2a-protocol/tests/integration-tests/src/test_initialize_profile.rs`
- `apps/a2a-protocol/tests/integration-tests/src/test_message_thread.rs`
- `apps/a2a-protocol/tests/integration-tests/src/test_channel_lifecycle.rs`
- `apps/a2a-protocol/tests/integration-tests/src/test_subtask_lifecycle.rs`
- `apps/a2a-protocol/tests/integration-tests/src/test_security_paths.rs`

### TypeScript（SDK/Runtime）

- `apps/a2a-protocol/sdk/src/a2a-sdk.test.ts`
- `apps/a2a-protocol/runtime/src/relay.test.ts`
- `apps/a2a-protocol/runtime/src/orchestrator.test.ts`
- `apps/a2a-protocol/runtime/src/adapters/arena-chainhub.test.ts`

## 5.6 测试覆盖目标（必填）

| 指标                    | 目标                 |
| ----------------------- | -------------------- |
| Program 指令覆盖率      | 100%（所有公开指令） |
| Program 分支覆盖率      | ≥ 90%                |
| SDK/Runtimes 语句覆盖率 | ≥ 90%                |
| 安全测试场景            | S1-S7 全部通过       |
| E2E 核心场景            | I1-I5 全部通过       |

---

## ✅ Phase 5 验收标准

- [x] 技术规格中的主要接口均有测试映射
- [x] Happy + Boundary + Error 三类齐全
- [x] 安全测试场景已映射
- [x] 测试文件骨架已定义
- [x] 集成测试 ≥ 3 个场景
- [x] 覆盖目标已量化

**验收通过后，进入 Phase 6: Implementation →**
