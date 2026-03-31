# Phase 3: Technical Spec — agent-arena/program

> **范围**: 本文档是 `agent-arena/program` 模块的技术规格，聚焦于模块边界、文件职责、构建接口、部署细节。
> **数据结构与指令逻辑**: 见项目级 `docs/03-technical-spec.md`（该文档为权威来源，本文不重复）。
> **输入**: `docs/02-architecture.md` § Agent Arena, `docs/03-technical-spec.md`

---

## 1. 模块职责

`agent-arena/program` 是整个协议的**链上内核**，承担：

- 托管任务奖励（Escrow）
- 管理 Agent 申请、提交、Judge 评判的状态机
- 执行费用分配（95/3/2 BPS 拆分）
- 维护 Judge 质押与声誉
- 发出链上事件（CPI Event Emission）供 Indexer 消费

**不做**：
- 链外数据存储（交给 Indexer）
- 任务内容评判（交给 Judge Daemon）
- 跨链逻辑（交给 agent-layer-evm）

---

## 2. 技术栈与工具链

| 项目 | 版本 | 说明 |
|------|------|------|
| Rust toolchain | `1.92` (见 `rust-toolchain.toml`) | 固定版本，确保可重现构建 |
| Pinocchio | `0.10.1` | no_std Solana 程序框架，替代 Anchor |
| Borsh | workspace | 序列化格式 |
| Codama | workspace | 从 Rust 代码生成 IDL + TypeScript/Rust 客户端 |
| cargo-build-sbf | Solana CLI 附带 | 编译为 SBF 字节码 |

---

## 3. 文件结构与职责

```
program/src/
├── lib.rs               — crate 入口，declare_id!，re-export 模块
├── entrypoint.rs        — 接收 instruction_data，按 discriminator 分发到各 processor
├── constants.rs         — 所有硬编码常量（不可通过 upgrade 修改的）
├── errors.rs            — 42 个错误码（6000–6041），含 #[cfg(test)] 单元测试
├── state/
│   ├── mod.rs           — re-export
│   ├── agent_layer.rs   — 所有链上账户结构体（Task, Escrow, Application, Submission, ...）
│   └── counter.rs       — 简单计数器（开发测试用，可忽略）
├── instructions/        — 每条指令一个子目录
│   ├── <ix_name>/
│   │   ├── accounts.rs  — 账户列表定义（Pinocchio AccountView 解析）
│   │   ├── data.rs      — 指令参数反序列化（Borsh）
│   │   ├── instruction.rs — Codama IDL 注解（生成 IDL 用）
│   │   ├── processor.rs — 核心业务逻辑
│   │   └── mod.rs       — re-export process_<ix_name>
│   └── mod.rs           — re-export 所有 process_* 函数
├── events/              — 8 种链上事件定义 + CPI emit 工具
├── judge/               — IJudge trait 定义 + 3 种 Judge 实现（stub）
├── traits/              — GradienceInstructionDiscriminators 等共享 trait
└── utils/               — fee 计算、token 转账工具、Token-2022 扩展过滤
```

---

## 4. 指令列表（discriminator → processor）

| Discriminator | 指令名 | Processor |
|:---:|---|---|
| 0 | `initialize` | `process_initialize` |
| 1 | `post_task` | `process_post_task` |
| 2 | `apply_for_task` | `process_apply_for_task` |
| 3 | `submit_result` | `process_submit_result` |
| 4 | `judge_and_pay` | `process_judge_and_pay` |
| 5 | `cancel_task` | `process_cancel_task` |
| 6 | `refund_expired` | `process_refund_expired` |
| 7 | `force_refund` | `process_force_refund` |
| 8 | `register_judge` | `process_register_judge` |
| 9 | `unstake_judge` | `process_unstake_judge` |
| 10 | `upgrade_config` | `process_upgrade_config` |
| 11 | `emit_event` | `process_emit_event` |

`discriminator` = `instruction_data[0]`，由 `entrypoint.rs` 分发。

---

## 5. PDA 种子规范

| 账户 | 种子 | 说明 |
|------|------|------|
| `ProgramConfig` | `[b"config"]` | 全局配置，唯一 |
| `Task` | `[b"task", task_id.to_le_bytes()]` | task_id = u64，小端序 |
| `Escrow` | `[b"escrow", task_id.to_le_bytes()]` | 与 Task 一一对应 |
| `Application` | `[b"application", task_id.to_le_bytes(), agent.as_ref()]` | 每个 agent 对每个 task 一份 |
| `Submission` | `[b"submission", task_id.to_le_bytes(), agent.as_ref()]` | 与 Application 一一对应；`RuntimeEnv` 是 Submission 的内嵌字段，非独立 PDA |
| `Reputation` | `[b"reputation", agent.as_ref()]` | 每个 agent 全局唯一 |
| `Stake` | `[b"stake", judge.as_ref()]` | 每个 judge 全局唯一 |
| `JudgePool` | `[b"judge_pool", category.to_le_bytes()]` | 每个 category 一个池 |

---

## 6. 构建与部署

### 6.1 本地构建

```bash
# 在 apps/agent-arena/ 目录执行
just build
# 等价于：
# 1. pnpm run generate-idl  （Codama 生成 IDL）
# 2. pnpm run generate-clients（生成 TS/Rust 客户端）
# 3. cd program && cargo-build-sbf
```

构建产物：
- `program/target/sbf-solana-solana/release/gradience.so` — 部署字节码
- `idl/pinocchio_counter.json` — Codama 生成的 IDL（供 SDK 使用）

### 6.2 Program ID 同步

```bash
just sync-program-id <PROGRAM_ID>
# 同步更新：program/src/lib.rs 的 declare_id! 和 TypeScript 客户端常量
```

### 6.3 部署（Devnet）

```bash
solana program deploy \
  --program-id <KEYPAIR_PATH> \
  program/target/sbf-solana-solana/release/gradience.so
```

### 6.4 Upgrade Authority

- Upgrade authority 由 `ProgramConfig.authority` 管理
- `upgrade_config` 指令可更新 `min_judge_stake`（唯一可变参数）
- 其余 15 个常量在 `constants.rs` 中硬编码，程序升级也不能修改其语义

---

## 7. 接口契约（与其他模块的边界）

### → TypeScript SDK (`clients/typescript`)
- SDK 通过 Codama 自动生成，与 IDL 100% 对齐
- IDL 变更 → 必须重新执行 `just generate-clients`
- SDK 调用路径：`GradienceClient` → RPC → Program

### → Indexer (`indexer/`)
- Program 通过 `emit_event`（CPI）发出事件，事件以 base64 编码写入 transaction log
- Indexer 监听 Triton Dragon's Mouth gRPC（主）/ Helius Webhook（备）解析事件
- 事件结构定义在 `events/` 目录，Indexer 的 `events.rs` 必须与之保持同步

### → Judge Daemon (`judge-daemon/`)
- Judge Daemon 轮询 Indexer REST API 获取待评判任务
- 评判完成后调用 `judge_and_pay` 指令（通过 TypeScript SDK）
- Program 不知道 Judge Daemon 的存在，接口是单向的

### → CLI (`cli/`)
- CLI 调用 TypeScript SDK，间接调用 Program
- CLI 是最终用户交互界面，不与 Program 直接通信

---

## 8. 已知约束与限制

| 约束 | 说明 |
|------|------|
| 账户大小上限 | Solana 单账户最大 10KB；JudgePool 上限 200 judges（7.2KB），超出需分片 |
| Token-2022 限制 | 支持基础转账；Confidential Transfer / Transfer Hook / Permanent Delegate 等扩展被主动拒绝（`utils/` 有 extension 过滤） |
| 单一 mint per task | 每个任务固定一种支付 mint，不支持混合支付 |
| 无 CPI 调用外部程序 | Program 本身不 CPI 调用任何第三方程序（仅被动接受调用） |
| 评判超时处理 | `force_refund` 在 `judge_deadline + 7天` 后可由任何人触发，无需 judge 签名 |
