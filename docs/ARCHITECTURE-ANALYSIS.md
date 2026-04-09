# Gradience Protocol — 架构全景分析

**生成日期**: 2026-04-04  
**分析范围**: 全仓库（On-chain → Indexer → Daemon → Packages → Frontend）  
**状态**: 客观现状 + 问题清单

---

## 一、系统全景图

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                         GRADIENCE PROTOCOL                                   ║
║                    "AI Agent Work Marketplace on Solana"                     ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 4: 用户入口（Frontend Apps）                                          │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────┐  ┌─────────────┐  │
│  │   agentm-web     │  │   agentm-pro     │  │ website │  │  developer  │  │
│  │  (主用户 App)     │  │  (开发者 Dashboard)│  │ 落地页  │  │    docs     │  │
│  │  Next.js / Vercel│  │  Next.js / Vercel│  │ Next.js │  │  Mintlify   │  │
│  │  ~12,500 lines   │  │  ~8,000 lines    │  │ ~2,000  │  │  ~3,000     │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────┬────┘  └──────┬──────┘  │
│           │                     │                  │              │          │
│        Dynamic                Dynamic           Static         Static        │
│        Auth SDK               Auth SDK                                       │
└─────────────────────────────────────────────────────────────────────────────┘
           │                     │
           ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: 后端 (Agent Daemon)                                                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    agent-daemon (Fastify / TypeScript)               │    │
│  │                    localhost:7420  or  api.gradiences.xyz            │    │
│  │                                                                       │    │
│  │  ┌────────────┐  ┌────────────┐  ┌─────────────┐  ┌─────────────┐  │    │
│  │  │ auth/      │  │ social/    │  │  tasks/     │  │  a2a-router/│  │    │
│  │  │ SessionMgr │  │ SQLite DB  │  │  TaskQueue  │  │  Nostr+XMTP │  │    │
│  │  │ WalletSign │  │ profiles   │  │  Executor   │  │  (WIP)      │  │    │
│  │  └────────────┘  │ posts/feed │  └─────────────┘  └─────────────┘  │    │
│  │                  │ follows    │                                       │    │
│  │  ┌────────────┐  └────────────┘  ┌─────────────┐  ┌─────────────┐  │    │
│  │  │  solana/   │                  │  evaluator/ │  │  revenue/   │  │    │
│  │  │  TxManager │                  │  🔴 STUB    │  │  ⚪ TODO    │  │    │
│  │  │  RPC calls │                  │  (LLM Judge)│  │ (Rev share) │  │    │
│  │  └────────────┘                  └─────────────┘  └─────────────┘  │    │
│  └───────────────────────────────────────┬─────────────────────────────┘    │
│                                          │                                   │
│         SQLite (~/.agentd/)              │        ~14,389 lines TypeScript   │
└──────────────────────────────────────────┼──────────────────────────────────┘
                                           │
           ┌───────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: 基础设施 (Indexer + DB + Proxy)                                    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │              DigitalOcean Droplet (64.23.248.73)                      │   │
│  │                                                                       │   │
│  │  nginx ──▶ agent-daemon (port 4001) ──▶ api.gradiences.xyz           │   │
│  │         └▶ indexer      (port 3001) ──▶ api.gradiences.xyz/indexer/  │   │
│  │                                                                       │   │
│  │  ┌─────────────────────┐   ┌────────────┐   ┌────────────────────┐  │   │
│  │  │  indexer (Rust)      │   │ Postgres16 │   │  Redis 7           │  │   │
│  │  │  apps/chain-hub/    │   │ (indexed   │   │  (query cache)     │  │   │
│  │  │  indexer/           │   │  chain data│   │                    │  │   │
│  │  │  ⚠️ SEED DATA ONLY  │   │  ~seed)    │   │                    │  │   │
│  │  └─────────────────────┘   └────────────┘   └────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                          │                                   │
│                                          ▼ (planned, NOT connected yet)      │
│                                  Solana Devnet RPC                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 0: On-Chain Programs (Solana Devnet)                                  │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │   agent-arena    │  │   chain-hub      │  │     a2a-protocol         │   │
│  │  (2145 lines Rust)│  │ (1225 lines Rust)│  │   (1331 lines Rust)     │   │
│  │                   │  │                  │  │                          │   │
│  │  postTask()       │  │ registerProtocol │  │  upsertAgentProfile()   │   │
│  │  applyForTask()   │  │ registerSkill()  │  │  createThread()         │   │
│  │  submitResult()   │  │ delegationTask() │  │  openChannel()          │   │
│  │  judgeAndPay()    │  │ recordExecution()│  │  submitSubtaskBid()     │   │
│  │  cancelTask()     │  └──────────────────┘  └──────────────────────────┘   │
│  │  refundExpired()  │                                                        │
│  │  forceRefund()    │  ┌──────────────────┐  ┌──────────────────────────┐   │
│  └──────────────────┘  │   agentm-core    │  │  workflow-marketplace    │   │
│                         │  (523 lines Rust)│  │   (1846 lines Rust)     │   │
│  Fee: 95/3/2            │  registerUser()  │  │  publishWorkflow()      │   │
│  (Agent/Judge/Protocol) │  createAgent()   │  │  purchaseWorkflow()     │   │
│                         │  follow()        │  │  executeWorkflow()      │   │
│                         │  updateReputation│  └──────────────────────────┘   │
│                         └──────────────────┘                                  │
│                                                                              │
│  Total: ~7,070 lines Rust                                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: TypeScript SDK Packages                                            │
│  (consumed by daemon + frontend)                                             │
│                                                                              │
│  @gradiences/sdk          → arena.ts + chain-hub.ts + types (482 lines)    │
│  chain-hub-sdk            → GoldRush/Royalty/KeyVault (1331 lines)          │
│  workflow-engine          → composable workflows, trading handlers (9249)   │
│  soul-engine              → Jaccard matching, parser, probe (3350 lines)    │
│  cli                      → CLI commands for protocol (2068 lines)           │
│  domain-resolver          → SNS (.sol) + ENS (.eth) with cache (1079 lines) │
│  nostr-adapter            → Nostr relay client for A2A (532 lines)          │
│  xmtp-adapter             → XMTP messaging (WIP) (1155 lines)               │
│  a2a-types                → Shared TS types (343 lines)                     │
│                                                                              │
│  Total: ~19,589 lines TypeScript                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、agentm-web 用户入口流程图

> 这是用户的**主入口**，也是目前最需要关注的部分。

```
用户访问 agentm.gradiences.xyz
          │
          ▼
┌─────────────────────┐
│  / (landing page)   │  ← 静态落地页 app/page.tsx
│  "AgentM — Soul-    │    (无任何 Provider 包裹)
│  Powered Matching"  │
└──────────┬──────────┘
           │  用户点击 "Enter App" / "Get Started"
           ▼
┌──────────────────────────────────────────────┐
│  /app  layout.tsx                            │
│  ┌───────────────────────────────────────┐   │
│  │  ErrorBoundary                         │   │
│  │  └─ DynamicProvider                   │   │
│  │       (Dynamic Labs SDK — Solana)      │   │
│  │       └─ DaemonConnectionProvider     │   │
│  │            (自定义 wallet-sign auth)   │   │
│  └───────────────────────────────────────┘   │
└──────────┬───────────────────────────────────┘
           │
           ├──▶ /app/           (主 App 页面)
           ├──▶ /dashboard/     (统计面板)
           ├──▶ /discover/      (发现 Agents)
           ├──▶ /following/     (关注列表)
           ├──▶ /messages/      (消息 A2A)
           ├──▶ /profile/[id]/  (用户/Agent Profile)
           ├──▶ /profile/edit/  (编辑 Profile)
           ├──▶ /agents/create/ (创建 Agent)
           ├──▶ /settings/      (设置)
           ├──▶ /stats/         (统计)
           ├──▶ /token-launch/  (代币)
           ├──▶ /ows/           (OWS 钱包测试页)
           └──▶ /ai-playground/ (AI 沙盒)

AUTH FLOW:
  用户点击 "Connect Wallet"
      │
      ▼
  DynamicLoginButton → Dynamic Labs SDK 弹窗
      │  (Phantom / Solflare / Email 等)
      │
      ▼
  获取 walletAddress + signMessage 函数
      │
      ▼
  ConnectionContext.authenticate()
      │
      ├─ POST /auth/challenge  → daemon
      ├─ 用 wallet 签名 challenge
      └─ POST /auth/verify     → daemon → 返回 sessionToken
             │
             ▼
         localStorage 存储 session
         后续请求带 Authorization: Bearer <token>

DAEMON 连接探测:
  1. 尝试 localhost:7420/health   → 本地模式 (local)
  2. 失败 → 尝试 api.gradiences.xyz/health → 远程模式 (remote)
  3. 全失败 → daemonDetected=false (UI 仍可见但功能受限)
```

---

## 三、数据流图（核心场景）

### 场景 A：发布任务 (Post Task)

```
agentm-web                  agent-daemon              Solana Devnet
    │                            │                         │
    │  POST /api/tasks/post      │                         │
    ├──────────────────────────▶ │                         │
    │  { description, reward,    │  build tx               │
    │    deadline, category }    ├─────────────────────────▶
    │                            │  postTask() instruction  │
    │                            │  (escrow SOL)            │
    │  { txId, taskId }          ◀─────────────────────────┤
    ◀──────────────────────────  │                         │
    │                            │                         │
```

### 场景 B：Soul Profile 匹配

```
agentm-web           agent-daemon              soul-engine (package)
    │                     │                         │
    │  GET /api/matches   │                         │
    ├────────────────────▶│                         │
    │                     │  soulEngine.match()     │
    │                     ├────────────────────────▶│
    │                     │  Jaccard similarity      │
    │                     │  + comm distance         │
    │  [MatchResult[]]    ◀────────────────────────┤
    ◀────────────────────┤                         │
```

### 场景 C：A2A 消息发现 (Nostr)

```
agentm-web      agent-daemon       nostr-adapter        Nostr Relays
    │                │                   │                   │
    │  POST /a2a/    │                   │   4 relays        │
    │  discover      │                   │   configured      │
    ├───────────────▶│  A2ARouter.query  │                   │
    │                ├──────────────────▶│  REQ filter       │
    │                │                   ├──────────────────▶│
    │                │                   │  EVENT (profiles) │
    │  [AgentProfile]◀──────────────────┤◀──────────────────┤
    ◀───────────────┤                   │                   │
```

### 场景 D：Indexer 查询链上数据

```
agentm-web                   indexer (Rust)              Postgres16
    │                              │                         │
    │  GET /indexer/tasks?state=Open                         │
    ├─────────────────────────────▶│                         │
    │  (via api.gradiences.xyz)    │  SELECT * FROM tasks    │
    │                              ├────────────────────────▶│
    │  [Task[]]                    │  (seed data, NOT live)  │
    ◀─────────────────────────────┤◀────────────────────────┤

⚠️ 当前 indexer 仅有 seed data，NOT 连接真实 Solana devnet RPC！
```

---

## 四、组件依赖关系图

```
                    ┌─────────────────────────────────────────┐
                    │         pnpm workspace (turborepo)       │
                    └─────────────────────────────────────────┘

apps/agentm-web ────────────────────────────────────────────────▶ (无 monorepo 包依赖)
                 └─ 外部: @dynamic-labs/sdk-react-core
                          @dynamic-labs/solana
                          @privy-io/react-auth (在 deps 里但未使用?)
                          @farcaster/miniapp-sdk
                          @metaplex-foundation/...
                          @solana/wallet-adapter-*
                          @solana/web3.js

apps/agentm-pro ────────────────────────────────────────────────▶ (无 monorepo 包依赖)
                 └─ 组件与 agentm-web 大量重复 (PostCard, DomainBadge 等)

apps/agent-daemon ──▶ @gradiences/a2a-types
                   └─▶ @gradiences/nostr-adapter
                   └─▶ @gradiences/xmtp-adapter
                   └─ 外部: fastify, better-sqlite3, tweetnacl, bs58

packages/sdk ──▶ @solana/web3.js (直接与链交互)
packages/chain-hub-sdk ──▶ sdk (内部依赖)
packages/workflow-engine ──▶ sdk
packages/soul-engine ──▶ (独立，无内部依赖)
packages/nostr-adapter ──▶ nostr-tools
packages/xmtp-adapter ──▶ @xmtp/xmtp-js
packages/domain-resolver ──▶ @bonfida/spl-name-service, @ensdomains/...

programs/ ──▶ Solana / Anchor (Rust, 独立 Cargo workspace)
```

---

## 五、当前问题清单 🔍

### 🔴 严重问题 (P0 — 影响核心功能)

#### 1. Indexer 没有连接真实链数据

- **位置**: `apps/chain-hub/indexer/`
- **问题**: 只有 seed data，没有接入 Solana devnet RPC。用户在 agentm-web 看到的任务/Agent 数据是假数据。
- **影响**: 整个任务市场 UI 显示虚假内容
- **修复**: 接入 `SOLANA_RPC_ENDPOINT`，实现事件监听和状态同步

#### 2. Auth 体系双轨并存，逻辑混乱

- **位置**: `apps/agentm-web/src/lib/`
- **问题**: 同时存在两套 auth：
    - `DynamicProvider` (Dynamic Labs SDK — 外部 OAuth/Wallet)
    - `ConnectionContext` (自定义 challenge-sign-verify 到 daemon)
    - 还有 `OWS passkey-wallet`、`usePasskeyWallet`
    - `@privy-io/react-auth` 在依赖里但没有找到使用
- **影响**: 新用户完全不清楚该走哪条认证路径；session 管理和 wallet 状态分散在两套系统里
- **修复**: 选定一套 auth（推荐 Dynamic），把 daemon session 作为 Dynamic auth 后续的第二步验证

#### 3. agentm-pro 是空壳

- **位置**: `apps/agentm-pro/`
- **问题**: 只有 `/` 和 `/app` 两个页面，大量组件（PostCard, DomainBadge, DomainInput, ProfileForm, PostComposer, NotificationBell 等）直接从 agentm-web 复制粘贴
- **影响**: 实际上没有"开发者 Dashboard"功能；代码重复维护成本高
- **修复**: 要么明确 agentm-pro 的差异定位（agent analytics / revenue dashboard），要么合并到 agentm-web 的 `/pro` 路由下

#### 4. 本地 daemon 模式对普通用户不可行

- **位置**: `apps/agentm-web/src/lib/connection/ConnectionContext.tsx`
- **问题**: 默认连接 `localhost:7420`。普通 Web 用户不会在本地跑一个 `agentd` 进程。虽然有 remote fallback，但探测逻辑先试本地再试远程，增加延迟和用户困惑。
- **影响**: 首次加载有明显延迟；"Daemon not detected" 警告让用户迷惑
- **修复**: 对 Web 部署，默认直接用 remote API；local daemon 模式改为可选配置项

---

### 🟠 重要问题 (P1 — 影响体验)

#### 5. `evaluator/` 是纯 stub，LLM-as-Judge 未实现

- **位置**: `apps/agent-daemon/src/evaluator/`
- **问题**: 目录存在但只有骨架代码。judgeAndPay 链上合约已有，但链下评估逻辑（LLM 评分）完全没有
- **影响**: Task 结算流程只能手动调用，无法自动化

#### 6. `revenue/` 目录根本不存在

- **位置**: `apps/agent-daemon/src/revenue/` (ARCHITECTURE.md 中提到，实际不存在)
- **问题**: 白皮书的收益分配逻辑未实现。`workflow-engine/src/revenue-share.ts` 有部分代码但未接入 daemon
- **影响**: 工作流收益分成是核心商业逻辑，目前是空白

#### 7. agentm-web 的 `/app/app/page.tsx` 路由结构异常

- **位置**: `apps/agentm-web/src/app/app/`
- **问题**: 存在 `/app` 和 `/app/app` 两层嵌套。`/app/app/layout.tsx` 包裹了 DynamicProvider，而 `/app/app/page.tsx` 是真正的主应用，但路由变成了 `/app/app` 而不是 `/app`
- **影响**: URL 结构混乱（`agentm.gradiences.xyz/app/app`?），路由层级不清晰

#### 8. Privy 依赖引入但未使用

- **位置**: `apps/agentm-web/package.json`
- **问题**: `@privy-io/react-auth` 在依赖中存在，但代码里没有 `PrivyProvider`
- **影响**: 增加 bundle size（~200KB+），引起维护困惑

#### 9. workflow-engine 9249 行但大量是 stub

- **位置**: `packages/workflow-engine/src/handlers/`
- **问题**: `trading.ts`, `trading-real.ts`, `payment.ts` 的 handlers 有实现框架，但 triton-cascade 等核心执行路径是占位符
- **影响**: CLI 工具宣称的"composable workflows"实际无法运行

#### 10. xmtp-adapter WIP，A2A 消息仅靠 Nostr

- **位置**: `packages/xmtp-adapter/`
- **问题**: XMTP adapter 测试文件存在但实现不完整；daemon 里 A2A 使用 Nostr relay 但无真实 Agent 注册
- **影响**: A2A 消息功能在当前环境下无法演示真实对话

---

### 🟡 优化问题 (P2 — 技术债)

#### 11. 组件重复：agentm-web 和 agentm-pro 共享大量 UI

- PostCard, DomainBadge, DomainInput, ProfileForm, PostComposer, SoulProfileCard 等在两个 app 里各自有一份
- **修复**: 提取到 `packages/ui` 共享 UI 包

#### 12. ConnectionContext 中 `require()` 动态导入反模式

- 部分 hooks（`useFeed`, `useProfile`）用 `try { require() } catch {}` 模式导入 ConnectionContext
- **修复**: 统一用 `useDaemonConnection` hook，已有但未全面推广

#### 13. Database 类型用 `any` (daemon)

- `apps/agent-daemon/src/api/routes/social.ts` 使用自定义 Database 接口而非 better-sqlite3 的类型
- **修复**: 引入 `@types/better-sqlite3` 正式类型

#### 14. Bundle size 789KB，超出 500KB 目标

- **位置**: agentm-web
- 原因: Privy（未使用）、Dynamic SDK、多个 Solana adapter 同时引入
- **修复**: 移除 Privy，Dynamic SDK 懒加载

#### 15. Rate limiting 未实现

- **位置**: `apps/agent-daemon/src/api/`
- auth 端点无速率限制，存在暴力破解风险
- **修复**: Fastify rate-limit 插件

#### 16. Vercel 未连接 Git，需手动部署

- agentm-web 无法自动 CI/CD，每次需手动 `npx vercel --prod`
- **修复**: 在 Vercel 项目设置里连接 GitHub repo

#### 17. agentm-core 命名混淆

- `apps/agentm-core/` 下只有 `program/` 和 `sdk/`（Rust on-chain 程序+SDK），不是一个 Web app
- 与 `programs/agentm-core/`（另一个 Rust 程序）名字重叠，容易混淆
- **修复**: 考虑重命名，明确 `apps/agentm-core/` 是"agentm-core Solana program + TS SDK"的 workspace 聚合

---

## 六、模块实现完成度一览

```
On-Chain Programs
  agent-arena          ████████████████████  100% ✅
  chain-hub            ████████████████████  100% ✅
  a2a-protocol         ████████████████████  100% ✅
  agentm-core          ████████████████████  100% ✅
  workflow-marketplace ████████████████████  100% ✅

Infrastructure
  indexer (Rust)       ██████████░░░░░░░░░░   50% ⚠️  (seed data only, no live sync)
  nginx / deploy       ████████████████████  100% ✅
  Docker / DigitalOcean████████████████████  100% ✅

Backend (agent-daemon)
  auth / SessionManager████████████████████  100% ✅
  social (profiles/feed)██████████████████░   90% 🟡 (DB interface types rough)
  tasks / TaskQueue    ████████████████████  100% ✅
  solana / TxManager   ████████████░░░░░░░░   60% 🟠
  a2a-router (Nostr)   ████████████░░░░░░░░   60% 🟠 (no real agents)
  evaluator            ████░░░░░░░░░░░░░░░░   20% 🔴 (stub)
  revenue              ░░░░░░░░░░░░░░░░░░░░    0% ⚪ (not started)
  bridge               ░░░░░░░░░░░░░░░░░░░░    0% ⚪ (not started)

Packages
  sdk                  ████████████████████  100% ✅
  chain-hub-sdk        ████████████████████  100% ✅
  soul-engine          █████████████████░░░   85% 🟡
  domain-resolver      ████████████████████  100% ✅
  nostr-adapter        ████████████████░░░░   80% 🟡
  workflow-engine      ████████░░░░░░░░░░░░   40% 🟠 (handlers are stubs)
  xmtp-adapter         ██████░░░░░░░░░░░░░░   30% 🟠 (WIP)
  cli                  ████████████████████  100% ✅

Frontend
  agentm-web auth      ████████░░░░░░░░░░░░   40% 🔴 (双轨 auth，逻辑混乱)
  agentm-web social    ████████████████░░░░   80% 🟡
  agentm-web discover  █████████████░░░░░░░   65% 🟠 (demo data fallback)
  agentm-web tasks     ████████░░░░░░░░░░░░   40% 🟠 (UI exists, no real data)
  agentm-pro           ████░░░░░░░░░░░░░░░░   20% 🔴 (空壳)
  developer-docs       ████████████░░░░░░░░   60% 🟠
  website              ████████████████████  100% 🟡 (landing page done)

Overall Protocol: ~65%
```

---

## 七、推荐优先修复顺序

```
优先级  任务                              影响         估时
─────────────────────────────────────────────────────────────
P0-1   Indexer 接入真实 devnet RPC       功能完整性    3-5天
P0-2   Auth 双轨统一 (选 Dynamic)        用户体验      2天
P0-3   agentm-web: 默认 remote API       用户体验      0.5天
─────────────────────────────────────────────────────────────
P1-1   evaluator LLM-as-judge 实现       核心协议      5-7天
P1-2   agentm-pro 明确定位或合并         架构清晰      2天
P1-3   移除 Privy 依赖，bundle 优化      性能          0.5天
P1-4   revenue-share 接入 daemon        商业逻辑      3天
─────────────────────────────────────────────────────────────
P2-1   提取 packages/ui 共享组件        技术债        2天
P2-2   Rate limiting on daemon          安全          0.5天
P2-3   Vercel Git 自动部署             DevOps        0.5天
P2-4   xmtp-adapter 完善               A2A 功能      3天
─────────────────────────────────────────────────────────────
```

---

## 八、关键路径分析

> **最短上线路径** (让 Task Market 真实可用):

```
1. Indexer 接 devnet RPC → 真实链数据可查询
       ↓
2. agentm-web 展示真实 tasks (discover 页面去掉 demo fallback)
       ↓
3. 用户 wallet 连接 (Dynamic) → daemon session auth
       ↓
4. 用户可以 postTask() (发起任务)
       ↓
5. Agent (CLI / API) 可以 applyForTask() + submitResult()
       ↓
6. 手动 judgeAndPay() (LLM judge 是后续)
       ↓
7. 结算完成，reputation 更新
```

> **当前卡点**: 第 1 步（Indexer 没有真实数据）是整个流程的前置阻塞。

---

_文档生成工具: Claude Code + 人工代码分析_  
_参考文件: ARCHITECTURE.md, apps/agentm-web/**, apps/agent-daemon/**, programs/\*\*/_
