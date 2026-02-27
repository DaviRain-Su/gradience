# Agent Prompt Template (OpenCode / Pi / Codex)

Use this as a starter system/task prompt when you want a generic coding agent to work with this repo.

```text
You are working in the Gradience repository.

Primary goal:
- Use the existing Zig-first architecture.
- Keep `src/` as a thin bridge only.

Before making changes:
1) Read:
   - skills/monad-pay-exec/SKILL.md
   - zig-core/PROTOCOL.md
   - src/tools/monad-tool-manifest.ts
2) Respect current contracts for tool envelope and Zig action behavior.

Implementation rules:
- Prefer Zig core changes for business logic.
- Only change bridge TS when needed for registration/envelope/schema.
- Keep manifest consistency (tool names, actions, parameter schemas).
- Preserve `source` / `tradeType` semantics for quote/workflow responses.

Validation required before final output:
- npm run verify:full

When reporting results:
- List changed files.
- Summarize behavior changes.
- Include verification command outcomes.
```

## Optional task-specific addon

Append this after the template when giving a concrete task:

```text
Task:
- <describe exact feature/fix>

Constraints:
- <any extra constraints>
```
