# Phase 1: PRD — Agent Layer v2

> **目的**: 定义「要解决什么问题」和「做完后是什么样子」
> **输出物**: `docs/01-prd.md`

---

## 变更记录

| 版本 | 日期       | 变更说明                                                                                                                                                                                                                      |
| ---- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.1 | 2026-03-30 | 初稿                                                                                                                                                                                                                          |
| v0.2 | 2026-03-30 | 扩展 Scope：EVM、Judge Staking/Slash、治理、可升级、SDK/CLI/前端、AI Judge、多 Agent 自动排序；整体时间线压缩至 2026-04 单月                                                                                                  |
| v0.3 | 2026-03-30 | Review 修正：W1 延至 2 周（04-14）；澄清"无注册"≠无质押；Token2022 启用 Hook 时返回错误；信誉证明由 upgrade_authority 多签；代码行数上限改 ≤1000；串通检测推后；治理权限表格；用户故事 #15/#16 阶段注释；新增 #18 cancel_task |
| v0.4 | 2026-04-02 | 新增 §1.7 产品架构：区分产品层 vs 基础设施层；新增开发者侧运行时规划                                                                                                                                                          |
| v0.5 | 2026-04-02 | AgentM 合并为 AgentM（用户唯一入口）；双界面设计（GUI + API）；桌面框架改为 Electrobun                                                                                                                                        |

---

## 1.1 项目概述

**项目名称**: Agent Layer v2
**所属模块**: Agent Layer（Protocol Kernel）+ 全栈工具链
**版本**: v0.2
**日期**: 2026-03-30
**作者**: davirian

---

## 1.2 问题定义

### 要解决的问题

> AI Agent 之间没有可信、无需许可的能力交换与价值结算基础设施——能力声明不可信，平台规则可篡改，Agent 无法自主商业交互，开发者也缺乏配套工具进入这个生态。

### 当前状态（Agent Arena MVP v1 的局限）

| 问题             | 现状                                      | 影响                                      |
| ---------------- | ----------------------------------------- | ----------------------------------------- |
| 全局单一 Judge   | 所有任务共用一个 `judgeAddress`           | 无法专业化评判，无法让 Program 充当 Judge |
| Judge 无经济激励 | Judge 免费劳动                            | Judge 理性选择不参与 → 系统长期无法运转   |
| 协议无收入       | Protocol Fee = 0%                         | 无法维持长期运营                          |
| 参与需要注册     | `applyForTask()` 有 `onlyRegistered` 限制 | 违背无需许可原则，阻止自主 Agent          |
| 信誉需预注册     | 必须先调用 `registerAgent()`              | 增加摩擦，阻止冷启动                      |
| 无 Staking/Slash | Agent 和 Judge 无需质押                   | Sybil 攻击和串通成本为零                  |
| 单链 EVM         | 只有 EVM 实现                             | 无法接触 Solana 生态，性能受限            |
| 无开发者工具     | 无 SDK / CLI / 前端                       | 开发者无法方便地接入协议                  |

### 目标状态

**Agent Layer v2 = 完整协议栈，从链上内核到开发者工具全覆盖：**

- **链上内核（Solana）**：仅支持 **Race Task**（离散竞争结算）——多 Agent 并行提交，Judge 选最优，一次性结算；持续委托类任务（Delegation Task）由 Chain Hub 在上层实现，不进入内核
- **Staking + Slash**：Agent/Judge 质押防 Sybil，恶意行为触发 Slash；**"无注册门槛"= 无需显式 `registerAgent()` 调用，但 `apply_for_task` 时仍须质押 `min_stake`，首次调用自动初始化 Reputation PDA**
- **多币种**：原生 SOL + SPL Token + Token2022 三路兼容
- **可升级 Program**：多签治理升级权，协议成熟后可主动关闭升级权实现永久不可变
- **AI Judge + Oracle**：Judge Daemon 支持 AI 打分和链下预言机，实现自动化评判
- **多 Agent 自动排序**：竞争提交后按信誉自动排序，辅助 Judge/Poster 决策
- **全栈工具链**：TypeScript SDK + CLI + 产品前端 + 第三方开发者 SDK
- **EVM 部署**：Solana 首发后，同步部署到 Base/Arbitrum，共享链上信誉证明

### 协议普适性：任何满足三个条件的任务都可以在内核上运行

Agent Layer 内核不关心任务的业务类型，只问一件事：**谁干得最好，钱就给谁。**

任务只需满足：

1. **有可交付物** — 代码、文档、策略、数据、分析……任何可引用的产出
2. **可以被评判** — Judge 能给 0-100 分，无论主观（人工）还是客观（合约/预言机）
3. **多人可独立竞争完成** — 不需要独占资源

| 领域         | 示例任务                                          | Judge 类型        |
| ------------ | ------------------------------------------------- | ----------------- |
| **DeFi**     | 套利策略设计、清算执行、风险评估报告、LP 策略选人 | 预言机合约 / AI   |
| **代码**     | Bug 修复、功能开发、安全审计、测试用例编写        | 测试套件合约 / AI |
| **AI/Agent** | 模型微调、Prompt 工程、数据标注、Agent 评测       | AI Judge / 人工   |
| **创意**     | 营销文案、设计方案、品牌策略、翻译                | 人工 EOA / AI     |
| **研究**     | 市场调研、技术可行性分析、竞品报告                | 人工 EOA / AI     |
| **运营**     | 社媒内容、用户增长方案、活动策划                  | 人工 EOA          |
| **链上治理** | 提案分析、投票建议、风险评级                      | DAO 多签 / AI     |

> 唯一不适合内核的场景：**持续独占执行**（LP 实际操盘、交易机器人持续运行等）——这类任务的**选人阶段**仍可用竞争模型，**执行阶段**由 Chain Hub Delegation Task 处理。

---

## 1.3 用户故事

| #   | 角色                     | 想要                                                                                                                                  | 以便                                                                                                                                         | 优先级 | 交付周          |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------- |
| 1   | Poster                   | 发布任务时指定专属 Judge 地址（EOA / Program / 多签）                                                                                 | 为不同任务选择最合适的评判者                                                                                                                 | P0     | W1              |
| 2   | Judge                    | 每次评判获得 3% 费用（与任务同币种），无论通过还是拒绝                                                                                | 有经济动机参与，不存在结果偏见                                                                                                               | P0     | W1              |
| 3   | Agent                    | 无需显式注册（无 `registerAgent()`），直接申请任务自动初始化 Reputation PDA（质押 `min_stake` 仍是前提）                              | 降低门槛，让自主 Agent 无缝接入                                                                                                              | P0     | W1              |
| 4   | Agent                    | 质押一定数量的 SOL/Token 才能参与任务                                                                                                 | 防止 Sybil 攻击，证明参与诚意                                                                                                                | P0     | W1              |
| 5   | 协议方                   | 每笔结算收取 2% 协议费（写入合约常量）                                                                                                | 维持长期运营，向参与者承诺费率永不涨                                                                                                         | P0     | W1              |
| 6   | 开发者                   | 用 TypeScript SDK 在 3 行代码内发布一个任务                                                                                           | 快速接入协议，无需理解底层 Pinocchio / Borsh 细节                                                                                            | P0     | W2              |
| 7   | 开发者                   | 用 CLI 工具完成发任务、查看、评判的全流程                                                                                             | 本地开发和测试无需前端                                                                                                                       | P0     | W2              |
| 8   | Poster                   | 用 AI Judge（如 Claude API）自动评判提交结果                                                                                          | 主观任务不依赖人工评判，7×24 小时运转                                                                                                        | P1     | W2              |
| 9   | Poster                   | 对于可验证任务（测试用例），用预言机自动执行并上链评分                                                                                | 代码类任务实现确定性无人工评判                                                                                                               | P1     | W2              |
| 10  | Poster                   | 查看所有提交结果按信誉自动排序的列表                                                                                                  | 快速找到最优候选，减少评判工作量                                                                                                             | P1     | W2              |
| 11  | 任何人                   | Judge 超时 7 天未评判时触发 `force_refund()`                                                                                          | 协议无单点故障，资金不会被永久锁定                                                                                                           | P0     | W1              |
| 12  | DAO 成员                 | 通过多签治理投票升级 Program                                                                                                          | 修复 Bug 或迭代功能，同时保持去中心化控制                                                                                                    | P1     | W3              |
| 13  | EVM 开发者               | 在 Base/Arbitrum 上调用 Agent Layer，携带 Solana 信誉证明                                                                             | 一个 Agent 在所有链上使用同一套信誉                                                                                                          | P1     | W4              |
| 14  | 用户                     | 通过产品前端发布任务、查看竞争状态、触发评判                                                                                          | 无需编写代码即可参与协议                                                                                                                     | P0     | W2              |
| 15  | DeFi LP 管理人（Poster） | 用竞争模型选出最佳 LP 管理 Agent：发布"提交你的 LP 策略方案 + 历史信誉证明"任务，多个 Agent 竞争提交，Judge（预言机合约）评判方案质量 | Agent Layer 的竞争模型用于**选人**，不用于执行；胜者拿到信誉 + 委托授权资格（**注：选人阶段 W2 完成，执行阶段依赖 W3 Chain Hub Key Vault**） | P1     | W2              |
| 16  | LP Agent（执行者）       | 提交策略方案和链上历史业绩作为竞争结果，在选人阶段赢得委托                                                                            | 通过竞争把 LP 管理能力变成链上可信信誉，不需要主观信任（**注：选人阶段 W2 完成，实际执行授权依赖 W3 Chain Hub**）                            | P1     | W2              |
| 17  | DeFi LP 管理人（Poster） | 赢得选人竞争的 Agent，通过 Chain Hub Key Vault 获得仓位操作权，在约定参数内持续执行，按周绩效结算                                     | 执行阶段是持续委托，不是竞争，由 Chain Hub Delegation Task 处理，Agent Layer 只管选人这一次竞争                                              | P1     | W3（Chain Hub） |
| 18  | Poster                   | 主动取消无提交（或截止前）的任务，拿回 98% 资金（2% 作为取消费归协议）                                                                | 任务方向调整时不被永久锁定资金                                                                                                               | P0     | W1              |

---

## 1.4 功能范围

### 做什么（In Scope）

#### 🔴 W1（2026-04-01 ~ 04-14，**2 周**）— Solana 核心 Program

- **Per-task Judge**: `Task` 账户新增 `judge` 字段，`post_task` 时指定
- **Judge Fee 常量**: `JUDGE_FEE_BPS = 300`（3%，硬编码）
- **Protocol Fee 常量**: `PROTOCOL_FEE_BPS = 200`（2%，硬编码）
- **三方自动分账**: `judge_and_pay` 执行 Agent/Poster + Judge + Protocol 三路分账
- **去掉注册门槛**: `apply_for_task` 任何地址可调用，首次调用自动初始化 AgentRecord
- **`force_refund` 无需许可**: 任何地址可在 `judge_deadline` 过后触发
- **IJudge CPI 接口**: 标准 CPI 接口，支持 Judge 是任意 Solana Program
- **多币种支付**: 原生 SOL（lamport）+ SPL Token + Token2022 三路兼容，`post_task` 时指定 mint
- **Agent Staking**: 每任务 Poster 设定 `min_stake`，Agent 必须质押才能 apply
- **Judge Staking**: 协议级最低 Judge 质押要求
- **基础 Slash**: Judge 超时未评判 → 质押扣减（`force_refund` 触发时执行）；**串通检测（Collusion Detection）暂不在 W1 实现**——判定条件和 Slash 比例需在 Phase 3 技术规格中精确定义后再执行，MVP 阶段仅做超时 Slash
- **全量集成测试（litesvm + cargo test-sbf）**: 所有状态转换、边界条件、SOL/SPL/Token2022 三路路径

#### 🟠 W2（2026-04-15 ~ 04-21）— 工具链

- **TypeScript SDK**: `@gradiences/sdk`，封装所有 Program 指令，3 行代码发任务
- **CLI 工具**: `gradience` 命令行，支持 `post`、`apply`、`submit`、`judge`、`refund`、`status` 等子命令
- **Judge Daemon**: 链下服务，监听 Program 事件，支持两种自动评判模式：
    - **AI Judge 模式**: 调用 Claude/GPT API，将任务描述 + 提交结果发给 LLM，返回 0-100 分并上链
    - **Oracle 模式**: 对 `test_cases` 类任务，在链下运行测试套件，将执行结果作为证明提交链上；Judge Program 读取证明自动给分
- **多 Agent 自动排序**: 前端/SDK 展示所有提交结果，按 Agent 信誉（`avg_score × win_rate`）自动排序，辅助 Judge 决策
- **产品前端**: 发任务、查竞争列表、查排序结果、触发评判的 Web 界面
- **第三方开发者 SDK**: 面向外部开发者的 SDK 文档和示例代码
- **DeFi 委托任务示例**: 以 LP 管理场景为 E2E 示例——Poster 发布周期性 LP 管理任务，预言机 Judge 读取 Orca/Raydium 链上 PnL 自动打分，Agent 信誉随绩效积累；**完全无信任的仓位授权由 W3 Chain Hub Key Vault 处理**

#### 🟡 W3（2026-04-22 ~ 04-26）— 生态扩展

- **Chain Hub MVP**: 技能市场 + 协议注册表 MVP
- **AgentM MVP**: 用户入口应用（由历史 Me/Social 体验收敛而来），Google OAuth 登录，A2A 消息，Agent 发现广场
- **GRAD 创世**: Token 发行 + 空投 + GRAD/SOL 流动性池
- **链上治理（多签 DAO）**: 控制 Program 升级权，管理 Protocol Treasury

    **治理权限边界（重要）**：

    | 参数                     | 可治理？          | 说明                            |
    | ------------------------ | ----------------- | ------------------------------- |
    | `treasury` 地址          | ✅ 可治理         | 通过 `upgrade_config` 更新      |
    | `min_judge_stake`        | ✅ 可治理         | 通过 `upgrade_config` 更新      |
    | `JUDGE_FEE_BPS` (300)    | ❌ **永久硬编码** | 代码常量，不受任何治理/升级影响 |
    | `PROTOCOL_FEE_BPS` (200) | ❌ **永久硬编码** | 代码常量，不受任何治理/升级影响 |
    | `AGENT_FEE_BPS` (9500)   | ❌ **永久硬编码** | 派生值，不受任何治理/升级影响   |

#### 🔵 W4（2026-04-27 ~ 04-30，best effort）— 全链扩展

- **EVM 部署**: 将 Agent Layer v2 协议逻辑移植到 Solidity，部署到 Base 和 Arbitrum
- **跨链信誉证明**: Agent 在 Solana 上的信誉可以生成签名证明，在 EVM 合约中验证
- **A2A 协议（MagicBlock ER）**: Agent 间实时消息 + 微支付通道 MVP
- **挖矿飞轮**: GRAD 质押 + 挖矿奖励分发 + 回购销毁启动
- **目标**: 1M+ Agents 上链

### 不做什么（Out of Scope）

- **Token2022 高级扩展**: Confidential Transfer、Transfer Hook、Permanent Delegate 等扩展能力；`post_task` 会检测 mint 是否启用了 Transfer Hook 扩展——**若已启用，指令返回 `UnsupportedMintExtension` 错误，任务拒绝创建**；仅支持未启用任何高级扩展的标准 Token2022 mint
- **跨链桥**: 不构建实时跨链桥，信誉通过签名证明传递，不依赖桥协议
- **Delegation Task（持续委托任务）**: Agent Layer 内核**只支持 Race Task**（离散竞争）；LP 管理、交易机器人等持续委托场景的执行阶段，由 Chain Hub 在上层实现 Delegation Task 原语，不进入内核状态机——这是架构边界决策，不是功能缺失

---

## 1.5 成功标准

| 标准         | 指标                                                  | 目标值          |
| ------------ | ----------------------------------------------------- | --------------- |
| 核心功能     | 所有 P0 用户故事测试通过                              | 100%            |
| 费率正确性   | 每笔结算 Judge:Protocol:Agent/Poster 分账比例         | 精确 3:2:95     |
| 代码规模     | Solana Program 总行数（不含注释）                     | ≤ 1000 行       |
| 测试覆盖     | litesvm + cargo test-sbf 分支覆盖率（cargo llvm-cov） | ≥ 95%           |
| 安全性       | Slash、重入、串通、超时绕过等攻击测试                 | 0 Critical 漏洞 |
| Compute 效率 | `post_task` + `judge_and_pay` 单指令 CU 消耗          | ≤ 200,000 CU    |
| SDK 易用性   | 从 npm install 到发出第一个任务                       | ≤ 10 行代码     |
| CLI 覆盖     | 支持完整任务生命周期（发/申请/提交/评判/退款）        | 全覆盖          |
| AI Judge     | Judge Daemon 调用 AI API 自动评判并上链               | 端到端可用      |
| EVM 兼容     | Base/Arbitrum 合约通过同一套测试用例                  | 100%            |
| 多链信誉     | EVM 合约验证 Solana 信誉证明                          | 端到端可用      |

---

## 1.6 约束条件

| 约束类型 | 具体描述                                                                                                                                                  |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 技术约束 | Solana 主网优先，Rust + Pinocchio（no_std，无 Anchor）；EVM 版本 Solidity ^0.8.20（W4）                                                                   |
| 技术约束 | **费率常量不可修改**：`JUDGE_FEE_BPS = 300`、`PROTOCOL_FEE_BPS = 200` 硬编码，不受治理控制                                                                |
| 技术约束 | **Program 可升级**：部署时保留 upgrade authority，由多签 DAO 控制；协议成熟后可主动关闭 upgrade authority 实现永久不可变                                  |
| 技术约束 | 支付层：SOL（lamport）+ SPL Token + Token2022（基础兼容）；Token 任务用 ATA + CPI                                                                         |
| 技术约束 | Token2022 只支持标准 transfer；若 mint 已启用 Transfer Hook / Confidential Transfer 扩展，`post_task` 返回 `UnsupportedMintExtension` 错误拒绝创建        |
| 时间约束 | 整个协议（含 EVM、A2A、飞轮）在 **2026-04-30** 前全部完成，AI 辅助加速                                                                                    |
| 时间约束 | Solana 核心 Program 在 **2026-04-14**（W1，2 周）交付                                                                                                     |
| 资源约束 | 单人开发 + AI 辅助，遵循 dev-lifecycle 7 阶段 TDD 流程                                                                                                    |
| 依赖约束 | Agent Arena v1（EVM）作为功能基线参考，v2 Solana Program 为全新实现                                                                                       |
| 依赖约束 | EVM 版本（W4）依赖 Solana Program（W1）的协议逻辑稳定                                                                                                     |
| 技术约束 | 跨链信誉证明由 **upgrade_authority（Squads v4 多签）离线签名**，EVM 合约 `ReputationVerifier` 验证 ed25519 签名；PDA 本身不持有私钥，无法直接签名链下消息 |
| 依赖约束 | Judge Daemon AI 模式依赖 Claude/GPT API 可用性（链下）                                                                                                    |

---

## 1.7 产品架构

### 产品层与基础设施层

Gradience 的组件分为两层：**用户可见的产品**和**用户不直接接触的基础设施**。基础设施 ~85% 已就绪，但产品层是协议从"能跑"到"能用"的最后一公里。

#### 用户可见产品

| 产品           | 定位                                                                                                                                                                                                                                      | 目标用户                   | 状态                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| **AgentM**     | 用户唯一入口应用（由历史 Me/Social 体验收敛而来）。Google OAuth 登录 → 嵌入式钱包。"我的"视角（声誉/任务）+ "社交"视角（发现/通讯）。双界面设计：人用 GUI，Agent 用 API，同一 A2A 协议。桌面优先（Electrobun），本地语音（Whisper + TTS） | Web2/Web3 所有用户 + Agent | W3                       |
| **AgentM Pro** | 开发者侧控制台与运行时配套。用于 Profile 发布、自动化运维与后续云端托管入口；当前先支持本地优先的开发工作流，后续扩展一键云端部署                                                                                                         | 开发者 / 高级用户          | W3（本地）/ 后期（云端） |

#### 基础设施（用户不直接接触）

| 组件         | 说明                               |
| ------------ | ---------------------------------- |
| Agent Arena  | 链上竞争结算内核                   |
| Chain Hub    | 技能市场 + 协议注册表 + 委托任务   |
| Indexer      | 链上数据查询 REST API + WebSocket  |
| Judge Daemon | 后台自动评判服务                   |
| A2A Protocol | Agent 间发现 + 通讯 + 微支付协议层 |

#### 登录与钱包策略

传统 Web3 产品要求用户先创建钱包（理解助记词、管理私钥），这阻止了 99% 的 Web2 用户。

**Gradience 的方案**：用户通过 Google 账号登录 AgentM，系统通过嵌入式钱包技术（Privy / Web3Auth）自动为用户生成链上地址。Google 账号在这里扮演类似"个人身份凭证"的角色，让 Web2 用户直接使用产品。

- SDK 已预留 `PrivyAdapter` 接口存根（`wallet-adapters.ts`）
- 用户无需下载浏览器钱包插件
- 私钥由嵌入式钱包 SDK 管理（TEE / MPC），用户侧零感知

#### 产品关系图

```
用户（Google OAuth 登录）
  └── AgentM（入口应用）
       ├── "我的"视角：管理 Agent / 声誉 / 任务历史
       ├── "社交"视角：发现广场 / A2A 通讯 / 合作邀请
       ├── 进入竞技场              ← Agent Arena（链上）
       ├── 浏览技能市场            ← Chain Hub（链上）
       ├── 数据查询                ← Indexer（API）
       └── 开发者运维/运行时入口    ← AgentM Pro（本地 → 云端）
```

---

## 1.8 相关文档

| 文档           | 链接                                                                               | 关系                      |
| -------------- | ---------------------------------------------------------------------------------- | ------------------------- |
| 协议比特币哲学 | `protocol/protocol-bitcoin-philosophy.md`                                          | 设计原则，5 个核心改动    |
| 系统架构设计   | `protocol/design/system-architecture.md`                                           | 内核与模块依赖关系        |
| 安全架构       | `protocol/design/security-architecture.md`                                         | 威胁模型与 Slash 防御策略 |
| A2A 协议规格   | `protocol/design/a2a-protocol-spec.md`                                             | W4 A2A 实现依据           |
| Agent Arena v1 | [codeberg.org/gradiences/agent-arena](https://codeberg.org/gradiences/agent-arena) | 功能基线                  |
| Whitepaper     | `protocol/WHITEPAPER.md`                                                           | 整体愿景与经济模型        |

---

## ✅ Phase 1 验收标准

- [x] 1.1–1.7 所有必填部分已完成
- [x] 用户故事 ≥ 3 个（共 18 个，按交付周标注，含 DeFi LP 委托场景 + cancel_task）
- [x] 「不做什么」已明确（仅 Token2022 高级扩展 + 跨链桥）
- [x] 成功标准可量化（11 项指标）
- [x] 技术约束、时间约束、依赖约束均已定义
- [x] 所有模块按周交付时间明确

**验收通过后，进入 Phase 2: Architecture →**
