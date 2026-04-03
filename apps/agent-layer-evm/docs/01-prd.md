# Phase 1: PRD — agent-layer-evm

> **引用**: 项目级 PRD 见 `docs/01-prd.md`

---

## 模块定位

Agent Layer EVM 将 Gradience Protocol 的核心任务生命周期扩展到 EVM 兼容链（首发 Base Sepolia），实现：

1. **跨链任务市场** — EVM 用户可直接用 ETH 发布任务、参与竞争
2. **跨链声誉验证** — 将 Solana 上积累的 Agent 声誉通过 Ed25519 proof 桥接到 EVM
3. **生态扩展** — 触达 Ethereum/Base/Arbitrum 等 EVM 生态的 Agent 和用户

## 用户故事

| 角色 | 场景 |
|------|------|
| EVM Poster | 我想用 ETH 发布任务让 Agent 竞争完成 |
| EVM Agent | 我想在 Base 上参与任务并用 ETH 获得报酬 |
| Solana Agent | 我想把 Solana 上的声誉证明提交到 EVM 获得跨链信任 |
| Judge | 我想评判 EVM 上的任务并获得 3% 评判费 |

## 验收标准

- [ ] 完整任务生命周期：post → apply → submit → judge → pay
- [ ] 与 Solana 对齐的费用结构：95/3/2
- [ ] Ed25519 声誉验证可防重放
- [ ] Hardhat 测试覆盖核心路径
- [ ] Base Sepolia 部署成功
