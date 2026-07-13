---
name: verify
description: Use when an agent is about to claim work is complete, fixed, safe, installable, passing, or ready to deliver and those claims need current tests, builds, static checks, artifact inspection, or remote readback.
---

# Verify

Map every material completion claim to current evidence. Confidence, previous success, and another agent's report are not evidence for the present revision.

Read [quality gates](../../references/quality-gates.md), [evidence protocol](../../references/evidence-protocol.md), and [workflow transitions](../../references/workflow-transitions.md).

If project learning is enabled, use `adapt` to query once at entry under the [learning policy](../../references/learning-policy.md) with this workflow, relevant paths, and tags; add at most three behavior-changing advisory rules to the task brief. Treat prior confirmations as advisory, never current verification evidence, and send explicit downstream feedback to `adapt`.

## Verification loop

1. List the claims the final response or delivery will make.
2. Determine the smallest command or inspection that can prove each claim.
3. Check the revision fingerprint and reuse existing evidence only when its explicit scope mapping proves all relevant inputs remain unchanged; otherwise invalidate conservatively.
4. Run missing or invalidated checks: targeted behavior first, then lint, typecheck, static analysis, integration, package, and full-suite checks as applicable.
5. Read exit codes and relevant output. Do not rely on command launch, log shape, or summaries alone.
6. Record each claim as `pass`, `fail`, or `unavailable` with its supporting evidence.

A source, generator, dependency, configuration, or package-path change invalidates affected evidence. A documentation-only change does not invalidate unrelated code evidence.

## Output

```yaml
verdict: pass | fail | incomplete
revision: current fingerprint
claims:
  - claim: exact statement
    status: pass | fail | unavailable
    evidence: command or inspection plus result
validation_gaps: unavailable proof and impact
next: ship | build | debug | null
```

Use `pass` only when every material claim passes. Any failure produces `fail`. Any unavailable material proof produces `incomplete`, not a weaker form of success.

When strict or high-risk work lacks the independent review required by the quality gates, return `incomplete` and do not transition to `ship`.

## Efficiency rules

- Run targeted checks after affected changes; normally run the full suite once per unchanged revision.
- Reuse unchanged-scope evidence instead of rerunning commands for ceremony.
- Keep full logs local and quote only decisive output.
- Do not claim a real runtime or release passed from simulated evidence.

Failed behavior with an unknown cause goes to `debug`; a clear correction goes to `build`; a fully supported requested delivery goes to `ship`.

## Common mistakes

- Saying tests pass because they passed before the latest code or generator change.
- Treating `unavailable` as pass.
- Running many commands without mapping them to claims.
- Trusting generated packages without checking source-package parity.
