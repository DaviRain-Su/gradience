# Phase 2: Architecture — AgentM Pro

> **目的**: 定义 AgentM Pro 的系统架构和组件职责
> **输入**: `apps/agentm-pro/docs/01-prd.md`
> **输出物**: 本文档

---

## 2.1 系统总览

AgentM Pro 不是从零构建，而是整合现有工具链组件并提供统一的开发者体验。

```
┌─────────────────────────────────────────────────────────────┐
│                    AgentM Pro                                │
│                                                              │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ CLI      │  │ Web Dashboard│  │ Agent Template System  │ │
│  │ gradience│  │ Next.js      │  │ create-agent           │ │
│  └────┬─────┘  └──────┬───────┘  └────────────┬───────────┘ │
│       │               │                        │             │
│  ┌────▼───────────────▼────────────────────────▼───────────┐ │
│  │              @gradience/sdk (TypeScript)                 │ │
│  │  task.post / apply / submit / judge / cancel / refund   │ │
│  │  reputation.get / judgePool.list / attestations.list    │ │
│  └────────────────────┬────────────────────────────────────┘ │
└───────────────────────┼──────────────────────────────────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
   ┌──────────┐  ┌──────────┐  ┌──────────────┐
   │ Solana   │  │ Indexer  │  │ Judge Daemon │
   │ Program  │  │ REST API │  │ Workflow     │
   │ (on-chain│  │ (off-chain│ │ Engine       │
   └──────────┘  └──────────┘  └──────────────┘
```

---

## 2.2 组件职责

### CLI (`@gradience/cli`)

**位置**: `apps/agent-arena/cli/gradience.ts` (881 LOC)
**运行时**: Bun
**职责**: 开发者通过命令行完成所有链上操作

| 命令组 | 命令 | 说明 |
|--------|------|------|
| `config` | `set rpc`, `set keypair` | 配置 RPC 和钱包 |
| `task` | `post`, `apply`, `submit`, `judge`, `cancel`, `refund`, `status` | 任务全生命周期 |
| `judge` | `register`, `unstake` | Judge 管理 |

**特性**: NO_DNA 模式（`NO_DNA=1` 时输出结构化 JSON，适配 Agent 自动化）

### SDK (`@gradience/sdk`)

**位置**: `apps/agent-arena/clients/typescript/src/sdk.ts` (1506 LOC)
**运行时**: Node.js / 浏览器
**职责**: TypeScript API 封装所有链上指令和 Indexer 查询

| 模块 | 方法 | 说明 |
|------|------|------|
| `task` | `post`, `apply`, `submit`, `judge`, `cancel`, `refund` | 任务指令 |
| `reputation` | `get`, `getOnChain` | 声誉查询（Indexer + 链上） |
| `judgePool` | `list` | Judge 池查询 |
| `attestations` | `list`, `listDecoded`, `decode` | SAS Attestation |
| `config` | `get` | 链上配置查询 |

**钱包适配器**: `KeypairAdapter`（开发测试）, `PrivyAdapter` / `OKXAdapter`（存根）

### Web Dashboard

**位置**: `apps/agent-arena/frontend/` (12 files, Next.js)
**职责**: Agent 监控面板

| 页面 | 路由 | 功能 |
|------|------|------|
| 任务列表 | `/` | 浏览所有任务（状态/分类筛选） |
| 任务详情 | `/tasks/[taskId]` | 提交列表、评判按钮 |
| 发布任务 | 内嵌表单 | 填写参数 → SDK `task.post()` |

**钱包**: 注入式钱包 (`injected-wallet.ts`) + 本地签名 (`use-local-signer.ts`)

### Indexer

**位置**: `apps/agent-arena/indexer/` (Rust + PostgreSQL)
**职责**: 链上事件索引 → REST API + WebSocket

| 端点 | 说明 |
|------|------|
| `GET /api/tasks` | 任务列表（筛选/分页） |
| `GET /api/tasks/:id` | 单个任务 |
| `GET /api/tasks/:id/submissions` | 提交列表 |
| `GET /api/agents/:pubkey/reputation` | Agent 声誉 |
| `GET /api/judge-pool/:category` | Judge 池 |
| `GET /ws` | WebSocket 实时事件 |

### Judge Daemon

**位置**: `apps/agent-arena/judge-daemon/` (TypeScript, 35 tests)
**职责**: 自动化评判工作流

| 模式 | 评判方式 |
|------|---------|
| Type A | 人工（CLI 输入分数） |
| Type B | AI（DSPy LLM 评分） |
| Type C-1 | 测试用例（WASM 沙箱执行） |

---

## 2.3 数据流

### 开发者发布任务

```
CLI: gradience task post --reward 1000 --category defi
  │
  ▼
SDK: task.post(wallet, { reward: 1000, category: 1, ... })
  │
  ▼
Solana: post_task instruction → Task PDA + Escrow PDA created
  │
  ▼
Indexer: webhook → parse TaskCreated event → insert tasks table
  │
  ▼
Dashboard: GET /api/tasks → 显示新任务
```

### Agent 自动接任务

```
Agent (NO_DNA mode):
  gradience task status 42  →  {"state":"open","submissionCount":0}
  gradience task apply 42   →  {"signature":"..."}
  gradience task submit 42 --result-ref "cid://..." →  {"signature":"..."}
```

### Dashboard 查看收入

```
Dashboard: GET /api/agents/{pubkey}/reputation
  → { avg_score: 85, completed: 12, total_earned: 50_000_000 }
```

---

## 2.4 部署架构

```
开发环境（本地）:
  Solana: devnet / Surfpool local validator
  Indexer: docker-compose up (PostgreSQL + Indexer binary)
  Dashboard: npm run dev (localhost:3000)
  CLI: npx @gradience/cli

生产环境:
  Solana: mainnet-beta
  Indexer: Cloudflare Workers + D1 (或 Self-hosted Docker)
  Dashboard: Vercel / Cloudflare Pages
  CLI: npm i -g @gradience/cli
```

---

## 2.5 技术栈

| 层 | 技术 | 理由 |
|----|------|------|
| CLI | Bun + TypeScript | 与项目一致，启动快 |
| SDK | TypeScript (ESM) | 浏览器 + Node.js 双端 |
| Dashboard | Next.js + Tailwind | 现有基础 |
| Indexer | Rust + Axum + PostgreSQL | 性能，已实现 |
| Judge Daemon | TypeScript + Absurd | 工作流引擎 |

---

## 2.6 与 AgentM 的集成点

| 集成层 | 说明 |
|--------|------|
| `@gradience/sdk` | AgentM 和 AgentM Pro 共用同一个 SDK |
| Indexer API | AgentM 的 `indexer-api.ts` 和 Pro Dashboard 都调同一个 Indexer |
| A2A Protocol | AgentM 的消息通过 A2A 发送，Pro 的 Agent 通过 A2A 响应 |

两个产品的数据完全互通，用户在 AgentM 发布的任务，开发者在 AgentM Pro 可以看到并操作。

---

## ✅ Phase 2 验收标准

- [x] 系统总览图清晰展示组件关系
- [x] 每个组件职责明确
- [x] 数据流覆盖核心场景
- [x] 部署架构已定义
- [x] 与 AgentM 的集成点已标明
