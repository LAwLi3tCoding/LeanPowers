---
name: review
description: Use when code, configuration, tests, plans, agent workflows, or delivery changes need an independent assessment for requirement gaps, defects, regressions, security, compatibility, performance, or unnecessary complexity.
---

# Review

Judge the change's safety and fitness. Return an evidence-based verdict, not author intent.

Independence is runtime provenance, not self-report. If you implemented the change, tool-search/load Codex V1 `multi_agent_v1.spawn_agent` and `wait_agent`, or native equivalents; invoke one distinct reviewer with contract, final diff/code, and evidence; wait; otherwise return `blocked`. Only its result or supplied fresh-session, qualified-human, or external review may return `pass`; implementer-authored text never does.

Inherit the routing ledger. If entered directly or the ledger is missing, read the [runtime contract](../../references/runtime-contract.md) once; do not reload it after transitions.

If project learning is enabled, use `adapt` to query once at entry under the [learning policy](../../references/learning-policy.md) with this workflow, relevant paths, and tags; add at most three behavior-changing advisory rules to the task brief. Treat prior confirmations as advisory, never current review evidence, and send explicit downstream feedback to `adapt`.

## Review procedure

1. Establish the review base, scope, risk, and original contract; extract every literal `must`, `only`, `exact`, `preserve`, and `reject` clause.
2. Map each clause to the relevant diff/code and nearest positive and negative boundary evidence; keep qualifier scopes separate.
3. Trace changed inputs, state transitions, error paths, outputs, and compatibility boundaries.
4. Check tests for the actual risk, including negative and regression cases; do not infer correctness from a green summary alone.
5. Verify each suspected issue against concrete code, configuration, schema, or executable evidence.
6. Return findings first, ordered by severity. Omit style preferences that do not affect correctness or maintainability.

Hard failures dominate aggregate scores and deadline pressure. A known validation failure cannot be labeled `PASS`. Simulated or incomplete evidence cannot override a critical failure or authorize release.

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

`pass` requires no material findings or unverified areas. State missing evidence; never speculate.

For a delegated strict review, send only the task contract, risk ledger, relevant diff and code, and current evidence—not the implementation transcript.

## Boundaries

- Do not modify code during a review-only request.
- Do not trust author, child-agent, or CI summaries without checking the underlying evidence.
- Do not broaden into unrelated cleanup.
- Do not weaken severity because release is urgent.

Send causal defects to `debug`; send clear repairs to `build`; send a passing change to `verify` for completion proof.
