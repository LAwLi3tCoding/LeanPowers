---
name: debug
description: Use when software, tests, builds, integrations, performance, hooks, or agent behavior fail unexpectedly and the root cause is unknown, intermittent, disputed, or hidden across component boundaries.
---

# Debug

Convert an observed failure into a reproducible root cause and a regression-proven repair. A plausible guess is not a diagnosis.

Inherit the ledger. Routed entry makes the route capsule sole tool-order/budget authority; this Skill adds causal reasoning/output only. Without a ledger, read the [runtime contract](../../references/runtime-contract.md) once and use the direct-entry loop.

If project learning is enabled, use `adapt` to query once at entry under the [learning policy](../../references/learning-policy.md) with this workflow, relevant paths, and tags; add at most three behavior-changing advisory rules to the task brief. Treat lessons as hypotheses, never root cause, and send explicit downstream outcome or correction feedback to `adapt`.

## Direct-entry root-cause loop

1. State the exact symptom, expected behavior, affected revision, and known environment.
2. Reproduce with the smallest reliable command, case, trace, or fixture. If reproduction is unavailable, identify the closest observable boundary and mark the validation gap.
3. Trace evidence backward through the data or control path until the first incorrect transition is located.
4. Form one falsifiable primary hypothesis: cause, predicted observation, and smallest distinguishing experiment.
5. Run the experiment and inspect raw evidence. Reject or refine the hypothesis when prediction and evidence disagree.
6. Add regression evidence for the real failure path.
7. Apply the smallest root-cause repair. Avoid broad defensive changes that merely hide the symptom.
8. Re-run reproduction, regression evidence, and affected integration checks.

Before `fixed`, map every repair claim to current reproduction, regression, and applicable integration, lint, typecheck, static, package, or full-suite evidence. A failure or material validation gap blocks completion.

## Output

```yaml
status: fixed | reproduced | not_reproduced | blocked
risk: lean | standard | strict
symptom: observed failure
reproduction: command or artifact and result
root_cause: first incorrect transition or null
hypothesis:
  claim: current primary explanation
  experiment: distinguishing check
  result: supported | rejected | unavailable
repair: changed boundary or null
evidence: commands and current results
validation_gaps: unproven claims
next: build | review | verify | null
```

## Stop conditions

- Do not change production behavior while the cause remains a guess unless the user explicitly requests a reversible diagnostic experiment.
- Do not stack unrelated fixes to “see what works.” Change one causal variable per experiment.
- Do not treat absence of logs as evidence that a component behaved correctly.

Use `build` when the root cause requires a broader implementation slice. Strict repair always sets `next: review`. Lean or standard repair with current reproduction, regression, and affected integration evidence sets `next: null`; use `verify` only for explicit verification, stale or cross-session evidence, requested delivery, or cross-artifact/runtime claims.

## Common mistakes

- Accepting the user's proposed cause without testing it.
- Expanding descriptions, retries, timeouts, or null guards before reproducing the failure.
- Debugging the final error site instead of the first corrupted input or transition.
- Reporting “fixed” when only the original symptom was not observed once.
