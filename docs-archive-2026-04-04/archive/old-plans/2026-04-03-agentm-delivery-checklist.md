# AgentM 交付执行清单（2026-04-03）

> 目的：把当前阶段目标（先跑通 AgentM 网站 + 桌面 App）落到可追踪里程碑，避免执行过程中遗忘。

## Milestone A — 命名与术语统一（白皮书/核心文档）

- [completed] A1. 全面统一产品命名：`AgentM`（用户侧）+ `AgentM Pro`（开发者侧）【已完成白皮书 + 核心 PRD/Architecture】
- [completed] A2. 修正白皮书口径：保留 `apply_for_task` 与 `Application` 账户（与实现一致）
- [completed] A3. 清理历史品牌命名残留（全仓执行，排除 archive）

## Milestone B — AgentM 可用入口闭环（网站 + 桌面）

- [completed] B1. 盘点网站当前入口能力与真实可用路径（当前为 waitlist 主导）
- [completed] B2. 建立网站 → AgentM / AgentM Pro 可用入口链接闭环（增加 Launch 入口）
- [completed] B3. 输出用户可执行的最短路径（登录、发现、任务、Profile）
  - 路径：Website `Launch AgentM` → 登录 → Discover → Task Flow → Profile Studio
  - 开发者路径：Website `Launch AgentM Pro` → Profile 发布与运维工作流

## Milestone C — 端到端验收

- [completed] C1. 运行受影响模块验证（typecheck / test / build）【website `npm run build` 通过】
- [completed] C2. 形成里程碑审查表（完成项 / 证据 / 差距）

## Milestone D — 并行功能收口（进行中）

- [completed] D1. a2a-router 规格前置检查（`apps/agentm/docs/a2a-multiprotocol/01~05`）
- [completed] D2. 修复 a2a-router 的 typecheck 阻塞（readonly relay + test runtime 兼容）
- [completed] D3. AgentM release gate 复跑通过（typecheck/test/build/stage-a-demo）
- [completed] D4. 暂存区边界清理（仅保留本轮 `a2a-router + a2a docs` 相关改动；移除并行功能污染）
- [completed] D5. 形成“可提交边界”清单
  - 纳入本轮：`apps/agentm/src/main/a2a-router/nostr-client.ts`、`nostr-client.test.ts`、`apps/agentm/package.json`、`apps/agentm/package-lock.json`
  - 文档范围：`apps/agentm/docs/a2a-multiprotocol/01~05` 已纳入审查范围（本轮无需改动）
  - 过程追踪：`docs/plans/2026-04-03-agentm-delivery-checklist.md`
  - 延后：`apps/a2a-protocol/runtime/data/`（运行时状态文件）

## 非当前阶段（暂缓）

- [deferred] 多链信誉
- [deferred] GSDK
- [deferred] MPC 隐私计算
