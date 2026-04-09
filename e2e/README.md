# E2E 测试套件

> 端到端测试覆盖 Gradience 协议完整用户流程

## 测试场景

### 1. 核心任务生命周期 ✅ 已实现

**文件**: `tests/task-lifecycle.spec.ts`

覆盖白皮书定义的三状态四转换：

- `postTask` - 创建任务并锁定资金
- `submitResult` - Agent 提交结果
- `judgeAndPay` - Judge 评判并触发结算
- 验证 95/3/2 费用分配

### 2. 状态边界测试 ✅ 已实现

**文件**: `tests/task-states.spec.ts`

- Open → Completed (正常评判)
- Open → Refunded (过期退款)
- 低分评判 (< 60) 的退款路径
- 多 Agent 竞争提交
- 零奖励任务
- 最大奖励上限

### 3. 其他场景 (WIP)

- Agent 生命周期 (注册/登录/声誉)
- Chain Hub 集成
- A2A 消息流程

## 运行测试

```bash
# 运行所有 E2E 测试
pnpm test

# 运行特定测试文件
pnpm test task-lifecycle

# headed 模式（可见浏览器）
pnpm test:headed

# Playwright UI 模式
pnpm test:ui
```

## 测试工具

**文件**: `utils/solana.ts`

- `createTestWallet()` - 创建测试钱包
- `airdrop(address, amount)` - 请求 devnet SOL
- `waitForTaskState()` - 等待任务状态变更
- `retry(fn, retries)` - 重试包装器

## 环境要求

测试运行在 **Solana Devnet**:

- Devnet RPC: `https://api.devnet.solana.com`
- Indexer API: `https://api.gradiences.xyz/indexer/`
- 自动为测试钱包空投 SOL

## 架构

```
e2e/
├── tests/
│   ├── task-lifecycle.spec.ts    # 核心协议流程
│   └── task-states.spec.ts       # 状态机边界
├── utils/
│   └── solana.ts                 # 测试工具函数
└── playwright.config.ts          # 测试配置
```

---

_测试实现日期: 2026-04-07_
