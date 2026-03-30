# OpenAgents vs Gradience: Deep Technical Comparison

> **Core finding: Same problem, opposite design philosophies.**
> OpenAgents = Ethereum approach (full-stack economic OS).
> Gradience = Bitcoin approach (minimal settlement kernel).
>
> Analysis date: 2026-03-30
> Source: [github.com/OpenAgentsInc/openagents](https://github.com/OpenAgentsInc/openagents)

---

## 1. Both Projects Solve the Same Problem

Both OpenAgents and Gradience recognize the same fundamental gap:

> "AI Agents can now execute work, but there is no trustless infrastructure for verification, settlement, and reputation."

OpenAgents frames it as: *"Execution is becoming infinite. Verification is not."*

Gradience frames it as: *"Escrow + Judge + Reputation = trustless capability settlement."*

Same problem. Different answers.

---

## 2. Architecture Comparison

### OpenAgents: Five Interlocking Markets

```
OpenAgents Marketplace
├── Compute Market    — buy/sell machine capacity (inference, embeddings)
├── Data Market       — buy/sell datasets, artifacts, context
├── Labor Market      — buy/sell machine work (WorkUnit → Submission → Verdict)
├── Liquidity Market  — routing, FX, value movement
└── Risk Market       — prediction, coverage, underwriting, insurance

Economy Kernel (shared substrate)
├── Contracts, Verification, Liability, Settlement, Receipts
└── 10+ kernel-facing object types

Execution Layer
├── Nostr (NIP-90 for job dispatch, NIP-32 for reputation)
├── Bitcoin Lightning (settlement)
└── Desktop app (Autopilot)
```

### Gradience: One Kernel, Modules Above

```
Gradience Protocol
├── Agent Layer (Kernel)
│   └── 3 functions: postTask, submitResult, judgeAndPay
│   └── 3 states: Open → Completed / Refunded
│
├── Chain Hub (tooling module)
├── Agent Me (entry module)
├── Agent Social (discovery module)
└── A2A Protocol (network module)

Settlement: Solana
High-frequency A2A: MagicBlock Ephemeral Rollups
```

### Side-by-Side

| Dimension | OpenAgents | Gradience |
|-----------|-----------|-----------|
| Philosophy | "Economic operating system" | "Settlement protocol kernel" |
| Markets | 5 (Compute, Data, Labor, Liquidity, Risk) | 1 (Capability settlement) |
| Core functions | 20+ authority flows across 5 markets | 3 (post, submit, judge) |
| States per lifecycle | 6+ (Created, Contracted, Submitted, Finalized, Settled, Disputed) | 3 (Open, Completed, Refunded) |
| Codebase | 100K+ lines Rust | ~300 lines target |
| Competition model | Assignment (requester → provider) | Race (open competition, like Bitcoin mining) |
| Settlement | Bitcoin Lightning | Solana |
| Communication | Nostr (NIP-90) | MagicBlock Ephemeral Rollups |
| Token | Bitcoin (BTC via Lightning) | GRAD (fixed supply + mining + burn) |
| Risk management | Built-in Risk Market (insurance, coverage, underwriting) | Not in kernel (upper-layer responsibility) |
| Data market | Built-in Data Market (buy/sell datasets) | Not in kernel (upper-layer responsibility) |
| Status | MVP shipping (compute earn loop live) | Design complete, Solana implementation pending |

---

## 3. Reputation: The Critical Difference

### OpenAgents: Binary Labels (NIP-32)

OpenAgents uses Nostr NIP-32 labels for reputation:

```rust
// From crates/nostr/core/src/nip_ac/reputation.rs

// On successful settlement:
Label::new("success", "agent/credit")
  → attached to agent's Nostr pubkey

// On default/failure:
Label::new("default", "agent/credit")
  → attached to agent's Nostr pubkey
```

Trust evaluation uses a simple policy:

```rust
// From crates/nostr/core/src/nip_skl/trust.rs

pub struct TrustPolicy {
    pub minimum_positive_labels: usize,     // need N "success" labels
    pub kill_labels: HashSet<String>,       // "malicious-confirmed", "prompt-injection", etc.
    pub minimum_kill_label_publishers: usize,
    pub require_capabilities_verified: bool,
    pub trusted_issuers: HashSet<String>,   // optional allowlist
}

// Output: Trusted / Untrusted / Blocked
```

**What this tells you about an Agent:**
- How many times it succeeded (count of "success" labels)
- How many times it failed (count of "default" labels)
- Whether it's been flagged as malicious

**What this does NOT tell you:**
- How well it performed (no quality score)
- How it compares to other Agents (no competitive context)
- Whether its successes were self-evaluated or independently verified

### Gradience: Continuous Scoring + Competition

```
Reputation metrics:
  avgScore:   87          ← mean of all winning scores (0-100)
  completed:  47          ← tasks won
  submitted:  51          ← tasks attempted (including losses)
  winRate:    92%         ← completed / submitted

Additional context:
  selfEvaluated: 3 of 47  ← market knows which wins were self-judged
  role-specific:           ← separate reputation as Agent, Judge, Poster
```

**What this tells you:**
- How well the Agent performs (average score)
- How it compares to competitors (win rate in open race)
- How reliable the reputation is (self-eval vs independent)
- How active and experienced the Agent is (submission count)

### Information Density Comparison

```
OpenAgents reputation signal:
  "Agent X completed 47 tasks, failed 3"
  → Completion rate: 94%
  → Quality: unknown
  → Relative ability: unknown

Gradience reputation signal:
  "Agent X won 47 of 51 tasks, avg score 87, 3 self-evaluated"
  → Completion rate: 92%
  → Quality: 87/100
  → Relative ability: beat competitors 92% of the time
  → Signal reliability: 44 of 47 wins were independently judged
```

Gradience's reputation carries **significantly more information per data point** because:
1. Scores are continuous (0-100), not binary (pass/fail)
2. Race model provides competitive context (win rate)
3. Self-evaluation is tracked and discounted

---

## 4. Work Lifecycle Comparison

### OpenAgents Labor Market

```
WorkUnit (Created)
  → Contract (Created → Submitted → Finalized → Settled / Disputed)
    → Submission (Received → Accepted / Rejected)
      → Verdict (Pass / Fail / Escalated)
        → Settlement (Pending → Settled / Disputed)
          → Claim (Open → UnderReview → Resolved / Rejected)

6 object types, 15+ states across them.
Dispute resolution built into the kernel.
```

### Gradience Agent Layer

```
Task (Open)
  → submitResult() × N
  → judgeAndPay(winner, score)
  → Completed (score ≥ 60) or Refunded (score < 60 / timeout)

1 object type, 3 states.
No dispute resolution in kernel (upper-layer responsibility).
```

### Why Gradience Is Simpler

OpenAgents needs complexity because it handles **everything** in the kernel: contracts, warranties, claims, disputes, verification tiers, liability. This is the Ethereum approach—make the base layer as expressive as possible.

Gradience keeps the kernel minimal because complex workflows **compose on top**: a dispute resolution protocol can be built as a separate module that reads Gradience reputation data. This is the Bitcoin approach—do one thing well, let the ecosystem build the rest.

---

## 5. Verification Model

### OpenAgents: Tiered Verification

```rust
pub enum VerificationTier {
    Tier1,  // basic
    Tier2,  // intermediate
    Tier3,  // thorough
    // ... extensible
}
```

Verification is a kernel concern. Work units carry verification requirements. The system assigns verification depth proportional to value at risk.

### Gradience: Judge as Verifier

```
Judge scores 0-100 based on evaluationCID criteria.
Judge can be:
  - EOA (human judgment)
  - Smart contract (automated test execution)
  - ZK verifier (cryptographic proof)
  - Multi-sig (committee)

Verification depth is determined by who the Poster selects as Judge.
```

Gradience's approach is simpler: **the Poster decides how much verification they need by choosing the right Judge.** A $10 task might use a basic LLM judge. A $10,000 task might use a smart contract that runs a full test suite. The protocol doesn't need to encode "tiers"—the market handles it.

---

## 6. Economic Model

| Aspect | OpenAgents | Gradience |
|--------|-----------|-----------|
| Payment | Bitcoin via Lightning | Any token (SOL, USDC, SPL) |
| Protocol token | None (uses BTC) | GRAD (fixed supply, mining, burn) |
| Fee model | Not clearly specified | 95/3/2 immutable split |
| Judge/verifier incentive | Not clearly specified | 3% unconditional fee |
| Staking | Not in current implementation | Required for participation |
| Flywheel | Compute earn → spend BTC → more compute | Task completion → mine GRAD → stake → more tasks |

---

## 7. What Gradience Can Learn From OpenAgents

1. **Risk primitives are valuable.** OpenAgents' Risk Market (coverage, prediction, underwriting) is overkill for a kernel, but the concept of pricing verification risk is powerful. Gradience could expose enough data for an upper-layer risk market.

2. **Desktop runtime matters.** OpenAgents' Autopilot gives Agents a local execution environment. Gradience's Agent Me module serves a similar role—it should be prioritized.

3. **Data market is a natural extension.** Agents need data to work. A data marketplace that uses GRAD for payment would strengthen the flywheel.

---

## 8. What OpenAgents Could Learn From Gradience

1. **Binary reputation is insufficient.** "success/default" labels lose too much information. A 0-100 score system with competitive context (win rate) produces far richer signals.

2. **Competition discovers quality.** The assign model (requester picks provider) doesn't create market discovery. The race model lets the best Agent emerge naturally.

3. **Simplicity scales.** 5 markets × 6+ states × 15+ object types = extreme complexity. Most of their market implementations are still "planned" or "local prototype." A simpler kernel ships faster and attracts more builders.

---

## 9. Conclusion

```
OpenAgents asks: "How do we build a complete economic OS for Agents?"
  → 5 markets, tiered verification, risk underwriting, dispute resolution
  → Comprehensive but complex
  → 100K+ lines, mostly unshipped

Gradience asks: "What is the minimum viable settlement primitive?"
  → 3 functions, 3 states, race competition, continuous scoring
  → Minimal but complete
  → ~300 lines, ready to implement

Both are valid approaches. History suggests the simpler one wins:
  Bitcoin (2009) vs every "Bitcoin killer" since then.
  HTTP/TCP (1990s) vs OSI model (1980s).
  Unix philosophy vs monolithic OS.

The protocol that ships, stays simple, and lets the ecosystem build on top
tends to outlast the protocol that tries to do everything in the base layer.
```
