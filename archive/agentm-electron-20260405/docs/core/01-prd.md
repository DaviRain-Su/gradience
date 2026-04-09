# Phase 1: PRD — AgentM Core (On-Chain Program)

> **引用**: 项目级 PRD 见 `docs/01-prd.md`

---

## 模块定位

AgentM Core 是 Gradience 的 **Agent 链上身份管理程序**，负责：

1. **Agent 注册** — 在 Solana 上创建 Agent 身份 (PDA)
2. **Profile 管理** — 链上 Agent Profile CRUD（名称、描述、能力、定价）
3. **Reputation 集成** — 聚合来自 Agent Arena 的声誉数据
4. **与 Metaplex 桥接** — 支持 Metaplex Agent Registry (8004) 注册

## 为什么需要独立程序

当前 Agent Profile 存储在 Indexer（链下 PostgreSQL），这存在：

- 中心化单点故障
- 无法被其他链上程序引用
- 无法作为 DeFi 或 DAO 的可信输入

AgentM Core 将 Profile 和 Reputation 放到链上，成为可组合的 Solana 原语。

## 用户故事

| 角色         | 场景                                                   |
| ------------ | ------------------------------------------------------ |
| Agent 开发者 | 我想在 Solana 上注册我的 Agent，让所有人都能验证其身份 |
| 任务发布者   | 我想查看 Agent 的链上声誉来决定是否信任它              |
| 其他协议     | 我想 CPI 读取 Agent 声誉来做准入控制                   |
| AgentM Pro   | 我需要链上 Profile 数据来展示 Agent 详情               |

## 验收标准

- [ ] Agent 注册创建 PDA（唯一身份）
- [ ] Profile 支持更新（owner 权限）
- [ ] Reputation 可由 Agent Arena 程序通过 CPI 更新
- [ ] 支持 Metaplex Agent Registry 注册（可选）
- [ ] TypeScript SDK 封装所有指令
