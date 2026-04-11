# Phase 4: Task Breakdown — ERC-8004-compatible Reputation Oracle Interface

> **目的**: 将技术规格拆解为可执行、可分配、可验收的独立任务
> **输入**: `03-technical-spec-reputation-oracle-interface.md`
> **输出物**: 本任务拆解文档

---

## 4.1 拆解原则

1. **每个任务 ≤ 4 小时**
2. **每个任务有明确的 Done 定义**
3. **任务之间的依赖关系必须标明**
4. **按依赖顺序排列**

---

## 4.2 任务列表

### Solidity 合约开发

| #   | 任务名称 | 描述 | 依赖 | 预估时间 | 优先级 | Done 定义 |
| --- | --- | --- | --- | --- | --- | --- |
| T1  | 合约目录初始化 | 新建 `packages/evm-oracle-contracts/`，配置 Foundry 环境 | 无 | 1h | P0 | `foundry.toml` 可用，`forge build` 通过 |
| T2  | 核心合约开发 | 实现 `GradienceReputationOracle.sol`，包含所有 spec 定义的 struct、函数、事件 | T1 | 4h | P0 | 合约编译无错，接口完整 |
| T3  | 接口抽象 | 实现 `IGradienceReputationOracle.sol` | T2 | 1h | P0 | 接口与合约一致 |
| T4  | Foundry 单元测试 | 编写 `GradienceReputationOracle.t.sol`，覆盖签名验证、updateReputation、getReputation、nonce 防重放 | T2 | 3h | P0 | 测试全部通过 |

### TypeScript 服务开发

| #   | 任务名称 | 描述 | 依赖 | 预估时间 | 优先级 | Done 定义 |
| --- | --- | --- | --- | --- | --- | --- |
| T5  | Proof Generator | 新建 `apps/agent-daemon/src/reputation/proof-generator.ts`，生成 `ReputationPayload` + ECDSA 签名 | 无 | 3h | P0 | 链下签名可被链上合约验证 |
| T6  | EVM Relayer | 新建 `apps/agent-daemon/src/reputation/evm-relayer.ts`，封装 `updateReputation` 调用 | T2, T5 | 3h | P0 | 可成功发送 updateReputation 交易 |
| T7  | Push Service 集成 | 修改 `push-service.ts`，在 `pushToERC8004` 后追加 `pushToEVMOracle` 分支 | T6 | 2h | P0 | batchPush 时同时推送至 EVM Oracle |

### API 路由开发

| #   | 任务名称 | 描述 | 依赖 | 预估时间 | 优先级 | Done 定义 |
| --- | --- | --- | --- | --- | --- | --- |
| T8  | `/onchain` 端点 | 在 `reputation-oracle.ts` 新增 `GET /onchain`，返回 payload + signature | T5 | 2h | P0 | 返回结构符合 spec，可被合约直接使用 |
| T9  | `/verify-onchain` 端点 | 在 `reputation-oracle.ts` 新增 `GET /verify-onchain`，本地调用 `verifySignature` | T6, T8 | 2h | P0 | 返回 verified 布尔值 |

### 测试与文档

| #   | 任务名称 | 描述 | 依赖 | 预估时间 | 优先级 | Done 定义 |
| --- | --- | --- | --- | --- | --- | --- |
| T10 | API 集成测试 | 为 `/onchain` 和 `/verify-onchain` 编写 vitest 集成测试 | T8, T9 | 3h | P0 | 测试通过 |
| T11 | Phase 5 Test Spec | 编写 `05-test-spec-reputation-oracle-interface.md` | T1-T4 | 1h | P0 | 文档完成 |
| T12 | Phase 6 Implementation | 编写 `06-implementation.md`，记录实现清单和偏差 | T1-T10 | 1h | P0 | 文档完成 |
| T13 | Phase 7 Review Report | 编写 `07-review-report-reputation-oracle-interface.md` | T12 | 1h | P0 | 文档完成 |

---

## 4.3 任务依赖图

```mermaid
flowchart TD
    T1[合约目录初始化] --> T2[核心合约开发]
    T2 --> T3[接口抽象]
    T2 --> T4[Foundry 单元测试]

    T5[Proof Generator] --> T6[EVM Relayer]
    T2 --> T6
    T6 --> T7[Push Service 集成]

    T5 --> T8[/onchain 端点]
    T6 --> T9[/verify-onchain 端点]
    T8 --> T10[API 集成测试]
    T9 --> T10

    T4 --> T11[Phase 5 Test Spec]
    T10 --> T12[Phase 6 Implementation]
    T12 --> T13[Phase 7 Review Report]
```

---

## 4.4 里程碑划分

### Milestone 1: 合约层（Day 1）
交付物：`GradienceReputationOracle.sol` + Foundry 测试通过
包含：T1, T2, T3, T4

### Milestone 2: 服务层（Day 2）
交付物：Proof Generator + Relayer + Push Service 集成
包含：T5, T6, T7

### Milestone 3: API 层（Day 2-3）
交付物：`/onchain`、`/verify-onchain` 端点 + 集成测试
包含：T8, T9, T10

### Milestone 4: 文档收尾（Day 3）
交付物：Phase 5-7 文档
包含：T11, T12, T13

---

## 4.5 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
| --- | --- | --- | --- |
| Foundry 未安装 | 中 | 高 | 先检查环境，必要时用 npm 安装或改用 hardhat |
| ECDSA 签名链下/链上不匹配 | 中 | 高 | T4 和 T5 做端到端签名验证测试 |
| Base Sepolia RPC 不可用 | 低 | 中 | 使用本地 Anvil 做测试 |

---

## ✅ Phase 4 验收标准

- [x] 每个任务 ≤ 4 小时
- [x] 每个任务有 Done 定义
- [x] 依赖关系已标明，无循环依赖
- [x] 至少划分为 2 个里程碑
- [x] 风险已识别
