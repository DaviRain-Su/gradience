# Phase 3: Technical Spec — Workflow Engine (功法引擎)

> **目的**: 将 Workflow 设计转化为可直接编码的精确规格
> **输入**: `docs/workflow-engine-design-agent-economy-os.md`
> **输出物**: 本文档，代码必须与本规格 100% 一致
>
> ⚠️ **任何模糊之处在本文档解决，不留给实现阶段。**

---

## 变更记录

| 版本 | 日期       | 变更说明 |
| ---- | ---------- | -------- |
| v0.1 | 2026-04-04 | 初稿     |

---

## 3.1 数据结构定义

### 3.1.1 Workflow 核心结构 (TypeScript)

```typescript
/**
 * Workflow 定义 — 可组合、可交易的多链 Agent 技能
 * 存储: IPFS/Arweave (完整 JSON) + Solana (哈希 + 元数据 PDA)
 */
interface GradienceWorkflow {
    // ═══════════════════════════════════════════════════════════════
    // 基础信息
    // ═══════════════════════════════════════════════════════════════

    /** 链上 UUID，Solana Pubkey 格式 */
    id: string; // 32 bytes base58

    /** Workflow 名称，用于展示 */
    name: string; // max 64 chars

    /** 详细描述，支持 Markdown */
    description: string; // max 2048 chars

    /** 创作者 Solana 地址 */
    author: string; // 32 bytes base58

    /** 语义化版本 (semver) */
    version: string; // max 16 chars, e.g. "2.0.0"

    // ═══════════════════════════════════════════════════════════════
    // 执行逻辑
    // ═══════════════════════════════════════════════════════════════

    /** 步骤数组，按顺序执行（除非有 DAG） */
    steps: WorkflowStep[]; // min 1, max 50 steps

    /** 条件分支图（可选，覆盖 steps 线性顺序） */
    dag?: WorkflowDAG;

    /** 全局配置变量，执行时由用户填入 */
    config?: WorkflowConfig[];

    // ═══════════════════════════════════════════════════════════════
    // 经济模型
    // ═══════════════════════════════════════════════════════════════

    /** 定价策略 */
    pricing: WorkflowPricing;

    /** 收益分配规则 */
    revenueShare: RevenueShare;

    // ═══════════════════════════════════════════════════════════════
    // 准入门槛
    // ═══════════════════════════════════════════════════════════════

    requirements: WorkflowRequirements;

    // ═══════════════════════════════════════════════════════════════
    // 元数据
    // ═══════════════════════════════════════════════════════════════

    /** 是否公开可见 */
    isPublic: boolean;

    /** 是否为模板（可 fork） */
    isTemplate: boolean;

    /** 标签，用于搜索 */
    tags: string[]; // max 10 tags, each max 32 chars

    /** 创建时间 (Unix timestamp ms) */
    createdAt: number;

    /** 更新时间 (Unix timestamp ms) */
    updatedAt: number;

    // ═══════════════════════════════════════════════════════════════
    // 链上验证
    // ═══════════════════════════════════════════════════════════════

    /** 内容哈希 (IPFS CID 或 Arweave TxId) */
    contentHash: string; // max 64 chars

    /** 作者对 contentHash 的 ed25519 签名 */
    signature: string; // 64 bytes base64
}
```

### 3.1.2 WorkflowStep 步骤结构

```typescript
/**
 * 单个执行步骤
 */
interface WorkflowStep {
    /** 步骤 ID，在 Workflow 内唯一 */
    id: string; // max 32 chars, e.g. "step1"

    /** 步骤名称，用于展示 */
    name: string; // max 64 chars

    /** 步骤描述（可选） */
    description?: string; // max 256 chars

    // ═══════════════════════════════════════════════════════════════
    // 执行目标
    // ═══════════════════════════════════════════════════════════════

    /** 目标链 */
    chain: SupportedChain;

    /** 操作类型 */
    action: WorkflowAction;

    /** 操作参数（支持模板变量 {{stepX.output}}） */
    params: Record<string, unknown>;

    // ═══════════════════════════════════════════════════════════════
    // 执行控制
    // ═══════════════════════════════════════════════════════════════

    /** 执行条件（可选），不满足则跳过 */
    condition?: StepCondition;

    /** 超时时间（毫秒），默认 60000 */
    timeout?: number; // default 60000, max 600000

    /** 失败重试次数，默认 0 */
    retries?: number; // default 0, max 5

    /** 重试间隔（毫秒），默认 1000 */
    retryDelay?: number; // default 1000, max 30000

    // ═══════════════════════════════════════════════════════════════
    // 流程控制
    // ═══════════════════════════════════════════════════════════════

    /** 成功后下一步 ID（可选，默认顺序执行） */
    next?: string;

    /** 失败后跳转到的步骤 ID（可选，默认终止） */
    onError?: string;

    /** 是否为可选步骤（失败不阻塞后续） */
    optional?: boolean; // default false
}

/**
 * 步骤执行条件
 */
interface StepCondition {
    /** 条件表达式，支持 {{stepX.output.field}} 变量 */
    expression: string; // max 256 chars

    /** 条件不满足时的行为 */
    onFalse: 'skip' | 'abort' | 'goto';

    /** goto 时的目标步骤 ID */
    gotoStep?: string;
}
```

### 3.1.3 支持的链和操作类型

```typescript
/**
 * 支持的链（与 Chain Hub 对齐）
 */
type SupportedChain =
    | 'solana' // 核心链
    | 'tempo' // MPP 流式支付
    | 'xlayer' // 零 Gas + TEE
    | 'sui' // Agentic Commerce
    | 'near' // AI Intents
    | 'ethereum' // L1
    | 'arbitrum' // L2
    | 'base'; // L2

/**
 * 支持的操作类型
 */
type WorkflowAction =
    // ═══════════════════════════════════════════════════════════════
    // 交易类 (DeFi)
    // ═══════════════════════════════════════════════════════════════
    | 'swap' // DEX 兑换
    | 'bridge' // 跨链桥接
    | 'transfer' // 代币转账
    | 'yieldFarm' // 流动性挖矿
    | 'stake' // 质押
    | 'unstake' // 解质押
    | 'borrow' // 借贷
    | 'repay' // 还款

    // ═══════════════════════════════════════════════════════════════
    // 支付类
    // ═══════════════════════════════════════════════════════════════
    | 'x402Payment' // HTTP 402 微支付
    | 'mppStreamReward' // Tempo MPP 流式奖励
    | 'teePrivateSettle' // X Layer TEE 隐私结算
    | 'zeroGasExecute' // X Layer 零 Gas 执行

    // ═══════════════════════════════════════════════════════════════
    // 身份/凭证类
    // ═══════════════════════════════════════════════════════════════
    | 'zkProveIdentity' // ZK 身份验证
    | 'zkProveReputation' // ZK 声誉证明
    | 'verifyCredential' // 验证 SAS 凭证
    | 'linkIdentity' // 关联多链身份

    // ═══════════════════════════════════════════════════════════════
    // AI 类
    // ═══════════════════════════════════════════════════════════════
    | 'nearIntent' // NEAR 意图执行
    | 'aiAnalyze' // AI 分析（调用 LLM）
    | 'aiDecide' // AI 决策

    // ═══════════════════════════════════════════════════════════════
    // 工具类
    // ═══════════════════════════════════════════════════════════════
    | 'httpRequest' // HTTP 调用
    | 'wait' // 等待指定时间
    | 'condition' // 条件判断
    | 'parallel' // 并行执行多个子步骤
    | 'loop' // 循环执行
    | 'setVariable' // 设置变量
    | 'log'; // 记录日志
```

### 3.1.4 经济模型结构

```typescript
/**
 * 定价策略
 */
interface WorkflowPricing {
    /** 定价模型 */
    model: 'oneTime' | 'subscription' | 'perUse' | 'free' | 'revenueShare';

    /** 一次性购买价格 */
    oneTimePrice?: TokenAmount;

    /** 订阅价格 */
    subscription?: {
        price: TokenAmount;
        period: 'day' | 'week' | 'month' | 'year';
    };

    /** 按次付费价格 */
    perUsePrice?: TokenAmount;

    /** 免费但抽成（revenueShare 模式） */
    creatorShareBps?: number; // 0-10000, e.g. 500 = 5%
}

/**
 * 代币金额
 */
interface TokenAmount {
    /** 代币 mint 地址，Pubkey::default() = SOL */
    mint: string;

    /** 金额（最小单位，如 lamports） */
    amount: string; // BigInt string
}

/**
 * 收益分配规则
 * 总和必须 = 10000 (100%)
 */
interface RevenueShare {
    /** 创作者分成 (bps) */
    creator: number; // e.g. 500 = 5%

    /** 用户（Workflow 使用者）分成 (bps) */
    user: number; // e.g. 9000 = 90%

    /** 执行 Agent 分成 (bps) */
    agent: number; // e.g. 0 = 0%

    /** 协议分成 (bps) — 固定 200 = 2% */
    protocol: 200; // immutable

    /** Judge 分成 (bps) — 固定 300 = 3% */
    judge: 300; // immutable
}

/**
 * 准入门槛
 */
interface WorkflowRequirements {
    /** 最低声誉分数 (0-100) */
    minReputation?: number;

    /** 持仓要求 */
    tokens?: {
        mint: string;
        minAmount: string;
    }[];

    /** ZK 证明要求 */
    zkProofs?: {
        type: 'kyc' | 'accredited' | 'custom';
        verifier?: string;
    }[];

    /** 白名单地址 */
    whitelist?: string[];
}
```

### 3.1.5 链上账户结构 (Solana PDA)

```rust
/// Workflow 元数据 PDA
/// PDA seeds: [b"workflow", workflow_id.as_ref()]
/// DATA_LEN = 265 bytes, LEN = 267 bytes (含 discriminator + version)
#[derive(Clone)]
pub struct WorkflowMetadata {
    pub workflow_id:    Pubkey,         // 32  — Workflow UUID
    pub author:         Pubkey,         // 32  — 创作者地址
    pub content_hash:   [u8; 64],       // 64  — IPFS/Arweave 哈希
    pub version:        [u8; 16],       // 16  — 版本号 (UTF-8)
    pub pricing_model:  u8,             // 1   — 0=free, 1=oneTime, 2=subscription, 3=perUse, 4=revenueShare
    pub price_mint:     Pubkey,         // 32  — 价格代币 mint
    pub price_amount:   u64,            // 8   — 价格金额
    pub creator_share:  u16,            // 2   — 创作者分成 (bps)
    pub total_purchases:u32,            // 4   — 总购买数
    pub total_executions:u32,           // 4   — 总执行数
    pub avg_rating:     u16,            // 2   — 平均评分 (0-10000)
    pub is_public:      bool,           // 1   — 是否公开
    pub is_active:      bool,           // 1   — 是否激活
    pub created_at:     i64,            // 8   — 创建时间
    pub updated_at:     i64,            // 8   — 更新时间
    pub bump:           u8,             // 1   — PDA bump
}
// DATA_LEN = 32+32+64+16+1+32+8+2+4+4+2+1+1+8+8+1 = 216
// 预留扩展空间至 265 bytes

/// Workflow 购买记录 / 访问权限 PDA
/// PDA seeds: [b"access", workflow_id.as_ref(), user.as_ref()]
/// DATA_LEN = 90 bytes
#[derive(Clone)]
pub struct WorkflowAccess {
    pub workflow_id:    Pubkey,         // 32  — Workflow ID
    pub user:           Pubkey,         // 32  — 用户地址
    pub access_type:    u8,             // 1   — 0=purchased, 1=subscribed, 2=rented
    pub purchased_at:   i64,            // 8   — 购买时间
    pub expires_at:     i64,            // 8   — 过期时间 (0=永久)
    pub executions:     u32,            // 4   — 已执行次数
    pub max_executions: u32,            // 4   — 最大执行次数 (0=无限)
    pub bump:           u8,             // 1   — PDA bump
}

/// Workflow 评价 PDA
/// PDA seeds: [b"review", workflow_id.as_ref(), reviewer.as_ref()]
/// DATA_LEN = 114 bytes
#[derive(Clone)]
pub struct WorkflowReview {
    pub workflow_id:    Pubkey,         // 32  — Workflow ID
    pub reviewer:       Pubkey,         // 32  — 评价者地址
    pub rating:         u8,             // 1   — 评分 (1-5)
    pub comment_hash:   [u8; 32],       // 32  — 评论内容哈希 (IPFS)
    pub created_at:     i64,            // 8   — 评价时间
    pub helpful_votes:  u32,            // 4   — 有帮助票数
    pub verified:       bool,           // 1   — 是否已验证购买
    pub bump:           u8,             // 1   — PDA bump
}
// 预留至 114 bytes
```

### 3.1.6 执行状态结构

```typescript
/**
 * Workflow 执行结果
 */
interface WorkflowExecutionResult {
    /** 执行 ID */
    executionId: string;

    /** Workflow ID */
    workflowId: string;

    /** 执行者（Agent 或用户） */
    executor: string;

    /** 执行状态 */
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

    /** 各步骤结果 */
    stepResults: StepResult[];

    /** 总耗时（毫秒） */
    duration: number;

    /** 总 Gas 消耗 */
    totalGas: string;

    /** 总收益（如有） */
    totalRevenue?: TokenAmount;

    /** 错误信息（如有） */
    error?: {
        stepId: string;
        code: number;
        message: string;
    };

    /** 开始时间 */
    startedAt: number;

    /** 完成时间 */
    completedAt?: number;
}

/**
 * 单步骤执行结果
 */
interface StepResult {
    stepId: string;
    status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
    chain: SupportedChain;
    action: WorkflowAction;

    /** 输出数据（可被后续步骤引用） */
    output?: Record<string, unknown>;

    /** 链上交易哈希 */
    txHash?: string;

    /** 耗时（毫秒） */
    duration: number;

    /** Gas 消耗 */
    gasUsed?: string;

    /** 错误信息 */
    error?: string;

    /** 重试次数 */
    retryCount: number;
}
```

---

## 3.2 接口定义

### 3.2.1 Workflow Engine SDK

```typescript
/**
 * Workflow Engine SDK — 客户端接口
 * 包: @gradiences/workflow-engine
 */
interface WorkflowEngineSDK {
    // ═══════════════════════════════════════════════════════════════
    // Workflow 管理
    // ═══════════════════════════════════════════════════════════════

    /**
     * 创建 Workflow（上传到 IPFS + 注册链上）
     * @param workflow Workflow 定义
     * @returns Workflow ID
     * @throws InvalidWorkflow — 验证失败
     * @throws UploadFailed — IPFS 上传失败
     */
    create(workflow: GradienceWorkflow): Promise<string>;

    /**
     * 更新 Workflow（新版本）
     * @param workflowId 现有 Workflow ID
     * @param workflow 新版本定义
     * @returns 新版本 Workflow ID
     * @throws NotAuthor — 非创作者
     */
    update(workflowId: string, workflow: GradienceWorkflow): Promise<string>;

    /**
     * 获取 Workflow 详情
     * @param workflowId Workflow ID
     * @returns Workflow 完整定义
     * @throws NotFound — 不存在
     */
    get(workflowId: string): Promise<GradienceWorkflow>;

    /**
     * 验证 Workflow 定义
     * @param workflow Workflow 定义
     * @returns 验证结果
     */
    validate(workflow: GradienceWorkflow): Promise<ValidationResult>;

    // ═══════════════════════════════════════════════════════════════
    // 执行
    // ═══════════════════════════════════════════════════════════════

    /**
     * 执行 Workflow
     * @param workflowId Workflow ID
     * @param config 用户配置变量
     * @param options 执行选项
     * @returns 执行结果
     * @throws NoAccess — 无访问权限
     * @throws RequirementsNotMet — 不满足准入门槛
     */
    execute(
        workflowId: string,
        config?: Record<string, unknown>,
        options?: ExecutionOptions,
    ): Promise<WorkflowExecutionResult>;

    /**
     * 模拟执行（不上链，用于测试）
     */
    simulate(workflow: GradienceWorkflow, config?: Record<string, unknown>): Promise<WorkflowExecutionResult>;

    /**
     * 取消正在执行的 Workflow
     */
    cancel(executionId: string): Promise<void>;

    /**
     * 获取执行历史
     */
    getExecutions(
        workflowId: string,
        options?: { limit?: number; offset?: number },
    ): Promise<WorkflowExecutionResult[]>;

    // ═══════════════════════════════════════════════════════════════
    // Marketplace
    // ═══════════════════════════════════════════════════════════════

    /**
     * 购买 Workflow
     * @returns 访问权限 PDA 地址
     */
    purchase(workflowId: string): Promise<string>;

    /**
     * 订阅 Workflow
     */
    subscribe(workflowId: string, periods: number): Promise<string>;

    /**
     * 检查访问权限
     */
    hasAccess(workflowId: string, user?: string): Promise<boolean>;

    /**
     * 评价 Workflow
     */
    review(workflowId: string, rating: number, comment: string): Promise<void>;

    /**
     * 浏览 Marketplace
     */
    browse(filters: BrowseFilters): Promise<WorkflowListing[]>;
}

/**
 * 执行选项
 */
interface ExecutionOptions {
    /** 是否等待完成（默认 true） */
    wait?: boolean;

    /** 最大等待时间（毫秒） */
    timeout?: number;

    /** 执行回调 */
    onStepComplete?: (result: StepResult) => void;

    /** Gas 上限 */
    maxGas?: string;

    /** 是否开启详细日志 */
    verbose?: boolean;
}

/**
 * 浏览筛选条件
 */
interface BrowseFilters {
    tags?: string[];
    chains?: SupportedChain[];
    pricingModel?: WorkflowPricing['model'];
    minRating?: number;
    author?: string;
    sortBy?: 'popular' | 'newest' | 'rating' | 'price';
    limit?: number;
    offset?: number;
}
```

### 3.2.2 Solana Program 指令

#### `create_workflow`

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 调用者   | 任何人（创作者）                      |
| 前置条件 | content_hash 有效；signature 验证通过 |
| 后置条件 | WorkflowMetadata PDA 创建             |

参数：

| 参数          | 类型     | 约束     | 说明              |
| ------------- | -------- | -------- | ----------------- |
| content_hash  | [u8; 64] | 非空     | IPFS/Arweave 哈希 |
| version       | String   | len ≤ 16 | 版本号            |
| pricing_model | u8       | 0-4      | 定价模型          |
| price_mint    | Pubkey   | —        | 价格代币          |
| price_amount  | u64      | ≥ 0      | 价格金额          |
| creator_share | u16      | 0-10000  | 创作者分成        |
| is_public     | bool     | —        | 是否公开          |

账户：

| 账户           | 类型                 | mut | signer | 说明                              |
| -------------- | -------------------- | --- | ------ | --------------------------------- |
| author         | SystemAccount        | ✅  | ✅     | 创作者，支付租金                  |
| workflow       | WorkflowMetadata PDA | ✅  | ❌     | seeds: [b"workflow", workflow_id] |
| system_program | Program              | ❌  | ❌     | —                                 |

---

#### `purchase_workflow`

| 属性     | 值                                        |
| -------- | ----------------------------------------- |
| 调用者   | 任何人（购买者）                          |
| 前置条件 | Workflow 存在且 is_active；用户有足够余额 |
| 后置条件 | WorkflowAccess PDA 创建；资金转移到创作者 |

参数：

| 参数        | 类型   | 约束 | 说明        |
| ----------- | ------ | ---- | ----------- |
| workflow_id | Pubkey | 存在 | Workflow ID |

账户：

| 账户                 | 类型                 | mut | signer | 说明                                   |
| -------------------- | -------------------- | --- | ------ | -------------------------------------- |
| buyer                | SystemAccount        | ✅  | ✅     | 购买者                                 |
| author               | SystemAccount        | ✅  | ❌     | 创作者（收款）                         |
| workflow             | WorkflowMetadata PDA | ✅  | ❌     | total_purchases++                      |
| access               | WorkflowAccess PDA   | ✅  | ❌     | seeds: [b"access", workflow_id, buyer] |
| treasury             | Treasury PDA         | ✅  | ❌     | 协议收入                               |
| buyer_token_account  | TokenAccount         | ✅  | ❌     | 若 SPL Token 支付                      |
| author_token_account | TokenAccount         | ✅  | ❌     | 若 SPL Token 支付                      |
| token_program        | Program              | ❌  | ❌     | 若 SPL Token                           |
| system_program       | Program              | ❌  | ❌     | —                                      |

---

#### `review_workflow`

| 属性     | 值                                       |
| -------- | ---------------------------------------- |
| 调用者   | 已购买/执行过的用户                      |
| 前置条件 | WorkflowAccess 存在；未评价过            |
| 后置条件 | WorkflowReview PDA 创建；avg_rating 更新 |

参数：

| 参数         | 类型     | 约束 | 说明     |
| ------------ | -------- | ---- | -------- |
| rating       | u8       | 1-5  | 评分     |
| comment_hash | [u8; 32] | —    | 评论哈希 |

---

### 3.2.3 REST API (Indexer)

**`GET /api/workflows`** — 浏览 Marketplace

```
Request:
  Query: {
    tags?: string[]
    chains?: string[]
    pricing?: string
    minRating?: number
    author?: string
    sortBy?: 'popular' | 'newest' | 'rating' | 'price'
    limit?: number (default 20, max 100)
    offset?: number (default 0)
  }

Response 200:
  {
    "workflows": [
      {
        "id": "string",
        "name": "string",
        "description": "string",
        "author": "string",
        "version": "string",
        "pricing": { ... },
        "tags": ["string"],
        "totalPurchases": 123,
        "totalExecutions": 456,
        "avgRating": 4.5,
        "createdAt": 1712345678000
      }
    ],
    "total": 100,
    "hasMore": true
  }
```

**`GET /api/workflows/:id`** — 获取 Workflow 详情

```
Response 200:
  {
    "workflow": { ... },      // 完整 GradienceWorkflow 对象
    "metadata": {             // 链上元数据
      "totalPurchases": 123,
      "totalExecutions": 456,
      "avgRating": 4.5,
      "reviews": [...]
    }
  }
```

**`GET /api/workflows/:id/executions`** — 获取执行历史

**`POST /api/workflows/:id/simulate`** — 模拟执行

---

## 3.3 错误码定义

| 错误码 | 名称                   | 触发条件               | 用户提示                           |
| ------ | ---------------------- | ---------------------- | ---------------------------------- |
| 7000   | InvalidWorkflow        | Workflow JSON 格式错误 | "无效的 Workflow 定义"             |
| 7001   | InvalidStep            | 步骤定义错误           | "步骤 {stepId} 定义无效"           |
| 7002   | UnsupportedChain       | 不支持的链             | "不支持链 {chain}"                 |
| 7003   | UnsupportedAction      | 不支持的操作           | "不支持操作 {action}"              |
| 7004   | CircularDependency     | DAG 存在循环           | "步骤依赖存在循环"                 |
| 7010   | WorkflowNotFound       | Workflow 不存在        | "Workflow 不存在"                  |
| 7011   | NoAccess               | 无访问权限             | "无权访问此 Workflow"              |
| 7012   | AccessExpired          | 访问权限已过期         | "访问权限已过期"                   |
| 7013   | ExecutionLimitReached  | 执行次数已用完         | "执行次数已达上限"                 |
| 7020   | RequirementsNotMet     | 不满足准入门槛         | "不满足 Workflow 准入要求"         |
| 7021   | InsufficientReputation | 声誉不足               | "声誉分数不足 (需要 {min})"        |
| 7022   | InsufficientBalance    | 余额不足               | "代币余额不足"                     |
| 7030   | StepExecutionFailed    | 步骤执行失败           | "步骤 {stepId} 执行失败: {reason}" |
| 7031   | StepTimeout            | 步骤执行超时           | "步骤 {stepId} 执行超时"           |
| 7032   | MaxRetriesExceeded     | 重试次数超限           | "步骤 {stepId} 重试次数超限"       |
| 7040   | NotAuthor              | 非创作者               | "只有创作者可以执行此操作"         |
| 7041   | AlreadyReviewed        | 已评价过               | "您已评价过此 Workflow"            |
| 7050   | UploadFailed           | 上传失败               | "Workflow 上传失败"                |
| 7051   | SignatureInvalid       | 签名无效               | "Workflow 签名验证失败"            |

---

## 3.4 状态机

### Workflow 状态

```
                      ┌─────────────────────────────────────┐
                      │                                     │
                      ▼                                     │
[Draft] ──create──▶ [Active] ──deactivate──▶ [Inactive] ──activate──┘
                      │
                      │ delete (only if no purchases)
                      ▼
                   [Deleted]
```

| 当前状态        | 触发动作            | 条件                | 新状态   | 副作用            |
| --------------- | ------------------- | ------------------- | -------- | ----------------- |
| Draft           | create_workflow     | 验证通过            | Active   | 创建 PDA          |
| Active          | deactivate_workflow | 是创作者            | Inactive | is_active = false |
| Inactive        | activate_workflow   | 是创作者            | Active   | is_active = true  |
| Active/Inactive | delete_workflow     | total_purchases = 0 | Deleted  | 关闭 PDA          |

### 执行状态

```
[Pending] ──start──▶ [Running] ──complete──▶ [Completed]
                         │
                         ├── fail ──▶ [Failed]
                         │
                         └── cancel ──▶ [Cancelled]
```

---

## 3.5 算法与计算

### 收益分配算法

```typescript
/**
 * Workflow 执行收益分配
 *
 * 输入: totalRevenue (执行产生的总收益)
 * 输出: 各方分配金额
 */
function distributeRevenue(totalRevenue: bigint, revenueShare: RevenueShare): Distribution {
    // 1. 协议费 (固定 2%)
    const protocolFee = (totalRevenue * 200n) / 10000n;

    // 2. Judge 费 (固定 3%)
    const judgeFee = (totalRevenue * 300n) / 10000n;

    // 3. 剩余金额
    const remaining = totalRevenue - protocolFee - judgeFee;

    // 4. 按比例分配
    const creatorAmount = (remaining * BigInt(revenueShare.creator)) / 10000n;
    const agentAmount = (remaining * BigInt(revenueShare.agent)) / 10000n;
    const userAmount = remaining - creatorAmount - agentAmount; // 余数归用户

    return {
        protocol: protocolFee,
        judge: judgeFee,
        creator: creatorAmount,
        agent: agentAmount,
        user: userAmount,
    };
}
```

### 模板变量解析算法

```typescript
/**
 * 解析模板变量 {{stepX.output.field}}
 */
function parseTemplate(template: string, context: Map<string, StepResult>): unknown {
    const pattern = /\{\{(\w+)\.(\w+)(?:\.(\w+))?\}\}/g;

    return template.replace(pattern, (match, stepId, prop, subProp) => {
        const result = context.get(stepId);
        if (!result) return match;

        if (prop === 'output' && subProp) {
            return String(result.output?.[subProp] ?? match);
        }
        return String(result[prop as keyof StepResult] ?? match);
    });
}
```

---

## 3.6 安全规则

| 规则              | 实现方式                   | 验证方法           |
| ----------------- | -------------------------- | ------------------ |
| Workflow 签名验证 | ed25519 签名 contentHash   | 创建时验证         |
| 访问权限检查      | 查询 WorkflowAccess PDA    | 执行前验证         |
| 准入门槛验证      | 链上查询声誉/余额          | 执行前验证         |
| 步骤执行隔离      | 每步独立 try-catch         | 单步失败不影响状态 |
| Gas 上限保护      | 配置 maxGas                | 超限自动终止       |
| 敏感操作二次确认  | transfer/bridge 需显式确认 | 执行时提示         |

---

## 3.7 PDA 种子定义

| PDA 用途         | 种子                                                   | Bump   | 说明            |
| ---------------- | ------------------------------------------------------ | ------ | --------------- |
| WorkflowMetadata | `[b"workflow", workflow_id.as_ref()]`                  | stored | Workflow 元数据 |
| WorkflowAccess   | `[b"access", workflow_id.as_ref(), user.as_ref()]`     | stored | 用户访问权限    |
| WorkflowReview   | `[b"review", workflow_id.as_ref(), reviewer.as_ref()]` | stored | 用户评价        |

---

## 3.8 边界条件清单

| #   | 边界条件                    | 预期行为                      |
| --- | --------------------------- | ----------------------------- |
| 1   | Workflow steps = 0          | 创建时返回 InvalidWorkflow    |
| 2   | Workflow steps > 50         | 创建时返回 InvalidWorkflow    |
| 3   | 步骤 timeout = 0            | 使用默认值 60000ms            |
| 4   | 步骤 timeout > 600000       | 截断为 600000ms               |
| 5   | 循环 DAG                    | 创建时返回 CircularDependency |
| 6   | 模板变量引用不存在的步骤    | 执行时保留原文                |
| 7   | 订阅到期时正在执行          | 允许完成当前执行              |
| 8   | 执行次数用完时正在执行      | 允许完成当前执行              |
| 9   | 并行步骤全部失败            | 返回第一个错误                |
| 10  | 跨链桥超时                  | 重试或返回 StepTimeout        |
| 11  | 收益为 0                    | 跳过分配，不报错              |
| 12  | 创作者删除已购买的 Workflow | 返回错误，禁止删除            |

---

## ✅ Phase 3 验收标准

- [x] 所有数据结构精确到字段类型
- [x] SDK 接口完整定义
- [x] Solana Program 指令定义
- [x] REST API 定义
- [x] 错误码统一编号 (7000-7051)
- [x] 状态机转换精确
- [x] 收益分配算法有伪代码
- [x] 安全规则已映射
- [x] PDA 种子定义
- [x] 边界条件 ≥ 10 个

**验收通过后，进入 Phase 4: Task Breakdown →**
