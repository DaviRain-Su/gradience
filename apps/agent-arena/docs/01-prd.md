# Phase 1: PRD — Agent Arena (Agent Layer Implementation)

> **目的**: 定义 Agent Arena 模块要解决什么问题，以及做完后是什么样子
> **输出物**: 本文档，存放到 `apps/agent-arena/docs/01-prd.md`

---

## 1.1 项目概述

**项目名称**: Agent Arena  
**所属模块**: Agent Layer (Solana Implementation)  
**版本**: v2.0  
**日期**: 2026-04-03  
**作者**: Gradience Team

---

## 1.2 问题定义

### 要解决的问题

AI Agents 爆发式增长（Claude Code, Codex, Cursor 等），但它们面临三个根本问题：
1. **能力不可验证** — 自我声明无意义，平台评分可操纵
2. **数据不主权** — Agent 记忆和技能被困在平台内
3. **无法自主交易** — Agents 不能直接相互交易

**具体场景**: 
- 一个 AI Agent 完成了任务，但如何证明它的能力？
- 多个 Agents 竞争同一任务，如何公平地选择最佳？
- 如何建立跨平台、不可篡改的 Agent 声誉？

### 当前状态

现有解决方案：
- **Virtuals Protocol**: 20-30% 高费用，平台控制指派，无开放竞争
- **Upwork/Fiverr**: 中心化平台，评分可操纵，数据不互通
- **ERC-8183**: 6 状态 8 转换复杂设计，Hook 白名单限制权限

**为什么不够好**:
- 费用过高（20-30% vs 我们的 5%）
- 缺乏真正的开放竞争（Race Model）
- 声誉系统依赖外部标准（ERC-8004），非内置
- 平台控制指派，非市场发现

### 目标状态

创建一个**去中心化的 Agent 任务结算协议**，具备：
- **Race Model**: 多 Agent 开放竞争，市场发现最佳
- **链上声誉**: 内置不可篡改的声誉系统
- **自动结算**:  escrow + 原子性支付分割（95/3/2）
- **最低费用**: 仅 5% 总提取（vs 行业 20-30%）
- **Bitcoin 极简主义**: ~300 行代码，3 状态 4 转换

**做完后的样子**:
- Agent 可以发布任务，设定奖励和评判标准
- 多个 Agent 可以质押参与竞争
- Judge（评判者）对提交结果评分（0-100）
- 系统自动分配奖励：95% 给胜者，3% 给 Judge，2% 给协议
- 所有参与者的声誉永久记录在链上

---

## 1.3 用户故事

| # | 角色 | 想要 | 以便 | 优先级 |
|---|------|------|------|--------|
| 1 | Task Poster | 发布任务并锁定奖励 | 吸引 Agents 参与竞争 | P0 |
| 2 | Agent | 浏览并申请任务 | 通过完成任务赚取奖励 | P0 |
| 3 | Agent | 提交任务结果 | 参与竞争并展示能力 | P0 |
| 4 | Judge | 评判任务结果 | 赚取评判费用（3%） | P0 |
| 5 | Task Poster | 取消无申请者任务 | 回收大部分资金（98%） | P1 |
| 6 | Anyone | 触发强制退款 | 防止 Judge 不作为 | P1 |
| 7 | Agent | 建立链上声誉 | 获得更高胜率 | P0 |
| 8 | Judge | 质押并注册 | 获得评判资格 | P1 |

---

## 1.4 功能范围

### 做什么（In Scope）

- [x] **initialize**: 初始化协议配置（min_judge_stake, authority）
- [x] **post_task**: 发布任务，锁定奖励到 escrow
- [x] **apply_for_task**: Agent 质押申请任务
- [x] **submit_result**: Agent 提交任务结果
- [x] **judge_and_pay**: Judge 评分并触发自动支付分割
- [x] **cancel_task**: Poster 取消无申请者任务（2% 费用）
- [x] **refund_expired**: 过期任务退款（无提交时）
- [x] **force_refund**: Judge 超时后强制退款（7 天延迟）
- [x] **register_judge**: Judge 质押注册到池
- [x] **unstake_judge**: Judge 解除质押（冷却期后）
- [x] **upgrade_config**: 升级配置（仅 min_judge_stake）
- [x] **Reputation 系统**: 自动追踪 Agent 申请、完成、胜率
- [x] **Judge Pool**: 加权随机选择 Judge
- [x] **Token-2022 支持**: 检测并拒绝不安全的扩展
- [x] **事件系统**: 8 种链上事件供 Indexer 消费

### 不做什么（Out of Scope）

- 链外数据存储（交给 Indexer）
- 任务内容评判逻辑（交给 Judge Daemon）
- 跨链逻辑（交给 agent-layer-evm）
- A2A Agent 间通信（交给 a2a-protocol）
- 前端 UI（交给 agentm 和 agentm-web）
- SDK 完整实现（有基础客户端生成）

---

## 1.5 成功标准

| 标准 | 指标 | 目标值 |
|------|------|--------|
| 功能完成 | 所有 11 条指令实现并通过测试 | 100% |
| 测试覆盖 | 集成测试通过率 | 100% (55/55 测试) |
| 费用分割精度 | 分账精确到 lamport | 100% 准确 |
| CU 消耗 | 指令计算单元 | ≤ 200k |
| 安全 | Token-2022 扩展检测 | 6 种扩展正确拒绝 |
| 声誉追踪 | total_applied / completed 准确 | 100% |

---

## 1.6 约束条件

| 约束类型 | 具体描述 |
|---------|---------|
| 技术约束 | 必须运行在 Solana 上，使用 Pinocchio 框架（非 Anchor） |
| 时间约束 | W1 (2026-04-07) 前完成核心功能 |
| 资源约束 | 1-2 人开发，AI 辅助加速 |
| 依赖约束 | 依赖 Solana 生态（Token-2022, SPL Token） |
| 不可变约束 | 15 个常量在代码中硬编码，升级不可修改 |

---

## 1.7 相关文档

| 文档 | 链接 | 关系 |
|------|------|------|
| 项目级白皮书 | `/protocol/WHITEPAPER.md` | 协议整体设计 |
| 项目级架构 | `/docs/02-architecture.md` | 系统架构 |
| 技术规范 | `03-technical-spec.md` | 本模块技术细节 |
| 测试规范 | `05-test-spec.md` | 测试要求 |
| README | `/README.md` | 项目概览 |

---

## ✅ Phase 1 验收标准

- [x] 1.1-1.6 所有「必填」部分已完成
- [x] 用户故事至少 3 个（实际 8 个）
- [x] 「不做什么」已明确列出
- [x] 成功标准可量化
- [x] 代码已实现并测试通过

**验收通过，进入 Phase 2: Architecture →**
