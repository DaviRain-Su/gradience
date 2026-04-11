# Phase 1: PRD — Multi-Chain Architecture

> **任务**: GRA-175  
> **引用**: 项目级 PRD 见 `protocol/WHITEPAPER.md`，项目级架构见 `ARCHITECTURE.md`

---

## 模块定位

Multi-Chain Architecture 是 Gradience Protocol 的**跨链声誉桥接战略架构**。目标是在保持协议核心语义一致的前提下，以 Solana 为唯一核心协议链，通过跨链桥（Wormhole / LayerZero）将声誉证明传递至 EVM 兼容链生态（Base、Arbitrum、Ethereum L2 等）。业务核心不部署在 EVM 链上；EVM 链只接收来自 Solana 的验证声誉证明，并通过统一的 SDK 层屏蔽链差异，为终端用户提供无感知的跨链体验。

### 核心目标

1. **链无感知的用户体验** — 用户无需理解底层链，即可发布任务、参与竞争、管理声誉
2. **Solana 唯一核心协议链** — Agent Arena、AgentM Core、Chain Hub 等核心协议仅部署在 Solana；EVM 链不运行原生核心协议
3. **全局声誉统一** — 跨链声誉通过 Oracle / ZK Proof / 跨链桥（Wormhole / LayerZero）从 Solana 桥接至 EVM 链，Agent 的历史记录不随链迁移而丢失
4. **开发者友好** — 提供统一的 `@gradiences/sdk`，业务接口与链类型完全解耦

---

## 用户故事

| 角色           | 场景                                                                         |
| -------------- | ---------------------------------------------------------------------------- |
| EVM 用户       | 我持有 Base 上的 ETH，想直接在本链发布任务，不想桥接到 Solana                |
| Solana 老用户  | 我在 Solana 上积累了很高的 Agent 声誉，想在 Base 上也能被认可                |
| Agent Operator | 我的 Agent 部署在 Arbitrum 上，我想参与 Gradience 的任务市场                 |
| 开发者         | 我想用 `@gradiences/sdk` 开发一个 Agent 管理工具，不需要关心用户连的是哪条链 |
| Judge          | 我想在多条链上注册为 Judge，统一获得评判收益                                 |

---

## 非目标（Out of Scope）

- **跨链资产桥（Wormhole/LI.FI）**: 不在本架构内直接实现，任务 escrow 必须本地化
- **Solana 程序关闭**: Solana 是永久核心协议链，所有新功能优先在 Solana 实现
- **EVM L1 主网首发**: 优先 L2（Base / Arbitrum），L1 作为远期选项
- **链上消息内容存储**: A2A 消息内容继续走链下（XMTP/Nostr），链上只存 proof

---

## 验收标准

- [x] 明确 Solana-Core + Bridge 的架构选择及理由
- [ ] 定义仅部署在 Solana 的核心组件清单（Program）
- [ ] 定义需要全局统一的组件清单（Reputation + Identity）
- [ ] 设计 Unified SDK 的核心接口规范（ITaskClient / IUserClient / IReputationClient）
- [ ] 设计跨链声誉桥接方案（Oracle / ZK / Message Pass）
- [ ] 明确各目标链的首发优先级（Base > Arbitrum > ...）
- [ ] 产出 Phase 3 Technical Spec 的输入文档
