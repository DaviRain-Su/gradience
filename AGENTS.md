# Agent Instructions

> Read by: OpenAI Codex, OpenCode, Amp (Sourcegraph), and other AGENTS.md-compatible tools.

## Mandatory Development Lifecycle

This project enforces a strict **7-phase development lifecycle**.
No phase may be skipped. No code without a Technical Spec.

**Full specification:** [docs/methodology/README.md](docs/methodology/README.md)
**Templates:** `docs/methodology/templates/`

### The 7 Phases

```
1. PRD → 2. Architecture → 3. Technical Spec → 4. Task Breakdown
→ 5. Test Spec → 6. Implementation → 7. Review & Deploy
```

### Key Rules

1. No code without a Technical Spec (Phase 3). Create it first.
2. No implementation without tests (Phase 5). Write test skeletons before code.
3. Code must match the Technical Spec exactly. Spec wrong? Fix spec first.
4. All phase docs go in `<project>/docs/01-prd.md` through `07-review-report.md`.
