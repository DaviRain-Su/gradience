# Phase 5: Test Spec — Verifiable Execution Layer (VEL)

> **输入**: `apps/agent-daemon/docs/03-technical-spec-vel.md` + `04-task-breakdown-vel.md`  
> **日期**: 2026-04-07

---

## 5.1 测试策略

| 测试类型   | 覆盖范围                                                                                           | 工具                                          | 运行环境     |
| ---------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------ |
| 单元测试   | `utils.ts`, `tee-execution-engine.ts`, `providers/*`, `attestation-verifier.ts`, `orchestrator.ts` | Vitest                                        | Node.js 本地 |
| 集成测试   | `VelOrchestrator` + `GramineLocalProvider` + `AttestationVerifier` 组合                            | Vitest                                        | Node.js 本地 |
| 端到端测试 | Devnet 完整链路 (`post_task → TEE execute → submit → judge_and_pay`)                               | Node.js script (`scripts/e2e-vel-devnet.mjs`) | Devnet       |
| 安全测试   | 篡改 attestation、错误 PCR、伪造 enclave 响应                                                      | Vitest                                        | Node.js 本地 |

---

## 5.2 测试用例表

### 5.2.1 `utils.ts` — Hash & Encoding

**正常路径 (Happy Path)**

| #   | 测试名称                                                  | 输入                                                                                             | 预期输出                                | 预期状态变化 |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------- | ------------ |
| H1  | `computeResultHash` 对 canonical stepResults 返回固定 hex | `[{ stepIndex: 0, stepType: "swap", success: true, output: { amount: 100n }, durationMs: 123 }]` | 64-char hex                             | 无           |
| H2  | `encodeReasonRef` 返回标准格式字符串                      | `provider="gramine"`, `bundleHash="abc123"`, `uri="file:///tmp/x.json"`                          | `vel:gramine:abc123:file:///tmp/x.json` | 无           |

**边界条件 (Boundary)**

| #   | 测试名称                     | 输入               | 预期行为            | 备注             |
| --- | ---------------------------- | ------------------ | ------------------- | ---------------- |
| B1  | 空 stepResults 的 resultHash | `[]`               | 固定 sha256(`"[]"`) | 空 workflow 边界 |
| B2  | reasonRef 长度刚好 200       | 各段长度之和 = 200 | 正常返回            | 临界长度         |

**异常/攻击 (Error/Attack)**

| #   | 测试名称                              | 输入/操作                    | 预期错误码    | 攻击类型              |
| --- | ------------------------------------- | ---------------------------- | ------------- | --------------------- |
| E1  | `encodeReasonRef` 超长                | 总长度 201                   | `VEL_0010`    | 数据注入 / DoS        |
| E2  | `computeResultHash` 对象 key 顺序不同 | 相同内容但 JSON key 顺序不同 | hash 仍然相同 | 验证 canonicalization |

---

### 5.2.2 `TeeExecutionEngine` & `TeeProviderFactory`

**正常路径**

| #   | 测试名称                      | 输入                            | 预期输出                    |
| --- | ----------------------------- | ------------------------------- | --------------------------- |
| H3  | factory 返回 Gramine provider | `providerName: "gramine-local"` | `GramineLocalProvider` 实例 |

**异常/攻击**

| #   | 测试名称      | 输入/操作                       | 预期错误码 |
| --- | ------------- | ------------------------------- | ---------- |
| E3  | 未知 provider | `providerName: "fake-provider"` | `VEL_0008` |

---

### 5.2.3 `GramineLocalProvider`

**正常路径**

| #   | 测试名称                       | 输入                              | 预期输出                                                                 |
| --- | ------------------------------ | --------------------------------- | ------------------------------------------------------------------------ |
| H4  | Mock enclave 成功执行 workflow | `EnclavePayload` with 1 swap step | `EnclaveResponse` with `success=true`, `resultHash`, `attestationReport` |

**异常/攻击**

| #   | 测试名称         | 输入/操作                        | 预期错误码 |
| --- | ---------------- | -------------------------------- | ---------- |
| E4  | Enclave 进程崩溃 | Kill child process mid-execution | `VEL_0002` |
| E5  | Execution 超时   | `timeoutMs: 1`                   | `VEL_0001` |

---

### 5.2.4 `AttestationVerifier`

**正常路径**

| #   | 测试名称                | 输入                                        | 预期输出     |
| --- | ----------------------- | ------------------------------------------- | ------------ |
| H5  | 验证 mock Gramine quote | Valid `AttestationBundle` with matching PCR | `valid=true` |

**异常/攻击**

| #   | 测试名称                       | 输入/操作                                    | 预期错误码 |
| --- | ------------------------------ | -------------------------------------------- | ---------- |
| E6  | 篡改 attestation report        | Flip 1 byte in base64 report                 | `VEL_0004` |
| E7  | PCR 不在白名单                 | Bundle with PCR=ABCD, allowlist=[WXYZ]       | `VEL_0005` |
| E8  | resultHash 与 user-data 不匹配 | resultHash changed but attestation unchanged | `VEL_0006` |

---

### 5.2.5 `VelOrchestrator`

**正常路径**

| #   | 测试名称                   | 输入                                 | 预期输出            |
| --- | -------------------------- | ------------------------------------ | ------------------- |
| H6  | 完整编排到 settlement mock | `runAndSettle(req)` with mock bridge | tx signature string |

**异常/攻击**

| #   | 测试名称                     | 输入/操作          | 预期错误码 |
| --- | ---------------------------- | ------------------ | ---------- |
| E9  | Bridge settlement rejects tx | Mock bridge throws | `VEL_0007` |

---

### 5.2.6 `settlement-bridge` VEL Extension

**正常路径**

| #   | 测试名称                                          | 输入                | 预期输出                                                   |
| --- | ------------------------------------------------- | ------------------- | ---------------------------------------------------------- |
| H7  | `judgeAndPay` 编码 AttestationBundle 为 reasonRef | `AttestationBundle` | transaction 中 `reasonRef` 以 `vel:` 开头且包含 bundleHash |

---

## 5.3 集成测试场景

| #   | 场景名称                         | 步骤                                                                                                                                            | 预期结果                           |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| I1  | 完整 happy path（mock provider） | 1. `factory.create('gramine-local')` → 2. `engine.execute(req)` → 3. `verifier.verifyAttestation(bundle)` → 4. `orchestrator.runAndSettle(req)` | 所有步骤成功，最终返回 tx sig      |
| I2  | 超时后 provider 清理             | 1. `engine.execute(req)` with timeout=1ms → 2. 等待超时 → 3. 断言 provider 进程/socket 已清理                                                   | `VEL_0001` 抛出，socket 文件不存在 |
| I3  | 篡改执行结果后验证失败           | 1. `engine.execute(req)` → 2. 修改 `bundle.resultHash` → 3. `verifier.verifyAttestation(bundle)`                                                | `VEL_0006` 抛出                    |

---

## 5.4 安全测试场景

| #   | 攻击名称                        | 攻击方式                             | 预期防御                                                           | 验证方法                    |
| --- | ------------------------------- | ------------------------------------ | ------------------------------------------------------------------ | --------------------------- |
| S1  | 假 enclave 返回伪造 attestation | 用自签名证书生成假 quote             | `VEL_0004` (签名验证失败)                                          | 单元测试：替换 qquote 签名  |
| S2  | Host 修改 workflow result       | provider 返回后篡改 `resultHash`     | `VEL_0006` (hash 与 attestation 不匹配)                            | 单元测试：中间修改 bundle   |
| S3  | 重放旧 attestation              | 用历史 task 的 bundle 对新 task 执行 | 虽然 attestation 本身有效，但 `taskId` 不匹配，链上 program 会拒绝 | E2E 测试：尝试 reuse bundle |

---

## 5.5 测试代码骨架

测试骨架文件已提前创建（先于实现代码）：

- `apps/agent-daemon/src/vel/__tests__/utils.test.ts`
- `apps/agent-daemon/src/vel/__tests__/tee-execution-engine.test.ts`
- `apps/agent-daemon/src/vel/__tests__/gramine-local-provider.test.ts`
- `apps/agent-daemon/src/vel/__tests__/attestation-verifier.test.ts`
- `apps/agent-daemon/src/vel/__tests__/orchestrator.test.ts`
- `apps/agent-daemon/src/vel/__tests__/integration.test.ts`

骨架内容见下方。

### `utils.test.ts` 骨架

```typescript
import { describe, it, expect } from 'vitest';
import { computeResultHash, computeLogHash, encodeReasonRef } from '../utils';

describe('utils', () => {
    it('H1: computeResultHash returns fixed hex for canonical stepResults', () => {
        // TODO: implement
    });

    it('B1: computeResultHash on empty array matches sha256("[]")', () => {
        // TODO: implement
    });

    it('H2: encodeReasonRef returns vel:provider:hash:uri format', () => {
        // TODO: implement
    });

    it('B2: encodeReasonRef works at exactly 200 chars', () => {
        // TODO: implement
    });

    it('E1: encodeReasonRef throws VEL_0010 when over 200 chars', () => {
        // TODO: implement
    });

    it('E2: computeResultHash is stable regardless of key order', () => {
        // TODO: implement
    });
});
```

### `tee-execution-engine.test.ts` 骨架

```typescript
import { describe, it, expect } from 'vitest';
import { TeeProviderFactory } from '../tee-execution-engine';

describe('TeeExecutionEngine / Factory', () => {
    it('H3: factory returns GramineLocalProvider for "gramine-local"', () => {
        // TODO: implement
    });

    it('E3: factory throws VEL_0008 for unknown provider name', () => {
        // TODO: implement
    });
});
```

### `gramine-local-provider.test.ts` 骨架

```typescript
import { describe, it, expect } from 'vitest';

describe('GramineLocalProvider', () => {
    it('H4: mock enclave executes workflow and returns attestation', async () => {
        // TODO: implement
    });

    it('E4: throws VEL_0002 when enclave crashes', async () => {
        // TODO: implement
    });

    it('E5: throws VEL_0001 when execution times out', async () => {
        // TODO: implement
    });
});
```

### `attestation-verifier.test.ts` 骨架

```typescript
import { describe, it, expect } from 'vitest';

describe('AttestationVerifier', () => {
    it('H5: verifies valid mock Gramine quote', async () => {
        // TODO: implement
    });

    it('E6: throws VEL_0004 when attestation report is tampered', async () => {
        // TODO: implement
    });

    it('E7: throws VEL_0005 when PCR is not in allowlist', async () => {
        // TODO: implement
    });

    it('E8: throws VEL_0006 when resultHash mismatches user-data', async () => {
        // TODO: implement
    });
});
```

### `orchestrator.test.ts` 骨架

```typescript
import { describe, it, expect } from 'vitest';

describe('VelOrchestrator', () => {
    it('H6: runAndSettle returns tx signature through mock bridge', async () => {
        // TODO: implement
    });

    it('E9: throws VEL_0007 when bridge settlement fails', async () => {
        // TODO: implement
    });
});
```

### `integration.test.ts` 骨架

```typescript
import { describe, it, expect } from 'vitest';

describe('VEL Integration', () => {
    it('I1: full happy path with mock provider', async () => {
        // TODO: implement
    });

    it('I2: provider cleans up after timeout', async () => {
        // TODO: implement
    });

    it('I3: verification fails when result is tampered post-execution', async () => {
        // TODO: implement
    });
});
```

---

## 5.6 测试覆盖目标

| 指标                  | 目标                                  |
| --------------------- | ------------------------------------- |
| `src/vel/` 语句覆盖率 | ≥ 85%                                 |
| `src/vel/` 分支覆盖率 | ≥ 80%                                 |
| 安全测试场景 (S1-S3)  | 全部通过                              |
| 集成测试场景 (I1-I3)  | 全部通过                              |
| E2E Devnet 脚本       | 至少 1 笔 `judge_and_pay` tx 确认成功 |

---

## ✅ Phase 5 验收标准

- [x] 技术规格中的每个接口/函数都有对应测试用例
- [x] Happy Path + Boundary + Error 三类齐全
- [x] 安全测试场景已从安全架构映射
- [x] 测试代码骨架已编写（6 个测试文件已创建，含 TODO stub）
- [x] 集成测试至少 3 个完整场景
- [x] 覆盖目标已定义

**验收通过后，进入 Phase 6: Implementation →**
