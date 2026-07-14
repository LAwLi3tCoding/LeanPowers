# Runtime contract

Use this compact contract only when a workflow was entered directly or the routing ledger is missing. Read it once per task and reuse it across transitions.

## Risk and gates

Use the highest signal. `lean` is clear, local, reversible work with established validation and no public boundary. `standard` covers normal multi-file, public-boundary, dependency, or bounded-uncertainty work; unknown defaults to standard. `strict` covers security (including authentication, credentials/secrets, cryptography, or signature verification), authorization, payment, privacy, migration, concurrency, production, irreversible work, or a large refactor. Strict is sticky until an independent review and current verification both pass.

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

Reuse evidence only while all relevant code, generated output, dependencies, configuration, environment, and supported scope remain unchanged. Keep full logs local.

## Transitions

- `shape -> build` when executable.
- `build/debug -> review` for strict completion.
- `build/debug -> complete` for lean or standard work with current, applicable evidence.
- `build/debug -> verify` only for explicit verification, stale/cross-session evidence, requested delivery, or cross-artifact/runtime claims.
- `review -> build/debug` on findings; independent strict pass goes to `verify`.
- `verify -> ship` only when delivery was requested and every material claim passes.

Default to one agent. Delegate only when independent, verifiable work without shared-write conflict outweighs coordination cost; normally use at most two or three direct children, and the leader must inspect their diff and evidence. A strict reviewer must be a distinct agent, fresh session, qualified human, or external review; if unavailable, return incomplete and do not ship.
