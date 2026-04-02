# Phase 4: Task Breakdown — Agent Layer v2 (Updated)

> **目的**: 将技术规格拆解为可执行、可分配、可验收的独立任务
> **输入**: `docs/03-technical-spec.md`
> **输出物**: 本文档
> **更新日期**: 2026-04-02
> **更新说明**: 根据 Gap Analysis 重新调整优先级，T19a-d 提升为 W1 阻塞项，AgentM 任务细化

---

## 4.1 拆解原则

1. **每个任务 ≤ 4 小时**（如果超过，继续拆）
2. **每个任务有明确的 Done 定义**（可验证）
3. **任务之间的依赖关系必须标明**
4. **先基础后上层**（按依赖顺序排列）
5. **关键路径优先**（P0 阻塞项优先于 P1）

---

## 4.2 关键路径总览

```
W1 (4月1-14日): Program 核心 + 集成测试 (T19a-d 为唯一阻塞项)
    ↓
W2 (4月15-21日): Indexer + SDK + CLI + Judge Daemon + 前端
    ↓
W3 (4月22-26日): AgentM MVP + Chain Hub + GRAD Token
    ↓
W4 (4月27-30日): EVM + 跨链 + A2A (Stretch Goals)
```

---

## 4.3 任务列表

### 🔴 W1（2026-04-01 ~ 04-14，2 周）— Solana 核心 Program + 集成测试

> **W1 关键目标**：完成 Solana Program 核心功能 + 集成测试（T19a-d 为唯一阻塞项）
> **容量**：2 周 × ~4h/天 ≈ 56h；本节任务合计 **52h**，留 4h 缓冲
> **验收标准**：T19a-d 全部通过方可进入 W2

| # | 任务名称 | 描述 | 依赖 | 时间 | 优先级 | Done 定义 |
|---|---------|------|------|------|--------|----------|
| T01 | Pinocchio 工作区脚手架 | 以 `npx create-solana-dapp -t solana-foundation/templates/pinocchio/pinocchio-counter` 初始化仓库骨架；workspace 依赖版本（来自官方模板 2026-03）：pinocchio ^0.10.1、pinocchio-system ^0.5.0、pinocchio-token ^0.6、pinocchio-token-2022 ^0.5、pinocchio-associated-token-account ^0.3、pinocchio-log ^0.5.1、codama ^0.7.2、const-crypto ^0.3.0、thiserror ^2.0、borsh ^1.6、solana-security-txt ^1；保留模板的 `justfile` / `traits/` / `utils/` 目录结构；替换 program ID 和模块名为 Gradience | 无 | 1h | P0 | `just build` 通过；`just unit-test` 绿；目录结构与 §3.8 一致；CI 配置可触发构建 |
| T02 | 常量 + 错误码模块 | `constants.rs` 所有 **15 个**不可变常量（JUDGE_FEE_BPS/PROTOCOL_FEE_BPS/AGENT_FEE_BPS/CANCEL_FEE_BPS/FORCE_REFUND_DELAY/UNSTAKE_COOLDOWN/MAX_JUDGES_PER_POOL/MAX_CATEGORIES/MIN_SCORE/MAX_SCORE/MAX_REF_LEN/MAX_PROVIDER_LEN/MAX_MODEL_LEN/MAX_RUNTIME_LEN/MAX_VERSION_LEN）+ 1 个可配置常量（min_judge_stake）；`errors.rs` **30 个命名错误码**，编号分布在 6000-6041 范围内（组间有意留间隔）：状态组 6000-6006（7个，含 DeadlineNotPassed 6006），权限组 6010-6014（5个），质押组 6020-6025（6个），验证组 6030-6039（10个），算术 6040（1个），Token 6041（1个） | T01 | 1h | P0 | 编译通过；15 个不可变常量类型正确；30 个错误码名称与规格 100% 一致 |
| T03 | 账户结构体 — Task / Escrow / Application | `Task`（315B）、`Escrow`（49B）、`Application`（57B）；`#[derive(BorshSerialize, BorshDeserialize)]`；无 Anchor discriminator；Pinocchio 手动分配空间 | T02 | 2h | P0 | `const TASK_SIZE: usize = 315` 等常量正确；字段类型与规格 100% 一致；Borsh 序列化/反序列化单元测试通过 |
| T04 | 账户结构体 — Submission / RuntimeEnv | `Submission`（497B）嵌套 `RuntimeEnv`（176B，MAX_VERSION_LEN=32）；所有字段、String 最大长度注解；`#[derive(BorshSerialize, BorshDeserialize)]` | T02 | 2h | P0 | `const SUBMISSION_SIZE: usize = 497` 正确；RuntimeEnv 4 字段 Borsh 总和 = 36+68+36+36=176 |
| T05 | 账户结构体 — Reputation / Stake / JudgePool / Treasury / ProgramConfig | `Reputation`（109B）、`Stake`（66B）、`JudgePool`（7210B）、`Treasury`（1B）、`ProgramConfig`（81B）；枚举 `TaskState` / `JudgeMode` / `Category`（`#[repr(u8)] + BorshSerialize/BorshDeserialize`） | T02 | 2h | P0 | 各结构体大小常量与规格一致；所有枚举 `repr(u8)` 正确；Borsh 单元测试通过 |
| T06 | `initialize` 指令 | 初始化 `ProgramConfig`（upgrade_authority、min_judge_stake）和 `Treasury` PDA；一次性调用；Pinocchio 手动检查 config account data_len == 0 防止重复初始化 | T05 | 2h | P0 | 测试：`initialize` → ProgramConfig 字段值正确；二次调用因 data_len > 0 而失败（`ProgramError::AccountAlreadyInUse`，非自定义码） |
| T07 | `post_task` — SOL 路径 | Task PDA 创建，SOL reward 转入 Escrow，`config.task_count++`；Pool 模式链上加权随机（sha256 seed）抽 Judge；**sol_log_data TaskCreated 事件** | T06, T16 | 3h | P0 | 测试：发 SOL 任务 → `Task.state=Open`，Escrow 余额 = reward；Pool 模式 judge 字段由协议填写；reward=0 → `ZeroReward`；TaskCreated 事件通过 parseEvents 验证 |
| T08a | SPL Token ATA 工具函数 | 封装 `create_associated_token_account` 工具函数；验证 ATA owner（authority = escrow PDA）；统一处理 Poster / Agent / Judge / Treasury 的 ATA 初始化逻辑；供 T08 / T09 / T11 / T13-T15 复用 | T06 | 2h | P0 | 工具函数编译通过；单元测试：创建 ATA → owner 正确；已存在 ATA 时幂等不报错 |
| T08 | `post_task` — SPL / Token-2022 路径 | SPL Token / Token-2022 版本：ATA 初始化，`token::transfer` 锁入 escrow_ata；检查 mint 是否启用 Transfer Hook / Confidential Transfer，有则返回 `UnsupportedMintExtension` | T07, T08a | 3h | P0 | 测试：SPL 任务 → escrow_ata 余额 = reward；带 Transfer Hook 的 Token-2022 mint → `UnsupportedMintExtension` |
| T09 | `apply_for_task` — SOL + SPL 路径 | Application PDA 手动创建，Reputation PDA 按需创建（data_len==0 检查），SOL / SPL 质押转入 Escrow（调用 T08a 工具函数）；**`rep.global.total_applied++`**（win_rate 分母）；前置条件：state=Open，deadline 未过，未重复申请；**sol_log_data TaskApplied 事件** | T08a, T07, T08 | 3h | P0 | 测试：apply → Application created，stake 锁入 Escrow，**`reputation.global.total_applied` 递增**；重复申请 → `AlreadyApplied`；`min_stake=0` 无需质押；TaskApplied 事件通过 parseEvents 验证 |
| T10 | `submit_result` | Submission PDA 创建（或覆盖更新），RuntimeEnv 四字段长度手动验证；前置条件：agent 已申请、deadline 未过；**sol_log_data SubmissionReceived 事件** | T09 | 2h | P0 | 测试：submit → Submission 字段正确；二次 submit → 覆盖；model 超长 → `InvalidRuntimeEnv`；未申请 → `AgentNotApplied`；SubmissionReceived 事件通过 parseEvents 验证 |
| T11 | `judge_and_pay` — SOL 路径 + 分账 | 分数验证（≥ MIN_SCORE）；赢家选取（highest score ≥ 60，tie→earliest slot）；整数除法费用计算（95/3/2 BPS）；三路 lamport 转账；`Task.state=Completed`；winner stake 走固定账户 `winner_application`；**落败者 stake 通过 `remaining_accounts` 批量退回**（同 cancel/refund 机制） | T10 | 3h | P0 | 测试：2 Agent 竞争 → 赢家得 95%，Judge 得 3%，Treasury 得 2%；**落败者 stake 原路退回**（remaining_accounts 验证）；余额精确到 lamport；非 Judge 调用 → `NotTaskJudge` |
| T12 | `judge_and_pay` — SPL + 信誉更新 | SPL Token 三路 CPI 转账（手动构建 InstructionView）；`Reputation` 全局统计更新（avg_score 滚动平均、win_rate）；`CategoryStats[category]` 更新；**sol_log_data TaskJudged 事件** | T11 | 3h | P0 | 测试：SPL 任务评判 → token 余额正确；全局 + category 信誉均更新；score < MIN_SCORE → TaskRefunded emit；TaskJudged 含 winner/payout/fees |
| T13 | `cancel_task` | 仅 Poster 可调用；前置条件：state=Open、**submission_count = 0**（已有提交不可取消）；2% 取消费到 Treasury，98% 退还 Poster；通过 `remaining_accounts` 批量退回 Agent 质押；`Task.state=Refunded`；**sol_log_data TaskCancelled 事件** | T08a, T07, T09 | 2h | P0 | 测试：cancel（无申请）→ Poster 得 98%，Treasury 得 2%；**已有提交时 cancel → `HasSubmissions`**；非 Poster → `NotTaskPoster`；TaskCancelled 事件通过 parseEvents 验证；"cancel 有申请时 stakes 退回" 场景在 T19c 集成测试验证 |
| T14 | `refund_expired` | 任何人调用；前置条件：state=Open、**clock > task.deadline**（提交截止，非 judge_deadline）；通过 `remaining_accounts` 批量退回 Agent 质押；全额退还 Poster；`Task.state=Refunded`；**sol_log_data TaskRefunded（reason=Expired）事件** | T08a, T07 | 2h | P0 | 测试：设时钟过期 → `refund_expired` 成功；**截止时间未到 → `DeadlineNotPassed`**（6006，非 JudgeDeadlineNotPassed）；TaskRefunded 事件携带 reason=Expired |
| T15 | `force_refund` + Slash 逻辑 | **T16 完成并通过测试后方可开始**；任何人调用；clock > judge_deadline + FORCE_REFUND_DELAY；Slash 三步；**资金分配：95% → Poster，3% → 提交数最多的 Agent，2% → Treasury**（非全额退款）；所有申请者 stakes 退回；**sol_log_data TaskRefunded（reason=ForceRefund）事件** | T08a, T07, T16 | 3h | P0 | 测试：force_refund → Poster 得 95%，最活跃 Agent 得 3%，Treasury 得 2%；Judge stake 扣减；stake 不足时从 Pool 移除；延迟未过 → `ForceRefundDelayNotPassed` |
| T16 | `register_judge` + `unstake_judge` | `register_judge`：质押 ≥ min_judge_stake，声明 category，首次调用手动检查 JudgePool data_len==0 并创建 PDA（7210B），计算初始权重；**sol_log_data JudgeRegistered 事件**；`unstake_judge`：冷却期检查，从 JudgePool 移除，退还质押；**sol_log_data JudgeUnstaked 事件** | T06 | 2h | P0 | 测试：首次 register → JudgePool 创建，JudgeRegistered 事件通过 parseEvents 验证；200 人后注册 → `JudgePoolFull`；unstake → Stake PDA 关闭，JudgeUnstaked 事件验证；冷却前 unstake → `CooldownNotExpired` |
| T17 | `upgrade_config` 指令 | 仅 upgrade_authority 可调用；更新 `treasury` 地址和 `min_judge_stake` | T06 | 1h | **P0** | 测试：upgrade_config 更新两字段后值正确；非 authority 调用 → `NotUpgradeAuthority` |
| T18 | IJudge 三层评判接口定义 | 定义 `IJudge` trait 和 CPI 接口；三层架构：① `TestCasesEvaluator`（C-1/C-2，测试用例 + 哈希对比，存根返回固定分数 80）；② `LLMScoreEvaluator` 接口存根（Type B，DSPy 实现在 T35）；③ `OnChainEvaluator` 接口存根（C-3/C-4，W4 实现）；接口注释文档 | T05 | 2h | P1 | 编译通过；三层接口均可被外部 Program 实现；`evaluationCID` JSON schema 与 §3.11 定义一致 |
| **T19a** | **集成测试 — initialize + post_task** | **【W1 阻塞项 - P0】** devnet 部署后：`initialize` → `post_task`（SOL Designated 模式）→ `post_task`（SOL Pool 模式）→ `post_task`（SPL）→ `post_task`（Token-2022 带 Hook → 拒绝）；升级路径：`upgrade_config` | T12, T13, T14, T15, T16, T17, T18, T08 | 3h | **P0** | litesvm + `@solana/web3.js` 5 个 post_task 场景全绿；Pool 模式 judge 字段由协议填写；TaskCreated 事件通过 parseEvents 验证 |
| **T19b** | **集成测试 — apply + submit** | **【W1 阻塞项 - P0】** `apply_for_task`（SOL stake、SPL stake、min_stake=0）→ `submit_result`（首次、覆盖）；RuntimeEnv 字段验证；重复申请；**验证 `total_applied` 每次 apply 递增** | T19a | 3h | **P0** | 申请 + 提交 6 个场景全绿；`AlreadyApplied`、`InvalidRuntimeEnv` 错误码正确触发；total_applied 计数正确 |
| **T19c** | **集成测试 — judge_and_pay + cancel + refund** | **【W1 阻塞项 - P0】** `judge_and_pay`（SOL + SPL，正常赢家；tie-break by slot；score < MIN_SCORE 退款）；`cancel_task`（**无申请 + 有申请两路径，验证 remaining_accounts 质押退回**）；`refund_expired`；`HasSubmissions` 错误验证 | T19b | 3h | **P0** | 分账精度逐 lamport 验证；3 条退款路径全绿；cancel 有申请时 remaining_accounts 质押退回正确；信誉 global + category 更新验证 |
| **T19d** | **集成测试 — force_refund/slash + 安全测试** | **【W1 阻塞项 - P0】** `force_refund`（slash 充足 / slash 不足两路径）；JudgePoolFull（200 人）；重入攻击模拟；CU 消耗验证（`post_task` ≤ 200k、`judge_and_pay` ≤ 200k） | T19c | 3h | **P0** | 15 个边界用例全绿；分支覆盖率 ≥ 95%；0 Critical 漏洞；CU 未超限 |

---

### 🟠 W2（2026-04-15 ~ 04-21）— 工具链（依赖 T19d 通过）

> **W2 关键目标**：Indexer + SDK + CLI + Judge Daemon + 前端全部可用
> **前置条件**：T19a-d 全部通过

| # | 任务名称 | 描述 | 依赖 | 时间 | 优先级 | Done 定义 |
|---|---------|------|------|------|--------|----------|
| T21 | Indexer — PostgreSQL Schema | 4 张表（tasks / submissions / reputations / reputation_by_category）+ 5 个索引；migration 文件 | T19d | 2h | P0 | `psql` 运行 migration 无报错；schema 与规格完全一致 |
| T22 | Indexer — 事件流接入 + 事件解析 | **双模式事件源**：① **Triton Dragon's Mouth gRPC**（默认，Fumarole 可靠流，HA + 断线重连）；② **Helius Webhooks HTTP**（fallback，Managed CF Workers 模式备选）；解析 **8 个 Program 事件**（TaskCreated, TaskApplied, SubmissionReceived, TaskJudged, TaskCancelled, TaskRefunded, JudgeRegistered, JudgeUnstaked）；upsert 到 DB；**内置 mock 模式**（`MOCK_EVENT=true` 时用本地文件模拟推送，无需真实 RPC 连接） | T21 | 3h | P0 | Mock 模式：8 类事件 JSON → DB 行正确创建；真实模式：延迟 < 200ms；Triton 断连时自动切换 Helius fallback |
| T23 | Indexer — REST API 端点 | `GET /api/tasks?state=&category=&page=`；`GET /api/tasks/:id`；`GET /api/tasks/:id/submissions?sort=score`；`GET /api/reputation/:agent`；`GET /api/judge-pool/:category` | T22 | 3h | P0 | curl 每个端点 → 正确 JSON；分页正确；无效参数 → 4xx；未找到 → 404 |
| T23a | Indexer — Me 数据聚合 API | **【新增 - AgentM 依赖】** `GET /me`（当前用户声誉统计）；`GET /me/tasks`（我发布的任务）；`GET /me/submissions`（我的提交历史）；分页、排序、错误码一致 | T23 | 2h | P0 | API 返回结构稳定；分页/筛选正确；无登录返回 401 |
| T24 | Indexer — WebSocket 服务器 | WS 连接 ws://indexer/ws；事件广播：TaskCreated / SubmissionReceived / TaskJudged；客户端可 filter by task_id | T22 | 2h | P1 | WS 客户端订阅 → 收到 DB upsert 触发的事件；连接断开自动清理；重连不丢事件 |
| T25 | Indexer — Cloudflare Workers + D1 适配层 | CF Workers wrapper；D1 SQLite schema（与 PG schema 对齐）；`wrangler deploy` 到 CF；REST API 路径与 Self-hosted 完全一致 | T23 | 3h | P1 | Managed 模式 CF 部署成功；相同 curl 命令返回相同格式 |
| T25a | Indexer — Docker 镜像 + compose 文件 | `Dockerfile`（Self-hosted Rust 二进制）；`docker-compose.yml`（Indexer + PostgreSQL）；`README.md` 一键启动说明 | T23 | 2h | P1 | `docker compose up` → 服务启动；`curl localhost:3001/api/tasks` → 正确响应；镜像大小 < 100MB |
| T26 | SDK — Codama IDL 生成 + TypeScript 客户端 | `@gradience/sdk` 包初始化；在 Rust 账户/指令结构体上添加 `#[derive(CodamaAccount)]` / `#[derive(CodamaInstruction)]` 注解；运行 `cargo codama --output sdk/src/generated` 生成 IDL JSON 和 TypeScript 客户端代码；`GradienceSDK` class 包装生成代码；`SDK_README.md` 快速开始文档 | T19d | 2h | P0 | `cargo codama` 运行成功，生成 IDL JSON + 9 个账户 TS 类型 + 11 个指令 builder；`import { GradienceSDK } from '@gradience/sdk'` 编译通过；README 3 行代码示例可运行 |
| T27 | SDK — task.post / apply / submit | 三个核心方法；SOL + SPL 双路径；wallet adapter 调用 sign/sendTx | T26 | 3h | P0 | 单元测试（mock Program）：3 方法返回 tx signature；devnet 端测通过 |
| T28 | SDK — task.judge / cancel / refund / forceRefund | 4 个方法包装剩余指令；`remaining_accounts` 自动组装落败者 Application PDA 列表；**ALT 自动处理**：`pnpm add @solana-program/address-lookup-table`，当 remaining_accounts > 20 时自动查找/创建 ALT（seeds: [task_id]），批量扩展地址，构建 v0 VersionedTransaction（每地址节省 31 字节，保障大参与者数任务的交易不超 1232 字节限制）；≤ 20 时走普通 Legacy Transaction | T27 | 2h | P0 | 单元测试通过；devnet 端到端可用；权限错误（`NotTaskJudge` / `NotTaskPoster` / `NotUpgradeAuthority` 等）时抛出含 Gradience 错误码的异常；**额外验证**：mock 50 个落败者时 `task.judge()` 使用 v0 tx 且成功上链；10 个落败者时使用 Legacy tx |
| T29 | SDK — reputation / JudgePool 查询 | `reputation.get(agent)`（读链上 PDA）；`judgePool.list(category)`；`task.submissions(taskId, {sort})`（查 Indexer） | T26 | 2h | P1 | 查询返回带类型的响应；未找到时返回 null 而非抛出；JSDoc 注释完整 |
| T30 | SDK — 钱包适配器（5 种） | `WalletAdapter` 接口（sign/sendTx）；`KeypairAdapter`（开发测试用）**完整实现**；`OpenWalletAdapter` / `OKXAdapter` / `PrivyAdapter` / `KiteAdapter` **接口存根（interface only）**，完整实现留 W3+；存根实现 `sign()` 时抛出 `NotImplemented` | T26 | 3h | P1 | KeypairAdapter devnet 端测通过；4 个存根接口通过 TypeScript 类型检查；调用存根 `sign()` → 清晰的 `NotImplemented` 错误提示 |
| T31 | CLI — 脚手架 + config 命令 | `gradience` binary（Bun）；`config set rpc <url>`；`config set keypair <path>`；`--help` 所有子命令；CLI 帮助文本内联文档；**`NO_DNA` 支持**（`no-dna.org` 标准）：顶层检测 `!!process.env.NO_DNA`，为真时全局切换 Agent 模式（JSON 输出、无交互提示、绝对时间戳、stderr 机器可解析错误）；与 Anchor / Surfpool 等工具链统一约定 | T26 | 1h | P0 | `gradience --help` 显示所有子命令和说明；config 写入 `~/.gradience/config.json`；无效参数 → 清晰错误提示；**`NO_DNA=1 gradience config set rpc http://...`** → 无提示直接写入，stdout 输出 `{"ok":true}`；`NO_DNA=1 gradience --help` → 输出 JSON schema |
| T32 | CLI — task post / apply / submit / status | `gradience task post --eval-ref <cid> --reward <lamports> ...`；`apply`；`submit`；`status <task_id>`；**`NO_DNA` 模式**：所有命令输出 `{"signature":"...","taskId":N}` 等结构化 JSON，`status` 返回 `{"taskId":N,"state":"Open","submissionCount":N}` | T31, T28 | 3h | P0 | 每条命令在 devnet 创建正确的链上交易；`status` 显示当前状态和提交数；`NO_DNA=1 gradience task status 1` → 纯 JSON 无装饰输出 |
| T33 | CLI — task judge / cancel / refund + judge register | `gradience task judge`；`cancel`；`refund`；`gradience judge register --category defi`；`gradience judge unstake`；**`NO_DNA` 模式**：judge 命令输出 `{"signature":"...","winner":"...","score":N}` | T32 | 2h | P0 | 命令在 devnet 正确执行；judge register 后 JudgePool 有记录；help 文本覆盖所有参数；`NO_DNA=1` 时 judge 命令不等待用户确认直接执行 |
| T34 | Judge Daemon — Absurd 工作流 + Dragon's Mouth 监听 | Absurd（PostgreSQL 持久化 workflow engine）初始化；**Triton Dragon's Mouth gRPC 连接**（主，Fumarole 可靠流；fallback: Helius LaserStream → polling 5s）；监听 TaskCreated / SubmissionReceived → 触发 evaluate workflow；崩溃可续；MCP 集成参考：`gh:solana-foundation/templates/community/solana-chatgpt-kit`（AI Agent + x402 + MCP 调用模式） | T22 | 3h | P1 | Daemon 启动；mock TaskCreated → workflow 触发，延迟 < 200ms；Triton 断连时自动降级为 Helius LaserStream → polling |
| T35a | Judge Daemon — Type A（人工存根）+ DSPy Python 微服务 | **Type A**：等待 CLI 手动打分输入（存根模式）；**DSPy 微服务**：Python 进程，`dspy.configure(lm=...)` + `LLMScoreEvaluator` 实例，HTTP `/evaluate` 端点；接受 `{task_desc, criteria, result, trace}` → 返回 `{score, reasoning, dimension_scores, confidence}` | T34 | 2h | P1 | DSPy 微服务启动；`POST /evaluate` 返回正确 JSON；Type A 存根可手动输入打分 |
| T35b | Judge Daemon — Type B（DSPy LLMScoreEvaluator）TS 集成 + E2E | ① 下载 `result_ref` + `trace_ref` + `evaluationCID`；② HTTP RPC 调用 T35a 微服务；③ `confidence < 0.7` 时降级 Type A（人工复核）；④ 指数退避重试（Rate Limit）；⑤ 调用 SDK `task.judge()` 上链，`reasonRef` = 评判结果 CID（上传 Arweave）；x402 外部 API 调用参考：`gh:solana-foundation/templates/community/kit-node-solanax402` | T35a | 3h | P1 | Type B E2E：测试任务经 DSPy 自动评判并上链；dimension_scores 包含所有维度；confidence < 0.7 时正确触发人工复核；judge_and_pay 被触发；Rate Limit 时排队重试而非丢失 |
| T36 | Judge Daemon — Type C-1（test_cases oracle） | IJudge wasm_exec：下载 evaluationCID 内 WASM 字节码，沙箱执行（wasm32-wasi deterministic subset），解析分数，调用 `task.judge()` | T35 | 3h | P1 | 示例 WASM 模块被正确沙箱执行并给分；浮点运算禁用验证通过 |
| T37 | 前端 — 任务列表 + 发任务表单 | 以 `gh:solana-foundation/templates/kit/nextjs` 初始化（Next.js + Tailwind + @solana/kit，与 Codama 生成客户端天然匹配）；任务列表（调 Indexer REST API）；发任务表单（钱包连接 + SDK `task.post()`） | T23, T28 | 4h | P0 | `localhost:3000` 显示任务列表；表单提交在 devnet 创建任务；无钱包时提示连接 |
| T38 | 前端 — 任务详情 + 提交列表 + 评判 | 任务详情页（状态、deadline、Judge 地址）；提交列表（按 score 排序）；Judge 触发按钮（仅 Task.judge == 当前钱包） | T37 | 4h | P0 | 完整生命周期（发→申请→提交→评判）可在浏览器操作；非 Judge 不显示评判按钮 |
| T37a | 前端 — Kora Gasless 集成 | 集成 `@solana/kora`（`pnpm add @solana/kora`）；用 `createKitKoraClient` 替换默认 fee payer，**使用 Kora paymaster 让用户用 USDC 支付 Gas，无需持有 SOL**；本地开发用 `docker run` 启动 Kora 节点（`cargo install kora-cli`）；生产环境配置公共 Kora 端点；为 Poster 发任务、Agent 申请/提交两个核心流程启用 gasless；Fee token 默认 USDC（`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`） | T37 | 2h | P2 | 本地 Kora 节点启动；发任务流程钱包无 SOL 时仍可成功提交（用 USDC 付 Gas）；Kora 端点不可用时自动降级为标准 fee payer（不影响核心功能） |

---

### 🟡 W3（2026-04-22 ~ 04-26）— 生态扩展（AgentM 为核心）

> **W3 关键目标**：AgentM MVP 可用 + Chain Hub 基础 + GRAD Token
> **AgentM 为产品层唯一入口，优先级最高**

| # | 任务名称 | 描述 | 依赖 | 时间 | 优先级 | Done 定义 |
|---|---------|------|------|------|--------|----------|
| T39 | Chain Hub MVP | Delegation Task **Pinocchio** program 骨架（与 Agent Layer 主程序技术栈一致，no_std，无 Anchor）；Skill 市场注册表；与 Agent Layer JudgePool 集成（选人 → 授权）；**代码参考**：`gh:solana-program/multi-delegator`（官方 Pinocchio + Codama + LiteSVM 实现，固定授权 / 循环授权 / 订阅计划三种委托模型，与 Delegation Task 场景直接对齐，参考其 PDA 设计、指令结构、版本迁移框架 ADR-003） | T19d | 4h | P1 | Chain Hub program 可初始化；delegation_task 指令可调用（不含完整执行逻辑）；PDA 设计参照 multi-delegator ADR-001 |
| T40a | AgentM — Electrobun 脚手架 + 项目结构 | **【AgentM 子任务 1/4】** Electrobun 桌面应用初始化；React + Vite + Tailwind 配置；Zustand 状态管理；与现有 Agent Arena 前端共享组件 | T38 | 2h | P0 | `bun run dev` 启动桌面应用；窗口大小 1200x800；热重载正常 |
| T40b | AgentM — Privy 登录集成 | **【AgentM 子任务 2/4】** Google OAuth 登录；Privy SDK 集成；嵌入式钱包自动生成 Solana 地址；会话持久化；登录状态管理 | T40a | 3h | P0 | Google OAuth 登录成功；`publicKey` 非空且有效；刷新后保持登录状态 |
| T40c | AgentM — "我的"视角（Me View） | **【AgentM 子任务 3/4】** 声誉面板（调 Indexer `/me` API）；任务历史列表；Agent 管理（查看/编辑）；钱包余额展示 | T40b, T23a | 3h | P0 | 声誉 4 指标正确显示；任务历史分页正常；钱包余额实时更新 |
| T40d | AgentM — "社交"视角 + A2A 消息 | **【AgentM 子任务 4/4】** Agent 发现广场（按声誉排名，调 Indexer）；Agent 详情页；A2A 消息列表 UI；发送/接收 A2A Envelope | T40c | 4h | P0 | Agent 列表按 `avg_score × win_rate` 排序；A2A 消息收发 < 500ms；消息持久化到本地存储 |
| T42 | GRAD Token + 链上治理 | SPL Token 发行（GRAD），Squads v4 多签 DAO 设置（3/5），转移 upgrade_authority 给多签 | T19d | 4h | P1 | GRAD mint 创建；upgrade_authority = Squads PDA；多签测试可执行 `upgrade_config` |

---

### 🔵 W4（2026-04-27 ~ 04-30）— 全链扩展（Stretch Goals）

> ⚠️ **W4 为 Stretch Goals**：不影响 W1-W3 验收。优先级 T43 > T44 > T45。
> Solidity 语义差异常导致低估工时，T43 若超时则 T44/T45 自动顺延至 5 月。

| # | 任务名称 | 描述 | 依赖 | 时间 | 优先级 | Done 定义 |
|---|---------|------|------|------|--------|----------|
| T43 | EVM Agent Layer Solidity 合约 | 将核心 Race Task 逻辑移植到 Solidity ^0.8.20；post_task / apply / submit / judge_and_pay；部署到 Base Sepolia | T19d | 4h | P1 | `npx hardhat test` 通过；合约部署到 Base Sepolia testnet；核心 4 条指令可调用 |
| T44 | 跨链信誉证明（签名 + 验证） | Squads upgrade_authority 离线签名 Agent 信誉（agent_pubkey, score, chain=solana）；`ReputationVerifier` EVM 合约验证 ed25519 签名 | T42, T43 | 4h | P1 | E2E：Solana 信誉 → 多签签名 → EVM `verifyReputation()` 返回 true |
| T45 | A2A 协议 MVP（MagicBlock） | AgentM 底层 MagicBlock 实时通道；Agent 发现广播；微支付通道 stub | T40d | 4h | P2 | 两个 Agent 进程通过 MagicBlock 互发消息；延迟 < 500ms |

---

### 🟣 W5（2026-05-01 ~ 05-03）— 全链路联调与发布前验证

> **W5 目标**：在本地 Surfpool + devnet 完成"异常分支 / 压测 / 事件闭环"三类发布前联调，补齐 W1-W4 的系统性验证。

| # | 任务名称 | 描述 | 依赖 | 时间 | 优先级 | Done 定义 |
|---|---------|------|------|------|--------|----------|
| T46 | 超时与异常分支全链路（SOL/SPL/Token-2022） | 覆盖 `cancel_task` / `refund_expired` / `force_refund` / `judge_and_pay(score<MIN_SCORE)`；分别执行 SOL、SPL、Token-2022 路径；校验状态迁移、错误码、事件 payload、资金分账（含 95/3/2 与低分退款）；输出可复现脚本 | T19d, T33, T38 | 4h | P0 | 4 条异常路径 × 3 资产路径全部绿；余额断言精确到最小单位；错误码与事件字段与规格一致；形成 `scripts/` 可重放脚本 |
| T47 | Pool 模式压力联调 + ALT 路径验证 | 构造 20/50/100+ 申请者；验证 Pool 随机评审、落败者 stake 批量退回、`remaining_accounts > 20` 的 ALT 自动切换与 v0 交易成功率；记录 CU、交易大小、失败重试策略 | T46, T28 | 4h | P1 | 50+ 申请者场景稳定完成；ALT 与 Legacy 路径切换符合阈值；关键交易 CU 与 size 有基线报告；无未解释失败 |
| T48 | 事件闭环联调（Program → Indexer → WS → Judge Daemon） | 验证链上事件入库时序、WS 广播、Judge Daemon 消费与自动裁决链路；覆盖重连、幂等去重、回放恢复（断点后补偿）；对比 Triton 主路与 fallback 行为 | T47, T24, T35b | 4h | P1 | 从 `TaskCreated` 到 `TaskJudged` 的端到端时序可观测；断连恢复后无重复裁决；DB/WS/Daemon 状态一致；形成发布前 checklist |

---

### 🔶 后续任务（W5 之后）— 生产实施与扩展

> **非当前 milestone，但需记录以防遗漏。**

| # | 任务名称 | 描述 | 依赖 | 时间 | 优先级 | Done 定义 |
|---|---------|------|------|------|--------|----------|
| T49 | 8004 Agent 注册集成 | Agent 在 Gradience 首次参与时，自动通过 Metaplex Agent Registry（Solana 侧 8004 实现，Program `8oo4...`）注册身份；生成符合 ERC-8004 `#registration-v1` 格式的 JSON（含 `agentRegistry: "solana:101:metaplex"`、`services: ["a2a"]`、`supportedTrust: ["reputation", "crypto-economic"]`）；注册后 Agent 可在 8004scan.io 被全球发现 | T18a, T40d | 3h | P1 | Agent 注册后在 8004scan.io/networks/solana 可搜索到；registration JSON 格式通过 8004 schema 验证 |
| T50 | 8004 Reputation Feedback 集成 | `judge_and_pay` 完成后，Judge Daemon 自动向 8004 Reputation Registry 提交 feedback（score, taskId, category）；Solana 侧通过 Metaplex 机制提交，EVM 侧通过 `0x8004BA...` 合约提交；确保 Gradience 声誉数据在 8004scan.io 上实时更新 | T49, T35b | 4h | P1 | 任务评判后 8004scan.io 上对应 Agent 的 feedback 数量 +1；分数与链上 Reputation PDA 一致 |
| T51 | SAS Attestation 自动颁发 | `judge_and_pay` 确认后，Judge Daemon 通过 `sas-lib` 颁发 `TaskCompletion` Attestation（技术规格 §3.12）；包含 taskId、score、category、winner；SDK 新增 `getAgentAttestations(address)` 查询方法；Attestation 可在钱包/8004scan 中展示为"能力凭证" | T18a, T49 | 3h | P1 | devnet 上 `fetchAllAttestation` 返回正确凭证；`decodeTaskCompletionAttestation` 解码验证通过 |
| T52 | AgentM 生产化 | Electrobun 打包（macOS/Windows/Linux）；自动更新；崩溃报告；性能监控 | T40d | 1w | P1 | 桌面包可在三平台安装运行；自动更新机制可用；崩溃日志可收集 |
| T53 | Stage A1 — 启动栈与端口统一 | 统一 AgentM 与 Indexer 的默认端口/基址配置（AgentM 默认指向 Indexer `:3001`）；更新 `start-dev-stack.sh`（移除 agent-me/agent-social 窗口，改为 agent-im）；确保 `judge-daemon/indexer/agent-im` 一键拉起 | T52 | 2h | P0 | 单命令启动后 AgentM 可读取真实 Indexer 数据；脚本窗口仅包含 indexer/judge-daemon/agent-arena/agent-im（+可选 evm）；无端口冲突 |
| T54 | Stage A2 — Privy 真实认证接入 | 将 AgentM 从 MockAuth 切到真实 Privy（Google OAuth + 嵌入式钱包）；加入依赖、环境变量检查与错误回退；保持未配置时可切回 demo 模式 | T53 | 4h | P0 | 登录后 `publicKey` 非 `DEMO_*`；Google OAuth 完整成功；未配置 App ID 时 UI 给出清晰提示且不崩溃 |
| T55 | Stage A3 — Demo 闭环脚本固化 | 固化"登录→发现→任务数据→互通状态"演示脚本与环境变量模板；输出可重复的命令序列和验收输出 | T54 | 2h | P0 | 10 分钟内可重复演示成功；脚本化命令执行无人工修补 |
| T56 | Stage B1 — Program P0 边界测试补全 | 补齐 `apps/agent-arena/docs/05-test-spec.md` 标记缺口：重复初始化、reward=0、重复 apply、score<MIN_SCORE 退款路径、unstake 冷却期；补 Token-2022 路径（P1） | T55, T19d | 6h | P0 | P0 缺口测试全部通过并纳入 CI 命令；新增测试在本地与 devnet 复现一致 |
| T57 | Stage B2 — W5 稳定性验收（T46~T48） | 执行异常全路径联调、Pool 压测+ALT 切换、Program→Indexer→WS→Judge Daemon 事件闭环；包含断线恢复、幂等去重、回放一致性 | T56, T46, T47, T48 | 8h | P0 | 形成可重放脚本+指标基线（成功率/延迟/CU/tx size）；断连恢复后无重复裁决或状态漂移 |
| T58 | Stage B3 — ERC-8004 生产闭环 | 固化身份注册触发点（首参与自动注册）；扩展反馈到 winner/loser/judge/poster 角色并可追踪；完成 8004 relay 状态审计与 8004scan 对账 | T57, T49, T50 | 6h | P0 | 8004scan 可查身份与 feedback 增量；反馈计数与链上事件一致；失败重试与告警可观测 |
| T59 | Stage B4 — SAS Attestation 真上链 | 将当前 HTTP sink 形态切换为 `sas-lib` 真实颁发流程；完成 Credential/Schema 使用、`TaskCompletion` 数据编码、SDK 查询/解码闭环 | T58, T51 | 6h | P1 | devnet 上可查询到真实 `TaskCompletion` attestation；字段与任务数据一致；重复颁发具备幂等保护 |
| T60 | Stage B5/B6 — AgentM 生产化与发布门槛 | AgentM 接入 Metaplex 注册流程（登录后身份闭环）；完成打包指标、持久化恢复、CI+运维脚本+发布清单（env matrix/回滚） | T59 | 8h | P1 | AgentM PRD 六项成功标准全部达标；发布清单可在新环境 30 分钟内完成拉起并通过 smoke |

---

## 4.4 任务依赖图（更新版）

```mermaid
flowchart TB
    subgraph W1["🔴 W1: Program + 集成测试（阻塞项）"]
        direction TB
        T01 --> T02 --> T03 --> T04 --> T05 --> T06
        T06 --> T07
        T06 --> T08a
        T07 --> T08
        T08a --> T08
        T08a --> T09
        T07 --> T09
        T08 --> T09 --> T10 --> T11 --> T12
        T07 --> T13
        T08a --> T13
        T09 --> T13
        T07 --> T14
        T08a --> T14
        T06 --> T16 --> T07
        T08a --> T15
        T07 --> T15
        T16 --> T15
        T06 --> T17
        T05 --> T18
        T12 & T13 & T14 & T15 & T16 & T17 & T18 & T08 --> T19a --> T19b --> T19c --> T19d
    end

    subgraph W2["🟠 W2: 工具链（依赖 T19d）"]
        direction TB
        T19d --> T21 --> T22 --> T23 --> T23a --> T24
        T23 --> T25
        T23 --> T25a
        T19d --> T26 --> T27 --> T28 --> T29
        T26 --> T30
        T26 --> T31 --> T32 --> T33
        T22 --> T34 --> T35a --> T35b --> T36
        T23 --> T37 --> T38
        T37 --> T37a
    end

    subgraph W3["🟡 W3: 生态扩展（AgentM 为核心）"]
        direction TB
        T19d --> T39
        T38 --> T40a --> T40b --> T40c --> T40d
        T23a --> T40c
        T19d --> T42
    end

    subgraph W4["🔵 W4: 全链扩展（Stretch）"]
        direction TB
        T42 --> T43 --> T44
        T40d --> T45
    end

    subgraph W5["🟣 W5: 联调与验收"]
        direction TB
        T19d --> T46 --> T47 --> T48
        T28 --> T47
        T24 --> T48
        T35b --> T48
        T38 --> T46
        T33 --> T46
    end

    T19d -.->|"阻塞"| W2
    T38 -.->|"依赖"| W3
    T40d -.->|"依赖"| W4
```

---

## 4.5 里程碑划分（更新版）

### Milestone 1：协议内核可用（2026-04-14）
**交付物**：Solana Program 全量部署到 devnet；T19a-d 集成测试全部通过

**包含任务**：T01 ~ T19d

**验收条件**：
- [ ] `cargo test-sbf` + litesvm 全绿（含边界条件）
- [ ] **T19a-d 集成测试全部通过（阻塞项）**
- [ ] `solana program deploy target/deploy/agent_layer.so --url devnet` 成功
- [ ] 手动调用 `post_task → apply → submit → judge_and_pay` 全流程链上验证
- [ ] Slash、force_refund、Pool 随机、Token-2022 拒绝均测试通过

**失败处理**：若 T19a-d 未通过，W2 顺延，直至集成测试通过

---

### Milestone 2：开发者工具链可用（2026-04-21）
**交付物**：SDK + CLI + Indexer + Judge Daemon + 前端产品 MVP，所有工具联通 devnet

**包含任务**：T21 ~ T38

**验收条件**：
- [ ] `npm install @gradience/sdk` → 3 行代码发任务成功
- [ ] `gradience task post ...` 在 devnet 创建任务
- [ ] Indexer `/me` API 返回正确用户数据
- [ ] Judge Daemon Type B（Claude API）自动评判一个测试任务并上链
- [ ] 前端可完整操作任务生命周期

---

### Milestone 3：AgentM MVP + 生态模块（2026-04-26）
**交付物**：AgentM 桌面应用可用 + Chain Hub 基础 + GRAD Token

**包含任务**：T39 ~ T42, T40a-d

**验收条件**：
- [ ] AgentM Google OAuth 登录成功
- [ ] "我的"视角：声誉面板、任务历史正确显示
- [ ] "社交"视角：Agent 发现广场按声誉排序、A2A 消息收发 < 500ms
- [ ] GRAD mint 创建，upgrade_authority 转交 Squads v4（3/5 多签）
- [ ] Chain Hub delegation_task 指令可调用

---

### Milestone 4：全链扩展（2026-04-30，best effort）
**交付物**：EVM 合约 + 跨链信誉 + A2A 通道 MVP

**包含任务**：T43 ~ T45

**验收条件**：
- [ ] EVM 合约部署到 Base Sepolia，核心指令通过
- [ ] Solana 信誉证明在 EVM 可验证
- [ ] MagicBlock 两 Agent 互通消息

---

### Milestone 5：发布前全链路验证（2026-05-03）
**交付物**：异常分支联调报告 + 压测基线 + 事件闭环验收清单

**包含任务**：T46 ~ T48

**验收条件**：
- [ ] 超时与异常分支（cancel/refund/force_refund/low-score）在 SOL/SPL/Token-2022 全覆盖
- [ ] Pool 压测在大参与者场景稳定运行，ALT 自动切换可验证
- [ ] Program/Indexer/WS/Judge Daemon 端到端链路在断连恢复后保持一致性

---

## 4.6 Sprint 执行建议

基于更新后的优先级，建议按以下 Sprint 执行：

### Sprint 1（W1 第 1 周）：Program 核心
- T01 ~ T10（脚手架到 submit_result）
- 目标：核心指令代码完成

### Sprint 2（W1 第 2 周）：Program 完结 + 集成测试
- T11 ~ T19d（judge_and_pay 到集成测试完结）
- **目标：T19a-d 全部通过（W1 阻塞项）**

### Sprint 3（W2 第 1 周）：Indexer + SDK
- T21 ~ T30（Indexer 全量 + SDK 核心）
- 目标：数据层和 SDK 可用

### Sprint 4（W2 第 2 周）：CLI + Judge Daemon + 前端
- T31 ~ T38（CLI 到前端完结）
- 目标：工具链全量可用

### Sprint 5（W3）：AgentM MVP
- T40a ~ T40d（AgentM 细分子任务）
- **目标：产品层唯一入口可用**

### Sprint 6（W3 尾 + W4）：生态扩展 + Stretch Goals
- T39, T42 ~ T45（Chain Hub + GRAD + EVM/跨链/A2A）
- 目标：生态完整

---

## 4.7 风险识别（更新版）

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| **T19a-d 集成测试未通过（W1 阻塞项）** | 中 | **极高** | 预留 W1 第 2 周专门用于调试；若超时，W2 顺延；优先保障核心路径（SOL Designated 模式） |
| `remaining_accounts` 质押退回在 CU 预算超限 | 中 | 高 | T13/T14 阶段测试 20+ 申请者场景的 CU 消耗；超限时拆分为多笔 tx |
| `judge_and_pay` 整数精度 bug | 高 | 高 | T11/T12 专项精度测试（验证每笔转账余额精确到 lamport） |
| **AgentM Privy 登录集成复杂度** | 中 | 高 | T40b 单独拆分；预留缓冲时间；准备 MockAuth fallback |
| Triton Dragon's Mouth 不可用 | 低 | 中 | T34 三级 fallback：Triton → Helius LaserStream → polling |
| DSPy 评分置信度偏低 | 中 | 中 | T35 阶段收集样本，用 MIPROv2 优化 prompt |
| W4 Stretch Goals 超时 | 高 | 低 | W4 标记为 best effort；T43→T44 优先，T45 可延后 |

---

## ✅ Phase 4 验收标准（更新版）

- [x] 每个任务 ≤ 4 小时
- [x] 每个任务有 Done 定义
- [x] 依赖关系已标明，无循环依赖
- [x] **关键路径清晰：T19a-d 为 W1 唯一阻塞项**
- [x] **AgentM 任务细化（T40a-d），产品层优先级明确**
- [x] 划分为 5 个里程碑，每个均有可演示交付物
- [x] 风险已识别（7 项，含 W1 阻塞项专项风险）

**验收通过后，进入 Phase 5: Test Spec →**
