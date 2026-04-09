# Gradience OWS Hackathon

> **Agent Identity with Reputation**  
> OWS Hackathon Miami 2026 - Track 02/03/04

---

## 🎯 Project

**"首个带信用评分的 Agent 身份系统"**

在 ows.domains 基础上叠加 Gradience Reputation：

- ✅ OWS 原生钱包 (Track 03)
- ✅ ENS 跨链身份 (Track 03)
- ✅ **声誉评分系统** (差异化)
- ✅ **声誉门控的 Wallet-per-Agent** (Track 02 + 04)

---

## 🚀 Quick Start

### Install

```bash
cd apps/hackathon-ows
npm install
npm run build
```

### CLI Usage

```bash
# Register new agent
./dist/cli/index.js agent register --name "trading-agent"

# Check reputation
./dist/cli/index.js reputation check trading-agent.ows.eth

# Simulate task completion
./dist/cli/index.js reputation simulate trading-agent --score 5 --amount 100

# Create sub-wallet
./dist/cli/index.js wallet create-sub --parent trading-agent --name sub-1

# Check wallet policy
./gradience wallet check-policy trading-agent.ows.eth
```

### Web Demo

```bash
cd demo/web
npm install
npm run dev
```

Open http://localhost:3002

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Gradience OWS Identity                  │
├─────────────────────────────────────────────────────────┤
│  CLI Commands                                            │
│  ├── agent register                                     │
│  ├── reputation check/simulate                          │
│  └── wallet create-sub/check-policy                     │
├─────────────────────────────────────────────────────────┤
│  Core Services                                           │
│  ├── AgentService: Identity + ENS                       │
│  ├── ReputationService: Scoring + History               │
│  └── WalletService: Policy + Sub-wallets                │
├─────────────────────────────────────────────────────────┤
│  OWS Integration                                         │
│  └── Multi-chain wallet creation                        │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Reputation System

| Score  | Level    | Daily Limit | Perks         |
| ------ | -------- | ----------- | ------------- |
| 0-39   | Bronze   | $500        | Basic tokens  |
| 40-59  | Silver   | $650        | More tokens   |
| 60-79  | Gold     | $800        | Less approval |
| 80-100 | Platinum | $1000+      | All features  |

**Factors**:

- Task completion rate
- Judge ratings
- Payment speed
- Dispute rate
- Cross-chain success

---

## 🎨 Demo Scenarios

### 1. New Agent Registration

```bash
$ gradience agent register --name "trading-agent"

✓ Created OWS wallet
✓ Registered ENS: trading-agent.ows.eth
✓ Cross-chain addresses:
  - ETH: 0xEBd6...
  - SOL: 5Y3dUir...
✓ Initial reputation: 50 (Bronze)
✓ Policy: Daily limit $500
```

### 2. Task Completion → Reputation Boost

```bash
$ gradience reputation simulate trading-agent --score 5 --amount 100

✓ Task verified
✓ Payment: $100 USDC
✓ Reputation: 50 → 65 (+15)
✓ Level up: Bronze → Silver
```

### 3. High Reputation = More Freedom

```bash
$ gradience wallet check-policy elite-trader.ows.eth

Reputation: 92 (Platinum)
Policy:
- Daily limit: $9200
- No approval required
- All tokens allowed
- Can create sub-agents
```

---

## 🏆 Hackathon Submission

**Tracks**:

- Track 02: Agent Spend Governance ⭐⭐⭐⭐⭐
- Track 04: Multi-Agent Systems ⭐⭐⭐⭐⭐
- Track 03: The Grid ⭐⭐⭐⭐

**Tech Stack**:

- OWS CLI (wallet creation)
- ENS (cross-chain identity)
- TypeScript/Node.js
- Next.js (demo web)

**Differentiation**:

- Only system with reputation scores
- Policy engine based on track record
- Wallet-per-Agent with inheritance

---

## 📁 Project Structure

```
apps/hackathon-ows/
├── src/
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── agent.ts
│   │   │   ├── reputation.ts
│   │   │   └── wallet.ts
│   │   └── index.ts
│   ├── core/
│   │   ├── agent.ts
│   │   ├── reputation.ts
│   │   └── wallet.ts
│   └── ows/
│       └── wallet.ts
├── demo/web/
│   └── src/app/page.tsx
├── package.json
└── README.md
```

---

## ✅ Checklist

- [x] OWS CLI integration
- [x] Multi-chain wallet creation
- [x] ENS identity registration
- [x] Reputation scoring system
- [x] Policy engine
- [x] Sub-wallet creation
- [x] CLI interface
- [x] Web demo
- [ ] MoonPay Skill (pending API key)
- [ ] Smart contract deployment

---

## 📝 License

MIT
