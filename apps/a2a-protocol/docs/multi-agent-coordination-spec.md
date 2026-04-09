# Multi-Agent Coordination Module - Technical Spec

> **模块**: A2A Protocol 扩展 - 多 Agent 协调  
> **依赖**: `apps/a2a-protocol/docs/03-technical-spec.md`  
> **状态**: Phase 3 - Technical Specification

---

## 1. 概述

扩展现有 A2A 协议，支持一对多 Agent 任务协调：

- **Task Decomposition**: 将复杂任务拆分为可并行执行的子任务
- **Coordinator Mode**: 协调多个 Agent 竞标、执行、汇总
- **Result Aggregation**: 收集多个 Agent 结果并合成最终输出

## 2. 数据结构

### 2.1 CoordinatedTask

```typescript
interface CoordinatedTask {
    id: string; // UUID
    parentTaskId: bigint; // Arena task reference
    requester: Address; // 发起者
    title: string; // 任务标题
    description: string; // 原始任务描述
    decompositionStrategy: 'auto' | 'manual' | 'llm';
    subtasks: SubtaskSpec[]; // 拆分后的子任务
    status: CoordinatedTaskStatus;
    budget: bigint; // 总预算
    createdAt: number;
    completedAt?: number;
    aggregatedResult?: AggregatedResult;
}

type CoordinatedTaskStatus =
    | 'drafting' // 草稿，未发布
    | 'decomposing' // 正在拆分
    | 'bidding' // 子任务竞标中
    | 'executing' // 执行中
    | 'aggregating' // 结果汇总中
    | 'completed' // 完成
    | 'failed'; // 失败
```

### 2.2 SubtaskSpec

```typescript
interface SubtaskSpec {
    subtaskId: number; // 序号
    title: string;
    requirement: string; // 子任务要求
    requiredCapabilities: bigint; // capability mask
    budget: bigint; // 子任务预算
    priority: number; // 0-100
    dependencies: number[]; // 依赖的 subtaskId
    status: SubtaskExecutionStatus;
    assignedAgent?: Address;
    bids: BidSummary[];
    delivery?: DeliveryRecord;
}

type SubtaskExecutionStatus =
    | 'pending' // 等待依赖
    | 'bidding' // 竞标中
    | 'assigned' // 已分配
    | 'executing' // 执行中
    | 'delivered' // 已交付
    | 'verified' // 已验证
    | 'failed';

interface BidSummary {
    bidder: Address;
    displayName: string;
    quoteAmount: bigint;
    etaSeconds: number;
    reputation: number;
    score: number; // 综合评分
}

interface DeliveryRecord {
    deliveryHash: string;
    resultRef: string; // IPFS/Arweave 引用
    deliveredAt: number;
    verificationStatus: 'pending' | 'approved' | 'rejected';
}
```

### 2.3 AggregatedResult

```typescript
interface AggregatedResult {
    strategy: 'merge' | 'select_best' | 'vote' | 'custom';
    subtaskResults: Record<number, SubtaskResult>;
    finalOutput: string;
    totalCost: bigint;
    completionTime: number;
    qualityScore: number;
}

interface SubtaskResult {
    subtaskId: number;
    agent: Address;
    result: string;
    cost: bigint;
    quality: number;
}
```

## 3. 接口定义

### 3.1 Coordinator Service API

```typescript
interface CoordinatorService {
    // 创建协调任务
    createTask(input: CreateCoordinatedTaskInput): Promise<CoordinatedTask>;

    // 拆分任务（LLM-based 或 manual）
    decomposeTask(taskId: string, strategy?: DecompositionStrategy): Promise<SubtaskSpec[]>;

    // 广播所有子任务
    broadcastSubtasks(taskId: string): Promise<void>;

    // 自动分配（基于评分）
    autoAssignBids(taskId: string): Promise<void>;

    // 手动分配单个子任务
    assignBid(taskId: string, subtaskId: number, bidder: Address): Promise<void>;

    // 验证交付
    verifyDelivery(taskId: string, subtaskId: number, approved: boolean): Promise<void>;

    // 汇总结果
    aggregateResults(taskId: string, strategy: AggregationStrategy): Promise<AggregatedResult>;

    // 查询状态
    getTask(taskId: string): Promise<CoordinatedTask | null>;
    listTasks(requester: Address, status?: CoordinatedTaskStatus): Promise<CoordinatedTask[]>;
}

interface CreateCoordinatedTaskInput {
    parentTaskId: bigint;
    title: string;
    description: string;
    budget: bigint;
    decompositionStrategy: 'auto' | 'manual' | 'llm';
}

interface DecompositionStrategy {
    type: 'llm' | 'rule' | 'manual';
    llmModel?: string;
    rules?: DecompositionRule[];
    manualSubtasks?: Partial<SubtaskSpec>[];
}

interface AggregationStrategy {
    type: 'merge' | 'select_best' | 'vote' | 'custom';
    customLogic?: string;
}
```

### 3.2 REST API Endpoints

| Method | Path                                             | 说明         |
| ------ | ------------------------------------------------ | ------------ |
| POST   | `/v1/coordinator/tasks`                          | 创建协调任务 |
| POST   | `/v1/coordinator/tasks/:id/decompose`            | 拆分任务     |
| POST   | `/v1/coordinator/tasks/:id/broadcast`            | 广播子任务   |
| GET    | `/v1/coordinator/tasks/:id`                      | 获取任务详情 |
| GET    | `/v1/coordinator/tasks/:id/bids`                 | 获取所有竞标 |
| POST   | `/v1/coordinator/tasks/:id/subtasks/:sid/assign` | 分配子任务   |
| POST   | `/v1/coordinator/tasks/:id/subtasks/:sid/verify` | 验证交付     |
| POST   | `/v1/coordinator/tasks/:id/aggregate`            | 汇总结果     |
| GET    | `/v1/coordinator/tasks`                          | 列出任务     |

## 4. Task Decomposition 算法

### 4.1 LLM-Based Decomposition

```typescript
const DECOMPOSITION_PROMPT = `
You are a task decomposition expert. Given a complex task, break it down into independent subtasks.

Rules:
1. Each subtask should be atomic and independently executable
2. Identify dependencies between subtasks
3. Estimate budget allocation based on complexity
4. Assign capability requirements

Input Task:
{description}

Total Budget: {budget} lamports

Output JSON format:
{
  "subtasks": [
    {
      "title": "string",
      "requirement": "string", 
      "priority": 0-100,
      "budgetPercent": 0-100,
      "dependencies": [subtaskIndex],
      "capabilities": ["chat", "code", "research", ...]
    }
  ]
}
`;
```

### 4.2 Capability Mask Mapping

| Capability  | Bit  | Description |
| ----------- | ---- | ----------- |
| CHAT        | 0x01 | 基础对话    |
| CODE        | 0x02 | 代码生成    |
| RESEARCH    | 0x04 | 研究分析    |
| CREATIVE    | 0x08 | 创意内容    |
| DATA        | 0x10 | 数据处理    |
| TRANSLATION | 0x20 | 翻译        |
| REVIEW      | 0x40 | 审核评估    |

## 5. Bid Scoring Algorithm

```typescript
function scoreBid(bid: BidSummary, subtask: SubtaskSpec): number {
    const priceScore = (subtask.budget * 10000n) / bid.quoteAmount;
    const repScore = Math.min(bid.reputation, 10000);
    const etaScore = Math.min((3600 * 10000) / bid.etaSeconds, 10000);

    // 40% price + 40% reputation + 20% speed
    return Number(priceScore) * 0.4 + repScore * 0.4 + etaScore * 0.2;
}
```

## 6. 状态机

```
[drafting] --decompose--> [decomposing] --complete--> [bidding]
                                |
                                v (fail)
                            [failed]

[bidding] --all_assigned--> [executing] --all_delivered--> [aggregating]
              |                  |
              v (timeout)        v (fail)
          [failed]           [failed]

[aggregating] --success--> [completed]
      |
      v (fail)
  [failed]
```

## 7. UI Components

### 7.1 MultiAgentTaskView

- 任务创建表单（标题、描述、预算、拆分策略）
- 子任务可视化（dependency graph）
- 竞标面板（每个子任务的 bids）
- 执行状态追踪（实时更新）
- 结果聚合展示

### 7.2 Components Structure

```
components/
  multi-agent/
    CreateTaskForm.tsx
    SubtaskGraph.tsx
    BidPanel.tsx
    ExecutionTracker.tsx
    ResultAggregator.tsx
    MultiAgentTaskView.tsx (主视图)
```

## 8. 安全考虑

| 威胁                   | 缓解措施                         |
| ---------------------- | -------------------------------- |
| 恶意拆分（过多子任务） | 子任务数量上限 (MAX_SUBTASKS=20) |
| 预算操纵               | 预算分配必须 <= 总预算           |
| Sybil 竞标             | 最低押金 + 信誉阈值              |
| 结果欺诈               | 交付验证 + 争议机制              |

---

**验收标准**:

- [x] 数据结构定义完整
- [x] 接口有参数、返回值定义
- [x] 状态机转换明确
- [x] 算法有公式
- [x] 安全考虑已列出
