# Phase 4: Task Breakdown — Workflow Engine (功法引擎)

> **目的**: 将技术规格拆解为可执行的开发任务
> **输入**: `docs/workflow-engine/03-technical-spec.md`
> **输出物**: 本文档 + 任务文件 (GRA-153 ~ GRA-170)

---

## 变更记录

| 版本 | 日期       | 变更说明 |
| ---- | ---------- | -------- |
| v0.1 | 2026-04-04 | 初稿     |

---

## 任务总览

```
Phase A: 核心引擎 (Engine Core)           — 8 任务, ~3 周
Phase B: Marketplace 合约                 — 5 任务, ~2 周
Phase C: SDK & CLI                        — 3 任务, ~1 周
Phase D: 集成 & 测试                      — 2 任务, ~1 周
─────────────────────────────────────────────────────────
总计                                      — 18 任务, ~7 周
```

---

## Phase A: 核心引擎 (Engine Core)

### GRA-153: [Workflow] 定义 Workflow JSON Schema + 验证器

**优先级**: P0  
**预计时间**: 4h  
**依赖**: 无

**内容**:

- 创建 `packages/workflow-engine/src/schema/` 目录
- 定义 TypeScript 接口 (从 03-technical-spec §3.1 复制)
- 实现 JSON Schema 验证 (使用 zod 或 ajv)
- 验证规则:
    - steps 数量 1-50
    - 字段长度限制
    - 枚举值校验 (chain, action)
    - DAG 循环检测

**验收标准**:

- [ ] 所有接口导出
- [ ] validate() 函数可用
- [ ] 单元测试覆盖所有边界条件

---

### GRA-154: [Workflow] 模板变量解析器

**优先级**: P0  
**预计时间**: 3h  
**依赖**: GRA-153

**内容**:

- 实现 `parseTemplate()` 函数
- 支持 `{{stepX.output.field}}` 语法
- 支持嵌套对象访问
- 支持默认值 `{{stepX.output.field || 'default'}}`

**验收标准**:

- [ ] 解析所有模板变量格式
- [ ] 不存在的变量保留原文
- [ ] 单元测试 ≥ 10 个用例

---

### GRA-155: [Workflow] Step Executor 基础框架

**优先级**: P0  
**预计时间**: 6h  
**依赖**: GRA-153, GRA-154

**内容**:

- 创建 `StepExecutor` 类
- 实现执行生命周期: init → execute → cleanup
- 实现超时控制
- 实现重试逻辑
- 实现条件判断 (condition)

**验收标准**:

- [ ] 单步执行可用
- [ ] 超时自动终止
- [ ] 重试按配置执行
- [ ] 条件跳过/终止工作

---

### GRA-156: [Workflow] Action Handlers — 交易类

**优先级**: P0  
**预计时间**: 8h  
**依赖**: GRA-155

**内容**:

- 实现 Action Handler 接口
- 实现以下 handlers:
    - `swap` — 调用 Jupiter/Orca
    - `bridge` — 调用 Wormhole/LI.FI
    - `transfer` — SPL Token 转账
    - `stake` / `unstake` — 通用质押
- 集成 Chain Hub providers

**验收标准**:

- [ ] 每个 handler 有独立测试
- [ ] Solana devnet 端到端测试通过

---

### GRA-157: [Workflow] Action Handlers — 支付类

**优先级**: P1  
**预计时间**: 6h  
**依赖**: GRA-155

**内容**:

- 实现支付类 handlers:
    - `x402Payment` — HTTP 402 微支付
    - `mppStreamReward` — Tempo MPP
    - `teePrivateSettle` — X Layer TEE
    - `zeroGasExecute` — X Layer 零 Gas

**验收标准**:

- [ ] 各 handler 模拟测试通过
- [ ] 与 Chain Hub 集成验证

---

### GRA-158: [Workflow] Action Handlers — 工具类

**优先级**: P0  
**预计时间**: 4h  
**依赖**: GRA-155

**内容**:

- 实现工具类 handlers:
    - `httpRequest` — HTTP 调用
    - `wait` — 等待
    - `condition` — 条件分支
    - `parallel` — 并行执行
    - `loop` — 循环
    - `setVariable` — 设置变量
    - `log` — 记录日志

**验收标准**:

- [ ] parallel 正确处理并发
- [ ] loop 有最大迭代保护
- [ ] 单元测试全覆盖

---

### GRA-159: [Workflow] Workflow Engine 主类

**优先级**: P0  
**预计时间**: 6h  
**依赖**: GRA-155, GRA-156, GRA-157, GRA-158

**内容**:

- 创建 `WorkflowEngine` 主类
- 实现 `execute()` 方法
- 实现 `simulate()` 方法
- 实现 DAG 执行顺序
- 实现执行状态追踪
- 实现取消机制

**验收标准**:

- [ ] 线性 workflow 执行正确
- [ ] DAG workflow 执行正确
- [ ] 模拟模式不上链
- [ ] 取消能中断执行

---

### GRA-160: [Workflow] 收益分配模块

**优先级**: P1  
**预计时间**: 4h  
**依赖**: GRA-159

**内容**:

- 实现 `distributeRevenue()` 函数
- 按 RevenueShare 配置分配
- 固定: protocol 2%, judge 3%
- 处理精度问题 (BigInt)
- 集成到执行完成回调

**验收标准**:

- [ ] 分配比例精确
- [ ] 余数归用户
- [ ] 边界测试 (收益为0)

---

## Phase B: Marketplace 合约

### GRA-161: [Workflow] Solana Program — 数据结构

**优先级**: P0  
**预计时间**: 4h  
**依赖**: 无

**内容**:

- 创建 `programs/workflow-marketplace/`
- 定义 PDA 结构:
    - WorkflowMetadata
    - WorkflowAccess
    - WorkflowReview
- 实现序列化/反序列化

**验收标准**:

- [ ] PDA 大小计算正确
- [ ] Borsh 序列化测试通过

---

### GRA-162: [Workflow] Solana Program — create_workflow 指令

**优先级**: P0  
**预计时间**: 4h  
**依赖**: GRA-161

**内容**:

- 实现 `create_workflow` 指令
- 验证 content_hash
- 创建 WorkflowMetadata PDA
- 支持 SOL 和 SPL Token 定价

**验收标准**:

- [ ] PDA 创建成功
- [ ] 参数验证完整
- [ ] litesvm 测试通过

---

### GRA-163: [Workflow] Solana Program — purchase_workflow 指令

**优先级**: P0  
**预计时间**: 6h  
**依赖**: GRA-162

**内容**:

- 实现 `purchase_workflow` 指令
- 创建 WorkflowAccess PDA
- 实现支付分账:
    - 创作者: price \* (1 - 2%)
    - 协议: price \* 2%
- 更新 total_purchases

**验收标准**:

- [ ] SOL 支付路径测试
- [ ] SPL Token 支付路径测试
- [ ] 分账金额精确

---

### GRA-164: [Workflow] Solana Program — review_workflow 指令

**优先级**: P1  
**预计时间**: 3h  
**依赖**: GRA-163

**内容**:

- 实现 `review_workflow` 指令
- 验证用户已购买
- 创建 WorkflowReview PDA
- 更新 avg_rating (加权平均)

**验收标准**:

- [ ] 只有购买者可评价
- [ ] 不可重复评价
- [ ] avg_rating 计算正确

---

### GRA-165: [Workflow] Solana Program — 辅助指令

**优先级**: P1  
**预计时间**: 4h  
**依赖**: GRA-162

**内容**:

- 实现 `update_workflow` — 更新元数据
- 实现 `deactivate_workflow` — 下架
- 实现 `activate_workflow` — 重新上架
- 实现 `delete_workflow` — 删除 (无购买时)

**验收标准**:

- [ ] 权限检查正确
- [ ] 状态转换符合状态机

---

## Phase C: SDK & CLI

### GRA-166: [Workflow] SDK — @gradiences/workflow-engine

**优先级**: P0  
**预计时间**: 8h  
**依赖**: GRA-159, GRA-165

**内容**:

- 创建 `packages/workflow-engine/`
- 封装所有 Engine 功能
- 封装所有 Program 指令
- 实现 Marketplace 查询
- 导出 TypeScript 类型

**验收标准**:

- [ ] 所有接口与 03-technical-spec 一致
- [ ] JSDoc 完整
- [ ] 类型导出正确

---

### GRA-167: [Workflow] CLI — workflow 子命令

**优先级**: P1  
**预计时间**: 4h  
**依赖**: GRA-166

**内容**:

- 扩展 `@gradiences/cli`
- 添加 `workflow` 子命令:
    - `workflow create <file>` — 创建
    - `workflow execute <id>` — 执行
    - `workflow simulate <file>` — 模拟
    - `workflow list` — 列表
    - `workflow buy <id>` — 购买

**验收标准**:

- [ ] 命令帮助完整
- [ ] JSON 输出模式 (NO_DNA)
- [ ] 错误提示友好

---

### GRA-168: [Workflow] Indexer — Workflow 事件同步

**优先级**: P1  
**预计时间**: 4h  
**依赖**: GRA-165

**内容**:

- 扩展 Indexer 支持 Workflow 事件
- 新增数据库表:
    - workflows
    - workflow_accesses
    - workflow_reviews
    - workflow_executions
- 实现 REST API 端点

**验收标准**:

- [ ] 事件同步正确
- [ ] API 响应符合 spec
- [ ] 搜索/筛选工作

---

## Phase D: 集成 & 测试

### GRA-169: [Workflow] E2E 集成测试

**优先级**: P0  
**预计时间**: 6h  
**依赖**: GRA-166, GRA-168

**内容**:

- 编写端到端测试:
    - 创建 → 购买 → 执行 → 评价 完整流程
    - 多链 workflow 执行
    - 收益分配验证
- 使用 devnet 测试

**验收标准**:

- [ ] 完整生命周期测试通过
- [ ] 至少 3 个示例 workflow 测试

---

### GRA-170: [Workflow] 文档 & 示例

**优先级**: P1  
**预计时间**: 4h  
**依赖**: GRA-169

**内容**:

- 编写 SDK 使用文档
- 编写 CLI 使用文档
- 创建示例 Workflow:
    - 跨链套利
    - ZK 隐私支付
    - AI 自动决策
- 更新 README

**验收标准**:

- [ ] 文档可独立阅读
- [ ] 示例可直接运行

---

## 依赖关系图

```
GRA-153 (Schema)
    │
    ├──▶ GRA-154 (Template Parser)
    │        │
    │        ▼
    │    GRA-155 (Step Executor)
    │        │
    │        ├──▶ GRA-156 (交易 Handlers)
    │        ├──▶ GRA-157 (支付 Handlers)
    │        └──▶ GRA-158 (工具 Handlers)
    │                 │
    │                 ▼
    │            GRA-159 (Engine 主类)
    │                 │
    │                 └──▶ GRA-160 (收益分配)
    │
    │
GRA-161 (Program 数据结构)
    │
    ├──▶ GRA-162 (create_workflow)
    │        │
    │        ├──▶ GRA-163 (purchase_workflow)
    │        │        │
    │        │        └──▶ GRA-164 (review_workflow)
    │        │
    │        └──▶ GRA-165 (辅助指令)
    │
    │
    └───────────────────┐
                        │
                        ▼
                   GRA-166 (SDK)
                        │
                        ├──▶ GRA-167 (CLI)
                        │
                        └──▶ GRA-168 (Indexer)
                                 │
                                 ▼
                            GRA-169 (E2E 测试)
                                 │
                                 ▼
                            GRA-170 (文档)
```

---

## 里程碑

| 里程碑                   | 完成标准                       | 目标日期 |
| ------------------------ | ------------------------------ | -------- |
| **M1: Engine Alpha**     | GRA-153~159 完成，本地执行可用 | +2 周    |
| **M2: Marketplace Beta** | GRA-161~165 完成，devnet 部署  | +4 周    |
| **M3: SDK Release**      | GRA-166~168 完成，npm 发布     | +5 周    |
| **M4: Production Ready** | GRA-169~170 完成，文档完整     | +7 周    |

---

## 执行建议

### 并行开发路径

```
路径 1 (Engine):    GRA-153 → 154 → 155 → 156/157/158 → 159 → 160
路径 2 (Contract):  GRA-161 → 162 → 163 → 164/165
路径 3 (Integration): 等待路径 1+2 → GRA-166 → 167/168 → 169 → 170
```

### 优先级排序

**Week 1-2**: GRA-153, 154, 155, 161, 162 (基础)
**Week 3-4**: GRA-156, 157, 158, 159, 163, 164, 165 (功能)
**Week 5-6**: GRA-160, 166, 167, 168 (集成)
**Week 7**: GRA-169, 170 (测试&文档)

---

## ✅ Phase 4 验收标准

- [x] 所有任务拆解为 ≤8h 的单元
- [x] 依赖关系明确
- [x] 里程碑可度量
- [x] 并行路径已识别

**验收通过后，进入 Phase 5: Test Spec →**
