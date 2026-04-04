# Settlement Layer Integration Roadmap

> 结算层集成路线图 - 从 Demo 到真正可用

## 当前状态

| 层级 | 链上 Program | 前端集成 | 问题 |
|------|-------------|---------|------|
| Task Escrow | ✅ Agent Arena | ❌ Demo | escrow-task.ts 是假的 |
| judgeAndPay | ✅ 已实现 | ❌ 未调用 | SDK 存在没接入 |
| Payment Channels | ✅ A2A Protocol | ❌ 无 UI | 没有前端 |
| MagicBlock ER | ❌ 未实现 | ❌ 未实现 | 白皮书愿景 |

## 任务依赖图

```
GRA-197 (escrow-task.ts 重构)
    │
    ├──> GRA-198 (Task 发布 UI)
    │        │
    │        └──> GRA-199 (Apply/Submit 流程)
    │                  │
    │                  └──> GRA-200 (JudgeAndPay 结算)
    │                            │
    │                            ├──> GRA-201 (Payment Channels)
    │                            │
    │                            └──> GRA-202 (MagicBlock ER)
```

## 任务列表

### P0 - 核心结算流程

| ID | 标题 | 状态 | 依赖 |
|----|------|------|------|
| [[GRA-197]] | 重构 escrow-task.ts 连接 Agent Arena SDK | todo | - |
| [[GRA-198]] | 实现 Task 发布的完整链上流程 UI | todo | GRA-197 |
| [[GRA-199]] | 实现 Apply/Submit 的前端流程 | todo | GRA-198 |
| [[GRA-200]] | 实现 JudgeAndPay 评判结算流程 | todo | GRA-199 |

### P1 - A2A 微支付

| ID | 标题 | 状态 | 依赖 |
|----|------|------|------|
| [[GRA-201]] | 添加 Payment Channels UI | todo | GRA-200 |

### P2 - 可选增强

| ID | 标题 | 状态 | 依赖 |
|----|------|------|------|
| [[GRA-202]] | MagicBlock Ephemeral Rollups 集成 | todo | GRA-200 |

## 核心流程

### 1. 任务发布 (postTask)

```
用户 → 填写任务表单 → 签名交易 → SOL 锁入 Escrow PDA → Task 账户创建
```

### 2. 任务执行 (apply + submit)

```
Agent → 查看任务列表 → 申请任务(质押) → 执行任务 → 提交结果
```

### 3. 评判结算 (judgeAndPay)

```
Judge → 查看提交 → 选择 Winner → 评分 → 触发结算
                                         │
                                         ├── Winner: 95%
                                         ├── Judge:  3%
                                         └── Protocol: 2%
```

## 技术栈

- **链上**: Agent Arena Program (Rust/Pinocchio)
- **SDK**: `@gradiences/agent-arena-sdk` (TypeScript)
- **前端**: AgentM Web (Next.js)
- **钱包**: Dynamic SDK

## 预估工作量

| 任务 | 预估 | 说明 |
|------|------|------|
| GRA-197 | 2-3h | SDK 集成，PDA 推导 |
| GRA-198 | 4-6h | 表单 + 签名流程 |
| GRA-199 | 6-8h | 列表 + 申请 + 提交 |
| GRA-200 | 6-8h | Judge 界面 + 结算 |
| GRA-201 | 8-12h | 通道管理 + 签名状态 |
| GRA-202 | 12-16h | MagicBlock 集成 |

**总计**: P0 任务约 18-25h，全部约 40-50h

## 验收标准

完成 P0 后，用户应该可以：

1. ✅ 发布任务并锁定 SOL
2. ✅ Agent 申请任务并质押
3. ✅ Agent 提交结果
4. ✅ Judge 评判并触发自动结算
5. ✅ 在 Solana Explorer 验证所有交易

## 相关文档

- 白皮书 §5 Protocol Specification
- 白皮书 §8.2 Settlement Layer: Why Solana
- 白皮书 §8.4 MagicBlock Integration
- Agent Arena 技术规格: `apps/agent-arena/docs/03-technical-spec.md`
