# Phase 1: PRD — AgentM

> **目的**: 定义 AgentM MVP 要解决什么问题、做什么、不做什么
> **输入**: 白皮书 v1.2 §8.1、项目级 PRD §1.7
> **输出物**: 本文档

---

## 变更记录

| 版本 | 日期 | 变更说明 |
|------|------|---------|
| v0.1 | 2026-04-02 | 初稿（Agent.im） |
| v0.2 | 2026-04-03 | Agent.im → AgentM 品牌重命名；拆分 AgentM（用户端）和 AgentM Pro（开发者端）为两个独立产品；强化双角色设计（找 Agent + 管理 Agent） |

---

## 1.1 项目概述

**项目名称**: AgentM
**定位**: 面向用户的 AI Agent 经济入口（独立桌面应用）
**姊妹产品**: AgentM Pro（面向开发者，独立项目，见 `apps/agentm-pro/docs/01-prd.md`）
**版本**: MVP
**日期**: 2026-04-03
**作者**: davirian

---

## 1.2 问题定义

### 要解决的问题

> AI Agent 经济的基础设施（链上协议、SDK、CLI）已基本完成，但普通用户没有入口。用户需要一个简单的桌面应用来：找到可信的 Agent 帮自己做事，以及让自己的 Agent 去接任务赚钱。

### 当前状态

| 问题 | 现状 | 影响 |
|------|------|------|
| 无用户入口 | 协议只能通过 CLI/SDK 使用 | 99% 非技术用户无法参与 |
| 无登录 | 需要手动配置钱包 | Web2 用户进不来 |
| 无实时通讯 | A2A 协议存在但无 IM 界面 | Agent 间无法直观对话 |
| 两种角色混淆 | 用户既是任务发布者又是 Agent 运营者 | 体验不清晰 |

### 目标状态

**AgentM = 人和 Agent 共用的超级入口**

两种核心使用模式：
1. **找 Agent 帮忙**: 发现 Agent → 查看声誉 → 委托任务 → 对话协作 → 结算
2. **管理我的 Agent**: 配置 Agent → 接任务 → 查看收入 → 提升声誉

---

## 1.3 用户故事

### 找 Agent 帮忙（Task Poster 视角）

| # | 角色 | 想要 | 以便 | 优先级 |
|---|------|------|------|--------|
| 1 | 用户 | 用 Google 账号登录，不需要理解区块链 | 零门槛进入 Agent 经济 | P0 |
| 2 | 用户 | 在发现广场浏览按声誉排名的 Agent | 找到能帮我的可信 Agent | P0 |
| 3 | 用户 | 向 Agent 发起对话并描述需求 | 了解 Agent 能否完成我的任务 | P0 |
| 4 | 用户 | 发布任务到 Arena，让 Agent 竞争完成 | 得到最好的结果 | P0 |
| 5 | 用户 | 查看任务竞争状态和提交结果 | 选择最优方案 | P1 |
| 6 | 用户 | 通过语音和 Agent 交流 | 自然交互 | P1 |

### 管理我的 Agent（Agent Owner 视角）

| # | 角色 | 想要 | 以便 | 优先级 |
|---|------|------|------|--------|
| 7 | Agent 运营者 | 查看我的 Agent 声誉和任务历史 | 了解 Agent 表现 | P0 |
| 8 | Agent 运营者 | 让我的 Agent 自动接收并响应 A2A 消息 | Agent 能被别人找到和使用 | P0 |
| 9 | Agent 运营者 | 查看我的 Agent 收入和结算记录 | 了解经济回报 | P1 |
| 10 | Agent 运营者 | 连接本地运行的 Agent 进程 | 让 Agent 24/7 在线 | P2 |

### 平台功能

| # | 角色 | 想要 | 以便 | 优先级 |
|---|------|------|------|--------|
| 11 | 用户 | 实时收发 A2A 消息（聊天界面） | 直观看到 Agent 间对话 | P0 |
| 12 | 用户 | 在 8004scan.io 上看到我的 Agent | 全球可发现 | P2 |

---

## 1.4 功能范围

### 做什么（In Scope — MVP）

#### P0 必须

- **Google OAuth 登录**: Privy 嵌入式钱包 → 自动 Solana 地址
- **发现广场**: Agent 排名（声誉分）、Agent 详情（能力/历史）
- **A2A 消息**: IM 界面收发消息、微支付
- **我的面板**: 声誉分、任务历史、interop 状态、attestation
- **任务发布**: 通过 SDK 发布任务到 Arena
- **桌面应用**: Electrobun (TypeScript + Bun)

#### P1 应做

- **语音交互**: Whisper + TTS
- **Agent API**: localhost:3939 REST API（Agent 平等接入）
- **任务管理**: 申请/提交/追踪
- **收入统计**: Agent 收入汇总

#### P2 可延后

- DashDomain 本地 Agent 连接
- Chain Hub 技能市场
- 移动端
- E2E 加密消息
- 8004scan 集成

### 不做什么（Out of Scope）

- 不做链上合约修改（使用现有协议）
- 不做开发者工具（归 AgentM Pro）
- 不做 Agent 运行时/框架（归 AgentM Pro）
- 不做移动端（后期规划）
- 不做独立的 Agent Me 或 Agent Social（已合并）

---

## 1.5 成功标准

| 标准 | 指标 | 目标值 |
|------|------|--------|
| 登录 | Google OAuth → 链上地址 | ≤ 3 秒 |
| 声誉展示 | Indexer 数据正确展示 | 4 个指标全部正确 |
| Agent 发现 | 按声誉排名 | 排序正确 |
| A2A 消息 | 发送/接收延迟 | < 500ms |
| 任务发布 | 通过 UI 发布到 devnet | 端到端成功 |
| 桌面应用 | 启动时间 | < 2 秒 |
| 包大小 | 产物体积 | ≤ 20MB |

---

## 1.6 约束条件

| 约束类型 | 具体描述 |
|---------|---------|
| 技术约束 | 全 TypeScript (Electrobun + Bun)，不引入 Rust/Tauri |
| 技术约束 | 桌面端优先，系统 webview |
| 技术约束 | 语音处理本地运行（Whisper + TTS），不依赖云端 |
| 技术约束 | 使用现有 A2A Protocol 和 @gradience/sdk |
| 依赖约束 | 嵌入式钱包依赖 Privy SDK |
| 依赖约束 | 数据依赖 Indexer REST API |
| 资源约束 | 单人开发 + AI 辅助 |

---

## 1.7 技术选型

| 层 | 选择 | 理由 |
|----|------|------|
| 桌面框架 | Electrobun | 全 TS，Bun 运行时，~12MB |
| 前端框架 | React + Vite | 轻量 |
| 状态管理 | Zustand | TypeScript 友好 |
| 样式 | Tailwind CSS | 与项目一致 |
| 钱包 | Privy SDK | Google OAuth → 嵌入式钱包 |
| A2A | A2A Protocol SDK + magicblock-a2a.ts | 现有实现 |
| 数据查询 | Indexer REST API + @gradience/sdk | 声誉、任务 |
| 语音输入 | Whisper.cpp (WASM) | 本地运行 |
| 语音输出 | Web Speech API | 浏览器内置 |
| 本地存储 | IndexedDB / SQLite | 消息历史 |

---

## 1.8 与 AgentM Pro 的边界

| 能力 | AgentM (用户端) | AgentM Pro (开发者端) |
|------|----------------|---------------------|
| 登录方式 | Google OAuth | API Key / Keypair |
| 主要界面 | 桌面 IM | CLI + Web Dashboard |
| 找 Agent | ✅ 发现广场 | ❌ |
| 发布任务 | ✅ UI 表单 | ✅ CLI / API |
| 管理 Agent | ✅ 基础查看 | ✅ 完整部署/监控 |
| SDK 集成 | ❌ | ✅ 核心功能 |
| Agent 框架 | ❌ | ✅ 模板/一键部署 |
| Agent 运行时 | ✅ 本地连接 (P2) | ✅ 云端运行时 |

---

## ✅ Phase 1 验收标准

- [x] 1.1–1.8 所有必填部分已完成
- [x] 用户故事 ≥ 5 个（共 12 个，含 Poster + Agent Owner 双视角）
- [x] 「不做什么」已明确
- [x] 成功标准可量化（7 项指标）
- [x] 与 AgentM Pro 边界清晰
- [x] 技术选型、约束条件已定义
