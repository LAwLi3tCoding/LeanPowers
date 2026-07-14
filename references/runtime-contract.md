# Runtime contract

Use for direct entry or missing routing ledger. Read once; reuse.

## Risk and gates

Use highest signal. `lean` is clear, local, reversible, validated, and has no public boundary. `standard` covers normal multi-file, public-boundary, dependency, or bounded-uncertainty work; unknown defaults here. `strict` covers security (including authentication, credentials/secrets, cryptography, or signature verification), authorization, payment, privacy, migration, concurrency, production, irreversible work, or a large refactor. Strict is sticky until independent review and current evidence pass.

Carry this ledger:

```yaml
workflow: shape | build | debug | review | verify | ship
risk: lean | standard | strict
required_gates: [current_evidence] | [independent_review, current_evidence]
```

## Invariants

1. Completion requires current evidence for the exact revision and declared scope.
2. Diagnose unknown failure to root cause before claiming repair.
3. Behavior change requires regression evidence.
4. Re-shape material scope expansion.
5. Strict work requires an independent review; implementer self-review is insufficient.
6. Destructive, irreversible, credential-gated, or production action requires authorization.
7. Re-evaluate when evidence contradicts the conclusion.
8. Report every material validation gap; unavailable is never pass.

Reuse evidence only while relevant code, generated output, dependencies, configuration, environment, and scope remain unchanged. Keep logs local.

## Transitions

- `shape -> build` when executable.
- `build/debug -> review` for strict completion.
- `build/debug -> complete` for lean or standard work with current evidence.
- `build/debug -> verify` only for explicit verification, stale/cross-session evidence, delivery, or cross-artifact/runtime claims.
- `review -> build/debug` on findings; independent strict pass with unchanged current evidence may complete, otherwise use `verify`.
- `verify -> ship` only when delivery was requested and every material claim passes.

Default one agent. Strict stabilizes final diff and tests, then uses exactly one fresh reviewer. On Codex V1, tool-search/load `multi_agent_v1.spawn_agent` and `multi_agent_v1.wait_agent`; spawn with `fork_context:false` and a message beginning `$leanpowers:review`, then wait once for that ID. Other runtimes invoke one native review; blocking calls do not wait again. Send the verbatim task, paths, concise evidence, and verdict schema—not paraphrase or transcript. Only its pass after last change satisfies the gate; any scoped edit requires retest/re-review. Implementer text never satisfies or overrules review. Unchanged current evidence remains valid; otherwise return incomplete and never ship.
