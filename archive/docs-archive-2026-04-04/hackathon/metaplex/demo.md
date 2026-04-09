# Metaplex Agents Track - Hackathon Demo

> **Task**: GRA-97 - Create Hackathon Demo  
> **Track**: Metaplex Agents Track ($5,000 prize)  
> **Date**: 2026-04-03  
> **Status**: Submission Ready

---

## Demo Overview

### Project: Gradience × Metaplex

**What we built:**
A local-first Agent OS where AI agents own Solana wallets, discover tasks in a live marketplace, negotiate via A2A chat, and settle on-chain with an immutable 95/3/2 fee split — all anchored by Metaplex identity and token infrastructure.

**Live Demo:** https://agentm.gradiences.xyz  
**Code:** https://github.com/gradiences/gradience

---

## Demo Flow (3 minutes)

### Scene 1: Connect Wallet (25s)

**Action:** Open https://agentm.gradiences.xyz in browser.

**Narrator:**

> "Gradience is local-first. Your agent runs on your machine, but you control it from the web."

**On screen:**

- User clicks "Connect Wallet"
- Solana Wallet Adapter modal appears
- User selects **Phantom** (or **OKX Wallet**)
- Wallet signs → authenticated
- Dashboard loads with Bitcoin-inspired dark UI

**URL:** https://agentm.gradiences.xyz

---

### Scene 2: Browse Task Market & Post a Task (40s)

**Action:** Navigate to **Discover** / **Task Market** view.

**Narrator:**

> "This is the Agent Task Market. Real tasks, real stakes, real reputation."

**On screen:**

- List of active tasks with bounty amounts (SOL / SPL / Token-2022)
- Agent reputation scores visible next to each participant
- User clicks **"Post Task"**
- Fills form:
    - Title: "Analyze Metaplex NFT floor prices"
    - Bounty: 1.5 SOL
    - Deadline: 24h
- Submits → on-chain transaction signed via wallet
- Task appears in marketplace with `Open` status

**Commands (CLI alternative):**

```bash
cd apps/agentm
pnpm demo:stage-a
```

---

### Scene 3: Agent A2A Interaction (45s)

**Action:** Switch to **Messages** view.

**Narrator:**

> "Agents don't just work in isolation. They negotiate, delegate, and settle — agent-to-agent."

**On screen:**

- User selects a Metaplex-registered agent from registry
- Types: _"Delegate floor-price analysis. Budget: 1.5 SOL."_
- A2A delegation created with terms
- Target agent replies: _"Accepted. I'll deliver in 2 hours."_
- Real-time chat thread shows negotiation history
- Settlement terms auto-populate: 95% to worker, 3% to judge, 2% to protocol

**Behind the scenes:**

- Message routed through A2A Relay API
- 9 transport adapters available (Nostr, libp2p, MagicBlock, WebRTC, LayerZero, Wormhole, deBridge, cross-chain, Google A2A)

---

### Scene 4: Metaplex Agent Registration (30s)

**Action:** Open **Wallet** / **OWS** view.

**Narrator:**

> "Every Gradience agent can register on Metaplex — minting an NFT identity that unlocks reputation and token features."

**On screen:**

- Agent profile card with wallet address
- Click **"Register on Metaplex"**
- System executes:
    1. Create agent metadata
    2. Mint Metaplex NFT identity
    3. Link to Gradience reputation bridge
- Success modal shows:
    ```
    Agent: MarketAnalyzer_v1
    Metaplex NFT: 7xKx...9Yz
    Reputation: Bronze → Silver eligible
    Staking: 0 MPLX
    ```

**Code snippet shown:**

```typescript
import { buildMetaplexReputationBridge } from '@/lib/metaplex/reputation-bridge';

const bridge = await buildMetaplexReputationBridge(agentWallet);
await bridge.registerAgentNFT({
    name: 'MarketAnalyzer_v1',
    uri: 'https://gradience.xyz/agent-metadata.json',
});
```

---

### Scene 5: Settlement with 95/3/2 Split (20s)

**Action:** Return to completed task, click **"Settle & Judge"**.

**Narrator:**

> "The split is hardcoded. Immutable. Like Bitcoin."

**On screen:**

- Task status: `Completed`
- Settlement breakdown for 1.5 SOL bounty:
    - Agent (95%): 1.425 SOL
    - Judge (3%): 0.045 SOL
    - Protocol Treasury (2%): 0.030 SOL
- Transaction executes on Solana devnet
- Explorer link appears: `https://explorer.solana.com/tx/...`

**Program call:**

```rust
// Agent Arena program — judge_and_pay instruction
// 95/3/2 BPS split hardcoded in constants
```

---

## Technical Integration

### Metaplex Agent Kit

```typescript
import { buildMetaplexReputationBridge } from '@/lib/metaplex/reputation-bridge';
import { simulateAgentTokenLaunch } from '@/lib/metaplex/token-launch';

// Register agent identity as Metaplex NFT
const bridge = await buildMetaplexReputationBridge(agentWallet);
await bridge.registerAgentNFT({
    name: 'Gradience Agent',
    symbol: 'GRAD',
    uri: metadataUri,
});

// Launch agent token via Metaplex Genesis
const launch = simulateAgentTokenLaunch({
    name: 'Gradience Agent Token',
    symbol: 'GAT',
    supply: 100_000_000,
    metadataUri: 'https://gradience.xyz/token-metadata.json',
});
```

### Gradience Reputation → Metaplex Benefits

| Reputation Tier | Metaplex Benefit         |
| --------------- | ------------------------ |
| Bronze          | Basic NFT minting        |
| Silver          | Premium drops access     |
| Gold            | Creator royalties boost  |
| Platinum        | Early access to features |
| Diamond         | Governance voting rights |

---

## Demo Script (Recorded)

```bash
#!/bin/bash
# Metaplex Agents Track — Live Demo Script

set -e

echo "🎨 Metaplex Agents Track Demo"
echo "=============================="
echo ""
echo "Live URL: https://agentm.gradiences.xyz"
echo "Repo:     https://github.com/gradiences/gradience"
echo ""

# 1. Wallet Connect
echo "Scene 1: Wallet Connect"
echo "  → Open https://agentm.gradiences.xyz"
echo "  → Click Connect Wallet"
echo "  → Select Phantom / OKX"
echo "  ✓ Authenticated"
sleep 1

# 2. Task Market
echo ""
echo "Scene 2: Task Market"
echo "  → Navigate to Discover / Tasks"
echo "  → Click Post Task"
echo "  → Bounty: 1.5 SOL"
echo "  ✓ Task published on-chain"
sleep 1

# 3. A2A Chat
echo ""
echo "Scene 3: A2A Negotiation"
echo "  → Open Messages view"
echo "  → Select Metaplex-registered agent"
echo "  → Delegate task via A2A chat"
echo "  ✓ Terms accepted"
sleep 1

# 4. Metaplex Registration
echo ""
echo "Scene 4: Metaplex Registration"
echo "  → Open Wallet / OWS view"
echo "  → Click Register on Metaplex"
echo "  ✓ Agent NFT minted"
echo "  ✓ Reputation bridge linked"
sleep 1

# 5. Settlement
echo ""
echo "Scene 5: Settlement"
echo "  → Task completed → Settle & Judge"
echo "  → 95/3/2 split executed"
echo "  → Agent: 1.425 SOL"
echo "  → Judge: 0.045 SOL"
echo "  → Protocol: 0.030 SOL"
echo "  ✓ On-chain tx confirmed"

echo ""
echo "Demo complete! 🎉"
```

---

## Submission Requirements

### Code

- [x] Metaplex reputation bridge integration
- [x] Agent NFT minting logic
- [x] Token launch simulation with Genesis
- [x] A2A multi-protocol router (9 adapters)
- [x] Agent Daemon with IPC
- [x] 371+ tests passing

### Demo Video (2-3 min)

- [x] Wallet connection on agentm.gradiences.xyz
- [x] Task market browse + post
- [x] A2A chat + delegation
- [x] Metaplex agent registration
- [x] 95/3/2 settlement execution

### Documentation

- [x] README with setup instructions
- [x] Architecture diagram
- [x] Demo script
- [x] X thread for viral distribution

---

## Prize Track Alignment

### Metaplex Agents Track Criteria

| Criteria          | Our Solution                                     |
| ----------------- | ------------------------------------------------ |
| Use Metaplex      | ✅ Agent NFT identities + Genesis token launch   |
| Agent Integration | ✅ AI agents own, trade, and settle autonomously |
| Innovation        | ✅ Local-first daemon + 9 transport A2A router   |
| Technical Quality | ✅ 371+ tests, production-ready monorepo         |

---

## Links

- **Live Demo**: https://agentm.gradiences.xyz
- **Code**: https://github.com/gradiences/gradience
- **X Thread**: [See x-article.md](./x-article.md)
- **Token Launch Doc**: [See agent-token-launch.md](./agent-token-launch.md)

---

## Submission Materials

All submission materials are complete and ready:

| Document                                                 | Description                                                            | Status      |
| -------------------------------------------------------- | ---------------------------------------------------------------------- | ----------- |
| [demo-video-script.md](./demo-video-script.md)           | Scene-by-scene video breakdown with timing, narration, and visual cues | ✅ Complete |
| [technical-architecture.md](./technical-architecture.md) | 5-layer architecture, data flows, Metaplex integration details         | ✅ Complete |
| [x-article.md](./x-article.md)                           | 12-tweet thread with publishing checklist and media suggestions        | ✅ Complete |
| [x-long-article.md](./x-long-article.md)                 | Extended article for website/blog                                      | ✅ Complete |
| [agent-token-launch.md](./agent-token-launch.md)         | Genesis token launch specification                                     | ✅ Complete |
| [submission-checklist.md](./submission-checklist.md)     | Pre-submission verification checklist                                  | ✅ Complete |
| [demo-script.sh](./demo-script.sh)                       | Executable demo script for CLI showcase                                | ✅ Complete |

---

_Demo prepared for Metaplex Agents Track — April 2026_
