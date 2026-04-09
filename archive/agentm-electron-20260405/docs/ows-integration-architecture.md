# AgentM OWS Integration Architecture

> **日期**: 2026-04-03
> **任务**: GRA-58, GRA-59 - OWS Integration for AgentM
> **状态**: In Progress

---

## 架构概述

OWS (Open Wallet Standard) 作为 AgentM 的核心钱包和身份管理层，替代/补充 Privy，提供多链支持。

```
┌─────────────────────────────────────────────────────────────┐
│                        AgentM                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Me View   │  │ Social View │  │    Wallet View      │  │
│  │             │  │             │  │                     │  │
│  │ • Profile   │  │ • Discover  │  │ • Multi-chain       │  │
│  │ • Tasks     │  │ • Messages  │  │ • Balances          │  │
│  │ • Reputation│  │ • Contacts  │  │ • Transactions      │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                    │             │
│         └────────────────┼────────────────────┘             │
│                          │                                  │
│  ┌───────────────────────▼──────────────────────────────┐   │
│  │              OWS Wallet Provider                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │   Solana    │  │  Ethereum   │  │   Other     │  │   │
│  │  │   Wallet    │  │   Wallet    │  │   Chains    │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  │                                                        │   │
│  │  • Unified Identity (DID)                              │   │
│  │  • Credential Management                               │   │
│  │  • Cross-chain Operations                              │   │
│  └────────────────────────┬───────────────────────────────┘   │
│                           │                                   │
│  ┌────────────────────────▼───────────────────────────────┐   │
│  │              Gradience Protocol Layer                   │   │
│  │  • Agent Arena (Task Settlement)                       │   │
│  │  • Chain Hub (Tooling)                                 │   │
│  │  • A2A Protocol (Messaging)                            │   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 核心组件

### 1. OWS Auth Provider (`auth-ows.ts`)

**职责**:

- 使用 OWS Wallet 进行身份验证
- 管理多链地址
- 处理凭证和声誉数据

**API**:

```typescript
const auth = createOWSAuthProvider({
    network: 'devnet',
    defaultChain: 'solana',
});

// Login with OWS
const state = await auth.login();
// state.addresses.solana
// state.addresses.ethereum
// state.owsDID
// state.credentials
```

### 2. Wallet View (New)

**功能**:

- 显示多链余额
- 管理钱包连接
- 查看交易历史
- 跨链转账

### 3. Identity Integration

**DID (Decentralized Identifier)**:

```
did:ows:<wallet-address>
```

**凭证类型**:

- `reputation`: Gradience 协议声誉证明
- `skill`: 技能认证
- `verification`: KYC/身份验证

---

## 用户流程

### 登录流程

```
1. User opens AgentM
   │
   ▼
2. Choose Login Method
   ├─ OWS Wallet (new)
   ├─ Google OAuth (Privy)
   └─ Demo (mock)
   │
   ▼
3. OWS Login
   ├─ Connect OWS Wallet
   ├─ Grant permissions
   └─ Fetch multi-chain addresses
   │
   ▼
4. AgentM initializes
   ├─ Load user profile
   ├─ Fetch reputation from Chain Hub
   └─ Sync credentials from OWS
```

### 任务流程

```
1. User posts task
   ├─ Escrow funds via OWS (Solana)
   └─ Sign with OWS Wallet
   │
   ▼
2. Agent applies
   ├─ Stake via OWS
   └─ Sign application
   │
   ▼
3. Judge evaluates
   ├─ Sign judgment with OWS
   └─ Payment split via OWS
```

---

## 技术实现

### 文件结构

```
apps/agentm/src/renderer/lib/
├── auth.ts              # Auth provider factory
├── auth-ows.ts          # OWS auth provider
├── auth-ows.test.ts     # OWS auth tests
└── wallet/
    ├── ows-wallet.ts    # OWS wallet integration
    ├── multi-chain.ts   # Multi-chain utilities
    └── balances.ts      # Balance management
```

### 依赖

```json
{
    "@gradiences/ows-adapter": "file:../ows-adapter",
    "@gradiences/sdk": "file:../agent-arena/clients/typescript"
}
```

---

## 优势

### vs Privy

| 特性     | OWS       | Privy   |
| -------- | --------- | ------- |
| 多链支持 | ✅ 原生   | ⚠️ 有限 |
| 凭证管理 | ✅ 内置   | ❌ 无   |
| 声誉互通 | ✅ 跨应用 | ❌ 孤立 |
| 去中心化 | ✅ 完全   | ⚠️ 托管 |

### 与 Gradience 协同

1. **声誉层**: OWS 凭证 ↔ Gradience 链上声誉
2. **身份层**: OWS DID 作为 Agent 唯一标识
3. **资金层**: OWS 钱包管理多链资金
4. **消息层**: XMTP via OWS Agent Kit

---

## 后续任务

- [ ] GRA-58: OWS SDK Integration ✅
- [ ] GRA-59: Reputation-powered Wallet MVP ✅
- [ ] GRA-61: Demo & Presentation
- [ ] GRA-62: Pitch Deck
- [ ] GRA-63: Miami Travel

---

## 参考

- [OWS Adapter](../../apps/ows-adapter/README.md)
- [OWS Reputation Wallet](../../apps/ows-reputation-wallet/README.md)
- [OWS Integration Docs](../../docs/integrations/ows/)
