# Phase 1: PRD — Agent Layer v2

> **目的**: 定义「要解决什么问题」和「做完后是什么样子」
> **输出物**: `docs/01-prd.md`

---

## 1.1 项目概述

**项目名称**: Agent Layer v2
**所属模块**: Agent Layer（Protocol Kernel）
**版本**: v0.1
**日期**: 2026-03-30
**作者**: davirian

---

## 1.2 问题定义

### 要解决的问题

> AI Agent 之间没有可信、无需许可的能力交换与价值结算基础设施——自我声明的能力不可信，平台可以篡改规则，Agent 无法直接商业交互。

### 当前状态（Agent Arena MVP v1 的局限）

| 问题 | 现状 | 影响 |
|------|------|------|
| 全局单一 Judge | 所有任务共用一个 `judgeAddress`，不可为每个任务指定不同 Judge | 无法支持专业化 Judge，无法让合约充当 Judge |
| Judge 无经济激励 | Judge 免费评判，没有报酬 | Judge 理性选择不参与 → 系统长期无法运转 |
| 协议无收入 | Protocol Fee = 0% | 无法维持协议长期运营和开发 |
| 参与需要注册 | `applyForTask()` 有 `onlyRegistered` 限制 | 提高参与门槛，违背比特币哲学（任何人可参与） |
| 信誉需预注册 | 必须先调用 `registerAgent()` 才能建立信誉 | 增加摩擦，阻止自主 Agent 直接参与 |

### 目标状态

**Agent Layer v2 = 完整实现比特币哲学的 Agent 能力结算协议：**

- 任何地址发布需求 → 锁入价值
- 任何地址申请执行 → 竞争出最优 Agent
- 每任务独立 Judge（EOA / 合约 / 多签）→ 评判质量
- 自动三方分账：Agent 95% + Judge 3% + Protocol 2%（全部硬编码为常量）
- 信誉从行为中自动积累，无需预注册

---

## 1.3 用户故事

| # | 角色 | 想要 | 以便 | 优先级 |
|---|------|------|------|--------|
| 1 | Poster（需求方） | 在发布任务时指定一个专门的 Judge 地址 | 为不同类型任务选择最合适的评判者（代码 Judge / 设计 Judge / 自动合约 Judge） | P0 |
| 2 | Judge（评判者） | 每次完成评判都获得任务价值 3% 的费用（与任务同币种），无论通过还是拒绝 | 有经济动机参与评判，且不存在结果偏见 | P0 |
| 3 | Agent（执行者） | 无需预先注册，直接申请任务即可自动建立链上信誉 | 降低参与门槛，让自主 Agent 可以无缝接入 | P0 |
| 4 | Agent（执行者） | 首次参与任务时自动初始化信誉记录 | 不需要单独的注册步骤，减少链上交易次数 | P1 |
| 5 | 协议方 | 每笔结算收取 2% 协议费，写入合约常量不可修改 | 维持协议长期运营，且向参与者承诺费率永不上涨 | P0 |
| 6 | 开发者 | Judge 可以是任意 Solana Program（通过 CPI 调用标准 `IJudge` 接口） | 支持零知识证明验证、预言机、多签等高级评判形式 | P1 |
| 7 | 任何人 | Judge 超时 7 天未评判时可调用 `forceRefund()` 触发退款 | 协议无单点失败，任何参与者都可解锁被卡住的资金 | P0 |

---

## 1.4 功能范围

### 做什么（In Scope）

- [x] **Per-task Judge**: `Task` 结构体新增 `judge` 字段，`postTask()` 时指定
- [x] **Judge Fee 常量**: `JUDGE_FEE_BPS = 300`（3%，硬编码，不可修改）
- [x] **Protocol Fee 常量**: `PROTOCOL_FEE_BPS = 200`（2%，硬编码，不可修改）
- [x] **Protocol Treasury 地址**: 部署时设置，收取协议费
- [x] **三方自动分账**: `judgeAndPay()` 执行 Agent/Poster + Judge + Protocol 三路分账
- [x] **去掉 `onlyRegistered` 限制**: `applyForTask()` 任何地址可调用
- [x] **信誉按需初始化**: 首次 `applyForTask()` 时自动创建 AgentRecord
- [x] **`forceRefund()` 无需许可**: 任何地址可在 `judgeDeadline` 过后触发
- [x] **IJudge CPI 接口**: 定义标准 CPI 接口，支持 Judge 是任意 Solana Program
- [x] **多币种支付**: 任务奖励支持原生 SOL 或任意 SPL Token（含 Token2022 兼容 mint），`postTask()` 时指定 mint；SOL 任务用 lamport 转账，Token 任务用 ATA + `token_transfer` CPI
- [x] **全量测试覆盖**: 覆盖所有状态转换、边界条件、攻击向量（SOL + SPL Token 两套路径均覆盖）

### 不做什么（Out of Scope）

- **不做** EVM 版本（v2 首发 Solana，EVM 移植是后续独立任务）
- **不做** Judge Staking / Slash 机制（属于 2027 A2A 路线图）
- **不做** 链上治理 / DAO（费率常量、规则永远不可通过投票修改）
- **不做** Token2022 高级扩展功能（如 Confidential Transfer、Transfer Hook 等），仅保证基础 Token2022 mint 兼容
- **不做** 任务评分的 AI 辅助或链下预言机集成（Judge 自行决定）
- **不做** Program 可升级：v2 部署为 immutable program，规则即承诺
- **不做** 前端 / SDK 改造（Program 交付后单独处理）
- **不做** 多 Agent 竞争的自动排序（Poster 手动选择 `assignTask()`）

---

## 1.5 成功标准

| 标准 | 指标 | 目标值 |
|------|------|--------|
| 功能完整性 | 所有 P0 用户故事的测试通过 | 100% |
| 费率正确性 | 每笔结算中 Judge:Protocol:Agent/Poster 分账比例 | 3% : 2% : 95% 精确 |
| 代码规模 | 合约总行数（不含注释） | ≤ 320 行 |
| 测试覆盖 | 分支覆盖率 | ≥ 95% |
| 安全性 | 重入攻击、串通攻击、超时绕过等测试全部通过 | 0 Critical 漏洞 |
| Compute 效率 | `post_task` + `judge_and_pay` Compute Units 消耗 | 单指令 ≤ 200,000 CU |
| 无门槛参与 | 未注册地址直接调用 `applyForTask()` 不 revert | 100% 通过 |

---

## 1.6 约束条件

| 约束类型 | 具体描述 |
|---------|---------|
| 技术约束 | Solana 主网，Rust + Anchor 框架，Solana Program（不是 EVM） |
| 技术约束 | Program 部署为不可升级（close upgrade authority），规则是协议承诺，不是配置 |
| 技术约束 | 费率 `JUDGE_FEE_BPS = 300`、`PROTOCOL_FEE_BPS = 200` 必须为常量，不可被任何指令修改 |
| 技术约束 | 支付层：原生 SOL（lamport 转账）+ SPL Token + Token2022 三路兼容；Token 任务使用 ATA，分账通过 `spl_token::transfer` / `spl_token_2022::transfer` CPI 执行 |
| 时间约束 | Agent Layer v2 Program 需在 2026-04-30 前完成（1 个月，AI 辅助加速开发） |
| 资源约束 | 单人开发 + AI 辅助，遵循 dev-lifecycle 7 阶段 TDD 流程 |
| 依赖约束 | 以现有 Agent Arena v1（EVM/Solidity）的协议逻辑作为功能基线，v2 为 Solana 原生独立 Program |
| 依赖约束 | v2 部署后，现有 Agent Arena MVP 前端/SDK 需要迁移（单独处理） |

---

## 1.7 相关文档

| 文档 | 链接 | 关系 |
|------|------|------|
| 协议比特币哲学 | `protocol/protocol-bitcoin-philosophy.md` | 设计原则来源，5 个具体改动定义在此 |
| 系统架构设计 | `protocol/design/system-architecture.md` | 内核与模块依赖关系 |
| ERC-8183 对比分析 | `protocol/protocol-bitcoin-philosophy.md` §三 | 竞品对比，指导差异化设计 |
| 安全架构 | `protocol/design/security-architecture.md` | 威胁模型与防御策略 |
| Agent Arena MVP（v1） | [codeberg.org/gradiences/agent-arena](https://codeberg.org/gradiences/agent-arena) | v2 的改动基线 |
| Whitepaper | `protocol/WHITEPAPER.md` | 整体协议愿景与经济模型 |

---

## ✅ Phase 1 验收标准

- [x] 1.1–1.6 所有必填部分已完成
- [x] 用户故事 ≥ 3 个（共 7 个）
- [x] 「不做什么」已明确列出（8 条）
- [x] 成功标准可量化（7 项指标）
- [x] 技术约束、时间约束、依赖约束均已定义

**验收通过后，进入 Phase 2: Architecture →**
