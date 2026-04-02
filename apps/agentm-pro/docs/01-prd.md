# Phase 1: PRD — AgentM Pro

> **目的**: 定义 AgentM Pro MVP 要解决什么问题、做什么、不做什么
> **输入**: 白皮书 v1.2、项目级 PRD、AgentM PRD
> **输出物**: 本文档

---

## 变更记录

| 版本 | 日期 | 变更说明 |
|------|------|---------|
| v0.1 | 2026-04-03 | 初稿 |

---

## 1.1 项目概述

**项目名称**: AgentM Pro
**定位**: 面向开发者的 AI Agent 部署/管理平台（独立产品）
**姊妹产品**: AgentM（面向用户，独立桌面应用，见 `apps/agentm/docs/01-prd.md`）
**版本**: MVP
**日期**: 2026-04-03
**作者**: davirian

---

## 1.2 问题定义

### 要解决的问题

> AI Agent 开发者想让自己的 Agent 参与 Gradience 经济网络（接任务、赚钱、积累声誉），但缺少一个完整的部署和管理平台。目前只有零散的 SDK + CLI，没有统一的开发者体验。

### 目标状态

**AgentM Pro = Agent 开发者的一站式工作台**

三种核心使用模式：
1. **部署 Agent**: 开发 → 测试 → 一键部署到链上
2. **管理 Agent**: 监控运行状态、查看收入、调整策略
3. **集成协议**: 在自己的应用中集成 Gradience SDK

---

## 1.3 用户故事

### Agent 部署与管理

| # | 角色 | 想要 | 以便 | 优先级 |
|---|------|------|------|--------|
| 1 | 开发者 | 用 CLI 快速部署一个 Agent 到 Gradience 网络 | Agent 能被用户发现和使用 | P0 |
| 2 | 开发者 | 在 Dashboard 看到我的 Agent 运行状态和收入 | 了解 Agent 表现和 ROI | P0 |
| 3 | 开发者 | 用 CLI 发布/申请/提交/评判任务 | 自动化任务流程 | P0 |
| 4 | 开发者 | 查看 Agent 声誉分数和历史变化趋势 | 优化 Agent 策略 | P1 |
| 5 | 开发者 | 注册 Agent 为 Judge，质押并参与评判 | 赚取 Judge 费用 | P1 |

### SDK 集成

| # | 角色 | 想要 | 以便 | 优先级 |
|---|------|------|------|--------|
| 6 | 开发者 | 在我的 TypeScript 项目中 `import { GradienceSDK } from '@gradience/sdk'` | 几行代码接入协议 | P0 |
| 7 | 开发者 | SDK 文档有 Quick Start 示例 | 5 分钟内跑通第一个任务 | P0 |
| 8 | 开发者 | SDK 有 TypeScript 类型和 JSDoc | IDE 自动补全，降低学习成本 | P1 |

### Agent 开发框架

| # | 角色 | 想要 | 以便 | 优先级 |
|---|------|------|------|--------|
| 9 | 开发者 | 用模板创建一个新的 Agent 项目 | 快速开始，不从零写起 | P1 |
| 10 | 开发者 | 本地测试 Agent 的任务响应逻辑 | 上链前验证行为 | P1 |
| 11 | 开发者 | 一键部署 Agent 到云端（24/7 运行） | Agent 持续在线接任务 | P2 |

---

## 1.4 功能范围

### 做什么（In Scope — MVP）

#### P0 必须

- **CLI 工具** (`gradience`): 任务全生命周期命令 + Agent/Judge 管理
- **TypeScript SDK** (`@gradience/sdk`): 所有链上指令 + Indexer 查询
- **Web Dashboard**: Agent 监控面板（声誉/收入/任务统计）
- **SDK 文档**: Quick Start + API Reference

#### P1 应做

- **Agent 模板**: `gradience create-agent` 创建新项目
- **本地测试**: devnet 自动化测试脚本
- **Judge 管理**: CLI 注册/质押/退出
- **NO_DNA 支持**: 机器可读输出（JSON），适配 Agent 自动化

#### P2 可延后

- 云端 Agent 运行时（DashDomain Cloud）
- GitHub Actions 集成
- Agent 性能分析
- 多链部署（EVM）

### 不做什么

- 不做 GUI 桌面应用（归 AgentM）
- 不做用户端 Agent 发现（归 AgentM）
- 不做 A2A IM 界面（归 AgentM）
- 不做链上合约修改

---

## 1.5 成功标准

| 标准 | 指标 | 目标值 |
|------|------|--------|
| CLI 安装 | `npm i -g @gradience/cli` → 可用 | < 30 秒 |
| SDK 集成 | 从 import 到第一个查询成功 | < 5 分钟 |
| 任务全周期 | CLI: post → apply → submit → judge | 端到端成功 |
| Dashboard | 加载 Agent 声誉和任务数据 | 正确展示 |
| NO_DNA | 所有 CLI 命令输出结构化 JSON | 100% 覆盖 |

---

## 1.6 现有代码映射

AgentM Pro 整合现有工具链组件：

| 现有组件 | 位置 | 映射到 AgentM Pro |
|----------|------|-------------------|
| TypeScript SDK | `apps/agent-arena/clients/typescript/` | `@gradience/sdk` (npm package) |
| CLI | `apps/agent-arena/cli/` | `@gradience/cli` (npm package) |
| Frontend (Next.js) | `apps/agent-arena/frontend/` | AgentM Pro Web Dashboard |
| Judge Daemon | `apps/agent-arena/judge-daemon/` | Agent 运行时组件 |
| Indexer | `apps/agent-arena/indexer/` | 后端数据服务 |

---

## 1.7 约束条件

| 约束类型 | 具体描述 |
|---------|---------|
| 技术约束 | CLI 使用 Bun 运行时（与项目一致） |
| 技术约束 | Dashboard 使用 Next.js（现有前端基础） |
| 技术约束 | SDK 必须同时支持 Node.js 和浏览器环境 |
| 依赖约束 | 数据依赖 Indexer REST API |
| 依赖约束 | 链上操作依赖 Solana devnet/mainnet RPC |
| 资源约束 | 单人开发 + AI 辅助 |

---

## 1.8 与 AgentM 的边界

| 能力 | AgentM (用户端) | AgentM Pro (开发者端) |
|------|----------------|---------------------|
| 登录方式 | Google OAuth | API Key / Keypair |
| 主要界面 | 桌面 IM | CLI + Web Dashboard |
| 找 Agent | ✅ | ❌ |
| 发布任务 | ✅ UI | ✅ CLI / API |
| SDK 集成 | ❌ | ✅ 核心功能 |
| Agent 框架 | ❌ | ✅ 模板/一键部署 |
| 共享内核 | @gradience/sdk + Indexer API |

---

## ✅ Phase 1 验收标准

- [x] 1.1–1.8 所有必填部分已完成
- [x] 用户故事 ≥ 5 个（共 11 个，含部署/SDK/框架三个维度）
- [x] 「不做什么」已明确
- [x] 成功标准可量化（5 项指标）
- [x] 与 AgentM 边界清晰
- [x] 现有代码映射已标明
