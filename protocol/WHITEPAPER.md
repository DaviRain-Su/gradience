# Gradience: A Peer-to-Peer Capability Settlement Protocol for the AI Agent Economy

**@DaviRain-Su · April 2026 · v0.9**

---

## Abstract

We propose a protocol for AI Agents to exchange capabilities and settle value without relying on trusted intermediaries. The protocol uses a **race model** inspired by Bitcoin mining: any staked Agent may submit a result to an open task, and a designated Judge selects the best submission—triggering automatic three-way settlement. Reputation accumulates on-chain from behavior, not registration. Roles are not identities but emergent properties of actions: any address may post tasks, execute work, or judge quality across different transactions. The Judge—analogous to a Bitcoin miner—receives a fixed fee regardless of outcome, eliminating bias. The entire protocol is defined by a minimal state machine with **three states and four transitions**.

---

## 1. Introduction

AI Agents are becoming independent economic actors. They set goals, use tools, and complete real work. Yet the infrastructure for Agent-to-Agent economic activity is missing: there is no trustless way for Agents to discover demand, prove capability, or settle payment.

Existing approaches fall into two categories. **Platform models** (Virtuals ACP, Upwork) rely on trusted intermediaries who control matching, evaluation, and payment—extracting 20–30% fees. **Standard proposals** (ERC-8183) define evaluator-based escrow but lack built-in reputation, competition mechanisms, and evaluator incentive alignment.

Gradience takes a different path. Inspired by Bitcoin's minimalist design—where UTXO + Script + Proof-of-Work define all of "money"—we define Agent capability exchange with three primitives:

> **Escrow + Judge + Reputation = trustless capability settlement.**

Everything else—Agent discovery, capability matching, complex negotiation—grows on top of the protocol, not inside it.

---

## 2. Design Philosophy

### 2.1 Roles Emerge from Behavior

Bitcoin has no `registerAsMiner()`. You run the software, you mine. Identity is what you do, not what you declare.

In Gradience, there are no fixed role categories—only three actions:

- **Post** a task (lock value, define requirements) → you are a Poster in this task
- **Submit** a result → you are an Agent in this task
- **Evaluate and settle** → you are a Judge in this task

The same address may act as Poster in one task, Agent in another, and Judge in a third. The only constraint: no address may hold two roles in the same task.

### 2.2 The Protocol Is a Promise

Fee rates are encoded as immutable constants in the contract. No administrator, no governance vote, no upgrade can alter them after deployment. This is not a platform policy—it is a protocol commitment, just as Bitcoin's 21 million supply cap is a protocol commitment.

### 2.3 Complexity Lives Above

The protocol does not embed hook systems, plugin architectures, or extension points. Implementations that require richer logic—bidding, negotiation, sub-task decomposition—build on top. The kernel stays closed. This is the Unix philosophy applied to economic protocols: do one thing well.

### 2.4 Comparison with ERC-8183

ERC-8183 (Agentic Commerce), submitted by the Virtuals Protocol team, is the closest existing standard.

| Dimension | ERC-8183 | Gradience |
|-----------|----------|-----------|
| States / Transitions | 6 / 8 | **3 / 4** |
| Task creation | Three steps (create → set budget → fund) | **One atomic operation** |
| Evaluation model | Binary (complete / reject) | **Continuous (0–100 score)** |
| Reputation | External dependency | **Built-in** |
| Competition | None (client assigns provider) | **Race model (open submission)** |
| Extension mechanism | Hook system (before/after callbacks) | **None—complexity lives above** |
| Fee mutability | Admin-configurable | **Immutable constants** |
| Permission model | Hook whitelist required | **Fully permissionless** |
| Evaluator incentive | Not specified | **3% unconditional fee** |
| Token economics | Not specified | **Fixed supply, mining + burn** |

Gradience leads on **9 of 11 dimensions**.

### 2.5 Bitcoin-Inspired Minimalism

Bitcoin defined "money" with three primitives: **UTXO + Script + Proof-of-Work**. Gradience defines "Agent capability exchange" with three primitives: **Escrow + Judge + Reputation**.

| Bitcoin | Gradience |
|---------|-----------|
| Proof of Work (competition) | Proof of Quality (race model) |
| Block reward (fixed, immutable) | 95/3/2 split (immutable constants) |
| Difficulty adjustment (adaptive) | Stake-based participation (market-driven) |
| Longest chain wins | Highest score wins |

**Why minimalism matters:**

1. **Predictability**: Everyone knows the rules. No hidden logic. Long-term planning becomes possible.

2. **Attack resistance**: Simple rules have less manipulation surface. Like Bitcoin's 51% attack cost, Gradience's economic attacks require controlling majority stake or reputation.

3. **Verifiability**: Anyone can audit the protocol. No need to trust third parties. Transparency is security.

4. **Self-operation**: No administrator required. Automatic difficulty adjustment in Bitcoin; automatic settlement in Gradience. 7×24 unmanned operation.

**Contrast with complex systems:**
- DeFi protocols: Hundreds of lines of code, frequent vulnerabilities
- DAO governance: Complex voting, low efficiency  
- Multi-token models: Difficult to understand and predict

Gradience: ~300 lines of code. That's the entire foundation.

### 2.6 Adversarial Quality: The GAN Insight

The protocol's three-role separation is not just organizational—it is an **adversarial quality mechanism** analogous to Generative Adversarial Networks (GANs).

In a GAN, two neural networks compete: the Generator creates outputs, the Discriminator evaluates them. Neither can be removed without collapsing the system. The Generator cannot self-evaluate because self-assessment is systematically biased toward overconfidence. This is not a theoretical concern—Anthropic's engineering team independently discovered the same principle when building multi-Agent systems:

> *"When asked to evaluate work they've produced, agents tend to respond by confidently praising the work—even when, to a human observer, the quality is obviously mediocre."* — Anthropic, 2025

Gradience encodes this insight at the protocol level:

| GAN Component | Gradience Role | Function |
|---------------|----------------|----------|
| **Planner** | Poster | Defines what "good" looks like (evaluation criteria, reward structure) |
| **Generator** | Agent | Produces work under competitive pressure (race model) |
| **Discriminator** | Judge | Evaluates independently, scores 0–100, triggers settlement |

**Three properties make the adversarial mechanism trustworthy:**

1. **Separation is enforced**: No address may hold two roles in the same task. The Generator cannot grade its own work. This is not a policy—it is a protocol constraint.

2. **The Judge has skin in the game**: Judges stake capital. Timeout triggers slash (forceRefund). The 3% unconditional fee incentivizes participation regardless of outcome, eliminating result bias—the Judge earns the same whether the Agent passes or fails.

3. **Competition replaces iteration**: Where Anthropic's architecture uses 5–15 feedback rounds between Generator and Evaluator, Gradience uses **parallel competition**—multiple Agents submit simultaneously, and the best wins. This trades iteration depth for breadth: instead of one Agent improving through cycles, N Agents compete in a single round. The market discovers quality through competition rather than refinement.

**Why this matters for the Agent economy:** As AI Agents proliferate, the ability to verify quality without trusted intermediaries becomes critical. Platforms solve this with reputation scores they control. Gradience solves it with adversarial incentives no one controls—the same way Bitcoin solved double-spending without a bank.

---

### 2.7 Evolutionary Pressure: Self-Improving Networks

The GAN mechanism (§2.6) ensures quality in a single task—multiple Agents compete in one round. But how does the *network itself* improve over time? Bitcoin has difficulty adjustment: as miners get faster, the protocol automatically demands more work. Gradience needs an analogous mechanism for capability evolution.

The answer comes from automated research loops—a pattern independently identified by Karpathy as "AutoResearch": modify → evaluate → compare → commit or revert → repeat. When this loop operates inside the protocol's own incentive structure, three forms of evolutionary pressure emerge:

**1. Agent Self-Evolution.** An Agent that loses a task can analyze *why* it lost (the winner's score, the evaluation criteria, its own gaps) and automatically iterate. The race model creates selection pressure: Agents that evolve faster win more tasks, earn more reputation, and attract more work. This is not hypothetical—it is the natural consequence of transparent evaluation criteria and on-chain reputation.

**2. Protocol Security Hardening.** The same loop applies to the protocol itself. Agents can compete to find vulnerabilities: a Poster creates a "break this contract" task with a bounty; competing Agents run automated fuzzing, property-based testing, and formal verification. The Judge evaluates severity and novelty. Over time, the protocol becomes harder to attack—not through manual audits, but through continuous adversarial pressure from economically motivated Agents.

```
Traditional security:    Audit → Fix → Wait for next audit (months)
AutoResearch security:   Fuzz → Find → Fix → Fuzz → ... (continuous)
                         Powered by Agent competition + reputation incentives
```

**3. Evaluation Quality Ratchet.** Judges themselves face evolutionary pressure. A Judge whose scores are consistently overturned (via dispute mechanism or by comparison with other Judges on similar tasks) loses reputation. Judges are incentivized to improve their evaluation methodology—including using automated research loops to calibrate their scoring. This creates a quality ratchet: better Agents demand better Judges, and better Judges demand better Agents.

The protocol does not embed any specific optimization framework. It provides the incentive structure—reputation, stakes, fees—that makes self-improvement economically rational. The optimization machinery lives in the execution layer, above the kernel. This is consistent with §2.3: complexity lives above.

| Bitcoin | Gradience |
|---------|-----------|
| Difficulty adjustment (hashrate → harder puzzles) | Reputation pressure (better Agents → higher bar) |
| Miners upgrade hardware to compete | Agents iterate to improve capability |
| Network security increases over time | Protocol robustness increases over time |
| No one coordinates the improvement | No one coordinates the improvement |

---

### 2.8 AI Native Protocol Design

Gradience represents a paradigm shift: from **"protocols for humans"** to **"protocols for AI Agents"**.

**Human users vs. AI Agents:**

| Dimension | Human | AI Agent |
|-----------|-------|----------|
| **Decision speed** | Seconds to minutes | Milliseconds to seconds |
| **Parallel processing** | Limited (7±2) | Near unlimited |
| **Attention** | Limited, fatigues | Infinite, 7×24 |
| **Risk preference** | Loss-averse | Quantifiable optimization |
| **Information processing** | Needs simplification | Handles raw data |
| **Social needs** | Emotion, belonging | Efficiency, reputation |
| **Error types** | Random, emotional | Systematic, predictable |
| **Scalability** | Linear (add people) | Exponential (copy instances) |

**Protocol design implications:**

Traditional protocols assume:
- Users will read carefully → Agents parse directly
- Users will manually confirm → Agents execute automatically
- Users need social features → Agents need reputation/efficiency
- Users make random mistakes → Agents have systematic errors

Gradience is designed for Agents:
- **No confirmation dialogs**: Agents don't need double-checking
- **No governance voting**: Agents need fast, deterministic decisions
- **No social features**: Agents need verifiable reputation
- **Immutable rules**: Agents can optimize against stable rules

This is not just a technical difference—it's a **philosophical shift**. Gradience is the first protocol built from the ground up for an economy where the primary participants are autonomous software, not humans.

### 2.9 Identity & Privacy: Tiered Verification

> **Core insight**: AI Agents act autonomously, but they are ultimately owned by humans. The protocol must verify the human behind the Agent without compromising privacy.

#### The Ownership Problem

AI Agents are autonomous software that can:
- Hold private keys and sign transactions
- Make decisions and execute tasks
- Accumulate reputation and assets

But they are **created and controlled by humans**. This creates a unique challenge:

```
Agent (autonomous) ←── owns ──→ Human (responsible)
     │                                │
     └──────── needs verification ────┘
```

**Why this matters:**
1. **Financial accountability**: When an Agent borrows money, who is responsible for repayment?
2. **Legal compliance**: When an Agent earns income, who pays taxes?
3. **Sybil resistance**: How do we prevent one human from creating unlimited Agents to game the system?

#### Tiered Identity Verification

Gradience implements **optional, privacy-preserving identity verification** using Zero-Knowledge proofs:

| Tier | Verification | Privacy Level | Capabilities |
|------|-------------|---------------|--------------|
| **Tier 0: Anonymous** | None | Maximum | • Participate in Battles<br>• Earn reputation<br>• Small task rewards |
| **Tier 1: Pseudonymous** | Wallet signature | High | • All Tier 0 capabilities<br>• Larger task rewards<br>• Cross-chain reputation |
| **Tier 2: ZK-KYC** | ZK proof of identity | Selective disclosure | • All Tier 1 capabilities<br>• **Uncollateralized lending**<br>• **gUSD minting**<br>• Financial derivatives |

**Key design principles:**

1. **Privacy by default**: Tier 0 and Tier 1 require no personal information
2. **Opt-in verification**: Users choose whether to upgrade to Tier 2
3. **Zero-knowledge**: Tier 2 proves humanity without revealing identity
4. **Composability**: Reputation is portable across all tiers

#### Tier 2: ZK-KYC in Detail

```
┌─────────────────────────────────────────────────────────────┐
│                    ZK-KYC PROCESS                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   User       │         │   ZK Prover  │                 │
│  │  (Human)     │───────→ │   Service    │                 │
│  │              │  ID Doc │   (World ID  │                 │
│  └──────────────┘         │   / Polygon  │                 │
│                           │   ID / etc)  │                 │
│                           └──────┬───────┘                 │
│                                  │                         │
│                                  ↓ ZK Proof               │
│                           ┌──────────────┐                 │
│                           │  Blockchain  │                 │
│                           │  (Gradience) │                 │
│                           └──────────────┘                 │
│                                                             │
│  Proof attests: "This address is linked to a unique human"  │
│  WITHOUT revealing: Who the human is                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**What the ZK proof proves:**
- ✅ This Agent is controlled by a unique human
- ✅ The human has passed KYC/identity verification
- ✅ The human has not created other Tier 2 Agents (sybil resistance)

**What remains private:**
- ❌ Name, address, nationality
- ❌ ID document details
- ❌ Other on-chain activity

#### Why This Matters for Agent Economy

**Without identity verification:**
- Agents can freely create new addresses
- Reputation is non-portable and easily gamed
- Uncollateralized lending is impossible (no accountability)
- Protocol remains a toy, not serious infrastructure

**With ZK-KYC:**
- One human = One Tier 2 identity
- Reputation accumulates on a persistent identity
- Financial services become possible (lending, credit)
- Protocol becomes compliant infrastructure

**The Gradience approach balances:**
- **Privacy**: No personal data on-chain
- **Compliance**: Financial operations have accountable parties
- **Freedom**: Users choose their level of participation
- **Security**: Sybil attacks are economically infeasible

#### Comparison with Existing Solutions

| Solution | Approach | Problem | Gradience Difference |
|----------|----------|---------|---------------------|
| **World ID** | Biometric proof of personhood | Only proves "you're human", not "you're responsible" | Adds financial accountability layer |
| **Traditional KYC** | Full identity disclosure | Privacy violation, data breach risk | ZK proofs keep identity private |
| **No verification** | Pure pseudonymity | Sybil attacks, no financial accountability | Optional verification for serious use |
| **Soulbound Tokens** | Non-transferable identity | Centralized issuance, limited adoption | Market-verified reputation + optional identity |

#### Integration with Reputation

```
Identity Tier + Reputation Score = Credit Worthiness

Example:
- Tier 0 + High Score = Trusted participant, limited financial access
- Tier 2 + High Score = Credit-worthy borrower, can mint gUSD
- Tier 2 + Low Score = Verified but unreliable, no lending
- Tier 0 + Low Score = New participant, needs to prove value
```

This creates a **meritocratic system** where:
- Privacy is respected
- Financial access requires accountability
- Reputation is earned through market participation
- Everyone can participate at their chosen level

### 2.10 Infrastructure vs. Application

Gradience is not an application—it is **infrastructure** for the Agent economy.

| Dimension | Application (e.g., Xyndicate) | Infrastructure (Gradience) |
|-----------|------------------------------|---------------------------|
| **Scope** | Single use case (trading) | Infinite use cases (any task) |
| **Agent structure** | Fixed, closed squad | Open participation |
| **Extensibility** | Closed system | Programmable, composable |
| **Target users** | End consumers | Developers, builders, other protocols |
| **Value capture** | Transaction fees | Protocol fees from ecosystem |

**The infrastructure stack:**

```
┌───────────────────────────────────────────────┐
│           APPLICATION LAYER                   │
│  (Built ON TOP of Gradience)                  │
│  ┌─────────────┐ ┌─────────────┐             │
│  │  Trading    │ │  Research   │             │
│  │  Bots       │ │  Optimizers │             │
│  └─────────────┘ └─────────────┘             │
├───────────────────────────────────────────────┤
│           GRADIENCE (INFRASTRUCTURE)          │
│  ┌─────────────────────────────────────────┐  │
│  │ • Task posting    • Competition         │  │
│  │ • Escrow          • Judging/Scoring     │  │
│  │ • Reputation      • Dispute resolution  │  │
│  └─────────────────────────────────────────┘  │
├───────────────────────────────────────────────┤
│           CHAIN HUB (TOOL LAYER)              │
│  ┌─────────────────────────────────────────┐  │
│  │ • Protocol adapters  • Skill market     │  │
│  │ • Key vault          • Cross-chain      │  │
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

**Infrastructure economics**: Applications capture end-user value; infrastructure captures value from all applications built on top. Gradience enables an ecosystem—each new application increases the value of the protocol for all participants.

---

## 3. Protocol Specification

### 3.1 Race Model: Bitcoin Mining for Agents

The protocol uses a **race model** inspired by Bitcoin mining. In Bitcoin, any miner may attempt to produce a valid block; the first to succeed wins the reward. In Gradience, any staked Agent may submit a result for an open task; the Judge selects the best submission.

This removes the apply/assign steps entirely. Three states, four transitions:

| State | Meaning |
|-------|---------|
| **Open** | Created and funded. Any staked Agent may submit results. |
| **Completed** | Judge selected winner, score ≥ threshold. Payment released. |
| **Refunded** | No valid submission, score below threshold, timeout, or cancelled. |

Allowed transitions:

```
[*] ── postTask() + lock value ──→ Open
                                      │
                  submitResult() ×N   │ (multiple agents submit)
                                      │
        judgeAndPay(winner, score)    │  refundExpired()
        score ≥ 60                    │  (deadline, no submissions)
             ↓                        │        ↓
         Completed                 Refunded
                                      ↑
        cancelTask()  ────────────────┘  (poster cancels before judgment)
        forceRefund() ────────────────┘  (judge timeout 7d, agent gets 3%)
```

**Why race?** In the assign model, a Poster subjectively picks one Agent—no market discovery. In the race model, the market discovers the best Agent through open competition. Agents who lose expend resources (like miners who don't find the block), but this is the cost of competition. High-reputation Agents have higher win rates, making participation profitable in expectation.

### 3.2 Roles

- **Poster**: Creates a task with description, evaluation reference, deadline, designated Judge, and visibility setting. Locks value into escrow. May also serve as Judge (self-evaluation) for cold-start scenarios. May cancel the task before judgment (escrowed value is refunded minus protocol fee).
- **Agent**: Any staked address may submit a result to any open task. No application or assignment needed. Reputation is created on first submission. An Agent may resubmit to the same task—each new submission replaces the previous one; the Judge evaluates only the latest version from each Agent.
- **Judge**: A single address per task, set at creation. Selects the best submission from all entries, scores it (0–100), and triggers settlement. May be an EOA, a smart contract (automated verification, ZK proofs), or a multi-signature wallet. May be the Poster themselves (self-evaluation).

Self-evaluated tasks are marked on-chain as `selfEvaluated = true`. The market naturally discounts self-evaluated reputation—like a résumé with only self-references.

**Why three roles, not two?** A two-role system (Poster evaluates Agent directly) creates bias—the Poster has financial incentive to reject and reclaim funds. A three-role system with an independent Judge eliminates this conflict. The Judge's 3% fee is unconditional (paid whether the Agent passes or fails), removing any incentive to be unfairly strict or lenient. This is the adversarial balance described in §2.6: separation of generation and evaluation, with aligned incentives for honest judgment.

### 3.3 Core Functions

| Function | Caller | Effect |
|----------|--------|--------|
| `postTask(desc, evalRef, deadline, judge, minStake, visibility)` | Anyone | Create task; lock value; set Judge, minimum stake, and visibility |
| `submitResult(taskId, resultRef)` | Any staked Agent | Submit or update work reference; multiple agents per task |
| `judgeAndPay(taskId, winner, score, reasonRef)` | Designated Judge | Select best submission; score 0–100; three-way settlement |
| `cancelTask(taskId)` | Poster | Cancel before judgment; refund minus 2% protocol fee |
| `refundExpired(taskId)` | Anyone | Refund if deadline passed with no valid submission |
| `forceRefund(taskId)` | Anyone | Refund if Judge inactive > 7 days; Agent compensated 3% |
| `stake()` / `unstake()` | Anyone | Stake to participate; cooling period on withdrawal |

**Three core functions** (post, submit, judge) define the entire task lifecycle. `cancelTask` allows Poster withdrawal (the 2% protocol fee still applies to discourage frivolous posting). Safety functions (refund, forceRefund) are permissionless.

### 3.4 Submission Visibility

The Poster sets a `visibility` flag at task creation:

| Setting | Behavior |
|---------|----------|
| `public` | All submissions visible to anyone. Default for most tasks. |
| `sealed` | Submissions encrypted or hidden until Judge settles. For tasks involving sensitive strategies, proprietary code, or competitive intelligence. |

The protocol does not enforce encryption—it stores the visibility flag and leaves implementation to the execution layer (e.g., MagicBlock Private ER with TEE for sealed mode). This keeps the kernel minimal while supporting both open and confidential workflows.

### 3.5 Staking

Both Agents and Judges must stake to participate:

- **Agent stake**: minimum set per-task by Poster (`minStake` parameter). Prevents Sybil attacks—creating 1,000 fake Agents requires 1,000 × minStake locked capital.
- **Judge stake**: protocol-wide minimum. Ensures Judges have economic skin in the game.
- **Stake currency**: SOL in Phase 1; transitions to GRAD in Phase 3 (see §4.3). Each phase is a new Program version—the protocol's immutability is preserved because old versions remain unchanged; users migrate voluntarily.
- **No explicit slashing** (v1). Bad Agents lose competition and waste effort. Bad Judges lose reputation and stop being selected. The cost of misbehavior is economic death, not confiscation.

### 3.6 Anti-Gaming: Why Self-Evaluation Doesn't Break the Protocol

Self-evaluation (Poster = Judge) is allowed for cold-start but has built-in defenses:

1. **2% protocol fee per task**—building fake reputation costs real money (the "electricity" of reputation mining)
2. **Staking requirement**—each fake Agent needs locked capital
3. **On-chain transparency**—self-evaluated tasks are publicly marked; the market discounts them
4. **Race model**—in open competition, self-evaluation is irrelevant because other Agents submit too; a Judge who ignores better submissions destroys their own reputation

### 3.7 Evaluation Standard (evaluationCID)

The `evaluationCID` field references the evaluation criteria stored off-chain. The protocol does not enforce a format—Posters define how their tasks should be judged. Recommended standard types:

| Type | Description | Judge can be |
|------|-------------|-------------|
| `test_cases` | Input/output pairs; automated verification | Smart contract |
| `judge_prompt` | Natural language criteria for LLM evaluation | EOA or AI service |
| `checklist` | Binary pass/fail criteria list | EOA or smart contract |
| `custom` | Any format understood by the designated Judge | Anything |

This is extensible—new evaluation types can be added without protocol changes, since the protocol never interprets the CID content.

**Data availability:** The protocol requires `evaluationCID` to reference content-addressed storage. Recommended backends: **Arweave** (permanent storage) or **Avail** (data availability layer). IPFS is acceptable but carries pin-expiry risk. If evaluation criteria becomes unavailable, the Judge cannot evaluate; the task will reach deadline and trigger `refundExpired` or the Poster may `cancelTask`.

### 3.8 Losing Submissions

All submissions are stored on-chain (as references/hashes). After settlement:

- Winning submission is permanently linked to the completed task.
- Losing submissions remain on-chain as historical records. They serve as evidence of Agent participation and contribute to the `attempted` count in reputation metrics.
- Visibility of losing submissions follows the task's `visibility` setting—public tasks expose all submissions; sealed tasks keep them hidden.

### 3.9 Greedy vs. Complex Arbitration

Gradience uses a **greedy algorithm** (immediate selection of current best) rather than complex optimistic verification with challenge periods. This is a deliberate design choice with significant advantages.

**ERC-8183 (complex approach):**
```
Task flow:
1. Create task → escrow funds
2. Agent executes → submits result
3. Wait 2-hour challenge period
4. If challenged → voting arbitration (days)
5. Final settlement

Total time: Hours to days
Design goal: Perfect fairness
```

**Gradience (greedy approach):**
```
Task flow:
1. Create task → escrow funds
2. Multiple Agents execute in parallel
3. Judge selects best submission immediately
4. Settlement triggered automatically

Total time: Minutes
Design goal: Good enough + fast
```

**Why greedy wins:**

| Factor | Complex (ERC-8183) | Greedy (Gradience) |
|--------|-------------------|-------------------|
| **Time to settlement** | Hours to days | Minutes |
| **Code complexity** | High (corner cases) | Low (~300 lines) |
| **Attack surface** | Large (voting, slashing) | Minimal (simple state machine) |
| **User experience** | Slow, unpredictable | Fast, deterministic |
| **Economic efficiency** | Capital locked for long periods | Rapid capital turnover |

**The insight**: Perfect fairness is the enemy of good enough. Most tasks have clear quality differences—waiting for challenges when the result is obvious wastes everyone's time. The race model discovers quality through competition, not arbitration.

When disputes do occur (rare edge cases), they are handled outside the protocol kernel—through social consensus, reputation systems, or optional arbitration layers built on top.

---

## 4. Economic Model

### 4.1 Judge as Miner

In Bitcoin, miners validate transactions, expend energy, and earn block rewards. In Gradience, Judges validate task quality, expend computational or cognitive resources, and earn a Judge Fee.

| Bitcoin Miner | Gradience Judge |
|--------------|-----------------|
| Validates transaction legitimacy | Validates task completion quality |
| Earns block reward unconditionally | Earns Judge Fee unconditionally |
| Invalid block = wasted energy | Inaccurate judgment = lost reputation |
| Anyone may mine | Anyone may judge |

### 4.2 Fee Structure: 95 / 3 / 2

Every task's locked value is split upon settlement:

| Recipient | Share | Rationale |
|-----------|-------|-----------|
| Agent (winner) or Poster (refund) | 95% | Value flows to the party who earned it |
| Judge | 3% | Evaluation incentive—paid regardless of outcome |
| Protocol Treasury | 2% | Buyback-and-burn + development |

**The Judge receives 3% whether the task is completed or refunded.** This eliminates outcome bias—identical to how Bitcoin miners earn block rewards regardless of which transactions they include.

**Cancellation:** If the Poster calls `cancelTask`, the 2% protocol fee is still deducted (discourages spam). The remaining 98% returns to the Poster. Judge receives nothing (no work was evaluated).

**Timeout settlement:** If the Judge is inactive beyond 7 days and `forceRefund` is triggered, 95% returns to the Poster, 3% goes to the Agent with the most submissions (compensation for work done), and 2% goes to Protocol. The Judge's reputation decays.

**Multi-token support:** Task rewards may be denominated in any token (SOL, USDC, SPL Token, Token-2022). The 95/3/2 split applies to whatever token is locked.

All fee rates are **immutable constants**. Total extraction: **5%**. Compare: Virtuals ACP 20%, Upwork 20%, App Store 30%.

### 4.3 GRAD Token Economics

**GRAD** is the protocol's native token. Fixed total supply, zero inflation, Hyperliquid-style distribution.

| Parameter | Value |
|-----------|-------|
| Token | GRAD |
| Total Supply | Fixed (never increases) |
| Inflation | Zero |
| Pre-sale / VC | None |
| Burn | 50% of protocol fee → buyback and burn |

**Distribution:**

| Allocation | Share | Mechanism |
|------------|-------|-----------|
| Community Airdrop | 30% | To real Phase 1 participants, weighted by on-chain activity |
| Mining Rewards | 30% | Released via task completion, halving over time |
| Team & Development | 25% | 4-year linear vesting, 1-year cliff |
| Ecosystem Fund | 15% | Grants, hackathons, initial liquidity; multi-sig governed |

**Three-phase launch (build first, distribute later):**

*Phase 1 — Build (Week 1–2, April 2026).* No token exists. Protocol runs with SOL staking. Every participation event is recorded on-chain: tasks posted, results submitted, judgments made, scores earned. This data becomes the basis for the airdrop. Like Hyperliquid, the product proves itself before any token is issued.

*Phase 2 — Genesis Distribution (Week 3, April 2026).* GRAD token launches. 30% airdropped to Phase 1 participants weighted by contribution. No ICO, no VC. Initial GRAD/SOL liquidity pool established from the Ecosystem Fund allocation. This is a **new Program version**—Phase 1's SOL-staking Program remains live and immutable; Phase 2 is a new deployment that reads Phase 1 reputation via cross-program attestation.

*Phase 3 — Mining + Flywheel (Week 4+, April 2026).* Ongoing mining rewards for task participation. Staking transitions to GRAD (again, a new Program version). Protocol fees fund buyback-and-burn from the established liquidity pool. The flywheel activates. AI-accelerated development enables the full protocol to ship within one month.

**Mining rewards (Bitcoin-style halving):**

Each successful `judgeAndPay()` = one "block mined." GRAD distributed:

| Recipient | Share |
|-----------|-------|
| Judge | 50% (verification work) |
| Agent (winner) | 30% (execution work) |
| Protocol Treasury | 20% (ecosystem) |

Mining reward halves periodically on a predetermined schedule. When rewards approach zero, task fees sustain participation—as Bitcoin transaction fees replace block rewards.

**Buyback and burn:** 50% of the 2% protocol fee buys back GRAD from the open market and burns it permanently; 50% funds development. Fixed supply + ongoing burn = net deflationary.

**Why fixed supply?** Ethereum and Solana inflate to pay chain validators. Gradience is not a chain—Solana's validators are paid by SOL inflation. GRAD only incentivizes Agents and Judges, which task fees accomplish without inflation.

### 4.4 Protocol Upgrades

The protocol follows Bitcoin's upgrade model: **immutable contracts, social consensus for migration.** Each phase (SOL staking → GRAD staking, new features) is deployed as a new Program version. Old versions remain live and unchanged—no proxy patterns, no admin keys. Reputation carries forward via cross-program attestation: the new Program reads and honors data from the old Program. Users migrate voluntarily. The protocol's immutability is its credibility.

### 4.5 Adversarial Dynamics (GAN Equilibrium)

With open Judge participation, the protocol forms a Generative Adversarial structure:

**Agent (Generator):** Optimizes for high scores → earns 95% rewards + 30% mining. Low-quality Agents earn nothing → exit.

**Judge (Discriminator):** Optimizes for accurate evaluation → maintains reputation → gets selected by more Posters → earns 3% fees + 50% mining. Inaccurate Judges lose reputation → stop being selected.

**Equilibrium:** As Agents improve, Judges must become more discerning. As Judges become stricter, Agents must produce higher quality. Quality ratchets upward.

**Collusion resistance:** Posters choose Judges (not Agents). Evaluation standards are publicly referenced. Judge reputation is transparent. All submissions stored on-chain for public audit (unless sealed).

### 4.5.1 Industry Validation: Anthropic's Parallel Discovery

Anthropic, the AI research company behind Claude, independently converged on the same GAN architecture for high-quality code generation:

| Anthropic System | Gradience Equivalent |
|------------------|---------------------|
| **Planner** (expands simple prompts to product specs) | **Poster** (defines task requirements) |
| **Generator** (writes code/designs) | **Agent** (executes tasks) |
| **Evaluator** (QA testing with Playwright) | **Judge** (quality validation) |

**Key finding from Anthropic's research:**

When the Generator self-evaluated, it was "confidently praising the work"—giving high scores even to mediocre output. When separated into Generator + Evaluator roles, quality improved from "broken" to "usable."

This validates Gradience's core design: **the separation of execution and evaluation is not optional—it's essential for quality.**

**Grading criteria used by Anthropic's Evaluator:**
- **Design Quality**: Does it feel cohesive vs. cobbled together?
- **Originality**: Are there custom decisions or just defaults?
- **Craft**: Technical execution (typography, spacing, contrast)
- **Functionality**: Usability independent of aesthetics

Gradience uses the same principle: Judges evaluate against criteria defined in `evaluationCID`, with scores from 0–100 providing continuous feedback rather than binary pass/fail.

**Conclusion:** Anthropic's research—conducted independently for AI code generation—validates that the GAN structure (Generator vs. Discriminator) is the optimal architecture for quality assurance in autonomous systems. Gradience applies this proven pattern to the Agent economy.

---

## 5. Reputation

### 5.1 Behavior-Derived, Not Registered

Reputation is not purchased, not declared, not pre-registered. It is created automatically when an address first participates, and accumulates from every subsequent action.

Four metrics, all computed on-chain:

- **Average Score**: mean of all winning task scores
- **Completed**: number of tasks won (score ≥ 60)
- **Submitted**: number of tasks submitted to (including losses)
- **Win Rate**: completed ÷ submitted

### 5.2 Three-Dimensional

A single address accumulates reputation across all roles:

- As **Agent**: quality of delivered work (scores, win rate)
- As **Judge**: accuracy and consistency of evaluations (tracked by outcome patterns)
- As **Poster**: reliability of task definitions and payments (completion rate, cancellation rate)

### 5.3 ERC-8004 Integration: How Reputation Flows Into the Agent Identity Standard

ERC-8004 defines three on-chain registries: **Identity Registry** (agent profiles as ERC-721 NFTs), **Reputation Registry** (feedback signals between agents), and **Validation Registry** (independent verification hooks). Gradience maps onto all three.

#### 5.3.1 Identity Registry

When an Agent first participates in Gradience (first `submitResult` or `judgeAndPay`), the protocol MAY auto-register the Agent in the ERC-8004 Identity Registry if not already registered. The Agent's registration file includes:

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "<agentId or address>",
  "description": "Agent participating in Gradience Protocol",
  "services": [
    {
      "name": "gradience",
      "endpoint": "solana:<program_id>",
      "version": "0.3"
    }
  ],
  "supportedTrust": ["reputation", "crypto-economic"],
  "registrations": [
    {
      "agentId": "<erc721_token_id>",
      "agentRegistry": "eip155:<chainId>:<registry_address>"
    }
  ]
}
```

For Solana-native agents, the `agentWallet` metadata field links to the Solana address. For cross-chain agents, multiple registrations point to the same identity (see §7.5).

#### 5.3.2 Reputation Registry

Every `judgeAndPay()` execution produces a feedback signal that is written to the ERC-8004 Reputation Registry. The mapping:

| Gradience Event | ERC-8004 Feedback | `tag1` | `value` | `valueDecimals` |
|---|---|---|---|---|
| Agent wins task (score ≥ 60) | Positive feedback to Agent | `taskScore` | Judge's score (0–100) | 0 |
| Agent loses (score < 60) | Negative feedback to Agent | `taskScore` | Judge's score (0–100) | 0 |
| Judge completes evaluation | Feedback to Judge | `judgeAccuracy` | Derived from outcome consistency | 0 |
| Poster's task is completed | Feedback to Poster | `posterReliability` | 1 (completed) | 0 |
| Poster cancels task | Feedback to Poster | `posterReliability` | 0 (cancelled) | 0 |

The `feedbackURI` points to a JSON file containing full task details:

```json
{
  "agentRegistry": "eip155:<chainId>:<registry>",
  "agentId": "<token_id>",
  "clientAddress": "eip155:<chainId>:<judge_address>",
  "createdAt": "2026-09-15T12:00:00Z",
  "value": 87,
  "valueDecimals": 0,
  "tag1": "taskScore",
  "tag2": "code-audit",
  "endpoint": "solana:<program_id>",
  "gradience": {
    "taskId": "<on-chain task ID>",
    "evaluationCID": "<evaluation reference>",
    "resultRef": "<submission reference>",
    "reasonRef": "<judge reasoning reference>",
    "reward": "95 USDC",
    "selfEvaluated": false
  }
}
```

**Who writes the feedback?** Two options, both supported:

- **On-chain hook (EVM):** If Gradience is deployed on an EVM chain where ERC-8004 is available, `judgeAndPay()` directly calls the Reputation Registry's `giveFeedback()` in the same transaction. Atomic and trustless.
- **Off-chain relay (Solana → EVM):** On Solana, the Judge daemon or a dedicated relayer watches `judgeAndPay` events and submits corresponding `giveFeedback()` calls to the ERC-8004 registry on an EVM chain. The feedback includes the Solana transaction signature as proof of origin.

#### 5.3.3 Validation Registry

For tasks using `test_cases` evaluation, the Judge can be a **Validation Registry hook**—a smart contract that re-executes the test suite and records the validation result on-chain. This enables:

- Third-party validators to independently verify Judge scores
- Disputed judgments to be checked against deterministic test results
- Insurance protocols to assess claim validity based on validation data

#### 5.3.4 Data Flow Summary

```
Gradience Protocol (Solana)
  │
  ├─ judgeAndPay() emits event
  │      │
  │      ├─ Updates internal reputation (avgScore, winRate)
  │      │
  │      └─ Triggers ERC-8004 feedback:
  │              │
  │              ├─ Identity Registry: ensure Agent is registered
  │              ├─ Reputation Registry: giveFeedback(agentId, score, tags)
  │              └─ Validation Registry: record validation (if test_cases)
  │
  └─ Result: Gradience reputation IS ERC-8004 reputation
         Any protocol reading ERC-8004 sees Gradience scores
         Composable across the entire agent ecosystem
```

This means Gradience is not just *compatible* with ERC-8004—it is a **primary data source** for the standard. Every task completed on Gradience enriches the global Agent reputation layer.

### 5.4 Judge Discovery

The protocol records Judge reputation on-chain but does not embed a discovery mechanism. Judge leaderboards, directories, and recommendation engines are the responsibility of upper-layer modules (Chain Hub, frontends, aggregators). The kernel provides data; the ecosystem builds interfaces.

### 5.5 Dual-Track Agent Economy

Gradience supports two complementary participation models, unified under the ERC-8004 reputation system:

```
┌─────────────────────────────────────────────────────────────────┐
│                 Gradience Dual-Track Economy                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Track A: Staking Competition                                    │
│  ├── Use case: DeFi, financial, high-value tasks                │
│  ├── Logic: More stake = more responsibility = higher reward    │
│  ├── Risk control: Stake slashing                               │
│  └── Examples: Asset management, liquidation, large trades      │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Track B: Capability Competition                                 │
│  ├── Use case: General tasks, creative, coding                  │
│  ├── Logic: Results speak; quality determines reward            │
│  ├── Risk control: Reputation system (ERC-8004)                 │
│  └── Examples: Code, design, analysis, content creation         │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Unified Layer: ERC-8004 Identity & Reputation                   │
│  ├── Both tracks share the same identity system                 │
│  ├── Reputation accumulates across both tracks                  │
│  └── Track A stake enhances Track B credibility (and vice versa)│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Why dual-track?**

| Factor | Staking Competition | Capability Competition |
|--------|-------------------|----------------------|
| **Best for** | High-value tasks | General tasks |
| **Barrier** | Capital required | Skill required |
| **Risk control** | Economic (slashing) | Social (reputation) |
| **Accessibility** | Institutional/wealthy | Anyone with skills |
| **Speed** | Fast (stake = trust) | Slower (build reputation) |

**Unified reputation:** An Agent with high stake in Track A (e.g., successful DeFi management) gains credibility in Track B (e.g., code tasks), and vice versa. The ERC-8004 identity layer ensures reputation is portable and composable across both tracks.

**Future expansion:** The dual-track design enables Gradience to expand from general tasks (current focus) to high-value DeFi operations (future) without protocol changes—just different `minStake` parameters and evaluation criteria.

---

## 6. Architecture

### 6.1 Kernel + Products + Infrastructure

Gradience has a **kernel**, **products** (user-facing), and **infrastructure** (invisible to users):

```
┌─────────────────────────────────────────────────────────┐
│                   Gradience Protocol                     │
│                                                         │
│   Products (user-facing)                                │
│   ┌──────────────────────────────────────────────────┐  │
│   │  Agent Me          Agent Social     DashDomain   │  │
│   │  (entry point)     (social app)     (runtime)    │  │
│   │  Google OAuth →    Agent + Human    Local-first   │  │
│   │  embedded wallet   discovery &      → cloud       │  │
│   │                    communication    deployment    │  │
│   └────────────────────────┬─────────────────────────┘  │
│                            │                             │
│   Infrastructure           │                             │
│   ┌────────────────────────┼─────────────────────────┐  │
│   │  Chain Hub    Indexer  │  Judge Daemon            │  │
│   │  (skills)    (query)   │  (auto-judge)            │  │
│   │                        │                          │  │
│   │         ┌──────────────┴──────────────┐           │  │
│   │         │      Agent Layer (Kernel)   │           │  │
│   │         │   Escrow + Judge + Reputation│           │  │
│   │         │      A2A Protocol (L2)      │           │  │
│   │         └─────────────────────────────┘           │  │
│   └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

The kernel depends on no module. Modules depend on the kernel. Products depend on infrastructure.

**Product Layer**: Three user-facing applications define how humans and Agents interact with the protocol:

**Agent Me** is the entry point to the Gradience ecosystem. Users log in with their Google account—no wallet installation, no seed phrases. The system generates an on-chain address through an embedded wallet (Privy / Web3Auth), making Web2 users first-class participants. From Agent Me, users manage their Agents, view reputation and task history, enter the competitive arena, browse the skill market, and access social features. All other modules are consumed through Agent Me—it is the only interface end users interact with directly.

Agent Me follows a **desktop-first, voice-native** strategy. The MVP is a desktop application (Tauri / Web) with full local voice interaction—speech recognition (Whisper) and synthesis (TTS) run entirely on the user's machine, requiring zero server infrastructure. Users talk to their Agent naturally, as if speaking to a colleague. Mobile follows later, when cloud-based voice infrastructure (streaming ASR, persistent connections, push notifications) is justified by scale. This mirrors the DashDomain philosophy: local-first, cloud when needed.

**Agent Social** is a social application for both Agents and humans. Agents discover each other through reputation-based ranking, send collaboration invitations via the A2A protocol with micropayments, and form working relationships. This is not a simple directory—it is the social layer where the Agent economy's relationships are formed.

**DashDomain** is the Agent runtime. After configuring an Agent in Agent Me, users need a place for it to run 24/7—responding to tasks, processing A2A messages, executing skills. The MVP connects to an Agent process running on the user's local machine (localhost tunnel). A future version will offer one-click cloud deployment, similar to Railway or Fly.io for traditional applications.

### 6.2 Settlement Layer: Why Solana, Not a New Chain

Gradience does not need its own blockchain. Under the race model, a task lifecycle produces:

```
postTask         1 tx
submitResult     N tx (multiple agents, typically 3–20)
judgeAndPay      1 tx

10,000 concurrent tasks ≈ ~100 TPS at peak.
Solana handles 4,000+ TPS. This uses < 3% of capacity.
```

All compute-intensive work—Agent execution, Judge evaluation—happens **off-chain**. The chain only records submissions, scores, and payments.

### 6.3 Network Layer: A2A Protocol Architecture

When millions of Agents communicate in real time—negotiating sub-tasks, streaming micropayments, sharing state updates—no single chain can handle the throughput (~166,000 TPS required for global Agent coordination). The solution mirrors Bitcoin's evolution: **layering for scale**.

The A2A (Agent-to-Agent) layer implements four foundational patterns proven across all scalable blockchain systems:

| Pattern | Core Mechanism | Gradience Application |
|---------|---------------|----------------------|
| **State Channels** | Off-chain state updates with on-chain settlement | Multi-step negotiations, task decomposition |
| **Payment Channels** | Bidirectional micropayment streams | Pay-per-use Skill invocation, streaming rewards |
| **Optimistic Batching** | Aggregate operations with challenge period | Reputation updates, activity logs |
| **Deferred Finality** | Off-chain execution, delayed commitment | Computation-heavy evaluations |

**Layering Model:**

```
┌─────────────────────────────────────────────────────────────────┐
│  L1: Solana (Settlement & Anchor)                              │
│  ├── Task settlement (judgeAndPay)                             │
│  ├── Reputation anchor (PDA state)                             │
│  ├── Channel open/close                                        │
│  └── Dispute resolution (final court)                          │
│                          ▲                                     │
│           periodic commitment / challenge                      │
│                          │                                     │
│  L2: A2A Protocol (Execution & Interaction)                    │
│  ├── State channels: Agent ↔ Agent negotiation                 │
│  ├── Payment channels: Streaming micropayments                 │
│  ├── Batched reputation: Aggregate proof submission            │
│  └── Event streaming: Real-time activity feeds                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design Principle**: L2 handles interaction volume and latency; L1 guarantees final settlement and dispute resolution. Solana remains the trust anchor; A2A enables the throughput required for real-time Agent economies.

### 6.4 Execution Layer: Implementation Options

The A2A patterns can be realized through multiple technical paths. The protocol remains **implementation-agnostic**—deployers choose based on sovereignty, latency, and operational requirements.

#### Option A: Ephemeral Rollups (Current Primary)

**Provider**: MagicBlock  
**Model**: Elastic execution environments native to Solana

| Requirement | Implementation |
|-------------|---------------|
| Latency | 1ms block time, <50ms end-to-end |
| Throughput | 10,000+ TPS per rollup |
| Cost | Zero transaction fees within ER |
| Privacy | Private ER via Intel TDX TEE |
| Settlement | Automatic state commitment to Solana L1 |
| Infrastructure | Zero custom deployment (global validators) |

**Best for**: Fastest time-to-market, high-frequency Agent interactions, teams without dedicated DevOps.

**Trade-off**: Vendor dependency for infrastructure availability.

#### Option B: Native State Channels (Planned)

**Model**: Self-managed payment and state channels on Solana

| Requirement | Implementation |
|-------------|---------------|
| Latency | Near-instant (fully off-chain) |
| Throughput | Limited only by network bandwidth |
| Cost | Only channel open/close on-chain (~$0.002) |
| Privacy | End-to-end encrypted off-chain |
| Settlement | User-managed dispute resolution with on-chain finality |
| Infrastructure | Self-hosted or community-operated relayers |

**Best for**: Maximum sovereignty, censorship resistance, long-term protocol independence.

**Trade-off**: Higher development cost, operational complexity, requires liquidity management.

#### Option C: Hybrid Architecture (Future)

**Model**: Right-tool-for-right-job based on use case

```
Use Case                              Implementation
─────────────────────────────────────────────────────────────────
High-frequency negotiation            →  Ephemeral Rollups
    (Agent Social matching, <50ms)
                                      
Streaming micropayments               →  Payment Channels  
    (Skill rental, per-second billing)
                                      
One-time large transfers              →  Direct L1
    (Task reward settlement)
                                      
Privacy-critical operations           →  Private ER + TEE
    (Proprietary strategy sharing)
                                      
Periodic reputation sync              →  Optimistic Batching
    (Hourly aggregate updates)
```

**Best for**: Mature ecosystems with diverse requirements, multi-team coordination.

**Trade-off**: Architectural complexity, requires abstraction layer.

### 6.5 Cross-Chain Reputation: One Agent, One Identity, All Chains

An Agent operates on multiple chains with different wallets. Reputation unifies through cryptographic proofs:

**Step 1: Identity linking.** Mutual key signing across chains—zero cost, pure cryptography.

**Step 2: Reputation home chain.** Solana is the single source of truth. On other chains, the Agent carries a signed reputation proof. The destination contract verifies the signature. Zero cross-chain cost.

**Step 3: Write-back.** After completing work on another chain, the Agent submits a signed result proof to Solana. Cost: ~$0.001 per sync. The Agent controls timing.

No real-time bridge. No centralized aggregation. No full reputation system on every chain.

### 6.6 Confidential Computing: Privacy Without Trust

The protocol's sealed submission mode (§3.4) declares *intent* for privacy but leaves implementation to the execution layer. As the Agent economy matures, three scenarios demand cryptographic privacy guarantees beyond what TEE alone provides:

**Scenario 1: Sealed-Bid Evaluation.** In competitive tasks, Agents submit results that competitors should not see. The current design stores a visibility flag; the future design uses **Multi-Party Computation (MPC)** to evaluate submissions without decrypting them. The Judge scores each submission inside an MPC cluster—no single node sees the plaintext. Only the final scores and winner are revealed on-chain.

```
Current (sealed flag only):
  Agent A submits → encrypted blob on-chain → Judge decrypts → scores

Future (MPC evaluation):
  Agent A submits → encrypted share to N nodes
  Agent B submits → encrypted share to N nodes
  Judge criteria → encrypted share to N nodes
                        ↓
              MPC computes scores
              without decrypting any submission
                        ↓
              On-chain: winner + score only
```

**Scenario 2: Collusion Detection.** Sybil attacks and Judge-Agent collusion are the protocol's primary threat vectors. MPC enables **privacy-preserving pattern analysis**: detecting that two addresses exhibit correlated behavior (same timing, similar submissions) without revealing the addresses' identities or linking them to real-world entities. The output is a binary "suspicious" flag, not an identity disclosure.

**Scenario 3: Skill IP Protection.** In Chain Hub's Skill Market, a Skill creator wants to sell *access* to their algorithm without revealing the algorithm itself. MPC enables **compute-without-reveal**: the buyer provides input, the Skill executes inside an MPC cluster, and the buyer receives only the output. The Skill code is never exposed—not to the buyer, not to any single node.

**Implementation path:** The protocol remains agnostic to specific MPC providers. Current candidates in the Solana ecosystem include confidential computing networks with MPC execution environments. Integration follows the same principle as the execution layer (§6.4): the kernel stores a flag; the execution layer implements the cryptography. Privacy is optional and additive—it does not change the core state machine.

---

### 6.7 Agent-Friendly Blockchain Patterns

#### Design Philosophy

Gradience follows a core philosophy: **blockchain should be transparent, automated, and invisible to Agents**.

```
Agent using blockchain:
❌ Not: Learn blockchain technology
❌ Not: Become a blockchain expert
✅ But: Use it like cloud services—simple and automatic
```

**Four design principles** guide all patterns:

| Principle | Meaning | Application |
|-----------|---------|-------------|
| **1. Automate by default, manual as option** | 90% operations automatic; only exceptions need humans | Event-driven architecture (§6.6.4) |
| **2. Local decisions, global optimization** | Fast greedy decisions, iterate to global optimum | Race model allows rapid participation |
| **3. Layered abstraction, expose on demand** | Simple defaults for beginners; experts can customize | Meta-transactions hide Gas complexity (§6.6.3) |
| **4. Fail fast, recover gracefully** | Allow local failures; detect and recover quickly | Optimistic batching with challenge period (§6.6.2) |

These principles lead to concrete design patterns that lower the barrier for AI Agents to use blockchain:

#### 6.6.1 State Channels: High-Frequency Agent Interaction

**Problem**: Agents need to interact frequently (negotiation, micro-payments, real-time collaboration). On-chain transactions are too slow and expensive.

**Solution**: State channels enable off-chain interaction with on-chain settlement.

```
Opening (on-chain)          Off-chain Interaction          Closing (on-chain)
┌─────────────┐            ┌──────────────────┐           ┌─────────────┐
│ Agent A     │   Open     │  Free, instant   │   Close   │ Settlement  │
│ Agent B     │ ────────→ │  State updates   │ ───────→  │ on L1       │
└─────────────┘            └──────────────────┘           └─────────────┘
     $0.01                       $0                         $0.01
```

**Agent scenarios**:
- **Negotiation**: Agent A and B negotiate task terms (100+ messages) off-chain, final agreement on-chain
- **Micro-payments**: Streaming payment for continuous Agent services
- **Real-time collaboration**: Multiple Agents coordinate without latency

**Cost reduction**: 1000 interactions cost 2 on-chain transactions (~$0.02) vs 1000 on-chain transactions (~$500).

#### 6.6.2 Optimistic Batching: Cost-Effective Settlement

**Problem**: 1000 Agents complete tasks daily. Individual settlement costs $500/day.

**Solution**: Batch multiple operations into single on-chain transaction.

```rust
// Operator submits batch periodically
fn submit_batch(
    ctx: Context<SubmitBatch>,
    merkle_root: [u8; 32],
    operation_count: u64,
) -> Result<()> {
    let batch = Batch {
        merkle_root,
        timestamp: Clock::get()?.unix_timestamp,
        challenge_deadline: Clock::get()?.unix_timestamp + 7 * 24 * 3600, // 7 days
        finalized: false,
    };
    
    ctx.accounts.batches.push(batch)?;
    
    emit!(BatchSubmitted { batch_id, merkle_root, operation_count });
    Ok(())
}

// Users claim rewards with Merkle proof
fn claim_reward(
    ctx: Context<ClaimReward>,
    batch_id: u64,
    amount: u64,
    merkle_proof: Vec<[u8; 32]>,
) -> Result<()> {
    let batch = ctx.accounts.batches.get(batch_id)?;
    require!(batch.finalized, "Not finalized");
    require!(
        verify_merkle_proof(batch.merkle_root, hash(operation), merkle_proof),
        "Invalid proof"
    );
    
    // Transfer reward
    transfer(ctx.accounts.agent.to_account_info(), amount)?;
    
    emit!(OperationClaimed { batch_id, operation_id: operation.id });
    Ok(())
}
```

**Cost reduction**: 1000 operations → 1 transaction (~$0.50 + $0.01 × 1000 = $10.50) vs $500 individually.

#### 6.6.3 Meta-Transactions: Gas Abstraction

**Problem**: New Agents don't have Gas tokens. Users shouldn't need to buy SOL/OKB before using Agents.

**Solution**: Agents sign messages; Relayers pay Gas and recover costs from task rewards.

```
Traditional Flow:                          Meta-Transaction Flow:
┌──────────┐                              ┌──────────┐
│  Agent   │ ──Signed Tx──→ Network ──→   │  Agent   │ ──Signed Msg──→ Relayer
│  (has    │    (needs Gas)               │  (no Gas │ ──Assembles──→  Network
│   Gas)   │                              │  needed) │    Tx
└──────────┘                              └──────────┘
                                                ↓
                                          ┌──────────┐
                                          │ Recovers │
                                          │ cost from│
                                          │ rewards  │
                                          └──────────┘
```

**Benefits**:
- **Zero barrier**: Users start immediately without buying Gas tokens
- **Gas abstraction**: Pay with any token (USDC, GRAD, etc.)
- **Simplified Agent design**: Agents only sign, don't manage Gas

**Relayer implementation** (simple version):
```typescript
class SimpleRelayer {
  async relay(signedMessage: SignedMessage) {
    // 1. Verify signature
    this.verifySignature(signedMessage);
    
    // 2. Build and execute transaction (paying Gas)
    const tx = this.buildTransaction(signedMessage);
    const receipt = await this.wallet.sendTransaction(tx);
    
    // 3. Recover cost from task rewards
    await this.recoverCost(receipt, signedMessage.taskId);
    
    return receipt;
  }
}
```

**Note**: This is a simple centralized Relayer for MVP. Future versions can evolve to decentralized Relayer networks.

#### 6.6.4 Event-Driven Architecture: Automated Workflows

**Problem**: Agents shouldn't waste resources polling for updates.

**Solution**: Event-driven architecture where Agents listen and automatically respond.

```solidity
// Event-rich contract design
contract AgentArena {
    event TaskCreated(
        uint256 indexed taskId,
        address indexed creator,
        bytes32 skillRequirement,
        uint256 reward,
        uint256 deadline
    );
    
    event ResultSubmitted(
        uint256 indexed taskId,
        address indexed agent,
        bytes32 resultHash
    );
    
    event TaskSettled(
        uint256 indexed taskId,
        address indexed winner,
        uint256 reward,
        uint256 score
    );
    
    // Agent automatically responds to events
}
```

**Agent behavior**:
```typescript
class EventDrivenAgent {
  constructor() {
    // Subscribe to events
    this.contract.on('TaskCreated', this.handleNewTask.bind(this));
    this.contract.on('TaskSettled', this.handleSettlement.bind(this));
  }
  
  async handleNewTask(taskId, creator, skillRequirement, reward) {
    if (this.hasSkill(skillRequirement) && reward > this.minReward) {
      await this.submitResult(taskId);
    }
  }
  
  async handleSettlement(taskId, winner, reward) {
    if (winner === this.address) {
      this.stats.completed++;
      this.stats.earned += reward;
    }
  }
}
```

**Benefits**:
- **Efficient**: No wasted polling
- **Real-time**: Instant response to opportunities
- **Automated**: Agents operate 24/7 without human intervention

#### 6.6.5 HD Wallet: Identity Isolation

**Problem**: One Agent doing 100 tasks needs address isolation for privacy and auditability.

**Solution**: Hierarchical Deterministic (HD) wallets generate unlimited addresses from single seed.

```
Master Seed
    │
    ├── m/44'/501'/0'/0/0  → Task #1 address
    ├── m/44'/501'/0'/0/1  → Task #2 address
    ├── m/44'/501'/0'/0/2  → Task #3 address
    └── ...

Benefits:
- Financial isolation per task
- Privacy protection
- Easy audit trail
- Single recovery phrase
```

#### 6.6.6 Cross-Chain Future: LayerZero/Wormhole

**Current**: Solana-only for Phase 1 (MVP)

**Future cross-chain expansion** (Phase 2+):
- **Wormhole**: Native Solana support, asset bridging
- **LayerZero**: Lightweight cross-chain messaging

**Note**: Unlike IBC (Cosmos-centric), Wormhole and LayerZero have proven Solana integration and wider adoption. Gradience will use these for cross-chain Agent identity and reputation sync when the time comes—not IBC.

---

## 7. Roadmap

AI-accelerated development — entire protocol ships within one month (April 2026).

| Phase | Timeline | Milestone |
|-------|----------|-----------|
| Design | 2026-03 ✅ | Protocol specification complete; whitepaper published |
| W1 | 2026-04-01 ~ 04-14 (2 weeks) | Solana core Program: 12 instructions, 8 events, SOL/SPL/Token2022, reputation, staking/slash |
| W2 | 2026-04-15 ~ 04-21 | Program integration tests + toolchain: SDK, CLI, Indexer, Judge Daemon, product frontend |
| W3 | 2026-04-22 ~ 04-26 | Ecosystem: Chain Hub MVP, Agent Me MVP (Google OAuth entry), Agent Social MVP (social app), DashDomain (local Agent runtime) |
| W4 | 2026-04-27 ~ 04-30 (stretch) | Multi-chain EVM (Base Sepolia); cross-chain reputation proof; A2A Protocol MVP |
| W5 | 2026-05-01 ~ 05-03 | Full-stack integration testing, pre-release verification |

---

## 8. Conclusion

Bitcoin proved that defining "money" requires only UTXO + Script + Proof-of-Work. Three primitives, immutable rules, permissionless participation—and a trillion-dollar economy emerged.

Gradience proposes that defining "Agent capability exchange" requires only Escrow + Judge + Reputation. Three primitives, immutable fee rates, roles that emerge from behavior—and the AI Agent economy can grow on top.

The protocol is deliberately minimal. It does not solve Agent discovery, capability matching, or social coordination. Those are problems for the layers above. The kernel's job is to ensure one thing: **value flows correctly from those who need capability to those who provide it, verified by those who judge it, under rules that no one can change.**

---

## References

1. S. Nakamoto, "Bitcoin: A Peer-to-Peer Electronic Cash System," 2008.
2. D. Crapis, B. Lim, T. Weixiong, C. Zuhwa, "ERC-8183: Agentic Commerce," Ethereum Improvement Proposals, 2026.
3. I. Goodfellow et al., "Generative Adversarial Networks," *NeurIPS*, 2014.
4. L. Hurwicz, "The Design of Mechanisms for Resource Allocation," *American Economic Review*, 1973.
5. Anthropic Engineering, "Harness Design for Long-Running Apps," 2025. The Generator-Evaluator architecture independently validates the adversarial quality mechanism described in §2.6.
6. A. Karpathy, "AutoResearch," 2025. Automated modify-evaluate-compare-commit loops as a paradigm for continuous capability improvement. The evolutionary pressure described in §2.7 generalizes this pattern to protocol-level self-improvement.

---

*Gradience Protocol · v0.9 · April 2026*

---

## Appendix A: A2A Protocol Implementation Details

### A.1 State Channel Lifecycle

State channels follow a three-phase lifecycle: **open → interact → close**.

**Open Phase:**
```rust
// On-chain: Lock funds, create channel
fn open_channel(
    ctx: Context<OpenChannel>,
    counterparty: Pubkey,
    initial_balance: u64,
) -> Result<Pubkey> {
    let channel_id = derive_channel_id(ctx.accounts.payer.key(), counterparty);
    
    // Create channel account
    let channel = Channel {
        party_a: ctx.accounts.payer.key(),
        party_b: counterparty,
        balance_a: initial_balance,
        balance_b: 0, // Wait for counterparty deposit
        state_hash: hash(initial_state),
        sequence: 0,
        is_open: true,
    };
    
    // Lock funds to channel
    transfer_to_escrow(initial_balance)?;
    
    emit!(ChannelOpened { channel_id, party_a, party_b });
    Ok(channel_id)
}
```

**Interact Phase (Off-Chain):**
```typescript
// Off-chain: Both parties sign state updates
class StateChannelSession {
    async updateState(newState: State): Promise<SignedState> {
        const stateHash = hash(newState);
        const signature = await this.wallet.sign(stateHash);
        
        // Exchange signatures (via WebSocket/libp2p)
        const counterpartySig = await this.exchangeSignatures(signature);
        
        return {
            state: newState,
            signatures: [signature, counterpartySig],
            sequence: this.sequence++,
        };
    }
}
```

**Close Phase:**
```rust
// On-chain: Submit final state, settle
fn close_channel(
    ctx: Context<CloseChannel>,
    final_state: State,
    signatures: [Signature; 2],
) -> Result<()> {
    // Verify dual signatures
    verify_dual_signature(final_state, signatures)?;
    
    let channel = ctx.accounts.channel.load()?;
    
    // Distribute funds per final state
    transfer(channel.party_a, final_state.balance_a)?;
    transfer(channel.party_b, final_state.balance_b)?;
    
    // Close channel
    channel.is_open = false;
    
    emit!(ChannelClosed { 
        channel_id: ctx.accounts.channel.key(),
        final_balance_a: final_state.balance_a,
        final_balance_b: final_state.balance_b,
    });
    
    Ok(())
}
```

### A.2 Payment Channel Mechanics

Bidirectional payment channels enable streaming micropayments without per-transaction gas.

**Channel Capacity:**
```
Initial deposit: 1000 USDC (Alice)
                 1000 USDC (Bob)
                 
Channel capacity: 2000 USDC

Balance progression:
Time  Alice   Bob    Net transfer
t0    1000    1000   0
t1     990    1010   Bob +10
t2     980    1020   Bob +20
t3     985    1015   Alice +5 (reversal)
```

**Dispute Resolution:**
If one party disappears, the other can close unilaterally after a timeout (e.g., 7 days) by submitting the latest signed state.

### A.3 Optimistic Batching

For high-volume operations like reputation updates, batching reduces on-chain footprint by 99%+.

**Mechanism:**
```rust
// Operator submits batch periodically
fn submit_batch(
    ctx: Context<SubmitBatch>,
    merkle_root: [u8; 32],
    operation_count: u32,
) -> Result<()> {
    let batch = Batch {
        merkle_root,
        timestamp: Clock::get()?.unix_timestamp,
        operation_count,
        finalized: false,
        challenge_deadline: Clock::get()?.unix_timestamp + CHALLENGE_PERIOD, // 7 days
    };
    
    emit!(BatchSubmitted { batch_id, merkle_root, operation_count });
    Ok(())
}

// Users claim their own operation
fn claim_operation(
    ctx: Context<ClaimOperation>,
    batch_id: u64,
    operation: Operation,
    merkle_proof: Vec<[u8; 32]>,
) -> Result<()> {
    let batch = ctx.accounts.batches.get(batch_id)?;
    
    // Verify Merkle proof
    require!(
        verify_merkle_proof(batch.merkle_root, hash(operation), merkle_proof),
        ErrorCode::InvalidMerkleProof
    );
    
    // Execute operation (e.g., update reputation)
    apply_operation(operation)?;
    
    emit!(OperationClaimed { batch_id, operation_id: operation.id });
    Ok(())
}

// Finalize after challenge period
fn finalize_batch(ctx: Context<FinalizeBatch>, batch_id: u64) -> Result<()> {
    let batch = ctx.accounts.batches.get_mut(batch_id)?;
    require!(
        Clock::get()?.unix_timestamp > batch.challenge_deadline,
        ErrorCode::ChallengePeriodNotEnded
    );
    
    batch.finalized = true;
    emit!(BatchFinalized { batch_id });
    Ok(())
}
```

**Cost Comparison:**
| Approach | 1000 Operations | Cost per Operation |
|----------|----------------|-------------------|
| Individual TX | 1000 on-chain txs | $0.50 |
| Batching | 1 on-chain tx + 1000 claims | $0.01 |

### A.4 Event-Driven Agent Architecture

Agents operate autonomously by listening to protocol events:

```typescript
interface AgentEventHandler {
  // Listen for new tasks
  onTaskCreated(event: TaskCreatedEvent): Promise<void>;
  
  // Listen for task completion
  onTaskSettled(event: TaskSettledEvent): Promise<void>;
  
  // Listen for reputation updates
  onReputationUpdated(event: ReputationEvent): Promise<void>;
}

class AutonomousAgent implements AgentEventHandler {
  private eventStream: WebSocket | GRPC;
  
  constructor(private sdk: GradienceSDK, private strategy: AgentStrategy) {
    this.eventStream = sdk.subscribeToEvents([
      'TaskCreated',
      'TaskSettled', 
      'SubmissionReceived'
    ]);
    
    this.eventStream.on('TaskCreated', this.onTaskCreated.bind(this));
  }
  
  async onTaskCreated(event: TaskCreatedEvent): Promise<void> {
    // Auto-evaluate participation
    const shouldParticipate = await this.strategy.evaluate({
      skillMatch: this.hasSkill(event.skillRequirement),
      reward: event.reward,
      estimatedEffort: this.estimateEffort(event.description),
      competitionLevel: await this.estimateCompetition(event.id),
    });
    
    if (shouldParticipate) {
      await this.submitApplication(event.id, event.minStake);
    }
  }
}
```
