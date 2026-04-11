# Agent Instructions

> Read by: OpenAI Codex, OpenCode, Amp (Sourcegraph), and other AGENTS.md-compatible tools.

---

## ⚠️ IMPORTANT: Task System Migration

**Tasks are now managed in Obsidian, NOT Linear.**

**Quick Start:**

```bash
./scripts/task.sh list todo P0     # Get your tasks
./scripts/task.sh show GRA-64      # View task details
./scripts/task.sh update GRA-64 done  # Mark complete
```

**Full Guide:** [docs/OBSIDIAN-GUIDE-FOR-AGENTS.md](OBSIDIAN-GUIDE-FOR-AGENTS.md)

---

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

### Fractal Application

The methodology applies at **every level of granularity**:

- **Project level**: the whole Gradience protocol goes through all 7 phases
- **Module level**: each sub-module (indexer, judge-daemon, SDK, CLI, etc.) also goes through its own 7 phases independently
- **Phase 1/2 of a sub-module** can reference the project-level PRD/Architecture docs — no need to rewrite
- **Phase 3 (Technical Spec) must always be written fresh** for each sub-module — this is non-negotiable

When starting any new sub-module, always check which phases are already documented before writing code.

---

## Task Management (Obsidian CLI)

Tasks are managed in Obsidian vault at `docs/tasks/`

> **Migration Notice**: We've migrated from Linear to Obsidian CLI for better local control and knowledge management.

### Prerequisites

Ensure you have:

- Obsidian installed with CLI enabled
- `scripts/task.sh` is executable

### Quick Start

```bash
# View statistics
./scripts/task.sh stats

# List tasks
./scripts/task.sh list                    # All tasks
./scripts/task.sh list todo               # Todo tasks
./scripts/task.sh list todo P0            # P0 todo tasks
./scripts/task.sh list all P0 "AgentM"    # Filter by project

# Get next task to work on
./scripts/task.sh list todo | head -5
```

### Working on Tasks

```bash
# View task details
./scripts/task.sh show GRA-64

# Start working on task
./scripts/task.sh update GRA-64 in-progress --open

# Mark as done
./scripts/task.sh update GRA-64 done
```

### Creating Tasks

```bash
# Create new task
./scripts/task.sh create "Fix critical bug" P0 "AgentM Web"

# This will:
# 1. Generate next ID (e.g., GRA-119)
# 2. Create markdown file from template
# 3. Open in Obsidian
```

### Task File Format

Tasks are Markdown files with YAML frontmatter:

```markdown
---
linear-id: GRA-64
title: '[Indexer] Design Profile API specification'
status: in-progress
priority: P0
project: 'Chain Hub Indexer'
created: 2026-04-03
migrated-from: 'Linear'
assignee: 'Code Agent'
tags: [task, p0, chain-hub-indexer]
---

# GRA-64: [Indexer] Design Profile API specification

## Description

Design Indexer Profile API specification
...

## Acceptance Criteria

- [ ] Research complete
- [ ] API design documented
- [ ] Review passed

## Related

- [[GRA-65]] Next task
- [[docs/03-technical-spec]] Reference

## Notes

## Log

- 2026-04-03: Migrated from Linear
- 2026-04-03: Status changed to "in-progress"
```

### Task Execution Workflow

```
1. Get task from Obsidian
   ./scripts/task.sh list todo P0 | head -1

2. Read corresponding 7-Phase docs
   open docs/<project>/03-technical-spec.md

3. Implement following Technical Spec exactly

4. Write/run tests per Phase 5 Test Spec

5. Update task status
   ./scripts/task.sh update <id> done

6. Commit with reference
   git commit -m "feat: implement feature (GRA-XX)"
```

### Project Mapping

| Project                  | Path                    | Docs                         | Tasks                               |
| ------------------------ | ----------------------- | ---------------------------- | ----------------------------------- |
| **AgentM Web** (Unified) | `apps/agentm-web/`      | `apps/agentm-web/docs/`      | docs/tasks/GRA-30\*.md, GRA-125-128 |
| Agent Arena              | `apps/agent-arena/`     | `apps/agent-arena/docs/`     | docs/tasks/GRA-33\*.md              |
| ~~Agent Layer EVM~~      | *removed*               | *Solana-only core protocol*  | docs/tasks/archive/GRA-39\*.md      |
| Chain Hub                | `apps/chain-hub/`       | `apps/chain-hub/docs/`       | docs/tasks/GRA-4*.md, GRA-8*.md     |
| A2A Protocol             | `apps/a2a-protocol/`    | `apps/a2a-protocol/docs/`    | docs/tasks/GRA-47\*.md              |
| OWS Hackathon            | -                       | `docs/hackathon/`            | docs/tasks/GRA-56\*.md              |

> **Archived Projects** (2026-04-05):
>
> - `AgentM (Electron)` → `archive/agentm-electron-20260405/`
> - `AgentM Pro` → merged into AgentM Web → `archive/agentm-pro-20260405/`
> - `AgentM Core` → migrated to `programs/agentm-core/` + `packages/agentm-sdk/`

---

## Development Guidelines

### Before Starting

1. Check Obsidian for assigned tasks

    ```bash
    ./scripts/task.sh list todo P0
    ```

2. Read Phase 3 Technical Spec completely

    ```bash
    open docs/<project>/03-technical-spec.md
    ```

3. Verify environment setup per `06-implementation.md`

### During Development

1. Follow spec exactly — if spec is wrong, fix spec first
2. Write tests before implementation (TDD)
3. Commit frequently with meaningful messages
4. Reference task ID in commits: `GRA-XX: description`

### Before Submitting

1. All tests pass: `npm test` or equivalent
2. Build succeeds: `npm run build`
3. Type checks pass: `npm run typecheck`
4. Update Phase 6 Implementation Log
5. Update task status: `./scripts/task.sh update GRA-XX done`

---

## Emergency Contacts

- **P0 Blockers**: Fix immediately, notify team
- **Spec Ambiguity**: Update spec, don't guess
- **API Issues**: Check `docs/experience-reports/` first

---

## Migration Notes (From Linear)

All 118 tasks have been migrated from Linear to Obsidian:

- Original Linear IDs preserved (GRA-1 to GRA-118)
- Status, priority, and project data migrated
- Task files are now in `docs/tasks/`
- Use `./scripts/task.sh` instead of Linear API

For historical reference, old Linear data is preserved in task frontmatter under `migrated-from: "Linear"`.
