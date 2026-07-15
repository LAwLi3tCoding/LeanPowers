---
name: debug
description: Use when software, tests, builds, integrations, performance, hooks, or agent behavior fail unexpectedly and the root cause is unknown, intermittent, disputed, or hidden across component boundaries.
---

# Debug

Turn an observed failure into a reproducible root cause and regression-proven repair. A plausible guess is not a diagnosis.

Inherit the ledger. Routed entry owns workflow order; this Skill adds causal reasoning and output. Without a ledger, read the [runtime contract](../../references/runtime-contract.md) once and use the direct-entry loop.

If project learning is enabled, use `adapt` to query once at entry under the [learning policy](../../references/learning-policy.md) with this workflow, relevant paths, and tags; add at most three behavior-changing advisory rules to the task brief. Treat lessons as hypotheses, never root cause, and send explicit downstream outcome or correction feedback to `adapt`.

## Direct-entry root-cause loop

1. State the exact symptom, expected behavior, revision, and environment. Read every edit target before editing and preserve unrelated changes.
2. Before editing, reproduce with the smallest reliable command, case, trace, or fixture. Trace backward to the first incorrect transition and root cause. If unavailable, report the validation gap; do not claim repair.
3. Form one falsifiable hypothesis: cause, predicted observation, and smallest distinguishing experiment. Inspect evidence; reject or refine when prediction fails.
4. Map the first wrong transition to regression and interacting-failure assertions. Before patching, keep a terse in-context `Clause→test ledger:` mapping each distinct `must`, `only`, `exact`, `preserve`, and `reject` boundary to one positive or smallest distinguishing negative check. Put all applicable assertions and product repair in the initial repair so evidence exercises the corrected boundary.
5. Post-edit, run current regression evidence and applicable affected integration, lint, typecheck, static, package, build, or full-suite validation. Then replay exact reproduction. Structured resolved output: reproduction MUST be a separate final command so its output is attributable. Combined validation+reproduction is acceptable only when no structured output contract needs attribution.
6. A launcher/tool-start error may correct only the command before supported validation runs and does not spend recovery. One failed supported validation permits one immediate substantive correction to already-read in-scope paths and an identical-command rerun. No intervening task tool, test weakening, empty retry, second correction, or second failure; otherwise block/rescope.
7. First green freezes the completed acceptance set. A material omission discovered before review starts a new incomplete cycle. File edits invalidate validation and reproduction; read-only reporting does not.

Use observable counterexamples for exact side-effect or traversal boundaries: getter/counter no-access sentinels, snapshots plus nested identity for immutability, post-guard short-circuit sentinels, and one-property or one-element exact-validation cases.

## Strict direct entry

After green validation and reproduction, strict direct entry loads the [subagent policy](../../references/subagent-policy.md), starts one fresh independent read-only reviewer with the exact task, ledger, changed paths, and current validation, then waits in the same turn for completed Review YAML and requires `pass`. `changes_required` reopens repair, revalidation, then fresh review. Routed strict already continues under route; neither path outputs a user transition.

## Output

```yaml
status: fixed | reproduced | not_reproduced | blocked
risk: lean | standard | strict
symptom: observed failure
reproduction: command or artifact and result
root_cause: first incorrect transition or null
hypothesis:
  claim: current primary explanation
  experiment: distinguishing check
  result: supported | rejected | unavailable
repair: changed boundary or null
evidence: commands and current results
validation_gaps: unproven claims
next: build | verify | null
```

Do not change production behavior while cause remains a guess except for an explicitly requested reversible diagnostic. Do not stack unrelated fixes or treat missing logs as proof. Use `build` for a broader slice. Lean or standard with current reproduction, regression, and affected integration evidence sets `next: null`; use `verify` only for explicit, stale, delivery, or cross-artifact proof.
