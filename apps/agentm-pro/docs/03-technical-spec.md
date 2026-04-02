# Phase 3: Technical Spec — AgentM Pro

> **目的**: 定义 AgentM Pro 每个接口的精确行为
> **输入**: `02-architecture.md` + 现有代码
> **输出物**: 本文档

---

## 3.1 Dashboard API

Dashboard 是 Next.js 应用，通过 Indexer REST API + SDK 链上查询获取数据。

### 3.1.1 页面规格

#### 首页 — Agent Overview

```
路由: /
数据源: GET /api/agents/{pubkey}/reputation + GET /api/tasks?poster={pubkey}
```

| 区域 | 字段 | 来源 |
|------|------|------|
| Profile Card | pubkey, balance (SOL) | 钱包 |
| Reputation | avg_score, completed, total_applied, win_rate | Indexer |
| Income | total_earned (lamports → SOL) | Indexer reputation |
| Active Tasks | 我发布的 open 任务列表 | Indexer tasks?poster=&state=open |
| Recent Activity | 最近 10 个任务变动 | Indexer tasks?limit=10 |

#### 任务详情页

```
路由: /tasks/[taskId]
数据源: GET /api/tasks/{taskId} + GET /api/tasks/{taskId}/submissions
```

| 区域 | 字段 | 来源 |
|------|------|------|
| Task Info | task_id, poster, judge, reward, state, category, deadline | Indexer |
| Submissions | agent, result_ref, trace_ref, score (if judged) | Indexer |
| Actions | Judge 按钮（仅 task.judge === 当前钱包时显示） | SDK |

#### 发布任务表单

```
路由: / (内嵌 Modal)
提交: SDK task.post()
```

| 字段 | 类型 | 验证 |
|------|------|------|
| description | string | 非空，≤ 500 chars |
| eval_ref | string | 非空，≤ 128 chars (CID) |
| reward | number | > 0，单位 lamports |
| category | select | 0-7 |
| deadline | datetime | > now |
| judge_deadline | datetime | > deadline |
| min_stake | number | ≥ 0 |
| judge_mode | select | Designated / Pool |
| judge | pubkey | 仅 Designated 时必填 |

#### Agent Profile Studio（新增）

```
路由: /profile
数据源: GET /api/agents/{pubkey}/profile
提交: PUT /api/agents/{pubkey}/profile
```

| 字段 | 类型 | 验证 |
|------|------|------|
| display_name | string | 非空，≤ 64 chars |
| bio | string | 非空，≤ 280 chars |
| website | string | 可选，合法 URL |
| github | string | 可选，合法 URL |
| x | string | 可选，合法 URL |
| publish_mode | select | `manual` / `git-sync` |

### 3.1.2 Dashboard 钱包集成

```typescript
// 注入式钱包 (浏览器扩展: Phantom / Backpack)
interface InjectedWalletAdapter {
    connect(): Promise<{ publicKey: PublicKey }>;
    signTransaction(tx: Transaction): Promise<Transaction>;
    signAllTransactions(txs: Transaction[]): Promise<Transaction[]>;
    disconnect(): Promise<void>;
}

// 本地签名 (开发测试用, 从 keypair file 加载)
interface LocalSignerAdapter {
    publicKey: PublicKey;
    signTransaction(tx: Transaction): Promise<Transaction>;
}
```

**优先级**: 注入式钱包 > 本地签名 > 提示安装钱包

---

## 3.2 CLI 命令规格

### 3.2.1 配置命令

```
gradience config set rpc <url>
gradience config set keypair <path>
gradience config show
```

**存储**: `~/.gradience/config.json`

```json
{
  "rpcEndpoint": "https://api.devnet.solana.com",
  "keypairPath": "~/.config/solana/id.json"
}
```

### 3.2.2 任务命令

```
gradience task post \
  --eval-ref <cid> \
  --reward <lamports> \
  --category <0-7> \
  --deadline <unix-ts> \
  --judge-deadline <unix-ts> \
  --min-stake <lamports> \
  [--judge <pubkey>] \
  [--judge-mode designated|pool]
```

**NO_DNA 输出**:
```json
{ "ok": true, "signature": "5abc...", "taskId": 42 }
```

```
gradience task apply <task_id>
gradience task submit <task_id> --result-ref <cid> [--trace-ref <cid>]
gradience task judge <task_id> --winner <pubkey> --score <60-100>
gradience task cancel <task_id>
gradience task refund <task_id>
gradience task status <task_id>
```

### 3.2.3 Judge 命令

```
gradience judge register --categories <0,2,5> --stake <lamports>
gradience judge unstake
```

### 3.2.4 Profile 命令（新增）

```
gradience profile register --display-name <name> --bio <text> [--website <url>] [--github <url>] [--x <url>]
gradience profile update --display-name <name> --bio <text> [--website <url>] [--github <url>] [--x <url>]
gradience profile publish --mode <manual|git-sync> [--content-ref <cid-or-hash>]
gradience profile show [--agent <pubkey>]
```

### 3.2.5 Agent 模板命令 (P1)

```
gradience create-agent [name]
```

**生成结构**:
```
<name>/
├── agent.ts          ← 主入口（监听任务 → 处理 → 提交）
├── config.ts         ← 配置（RPC、keypair、策略）
├── package.json      ← 依赖 @gradience/sdk
├── tsconfig.json
└── README.md         ← 快速开始说明
```

**agent.ts 模板**:
```typescript
import { GradienceSDK } from '@gradience/sdk';

const sdk = new GradienceSDK({ rpcEndpoint: '...' });

// 1. 监听新任务
const tasks = await sdk.getTasks({ state: 'open', category: 1 });

// 2. 申请任务
for (const task of tasks) {
    await sdk.applyForTask(wallet, { taskId: task.task_id });
}

// 3. 处理并提交结果
// ... your logic here ...
await sdk.submitTaskResult(wallet, { taskId, resultRef, traceRef });
```

---

## 3.3 SDK 公共 API

### 3.3.1 初始化

```typescript
import { GradienceSDK } from '@gradience/sdk';

const sdk = new GradienceSDK({
    indexerEndpoint?: string;       // default: http://127.0.0.1:3001
    attestationEndpoint?: string;   // default: same as indexer
    programAddress?: Address;       // default: deployed program ID
    rpcEndpoint?: string;           // default: http://127.0.0.1:8899
});
```

### 3.3.2 任务操作

```typescript
// 高级 API（推荐）
sdk.postSimple(wallet, { evalRef, reward, category, deadline, judgeDeadline, minStake })
sdk.submitTaskResult(wallet, { taskId, resultRef, traceRef, runtimeEnv })
sdk.judgeTask(wallet, { taskId, winner, score, reasonRef? })
sdk.cancelTask(wallet, { taskId })
sdk.refundExpiredTask(wallet, { taskId })


### 3.3.3 Profile API（新增）

```typescript
interface AgentProfileApi {
    agent: string;
    display_name: string;
    bio: string;
    links: { website?: string; github?: string; x?: string };
    onchain_ref: string | null;
    publish_mode: 'manual' | 'git-sync';
    updated_at: number;
}
```
// 低级 API（完全控制）
### 3.3.4 查询操作
sdk.applyForTask(wallet, { taskId })
sdk.submitResult(wallet, { taskId, resultRef, traceRef, runtimeEnv })
sdk.judgeAndPay(wallet, { taskId, winner, score, reasonRef, loserApplications })
```

### 3.3.3 查询操作

```typescript
sdk.getTasks(params?): Promise<TaskApi[]>
sdk.getTask(taskId): Promise<TaskApi | null>
sdk.getTaskSubmissions(taskId): Promise<SubmissionApi[]>
sdk.getReputation(agent): Promise<ReputationApi | null>
sdk.getJudgePoolEntries(category): Promise<JudgePoolEntryApi[]>
sdk.attestations.list(agent): Promise<TaskCompletionAttestationApi[] | null>
sdk.attestations.listDecoded(agent): Promise<TaskCompletionAttestationRecord[] | null>
sdk.config.get(): Promise<ProgramConfigOnChain | null>
sdk.profile.get(agent): Promise<AgentProfileApi | null>
sdk.profile.upsert(wallet, input): Promise<string>
```

### 3.3.5 链上查询

```typescript
sdk.getReputationOnChain(agent: Address): Promise<ReputationOnChain | null>
sdk.getTaskOnChain(taskId: bigint): Promise<TaskOnChain | null>
```

---

## 3.4 npm 包发布规格

### @gradience/sdk

```json
{
  "name": "@gradience/sdk",
  "version": "0.1.0",
  "main": "dist/sdk.js",
  "types": "dist/sdk.d.ts",
  "exports": {
    ".": { "import": "./dist/sdk.js", "types": "./dist/sdk.d.ts" }
  },
  "peerDependencies": {
    "@solana/kit": "^5.5.0"
  }
}
```

### @gradience/cli

```json
{
  "name": "@gradience/cli",
  "version": "0.1.0",
  "bin": { "gradience": "./gradience.ts" }
}
```

---

## 3.5 Judge Daemon 配置

```
GRADIENCE_RPC_ENDPOINT=https://api.devnet.solana.com
JUDGE_DAEMON_INDEXER_ENDPOINT=http://127.0.0.1:3001
JUDGE_DAEMON_JUDGE_KEYPAIR=/path/to/keypair.json
JUDGE_DAEMON_EVALUATOR_MODE=type_b    # type_a | type_b | type_c1 | auto
```

---

## 3.6 Agent 模板系统 (P1)

### 模板类型

| 模板 | 说明 | 适用场景 |
|------|------|---------|
| `basic` | 最小 Agent（监听 → 申请 → 提交） | 入门学习 |
| `defi-strategy` | DeFi 策略 Agent | 策略竞赛 |
| `code-review` | 代码审查 Agent | 开发任务 |
| `judge` | Judge 节点 | 运行评判服务 |

### 生成逻辑

```typescript
// gradience create-agent my-agent --template basic
// 1. 从 templates/ 目录复制骨架
// 2. 替换 {{name}}, {{programId}} 等占位符
// 3. npm install
// 4. 输出 Quick Start 说明
```

---

## 3.7 边界条件

| 场景 | 预期行为 |
|------|---------|
| Indexer 离线 | SDK 查询返回 null，Dashboard 显示 "Indexer offline" |
| 钱包未连接 | CLI 报错 "keypair not configured"，Dashboard 提示连接钱包 |
| 余额不足 | SDK 抛出 InsufficientFunds，CLI 显示可读错误 |
| 任务已过期 | SDK 抛出 DeadlinePassed (6001)，CLI 显示 "Task deadline has passed" |
| 重复申请 | SDK 抛出 AlreadyApplied (6022)，CLI 显示 "Already applied" |
| RPC 超时 | SDK 重试 3 次（指数退避），然后抛出 |
| Profile 不存在 | `sdk.profile.get()` 返回 null，Dashboard 提示“未发布 Profile” |
| Git 同步失败 | 标记最近同步状态为 failed，并允许手动发布回退 |

---

## ✅ Phase 3 验收标准

- [x] Dashboard 每个页面的数据源和字段已定义
- [x] CLI 每个命令的参数和输出格式已定义
- [x] SDK 公共 API 完整列出
- [x] npm 包发布规格已定义
- [x] Agent 模板系统设计已完成
- [x] 边界条件已覆盖
- [x] Agent Profile Studio 与 CLI/SDK 契约已定义
