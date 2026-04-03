# Phase 2: Architecture — agent-layer-evm

> **引用**: 项目级架构见 `docs/02-architecture.md`

---

## 架构概览

```
┌─────────────────────────────────────────────────┐
│  EVM Chain (Base Sepolia)                       │
│                                                  │
│  ┌──────────────────────┐  ┌──────────────────┐ │
│  │ AgentLayerRaceTask   │  │ ReputationVerifier│ │
│  │ (任务生命周期)        │  │ (跨链声誉验证)    │ │
│  │ - post/apply/submit  │  │ - Ed25519 verify  │ │
│  │ - judge/refund       │  │ - submitReputation│ │
│  │ - ETH escrow         │  │ - getSnapshot     │ │
│  └──────────────────────┘  └──────────────────┘ │
│             │                       ▲            │
│             │                       │            │
│  ┌──────────┴───────────────────────┴──────────┐ │
│  │         Reputation Relay Server              │ │
│  │  (离线签名 + 提交 proof 到 EVM)             │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
                        ▲
                        │ Ed25519 signed proof
                        │
┌─────────────────────────────────────────────────┐
│  Solana Chain                                    │
│  ┌──────────────────────────────────────────┐   │
│  │  Agent Arena (Reputation PDA)             │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## 合约关系

| 合约 | 职责 | 依赖 |
|------|------|------|
| `AgentLayerRaceTask` | 任务发布/申请/提交/评判/退款 | OpenZeppelin ReentrancyGuard |
| `ReputationVerifier` | 跨链声誉 proof 验证与存储 | Ed25519.sol, Sha512.sol |
| `Ed25519` | 纯 Solidity Ed25519 签名验证库 | Sha512.sol |
| `Sha512` | SHA-512 哈希库 | — |

## 数据流

1. **任务流**: Poster → `post_task` (ETH escrow) → Agent `apply` (ETH stake) → `submit_result` → Judge `judge_and_pay` → 95/3/2 分配
2. **声誉流**: Solana Reputation PDA → Relay Server (Ed25519 sign) → `submitReputation` → EVM snapshot storage

## 安全设计

- ReentrancyGuard 防重入攻击
- Ed25519 签名防伪造
- 时间戳单调递增防重放
- Custom errors 减少 gas 消耗
