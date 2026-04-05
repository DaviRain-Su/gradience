# 补充问题分析 — 第二轮深度扫描

**扫描日期**: 2026-04-04  
**扫描重点**: CI/CD、隐藏 Bug、产品完整度、基础设施

---

## 🔴 新发现的 P0 Bug（上轮遗漏）

### Bug 1: `AGENTM_CORE_PROGRAM_ID` 是 SystemProgram 占位符
- **位置**: `apps/agent-daemon/src/solana/program-ids.ts`
- **现状**: 
  ```typescript
  export const AGENTM_CORE_PROGRAM_ID = new PublicKey(
    process.env.AGENTD_AGENTM_CORE_PROGRAM_ID ?? '11111111111111111111111111111111'
  );
  // ↑ 这是 Solana SystemProgram 的 ID，不是 agentm-core 程序！
  ```
- **影响**: daemon 所有涉及 agentm-core 的链上操作（registerUser, follow/unfollow, updateReputation）都会发送到错误的程序，**静默失败**。
- **修复**: 找到 agentm-core 在 devnet 的实际 Program ID，写入 `.env` 和 `deploy/.env.prod`

### Bug 2: ~~MultiAgentTaskView 调用不存在的 daemon 端点~~ ✅ 已修复 (GRA-152)
- **位置**: ~~`apps/agentm-web/src/app/app/views/MultiAgentTaskView.tsx`~~
- **状态**: ✅ **已移除**
- **原因**: daemon 未实现 coordinator 路由，该 View 调用的 `/api/v1/coordinator/*` 端点全部返回 404
- **解决方案**: 移除 MultiAgentTaskView 组件及相关导航，使用已有的链上 postTask 流程

### Bug 3: CI Rust 检查路径错误
- **位置**: `.github/workflows/ci.yml`
- **现状**:
  ```yaml
  - name: Check indexer
    run: cargo check --manifest-path apps/agent-arena/indexer/Cargo.toml
  ```
  但 indexer 实际在 `apps/chain-hub/indexer/Cargo.toml`，`apps/agent-arena/indexer/` **不存在**
- **影响**: CI Rust 检查步骤每次都失败（如果跑的话），或这个 job 从未真正运行过
- **修复**: 改为正确路径 `apps/chain-hub/indexer/Cargo.toml`

---

## 🟠 新发现的 P1 问题

### 问题 4: soul-engine 匹配功能需要 LLM API Key，但 daemon 未配置
- **位置**: `packages/soul-engine/src/matching/llm-analyzer.ts`
- **现状**: MatchingEngine 需要 OpenAI/其他 LLM 的 API key 才能运行 4 维度分析。但 daemon 的 config 里没有 `openAiApiKey` 或 `llmProvider` 配置项
- **影响**: `/api/matches` 端点实际上无法产生真实的 Soul Profile 匹配分析，只能用 Jaccard 相似度（纯词频，无语义）
- **修复**: 在 daemon config 里加 `llmApiKey` / `llmProvider` 配置，soul-engine 的 MatchingEngine 调用时传入

### 问题 5: CI 没有单元测试步骤
- **位置**: `.github/workflows/ci.yml`
- **现状**: CI 只有 lint → build → rust-check，没有 `pnpm test` 步骤
- **影响**: 任何代码改动都不会触发测试验证。`packages/soul-engine`, `packages/workflow-engine`, `packages/chain-hub-sdk` 等都有单元测试，但从未在 CI 里跑
- **修复**: 在 CI build job 后加 test job，运行所有 package 的单元测试

### 问题 6: agentm-web 没有任何单元/集成测试
- **位置**: `apps/agentm-web/src/`
- **现状**: `find src -name "*.test.tsx"` 返回空（node_modules 里的不算）
- **影响**: UI 回归无法自动检测；hooks（useProfile, useFeed, useMatches 等）没有测试覆盖
- **修复**: 接入 Vitest + Testing Library，先覆盖核心 hooks 和 API 调用

---

## 🔵 新发现的 P2 问题

### 问题 7: 网站 Waitlist 数据存在内存，进程重启全丢
- **位置**: `website/src/app/api/subscribe/route.ts`
- **现状**:
  ```typescript
  const submissions: Array<{ email: string; ... }> = [];
  // ↑ 内存数组，服务重启后清空
  ```
  Resend API 被调用发确认邮件（好的），但订阅列表本身存内存（不好）
- **影响**: 重新部署网站后所有 waitlist 数据丢失
- **修复**: 接入持久化存储（最简单：Supabase / PlanetScale / Vercel KV）

### 问题 8: developer-docs 未部署，没有公开 API 文档
- **位置**: `apps/developer-docs/`
- **现状**: 文档站有 Mintlify 框架，有内容，但没部署
- **影响**: 开发者无法查阅 SDK 文档、Daemon API 文档、协议规范
- **修复**: 部署到 Vercel，配置 `docs.gradiences.xyz` 域名

### 问题 9: agentm-core Program ID 未在 apps/agentm-core 里声明
- **位置**: `apps/agentm-core/program/src/`
- **现状**: `apps/agentm-core/` 有单独的 Rust program 目录，但不在 `programs/Cargo.toml` workspace 里，也没有找到其 `declare_id!`
- **影响**: 这个程序的身份不明——它和 `programs/agentm-core/` 是同一个还是不同的？
- **修复**: 澄清 `apps/agentm-core/program/` 的定位，合并或删除

### 问题 10: workflow-engine 9249 行中大量 handler 是接口定义无实现
- **位置**: `packages/workflow-engine/src/handlers/trading.ts`, `payment.ts`
- **现状**: 定义了 `SwapParams`, `BridgeParams`, `X402PaymentParams` 等接口，但实际的 DEX swap / 跨链 bridge / x402 支付执行逻辑是 stub 或依赖外部 SDK 未接入
- **影响**: 任何依赖 workflow-engine 执行真实 DeFi 操作的功能都不能用
- **注意**: P3，不是近期主线

---

## 战略层建议（不需要立即变成任务）

### 1. 明确两套"Task"系统的边界
当前有两套任务：
- **链上 Arena Task**（`programs/agent-arena/`）：真实结算，SOL 锁仓
- **Daemon 本地 Task Queue**（`apps/agent-daemon/src/tasks/`）：内存/SQLite 队列，用于 agent 进程调度

两者是不同层次，但 agentm-web 的 MultiAgentTaskView 通过 `/api/v1/coordinator/` 想要一个第三套系统。
**建议**：统一为两层——链上 Arena（最终结算）+ Daemon Queue（本地执行），去掉 coordinator 独立层。

### 2. 程序部署状态需要明确记录
`programs/` 下 5 个程序，只有 `agent-arena` 的 Program ID 在 daemon 里配置正确。
**建议**：在 `programs/README.md` 里维护一张"已部署到 devnet 的程序 ID 表"，包括每个程序的部署状态和最后更新时间。

### 3. LLM 配置应统一管理
daemon 要用 LLM（evaluator + soul-engine matching + 未来 judge），但目前没有统一的 LLM provider 配置。
**建议**：在 daemon config 里加 `llm` section，soul-engine / evaluator 都从这里读取 provider/key。

### 4. 未来桌面版架构建议
如 GRA-150 所述，未来桌面版推荐用 **Tauri 2.0** 包装 agentm-web：
- agentm-web 代码零修改
- Rust shell 负责：本地 agentd 进程管理、系统托盘、原生通知
- Bundle < 10MB（Electron 方案 > 150MB）
- agentd 可以内嵌在 Tauri 应用里，用户无需手动安装
