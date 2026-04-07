# Phase 1: PRD — agent-layer-evm

> **引用**: 项目级 PRD 见 `docs/01-prd.md`  
> **项目级架构**: `docs/multi-chain/02-architecture.md`

---

## 模块定位

Agent Layer EVM 将 Gradience Protocol 的核心任务生命周期扩展到 **所有 EVM 兼容链**，采用 **Multi-Home 部署策略**：

- **首发链**: **XLayer** (Polygon CDK zkEVM / Validium，零 Gas + TEE Wallet + 原生 Solana 支持)
- **扩展链**: Base / Arbitrum / Ethereum L1（SDK 和部署脚本通用，无需修改合约代码）
- **Solana 定位**: 共存维护，不强制迁移，通过 Reputation Bridge 实现声誉互认

### 核心目标

1. **全 EVM 任务市场** — 用户可在任意支持的 EVM 链上用原生资产（ETH/OKB/ERC20）发布任务、参与竞争
2. **跨链声誉验证** — Solana 上积累的 Agent 声誉通过 Ed25519 proof + Oracle 桥接到所有 EVM 链
3. **链无感知体验** — Unified SDK 屏蔽底层链差异，用户无需理解自己在哪条链上交互
4. **生态扩展** — 触达 XLayer / Base / Arbitrum / Ethereum 等 EVM 生态的 Agent 和用户

---

## 用户故事

| 角色 | 场景 |
|------|------|
| EVM Poster | 我想用 XLayer 上的 OKB 发布任务，让 Agent 竞争完成 |
| EVM Agent | 我想在 Base 上参与任务并用 ETH 获得报酬 |
| Solana Agent | 我在 Solana 上积累了高声誉，想在 XLayer/Base 上也被认可并获得 stake 折扣 |
| Judge | 我想在多条 EVM 链上注册为 Judge，统一获得 3% 评判费 |
| Developer | 我想用 `@gradiences/sdk` 开发工具，不需要关心用户连接的是 Solana 还是 XLayer |

---

## 非目标（Out of Scope）

- **跨链资产桥（Wormhole/LI.FI）**: 不在本模块内直接实现，任务 escrow 必须本地化（Multi-Home）
- **Solana 程序关闭**: Solana 现有程序进入维护模式，不强制下线
- **链上消息内容存储**: A2A 消息内容继续走链下（XMTP/Nostr），链上只存通道状态和支付证明
- **Judge LLM 评分逻辑**: 链下 evaluator（LLM-as-Judge）在 `agent-daemon` 中实现，链上只验证和执行结算

---

## 验收标准

- [ ] 完整任务生命周期：post → apply → submit → judge → pay（单链内完成）
- [ ] 与 Solana 对齐的费用结构：95/3/2
- [ ] Ed25519 声誉验证可防重放，支持 Solana → 任意 EVM 链的声誉桥接
- [ ] Foundry 测试覆盖核心路径（ETH + ERC20）
- [ ] **XLayer Testnet** 部署成功（合约和部署脚本对 Base/Arbitrum 通用）
- [ ] SDK `EVMAdapter` 支持 `xlayer | base | arbitrum | ethereum` 的链 ID 路由
