---
name: review
description: Use when code, configuration, tests, plans, agent workflows, or delivery changes need an independent assessment for requirement gaps, defects, regressions, security, compatibility, performance, or unnecessary complexity.
---

# Review

Judge the change's safety and fitness. Return an evidence-based verdict, not author intent.

Runtime provenance—not prompt self-report—marks this fresh agent sole/designated reviewer. Review directly, remain read-only, and never re-delegate. Implementer self-review cannot pass strict work.

Inherit the routing ledger. If direct or missing, read the [runtime contract](../../references/runtime-contract.md) once; do not reload it after transitions.

If project learning is enabled, use `adapt` to query once at entry under the [learning policy](../../references/learning-policy.md) with this workflow, relevant paths, and tags; add at most three behavior-changing advisory rules to the task brief. Treat prior confirmations as advisory, never current review evidence, and send explicit downstream feedback to `adapt`.

## Review procedure

1. Establish base, scope, risk, and full original contract. Extract every literal `must`, `only`, `exact`, `preserve`, and `reject` clause.
2. Read current changed paths and surrounding code. Map each clause to positive and negative boundary evidence; keep qualifier scopes separate.
3. Trace changed inputs, state, side effects, errors, outputs, and compatibility boundaries. Check unintended access, mutation, eager work, aliasing, and over-validation.
4. Inspect current tests, not merely a green summary. Check one-property cases, getter/counter no-access sentinels, input/nested-identity immutability, short-circuit sentinels, interacting failures, and applicable integration/package coverage.
5. Verify suspected issues against concrete code, configuration, schema, or executable evidence. Separate defects from unverified areas.
6. Return findings first by severity. Omit preferences without correctness or maintainability impact.

Hard failures dominate scores and urgency. A known validation failure cannot be `pass`; simulated, stale, or incomplete evidence cannot authorize release.

## Severity

| Level | Meaning |
| --- | --- |
| `critical` | Unsafe release, data/security loss, or fundamental contract bypass |
| `high` | Likely incorrect behavior or major regression |
| `medium` | Real bounded defect, missing risk coverage, or maintainability hazard |
| `low` | Minor issue worth fixing but not a release blocker |

## Output

```yaml
verdict: pass | changes_required | blocked
findings:
  - severity: critical | high | medium | low
    location: path:line
    evidence: observable fact
    impact: concrete failure mode
    repair: smallest safe direction
unverified_areas: [] | [missing evidence]
```

`pass` requires no material findings or unverified areas. Return raw YAML only—no JSON, fences, headings, or prose. `pass` is exactly the three lines shown:

verdict: pass
findings: []
unverified_areas: []

For strict review, receive the full original task, risk ledger, changed paths, and current validation. Read current diff/code. Any later file edit invalidates review; read-only inspection or reporting does not. Contract conflicts remain `changes_required`; never edit, delegate, or accept author assertions as evidence.

## Boundaries

- Do not modify files during review.
- Check underlying evidence instead of author, child, or CI summaries.
- Do not broaden scope or weaken severity for urgency.
- Do not pass with unverified required behavior, environments, integrations, or artifacts.

Send causal defects to `debug` and clear repairs to `build`. Findings require repair, current validation, and fresh review. A passing change may complete with unchanged evidence; use `verify` for stale, explicit, delivery, or cross-artifact proof.

Report residual uncertainty.
