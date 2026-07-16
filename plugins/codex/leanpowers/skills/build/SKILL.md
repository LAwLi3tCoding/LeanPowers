---
name: build
description: Use when a software change has an executable scope and needs implementation, including features, refactors, configuration changes, documentation changes, or a known-cause defect with defined acceptance evidence.
---

# Build

Implement one slice at a time. Correctness comes from early, risk-proportional evidence.

Inherit the ledger. Routed entry owns workflow order; this Skill adds acceptance reasoning/output. Without one, read the [runtime contract](../../references/runtime-contract.md) once and use the direct-entry loop.

If project learning is enabled, use `adapt` to query once at entry under the [learning policy](../../references/learning-policy.md) with this workflow, relevant paths, and tags; add at most three behavior-changing advisory rules to the task brief. Send explicit downstream outcome, correction, confirmation, or durable-preference feedback to `adapt`.

## Entry contract

Start with executable goal, scope, acceptance evidence, constraints. Material ambiguity uses `shape`; unknown cause uses `debug`.

## Direct-entry slice loop

1. Inspect implementation/tests; read every edit target; preserve unrelated changes. Before patching keep `Clause→test ledger:`. Give each actual high-information qualifier its own line: `qualifier → smallest distinguishing test | rejects: neighboring wrong implementation`. Never group qualifiers behind one generic test. Add a nearby-mutation counterexample for representation/side-effect risk.
2. Choose the smallest slice. For behavior the first behavioral edit is test-only. Product files stay locked until the focused new assertion shows meaningful RED from missing behavior, not syntax/setup/unrelated failure. RED freezes that regression assertion. Test changes after RED invalidate it and require another RED. Never patch implementation with tests before valid RED. Invalid test design restarts TEST-PATCH→RED against the pre-behavior baseline; never weaken assertions.
   Place each test at a stable observable seam and derive expected values from an independent source of truth, not implementation logic. Advance by one vertical slice—test, minimal behavior, next slice—and avoid internal-collaborator assertions unless the contract exposes them.
3. Patch product only after RED. Expand only qualifiers present: `fresh` calls twice and compares identities; `deep-fresh` proves disjoint identity sets for required input/output containers, sharing no containers; `exact ordinary` checks prototype, `Reflect.ownKeys`, descriptors; order-independent checks both orders; `case-sensitive` flips one character's case; `no-coercion`/`no-access` keeps a trap counter zero. These reject reuse, aliasing, exotic surfaces, first-wins, lowercasing, and eager access. Use snapshots/nested identities for immutability and post-guard sentinels for short-circuiting.
4. After final edit run regression and applicable affected integration/lint/typecheck/static/package/build/full-suite checks. Inspect results; failure or validation gap blocks `complete`.
5. Unknown cause transitions to `debug`; otherwise repair in scope. First green freezes completed acceptance set. Material omission before review starts a new incomplete cycle. Edits invalidate evidence; read-only reporting does not.
6. Record claims, evidence, risk. Every changed line must serve the request. Reject speculative features, single-use abstractions, unrequested flexibility, impossible-case handling, out-of-scope dependencies/compatibility; remove only slice-created orphans.

Configuration/generated output uses baseline/precheck. Failing evidence is only for behavior/defect. Documentation needs a relevant precheck; all need current post-edit validation.

## Strict direct entry

STRICT EXIT: green is not completion. After green, strict direct entry loads the [subagent policy](../../references/subagent-policy.md), starts one fresh independent read-only reviewer with exact task, atomic ledger, changed paths, current validation, waits in the same turn for completed Review YAML, and requires `pass`. Unavailable review is `blocked`; `changes_required` reopens repair→revalidation→fresh review. Routed strict continues under route; neither path returns a user transition.

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
