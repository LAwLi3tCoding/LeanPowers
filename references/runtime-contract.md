# Runtime contract

Use for direct entry or missing routing ledger. Read once; reuse.

Batch independent reads/checks when evidence stays attributable; with proven unchanged fingerprint/scope, never reread unchanged workflow/source. Limit output to relevant regions/failure summaries. Carry one ledger without restating task/plan. Extra calls require new evidence; never merge gates.

## Risk and gates

Use the highest signal. `lean` only when `clear`, `local`, `reversible`, and `establishedValidation` are true and no standard or strict signal applies. `causeKnown=false` is `standard`; so are `preferredMode=standard`, `behaviorChange`, `boundedUncertainty`, `dataModelChange`, `defect`, `dependencyChange`, `diagnosisRequested`, `externalSystem`, `multiFile`, `publicBoundaryChange`, `scopeExpanded`, and `validationFailed`. Use `strict` for `preferredMode=strict`, `authorization`, `authentication`, `concurrency`, `credentialGated`, `credentials`, `cryptography`, `dataRisk`, `destructive`, `irreversible`, `largeRefactor`, `migration`, `payment`, `privacy`, `production`, `reviewHighRisk`, `security`, `secrets`, and `signatureVerification`. Strict is sticky until independent review and current evidence pass.

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
5. Strict work requires independent review; implementer self-review is insufficient.
6. Destructive, irreversible, credential-gated, or production action requires authorization.
7. Re-evaluate contradictory evidence and report every material validation gap.

Evidence remains reusable only while relevant code, output, dependencies, configuration, environment, and scope remain unchanged.

## Transitions

- `shape -> build` when executable.
- Strict `build/debug -> review` is an internal same-turn phase, never a user handoff or `next: review` output.
- Lean/standard `build/debug -> complete` with current evidence.
- `build/debug -> verify` only for explicit, stale, delivery, or cross-artifact/runtime evidence.
- Review findings reopen `build/debug`; pass with unchanged evidence may complete, otherwise use `verify`.
- `verify -> ship` only for requested delivery with passing evidence.

Strict build/debug loads the subagent policy only after green validation; that policy alone defines review invocation and effects. Implementer text never satisfies or overrules review. Unavailable review is incomplete and never ships.
