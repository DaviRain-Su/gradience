# OWS Hackathon Miami 2026 - Demo Outline

> **Project**: Gradience + OWS Integration
> **Date**: April 3, 2026
> **Demo Duration**: 5 minutes
> **Presenter**: Gradience Team

---

## 🎯 Demo Goal

Show how Gradience Protocol integrates with Open Wallet Standard (OWS) to create a **reputation-powered agent economy** with multi-chain identity and verifiable credentials.

---

## 📋 Demo Flow (5 minutes)

### 1. Introduction (30s)

**What we built:**

- Gradience: Decentralized AI Agent Credit Protocol
- OWS Integration: Multi-chain wallet + identity layer
- Result: Reputation-powered agent economy

**Key innovation:**

> "Your work history becomes your creditworthiness"

---

### 2. Login with OWS (45s)

**Show:**

1. User opens AgentM
2. Clicks "Login with OWS Wallet"
3. OWS connection established
4. Multi-chain addresses displayed
    - Solana: `7xKx...9Yz`
    - Ethereum: `0xabc...def`
5. DID: `did:ows:7xKx...9Yz`

**Key point:**

> One wallet, multiple chains, unified identity

---

### 3. Reputation Dashboard (60s)

**Show:**

```
🏆 REPUTATION-POWERED WALLET

Tier: 🥇 GOLD
Overall Score: 85/100

📊 Statistics:
  • Completion Rate: 92%
  • Avg Quality: 87/100
  • Completed Tasks: 12
  • Total Earned: 60,000 lamports

💳 Credit Limit: 24,000 lamports

🔐 Access:
  • Premium Features: ✅
  • Judge Eligibility: ✅
```

**Key points:**

- Reputation = Work history on-chain
- Higher reputation = Higher credit limit
- Tier-based access control

---

### 4. Post a Task (45s)

**Show:**

1. User creates task: "Analyze market data"
2. Sets reward: 5,000 lamports
3. Signs escrow with OWS
4. Funds locked in smart contract
5. Task broadcast to agents

**Key point:**

> OWS handles multi-chain escrow seamlessly

---

### 5. Agent Competition (45s)

**Show:**

1. Agents discover task via XMTP
2. Agent "DataAnalyzer_v2" applies
3. Stakes 500 lamports via OWS
4. Submits result to IPFS

**Key point:**

> Race model: Best agent wins, not platform-assigned

---

### 6. Automatic Settlement (45s)

**Show:**

1. Judge evaluates: Score 88/100
2. Automatic payment split:
    - Agent: 4,750 (95%)
    - Judge: 150 (3%)
    - Protocol: 100 (2%)
3. Reputation updated for both

**Key point:**

> 5% total fees vs 20-30% industry standard

---

### 7. Cross-Chain Reputation (30s)

**Show:**

1. User generates reputation proof via OWS
2. Proof verified on Ethereum
3. Same agent identity, new chain

**Key point:**

> Reputation is portable across chains

---

## 🎤 Talking Points

### Problem (15s)

- AI Agents can't prove capability
- Data trapped in platforms
- No autonomous commerce

### Solution (15s)

- On-chain work history = reputation
- OWS provides multi-chain identity
- Gradience provides settlement layer

### Why OWS (15s)

- Multi-chain wallet management
- Verifiable credentials
- XMTP messaging integration
- Backed by MoonPay, PayPal, EF

### Traction (15s)

- 55 integration tests passing
- 7-Phase methodology complete
- Demo live today

---

## 🛠️ Technical Stack

| Layer      | Technology                  |
| ---------- | --------------------------- |
| Identity   | OWS Wallet + DID            |
| Settlement | Gradience Protocol (Solana) |
| Messaging  | XMTP via OWS                |
| Frontend   | AgentM (React + Vite)       |
| Reputation | On-chain + OWS Credentials  |

---

## 📊 Key Metrics

| Metric        | Value                   |
| ------------- | ----------------------- |
| Test Coverage | 371+ tests              |
| Fees          | 5% (vs 20-30% industry) |
| States        | 3 (vs 6 in ERC-8183)    |
| Code          | ~300 lines core         |

---

## 🎁 Live Demo Checklist

- [ ] AgentM running locally
- [ ] OWS Wallet connected
- [ ] Demo script ready
- [ ] Backup video recorded
- [ ] QR code for repo

---

## 🔗 Links

- **Demo**: [Run demo-script.sh](./demo-script.sh)
- **Repo**: https://github.com/gradiences/protocol
- **Docs**: https://docs.gradience.xyz
- **OWS**: https://openwallet.sh

---

## 💡 Post-Demo Q&A Prep

**Q: How is this different from Virtuals?**
A: 9/11 dimensions better - lower fees (5% vs 20%), open competition, built-in reputation.

**Q: Why OWS instead of Privy?**
A: OWS provides multi-chain native support, verifiable credentials, and cross-chain identity.

**Q: What's the business model?**
A: 2% protocol fee on each task. At scale with 1M agents doing $100/month = $24M/year.

**Q: How do you prevent Sybil attacks?**
A: Reputation is earned through work, not bought. New agents start at Bronze tier.

---

_Demo prepared for OWS Hackathon Miami 2026_
