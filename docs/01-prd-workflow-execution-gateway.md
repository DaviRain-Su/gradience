# Phase 1: PRD — Workflow Execution Gateway

> **项目名称**: Workflow Execution Gateway (WEG)  
> **所属模块**: 跨模块 (Agent Daemon + Workflow Marketplace + Agent Arena)  
> **版本**: v0.1  
> **日期**: 2026-04-07  
> **作者**: Gradience Team + AI Agents

---

## 1.1 问题定义

### 要解决的问题

> **用户在 Marketplace 购买了一个 workflow，但没有任何机制自动触发该 workflow 的执行，也无法将执行结果可信地结算到 Agent Arena。**

### 当前状态

- `workflow-marketplace` program 负责 workflow 的发布、购买和评价。
- `workflow-engine` 负责在本地/TEE 中执行 workflow 的 handlers。
- `agent-arena` program 负责任务发布、竞争、提交和 judge-and-pay 结算。
- **这三个组件各自独立运行**，没有一个统一的触发器把 "购买" 事件转化为 "执行 + 结算" 的完整流程。
- 用户购买 workflow 后，需要手动下载、手动运行 engine、手动把结果拿到 arena 上结算。整个体验是不连贯的。

### 目标状态

- 当 buyer 在 Marketplace 上完成一次 workflow 购买后，**系统自动**（或通过 buyer 一次确认）触发以下流程：
    1. 在 Agent Arena 上 **post 一个 execution task**
    2. 由 buyer 指定的 agent（或系统默认 agent）**apply 并执行**该 workflow
    3. workflow 在 TEE (VEL) 中运行，生成 **attestation bundle**
    4. 将结果和 attestation 提交到 Arena 进行 **judge_and_pay 结算**
    5. 结算完成后，触发 Marketplace 的 **购买状态更新**（标记为 "已执行并结算"）
    6. buyer 可以在一个地方看到：购买记录 → 执行结果 → 结算 tx → reputation 更新

---

## 1.3 用户故事

| #   | 角色                  | 想要                                                                  | 以便                                      | 优先级 |
| --- | --------------------- | --------------------------------------------------------------------- | ----------------------------------------- | ------ |
| 1   | **Workflow Buyer**    | 购买 workflow 后一键触发执行和结算                                    | 不用自己下载脚本、配置环境、手动跑 engine | P0     |
| 2   | **Agent Owner**       | 让我的 agent 自动接取 marketplace 触发的工作流任务                    | 获得稳定的收入来源，无需手动盯单          | P0     |
| 3   | **Protocol Operator** | 追踪每个 workflow purchase 对应的 arena taskId 和 settlement tx       | 确保整个链路可审计、无资金黑洞            | P0     |
| 4   | **Developer**         | 有清晰的 Gateway API 来订阅 marketplace purchase 事件并自定义执行策略 | 可以扩展不同的执行后端（本地、TEE、云端） | P1     |

---

## 1.4 功能范围

### 做什么（In Scope）

- [ ] 设计并实现 `WorkflowExecutionGateway` 服务（作为 `agent-daemon` 的子模块）
- [ ] 监听 Marketplace Program 的 `purchase` 事件（通过 RPC logSubscribe 或 Indexer webhook）
- [ ] Gateway 收到 purchase 事件后，自动在 Agent Arena 上 `post_task`
    - task 的 `evalRef` 指向 workflow 的 IPFS/Arweave 定义
    - task 的 reward 由 marketplace 的购买价格决定
- [ ] Agent 收到 task 后 `apply_for_task`（可配置为自动 apply）
- [ ] Gateway 调度 VEL `orchestrator.runAndSettle()` 执行 workflow
- [ ] 执行成功后，Gateway 调用 `settlement-bridge.settleWithReasonRef()` 完成 `judge_and_pay`
- [ ] 将 `purchaseId ↔ taskId ↔ settlementTx` 的映射持久化到本地 SQLite/JSON 存储
- [ ] 提供 Gateway API：`GET /gateway/purchases/:purchaseId/status` 查询完整链路状态
- [ ] 提供端到端测试脚本：devnet 上一次完整的 purchase → execute → settle 验证

### 不做什么（Out of Scope）

- **不修改 Marketplace Program 的链上指令**：当前 program 保持不变，Gateway 通过事件监听间接触发
- **不修改 Agent Arena Program 的链上指令**：继续使用现有的 `post_task` / `apply` / `submit` / `judge_and_pay`
- **不做多 agent 竞价拍卖**：默认只绑定 buyer 指定的单个 agent 或系统 fallback agent
- **不做跨链 marketplace 集成**：只聚焦 Solana devnet/mainnet 的本地 marketplace
- **不做 UI 页面**：只做 daemon 内部服务和 API，前端由 AgentM Web 后续集成

---

## 1.5 成功标准

| 标准         | 指标                                                    | 目标值                |
| ------------ | ------------------------------------------------------- | --------------------- |
| 事件监听覆盖 | Marketplace `purchase` 事件被 Gateway 成功捕获          | ≥ 95%（测试中 20/20） |
| 任务自动创建 | 每个 purchase 在 30s 内自动创建对应的 Arena task        | 100%                  |
| 端到端执行   | 从 purchase 到 settlement tx 确认的全流程在 devnet 跑通 | 至少 1 笔成功 tx      |
| API 可用性   | `/gateway/purchases/:id/status` 能返回完整链路映射      | 所有字段非空          |
| Gateway 测试 | 单元测试覆盖 event handler + state machine + API        | ≥ 80%                 |
| Build 全绿   | `agent-daemon` build + workspace typecheck              | 0 errors              |

---

## 1.6 约束条件

| 约束类型     | 具体描述                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| **技术约束** | 必须复用已有的 `workflow-engine`、`VEL`、`settlement-bridge` 和 `arena-sdk`，不推翻已有架构               |
| **技术约束** | Marketplace Program 当前没有原生 event 索引，Gateway 需要通过 RPC `logSubscribe` 轮询捕获 purchase        |
| **时间约束** | 目标在 1 个 Sprint 内完成 Phase 1-7                                                                       |
| **资源约束** | 由 AI Agent 主导开发，需要最小化跨模块协调                                                                |
| **依赖约束** | 依赖 VEL 已完成的 `orchestrator.runAndSettle()` 接口；若 VEL 真实 TEE 未就绪，可先使用 mock provider 跑通 |

---

## 1.7 相关文档

| 文档                  | 链接                                                | 关系                            |
| --------------------- | --------------------------------------------------- | ------------------------------- |
| VEL Phase 3 Tech Spec | `apps/agent-daemon/docs/03-technical-spec-vel.md`   | VEL 执行层接口定义              |
| VEL TEE Integration   | `apps/agent-daemon/docs/TEE_INTEGRATION.md`         | 如何启动 TEE / mock enclave     |
| Arena SDK             | `apps/agent-arena/clients/typescript/`              | 用于 post_task / apply / submit |
| Settlement Bridge     | `apps/agent-daemon/src/bridge/settlement-bridge.ts` | 结算层接口                      |
| Marketplace Program   | `programs/workflow-marketplace/`                    | 链上购买逻辑                    |

---

## ✅ Phase 1 验收标准

- [x] 1.1-1.6 所有「必填」部分已完成
- [x] 用户故事至少 3 个
- [x] 「不做什么」已明确列出
- [x] 成功标准可量化
- [ ] 团队/相关人已 review

**验收通过后，进入 Phase 2: Architecture →**
