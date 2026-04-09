# Phase 5: Test Spec — Workflow Execution Gateway

> **输入**: `docs/03-technical-spec-workflow-execution-gateway.md` + `04-task-breakdown.md`  
> **日期**: 2026-04-07

---

## 5.1 测试策略

| 测试类型   | 覆盖范围                                         | 工具           | 运行环境      |
| ---------- | ------------------------------------------------ | -------------- | ------------- |
| 单元测试   | Store, StateMachine, EventListener, Gateway      | Vitest         | Node.js local |
| 集成测试   | Gateway + Store + StateMachine + mock SDK        | Vitest         | Node.js local |
| 端到端测试 | 真实 devnet purchase → task → execution → settle | Node.js script | Devnet        |
| 安全测试   | 伪造事件、重复事件、非法状态转换                 | Vitest         | Node.js local |

---

## 5.2 测试用例表

### 5.2.1 `GatewayStore`

**正常路径**

| #   | 测试名称            | 输入                    | 预期输出                              |
| --- | ------------------- | ----------------------- | ------------------------------------- |
| H1  | insert and retrieve | `GatewayPurchaseRecord` | 通过 `getByPurchaseId` 能拿到相同数据 |

**边界条件**

| #   | 测试名称               | 输入                 | 预期行为             |
| --- | ---------------------- | -------------------- | -------------------- |
| B1  | duplicate tx_signature | 相同 record 插入两次 | 第二次不抛错（幂等） |

**异常/攻击**

| #   | 测试名称           | 输入                      | 预期错误                            |
| --- | ------------------ | ------------------------- | ----------------------------------- |
| E1  | unknown purchaseId | query "nonexistent"       | `null`                              |
| E2  | list by status     | 插入 3 条不同 status 记录 | `listByStatus("PENDING")` 返回 1 条 |

### 5.2.2 `PurchaseStateMachine`

**正常路径**

| #   | 测试名称                     | 输入                                             | 预期输出          |
| --- | ---------------------------- | ------------------------------------------------ | ----------------- |
| H2  | PENDING → TASK_CREATING      | `transition("PENDING", "processPurchase")`       | `"TASK_CREATING"` |
| H3  | TASK_CREATING → TASK_CREATED | `transition("TASK_CREATING", "postTaskSuccess")` | `"TASK_CREATED"`  |

**异常/攻击**

| #   | 测试名称                        | 输入                                                   | 预期错误          |
| --- | ------------------------------- | ------------------------------------------------------ | ----------------- |
| E3  | illegal SETTLED → EXECUTING     | `transition("SETTLED", "startExecution")`              | `GW_0008`         |
| B2  | FAILED → TASK_CREATING on retry | `transition("FAILED", "retry")` with attempts=1, max=3 | `"TASK_CREATING"` |
| E4  | exceed max retries              | `transition("FAILED", "retry")` with attempts=3, max=3 | `GW_0008`         |

### 5.2.3 `MarketplaceEventListener`

**正常路径**

| #   | 测试名称                  | 输入                                     | 预期输出                         |
| --- | ------------------------- | ---------------------------------------- | -------------------------------- |
| H4  | emit parsed PurchaseEvent | mock transaction log with valid purchase | event object with correct fields |

**异常/攻击**

| #   | 测试名称                   | 输入                           | 预期行为                      |
| --- | -------------------------- | ------------------------------ | ----------------------------- |
| E5  | ignore invalid programId   | log mentions different program | no event emitted              |
| E6  | deduplicate by txSignature | same tx signature twice        | listener callback called once |

### 5.2.4 `WorkflowExecutionGateway`

**正常路径**

| #   | 测试名称                        | 输入                             | 预期输出                                       |
| --- | ------------------------------- | -------------------------------- | ---------------------------------------------- |
| H5  | processPurchase persists record | `PurchaseEvent`                  | record status = "TASK_CREATING"                |
| H6  | full PENDING → SETTLED          | mock all deps (sdk, vel, bridge) | final status = "SETTLED", settlementTx defined |

**异常/攻击**

| #   | 测试名称                           | 输入                                              | 预期错误                               |
| --- | ---------------------------------- | ------------------------------------------------- | -------------------------------------- |
| E7  | post_task fail → FAILED            | mock sdk.post throws                              | status = "FAILED", attempts = 1        |
| E8  | retry moves FAILED → TASK_CREATING | `retry(purchaseId)` on FAILED with attempts < max | status = "TASK_CREATING", attempts + 1 |
| E9  | retry non-failed throws            | `retry(purchaseId)` on SETTLED                    | `GW_0008`                              |

---

## 5.3 集成测试场景

| #   | 场景名称                   | 步骤                                                                        | 预期结果                         |
| --- | -------------------------- | --------------------------------------------------------------------------- | -------------------------------- |
| I1  | 完整 happy path（全 mock） | purchase event → gateway.process → auto-apply → vel.execute → bridge.settle | 所有状态按预期转换，最终 SETTLED |
| I2  | 执行超时失败               | purchase → task → apply → vel timeout                                       | 状态进入 FAILED，可重试          |
| I3  | bridge 失败后重试成功      | purchase → task → apply → bridge fail → retry → bridge succeed              | 最终 SETTLED，attempts = 2       |

---

## 5.4 测试代码骨架

骨架文件已提前创建：

- `apps/agent-daemon/src/gateway/__tests__/store.test.ts`
- `apps/agent-daemon/src/gateway/__tests__/state-machine.test.ts`
- `apps/agent-daemon/src/gateway/__tests__/event-listener.test.ts`
- `apps/agent-daemon/src/gateway/__tests__/gateway.test.ts`
- `apps/agent-daemon/src/gateway/__tests__/integration.test.ts`

---

## 5.5 测试覆盖目标

| 指标                      | 目标                        |
| ------------------------- | --------------------------- |
| `src/gateway/` 语句覆盖率 | ≥ 80%                       |
| `src/gateway/` 分支覆盖率 | ≥ 75%                       |
| E2E Devnet 脚本           | 至少 1 笔成功 end-to-end tx |

---

## ✅ Phase 5 验收标准

- [x] 技术规格中的每个接口/函数都有对应测试用例
- [x] Happy Path + Boundary + Error 三类齐全
- [x] 集成测试至少 3 个完整场景
- [x] 测试代码骨架已编写（5 个测试文件已创建）
- [x] 覆盖目标已定义

**验收通过后，进入 Phase 6: Implementation →**
