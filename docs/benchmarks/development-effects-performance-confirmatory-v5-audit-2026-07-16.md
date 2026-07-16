# Performance confirmatory v5: post-run audit

This companion audit explains the frozen v5 result without changing it. The [canonical report](development-effects-performance-confirmatory-v5-2026-07-16.md), [preregistration](development-effects-performance-confirmatory-v5-preregistration-2026-07-16.md), and [frozen suite](../../evals/development-effects/performance-confirmatory-v5-suite.json) remain the primary artifacts.

Superpowers 6.1.1 is LeanPowers' upstream reference and principal engineering foundation. This matrix asks whether one prospective LeanPowers revision met its own quality-first lightweight-workflow target. It is not a product ranking, and a shared failure does not count as an advantage for either workflow.

## Frozen decision

The matrix completed all 12 planned runs: 3 cases x 2 repetitions x 2 workflows. The isolation preflight passed, there were no scope violations or infrastructure-failure classifications, and no run was repeated or selectively discarded. One Superpowers run exited without a complete turn or valid Token telemetry, so its pair is excluded from Token conclusions under the preregistered fail-closed rule.

Metric | Frozen result | Required result | Decision
--- | ---: | ---: | ---
Superpowers Task PASS | 0/6 | reported reference | -
LeanPowers Task PASS | 0/6 | 6/6 | FAIL
LeanPowers quality-bearing conformance | 0/6 | 6/6 | FAIL
Aggregate model tokens | unavailable; 5/6 Token-valid pairs | complete 6-pair population at most 60% | FAIL
Diagnostic 5-pair Lean token share | 1,985,217 / 1,939,177 = 102.3742% | not a substitute target | -
All-six paired wall reduction median | 8.6% | secondary diagnostic | improvement; no gate failure

The exact result-gate output was:

```text
status=FAIL reasons=run-integrity,task-outcome,lean-conformance,token-telemetry,token-summary,token-target advisories=none token_assessment=miss token_share=n/a median_wall_reduction=8.6
```

The overall decision is **FAIL**. The quality target failed, LeanPowers' frozen workflow-conformance target failed, and incomplete Token telemetry made the aggregate target ineligible rather than allowing an estimate or imputation.

## Results by category

Category | Superpowers Task PASS | LeanPowers Task PASS | Token-valid pairs | Diagnostic Lean share
--- | ---: | ---: | ---: | ---:
HTTP negotiation BUILD | 0/2 | 0/2 | 2/2 | 69.9211%
Safe redirect BUILD | 0/2 | 0/2 | 1/2 | 272.7248%
Keyset cursor DEBUG | 0/2 | 0/2 | 2/2 | 75.3372%

The matrix has a clear floor effect: neither workflow produced a Task PASS. That prevents this suite from establishing comparative quality preservation or non-inferiority. It does not make the failures meaningless. Every Task outcome includes workflow-neutral executable checks, and the result shows that the candidate-authored regression suites did not cover enough of the frozen semantic fault families.

The failure shapes differ:

- In HTTP negotiation, both workflows missed multiple fault-discriminating regressions; both LeanPowers runs and one Superpowers run also failed hidden acceptance.
- In safe redirect, one Superpowers run did not complete and authored no test delta. The other Superpowers run and both LeanPowers runs still missed semantic fault families; one LeanPowers run also failed hidden acceptance.
- In keyset cursor, all four implementations reached visible and hidden behavior acceptance, but none of the authored regression deltas killed every frozen collection-shape and freshness mutant. This is a test-adequacy failure, not evidence that all four implementations were behaviorally wrong.

Because the same strong representation-boundary requirement applied to both workflows, the frozen outcome is valid. Because every run failed, it is also weakly discriminative as a comparison. A future suite should preserve hidden acceptance and mutation testing while avoiding another all-fail population.

The preregistered all-or-nothing Task endpoint remains authoritative, but non-gating layers explain the floor:

- all 12 visible-test commands exited zero, although the incomplete Superpowers safe-redirect run had authored no candidate test delta and the command discovered zero visible tests;
- hidden semantic acceptance passed 5/6 Superpowers runs and 3/6 LeanPowers runs;
- Superpowers killed 32/58 frozen mutation gates, or 32/49 after excluding the incomplete run's nine gates; LeanPowers killed 43/58;
- every run still failed its case-level all-kill requirement, so none of these partial counts may replace Task PASS or support a winner claim; and
- repeated misses clustered around complete own-key validation, governing-header order, web-only origin policy, exact array keys, and fresh terminal collections.

This split shows why the suite remains useful as stress evidence: implementation correctness and candidate-test adequacy still vary beneath the binary floor. It also shows why the next confirmation suite should distribute the same semantic coverage across more, narrower tasks instead of relaxing hidden checks or mutation quality.

## Token evidence and the missing pair

Five pairs have complete Token telemetry. Across those pairs, LeanPowers used 1,985,217 model tokens and Superpowers used 1,939,177, a diagnostic Lean share of 102.3742%. The median of those five per-pair Token reductions is 25.7%, but the adverse safe-redirect pair used 272.7248% and erased the savings from the other categories.

The missing pair is safe-redirect repetition 1. The Superpowers agent exited non-zero after 140.3 seconds without completing a turn and without valid Token telemetry. The runner classified zero infrastructure failures and did not apply the capacity retry because the terminal state was not the preregistered exact capacity-failure condition. The result therefore records a telemetry gap, excludes that pair from Token summaries, and refuses to calculate the six-pair aggregate target.

The raw terminal trajectory identifies a context-window failure after an oversized, malformed tool-argument payload. The agent had removed the original visible test file and had not completed its replacement. This is an agent/tool-generation failure, not a capacity event or verifier-infrastructure failure. The runner correctly did not retry it and did not invent usage in the absence of `turn.completed` telemetry.

The matching LeanPowers run used 1,820,106 model tokens, of which 1,717,248 were cached input. Its high total came from a long correction loop with repeated probes, patch mismatches, and tool rejections rather than repeated LeanPowers workflow-file reads or one large command output. The runner reports the one cumulative `turn.completed` usage record correctly, but current telemetry cannot attribute usage to individual model requests. The causal description is therefore “tool-loop-associated cached-context amplification,” not a precise per-request measurement.

No replacement value, partial usage estimate, or five-pair ratio may stand in for the declared six-pair decision. The 102.3742% value remains useful diagnostic evidence, but the machine target is **INELIGIBLE** and the gate records a miss.

## LeanPowers workflow effects

LeanPowers' frozen conformance was 0/6:

- all four BUILD runs genuinely lacked the required observable test-first sequence: each edited product source before a focused failing regression and later adjusted tests after implementation;
- both strict safe-redirect runs lacked a current passing independent review;
- one DEBUG run genuinely exceeded the bounded recovery protocol; the other received the same frozen failure after an invalid test-launch command followed by one substantive repair loop;
- one HTTP run did not report the canonical top-level LeanPowers route ledger before task tools.

The frozen evaluator also reported three source-grounding omissions. Raw-trace audit found that all three runs had read the relevant source and test files before editing; the evaluator rejected safe read-only commands joined with `&&`. Those three reasons are prospective evaluator false negatives. They do not change the frozen conformance or Task result: all four BUILD runs independently fail test-first, both strict runs lack review, all six candidate regression suites fail their case-level mutation requirement, and only 3/6 LeanPowers runs pass hidden semantic acceptance.

These are not ceremony-only diagnostics. The frozen checks cover source grounding, meaningful RED evidence before product edits, bounded recovery, strict independent review, validation freshness, and the stop boundary. Exact tool-call counts, repeated route narration, and one-call versus two-call validation remain non-gating diagnostics.

The result shows that the prospective v5 runtime changes were insufficient to make these effects reliable under explicit `$leanpowers:route` activation. Any next runtime change must improve the entrypoint's direct execution effect, not merely add more prose or another workflow stage.

## Isolation and execution provenance

One attempted runner invocation failed closed before any `START` event because its evaluator checkout was under the operating-system temporary directory. The frozen permission profile intentionally grants the temporary directory to candidate commands, so the evaluator sentinel was readable and the isolation probe rejected the setup. Its selected output directory remained empty.

A separate preflight-only diagnostic confirmed that copying byte-identical suite inputs under the same temporary evaluator root did not fix that boundary. It invoked only Codex permission rendering and sandbox probes, never `codex exec` or the model.

The successful setup used a clean detached evaluator and LeanPowers checkout under the repository's Git-ignored `.omx` area at the same frozen revision. A standalone preflight then passed all 3 cases x 2 installed workflows. The single live matrix subsequently emitted exactly 12 `START` events and 12 matching `END` events into a new output directory.

No task, suite byte, workspace, verifier, mutant, workflow order, scoring rule, retry rule, renderer, runner, evaluator, or frozen revision changed after live output was visible. The canonical report is byte-for-byte copied from the runner output. Its SHA-256 is `d03c2dee03b97b7f5fc8ab601d6692b43da1dadba0c4da1a12c57bc9b1d38eda`.

## Comparison boundary

V5 does not revise v4. V4 remains a complete six-pair result with Superpowers 5/6, LeanPowers 3/6, and a 79.0877% aggregate Lean token share. V5 tested a new revision on three unseen families and produced a separate, worse all-fail matrix with one Token telemetry gap. Both results remain published because selecting only the more favorable matrix would invalidate the evaluation process.

V5 also does not show that Superpowers generally lacks quality, nor that LeanPowers is generally equivalent. The tasks are unusually exact small-library contracts with hidden representation checks and candidate-test mutation gates. They are useful stress tests, but three categories and two repetitions cannot establish a universal ordering.

## Prospective direction

The next iteration should keep the quality-first target but change the development method:

1. Make `$leanpowers:route` directly install the selected owner's minimal executable effect in the same entrypoint, so BUILD test-first and DEBUG recovery do not depend on a fragile nested handoff.
2. For BUILD, block product edits until one focused meaningful RED exists; for DEBUG, distinguish launcher errors from semantic validation and stop after the bounded substantive recovery allowance.
3. Keep strict independent review mandatory, but make “spawn one fresh reviewer, wait, and require a current PASS before completion” one compact terminal effect rather than additional ceremony.
4. Treat representation-boundary tests as a named implementation deliverable through a short acceptance-clause-to-distinguishing-counterexample mapping. Do not add hidden-case hints or a planning document.
5. Repair the evaluator prospectively so safe chained read commands count as grounding, while command substitution, redirection, writes, and ambiguous chains remain rejected.
6. Separate calibration from confirmation. Calibrate task discriminativeness on public sibling fixtures, then freeze different unseen confirmation tasks. Preserve hidden acceptance, reverse validation, critical all-kill mutation families, scope, isolation, freeze, and counterbalancing.
7. Use four or five narrower cases with three to five critical gates each, rotating representation boundaries across cases. Predeclare a floor/ceiling rule and layered diagnostics, but keep full Task PASS as the quality and Token-eligibility endpoint.
8. Preserve the complete aggregate Token rule. A telemetry gap remains a failed evidence set, never an invitation to estimate the missing denominator.

These are prospective changes only. They do not authorize a v5 rerun or a corrected v5 verdict.

## Bounded conclusion

V5 did not move LeanPowers to its target. The observed workflow was neither quality-preserving nor lighter in the complete evidence sense: Task PASS was 0/6, conformance was 0/6, and the aggregate Token target was ineligible. On the five measurable pairs, LeanPowers used slightly more total model tokens despite a favorable median pair, demonstrating again that a single adverse category can dominate the aggregate.

The appropriate conclusion is not that the upstream approach is deficient. Superpowers remains the principal foundation that LeanPowers is trying to compress. The result instead shows that LeanPowers' current compression loses too much execution reliability on exact test design, workflow effect, and strict review. Those gaps must be fixed prospectively and demonstrated on a newly frozen, independently calibrated unseen suite.
