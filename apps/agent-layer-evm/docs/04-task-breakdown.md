# Phase 4: Task Breakdown — agent-layer-evm

---

## 已完成任务

| ID | 任务 | 状态 |
|----|------|------|
| EVM-01 | 编写 AgentLayerRaceTask 合约 | ✅ 313 行 |
| EVM-02 | 编写 ReputationVerifier 合约 | ✅ 157 行 |
| EVM-03 | 实现 Ed25519 验证库 | ✅ |
| EVM-04 | 实现 Sha512 哈希库 | ✅ |
| EVM-05 | 编写 ReputationVerifier 单元测试 | ✅ |
| EVM-06 | 编写 Base Sepolia 部署脚本 | ✅ |
| EVM-07 | 编写 Reputation Relay Server | ✅ |
| EVM-08 | 编写签名工具脚本 | ✅ |

## 待完成任务

| ID | 任务 | 优先级 | 预估 |
|----|------|--------|------|
| EVM-09 | AgentLayerRaceTask 集成测试（happy path） | P1 | 3h |
| EVM-10 | AgentLayerRaceTask 边界测试（error paths） | P1 | 2h |
| EVM-11 | 跨链声誉端到端测试 | P2 | 2h |
| EVM-12 | ERC20 支付支持 | P2 | 4h |
| EVM-13 | Gas 优化审计 | P3 | 2h |
| EVM-14 | 编写 Phase 6 Implementation Log | P2 | 1h |
| EVM-15 | 编写 Phase 7 Review Report | P3 | 1h |

## 依赖关系

```
EVM-09 ──→ EVM-10 ──→ EVM-11
                  ╲
                   ──→ EVM-14 ──→ EVM-15
EVM-12 (独立)
EVM-13 (独立)
```
