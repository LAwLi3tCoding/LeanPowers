---
name: route
description: Use when starting engineering work without a selected LeanPowers workflow; route plan, implement, fix, review, verify, or deliver requests to one lowest-safe owner.
---

# Route

Choose exactly one lowest-safe owner. Do not implement or preload a chain.

Classify highest risk first. `lean` is clear, local, reversible work with established validation and no public boundary. Security—including authentication, credentials/secrets, cryptography, or signature verification—authorization, payment, privacy, migration, concurrency, production, irreversible change, or large refactor is `strict`. Everything else is `standard`; preference cannot lower safety.

Carry this sticky ledger:

```yaml
workflow: selected owner
risk: lean | standard | strict
required_gates: [current_evidence] | [independent_review, current_evidence]
```

Keep current evidence, unknown-failure root cause, regression, scope, independent strict review, authorization, contradiction re-evaluation, and validation gaps.

## Selection

1. Honor an explicit workflow only when its contract holds.
2. `adapt`: explicit downstream feedback or learning maintenance.
3. `verify`: evidence, completion, safety, readiness, or passing claims.
4. `ship`: delivery-only work with current verification.
5. `review`: independent assessment.
6. `debug`: unexpected failure with unknown or disputed cause.
7. `shape`: materially unclear scope, acceptance, architecture, or authority.
8. Otherwise `build` an executable change.

If none applies, answer normally. If two apply, choose the owner resolving uncertainty.

Activate it with the ledger. Lean/standard build or debug may complete inline. Strict cannot finish there: spawn a distinct reviewer with contract, relevant diff/code, and evidence; apply findings, then verify. Without it, return incomplete; never ship.
