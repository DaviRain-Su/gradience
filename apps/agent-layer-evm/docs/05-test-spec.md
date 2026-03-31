# Phase 5: Test Spec — agent-layer-evm

---

## 1. 当前测试文件

| 文件 | 代码量 | 测试内容 | 状态 |
|------|--------|---------|------|
| `AgentLayerRaceTask.test.js` | 9.5K | 主合约完整流程 | ✅ |
| `ReputationVerifier.test.js` | 4.1K | 声誉验证逻辑 | ✅ |

---

## 2. 运行方式

```bash
cd apps/agent-layer-evm
npx hardhat test

# 单个测试文件
npx hardhat test test/AgentLayerRaceTask.test.js

# 覆盖率报告
npx hardhat coverage
```

---

## 3. 覆盖要求

### 必须覆盖（P0）

| 场景 | 说明 |
|------|------|
| post_task → 正常创建 | Happy path |
| apply_for_task → 正常申请 | |
| submit_result → 正常提交 | |
| judge_and_pay score≥60 → 95/3/2 分配精确验证 | 费用计算核心 |
| judge_and_pay score<60 → 退款给 poster | |
| claim_expired → judgeDeadline 后退款 | |
| claim_stake → 任务结束后取回 stake | |
| 重复申请 → revert AlreadyApplied | |
| 非 judge 调用 judge_and_pay → revert NotTaskJudge | |
| reward=0 → revert ZeroReward | |

### 应覆盖（P1）

| 场景 | 说明 |
|------|------|
| 所有 27 个 custom error 各触发一次 | 完整错误覆盖 |
| 重入攻击尝试（ReentrancyGuard） | 安全性 |
| get_reputation 累积计算正确性 | 声誉计算 |
| ReputationVerifier：有效 Ed25519 签名 | 跨链验证 |
| ReputationVerifier：无效签名 → revert | 安全性 |

### 暂缓（P2）

- Gas 消耗 benchmark（各函数 gas 上限）
- 大量申请者（100+）的 gas 消耗

---

## 4. 测试环境

| 项目 | 说明 |
|------|------|
| Hardhat + ethers.js | 本地 EVM，无需网络 |
| `@nomicfoundation/hardhat-toolbox` | 测试工具集 |
| Hardhat Network | 内置 fork 能力（如需测试 Base 状态） |
