# Claude Code Instructions for Gradience

## ⚠️ Mandatory: Read Before Any Work

This project enforces a strict 7-phase development lifecycle.
**You MUST follow it. No exceptions.**

→ Read: `docs/methodology/README.md`
→ Templates: `docs/methodology/templates/`

## The Rule

**If someone asks you to write code and there is no Technical Spec (`03-technical-spec.md`) for that component:**
1. Stop.
2. Check if Phase 1 (PRD) and Phase 2 (Architecture) exist.
3. If not, create them using the templates.
4. Create the Technical Spec (Phase 3) — this is the most important document.
5. Create the Test Spec (Phase 5).
6. Only THEN write implementation code.

## Project Context

- This is the **Gradience Protocol** — a peer-to-peer capability settlement protocol for AI Agents
- Core: `protocol/WHITEPAPER.md` (read for full context)
- Architecture: `protocol/design/` (system architecture, security, A2A)
- The protocol kernel is ~300 lines: Escrow + Judge + Reputation
- Built on Solana (Anchor/Rust)

## Key References

| What | Where |
|------|-------|
| Development lifecycle | `docs/methodology/README.md` |
| Whitepaper | `protocol/WHITEPAPER.md` |
| Security architecture | `protocol/design/security-architecture.md` |
| A2A protocol spec | `protocol/design/a2a-protocol-spec.md` |
| System architecture | `protocol/design/system-architecture.md` |
| Bitcoin philosophy | `protocol/protocol-bitcoin-philosophy.md` |
