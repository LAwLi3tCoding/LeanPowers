---
name: review
description: Use when code, configuration, tests, plans, agent workflows, or delivery changes need an independent assessment for requirement gaps, defects, regressions, security, compatibility, performance, or unnecessary complexity.
---

# Review

Judge whether a change is safe and fit for its declared purpose. Review is an independent evidence-based verdict, not a summary of what the author intended.

For strict or high-risk work, the reviewer must be a different agent, fresh session, qualified human, or external review result from the implementer perspective. A self-review may find defects but does not satisfy the independent-review gate; report the gap when no independent perspective is available.

Read [quality gates](../../references/quality-gates.md), [evidence protocol](../../references/evidence-protocol.md), and [subagent policy](../../references/subagent-policy.md).

If project learning is enabled, use `adapt` to query once at entry under the [learning policy](../../references/learning-policy.md) with this workflow, relevant paths, and tags; add at most three behavior-changing advisory rules to the task brief. Treat prior confirmations as advisory, never current review evidence, and send explicit downstream feedback to `adapt`.

## Review procedure

1. Establish the review base, declared scope, acceptance criteria, and applicable risk level.
2. Inspect the complete relevant diff and the surrounding code that defines its contracts.
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
unverified_areas: unavailable review evidence
```

Return `pass` only when no material findings remain. If a finding is uncertain, state the missing evidence instead of presenting speculation as fact.

## Boundaries

- Do not modify code during a review-only request.
- Do not trust author, child-agent, or CI summaries without checking the underlying evidence.
- Do not broaden into unrelated cleanup.
- Do not weaken severity because release is urgent.

Send causal defects to `debug`; send clear repairs to `build`; send a passing change to `verify` for completion proof.
