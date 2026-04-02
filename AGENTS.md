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

---

## Linear Task Management

Tasks are managed in Linear: https://linear.app/gradiences

### Prerequisites

Ensure `LINEAR_API_KEY` is configured in your environment:
```bash
# ~/.bashrc or ~/.zshrc
export LINEAR_API_KEY="lin_api_..."
```

### Getting Assigned Tasks

**1. Fetch pending tasks:**
```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ issues(first: 10, filter: { state: { type: { in: [\"unstarted\", \"started\"] } } }) { nodes { identifier title description priority project { name } } } }"}' \
  | python3 -m json.tool
```

**2. View specific issue:**
```bash
# Replace GRA-XX with the issue number
curl -s -X POST https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ issues(filter: { identifier: { eq: \"GRA-9\" } }) { nodes { identifier title description state { name } } } }"}' \
  | python3 -m json.tool
```

**3. Update issue status (when done):**
```bash
# First get the state IDs
curl -s -X POST https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ workflowStates(first: 10) { nodes { id name type } } }"}'

# Then update (replace $ISSUE_ID and $DONE_STATE_ID)
# curl -s -X POST ... -d '{"query": "mutation { issueUpdate(id: \"$ISSUE_ID\", input: { stateId: \"$DONE_STATE_ID\" }) { success } }"}'
```

### Task Execution Workflow

```
1. Get task from Linear (highest priority first)
2. Read corresponding 7-Phase docs in <project>/docs/
3. Implement following Technical Spec exactly
4. Write/run tests per Phase 5 Test Spec
5. Update Linear issue status to "In Progress" → "Done"
6. Commit with reference: "fixes GRA-XX"
```

### Project Mapping

| Project | Path | Docs |
|---------|------|------|
| AgentM Pro | `apps/agentm-pro/` | `apps/agentm-pro/docs/` |
| AgentM Web | `apps/agentm-web/` | - |
| Agent Arena | `apps/agent-arena/` | `apps/agent-arena/docs/` |
| Agent Layer EVM | `apps/agent-layer-evm/` | `apps/agent-layer-evm/docs/` |
| Chain Hub | `apps/chain-hub/` | `apps/chain-hub/docs/` |
| A2A Protocol | `apps/a2a-protocol/` | `apps/a2a-protocol/docs/` |

---

## Development Guidelines

### Before Starting

1. Check Linear for assigned tasks
2. Read Phase 3 Technical Spec completely
3. Verify environment setup per `06-implementation.md`

### During Development

1. Follow spec exactly — if spec is wrong, fix spec first
2. Write tests before implementation (TDD)
3. Commit frequently with meaningful messages
4. Reference Linear issue ID in commits: `GRA-XX: description`

### Before Submitting

1. All tests pass: `npm test` or equivalent
2. Build succeeds: `npm run build`
3. Type checks pass: `npm run typecheck`
4. Update Phase 6 Implementation Log
5. Update Linear issue status

---

## Emergency Contacts

- **P0 Blockers**: Fix immediately, notify team
- **Spec Ambiguity**: Update spec, don't guess
- **API Issues**: Check `docs/experience-reports/` first
