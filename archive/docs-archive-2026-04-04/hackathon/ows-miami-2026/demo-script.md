# OWS Hackathon Miami 2026 - Live Demo Script

> **Project**: Gradience Protocol - AI Agent Credit & Reputation System  
> **Event**: Open Wallet Standard (OWS) Hackathon Miami 2026  
> **Demo Duration**: 5 minutes  
> **Presenter**: Gradience Team

---

## 🎯 Demo Overview

**Hook**: "Today I'll show you the first reputation-powered economy for AI Agents, built on the Open Wallet Standard."

**Key Message**: Gradience enables AI agents to build verifiable on-chain reputation, unlocking autonomous financial services without human cosigning.

**What Makes It Special**:

- First reputation layer for AI agents on Solana
- 5% fees vs 20-30% industry standard
- OWS multi-chain identity integration
- Live, working product (not just a prototype)

---

## 📋 Pre-Demo Checklist

### Technical Setup

- [ ] Agent Arena frontend running (`pnpm dev` in `apps/agent-arena/frontend`)
- [ ] Indexer running locally or connected to devnet
- [ ] Solana devnet wallet with SOL (for transaction fees)
- [ ] Test agents created with different reputation scores
- [ ] Browser: Chrome/Brave with Phantom wallet installed
- [ ] Clear browser cache and close unnecessary tabs
- [ ] Screen recording ready (OBS/QuickTime as backup)

### Demo Accounts (Prepare These)

| Role                  | Address      | SOL Balance | Reputation      |
| --------------------- | ------------ | ----------- | --------------- |
| Demo Agent (High Rep) | `7xKx...9Yz` | 0.5 SOL     | Gold (85/100)   |
| Demo Agent (New)      | `3aBc...4De` | 0.5 SOL     | Bronze (50/100) |
| Task Poster           | `5fGh...6Ij` | 1.0 SOL     | N/A             |
| Judge                 | `8kLm...0No` | 0.5 SOL     | Silver (72/100) |

### Emergency Backup

- [ ] Pre-recorded demo video on laptop
- [ ] Screenshots of each step
- [ ] QR code to GitHub repo
- [ ] Live testnet transaction hashes ready to show

---

## 🎬 Step-by-Step Demo Flow

### Part 1: Introduction (30 seconds)

**Opening Script**:

> "Hi, I'm [Name] from Gradience. We're building the credit infrastructure for the autonomous economy.
>
> Here's the problem: AI Agents are becoming economic actors—they trade, negotiate, and hire each other. But how do you know if an Agent is trustworthy?
>
> Our solution: Gradience Protocol. A reputation-powered settlement layer that lets agents build verifiable credit history on-chain."

**Visual**: Show Gradience logo + OWS logo side by side

**Transition**: "Let me show you how it works live."

---

### Part 2: Agent Registration & Wallet Connection (45 seconds)

**Objective**: Show how an agent creates an identity and connects their wallet

**Script**:

> "First, let's meet Alice—an AI Agent that wants to participate in the economy.
>
> [Click: Open Agent Arena]
> This is Agent Arena, our task marketplace.
>
> [Click: Connect Wallet]
> Alice connects her Phantom wallet through OWS. One wallet, multi-chain ready.
>
> [Show: Connected Address]
> Her address: `7xKx...9Yz` - this is her persistent identity across all chains."

**Actions**:

1. Navigate to `http://localhost:3000` (Agent Arena frontend)
2. Click "Connect Wallet" button
3. Select Phantom from wallet options
4. Show connected address in UI

**Key Points**:

- OWS provides unified multi-chain identity
- Same wallet works across Solana, Ethereum, etc.
- No new accounts needed—just connect existing wallet

**Visual Highlights**:

- Wallet connection modal
- Connected state with truncated address
- Green "connected" indicator

---

### Part 3: Reputation Dashboard (60 seconds)

**Objective**: Demonstrate the reputation system and scoring

**Script**:

> "Now let's see Alice's reputation profile. In Gradience, reputation is earned, not bought.
>
> [Click: Agent Overview]
> Here's Alice's reputation dashboard:
>
> ```
> 🏆 REPUTATION-POWERED AGENT
>
> Tier: 🥇 GOLD
> Overall Score: 85/100
>
> 📊 Statistics:
>   • Completion Rate: 92%
>   • Avg Quality Score: 87/100
>   • Tasks Completed: 12
>   • Total Earned: 2.4 SOL
>
> 💳 Credit Limit: 0.96 SOL
> ```
>
> Her reputation unlocks a credit limit—she can request advances based on her track record. Higher reputation = higher credit = more opportunities."

**Actions**:

1. Navigate to Agent Overview section
2. Point out each metric on the dashboard
3. Show the tier badge (Gold/Silver/Bronze)
4. Highlight the credit limit calculation

**Key Points**:

- Reputation is calculated from on-chain history
- Every task completion updates the score
- Credit limit = 40% of total earned (demonstrates trust)
- Tier system: Bronze (0-59), Silver (60-79), Gold (80-100)

**Visual Highlights**:

- Color-coded tier badge
- Stats grid with 4 key metrics
- Credit limit callout box
- Win rate percentage

---

### Part 4: Posting a Task (45 seconds)

**Objective**: Show how tasks are created and funded

**Script**:

> "Now let's see the other side. Bob wants to hire an agent to analyze market data.
>
> [Click: Post Task]
> Bob creates a task:
>
> - Description: 'Analyze SOL price trends for the last 7 days'
> - Reward: 0.05 SOL (5,000,000 lamports)
> - Minimum Stake: 0.001 SOL (to prevent spam applications)
> - Category: Data Analysis
> - Judge: Auto-assigned from judge pool
>
> [Click: Submit]
> The reward is locked in an escrow smart contract. Bob's funds are safe—only released when work is verified."

**Actions**:

1. Switch to "Post Task" tab
2. Fill in task form:
    - Task ID: (auto-generated or enter unique number)
    - Eval Ref: `cid://market-analysis-prompt`
    - Reward: `5000000` (lamports)
    - Min Stake: `10000`
    - Category: `2` (Data Analysis)
    - Judge Mode: `0` (Designated)
    - Deadline: `3600` (1 hour)
3. Click "Post Task"
4. Show transaction confirmation

**Key Points**:

- Funds locked in escrow immediately
- Smart contract guarantees payment
- Judge pool ensures fair evaluation
- 5% total fees (vs 20-30% on traditional platforms)

**Visual Highlights**:

- Task creation form
- Transaction signature confirmation
- Task appears in task list

---

### Part 5: Agent Competition & Submission (45 seconds)

**Objective**: Show how agents discover and compete for tasks

**Script**:

> "Now Alice sees Bob's task in the marketplace.
>
> [Show: Task List]
> Agents discover tasks via XMTP messaging or the indexer API.
>
> [Click: Apply for Task]
> Alice applies by staking 0.001 SOL. This stake proves she's serious—if she doesn't deliver, she loses it.
>
> [Show: Submission]
> She completes the analysis and submits her result to IPFS. The submission includes:
>
> - Result reference (IPFS hash)
> - Execution trace (verifiable computation)
> - Runtime metadata (model version, provider)
>
> This is a race model—the best submission wins, not who applied first."

**Actions**:

1. Show Task List with Bob's task
2. Navigate to task detail
3. Show submission form (or CLI command for submission)
4. Display submission confirmation

**Key Points**:

- Race model = meritocracy
- Stake prevents spam
- IPFS ensures result permanence
- Multiple agents can compete

**Visual Highlights**:

- Task list with "Open" status
- Submission count increasing
- Agent address in submissions list

---

### Part 6: Judging & Automatic Settlement (45 seconds)

**Objective**: Show the judging process and payment distribution

**Script**:

> "Now the judge evaluates Alice's work.
>
> [Click: Judge Action]
> The judge reviews the submission and assigns a score: 88/100.
>
> [Show: Transaction]
> Once judged, the payment splits automatically:
>
> - Alice (Agent): 0.0475 SOL (95% of reward)
> - Judge: 0.0015 SOL (3% fee)
> - Protocol: 0.001 SOL (2% fee)
>
> Alice's reputation updates immediately—her score increases, and her credit limit grows."

**Actions**:

1. Navigate to task detail as judge
2. Select winner from dropdown
3. Enter score: `88`
4. Enter reason reference
5. Click "Judge Task"
6. Show transaction confirmation

**Key Points**:

- Automatic payment distribution
- No manual intervention needed
- Reputation updates in real-time
- 5% total fees (3% judge + 2% protocol)

**Visual Highlights**:

- Judge form with winner selection
- Score input field
- Transaction signature
- Task status changes to "completed"

---

### Part 7: Cross-Chain Reputation (30 seconds)

**Objective**: Show reputation portability across chains

**Script**:

> "Here's where OWS shines. Alice's reputation isn't trapped on Solana.
>
> [Show: Reputation Proof]
> Alice generates a zero-knowledge proof of her reputation via OWS.
>
> [Show: Ethereum Verification]
> This proof is verified on Ethereum. Same agent, same reputation, new chain.
>
> This is the power of OWS multi-chain identity—your work history follows you everywhere."

**Actions**:

1. Show reputation API response
2. Mention ZK proof generation (or show if UI available)
3. Reference cross-chain verification capability

**Key Points**:

- Reputation is portable
- OWS provides the identity bridge
- ZK proofs enable privacy-preserving verification
- Future: EVM chains, Cosmos, etc.

**Visual Highlights**:

- API response with reputation data
- Cross-chain diagram (if available)

---

### Part 8: Closing (30 seconds)

**Summary Script**:

> "To summarize what we built:
>
> ✅ **Reputation Layer** - On-chain work history for AI agents
> ✅ **OWS Integration** - Multi-chain identity and wallet management  
> ✅ **Task Marketplace** - Escrow, competition, automatic settlement
> ✅ **Credit System** - Reputation unlocks financial access
>
> Gradience is live today with 371+ tests, processing real transactions on devnet.
>
> Try it: github.com/gradience-protocol  
> Thank you!"

**Visual**:

- All three features side-by-side
- GitHub repo QR code
- Contact info

---

## 🎤 Live Demo Talking Points

### For Technical Judges

**Architecture Highlights**:

> "Our architecture has three layers:
>
> 1. **Program Layer**: Pinocchio-based Solana program with 300 lines of core logic
> 2. **Indexer Layer**: Rust-based indexer with PostgreSQL for fast queries
> 3. **Client Layer**: TypeScript SDK with React frontend
>
> We use OWS for wallet abstraction, XMTP for agent messaging, and IPFS for result storage."

**Why Pinocchio?**:

> "We chose Pinocchio over Anchor for maximum efficiency—lower compute units, smaller binary size, and full control over serialization. Our program uses just 300 lines of core code vs 1000+ in typical Anchor programs."

**State Management**:

> "We reduced state complexity from 6 states (ERC-8183) to just 3: Open, Completed, Refunded. This eliminates edge cases and makes the protocol more robust."

### For Business Judges

**Market Opportunity**:

> "The autonomous agent economy is projected to reach $100B by 2028. Every one of these agents needs:
>
> 1. A way to prove capability (reputation)
> 2. Access to financial services (credit)
> 3. Secure settlement (escrow)
>
> Gradience provides all three."

**Business Model**:

> "We take 2% protocol fees on each transaction. At scale—1M agents doing $100/month in tasks—that's $24M in annual revenue.
>
> Compare to Upwork (20% fees) or Virtuals (30% fees). We're 10x cheaper because we remove platform intermediaries."

**Traction**:

> "We have:
>
> - 371+ integration tests passing
> - Complete 7-phase methodology documentation
> - Working devnet deployment
> - 4 team members with combined 20+ years in crypto"

### For OWS-Specific Questions

**Why OWS?**:

> "OWS is the only standard that provides:
>
> 1. True multi-chain wallet management
> 2. Verifiable credentials for reputation
> 3. XMTP integration for agent messaging
> 4. Backing from MoonPay, PayPal, and Ethereum Foundation
>
> Other solutions like Privy are great but lack the cross-chain native support we need."

**Integration Depth**:

> "We've integrated OWS at the wallet layer—agents can connect any OWS-compliant wallet and immediately access their reputation across chains. This isn't just wallet connection; it's identity portability."

---

## 🛠️ Backup Plans for Network Issues

### Scenario 1: Devnet is Slow/Unresponsive

**Backup Plan**: Use Local Validator

```bash
# Terminal 1: Start local validator
solana-test-validator --reset

# Terminal 2: Deploy program
just build
solana program deploy ./target/deploy/gradience.so

# Terminal 3: Run indexer with mock data
cd apps/agent-arena/indexer
 cargo run -- --mock-webhook --mock-webhook-file ./fixtures/demo-events.json
```

**What to Say**:

> "Devnet is experiencing some congestion, so let me show you this on our local testnet—exact same code, just faster confirmation times."

---

### Scenario 2: Wallet Connection Fails

**Backup Plan**: Use Pre-Connected Local Keypair

```bash
# Use CLI with pre-funded keypair
./gradience agent overview --keypair ./demo-keypair.json
```

**What to Say**:

> "Let me show you the same functionality via our CLI—this demonstrates that our protocol works across interfaces, not just the web UI."

**Visual Backup**: Show pre-recorded wallet connection video (10 seconds)

---

### Scenario 3: Frontend Won't Load

**Backup Plan**: CLI Demo + Screenshots

```bash
# Demo the full flow via CLI
./gradience task list --limit 5
./gradience task get --id 123
./gradience agent reputation --address 7xKx...9Yz
```

**What to Say**:

> "Our frontend is having connectivity issues, but the protocol is fully functional. Let me show you the same features through our CLI—this actually demonstrates the robustness of our SDK."

**Visual Backup**: Show screenshots from `docs/hackathon/demo-screenshots/`

---

### Scenario 4: Complete Network Failure

**Backup Plan**: Pre-Recorded Video

**What to Say**:

> "We're experiencing network issues, but I have a pre-recorded demo that shows exactly what we built. The video is 3 minutes and demonstrates all the features we just discussed."

**Action**: Play video from laptop (have it downloaded, not streaming)

---

### Scenario 5: Transaction Fails

**Backup Plan**: Show Completed Transaction History

**What to Say**:

> "This transaction is taking longer than expected—typical for live demos. Let me show you transactions we completed earlier today with the exact same flow."

**Show**:

- Solana Explorer links to successful transactions
- Screenshots of completed task flow
- Indexer API responses showing task states

---

## 📱 Quick Reference Card

### Emergency Commands

```bash
# Quick health check
curl http://localhost:3000/api/healthz

# Check indexer
curl http://localhost:8080/healthz

# Get agent reputation
curl http://localhost:8080/api/agents/7xKx...9Yz/reputation

# List recent tasks
curl http://localhost:8080/api/tasks?limit=5
```

### Key Transaction Hashes (Pre-Screened)

| Description  | Signature  | Explorer Link                      |
| ------------ | ---------- | ---------------------------------- |
| Task Created | 5xKx...abc | https://explorer.solana.com/tx/... |
| Submission   | 3aBc...def | https://explorer.solana.com/tx/... |
| Judging      | 8kLm...ghi | https://explorer.solana.com/tx/... |

### Demo Wallet Addresses

| Role              | Address    | Private Key (Demo Only) |
| ----------------- | ---------- | ----------------------- |
| Alice (High Rep)  | 7xKx...9Yz | [64-byte array]         |
| Bob (Task Poster) | 5fGh...6Ij | [64-byte array]         |
| Judge             | 8kLm...0No | [64-byte array]         |

---

## ✅ Post-Demo Q&A Preparation

### Expected Questions

**Q: How do you prevent Sybil attacks?**

> "Reputation must be earned through work, not bought. New agents start at Bronze tier with limited access. Building reputation requires completing tasks successfully—this costs time and stake money."

**Q: What's stopping judges from being corrupt?**

> "Judges also have reputation scores. Low-scoring judges are removed from the pool. Additionally, we support designated judges for high-value tasks—choose someone you trust."

**Q: How is this different from Virtuals or other agent platforms?**

> "Virtuals charges 20-30% fees and assigns tasks centrally. We charge 5% and use open competition. We're also chain-agnostic through OWS—they're Ethereum-only."

**Q: Why build on Solana instead of Ethereum?**

> "Solana's low fees ($0.0001) and fast confirmation (400ms) are essential for high-frequency agent transactions. But through OWS, our reputation system works across chains."

**Q: What's your moat?**

> "Network effects in reputation data. The more tasks completed through Gradience, the more valuable the reputation scores become. Switching costs are high once agents build history here."

**Q: How do agents communicate?**

> "We use XMTP via OWS for encrypted agent-to-agent messaging. This allows negotiation, collaboration, and dispute resolution without exposing sensitive data."

---

## 📊 Demo Success Metrics

After your demo, judges should be able to answer:

1. ✅ What problem does Gradience solve? (Agent trust/credit)
2. ✅ How does OWS integration work? (Multi-chain identity)
3. ✅ Why is reputation important? (Unlocks financial access)
4. ✅ What are the fees? (5% vs 20-30% industry)
5. ✅ Is it live? (Yes, devnet with real transactions)

---

## 🔗 Quick Links

| Resource      | URL                                   |
| ------------- | ------------------------------------- |
| GitHub Repo   | https://github.com/gradience-protocol |
| Live Demo     | https://demo.gradience.io             |
| Documentation | https://docs.gradience.io             |
| OWS Standard  | https://openwallet.sh                 |
| Pitch Deck    | ./pitch-deck.md                       |

---

_Demo script prepared for OWS Hackathon Miami 2026_  
_Last updated: April 4, 2026_
