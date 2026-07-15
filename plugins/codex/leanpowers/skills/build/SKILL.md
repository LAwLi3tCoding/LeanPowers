---
name: build
description: Use when a software change has an executable scope and needs implementation, including features, refactors, configuration changes, documentation changes, or a known-cause defect with defined acceptance evidence.
---

# Build

Implement one delivery slice at a time and keep the feedback loop proportional to its risk. Correctness comes from early evidence, not end-loaded testing.

Inherit the ledger. Routed entry makes the route capsule sole tool-order/budget authority; this Skill adds acceptance reasoning/output only. Without a ledger, read the [runtime contract](../../references/runtime-contract.md) once and use the direct-entry loop.

If project learning is enabled, use `adapt` to query once at entry under the [learning policy](../../references/learning-policy.md) with this workflow, relevant paths, and tags; add at most three behavior-changing advisory rules to the task brief. Send explicit downstream outcome, correction, confirmation, or durable-preference feedback to `adapt`.

## Entry contract

Start only when goal, declared scope, acceptance evidence, and constraints are executable. If they are materially unclear, use `shape`. If the cause of a failure is unknown, use `debug`.

## Direct-entry slice loop

1. Batch-inspect the affected implementation and existing tests. Before editing, extract literal `must`, `only`, `exact`, `preserve`, and `reject` clauses plus their positive/negative boundaries. Preserve unrelated user changes.
2. Choose the smallest slice that produces an independently useful outcome.
3. Establish the pre-change signal:
   - Behavior or defect: write a focused test and observe the expected failure when practical.
   - Configuration or generated output: define and run the relevant validation or snapshot check.
   - Documentation: define link, example, structure, or rendering checks.
4. Implement the minimum change that satisfies the slice.
5. Run targeted validation immediately and inspect its output.
6. Before completion, map every claim to current targeted evidence plus affected integration, lint, typecheck, static, package, or full-suite checks when applicable. A failure or material validation gap blocks `complete`.
7. Remove only duplication or debris introduced by the slice while evidence remains green.
8. Record changed files, supported claims, and residual risk before the next slice.

Do not write all implementation first and add tests at the end. Do not create a child agent for each file. Delegate only independent, verifiable delivery boundaries without shared-write conflict.

## Output

```yaml
status: complete | blocked | needs_debug | needs_review
risk: lean | standard | strict
slices:
  - outcome: delivered behavior
    files: changed paths
    evidence: command and result
residual_risks: remaining uncertainty
next: verify | review | debug | null
```

## Escalation

- New unknown failure: transition to `debug`.
- Material scope expansion: transition to `shape`.
- Strict completion always sets `next: review`; this rule wins over every ordinary completion path.
- Lean or standard completion with current applicable evidence sets `next: null` and may finish in this workflow.
- Use `verify` only for explicit verification, stale or cross-session evidence, requested delivery, or a cross-artifact/runtime claim.

## Common mistakes

- Splitting work by file, setup step, or arbitrary time box.
- Accepting a passing test that was never observed to fail for the missing behavior.
- Running a full suite after every small edit while skipping targeted feedback.
- Trusting child-agent completion without inspecting the shared diff and evidence.
- Adding abstractions, compatibility layers, or dependencies outside the declared scope.
