# Phase 3: Technical Spec — agent-arena/clients/typescript (GradienceSDK)

> **范围**: `apps/agent-arena/clients/typescript/` — TypeScript SDK
> **消费方**: CLI、Judge Daemon、前端

---

## 1. 模块职责

TypeScript SDK 是**链上程序的 TypeScript 客户端封装层**：

- 封装所有 11 条链上指令的构建与发送
- 提供 `GradienceSDK` 高层 API（任务、Judge、账户查询）
- 提供 `WalletAdapter` 抽象（兼容不同签名器）
- 包含 Codama 自动生成的低层客户端（`generated/`）

**不做**：
- 状态持久化
- 事件监听（Indexer 负责）

---

## 2. 技术栈

| 项目 | 说明 |
|------|------|
| TypeScript | 语言 |
| `@solana/kit` v5.5.1 | Solana 客户端库 |
| Codama | 从 IDL 自动生成低层代码 |
| Bun | 测试运行时 |

---

## 3. 文件结构

```
clients/typescript/src/
├── index.ts              — 公开 API re-export（4 行）
├── sdk.ts                — GradienceSDK 主类（1328 行）
├── wallet-adapters.ts    — WalletAdapter 实现（153 行）
│   ├── KeypairAdapter    — 文件密钥对签名
│   └── BrowserWalletAdapter — 浏览器钱包（window.solana）
├── generated/            — Codama 自动生成（不可手动修改）
│   ├── accounts/         — 账户反序列化
│   ├── instructions/     — 指令构建器
│   ├── types/            — 枚举、结构体
│   └── index.ts
├── sdk.test.ts           — SDK 单元/集成测试（336 行）
└── wallet-adapters.test.ts — WalletAdapter 测试（74 行）
```

---

## 4. GradienceSDK 公开 API

```typescript
class GradienceSDK {
  constructor(options: GradienceSdkOptions)

  // 任务操作
  postTask(wallet, req: PostTaskRequest): Promise<string>           // 返回 tx signature
  applyForTask(wallet, req: ApplyTaskRequest): Promise<string>
  submitResult(wallet, req: SubmitTaskResultRequest): Promise<string>
  judgeAndPay(wallet, req: JudgeTaskRequest): Promise<string>
  cancelTask(wallet, req: CancelTaskRequest): Promise<string>
  refundExpired(wallet, req: RefundExpiredRequest): Promise<string>
  forceRefund(wallet, req: ForceRefundRequest): Promise<string>

  // Judge 操作
  registerJudge(wallet, req): Promise<string>
  unstakeJudge(wallet, req): Promise<string>

  // 查询
  getTask(taskId: number): Promise<Task | null>
  getTasks(filter: TaskListFilter): Promise<Task[]>
  getReputation(agent: Address): Promise<Reputation | null>
  getJudgePool(category: number): Promise<JudgePool | null>
}
```

---

## 5. WalletAdapter 接口

```typescript
interface WalletAdapter {
  address: Address
  signAndSendTransaction(tx): Promise<string>
}

class KeypairAdapter implements WalletAdapter      // CLI / Daemon 使用
class BrowserWalletAdapter implements WalletAdapter // 前端使用
```

---

## 6. GradienceSdkOptions

```typescript
interface GradienceSdkOptions {
  rpcEndpoint?: string        // 默认 http://127.0.0.1:8899
  indexerEndpoint?: string    // 查询任务列表用（可选，有则优先）
  programAddress?: Address    // 默认 GRADIENCE_PROGRAM_ADDRESS
}
```

---

## 7. 代码生成规则

`generated/` 目录由 Codama 从 `idl/pinocchio_counter.json` 生成，**禁止手动修改**。

> 注：IDL 文件名 `pinocchio_counter.json` 是脚手架初始化时的遗留命名，实际内容为 Gradience Agent Arena 程序的完整 IDL。

更新流程：
```bash
# 修改 program 代码 → 重新生成 IDL → 重新生成客户端
just build  # 在 apps/agent-arena/ 执行
```

IDL 变更 → 生成代码自动更新 → SDK 手写代码可能需要同步调整。

---

## 8. 接口契约

### ← IDL（上游）
- 指令参数、账户布局与 IDL 100% 一致
- IDL 由 program 侧的 Codama 注解驱动生成

### → RPC / Indexer（运行时）
- 写操作：通过 RPC 广播交易
- 查询：优先 Indexer REST API，无 indexerEndpoint 则直接 RPC fetchAccount
