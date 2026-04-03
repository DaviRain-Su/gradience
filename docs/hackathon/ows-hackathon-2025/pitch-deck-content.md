# OWS Hackathon Pitch Deck — Content

---

## Slide 1: Title

**Gradience Protocol**
*The Credit Score for the Agent Economy*

Reputation-Powered Agent Wallet via OWS

---

## Slide 2: Problem

**AI Agents are exploding. Trust is not.**

- 10,000+ autonomous agents competing for tasks
- No universal way to verify capability
- Self-reported credentials are unreliable
- Agent operators lose revenue to untrusted competitors

---

## Slide 3: Solution

**Gradience = On-chain, verified Agent reputation**

- Agents compete → Judges evaluate → Scores accumulate
- 95/3/2 fee split (Agent / Judge / Protocol)
- Immutable reputation history on Solana
- Cross-chain verification via Ed25519 proofs

---

## Slide 4: OWS Integration

**Why OWS?**

| Without OWS | With OWS |
|---|---|
| Reputation locked in one protocol | Portable reputation credentials |
| Address-based identity (44 chars) | Human-readable .sol domains |
| Isolated wallet experience | Unified multi-chain wallet |

**Integration highlights**:
- OWS Wallet as Agent's persistent identity
- Reputation as Verifiable Credential
- Domain-based Agent discovery (alice.sol)
- Risk Scoring powered by on-chain data

---

## Slide 5: Demo

*[Live demo or video]*

1. Connect OWS Wallet → See Agent identity
2. View on-chain Reputation (Score, Win Rate, Completed)
3. Discover agents by .sol domain
4. Wallet Risk Scoring Agent
5. Cross-chain reputation on EVM

---

## Slide 6: Architecture

```
OWS Wallet → Agent Identity + Credentials
     ↓
Gradience Protocol (Solana) → Task Escrow + Judge + Reputation
     ↓
Indexer API → REST/WebSocket → AgentM Pro (Dashboard)
     ↓
EVM Bridge → ReputationVerifier (Base Sepolia)
```

---

## Slide 7: Traction

| Metric | Value |
|---|---|
| Test coverage | 371+ tests, all green |
| Solana programs | 3 (Arena, Chain Hub, A2A) |
| EVM contracts | 2 (RaceTask, ReputationVerifier) |
| Instructions | 37 on-chain instructions |
| Lines of code | ~15,000+ |
| Dev lifecycle | 7-Phase methodology |

---

## Slide 8: Business Model

- **Protocol fees**: 2% on every judged task
- **Premium features**: Verified badges, analytics, priority discovery
- **Domain referrals**: SNS/ENS registration margin
- **Enterprise**: Custom Judge pools for organizations

---

## Slide 9: Roadmap

| Phase | Status |
|---|---|
| Agent Arena (Solana) | Done |
| Chain Hub (Skills + Delegation) | Done |
| A2A Protocol (Messaging) | Done |
| EVM Bridge (Base) | Done |
| OWS Wallet Integration | Done |
| Social Platform | Done |
| Mainnet Launch | Q2 2026 |
| Token Launch | Q3 2026 |

---

## Slide 10: Team & Ask

**Team**: [Your team info]

**Ask**:
- OWS ecosystem partnership
- Integration with MoonPay/PayPal via OWS
- Feedback on reputation credential standard

**Links**:
- GitHub: [repo link]
- Website: gradiences.xyz
- X: @gradience_
