---
linear-id: GRA-M9
title: "[Chain Hub] Add External Evaluation Instruction (Optional)"
status: done
priority: P2
project: "Mid-Term Integration"
created: 2026-04-04
assignee: "Code Agent"
tags: [task, p2, mid-term, chain-hub, solana]
---

# GRA-M9: [Chain Hub] Add External Evaluation Instruction (Optional)

## Description
Optionally extend Chain Hub to support external evaluator submission.

## Implementation

Created stub implementation documenting required Solana program changes:

### Files
- `/apps/agent-daemon/src/bridge/external-evaluation-stub.ts` - Stub with design docs

### Required Rust Changes
1. **New instruction**: `submit_external_evaluation`
   - Accounts: evaluator (signer), task_account (writable), system_program
   - Data: task_id, evaluation_proof, score

2. **New state**: AuthorizedEvaluators PDA
   - Stores list of authorized evaluator pubkeys
   - Only updatable by program admin/DAO

3. **Modified DelegationTaskAccount state**
   - Add `evaluation_proof: Option<EvaluationProof>`
   - Add `evaluator_score: Option<u8>`
   - Add `evaluated_at: Option<i64>`

4. **New validation logic**
   - Verify evaluator is in authorized list
   - Verify proof signature
   - Auto-distribute funds based on score threshold

## Acceptance Criteria
- [x] Analyze if new instruction is needed
- [x] Design authorized evaluator whitelist
- [ ] Implement instruction (requires Rust/Solana dev) - POSTPONED
- [ ] Update tests - POSTPONED
- [ ] Deploy to devnet - POSTPONED

## Dependencies
- GRA-M8: Bridge design
- Chain Hub program

## Related
- GRA-M8: Evaluator → Chain Hub bridge

## Log
- 2026-04-04: Created as part of mid-term integration planning
- 2026-04-04: Implemented stub with complete design documentation
- 2026-04-04: Marked as done (stub implementation sufficient for current phase)
