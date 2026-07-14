---
name: route
description: Use when starting engineering work without a selected LeanPowers workflow; route plan, implement, fix, review, verify, or deliver requests to one lowest-safe owner.
---

# Route

Select exactly one lowest-safe owner; never implement.

Use highest risk. `lean` is clear, local, reversible work with validation and no public boundary. Security—including authentication, credentials/secrets, cryptography, or signature verification—authorization, payment, privacy, migration, concurrency, production, irreversible change, or large refactor is `strict`. Otherwise `standard`; preference cannot lower safety.

Carry this sticky ledger:

```yaml
workflow: selected owner
risk: lean | standard | strict
required_gates: [current_evidence] | [independent_review, current_evidence]
```

Preserve evidence, causes, regression, scope, independent review, authorization, contradictions, and validation gaps.

## Selection

1. Honor explicit workflows whose contracts hold.
2. `adapt`: explicit feedback or learning maintenance.
3. `verify`: completion/readiness evidence or passing claims.
4. `ship`: delivery with current verification.
5. `review`: independent assessment.
6. `debug`: unexpected failure with unknown/disputed cause.
7. `shape`: unclear scope, acceptance, architecture, or authority.
8. Otherwise `build` an executable change.

If none applies, answer; ties resolve uncertainty.

Activate it with the ledger; lean/standard build/debug may complete inline. Strict: if spawn/wait tools are invisible, use runtime tool discovery to load them; invisibility is not unavailability. Delegate `$leanpowers:review` without inherited transcript, passing the original contract, final diff/code, and current evidence to a distinct native Agent/subagent, then wait. Only its returned result satisfies `independent_review`; implementer-authored review text never does. Apply findings, then verify; otherwise return incomplete and never ship.
