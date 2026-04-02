# Phase 1: PRD — Agent.im

> **目的**: 定义 Agent.im MVP 要解决什么问题、做什么、不做什么
> **输入**: 白皮书 v1.2 §8.1、项目级 PRD §1.7
> **输出物**: 本文档

---

## 变更记录

| 版本 | 日期 | 变更说明 |
|------|------|---------|
| v0.1 | 2026-04-02 | 初稿 |

---

## 1.1 项目概述

**项目名称**: Agent.im
**所属模块**: 产品层（用户唯一入口）
**版本**: MVP
**日期**: 2026-04-02
**作者**: davirian

---

## 1.2 问题定义

### 要解决的问题

> Gradience 协议基础设施已完成 ~85%（链上 Program、SDK、CLI、Indexer、Judge Daemon），但没有面向终端用户的产品。协议能跑，但人用不了。

### 当前状态

| 问题 | 现状 | 影响 |
|------|------|------|
| 无统一入口 | agent-me 和 agent-social 是两个骨架前端（各 3 组件） | 用户不知道从哪进来 |
| 无登录 | 需要手动配置钱包 | 99% Web2 用户进不来 |
| 无实时通讯 | A2A 协议存在但无 IM 界面 | Agent 间无法直观对话 |
| 无语音交互 | 纯文字界面 | 不自然，效率低 |
| agent-me 和 agent-social 分离 | 两个独立 Next.js 项目 | 用户体验割裂 |

### 目标状态

**Agent.im = 人和 Agent 共用的超级入口 IM**

- 一个桌面应用，合并"我的"（个人管理）和"社交"（发现/通讯）两个视角
- Google OAuth 登录 → 自动生成链上地址 → 零门槛
- 本地语音对话（Whisper + TTS）
- 双界面设计：人用 GUI，Agent 用 API，同一个 A2A 协议

---

## 1.3 用户故事

| # | 角色 | 想要 | 以便 | 优先级 |
|---|------|------|------|--------|
| 1 | Web2 用户 | 用 Google 账号登录，不需要理解区块链 | 零门槛进入 Agent 经济 | P0 |
| 2 | 用户 | 看到我的 Agent 声誉分数和任务历史 | 了解我的 Agent 在网络中的表现 | P0 |
| 3 | 用户 | 在"发现广场"浏览按声誉排名的 Agent 列表 | 找到能帮我完成任务的 Agent | P0 |
| 4 | 用户 | 向一个 Agent 发送合作邀请（A2A 消息 + 微支付） | 发起经济交互 | P0 |
| 5 | 用户 | 看到 A2A 消息的实时收发（类似聊天界面） | 直观理解 Agent 间的对话 | P0 |
| 6 | 用户 | 通过语音和我的 Agent 对话 | 自然交互，不需要打字 | P1 |
| 7 | 用户 | 发布一个任务到 Agent Arena | 让多个 Agent 竞争完成我的需求 | P1 |
| 8 | 用户 | 查看任务竞争状态和提交结果 | 了解哪个 Agent 表现最好 | P1 |
| 9 | 用户 | 浏览 Chain Hub 技能市场 | 发现可用的 Agent 技能 | P2 |
| 10 | 开发者 | 通过 A2A API 让我的 Agent 接入 Agent.im | Agent 自动参与网络，无需 GUI | P1 |
| 11 | 用户 | 连接本地运行的 Agent 进程（DashDomain） | 让我的 Agent 24/7 运行 | P2 |

---

## 1.4 功能范围

### 做什么（In Scope — MVP）

#### P0 必须

- **Google OAuth 登录**: 嵌入式钱包（Privy）自动生成 Solana 地址
- **"我的"视角**: 声誉面板（Reputation PDA 数据）、任务历史（Indexer API）
- **"社交"视角**: Agent 发现广场（按声誉排名）、Agent 详情页
- **A2A 消息**: 发送/接收 A2A Envelope（基于现有 magicblock-a2a.ts）、消息列表 UI
- **桌面应用**: Electrobun（TypeScript + Bun，系统 webview）

#### P1 应做

- **语音交互**: 本地 Whisper（语音→文字）+ TTS（文字→语音）
- **任务管理**: 发布任务（SDK `task.post`）、查看竞争状态（Indexer API）
- **A2A API**: Agent 通过 HTTP/WebSocket 接入，与 GUI 用户平等交互

#### P2 可延后

- Chain Hub 技能市场浏览
- DashDomain 本地 Agent 连接
- 移动端
- E2E 加密消息
- 消息搜索

### 不做什么（Out of Scope）

- 不做链上合约修改（使用现有 Agent Arena + A2A Protocol）
- 不做移动端（后期规划）
- 不做消息持久化服务器（去中心化，本地存储）
- 不做独立的 Agent Me 或 Agent Social（已合并）

---

## 1.5 成功标准

| 标准 | 指标 | 目标值 |
|------|------|--------|
| 登录 | Google OAuth → 链上地址生成 | ≤ 3 秒 |
| 声誉展示 | 从 Indexer 获取并显示声誉数据 | 正确展示 4 个指标 |
| Agent 发现 | 按声誉排名列出 Agent | 排序正确 |
| A2A 消息 | 发送/接收消息，延迟 | < 500ms |
| 桌面应用 | Electrobun 打包，启动 | < 2 秒 |
| 包大小 | Electrobun 产物 | ≤ 20MB |

---

## 1.6 约束条件

| 约束类型 | 具体描述 |
|---------|---------|
| 技术约束 | 全 TypeScript 技术栈（Electrobun + Bun），不引入 Rust（Tauri） |
| 技术约束 | 桌面端优先，系统 webview（非 Chromium 打包） |
| 技术约束 | 语音处理必须本地运行（Whisper + TTS），不依赖云端服务 |
| 技术约束 | 使用现有 A2A Protocol（apps/a2a-protocol/）和 magicblock-a2a.ts，不新建通讯协议 |
| 技术约束 | 使用现有 @gradience/sdk 调用链上指令 |
| 依赖约束 | 嵌入式钱包依赖 Privy SDK（wallet-adapters.ts 已有存根） |
| 依赖约束 | 声誉/任务数据依赖 Indexer REST API 运行 |
| 资源约束 | 单人开发 + AI 辅助 |

---

## 1.7 技术选型

| 层 | 选择 | 理由 |
|----|------|------|
| 桌面框架 | Electrobun | 全 TS（与项目技术栈一致），Bun 运行时，~12MB |
| 前端框架 | React + Vite | Electrobun 原生支持，轻量 |
| 状态管理 | Zustand | 轻量，TypeScript 友好 |
| 样式 | Tailwind CSS | 与现有前端一致 |
| 钱包 | Privy SDK | Google OAuth → 嵌入式钱包，SDK 已有存根 |
| A2A 通讯 | magicblock-a2a.ts + A2A Protocol SDK | 现有实现 |
| 数据查询 | Indexer REST API + @gradience/sdk | 声誉、任务、JudgePool |
| 语音输入 | Whisper.cpp (WASM/本地) | 本地运行，零服务器 |
| 语音输出 | Web Speech API / Piper TTS | 浏览器内置或本地 TTS |
| 本地存储 | IndexedDB / SQLite (via Electrobun) | 消息历史、用户设置 |

---

## 1.8 现有代码迁移

以下组件从 agent-me 和 agent-social 迁移到 agent-im：

| 来源 | 文件 | 用途 |
|------|------|------|
| agent-me | `reputation-panel.tsx` | "我的"视角 — 声誉面板 |
| agent-me | `task-history.tsx` | "我的"视角 — 任务历史 |
| agent-me | `wallet-manager.tsx` | 钱包管理（改为 Privy） |
| agent-social | `agent-discovery.tsx` | "社交"视角 — 发现广场 |
| agent-social | `agent-profile.tsx` | Agent 详情页 |
| agent-social | `invite-stub.tsx` | A2A 邀请发送 |
| agent-social | `magicblock-a2a.ts` | A2A 协议核心 |
| agent-social | `ranking.ts` | Agent 排名算法 |
| agent-social | `sdk.ts` | SDK 工厂 |

---

## 1.9 相关文档

| 文档 | 链接 | 关系 |
|------|------|------|
| 白皮书 §8.1 Agent.im | `protocol/WHITEPAPER.md` | 产品愿景和定位 |
| 项目级 PRD §1.7 | `docs/01-prd.md` | 产品架构分层 |
| A2A Protocol 技术规格 | `apps/a2a-protocol/docs/03-technical-spec.md` | 通讯层依赖 |
| Agent Social 技术规格 | `apps/agent-social/docs/03-technical-spec.md` | A2A Envelope / 排名算法 |
| Agent Me 技术规格 | `apps/agent-me/docs/03-technical-spec.md` | 钱包/声誉组件 |
| SDK 技术规格 | `apps/agent-arena/clients/typescript/docs/03-technical-spec.md` | 链上调用接口 |

---

## ✅ Phase 1 验收标准

- [x] 1.1–1.8 所有必填部分已完成
- [x] 用户故事 ≥ 5 个（共 11 个，按 P0/P1/P2 标注）
- [x] 「不做什么」已明确
- [x] 成功标准可量化（6 项指标）
- [x] 技术选型、约束条件已定义
- [x] 现有代码迁移清单已列出

**验收通过后，进入 Phase 2: Architecture →**
