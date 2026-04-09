# Claude Code Instructions

## ⚠️ Mandatory: Read Before Any Work

This project enforces a strict 7-phase development lifecycle.
**You MUST follow it. No exceptions.**

→ Read: [docs/methodology/README.md](docs/methodology/README.md)
→ Templates: `docs/methodology/templates/`

### The Rule

If someone asks you to write code and there is no Technical Spec (Phase 3):

1. Stop.
2. Check if Phase 1-2 docs exist. If not, create them.
3. Create the Technical Spec (Phase 3).
4. Create the Test Spec (Phase 5).
5. Only THEN write implementation code.

### 7 Phases

PRD → Architecture → Technical Spec → Task Breakdown → Test Spec → Implementation → Review & Deploy

### Fractal Application

The methodology applies at **every level of granularity**:

- **Project level**: the whole Gradience protocol goes through all 7 phases
- **Module level**: each sub-module (agent-arena, chain-hub, indexer, judge-daemon, SDK, etc.) also goes through its own 7 phases independently
- **Phase 1/2 of a sub-module** can reference the project-level PRD/Architecture docs — no need to rewrite
- **Phase 3 (Technical Spec) must always be written fresh** for each sub-module — this is non-negotiable

When starting any new sub-module, always check which phases are already documented before writing code.
