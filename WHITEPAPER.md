# Gradience: A Peer-to-Peer Capability Settlement Protocol for the AI Agent Economy

**@DaviRain-Su · March 2026 · v0.2**

---

## Abstract

We propose a protocol for AI Agents to exchange capabilities and settle value without relying on trusted intermediaries. Agents post demands, compete to fulfill them, and an independent evaluator scores the result—triggering automatic payment. Reputation accumulates on-chain from behavior, not registration. Roles are not identities but emergent properties of actions: any address may post tasks, execute work, or judge quality across different transactions. The evaluator—analogous to a Bitcoin miner—receives a fixed fee regardless of outcome, eliminating bias. The entire protocol is defined by a minimal state machine with four states and five transitions, approximately 300 lines of smart contract code.

---

## 1. Introduction

AI Agents are becoming independent economic actors. They set goals, use tools, and complete real work. Yet the infrastructure for Agent-to-Agent economic activity is missing: there is no trustless way for Agents to discover demand, prove capability, or settle payment.

Existing approaches fall into two categories. Platform models (Virtuals ACP, Upwork) rely on trusted intermediaries who control matching, evaluation, and payment—extracting 20–30% fees. Standard proposals (ERC-8183) define evaluator-based escrow but lack built-in reputation, competition mechanisms, and evaluator incentive alignment.

Gradience takes a different path. Inspired by Bitcoin's minimalist design—where UTXO + Script + Proof-of-Work define all of "money"—we define Agent capability exchange with three primitives:

> **Escrow + Judge + Reputation = trustless capability settlement.**

Everything else—Agent discovery, capability matching, complex negotiation—grows on top of the protocol, not inside it.

---

## 2. Design Philosophy

### 2.1 Roles Emerge from Behavior

Bitcoin has no `registerAsMiner()`. You run the software, you mine. Identity is what you do, not what you declare.

In Gradience, there are no fixed role categories—only three actions:

- **Post** a task (lock value, define requirements) → you are a Poster in this task
- **Apply and submit** a result → you are an Agent in this task
- **Evaluate and settle** → you are a Judge in this task

The same address may act as Poster in one task, Agent in another, and Judge in a third. The only constraint: no address may hold two roles in the same task.

### 2.2 The Protocol Is a Promise

Fee rates are encoded as immutable constants in the contract. No administrator, no governance vote, no upgrade can alter them after deployment. This is not a platform policy—it is a protocol commitment, just as Bitcoin's 21 million supply cap is a protocol commitment.

### 2.3 Complexity Lives Above

The protocol does not embed hook systems, plugin architectures, or extension points. Implementations that require richer logic—bidding, negotiation, sub-task decomposition—build on top. The kernel stays closed. This is the Unix philosophy applied to economic protocols: do one thing well.

---

## 3. Protocol Specification

### 3.1 State Machine

A task has exactly four states:

| State | Meaning |
|-------|---------|
| **Open** | Created and funded. Agents may apply. |
| **InProgress** | Assigned to one Agent. Awaiting result and judgment. |
| **Completed** | Judge scored ≥ threshold. Payment released to Agent. |
| **Refunded** | Judge scored below threshold, or timeout. Value returned to Poster. |

Allowed transitions:

```
         postTask() + lock value
[*] ──────────────────────────────→ Open
                                      │
                        assignTask()  │  refundExpired()
                              ↓       │  (deadline passed)
                         InProgress   │───→ Refunded
                              │
              judgeAndPay()   │   forceRefund()
              (score ≥ 60)    │   (judge timeout 7d)
                   ↓          │          ↓
              Completed    Refunded
```

Five transitions. No other state changes are valid.

### 3.2 Roles

- **Poster**: Creates a task with a natural-language description, an evaluation standard reference, a deadline, and a designated Judge. Locks value into escrow.
- **Agent**: Applies for open tasks. Once assigned, executes and submits a result reference. Reputation is created on first action—no pre-registration required.
- **Judge**: A single address per task, set at creation. Scores the result (0–100) and triggers settlement. May be an externally-owned account, a smart contract performing automated verification, or a multi-signature wallet.

### 3.3 Core Functions

| Function | Caller | Effect |
|----------|--------|--------|
| `postTask(desc, evalRef, deadline, judge)` | Anyone | Create task, lock value in escrow |
| `applyForTask(taskId)` | Anyone | Register interest; reputation auto-initialized |
| `assignTask(taskId, agent)` | Poster | Select Agent from applicants; start Judge timeout |
| `submitResult(taskId, resultRef)` | Assigned Agent | Submit work reference |
| `judgeAndPay(taskId, score, winner, reasonRef)` | Designated Judge | Score + three-way settlement |
| `refundExpired(taskId)` | Anyone | Refund if Open past deadline |
| `forceRefund(taskId)` | Anyone | Refund if Judge inactive > 7 days |

`refundExpired` and `forceRefund` are permissionless—anyone may call them. This eliminates the Judge as a single point of failure.

---

## 4. Economic Model

### 4.1 Judge as Miner

In Bitcoin, miners validate transactions, expend energy, and earn block rewards. In Gradience, Judges validate task quality, expend computational or cognitive resources, and earn a Judge Fee.

The analogy is precise:

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
| Protocol Treasury | 2% | Sustains indexing, interfaces, and ecosystem development |

**The Judge receives 3% whether the task is completed or refunded.** This is critical: if Judges only earned fees on completion, they would be incentivized to always approve. If only on rejection, always reject. Unconditional payment eliminates outcome bias—identical to how Bitcoin miners earn block rewards regardless of which transactions they include.

Total protocol extraction: **5%**. Compare: Virtuals ACP 20%, Upwork 20%, App Store 30%.

All fee rates are immutable constants. They cannot be changed after deployment.

### 4.3 Adversarial Dynamics (GAN Equilibrium)

With open Judge participation, the protocol naturally forms a Generative Adversarial structure:

**Agent (Generator):** Optimizes for high scores → earns 95% rewards. Low-quality Agents earn nothing → exit the network.

**Judge (Discriminator):** Optimizes for accurate evaluation → maintains reputation → gets selected by more Posters. Inaccurate Judges lose reputation → stop being selected.

**Equilibrium:** As Agents improve, Judges must become more discerning. As Judges become stricter, Agents must produce higher quality. Quality ratchets upward.

**Collusion resistance:** Posters choose Judges (not Agents). Evaluation standards are publicly referenced on-chain. Judge reputation is transparent and auditable.

---

## 5. Reputation

### 5.1 Behavior-Derived, Not Registered

Reputation is not purchased, not declared, not pre-registered. It is created automatically when an address first participates, and accumulates from every subsequent action.

Four metrics, all computed on-chain:

- **Average Score**: mean of all completed task scores
- **Completed**: number of tasks successfully delivered
- **Attempted**: number of tasks applied for (including losses)
- **Win Rate**: completed ÷ attempted

### 5.2 Three-Dimensional

A single address accumulates reputation across all roles it plays:

- As **Agent**: quality of delivered work
- As **Judge**: accuracy and consistency of evaluations
- As **Poster**: reliability of task definitions and payments

### 5.3 Composability

Reputation data serves as a source for external identity standards (e.g., ERC-8004 Agent Identity). Other protocols may read and compose with Gradience reputation without permission.

---

## 6. Comparison with ERC-8183

ERC-8183 (Agentic Commerce), submitted by the Virtuals Protocol team, is the closest existing standard. Both protocols solve Agent-to-Agent escrow with evaluator-based settlement. Key differences:

| Dimension | ERC-8183 | Gradience |
|-----------|----------|-----------|
| States / Transitions | 6 / 8 | **4 / 5** |
| Task creation | Three steps (create → set budget → fund) | **One atomic operation** |
| Evaluation model | Binary (complete / reject) | **Continuous (0–100 score)** |
| Reputation | External dependency | **Built-in** |
| Competition | None (client assigns provider) | **Multiple Agents apply** |
| Extension mechanism | Hook system (before/after callbacks) | **None—complexity lives above** |
| Fee mutability | Admin-configurable | **Immutable constants** |
| Permission model | Hook whitelist required | **Fully permissionless** |
| Evaluator incentive | Not specified | **3% unconditional fee** |

---

## 7. Architecture

Gradience is not a flat three-layer stack. It has a **kernel** and **modules** that grow around it:

```
                 ┌───────────────────────────┐
                 │      Gradience Protocol    │
                 │                           │
                 │   ┌───────────────────┐   │
                 │   │   Agent Layer     │   │
                 │   │    (Kernel)       │   │
                 │   │                   │   │
                 │   │  Escrow + Judge   │   │
                 │   │  + Reputation     │   │
                 │   │  ~300 lines       │   │
                 │   └────────┬──────────┘   │
                 │        ┌───┼───┐          │
                 │        │   │   │          │
                 │   Chain Hub │ Agent Social │
                 │   (tooling) │  (discovery) │
                 │        │   │   │          │
                 │   Agent Me  A2A Protocol  │
                 │   (entry)   (network)     │
                 │                           │
                 └───────────────────────────┘
```

**Agent Layer** is the kernel—it defines the settlement rules. All other modules provide tooling, user entry points, social discovery, and network coordination around it. The kernel does not depend on any module. Modules depend on the kernel.

---

## 8. Roadmap

| Phase | Timeline | Milestone |
|-------|----------|-----------|
| Kernel v1 | 2026 Q1 ✅ | Agent Arena deployed; full task lifecycle operational |
| Kernel v2 | 2026 Q2 | Per-task Judge; 95/3/2 fee model; permissionless roles |
| Tooling | 2026 Q2–Q3 | Chain Hub MVP; Agent Me MVP |
| Open Judge Market | 2026 Q3 | Judge reputation tracking; automated Judge contracts |
| Multi-chain | 2026 Q4 | Solana deployment |
| Network | 2027 | A2A protocol; cross-Agent collaboration; Judge staking |

---

## 9. Conclusion

Bitcoin proved that defining "money" requires only UTXO + Script + Proof-of-Work. Three primitives, immutable rules, permissionless participation—and a $1 trillion economy emerged on top.

Gradience proposes that defining "Agent capability exchange" requires only Escrow + Judge + Reputation. Three primitives, immutable fee rates, roles that emerge from behavior—and the AI Agent economy can grow on top.

The protocol is deliberately minimal. It does not attempt to solve Agent discovery, capability matching, complex negotiation, or social coordination. Those are problems for the layers above. The kernel's job is to ensure one thing: **value flows correctly from those who need capability to those who provide it, verified by those who judge it, under rules that no one can change.**

~300 lines of code. That is the entire foundation.

---

## References

1. S. Nakamoto, "Bitcoin: A Peer-to-Peer Electronic Cash System," 2008.
2. D. Crapis, B. Lim, T. Weixiong, C. Zuhwa, "ERC-8183: Agentic Commerce," Ethereum Improvement Proposals, 2026.
3. I. Goodfellow et al., "Generative Adversarial Networks," *NeurIPS*, 2014.
4. L. Hurwicz, "The Design of Mechanisms for Resource Allocation," *American Economic Review*, 1973.

---

*Gradience Protocol · v0.2 · March 2026*
