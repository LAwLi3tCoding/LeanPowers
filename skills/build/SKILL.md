---
name: build
description: Use when a software change has an executable scope and needs implementation, including features, refactors, configuration changes, documentation changes, or a known-cause defect with defined acceptance evidence.
---

# Build

Implement one delivery slice at a time and keep the feedback loop proportional to its risk. Correctness comes from early evidence, not end-loaded testing.

Read [risk policy](../_shared/risk-policy.md), [quality gates](../_shared/quality-gates.md), [subagent policy](../_shared/subagent-policy.md), and [workflow transitions](../_shared/workflow-transitions.md).

## Entry contract

Start only when goal, declared scope, acceptance evidence, and constraints are executable. If they are materially unclear, use `shape`. If the cause of a failure is unknown, use `debug`.

## Slice loop

1. Inspect the affected implementation and existing tests. Preserve unrelated user changes.
2. Choose the smallest slice that produces an independently useful outcome.
3. Establish the pre-change signal:
   - Behavior or defect: write a focused test and observe the expected failure when practical.
   - Configuration or generated output: define and run the relevant validation or snapshot check.
   - Documentation: define link, example, structure, or rendering checks.
4. Implement the minimum change that satisfies the slice.
5. Run targeted validation immediately and inspect its output.
6. Remove only duplication or debris introduced by the slice while evidence remains green.
7. Record changed files, supported claims, and residual risk before the next slice.

Do not write all implementation first and add tests at the end. Do not create a child agent for each file. Delegate only independent delivery boundaries under the [subagent policy](../_shared/subagent-policy.md).

## Output

```yaml
status: complete | blocked | needs_debug | needs_review
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
- High-risk or broad completed change: transition to `review`.
- Implemented requested scope: transition to `verify`.

## Common mistakes

- Splitting work by file, setup step, or arbitrary time box.
- Accepting a passing test that was never observed to fail for the missing behavior.
- Running a full suite after every small edit while skipping targeted feedback.
- Trusting child-agent completion without inspecting the shared diff and evidence.
- Adding abstractions, compatibility layers, or dependencies outside the declared scope.
