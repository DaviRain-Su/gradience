# GoldRush Hackathon Submission - Gradience

> **Track**: GoldRush Agentic Track  
> **Project**: Gradience Protocol + GoldRush Integration  
> **Submission Date**: 2026-04-04  
> **Status**: Ready for Submission 🚀

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technical Implementation](#2-technical-implementation)
3. [Data Usage Innovation](#3-data-usage-innovation)
4. [Demo Video Script](#4-demo-video-script)
5. [X Thread Content](#5-x-thread-content)
6. [Submission Links](#6-submission-links)

---

## 1. Project Overview

### Elevator Pitch

**Gradience** is the first reputation-powered wallet for AI Agents, leveraging **GoldRush's real-time blockchain data APIs** to build verifiable trust scores, detect risks, and enable secure Agent-to-Agent transactions. We transform raw on-chain data into actionable intelligence for autonomous economic actors.

### The Problem

AI Agents are becoming economic actors, but current infrastructure fails them:

| Challenge | Impact |
|-----------|--------|
| **No Data Access** | Agents can't query blockchain data effectively |
| **No Trust Layer** | Users can't verify Agent credibility before transactions |
| **No Risk Detection** | Fraudulent Agents exploit uninformed users |
| **No Transparency** | Black-box decisions erode confidence |

### Our Solution

```
┌─────────────────────────────────────────────────────────────────┐
│                     GRADIENCE + GOLDRUSH                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   🟡 GoldRush APIs          🤖 AI Analysis         🔒 Security   │
│   ├─ Transaction History    ├─ Pattern Recognition  ├─ Risk Alerts│
│   ├─ Token Balances         ├─ Trust Scoring        ├─ Fraud Block│
│   ├─ NFT Holdings           ├─ Whale Tracking       ├─ Verify First│
│   └─ Cross-chain Data       └─ Reputation Oracle    └─ Safe Trade │
│                                                                  │
│   Result: The first wallet that truly understands AI Agents     │
└─────────────────────────────────────────────────────────────────┘
```

### Key Features

1. **Real-time Risk Scoring** - Live wallet analysis using GoldRush balances + transactions
2. **Whale Signal Detection** - Track large transfers for market intelligence
3. **Security Monitoring** - Detect drainer approvals, phishing patterns, LP risks
4. **Trust Verification** - Combine on-chain data with Chain Hub reputation
5. **DEX Trading Signals** - AI-powered buy/sell recommendations with risk guards

---

## 2. Technical Implementation

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    GRADIENCE WALLET (UI)                        │
│              React + TypeScript + TailwindCSS                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│              GOLDRUSH SDK INTEGRATION LAYER                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Risk Scoring   │  │ Whale Tracker   │  │ Security Monitor│  │
│  │  Module         │  │ Module          │  │ Module          │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                ▼                                │
│              ┌─────────────────────────────────┐                │
│              │   GoldRushClient (SDK Core)     │                │
│              │   • balances_v2 API             │                │
│              │   • transactions_v3 API         │                │
│              │   • Real-time data fetching     │                │
│              └─────────────────┬───────────────┘                │
└────────────────────────────────┼────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   api.covalenthq.com    │
                    │   (GoldRush Data APIs)  │
                    └─────────────────────────┘
```

### Core Implementation

#### 2.1 Risk Scoring Engine

```typescript
// packages/chain-hub-sdk/src/goldrush.ts
export interface GoldRushRiskMetrics {
  address: string;
  source: "goldrush" | "heuristic";
  tokenCount: number;
  topHoldingRatio: number;      // Concentration risk
  staleApprovals: number;       // Security risk
  txCount24h: number;
  suspiciousTxRatio: number;    // Pattern risk
  riskScore: number;            // 0-100 composite
  generatedAt: string;
}

export class GoldRushClient {
  async getWalletRiskMetrics(address: string): Promise<GoldRushRiskMetrics> {
    // Fetch live data from GoldRush
    const [balancesRes, txRes] = await Promise.all([
      fetch(`${baseUrl}/solana-mainnet/address/${address}/balances_v2/?key=${apiKey}`),
      fetch(`${baseUrl}/solana-mainnet/address/${address}/transactions_v3/?key=${apiKey}&page-size=100`)
    ]);

    // Calculate multi-factor risk score
    const concentrationRisk = Math.round(topHoldingRatio * 70 + Math.max(0, 5 - tokenCount) * 4);
    const approvalRisk = Math.round(staleApprovals * 9);
    const txPatternRisk = Math.round(suspiciousTxRatio * 100 * 0.8);
    
    return {
      riskScore: Math.round(concentrationRisk * 0.4 + approvalRisk * 0.25 + txPatternRisk * 0.35),
      // ... additional metrics
    };
  }
}
```

#### 2.2 Wallet Risk Analysis

```typescript
// apps/agentm-pro/src/lib/goldrush/risk-scoring.ts
export interface WalletRiskReport {
  address: string;
  source: 'goldrush' | 'heuristic';
  riskScore: number;
  level: 'low' | 'medium' | 'high';
  factors: WalletRiskFactor[];
}

export async function scoreWalletRisk(address: string): Promise<WalletRiskReport> {
  // Fetch real-time inputs from GoldRush
  const inputs = await fetchGoldRushInputs(address);
  
  // Build weighted risk factors
  const factors = [
    {
      key: 'token_balances',
      label: 'SPL Token Balance Concentration',
      risk: tokenBalanceRisk,
      weight: 0.4,
      detail: `top holding ${(inputs.topHoldingRatio * 100).toFixed(1)}%, token count ${inputs.tokenCount}`,
    },
    {
      key: 'approval_hygiene',
      label: 'Approval Hygiene',
      risk: approvalRisk,
      weight: 0.25,
      detail: `${inputs.staleApprovals} stale approvals detected`,
    },
    {
      key: 'transaction_history',
      label: 'Transaction History',
      risk: transactionRisk,
      weight: 0.35,
      detail: `${inputs.txCount30d} tx / 30d, suspicious ${(inputs.suspiciousTxRatio * 100).toFixed(1)}%`,
    },
  ];

  // Composite risk calculation
  const riskScore = Math.round(
    factors.reduce((acc, factor) => acc + factor.risk * factor.weight, 0)
  );

  return { address, source: 'goldrush', riskScore, level: getRiskLevel(riskScore), factors };
}
```

#### 2.3 Whale Tracking Intelligence

```typescript
// apps/agentm-pro/src/lib/goldrush/whale-tracker.ts
export interface WhaleTransferEvent {
  id: string;
  wallet: string;
  direction: 'in' | 'out';
  signal: 'buy' | 'sell' | 'watch';
  token: string;
  amountUsd: number;
  timestamp: number;
}

export async function getWhaleTrackingFeed(
  wallets: string[]
): Promise<WhaleTransferEvent[]> {
  // Query GoldRush for high-value transactions
  const response = await fetch(
    `${GOLDRUSH_API}/solana-mainnet/address/${wallet}/transactions_v3/?key=${apiKey}&page-size=10`
  );
  
  // Filter for whale-sized transfers (> $25k)
  return txItems
    .filter(item => Number(item.value_quote) > 25_000)
    .map(item => ({
      signal: item.successful === false ? 'watch' : direction === 'out' ? 'sell' : 'buy',
      amountUsd: Number(item.value_quote),
      // ... additional fields
    }));
}
```

#### 2.4 Security Alert System

```typescript
// apps/agentm-pro/src/lib/goldrush/security-monitor.ts
export interface SecurityAlert {
  code: 'drainer_approval' | 'lp_pull_risk' | 'phishing_airdrop' | 'high_risk_wallet';
  severity: 'warning' | 'critical';
  message: string;
  recommendation: string;
}

export function evaluateWalletSecurity(report: WalletRiskReport): SecurityAlert[] {
  const alerts: SecurityAlert[] = [];

  // Detect drainer approvals
  if (report.inputs.staleApprovals >= 3) {
    alerts.push({
      code: 'drainer_approval',
      severity: report.inputs.staleApprovals >= 5 ? 'critical' : 'warning',
      message: `${report.inputs.staleApprovals} stale token approvals detected`,
      recommendation: 'Revoke unused approvals before executing OTC transfers.',
    });
  }

  // Detect concentration risk (LP pull)
  if (report.inputs.topHoldingRatio >= 0.8) {
    alerts.push({
      code: 'lp_pull_risk',
      severity: 'warning',
      message: 'Balance concentration is high and may amplify sudden LP pull risk',
      recommendation: 'Diversify token exposure and avoid thin-liquidity pairs.',
    });
  }

  // Detect suspicious patterns
  if (report.inputs.suspiciousTxRatio >= 0.22) {
    alerts.push({
      code: 'phishing_airdrop',
      severity: 'warning',
      message: `Suspicious transfer ratio ${(report.inputs.suspiciousTxRatio * 100).toFixed(1)}%`,
      recommendation: 'Block unknown token airdrops and verify destination contracts.',
    });
  }

  return alerts;
}
```

#### 2.5 Trust Score Computation

```typescript
// apps/agentm-pro/src/lib/goldrush/trust-score.ts
export interface CounterpartyTrustScore {
  address: string;
  trustScore: number;
  level: 'high' | 'medium' | 'low';
  reputation: ReputationData;
  walletRisk: WalletRiskReport;
}

export async function computeCounterpartyTrustScore(
  address: string
): Promise<CounterpartyTrustScore> {
  // Fetch Chain Hub reputation
  const reputation = await fetchReputationByAddress(address);
  
  // Fetch GoldRush wallet risk
  const walletRisk = await scoreWalletRisk(address);

  // Weighted trust calculation
  const reputationComponent = clamp(
    Math.round(
      reputation.avg_score * 0.7 +
      Math.min(reputation.completed, 30) * 0.6 +
      normalizedWinRate * 100 * 0.12
    )
  );
  const riskComponent = clamp(100 - walletRisk.riskScore);
  
  // Final trust score (0-100)
  const trustScore = clamp(
    Math.round(reputationComponent * 0.6 + riskComponent * 0.4)
  );

  return {
    address,
    trustScore,
    level: trustScore >= 70 ? 'high' : trustScore >= 45 ? 'medium' : 'low',
    reputation,
    walletRisk,
  };
}
```

#### 2.6 DEX Trading Bot Integration

```typescript
// apps/agentm-pro/src/lib/goldrush/trading-bot.ts
export interface DexTradingSignal {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  riskGuard: 'allow' | 'review' | 'block';
  reason: string;
}

export function generateDexTradingSignal(input: {
  agent: GridlessAgentIdentity;
  market: DexMarketSnapshot;
  walletRiskScore: number;
}): DexTradingSignal {
  const momentum =
    input.market.priceChange24h * 1.3 + 
    input.market.whaleSentiment * 28 + 
    (input.agent.chainHubReputation - 50) * 0.55;
  
  const liquidityBoost = input.market.liquidityUsd >= 300_000 ? 8 : 
                         input.market.liquidityUsd >= 160_000 ? 4 : 0;
  
  const riskPenalty = walletRisk * 0.6 + 
    (input.agent.trustLevel === 'low' ? 16 : 
     input.agent.trustLevel === 'medium' ? 7 : 0);

  const confidence = clampScore(Math.round(50 + momentum + liquidityBoost - riskPenalty));

  // Risk guard prevents high-risk trades
  const riskGuard: DexTradingSignal['riskGuard'] =
    walletRisk >= 80 || input.agent.trustScore < 40 ? 'block' :
    walletRisk >= 60 || input.agent.trustScore < 55 ? 'review' : 'allow';

  return { action, confidence, riskGuard, reason };
}
```

### API Endpoints Used

| Endpoint | Purpose | Data Retrieved |
|----------|---------|----------------|
| `balances_v2` | Token portfolio analysis | Token balances, USD quotes, spender approvals |
| `transactions_v3` | Transaction pattern analysis | TX history, success rates, value transfers |

---

## 3. Data Usage Innovation

### 🏆 Innovation Highlight: Multi-Dimensional Risk Intelligence

Our integration doesn't just query GoldRush data—we **transform it into actionable intelligence** through a proprietary multi-factor risk model.

#### 3.1 Data Transformation Pipeline

```
Raw GoldRush Data → Feature Extraction → Risk Calculation → Trust Score
        │                  │                  │               │
        ▼                  ▼                  ▼               ▼
   ┌─────────┐       ┌──────────┐       ┌──────────┐    ┌──────────┐
   │Balances │──────▶│Token     │──────▶│Concentr- │───▶│Composite │
   │API      │       │Diversity │       │ation Risk│    │Risk Score│
   └─────────┘       └──────────┘       └──────────┘    └────┬─────┘
                                                              │
   ┌─────────┐       ┌──────────┐       ┌──────────┐         │
   │TX       │──────▶│Pattern   │──────▶│Suspicious│─────────┤
   │History  │       │Detection │       │TX Risk   │         │
   └─────────┘       └──────────┘       └──────────┘         │
                                                              │
   ┌─────────┐       ┌──────────┐       ┌──────────┐         │
   │Spender  │──────▶│Approval  │──────▶│Security  │─────────┘
   │Metadata │       │Hygiene   │       │Risk      │
   └─────────┘       └──────────┘       └──────────┘
```

#### 3.2 Novel Risk Factors

| Factor | GoldRush Data Used | Innovation |
|--------|-------------------|------------|
| **Token Concentration Risk** | `balances_v2` quote values | Detects over-exposure to single assets |
| **Approval Hygiene Score** | `balances_v2` spender arrays | Identifies potential drainer contracts |
| **Transaction Velocity Risk** | `transactions_v3` count | Flags unusual activity patterns |
| **Suspicious Pattern Detection** | `transactions_v3` success + value | Detects failed TX spam, high-value anomalies |
| **Whale Signal Extraction** | `transactions_v3` value_quote | Derives market sentiment from large transfers |

#### 3.3 Real-Time Decision Making

```typescript
// Example: Real-time trade decision using GoldRush data
async function evaluateTrade(agentAddress: string, tradeAmount: number) {
  // 1. Fetch live risk metrics (GoldRush)
  const risk = await goldrushClient.getWalletRiskMetrics(agentAddress);
  
  // 2. Fetch reputation (Chain Hub)
  const reputation = await chainHub.getReputation(agentAddress);
  
  // 3. Compute composite trust score
  const trust = goldrushClient.combineWithReputation(agentAddress, risk, reputation);
  
  // 4. Risk guard decision
  if (trust.trustLevel === 'low' || risk.riskScore > 80) {
    return { decision: 'BLOCK', reason: 'High risk wallet detected' };
  }
  
  if (trust.trustLevel === 'medium' || risk.riskScore > 60) {
    return { decision: 'REVIEW', reason: 'Manual approval required' };
  }
  
  return { decision: 'ALLOW', confidence: trust.trustScore };
}
```

#### 3.4 Data-Driven Insights

Our system generates the following insights from GoldRush data:

1. **Risk Heatmaps** - Visual representation of wallet risk distribution
2. **Trend Analysis** - Risk score changes over time
3. **Peer Comparison** - How a wallet compares to similar addresses
4. **Predictive Alerts** - Early warning for emerging risk patterns

---

## 4. Demo Video Script

### 🎬 Video Specifications
- **Duration**: 3-4 minutes
- **Resolution**: 1920x1080 (1080p)
- **Format**: MP4
- **Target**: Technical judges + general audience

### Scene Breakdown

#### Scene 1: Hook & Problem (0:00-0:30)

**Visual:**
- Gradience logo animation
- Split screen: Normal wallet vs AI Agent trying to connect
- Warning icons appearing

**Narration:**
> "AI Agents are becoming economic actors—they trade, transact, and interact with wallets. But there's a critical gap: **how do you know if an Agent is trustworthy?** Current wallets treat Agents like regular users, exposing users to fraud and high-risk transactions."

**Text Overlay:**
```
❌ No Agent verification
❌ No risk assessment
❌ No trust layer
```

---

#### Scene 2: Solution Intro (0:30-1:00)

**Visual:**
- GoldRush logo + Gradience logo fusion
- Data flow animation: GoldRush APIs → Analysis → Trust Score

**Narration:**
> "Gradience integrates GoldRush's blockchain data APIs to build real-time reputation scores for every Agent. We transform raw on-chain data into actionable trust intelligence."

**Text Overlay:**
```
GoldRush Data
     ↓
Risk Analysis
     ↓
Trust Score
     ↓
Safe Transactions
```

---

#### Scene 3: Technical Demo - Risk Scoring (1:00-2:00)

**Screen Recording:**

```
[Terminal/IDE view]

$ curl "https://api.covalenthq.com/v1/solana-mainnet/address/7x.../balances_v2"

Response:
{
  "data": {
    "items": [
      { "contract_name": "SOL", "quote": 15000, "spenders": [...] },
      { "contract_name": "USDC", "quote": 5000, "spenders": [] },
      { "contract_name": "BONK", "quote": 200, "spenders": ["0x..."] }
    ]
  }
}

[Switch to Gradience UI]

┌─────────────────────────────────────────┐
│  Wallet Analysis: 7xKt...9mPq          │
│                                         │
│  🟡 Risk Score: 45/100 (Medium)        │
│                                         │
│  Risk Factors:                          │
│  ├─ Token Concentration: 75% (High)    │
│  ├─ Stale Approvals: 2 (Warning)       │
│  └─ TX Pattern: Normal                 │
│                                         │
│  Powered by GoldRush API               │
└─────────────────────────────────────────┘
```

**Narration:**
> "Here's our GoldRush integration in action. We query real-time balances and transaction history, then apply our multi-factor risk model. This wallet shows medium risk due to token concentration and stale approvals—critical insights that raw data alone can't provide."

---

#### Scene 4: Security Alerts Demo (2:00-2:45)

**Screen Recording:**

```
[Gradience Wallet UI]

⚠️ SECURITY ALERTS DETECTED

┌─────────────────────────────────────────┐
│ 🔴 CRITICAL: Drainer Approval Risk     │
│    5 stale token approvals detected    │
│    Recommendation: Revoke immediately  │
├─────────────────────────────────────────┤
│ 🟡 WARNING: High Concentration         │
│    82% held in single token            │
│    Recommendation: Diversify holdings  │
├─────────────────────────────────────────┤
│ 🟡 WARNING: Suspicious TX Pattern      │
│    25% failed transactions             │
│    Recommendation: Verify contracts    │
└─────────────────────────────────────────┘

[Action buttons: Review Transactions | Revoke Approvals | Block Wallet]
```

**Narration:**
> "Our security monitor transforms GoldRush data into actionable alerts. We detect drainer approvals, concentration risks, and suspicious patterns—protecting users before they interact with high-risk wallets."

---

#### Scene 5: Whale Tracking & Trading Signals (2:45-3:30)

**Screen Recording:**

```
[Gradience Dashboard]

🐋 Whale Activity Feed (Powered by GoldRush)

┌─────────────────────────────────────────────────────┐
│ Time     Wallet        Direction  Token   Amount   │
├─────────────────────────────────────────────────────┤
│ 2m ago   3xK9...       OUT →       SOL    $125,000 │
│ 5m ago   7mP2...       IN  →       USDC   $89,000  │
│ 12m ago  9xL4...       OUT →       BONK   $45,000  │
└─────────────────────────────────────────────────────┘

Signal: 🔴 SELL (Whale outflow detected)

[Trading Bot Interface]

DEX Trading Signal:
┌─────────────────────────────────────────┐
│ Action: SELL                           │
│ Confidence: 78%                        │
│ Risk Guard: ALLOW                      │
│                                        │
│ Reason: Bearish whale sentiment (-42%) │
│         ChainHub reputation: 82        │
│         Wallet risk: 35 (Low)          │
└─────────────────────────────────────────┘
```

**Narration:**
> "We also track whale movements using GoldRush transaction data. Large transfers signal market sentiment, which our trading bot combines with risk scores to generate buy, sell, or hold recommendations—with built-in risk guards to prevent high-risk trades."

---

#### Scene 6: Trust Score in Action (3:30-3:50)

**Screen Recording:**

```
[Side-by-side comparison]

HIGH REPUTATION AGENT          UNKNOWN AGENT
┌─────────────────────┐        ┌─────────────────────┐
│ Agent: Alice        │        │ Agent: Unknown      │
│ Trust Score: 85/100 │        │ Trust Score: 15/100 │
│ Level: 🟢 HIGH      │        │ Level: 🔴 LOW       │
│                     │        │                     │
│ ✅ 500+ TXs         │        │ ⚠️ 3 TXs only       │
│ ✅ 6 months active  │        │ ⚠️ New account      │
│ ✅ Cross-chain      │        │ ⚠️ Suspicious pattern│
│                     │        │                     │
│ [Approve] [Reject]  │        │ [Block] [Review]    │
└─────────────────────┘        └─────────────────────┘
```

**Narration:**
> "High reputation? Approve with confidence. Unknown Agent? The wallet blocks or requires manual review. This is the trust layer the Agent economy needs."

---

#### Scene 7: Closing & CTA (3:50-4:00)

**Visual:**
- QR code to demo
- GitHub link
- Architecture diagram

**Text Overlay:**
```
🌐 demo.gradience.io
📱 github.com/DaviRain-Su/gradience
🐦 @gradience_labs

Built with ❤️ + GoldRush API
```

**Narration:**
> "Gradience: The first wallet that truly understands AI Agents. Built for the GoldRush Hackathon. Try it today."

---

### Production Checklist

- [ ] Screen recording software tested (OBS/QuickTime)
- [ ] Clean desktop/workspace prepared
- [ ] All browser tabs pre-loaded
- [ ] Voiceover recorded (or clear captions)
- [ ] Background music selected (royalty-free)
- [ ] Text overlays designed
- [ ] Video edited and exported (1080p MP4)
- [ ] Uploaded to YouTube (unlisted)

---

## 5. X Thread Content

### Thread 1: The Problem

**Tweet 1/5:**
```
AI Agents are becoming economic actors—but there's a massive trust problem. 🧵

Current wallets treat Agents like regular users. No verification. No risk assessment. No protection.

Result? Users exposed to fraud, scams, and high-risk transactions.

Here's how we're fixing it ↓
```

**Tweet 2/5:**
```
Meet Gradience + @GoldRush—the first reputation-powered wallet for AI Agents.

We use GoldRush's real-time blockchain data to:
• Calculate risk scores
• Detect suspicious patterns
• Verify Agent credibility
• Block fraudulent transactions

Trust, but verify. With data.
```

**Tweet 3/5:**
```
Our multi-factor risk model transforms raw on-chain data into actionable intelligence:

🟡 Token concentration risk
🟡 Approval hygiene scoring
🟡 Transaction pattern analysis
🟡 Whale movement tracking

All powered by GoldRush APIs.

[Architecture diagram image]
```

**Tweet 4/5:**
```
Live demo of our GoldRush integration:

→ Query wallet balances + TX history
→ Calculate composite risk score
→ Generate trust level (High/Medium/Low)
→ Block or approve transactions accordingly

High reputation = seamless experience
Unknown Agent = manual review required

[Demo video/GIF]
```

**Tweet 5/5:**
```
Built for the @GoldRush Hackathon 🏆

🌐 Try the demo: https://demo.gradience.io
📱 GitHub: https://github.com/DaviRain-Su/gradience
📊 Full submission: [docs link]

The Agent economy needs a trust layer.

Gradience + GoldRush = The solution.

RT to spread the word! 🚀
```

### Single Tweet (Condensed)

```
🚀 Submitted to @GoldRush Hackathon!

Gradience: The first reputation-powered wallet for AI Agents.

Powered by GoldRush APIs:
✅ Real-time risk scoring
✅ Fraud detection
✅ Trust verification
✅ Whale tracking

Demo: https://demo.gradience.io
Code: https://github.com/DaviRain-Su/gradience

#GoldRushHackathon #AIAgents #Web3
```

---

## 6. Submission Links

### GitHub Repository
- **URL**: https://github.com/DaviRain-Su/gradience
- **Key Directories**:
  - `/packages/chain-hub-sdk/src/goldrush.ts` - Core SDK integration
  - `/apps/agentm-pro/src/lib/goldrush/` - AgentM Pro modules
  - `/docs/hackathon/goldrush/` - Submission materials

### Live Demo
- **URL**: https://demo.gradience.io
- **Test Wallets**:
  - High reputation: `demo-agent-high@gradience.io`
  - Low reputation: `demo-agent-low@gradience.io`

### Video
- **URL**: [YouTube/Vimeo link to be added]
- **Status**: 🎬 Ready to record

### Documentation
- **Technical Spec**: `/docs/hackathon/goldrush/submission.md` (this file)
- **Demo Script**: `/docs/hackathon/goldrush-demo-video-script.md`

### Social
- **X/Twitter**: @gradience_labs
- **Website**: https://gradiences.xyz

---

## ✅ Submission Checklist

- [x] Project overview with problem/solution
- [x] Technical implementation with code examples
- [x] Data usage innovation highlighted
- [x] Demo video script (full 3-4 minute breakdown)
- [x] X thread content (5-tweet thread + condensed)
- [x] All submission links documented
- [ ] Demo video recorded and uploaded
- [ ] Live demo deployed
- [ ] X thread published
- [ ] Submission form completed

---

## 🏆 Judging Criteria Alignment

| Criteria | How We Address It |
|----------|-------------------|
| **Innovation (25%)** | First reputation-powered Agent wallet; novel multi-factor risk model |
| **Technical Implementation (25%)** | Clean architecture; 6 specialized modules; real-time processing |
| **GoldRush Data Usage (25%)** | Deep integration with balances_v2 + transactions_v3; data transformation pipeline |
| **Practicality (25%)** | Solves real fraud problem; ready for production; scalable architecture |

---

*Submission prepared for GoldRush Agentic Track Hackathon*  
*Gradience Protocol Team | 2026-04-04*
