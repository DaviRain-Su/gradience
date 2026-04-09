---
linear-id: GRA-M6
title: '[Evaluator] Design Off-Chain Evaluator Runtime'
status: done
priority: P0
project: 'Mid-Term Integration'
created: 2026-04-04
assignee: 'Code Agent'
tags: [task, p0, mid-term, evaluator, harness]
---

# GRA-M6: [Evaluator] Design Off-Chain Evaluator Runtime

## Description

Design independent Evaluator runtime for long-running task evaluation.

Inspired by Anthropic's approach: Evaluator is independent from Generator, with no shared state.

## Key Principles

1. **Independence**: Evaluator has no access to Generator's internal state
2. **Verification**: Actual execution verification (Playwright, sandbox)
3. **Drift Detection**: Monitor for context window drift
4. **Cost Control**: Budget and time limits per evaluation

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Evaluator Runtime                     │
├─────────────────────────────────────────────────────────┤
│  Input: Task definition + Agent submission               │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │   Sandbox    │───→│  Playwright  │───→│  Scorer  │  │
│  │   (Docker)   │    │  Verification│    │  (LLM)   │  │
│  └──────────────┘    └──────────────┘    └────┬─────┘  │
│                                                │        │
│  ┌─────────────────────────────────────────────┘        │
│  │  Drift Detection (context window monitoring)         │
│  │  Reset Strategy: sprint-boundary                     │
│  └──────────────────────────────────────────────────────┘
│                                                          │
│  Output: Score (0-100) + Verification proof              │
└─────────────────────────────────────────────────────────┘
```

## Evaluation Types

| Type    | Method                      | Use Case             |
| ------- | --------------------------- | -------------------- |
| Code    | Test execution + coverage   | Workflow functions   |
| UI      | Playwright screenshots      | Frontend tasks       |
| API     | Request/response validation | Service integrations |
| Content | LLM-as-judge                | Creative tasks       |

## Acceptance Criteria

- [ ] Evaluator runtime architecture document
- [ ] Sandbox isolation design (Docker/git-worktree)
- [ ] Playwright integration plan
- [ ] Scoring rubric framework
- [ ] Drift detection mechanism
- [ ] Cost budgeting system

## Dependencies

- Agent Daemon (for task execution)
- Workflow Engine schema

## Related

- GRA-M7: Playwright verification harness
- GRA-M8: Evaluator → Chain Hub bridge

## Log

- 2026-04-04: Created as part of mid-term integration planning
