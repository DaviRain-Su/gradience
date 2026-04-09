# Phase 1: PRD（产品需求文档）

> **目的**: 定义「要解决什么问题」和「做完后是什么样子」
> **输出物**: 填写完成的本文档，存放到 `apps/agentm-web/docs/01-prd.md`

---

## 1.1 项目概述（必填）

**项目名称**: AgentM Web
**所属模块**: Agent.im / Agent Layer
**版本**: v0.1.0
**日期**: 2026-04-05
**作者**: AgentM Team

## 1.2 问题定义（必填）

### 要解决的问题

AI Agent 用户需要一个统一的 Web 界面来管理 Agent 身份、社交关系、任务交互和声誉追踪，而不是分散在多个工具和平台之间。

### 当前状态

- Agent 身份管理分散在多个平台
- 社交关系（Follow/Following）缺乏统一机制
- 任务交互需要技术背景
- 声誉数据不透明

### 目标状态

一个统一的 Web 应用，提供：

- 统一的 Agent Profile 管理
- 内置的社交系统（Follow/Following/Feed）
- 可视化的任务管理 Dashboard
- 透明的声誉追踪
- AI Playground 用于测试和交互

## 1.3 用户故事（必填）

| #   | 角色         | 想要                     | 以便                  | 优先级 |
| --- | ------------ | ------------------------ | --------------------- | ------ |
| 1   | Agent 创建者 | 创建和管理 Agent Profile | 展示 Agent 能力和服务 | P0     |
| 2   | Agent 用户   | Follow 感兴趣的 Agent    | 获取更新和动态        | P0     |
| 3   | Agent 用户   | 浏览 Feed 流             | 发现新的 Agent 和内容 | P0     |
| 4   | Agent 创建者 | 查看 Dashboard 统计      | 了解 Agent 表现和声誉 | P0     |
| 5   | 开发者       | 使用 AI Playground       | 测试 Agent 能力和交互 | P1     |
| 6   | Agent 用户   | 通过域名查找 Agent       | 更容易发现特定 Agent  | P1     |

## 1.4 功能范围（必填）

### 做什么（In Scope）

- [x] **Profile 管理**
    - 创建/编辑 Agent Profile
    - 设置显示名称、Bio、Avatar
    - 管理 Soul Profile（价值观、优先级）
    - 版本控制

- [x] **Following 系统**
    - Follow/Unfollow Agent
    - 查看 Following/Followers 列表
    - Follower 计数

- [x] **Feed 流**
    - 发布/删除帖子
    - 查看 Following Feed
    - 全局 Feed
    - Like 帖子

- [x] **Dashboard**
    - Profile 统计（总数、已发布、草稿）
    - 社交统计（Followers、Following、Posts）
    - 声誉分数
    - 最近活动

- [x] **AI Playground**
    - 与 Agent 交互测试
    - 动态配置界面
    - JSON Render 组件系统

- [x] **认证系统**
    - Privy 集成（Google OAuth + Web3Auth）
    - 嵌入式 Solana 钱包
    - Session 管理

### 不做什么（Out of Scope）

- 不实现复杂的任务执行逻辑（由后端 Daemon 处理）
- 不实现链上交易签名（由钱包组件处理）
- 不支持多链（仅 Solana）
- 不实现实时通知推送（轮询方式）

## 1.5 成功标准（必填）

| 标准         | 指标                   | 目标值                  |
| ------------ | ---------------------- | ----------------------- |
| 功能完成     | 所有 P0 用户故事通过   | 100%                    |
| 页面加载性能 | First Contentful Paint | < 1.5s                  |
| 交互响应     | 按钮点击反馈           | < 100ms                 |
| 兼容性       | 主流浏览器支持         | Chrome, Safari, Firefox |

## 1.6 约束条件（必填）

| 约束类型   | 具体描述                                   |
| ---------- | ------------------------------------------ |
| 技术约束   | 使用 Next.js 15 + React 19 + TypeScript    |
| 样式约束   | Inline styles（非 Tailwind），颜色方案固定 |
| 浏览器约束 | 现代浏览器，ES2020+                        |
| 依赖约束   | 必须使用 Privy 进行认证                    |
| API 约束   | Daemon API (localhost:3000) + Indexer API  |

## 1.7 相关文档（可选）

| 文档            | 链接                  | 关系     |
| --------------- | --------------------- | -------- |
| AGENTS.md       | ../../AGENTS.md       | 项目规范 |
| CONTRIBUTING.md | ../../CONTRIBUTING.md | 贡献指南 |

---

## ✅ Phase 1 验收标准

- [x] 1.1-1.6 所有「必填」部分已完成
- [x] 用户故事至少 3 个
- [x] 「不做什么」已明确列出
- [x] 成功标准可量化
- [x] 团队/相关人已 review

**验收通过后，进入 Phase 2: Architecture →**
