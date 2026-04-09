# Code Refactoring Tasks

> Created: 2026-04-05
> Status: In Progress

## Overview

This document tracks the modularization of large monolithic files in the Gradience codebase to improve maintainability, testability, and developer experience.

---

## Completed ✅

### 1. Indexer main.rs (1434 lines)

**Status:** ✅ Complete

**Refactoring:**

- Extracted `mappers.rs` - Data mapping functions (map_task, map_submission, etc.)
- Extracted `utils.rs` - Helper functions (parsing, validation, formatting)
- Updated `main.rs` to delegate to new modules

**Result:** Reduced main.rs complexity by ~150 lines

---

### 2. MPP Handler (823 lines)

**Status:** ✅ Complete

**Location:** `apps/agent-daemon/src/payments/mpp-handler.ts`

**Refactoring:**

- Created `mpp/types.ts` - All MPP type definitions
- Created `mpp/payment-manager.ts` - Payment creation and escrow
- Created `mpp/voting.ts` - Voting and milestone management
- Created `mpp/refund.ts` - Fund releases and refunds
- Created `mpp/index.ts` - Unified exports
- Updated `mpp-handler.ts` as backward-compatible wrapper

---

### 3. Revenue Distribution (596 lines)

**Status:** ✅ Complete

**Location:** `apps/agent-daemon/src/revenue/distribution.ts`

**Refactoring:**

- Created `distribution/types.ts` - Type definitions
- Created `distribution/builder.ts` - Instruction building
- Created `distribution/cpi-caller.ts` - CPI execution
- Created `distribution/validator.ts` - Transaction validation
- Created `distribution/index.ts` - Unified exports
- Updated `distribution.ts` as backward-compatible wrapper

**Distribution Model:** 95% Agent / 3% Judge / 2% Protocol

---

### 4. App Page (2683 lines) - Partial

**Status:** 🔄 Partially Complete

**Location:** `apps/agentm-web/src/app/app/page.tsx`

**Completed:**

- ✅ Created `types.ts` - Centralized type definitions
- ✅ Created `constants.ts` - App constants
- ✅ Created `utils.ts` - Helper functions
- ✅ Created `hooks/useIndexerStatus.ts` - Indexer connection hook
- ✅ Created `components/LoginScreen.tsx` - Login UI component

**Remaining:**

- ⏳ Extract `Shell` component
- ⏳ Extract `DiscoverView` component
- ⏳ Extract `MeView` component
- ⏳ Extract `SettingsView` component
- ⏳ Extract `TaskMarketView` component
- ⏳ Extract other view components

---

## P1 Priority Tasks 🔥

### 5. TypeScript SDK (1559 lines)

**Status:** ✅ Complete

**Location:** `apps/agent-arena/clients/typescript/src/sdk.ts`

**Refactoring:**

- Created `types.ts` - All SDK type definitions
- Created `resources/tasks.ts` - Task management methods
- Created `resources/reputation.ts` - Reputation queries
- Created `resources/judge-pool.ts` - Judge pool operations
- Created `resources/profile.ts` - Agent profiles
- Created `resources/attestations.ts` - Attestations
- Created `resources/config.ts` - Program config
- Created `resources/index.ts` - Unified exports
- Updated `sdk.ts` as backward-compatible wrapper

**Result:** Reduced sdk.ts from 1559 lines to ~300 lines

---

### 6. CLI Tool (1329 lines)

**Status:** ✅ Complete

**Location:** `apps/agent-arena/cli/gradience.ts`

**Refactoring:**

- Created `types.ts` - CLI type definitions
- Created `commands/task.ts` - Task commands (post, apply, submit, etc.)
- Created `commands/judge.ts` - Judge commands (register, unstake)
- Created `commands/profile.ts` - Profile commands (show, update, publish)
- Created `utils/config.ts` - Config management
- Created `utils/sdk.ts` - SDK utilities
- Created `utils/output.ts` - Output formatting
- Created `commands/index.ts` and `utils/index.ts` - Unified exports
- Simplified `gradience.ts` as entry point

**Result:** Reduced gradience.ts from 1329 lines to ~20 lines

---

### 7. Indexer Worker (1322 lines)

**Status:** ✅ Complete

**Location:** `apps/agent-arena/indexer/worker/src/index.ts`

**Refactoring:**

- Created `types.ts` - All type definitions
- Created `handlers/events.ts` - Event processing
- Created `handlers/api.ts` - API route handlers
- Created `handlers/webhook.ts` - Webhook processing
- Created `db/operations.ts` - Database operations
- Created `utils/index.ts` - Utility functions
- Created `handlers/index.ts` and `db/index.ts` - Unified exports
- Simplified `index.ts` as main entry point

**Result:** Reduced index.ts from 1322 lines to ~100 lines

---

### 8. Chain Hub Indexer (879 lines)

**Status:** ✅ Complete

**Location:** `apps/chain-hub/indexer-service/src/main.rs`

**Refactoring:**

- Created `handlers.rs` - HTTP API handlers
- Extracted: health, metrics, skills, protocols, royalties, invocations
- Updated `main.rs` to use handlers module

**Result:** Reduced main.rs from 879 lines to 605 lines

---

---

## P2 Priority Tasks 📋

### 9. Reputation Dashboard (959 lines)

**Status:** ⏳ Pending

**Location:** `apps/agentm-web/src/components/wallet/ReputationDashboard.tsx`

**Analysis:**

- Large React component with multiple sections
- Likely contains: stats, charts, history, actions

**Proposed Refactoring:**

```
components/wallet/
├── ReputationDashboard.tsx (container)
├── reputation/
│   ├── StatsSection.tsx
│   ├── ChartSection.tsx
│   ├── HistoryTable.tsx
│   ├── ActionButtons.tsx
│   └── hooks.ts
└── index.ts
```

**Estimated Reduction:** 959 → ~150 lines (main) + 4×150 lines (components)

---

### 10. Trading Handler (977 lines)

**Status:** ⏳ Pending

**Location:** `packages/workflow-engine/src/handlers/trading-real.ts`

**Analysis:**

- Trading workflow handler
- Likely contains: order logic, risk management, position tracking

**Proposed Refactoring:**

```
handlers/trading/
├── index.ts (re-export)
├── trading-real.ts (simplified)
├── order-manager.ts
├── risk-manager.ts
├── position-tracker.ts
└── types.ts
```

**Estimated Reduction:** 977 → ~200 lines (main) + 3×200 lines (modules)

---

### 11. Judge Daemon Interop (893 lines)

**Status:** ⏳ Pending

**Location:** `apps/agent-arena/judge-daemon/src/interop.ts`

**Analysis:**

- Interoperability layer for judge daemon
- Likely contains: protocol adapters, data transformers

**Proposed Refactoring:**

```
judge-daemon/src/interop/
├── index.ts (re-export)
├── interop.ts (simplified)
├── adapters/
│   ├── chain-hub.ts
│   ├── agent-arena.ts
│   └── common.ts
└── transformers.ts
```

**Estimated Reduction:** 893 → ~200 lines (main) + 3×150 lines (modules)

---

## P3 Priority Tasks 📎

### 12. Soul Page (820 lines)

**Status:** ⏳ Pending

**Location:** `apps/agentm-web/src/app/soul/page.tsx`

**Similar to:** page.tsx refactoring pattern

---

### 13. Evaluator Runtime (859 lines)

**Status:** ⏳ Pending

**Location:** `apps/agent-daemon/src/evaluator/runtime.ts`

---

### 14. OWS Wallet Manager (800 lines)

**Status:** ⏳ Pending

**Location:** `apps/agent-daemon/src/wallet/ows-wallet-manager.ts`

---

## Guidelines

### Refactoring Principles

1. **Backward Compatibility:** Always maintain backward compatibility
2. **Incremental:** Refactor one module at a time
3. **Test Coverage:** Ensure tests pass after each change
4. **Documentation:** Update imports and exports

### Module Structure Pattern

```
module/
├── index.ts          # Unified exports
├── types.ts          # Type definitions
├── constants.ts      # Constants
├── utils.ts          # Helper functions
├── [feature].ts      # Main feature module
└── [feature]/        # Sub-modules (if needed)
    ├── index.ts
    └── ...
```

### Commit Message Format

```
refactor(scope): split [file] into modular structure

- Create [module]/types.ts
- Create [module]/[feature].ts
- Update [file] as backward-compatible wrapper

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>
```

---

## Progress Tracking

| Priority | File                | Lines | Status | Notes                                     |
| -------- | ------------------- | ----- | ------ | ----------------------------------------- |
| -        | indexer/main.rs     | 1434  | ✅     | mappers.rs, utils.rs                      |
| -        | mpp-handler.ts      | 823   | ✅     | mpp/ directory                            |
| -        | distribution.ts     | 596   | ✅     | distribution/ directory                   |
| -        | page.tsx            | 2683  | 🔄     | types, constants, utils, LoginScreen done |
| P1       | sdk.ts              | 1559  | ⏳     | TypeScript SDK                            |
| P1       | gradience.ts        | 1329  | ⏳     | CLI tool                                  |
| P1       | indexer/worker      | 1322  | ⏳     | Worker handlers                           |
| P1       | chain-hub/main.rs   | 879   | ⏳     | Rust indexer                              |
| P2       | ReputationDashboard | 959   | ⏳     | React component                           |
| P2       | trading-real.ts     | 977   | ⏳     | Trading handler                           |
| P2       | interop.ts          | 893   | ⏳     | Judge daemon                              |
| P3       | soul/page.tsx       | 820   | ⏳     | Web page                                  |
| P3       | runtime.ts          | 859   | ⏳     | Evaluator                                 |
| P3       | ows-wallet-manager  | 800   | ⏳     | Wallet manager                            |

---

## Next Actions

1. **Start P1 tasks** in order:
    - sdk.ts (highest impact - client SDK)
    - gradience.ts (CLI usability)
    - indexer/worker (consistency with main indexer)
    - chain-hub/main.rs (Rust pattern consistency)

2. **Continue page.tsx** extraction:
    - Shell component
    - View components

3. **Move to P2** after P1 complete

---

_Last Updated: 2026-04-05_
