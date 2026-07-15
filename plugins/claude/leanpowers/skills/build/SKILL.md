---
name: build
description: Use when a software change has an executable scope and needs implementation, including features, refactors, configuration changes, documentation changes, or a known-cause defect with defined acceptance evidence.
---

# Build

Implement one delivery slice at a time. Correctness comes from early, risk-proportional evidence, not end-loaded testing.

Inherit the ledger. Routed entry owns workflow order; this Skill adds acceptance reasoning and output. Without a ledger, read the [runtime contract](../../references/runtime-contract.md) once and use the direct-entry loop.

If project learning is enabled, use `adapt` to query once at entry under the [learning policy](../../references/learning-policy.md) with this workflow, relevant paths, and tags; add at most three behavior-changing advisory rules to the task brief. Send explicit downstream outcome, correction, confirmation, or durable-preference feedback to `adapt`.

## Entry contract

Start when goal, declared scope, acceptance evidence, and constraints are executable. Material ambiguity uses `shape`; an unknown failure cause uses `debug`.

## Direct-entry slice loop

1. Inspect affected implementation and tests. Read every edit target before editing, extract literal `must`, `only`, `exact`, `preserve`, and `reject` boundaries, and preserve unrelated changes.
2. Choose the smallest useful slice. For behavior, patch focused tests first and run them before product code. Meaningful RED proves missing behavior and freezes that regression assertion. Invalid test design restarts TEST-PATCH→RED against the pre-behavior baseline; never weaken an assertion to fit implementation.
3. Patch product only after RED. Make boundaries observable: getters/counters prove no-access; snapshots and nested identities prove immutability; post-guard sentinels prove short-circuiting; one-property or one-element counterexamples prove exact validation boundaries.
4. After the final edit, run current regression evidence and each applicable affected integration, lint, typecheck, static, package, build, or full-suite check. Inspect results. A failure or validation gap blocks `complete`.
5. Unknown cause transitions to `debug`; otherwise repair in scope. First green freezes the completed acceptance set. A material omission discovered before review starts a new incomplete cycle. File edits invalidate evidence; read-only reporting does not.
6. Record changed paths, supported claims, evidence, and residual risk. Avoid abstractions, dependencies, compatibility layers, or cleanup outside scope.

Configuration or generated output uses a baseline or precheck. Failing evidence is required only for a behavioral change or defect. Documentation needs a relevant precheck; all need current post-edit validation.

## Strict direct entry

After green validation, strict direct entry loads the [subagent policy](../../references/subagent-policy.md) and runs its independent review in the same turn. Reviewer `changes_required` reopens repair, revalidation, then fresh review. Routed strict already continues under route; neither path outputs a user transition.

## Output

```yaml
status: complete | blocked | needs_debug
risk: lean | standard | strict
slices:
  - outcome: delivered behavior
    files: changed paths
    evidence: command and result
residual_risks: remaining uncertainty
next: verify | debug | null
```

Lean or standard completion with current applicable evidence sets `next: null`. Use `verify` only for explicit, stale, delivery, or cross-artifact evidence. New unknown failure uses `debug`; material scope expansion uses `shape`.

## Common mistakes

- Accepting a test that never showed meaningful RED.
- Using happy-path fixtures that cannot distinguish mutation, eager access, shallow handling, or exact-boundary errors.
- Treating targeted evidence as proof of unrelated integration or packaging claims.
- Editing after final validation without rerunning affected checks.
