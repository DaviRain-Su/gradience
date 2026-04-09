# Phase 3: Technical Spec — Verifiable Execution Layer (VEL)

> **输入**: `apps/agent-daemon/docs/02-architecture-vel.md`  
> **日期**: 2026-04-07  
> **版本**: v0.1  
> ⚠️ **代码必须与本文档 100% 一致。**

---

## 3.1 数据结构定义

### 3.1.1 链下核心数据结构

#### `TeeExecutionRequest`

```typescript
interface TeeExecutionRequest {
    /** workflow 唯一标识 */
    workflowId: string;
    /** workflow 的完整定义 JSON */
    workflowDefinition: WorkflowDefinition;
    /** 执行时需要的输入参数 */
    inputs: Record<string, unknown>;
    /** 关联的 Agent Arena taskId */
    taskId: number;
    /** 申请人/执行者的 Solana 地址（用于链上关联） */
    executorAddress: string;
    /** 超时时间（毫秒），默认 300000 */
    timeoutMs: number;
}
```

#### `WorkflowDefinition`

```typescript
interface WorkflowDefinition {
    version: '1.0';
    name: string;
    steps: WorkflowStep[];
}

type WorkflowStep =
    | { type: 'swap'; params: SwapParams }
    | { type: 'transfer'; params: TransferParams }
    | { type: 'stake'; params: StakeParams }
    | { type: 'unstake'; params: UnstakeParams }
    | { type: 'tool_call'; params: ToolCallParams };
```

#### `TeeExecutionResult`

```typescript
interface TeeExecutionResult {
    /** 执行是否成功 */
    success: boolean;
    /** 每一步的输出 */
    stepResults: StepResult[];
    /** 执行结果的整体摘要（用于 judge 快速阅读） */
    summary: string;
    /** 执行日志的 SHA256 */
    logHash: string;
    /** 结果本身的 SHA256（对 stepResults 做 canonical JSON 后的 hash） */
    resultHash: string;
    /** TEE 生成的 attestation report（base64 编码） */
    attestationReport: string;
    /** 毫秒级时间戳 */
    executedAt: number;
}
```

#### `StepResult`

```typescript
interface StepResult {
    stepIndex: number;
    stepType: string;
    success: boolean;
    output: unknown;
    error?: string;
    durationMs: number;
}
```

#### `AttestationBundle`

```typescript
interface AttestationBundle {
    /** 固定魔数 + 版本 */
    version: 'vel-v1';
    /** taskId */
    taskId: number;
    /** 执行者地址 */
    executorAddress: string;
    /** resultHash */
    resultHash: string;
    /** logHash */
    logHash: string;
    /** attestationReport (base64) */
    attestationReport: string;
    /** TEE provider 名称 */
    providerName: 'gramine-local' | 'nitro-local' | string;
    /** PCR / 测量值映射（provider-specific） */
    pcrValues: Record<string, string>;
    /** bundle 生成时间戳 */
    timestamp: number;
}
```

#### `VerificationReport`

```typescript
interface VerificationReport {
    /** 验证是否通过 */
    valid: boolean;
    /** 失败原因 */
    reason?: string;
    /** 解析出的 enclave 测量值 */
    pcrValues?: Record<string, string>;
    /** 签名者身份（如 AWS Nitro PCR0 或 Gramine MRENCLAVE） */
    signerIdentity?: string;
}
```

---

### 3.1.2 配置与常量

| 常量名                       | 值         | 类型   | 说明                                                 | 可变性       |
| ---------------------------- | ---------- | ------ | ---------------------------------------------------- | ------------ |
| `VEL_VERSION`                | `'vel-v1'` | string | AttestationBundle 魔数                               | immutable    |
| `DEFAULT_TEE_TIMEOUT_MS`     | `300000`   | number | TEE 执行默认超时                                     | configurable |
| `MAX_ATTESTATION_SIZE_BYTES` | `65536`    | number | 单个 attestation report 最大大小                     | immutable    |
| `MAX_REASON_REF_LENGTH`      | `200`      | number | Solana `judge_and_pay` 中 `reasonRef` 字符串最大长度 | immutable    |
| `PROOF_PAYLOAD_VERSION`      | `1`        | number | proof bytes 编码版本号                               | immutable    |

---

## 3.2 接口定义

### 3.2.1 `TeeExecutionEngine`（抽象接口）

```typescript
export interface TeeExecutionEngine {
    /**
     * 在 TEE 中执行 workflow。
     * @param request — 执行请求
     * @returns — 包含 attestation 的执行结果
     * @throws VEL_ERROR_EXECUTION_TIMEOUT — 超时
     * @throws VEL_ERROR_ENCLAVE_CRASH — TEE 运行时崩溃
     */
    execute(request: TeeExecutionRequest): Promise<TeeExecutionResult>;

    /**
     * 验证 attestation bundle 的密码学有效性。
     * @param bundle — attestation + metadata
     * @returns — 验证报告
     * @throws VEL_ERROR_INVALID_ATTESTATION_FORMAT — 格式非法
     */
    verifyAttestation(bundle: AttestationBundle): Promise<VerificationReport>;
}
```

### 3.2.2 `TeeProvider`（Provider 内部接口）

```typescript
export interface TeeProvider {
    readonly name: string;

    /** 初始化 provider：建立 enclave 连接或启动本地模拟环境 */
    initialize(config: TeeProviderConfig): Promise<void>;

    /** 在 enclave 内执行 payload */
    executeInEnclave(payload: EnclavePayload): Promise<EnclaveResponse>;

    /** 清理 enclave 连接 */
    terminate(): Promise<void>;
}
```

#### `EnclavePayload`

```typescript
interface EnclavePayload {
    workflowDefinition: WorkflowDefinition;
    inputs: Record<string, unknown>;
    /** 32 bytes seed，用于 enclave 内部派生 keypair */
    seed: Uint8Array;
    taskId: number;
}
```

#### `EnclaveResponse`

```typescript
interface EnclaveResponse {
    success: boolean;
    stepResults: StepResult[];
    summary: string;
    logHash: string;
    resultHash: string;
    attestationReport: string; // base64
    error?: string;
}
```

### 3.2.3 `VelOrchestrator`

```typescript
export interface VelOrchestrator {
    /**
     * 执行 workflow 并自动提交 judge_and_pay settlement。
     * @param request — TEE 执行请求
     * @returns — Solana transaction signature
     * @throws VEL_ERROR_BRIDGE_SETTLEMENT_FAILED — 链上结算失败
     */
    runAndSettle(request: TeeExecutionRequest): Promise<string>;
}
```

### 3.2.4 `AttestationBundle.toProofPayload()` 序列化规则

AttestationBundle **不直接放进 Solana transaction data**（体积过大），而是按以下规则映射为 `judge_and_pay` 的 proof payload：

1. 将 `AttestationBundle` 序列化为 JSON。
2. 计算 JSON 的 SHA256，得到 `bundleHash`。
3. 将 JSON 上传到链下存储（开发环境可先写入本地文件系统，用 `file://` URI 模拟；生产环境迁移到 IPFS/Arweave）。
4. `reasonRef` 字段编码为：`vel:<providerName>:<bundleHash>:<storageUri>`
    - 示例：`vel:gramine-local:a3f2...8c1:file:///tmp/vel/attestations/42.json`
5. Bridge Manager 在构建 `judge_and_pay` transaction 时，将 `bundleHash` 作为前 32 bytes 附加到 borsh `reasonRef` 前面（形成 `proofPayload`），但最终链上看到的仍是字符串形式的 `reasonRef`。具体实现由 `settlement-bridge` 负责。

> **注意**：当前 Agent Arena Program 的 `judge_and_pay` instruction 只接受 `winner`, `score`, `reasonRef`（均为基础类型），**不修改 program**。完整的 AttestationBundle 通过链下可读 URL 提供，judge 程序在验证时读取该 URL 并校验 `bundleHash`。

---

## 3.3 错误码定义

| 错误码     | 名称                                        | 触发条件                                         | 用户提示                                   |
| ---------- | ------------------------------------------- | ------------------------------------------------ | ------------------------------------------ |
| `VEL_0001` | `VEL_ERROR_EXECUTION_TIMEOUT`               | TEE 执行超过 `timeoutMs`                         | TEE execution timed out                    |
| `VEL_0002` | `VEL_ERROR_ENCLAVE_CRASH`                   | TEE runtime 退出码非 0 或 socket 断开            | Enclave crashed during execution           |
| `VEL_0003` | `VEL_ERROR_INVALID_ATTESTATION_FORMAT`      | attestation report 无法解析                      | Invalid attestation report format          |
| `VEL_0004` | `VEL_ERROR_ATTESTATION_VERIFICATION_FAILED` | attestation 签名验证失败                         | Attestation signature verification failed  |
| `VEL_0005` | `VEL_ERROR_PC_MISMATCH`                     | PCR 值不在白名单中                               | Enclave measurement (PCR) not in allowlist |
| `VEL_0006` | `VEL_ERROR_BUNDLE_HASH_MISMATCH`            | 重新计算的 resultHash/logHash 与 bundle 中不一致 | Attestation bundle integrity check failed  |
| `VEL_0007` | `VEL_ERROR_BRIDGE_SETTLEMENT_FAILED`        | `judge_and_pay` transaction 提交失败             | On-chain settlement failed                 |
| `VEL_0008` | `VEL_ERROR_UNSUPPORTED_PROVIDER`            | `TeeProviderFactory` 找不到指定 provider         | Unsupported TEE provider                   |
| `VEL_0009` | `VEL_ERROR_SEED_DERIVATION_FAILED`          | enclave 内部 keypair 派生失败                    | Failed to derive enclave keypair           |
| `VEL_0010` | `VEL_ERROR_REASON_REF_TOO_LONG`             | `reasonRef` 编码后超过 200 字符                  | Encoded reason ref exceeds Solana limit    |

---

## 3.4 状态机精确定义

| 当前状态      | 触发动作                             | 条件                | 新状态        | 副作用                                       |
| ------------- | ------------------------------------ | ------------------- | ------------- | -------------------------------------------- |
| `Idle`        | `orchestrator.runAndSettle(req)`     | req 有效            | `Preparing`   | 日志记录 requestId                           |
| `Preparing`   | `provider.initialize()`              | 成功                | `Dispatching` | 建立 socket / 进程连接                       |
| `Preparing`   | `provider.initialize()`              | 失败                | `Failed`      | 抛出 `VEL_ERROR_UNSUPPORTED_PROVIDER`        |
| `Dispatching` | `provider.executeInEnclave(payload)` | 成功                | `Attesting`   | payload 写入 enclave                         |
| `Dispatching` | `provider.executeInEnclave(payload)` | 超时                | `Failed`      | 抛出 `VEL_0001`，调用 `provider.terminate()` |
| `Dispatching` | `provider.executeInEnclave(payload)` | enclave 退出        | `Failed`      | 抛出 `VEL_0002`，清理进程                    |
| `Attesting`   | enclave 返回 response                | `success === true`  | `Verifying`   | 组装 `AttestationBundle`                     |
| `Attesting`   | enclave 返回 response                | `success === false` | `Failed`      | 记录 error，不提交链上                       |
| `Verifying`   | `engine.verifyAttestation(bundle)`   | `valid === true`    | `Settling`    | -                                            |
| `Verifying`   | `engine.verifyAttestation(bundle)`   | `valid === false`   | `Failed`      | 抛出对应 `VEL_0003/0004/0005`                |
| `Settling`    | `bridge.judgeAndPay(...)`            | 成功 confirmed      | `Submitted`   | 返回 tx signature                            |
| `Settling`    | `bridge.judgeAndPay(...)`            | 失败 / rejected     | `Failed`      | 抛出 `VEL_0007`                              |
| `Failed`      | 自动                                 | -                   | `Idle`        | 写入错误日志 + metrics                       |
| `Submitted`   | 自动                                 | -                   | `Idle`        | 写入成功日志 + metrics                       |

---

## 3.5 算法与计算

### 3.5.1 `resultHash` 计算

```typescript
function computeResultHash(stepResults: StepResult[]): string {
    const canonical = JSON.stringify(stepResults, (key, value) => {
        if (typeof value === 'bigint') return value.toString();
        return value;
    });
    return createHash('sha256').update(canonical).digest('hex');
}
```

### 3.5.2 `logHash` 计算

```typescript
function computeLogHash(logs: string[]): string {
    const canonical = logs.join('\n');
    return createHash('sha256').update(canonical).digest('hex');
}
```

### 3.5.3 `bundleHash` 计算

```typescript
function computeBundleHash(bundle: AttestationBundle): string {
    // 排除 timestamp（因为 timestamp 可能因验证时机不同而变化）
    const { timestamp, ...canonicalBundle } = bundle;
    const json = JSON.stringify(canonicalBundle, Object.keys(canonicalBundle).sort());
    return createHash('sha256').update(json).digest('hex');
}
```

### 3.5.4 `reasonRef` 编码

```typescript
function encodeReasonRef(providerName: string, bundleHash: string, storageUri: string): string {
    const ref = `vel:${providerName}:${bundleHash}:${storageUri}`;
    if (ref.length > MAX_REASON_REF_LENGTH) {
        throw new Error(`VEL_ERROR_REASON_REF_TOO_LONG`);
    }
    return ref;
}
```

### 3.5.5 Gramine Local Provider: enclave 启动流程

```typescript
async function initializeGramineLocal(config: TeeProviderConfig): Promise<void> {
    const manifestPath = config.manifestPath ?? './gramine/vel.manifest';
    const command = `gramine-sgx ${manifestPath}`; // simulation mode on non-SGX machines
    const child = spawn(command, { stdio: ['ignore', 'pipe', 'pipe'] });

    // 等待 unix socket 可用（最长 10s）
    await waitForSocket(config.socketPath, 10000);

    // 发送 init handshake
    const socket = connectUnixSocket(config.socketPath);
    await sendHandshake(socket, { version: VEL_VERSION });
}
```

---

## 3.6 安全规则

| 规则                    | 实现方式                                                                                       | 验证方法                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 私钥不出 enclave        | `seed` 通过 secure channel 传入，enclave 内部派生 `Keypair`，`dumps` 操作被 Gramine/Nitro 禁止 | 测试：尝试从 enclave 提取私钥应失败                   |
| Attestation 绑定 result | attestation report 的 user-data 字段被设为 `resultHash` + `logHash` 的拼接 hash                | verifyAttestation 时校验 user-data 是否与 bundle 一致 |
| PCR 白名单              | `config.allowedPcrValues` 必须非空，verify 时严格比对                                          | 测试：用不同 PCR 值跑业务会报 `VEL_0005`              |
| 超时强制清理            | `executeInEnclave` 使用 `AbortController` + `setTimeout`，超时后调用 `provider.terminate()`    | 超时测试                                              |
| 链下存储完整性          | `bundleHash` 作为 reasonRef 的一部分，judge 读取链下内容后必须重新计算 hash 并比对             | E2E 测试验证篡改链下内容后验证失败                    |

---

## 3.7 目录结构与文件命名

```
apps/agent-daemon/src/vel/
├── index.ts                    # 公开导出 VelOrchestrator 和 TeeExecutionEngine
├── orchestrator.ts             # VelOrchestrator 实现
├── tee-execution-engine.ts     # TeeExecutionEngine 抽象接口 + 工厂
├── attestation-verifier.ts     # 通用验证逻辑
├── types.ts                    # 所有 VEL 类型定义
├── errors.ts                   # VEL 错误码和自定义 Error 类
├── utils.ts                    # hash 计算、reasonRef 编码等工具函数
└── providers/
    ├── index.ts                # provider 导出
    ├── base-provider.ts        # 共用逻辑（如 socket 通信、payload serialization）
    ├── gramine-local-provider.ts
    └── nitro-stub-provider.ts
```

---

## 3.8 边界条件清单

| #   | 边界条件                                         | 预期行为                                                | 备注                                             |
| --- | ------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------ |
| 1   | workflow 无 steps                                | `resultHash` 是 `sha256('[]')`，enclave 正常返回空结果  | 空 workflow 允许但业务无意义                     |
| 2   | attestation report > 64KB                        | `MAX_ATTESTATION_SIZE_BYTES` 截断或拒绝                 | 防止内存耗尽                                     |
| 3   | `reasonRef` 编码后 > 200 字符                    | 抛出 `VEL_0010`                                         | Solana 字符串长度限制                            |
| 4   | TEE provider name 不在注册表中                   | 抛出 `VEL_0008`                                         | 防御拼写错误                                     |
| 5   | `timeoutMs` 设为 0                               | 按 `DEFAULT_TEE_TIMEOUT_MS` 处理                        | 输入规范化                                       |
| 6   | enclave 返回的 `resultHash` 与本地重新计算不一致 | 抛出 `VEL_0006`                                         | 防止中间人篡改                                   |
| 7   | 并发多次调用同一 provider                        | 每个 request 有独立 sessionId，不互相干扰               | provider 内部用 session map 隔离                 |
| 8   | `storageUri` 指向不可访问的 URL                  | `runAndSettle` 仍执行并返回 tx，但 judge 阶段验证会失败 | 这是设计选择（ settlement 和 verification 解耦） |
| 9   | PCR 白名单为空数组                               | `initialize` 阶段报错，要求至少 1 个允许的 PCR          | 避免"任何 enclave 都信任"的默认开放状态          |
| 10  | enclave socket 文件被外部删除                    | `executeInEnclave` 抛 `VEL_0002`，触发重新初始化        | provider 需要具备自愈能力                        |

---

## ✅ Phase 3 验收标准

- [x] 所有数据结构精确到字段类型
- [x] 所有接口有完整的参数、返回值、错误码定义
- [x] 错误码统一编号，无遗漏
- [x] 状态机转换条件精确，无歧义
- [x] 所有计算有伪代码/公式，精度处理已说明
- [x] 安全规则已从架构文档映射到具体实现
- [x] 目录结构已定义
- [x] 边界条件已列出（≥10 个）

**验收通过后，进入 Phase 4: Task Breakdown →**
