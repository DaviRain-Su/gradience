# Exec CLI Output Schema

This document defines machine-readable output contracts for `apps/exec-cli.ts`.

## Versioning

- `schemaVersion`: currently `"1"`
- Present on `summary`, `txrequest`, and `error` outputs
- Also present in `help` (`status=usage`) output for tooling discovery
- Consumers should reject unknown schema versions for strict parsing

## Output Modes

## `full`

- Raw command payload
- Shape depends on command/flow
- No schema contract guarantees beyond `status`

## `summary`

Normalized shape for automation.

Common fields:

- `schemaVersion`: `"1"`
- `status`: usually `"ok"`
- `commandType`: `execution | flow | observer`
- `resourceType`: stable command/flow classifier

By command type:

- `execution`: includes `action`, `dryRun` (for dry-run), and optional `executionId`/`txHash`
- `flow`: includes `flow` and `flowSummary.steps`
- `observer`: includes `action`, `receiptStatus`, and timing fields when applicable

Flow step fields (`flowSummary.steps[*]`):

- `step`: logical step name
- `kind`: canonical enum `approve | swap | deposit | withdraw | exit`
- `label`: human-friendly label
- `order`: stable numeric order for strict sorting
- optional: `skipped`, `dryRun`, `executionId`, `txHash`, `receiptStatus`, `watchStatus`

## `txrequest`

Extracted transaction-request focused output.

Fields:

- `schemaVersion`: `"1"`
- `status`
- optional: `action`, `flow`, `dryRun`
- `source`: `single | steps | nested`
- `txRequest`: shape depends on `source`

`source` semantics:

- `single`: one direct txRequest object
- `steps`: array of `{ action, txRequest }` (typically flow dry-run)
- `nested`: array of extracted nested txRequests from flow/result objects

Observer limitation:

- `receipt`/`watch` do not support `--output txrequest`
- returns `status=error` with message explaining missing txRequest payload

## Error Output

Standard error envelope:

- `status`: `"error"`
- `schemaVersion`: `"1"`
- `errorType`: `"exec-cli"`
- `message`: error detail

## Resource Type Reference

Common mappings in `summary` mode:

- `native-transfer` dry-run -> `native-transfer`
- `erc20-approve` dry-run -> `approve`
- `tx-request` dry-run -> `txrequest`
- `morpho-vault-deposit` dry-run -> `vault-deposit`
- `receipt` -> `receipt`
- `watch` -> `watch`
- flow summaries -> same as flow id (`swap-flow`, `vault-flow`, `withdraw-swap-flow`, `vault-exit-flow`)
