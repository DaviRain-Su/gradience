# Phase 1: PRD — Chain Hub Full v1

> **目的**: 定义 Chain Hub 从 MVP 升级为完整可用组件的产品需求与边界。  
> **输出物**: Chain Hub 独立 PRD（本文件）

---

## 1.1 项目概述

**项目名称**: Chain Hub Full v1  
**所属模块**: Chain Hub  
**版本**: v1.0  
**日期**: 2026-03-31  
**作者**: Droid

## 1.2 问题定义

### 要解决的问题
当前 Chain Hub 仅有 `initialize/register_skill/delegation_task` MVP 骨架，缺少 Protocol Registry 全功能、Delegation 生命周期与统一调用能力，无法支撑真实持续委托执行。

### 当前状态
- 只能注册技能并创建基础 DelegationTask 记录
- 无 Protocol Registry 双轨（REST/CPI）完整建模
- 无 Delegation 激活/执行/完成/取消完整状态机
- 无 Key Vault 策略执行前校验能力

### 目标状态
在本地 Surfpool/Localnet 上交付可验收的完整 Chain Hub：
1. 链上 Program 完整状态机（Skill/Protocol/Delegation）
2. SDK 统一 `invoke` 路由（REST 与 CPI）
3. 本地 Key Vault 适配（env 凭证注入 + 策略校验）

## 1.3 用户故事

| # | 角色 | 想要 | 以便 | 优先级 |
|---|------|------|------|--------|
| 1 | Protocol Provider | 注册 REST 或 Solana Program 协议能力 | 被 Agent 网络统一调用 | P0 |
| 2 | Poster/Requester | 创建并管理持续委托任务（激活/取消/完成） | 将执行权在可控策略内委托给 Agent | P0 |
| 3 | Agent | 在有效策略内执行委托并记录执行计数 | 累积可审计执行历史 | P0 |
| 4 | Operator | 通过统一 SDK `invoke` 调用任意协议 | 屏蔽 REST/CPI 差异 | P1 |
| 5 | Security Reviewer | 对凭证注入与策略约束可验证 | 避免 Agent 越权执行 | P1 |
| 6 | AgentM 用户 | 在 AgentM "发现"页浏览技能市场，按类别/声誉筛选可用 Skill | 发现并使用其他 Agent 的技能 | P2 |
| 7 | Agent | 通过 A2A 消息引用 Skill ID 发起技能调用请求 | Agent 间协商时直接调用对方技能 | P2 |
| 8 | Skill 创建者 | 注册技能后在 AgentM 和 8004scan.io 上被发现 | 获得客户和收入 | P2 |

## 1.4 功能范围

### 做什么（In Scope）
- [x] Chain Hub Program 完整账户与状态机扩展
- [x] Skill 生命周期（注册 + 启停）
- [x] Protocol Registry 双轨建模（REST/CPI，注册 + 启停）
- [x] Delegation 生命周期（创建/激活/执行记录/完成/取消）
- [x] SDK `invoke` 统一路由
- [x] 本地 Key Vault 适配与策略守卫
- [x] Localnet 集成测试与错误码覆盖

### 不做什么（Out of Scope）
- 不做生产级 HSM/Custody 集成（Fireblocks/BitGo 生产对接）
- 不自建独立前端 UI（技能市场浏览/管理通过 AgentM 呈现，见 AgentM PRD 用户故事 #9）
- 不做跨链（EVM/Wormhole）扩展
- 不做主网部署流程

## 1.5 成功标准

| 标准 | 指标 | 目标值 |
|------|------|--------|
| 功能完成 | P0 用户故事通过率 | 100% |
| 稳定性 | Program 单元+集成测试通过率 | 100% |
| SDK 路由 | REST/CPI invoke 路由正确率 | 100% |
| 安全性 | 权限/状态/过期校验负例 | 全通过 |
| 本地可用性 | Surfpool/Localnet 端到端流程 | 可重复执行 |

## 1.6 约束条件

| 约束类型 | 具体描述 |
|---------|---------|
| 技术约束 | Program 必须使用 Pinocchio（no_std，无 Anchor） |
| 时间约束 | 本轮一次性交付文档 + 实现 + 测试 |
| 资源约束 | 单开发流、以现有仓库结构为主 |
| 依赖约束 | 依赖 Agent Layer Program JudgePool PDA 规则；依赖 Localnet 测试环境 |

## 1.7 相关文档

| 文档 | 链接 | 关系 |
|------|------|------|
| 全局 PRD | `docs/01-prd.md` | 上位产品目标 |
| 全局架构 | `docs/02-architecture.md` | 明确 Chain Hub 在 Layer 1 的定位 |
| Chain Hub 现状实现 | `apps/chain-hub/program/src` | MVP 基线 |

---

## ✅ Phase 1 验收标准

- [x] 1.1-1.6 所有必填部分已完成
- [x] 用户故事至少 3 个
- [x] In Scope / Out of Scope 明确
- [x] 成功标准可量化
- [x] 可作为 Phase 2 输入
