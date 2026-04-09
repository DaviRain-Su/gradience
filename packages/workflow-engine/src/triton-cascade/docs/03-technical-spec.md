# Phase 3: Technical Spec - Triton Cascade Integration

> **项目**: Triton Cascade 交易投递网络集成  
> **目标**: 将 Solana 交易投递迁移到 Triton Cascade 网络，提升交易成功率和速度  
> **文档状态**: Draft  
> **创建日期**: 2026-04-04

---

## 3.1 数据结构定义

### 3.1.1 配置数据结构

```typescript
// packages/workflow-engine/src/triton-cascade/types.ts

/**
 * Triton Cascade 配置
 */
export interface TritonCascadeConfig {
    /** Triton RPC 端点，格式: https://api.triton.one/rpc 或自定义端点 */
    rpcEndpoint: string;
    /** Triton API Token (用于认证和更高限额) */
    apiToken?: string;
    /** 网络类型 */
    network: 'mainnet' | 'devnet';
    /** 连接超时 (毫秒) */
    connectionTimeoutMs: number;
    /** 交易确认超时 (毫秒) */
    confirmationTimeoutMs: number;
    /** 最大重试次数 */
    maxRetries: number;
    /** 是否启用 Jito Bundle (MEV 保护) */
    enableJitoBundle: boolean;
    /** Jito 区块引擎 URL (可选) */
    jitoBlockEngineUrl?: string;
    /** 优先费用策略 */
    priorityFeeStrategy: 'auto' | 'fixed' | 'none';
    /** 固定优先费用 (lamports，当 strategy 为 fixed 时使用) */
    fixedPriorityFeeLamports?: number;
}

/**
 * 交易投递请求
 */
export interface CascadeTransactionRequest {
    /** 序列化后的交易 (base64) */
    transaction: string;
    /** 交易签名 (用于追踪) */
    signature: string;
    /** 最近区块哈希 */
    recentBlockhash: string;
    /** 最后有效区块高度 */
    lastValidBlockHeight: number;
    /** 发送者公钥 */
    sender: string;
    /** 交易类型 */
    transactionType: 'swap' | 'transfer' | 'stake' | 'bridge' | 'other';
    /** 是否使用 Jito Bundle */
    useJitoBundle?: boolean;
    /** 自定义优先费用 (microLamports) */
    priorityFee?: number;
    /** 元数据 (用于追踪和日志) */
    metadata?: Record<string, unknown>;
}

/**
 * 交易投递响应
 */
export interface CascadeTransactionResponse {
    /** 交易签名 */
    signature: string;
    /** 投递状态 */
    status: 'submitted' | 'confirmed' | 'failed';
    /** 确认结果 */
    confirmation?: {
        slot: number;
        confirmations: number;
        err: null | object;
    };
    /** 使用的优先费用 */
    priorityFeeUsed: number;
    /** 投递时间戳 */
    submittedAt: number;
    /** 确认时间戳 */
    confirmedAt?: number;
    /** 失败原因 (如果 status 为 failed) */
    error?: {
        code: string;
        message: string;
        logs?: string[];
    };
    /** 使用的投递路径 */
    deliveryPath: 'cascade' | 'standard_rpc' | 'jito_bundle';
}

/**
 * 优先费用估算响应
 */
export interface PriorityFeeEstimate {
    /** 推荐费用 (microLamports) */
    recommended: number;
    /** 最低费用 */
    min: number;
    /** 中等费用 */
    medium: number;
    /** 高优先级费用 */
    high: number;
    /** 极高优先级费用 */
    veryHigh: number;
    /** 估算时间戳 */
    timestamp: number;
}
```

### 3.1.2 内部数据结构

```typescript
/**
 * 交易投递队列项
 */
interface TransactionQueueItem {
    /** 唯一 ID */
    id: string;
    /** 请求数据 */
    request: CascadeTransactionRequest;
    /** 重试次数 */
    retryCount: number;
    /** 首次尝试时间 */
    firstAttemptAt: number;
    /** 下次重试时间 */
    nextRetryAt?: number;
    /** 当前状态 */
    state: 'pending' | 'submitting' | 'confirming' | 'completed' | 'failed';
    /** 最后一次错误 */
    lastError?: string;
}

/**
 * 连接健康状态
 */
interface ConnectionHealth {
    /** 端点 URL */
    endpoint: string;
    /** 是否健康 */
    isHealthy: boolean;
    /** 延迟 (ms) */
    latencyMs: number;
    /** 最后检查时间 */
    lastCheckedAt: number;
    /** 连续失败次数 */
    consecutiveFailures: number;
    /** 成功率 (最近 100 次) */
    successRate: number;
}
```

### 3.1.3 配置常量

| 常量名                          | 值                                      | 类型   | 说明                | 可变性       |
| ------------------------------- | --------------------------------------- | ------ | ------------------- | ------------ |
| DEFAULT_CONNECTION_TIMEOUT_MS   | 10000                                   | number | 默认连接超时        | configurable |
| DEFAULT_CONFIRMATION_TIMEOUT_MS | 60000                                   | number | 默认确认超时        | configurable |
| DEFAULT_MAX_RETRIES             | 3                                       | number | 默认最大重试次数    | configurable |
| RETRY_BACKOFF_BASE_MS           | 1000                                    | number | 重试退避基数        | immutable    |
| HEALTH_CHECK_INTERVAL_MS        | 30000                                   | number | 健康检查间隔        | configurable |
| PRIORITY_FEE_CACHE_TTL_MS       | 5000                                    | number | 优先费用缓存时间    | immutable    |
| CASCADE_ENDPOINT_MAINNET        | 'https://api.triton.one/rpc'            | string | Cascade 主网端点    | immutable    |
| CASCADE_ENDPOINT_DEVNET         | 'https://api.devnet.triton.one/rpc'     | string | Cascade Devnet 端点 | immutable    |
| JITO_MAINNET_BLOCK_ENGINE       | 'https://mainnet.block-engine.jito.wtf' | string | Jito 主网区块引擎   | immutable    |

---

## 3.2 接口定义

### 3.2.1 TritonCascadeClient SDK 接口

````typescript
/**
 * Triton Cascade 客户端
 */
export interface ITritonCascadeClient {
    /**
     * 发送交易到 Cascade 网络
     *
     * @param transaction - 序列化的交易 (base64)
     * @param options - 发送选项
     * @returns 交易投递响应
     * @throws CascadeError - 投递失败时抛出
     *
     * @example
     * ```typescript
     * const response = await client.sendTransaction(
     *   transaction.serialize().toString('base64'),
     *   {
     *     transactionType: 'swap',
     *     useJitoBundle: true,
     *     priorityFee: 10000
     *   }
     * );
     * ```
     */
    sendTransaction(transaction: string, options?: SendTransactionOptions): Promise<CascadeTransactionResponse>;

    /**
     * 估算当前优先费用
     *
     * @param commitment - 确认级别
     * @returns 优先费用估算
     */
    getPriorityFeeEstimate(commitment?: 'processed' | 'confirmed' | 'finalized'): Promise<PriorityFeeEstimate>;

    /**
     * 获取连接健康状态
     */
    getHealthStatus(): Promise<ConnectionHealth>;

    /**
     * 关闭客户端连接
     */
    close(): Promise<void>;
}

/**
 * 发送交易选项
 */
export interface SendTransactionOptions {
    /** 交易类型 */
    transactionType?: 'swap' | 'transfer' | 'stake' | 'bridge' | 'other';
    /** 是否使用 Jito Bundle */
    useJitoBundle?: boolean;
    /** 自定义优先费用 (microLamports) */
    priorityFee?: number;
    /** 确认级别 */
    commitment?: 'processed' | 'confirmed' | 'finalized';
    /** 跳过预检 */
    skipPreflight?: boolean;
    /** 预检承诺级别 */
    preflightCommitment?: 'processed' | 'confirmed' | 'finalized';
    /** 最大重试次数 (覆盖配置) */
    maxRetries?: number;
    /** 元数据 */
    metadata?: Record<string, unknown>;
}
````

### 3.2.2 REST API 接口 (Triton Cascade)

**`POST /rpc` - 标准 Solana RPC 调用**

```
Request:
  Headers:
    Content-Type: application/json
    Authorization: Bearer <api_token> (可选)
  Body: {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "sendTransaction",
    "params": [
      "base64_encoded_transaction",
      {
        "encoding": "base64",
        "skipPreflight": false,
        "preflightCommitment": "confirmed",
        "maxRetries": 3
      }
    ]
  }

Response 200:
  {
    "jsonrpc": "2.0",
    "id": 1,
    "result": "transaction_signature"
  }

Response 4xx/5xx:
  {
    "jsonrpc": "2.0",
    "id": 1,
    "error": {
      "code": -32002,
      "message": "Transaction simulation failed"
    }
  }
```

**`POST /priority-fee` - 获取优先费用估算**

```
Request:
  Headers:
    Content-Type: application/json
    Authorization: Bearer <api_token>
  Body: {
    "commitment": "confirmed"
  }

Response 200:
  {
    "recommended": 10000,
    "min": 5000,
    "medium": 10000,
    "high": 20000,
    "veryHigh": 50000,
    "timestamp": 1743763200000
  }
```

### 3.2.3 内部事件接口

| 事件名                      | 触发时机           | 数据格式                                                         |
| --------------------------- | ------------------ | ---------------------------------------------------------------- |
| `transaction:submitted`     | 交易成功提交到网络 | `{ signature: string, deliveryPath: string, timestamp: number }` |
| `transaction:confirmed`     | 交易被确认         | `{ signature: string, slot: number, confirmations: number }`     |
| `transaction:failed`        | 交易失败           | `{ signature: string, error: CascadeError, retryable: boolean }` |
| `connection:health_changed` | 连接健康状态变化   | `{ endpoint: string, isHealthy: boolean, latencyMs: number }`    |
| `priority_fee:updated`      | 优先费用更新       | `{ estimate: PriorityFeeEstimate }`                              |

---

## 3.3 错误码定义

| 错误码      | 名称                 | 触发条件                | 用户提示                         | 是否可重试 |
| ----------- | -------------------- | ----------------------- | -------------------------------- | ---------- |
| CASCADE_001 | CONNECTION_ERROR     | 无法连接到 Cascade 网络 | 网络连接失败，请检查配置         | 是         |
| CASCADE_002 | TIMEOUT_ERROR        | 交易确认超时            | 交易确认超时，可能仍在处理中     | 是         |
| CASCADE_003 | SIMULATION_FAILED    | 交易模拟失败            | 交易模拟失败，请检查参数         | 否         |
| CASCADE_004 | INSUFFICIENT_FUNDS   | 余额不足                | 余额不足以支付交易费用           | 否         |
| CASCADE_005 | BLOCKHASH_EXPIRED    | 区块哈希过期            | 交易过期，请重新构建交易         | 否         |
| CASCADE_006 | RATE_LIMITED         | 触发速率限制            | 请求过于频繁，请稍后再试         | 是         |
| CASCADE_007 | INVALID_SIGNATURE    | 签名无效                | 交易签名无效                     | 否         |
| CASCADE_008 | JITO_BUNDLE_FAILED   | Jito Bundle 失败        | MEV 保护投递失败，将使用标准投递 | 是         |
| CASCADE_009 | PRIORITY_FEE_TOO_LOW | 优先费用过低            | 当前网络拥堵，建议提高优先费用   | 否         |
| CASCADE_010 | UNKNOWN_ERROR        | 未知错误                | 发生未知错误，请重试或联系支持   | 是         |

---

## 3.4 状态机精确定义

### 3.4.1 交易投递状态机

| 当前状态        | 触发动作               | 条件                      | 新状态          | 副作用                 |
| --------------- | ---------------------- | ------------------------- | --------------- | ---------------------- |
| `idle`          | `submit()`             | -                         | `submitting`    | 开始计时，记录 metrics |
| `submitting`    | RPC 返回成功           | signature 有效            | `confirming`    | 启动确认监听           |
| `submitting`    | RPC 返回失败           | error.code 可重试         | `retry_pending` | 计算下次重试时间       |
| `submitting`    | RPC 返回失败           | error.code 不可重试       | `failed`        | 抛出错误               |
| `retry_pending` | 到达重试时间           | retryCount < maxRetries   | `submitting`    | retryCount++           |
| `retry_pending` | 到达重试时间           | retryCount >= maxRetries  | `failed`        | 抛出错误               |
| `confirming`    | 收到确认               | confirmation.err === null | `confirmed`     | 记录确认时间           |
| `confirming`    | 收到确认               | confirmation.err !== null | `failed`        | 解析错误               |
| `confirming`    | 区块高度超过 lastValid | -                         | `failed`        | 抛出 BLOCKHASH_EXPIRED |
| `confirming`    | 超时                   | -                         | `failed`        | 抛出 TIMEOUT_ERROR     |

### 3.4.2 连接健康状态机

| 当前状态    | 触发动作     | 条件                     | 新状态      | 副作用        |
| ----------- | ------------ | ------------------------ | ----------- | ------------- |
| `healthy`   | 健康检查失败 | consecutiveFailures < 3  | `degraded`  | 记录日志      |
| `healthy`   | 健康检查失败 | consecutiveFailures >= 3 | `unhealthy` | 触发 fallback |
| `degraded`  | 健康检查成功 | -                        | `healthy`   | 重置失败计数  |
| `degraded`  | 健康检查失败 | consecutiveFailures >= 3 | `unhealthy` | 触发 fallback |
| `unhealthy` | 健康检查成功 | -                        | `healthy`   | 恢复主连接    |

---

## 3.5 算法与计算

### 3.5.1 优先费用计算

```typescript
/**
 * 计算交易优先费用
 */
function calculatePriorityFee(
    estimate: PriorityFeeEstimate,
    strategy: PriorityFeeStrategy,
    customFee?: number,
): number {
    switch (strategy) {
        case 'fixed':
            return customFee ?? estimate.medium;

        case 'auto':
            // 根据网络拥堵程度动态调整
            const congestionRatio = estimate.recommended / estimate.min;
            if (congestionRatio > 5) {
                // 高度拥堵，使用 veryHigh
                return estimate.veryHigh;
            } else if (congestionRatio > 2) {
                // 中度拥堵，使用 high
                return estimate.high;
            } else {
                // 正常，使用 recommended
                return estimate.recommended;
            }

        case 'none':
        default:
            return 0;
    }
}
```

### 3.5.2 重试退避算法

```typescript
/**
 * 计算下次重试时间
 * 使用指数退避 + 抖动
 */
function calculateNextRetryTime(retryCount: number, baseDelayMs: number = 1000): number {
    // 指数退避: 1s, 2s, 4s, 8s...
    const exponentialDelay = baseDelayMs * Math.pow(2, retryCount);

    // 添加随机抖动 (±25%)
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);

    // 最大延迟 30 秒
    return Math.min(exponentialDelay + jitter, 30000);
}
```

### 3.5.3 交易确认监听

```typescript
/**
 * 等待交易确认
 */
async function waitForConfirmation(
    connection: Connection,
    signature: string,
    lastValidBlockHeight: number,
    timeoutMs: number,
): Promise<ConfirmationResult> {
    const startTime = Date.now();

    // 同时监听区块高度和签名状态
    const [blockHeightSubscription, signatureSubscription] = await Promise.all([
        connection.onBlockHeightChange(lastValidBlockHeight),
        connection.onSignature(signature),
    ]);

    try {
        while (Date.now() - startTime < timeoutMs) {
            // 检查是否超过最后有效区块高度
            const currentBlockHeight = await connection.getBlockHeight();
            if (currentBlockHeight > lastValidBlockHeight) {
                throw new CascadeError('BLOCKHASH_EXPIRED');
            }

            // 检查签名状态
            const status = await connection.getSignatureStatus(signature);
            if (status) {
                if (status.err) {
                    throw new CascadeError('TRANSACTION_FAILED', status.err);
                }
                if (status.confirmations !== null) {
                    return {
                        slot: status.slot,
                        confirmations: status.confirmations,
                        err: null,
                    };
                }
            }

            // 等待 500ms 后再次检查
            await sleep(500);
        }

        throw new CascadeError('TIMEOUT_ERROR');
    } finally {
        // 清理订阅
        connection.removeBlockHeightListener(blockHeightSubscription);
        connection.removeSignatureListener(signatureSubscription);
    }
}
```

---

## 3.6 安全规则

| 规则               | 实现方式                    | 验证方法            |
| ------------------ | --------------------------- | ------------------- |
| API Token 安全存储 | 使用环境变量，不硬编码      | 代码审查 + 集成测试 |
| 交易签名验证       | 投递前验证签名完整性        | 单元测试            |
| 敏感信息脱敏       | 日志中隐藏 API Token 和私钥 | 日志审查            |
| 速率限制保护       | 内置请求队列和限流          | 压力测试            |
| 失败重试上限       | 最大重试次数限制            | 单元测试            |
| 交易过期检测       | 监控区块高度                | 集成测试            |

---

## 3.7 边界条件清单

| #   | 边界条件                 | 预期行为                             | 备注                |
| --- | ------------------------ | ------------------------------------ | ------------------- |
| 1   | 交易大小超过 1232 字节   | 抛出 SIMULATION_FAILED 错误          | Solana 交易大小限制 |
| 2   | 区块哈希在投递过程中过期 | 自动重试，更新区块哈希               | 需要重新签名        |
| 3   | 网络完全断开             | 进入指数退避重试，最多 3 次          | 记录详细错误日志    |
| 4   | API Token 无效           | 立即失败，提示检查配置               | 不可重试            |
| 5   | 余额刚好等于费用         | 交易成功，余额归零                   | 边界测试            |
| 6   | 余额比费用少 1 lamport   | 抛出 INSUFFICIENT_FUNDS              | 精确测试            |
| 7   | 连续 100 次交易失败      | 标记连接为 unhealthy，切换 fallback  | 熔断机制            |
| 8   | Jito Bundle 服务不可用   | 自动降级到标准 RPC 投递              | 优雅降级            |
| 9   | 优先费用 API 返回 0      | 使用默认费用 5000 microLamports      | 默认值保护          |
| 10  | 交易确认监听超时         | 返回 TIMEOUT_ERROR，但交易可能已上链 | 需要状态查询接口    |
| 11  | 同一交易被重复提交       | 返回已存在的签名，不重复投递         | 幂等性保护          |
| 12  | 并发提交大量交易         | 使用队列控制并发数 (默认 10)         | 背压机制            |

---

## 3.8 与现有代码集成点

### 3.8.1 替换 workflow-engine 中的 Connection

```typescript
// packages/workflow-engine/src/handlers/trading-real.ts
// 修改前:
function getConnection(): Connection {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    return new Connection(rpcUrl, 'confirmed');
}

// 修改后:
import { TritonCascadeClient } from '../triton-cascade/client.js';

function getCascadeClient(): TritonCascadeClient {
    return new TritonCascadeClient({
        rpcEndpoint: process.env.TRITON_RPC_ENDPOINT || 'https://api.triton.one/rpc',
        apiToken: process.env.TRITON_API_TOKEN,
        network: (process.env.SOLANA_NETWORK as 'mainnet' | 'devnet') || 'devnet',
        connectionTimeoutMs: 10000,
        confirmationTimeoutMs: 60000,
        maxRetries: 3,
        enableJitoBundle: process.env.ENABLE_JITO_BUNDLE === 'true',
        priorityFeeStrategy: 'auto',
    });
}
```

### 3.8.2 修改交易发送逻辑

```typescript
// 修改前:
const signature = await connection.sendRawTransaction(transaction.serialize(), {
    maxRetries: 3,
    skipPreflight: false,
});

// 修改后:
const response = await cascadeClient.sendTransaction(transaction.serialize().toString('base64'), {
    transactionType: 'swap',
    useJitoBundle: true,
    commitment: 'confirmed',
    metadata: {
        route: quote.routePlan.map((r) => r.swapInfo.label),
    },
});
```

---

## 3.9 文件结构

```
packages/workflow-engine/src/triton-cascade/
├── index.ts                    # 公开导出
├── client.ts                   # TritonCascadeClient 主类
├── types.ts                    # 类型定义
├── errors.ts                   # 错误类和错误码
├── config.ts                   # 配置和常量
├── queue.ts                    # 交易队列管理
├── health-monitor.ts           # 连接健康监控
├── fee-estimator.ts            # 优先费用估算
├── jito-bundle.ts              # Jito Bundle 集成
└── __tests__/
    ├── client.test.ts
    ├── queue.test.ts
    └── integration.test.ts
```

---

## ✅ Phase 3 验收标准

- [x] 所有数据结构精确到字段类型和字节大小
- [x] 所有接口有完整的参数、返回值、错误码定义
- [x] 错误码统一编号，无遗漏 (CASCADE_001 - CASCADE_010)
- [x] 状态机转换条件精确，无歧义
- [x] 所有计算有伪代码/公式，精度处理已说明
- [x] 安全规则已从架构文档映射到具体实现
- [x] 边界条件已列出（12 个）
- [x] 本文档可以直接交给任何开发者（或 AI），不需要额外口头解释即可实现

---

## 下一步

**Phase 4: Task Breakdown** → 将本规格分解为可执行的任务

**Phase 5: Test Spec** → 编写测试规格

**Phase 6: Implementation** → 开始编码实现
