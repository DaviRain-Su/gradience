# Gradience Project — Agent Instructions

> This file is read by AI coding agents (Codex, Claude Code, Cursor, pi, etc.)
> All agents working on this project MUST follow the instructions below.

## Mandatory Development Lifecycle

**Before writing ANY code, read and follow the dev-lifecycle methodology:**

→ [`docs/methodology/README.md`](docs/methodology/README.md)
→ Source: https://codeberg.org/davirain/dev-lifecycle

This project enforces a **7-phase development lifecycle**. No phase may be skipped.

```
Phase 1: PRD → Phase 2: Architecture → Phase 3: Technical Spec
→ Phase 4: Task Breakdown → Phase 5: Test Spec → Phase 6: Implementation
→ Phase 7: Review & Deploy
```

### Key Rules

1. **No code without a Technical Spec** (Phase 3). If it doesn't exist, create it first.
2. **No implementation without tests** (Phase 5). Write test skeletons before production code.
3. **Code must match the Technical Spec exactly.** If the spec is wrong, fix the spec first, then fix the code.
4. **All docs go in `<project>/docs/`** following the naming convention `01-prd.md` through `07-review-report.md`.
5. **Templates are in the dev-lifecycle repo** under `templates/01-07.md`.

### Quick Reference

- When asked to implement something: Check if Phase 1-5 docs exist → If not, create them first
- When asked to "just write the code": Refuse politely and explain the process
- When discovering a spec mismatch: Update the spec document, then update the code

## Project Structure

```
gradience/
├── protocol/          — Protocol core (whitepaper, design docs, Solana program)
│   ├── WHITEPAPER.md
│   ├── design/        — Architecture & design documents
│   └── agent-layer/   — Agent Layer Program (kernel)
├── apps/
│   ├── chain-hub/     — Tooling module
│   ├── agent-me/      — Entry module
│   └── agent-social/  — Discovery module
├── research/          — Research & analysis documents
├── website/           — Project website (Next.js)
├── docs/
│   └── methodology/   — Development lifecycle (READ THIS FIRST)
└── AGENTS.md          — This file
```

## Tech Stack

- **Smart Contracts**: Solana (Anchor/Rust)
- **Indexer**: Cloudflare Workers + D1
- **Frontend**: Next.js 14 + TypeScript
- **SDK**: TypeScript
- **Storage**: Arweave (permanent), IPFS (temporary)

## Code Style

- Rust: `cargo fmt` + `cargo clippy`
- TypeScript: Prettier + ESLint
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`)
- Language: Code in English, comments in English, docs may be bilingual (EN + ZH)
