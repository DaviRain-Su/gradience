# Phase 6: Implementation — ERC-8004-compatible Reputation Oracle Interface

> **目的**: 编写代码，让所有测试通过
> **输入**: `03-technical-spec-reputation-oracle-interface.md` + `05-test-spec-reputation-oracle-interface.md`
> **输出物**: 通过所有测试的代码 + 本检查清单

---

## 6.1 实现顺序

| #   | 任务 | 状态 | 测试通过 | 备注 |
| --- | --- | --- | --- | --- |
| T1  | 合约目录初始化 | ✅ 完成 | ✅ | Foundry 项目 `packages/evm-oracle-contracts/` |
| T2  | 核心合约开发 | ✅ 完成 | ✅ | `GradienceReputationOracle.sol` |
| T3  | 接口抽象 | ✅ 完成 | ✅ | `IGradienceReputationOracle.sol` |
| T4  | Foundry 单元测试 | ✅ 完成 | ✅ | 16 tests passed |
| T5  | Proof Generator | ✅ 完成 | ✅ | `proof-generator.ts` |
| T6  | EVM Relayer | ✅ 完成 | ✅ | `evm-relayer.ts` |
| T7  | Push Service 集成 | ✅ 完成 | ✅ | `push-service.ts` 追加 evmOracle 分支 |
| T8  | `/onchain` 端点 | ✅ 完成 | ✅ | `reputation-oracle.ts` |
| T9  | `/verify-onchain` 端点 | ✅ 完成 | ✅ | `reputation-oracle.ts` |
| T10 | API 集成测试 | ✅ 完成 | ✅ | 9 tests passed |
| T11 | Phase 5 Test Spec | ✅ 完成 | ✅ | `05-test-spec-reputation-oracle-interface.md` |
| T12 | Phase 6 Implementation | ✅ 完成 | ✅ | 本文档 |
| T13 | Phase 7 Review Report | ⏳ 待写 | - | 下一文档 |

---

## 6.2 新增/修改文件清单

### Solidity (Foundry)

```
packages/evm-oracle-contracts/
├── foundry.toml
├── src/
│   ├── GradienceReputationOracle.sol
│   └── interfaces/IGradienceReputationOracle.sol
└── test/
    └── GradienceReputationOracle.t.sol
```

### TypeScript (Agent Daemon)

```
apps/agent-daemon/src/
├── reputation/
│   ├── proof-generator.ts                    [新建]
│   ├── evm-relayer.ts                        [新建]
│   ├── push-service.ts                       [修改: 追加 evmOracle 推送]
│   └── __tests__/
│       ├── proof-generator.test.ts           [新建]
│       └── evm-relayer.test.ts               [新建]
├── api/routes/
│   ├── reputation-oracle.ts                  [修改: 追加 /onchain, /verify-onchain]
│   └── __tests__/
│       └── reputation-oracle-onchain.test.ts [新建]
```

---

## 6.3 编码标准检查

- [x] 代码结构与技术规格一致
- [x] 常量值与技术规格一致 (`CATEGORY_COUNT=8`, `SCORE_DECIMALS=2`)
- [x] 错误码/错误类型与技术规格一致 (`InvalidSignature`, `InvalidNonce`, `NotRelayer`)
- [x] 接口签名与技术规格一致
- [x] 使用 TypeScript strict mode
- [x] Foundry 编译通过

---

## 6.4 代码质量

- [x] `forge build` 无致命错误
- [x] `forge test` 全部通过 (16 tests)
- [x] Vitest TypeScript 测试全部通过 (9 tests)
- [x] 无 TypeScript 编译错误 (`tsc --noEmit` 通过)

---

## 6.5 技术规格偏差记录

| # | 规格原文 | 实际实现 | 偏差原因 | 规格已同步更新？ |
| --- | --- | --- | --- | --- |
| 1 | `MAX_AGE_SECONDS` 为 uint256 常量 | 实现为可变的 `maxAgeSeconds` state variable + setter | 提供管理员灵活性 | ✅ 已在合约中实现 |
| 2 | `sourceChain` 在 TypeScript 中为 string | Solidity 中同样为 `string` | 保持 ABI 一致 | ✅ |

---

## 6.6 依赖跟踪

| 依赖 | 版本 | 用途 | 安全审查 |
| --- | --- | --- | --- |
| foundry (forge) | latest | Solidity 编译测试 | ✅ |
| ethers | ^6.13.0 | EVM 交互、签名 | ✅ |
| fastify | ^5.2.0 | API 路由 | ✅ |
| vitest | ^3.0.0 | 单元/集成测试 | ✅ |

---

## 6.7 关键实现决策

### 1. 签名对齐
采用 `ethers.signMessage()` + Solidity `ecrecover` 标准 Ethereum Signed Message 前缀方式，确保链下生成签名可被链上 `_verifySignature` 直接验证。Foundry 测试 `test_VerifySignatureValid` 已端到端验证。

### 2. Agent ID 映射
- EVM 地址：使用 `ethers.zeroPadValue(address, 32)` 左补零到 bytes32
- Solana base58 地址：使用 `keccak256(utf8Bytes(address))` 哈希为 bytes32
保证任意地址输入都有确定性的 bytes32 agentId。

### 3. Nonce 策略
Phase 1 使用 Unix timestamp 作为轻量防重放 nonce；后续可升级为链上 `nonces(agentId)` 查询 + 1 的严格递增模式。当前 Relayer 已做 on-chain nonce 预检查，避免无效交易。

### 4. EVM Relayer 健壮性
`pushReputation` 先调用 `contract.nonces()` 做 stale 检查，失败时返回明确错误，不浪费 gas。

---

## 6.8 遇到的问题和解决方案

### 问题 1: `??` nullish coalescing 被 esbuild 报错
**现象**: `const raw = scores[i] ?? 0;` 触发 `Expected ")" but found ";"`
**解决**: 改为 `scores[i] != null ? scores[i] : 0`，兼容当前esbuild版本。

### 问题 2: Fastify 测试路由重复注册
**现象**: 第二个测试用例报 `Fastify instance is already listening. Cannot add route!`
**解决**: 每个测试用例独立 `buildApp()`，不共用 Fastify 实例。

### 问题 3: `ethers.Contract` 只读属性无法 mock
**现象**: 直接赋值 `ethers.Contract = vi.fn()` 抛 `Cannot assign to read only property`
**解决**: 测试改为直接实例化 `ReputationEVMRelayer`，再通过属性访问注入 `contract` mock。

---

## 6.9 测试覆盖率报告

```
Foundry:    16/16 passed
Vitest:      9/9 passed
```

---

## ✅ Phase 6 验收标准

- [x] 所有任务状态为 ✅ 完成
- [x] 所有测试通过（Foundry + Vitest）
- [x] 规格偏差已记录
- [x] 无编译警告/lint 错误
- [x] 代码已提交到仓库

**验收通过后，进入 Phase 7: Review & Deploy →**
