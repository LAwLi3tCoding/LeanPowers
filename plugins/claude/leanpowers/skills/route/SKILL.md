---
name: route
description: Use when starting engineering work without a selected LeanPowers workflow; route plan, implement, fix, review, verify, or deliver requests to one lowest-safe owner.
---

# Route

Select exactly one lowest-safe owner; never implement.

Use highest risk. `lean` is clear, local, reversible work with validation and no public boundary. Security—including authentication, credentials/secrets, cryptography, or signature verification—authorization, payment, privacy, migration, concurrency, production, irreversible change, or large refactor is `strict`. Otherwise `standard`; preference cannot lower safety.

First progress: `entrypoint: leanpowers:route`, then this sticky ledger:

```yaml
workflow: selected owner
risk: lean | standard | strict
required_gates: [current_evidence] | [independent_review, current_evidence]
```

Preserve evidence, regression, scope, independent review, authorization, contradictions, and validation gaps.

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

Activate the installed LeanPowers owner with the ledger; Route never implements. Lean/standard may finish there. Strict: after final diff passes tests, tool-search/load deferred Codex V1 `multi_agent_v1.spawn_agent` and `wait_agent`, spawning with `fork_context:false`; others use native equivalents. Delegate a fresh-context Agent/subagent to directly run installed LeanPowers `review` without re-delegating, with the verbatim task, strict ledger, changed paths, concise evidence, and exact schema—never paraphrase or transcript. Wait. Only `verdict: pass` after last change satisfies `independent_review`; findings cannot be self-overruled. Any scoped edit requires retest/re-review. Then verify; otherwise incomplete, never ship.
