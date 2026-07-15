# Performance confirmatory v4: post-run audit

This companion audit explains the frozen v4 result without changing it. The [canonical report](development-effects-performance-confirmatory-v4-2026-07-16.md), [preregistration](development-effects-performance-confirmatory-v4-preregistration-2026-07-16.md), and [frozen suite](../../evals/development-effects/performance-confirmatory-v4-suite.json) remain the primary artifacts.

Superpowers 6.1.1 is LeanPowers' upstream reference and principal engineering foundation. This matrix asks whether LeanPowers met its own quality-first lightweight-workflow target under three bounded tasks. It is not a product ranking, and the result does not diminish the upstream project.

## Frozen decision

The matrix completed all 12 planned runs: 3 cases × 2 repetitions × 2 workflows. There were no scope violations, telemetry gaps, infrastructure failures, or excluded pairs. One LeanPowers run used the preregistered single capacity retry; its 44.3 seconds of infrastructure retry time stayed outside the paired workflow wall statistic.

Metric | Frozen result | Required result | Decision
--- | ---: | ---: | ---
Superpowers Task PASS | 5/6 | reported reference | —
LeanPowers Task PASS | 3/6 | 6/6 | FAIL
LeanPowers quality-bearing conformance | 0/6 | 6/6 | FAIL
Aggregate model tokens | 1,874,386 / 2,370,010 = 79.0877% | at most 60% | FAIL
Median paired model-token reduction | 26.0% | diagnostic | —
Median paired wall reduction | 2.0% | secondary guardrail | PASS

The exact result-gate output was:

```text
status=FAIL reasons=task-outcome,lean-conformance,token-target advisories=none token_assessment=miss token_share=79.0876831743326 median_wall_reduction=2
```

The overall decision is **FAIL**. LeanPowers missed the executable Task target, its frozen quality-bearing conformance target, and the aggregate Token target.

## Results by category

Category | Superpowers Task PASS | LeanPowers Task PASS | Superpowers tokens | LeanPowers tokens | Lean share | Lean wall reduction
--- | ---: | ---: | ---: | ---: | ---: | ---:
Weighted interleave BUILD | 2/2 | 1/2 | 581,725 | 424,717 | 73.0099% | 33.8%
Structured redaction BUILD | 1/2 | 0/2 | 887,291 | 1,012,730 | 114.1373% | -11.5%
Bidirectional index DEBUG | 2/2 | 2/2 | 900,994 | 436,939 | 48.4952% | 2.0%
BUILD owner aggregate | 3/4 | 1/4 | 1,469,016 | 1,437,447 | 97.8510% | 3.7%
DEBUG owner aggregate | 2/2 | 2/2 | 900,994 | 436,939 | 48.4952% | 2.0%

The distributions matter:

- Weighted interleave was materially cheaper and faster for LeanPowers, but one repetition failed hidden acceptance and both repetitions missed frozen workflow-conformance requirements.
- Structured redaction was the adverse category. Superpowers passed one repetition and LeanPowers passed neither; LeanPowers also used more tokens and wall time. The artifact gates exposed missing candidate-test discrimination around sensitive-value short-circuiting and input immutability.
- Bidirectional index was the strongest executable category for LeanPowers: both workflows passed 2/2, and LeanPowers used 48.4952% of Superpowers' tokens. Both LeanPowers traces nevertheless failed the frozen conformance evaluator.

These are three small fixtures with different failure shapes. They do not establish a general quality or efficiency ordering.

## Why fewer total tokens still missed the target

Across all six matched pairs, Superpowers used 2,370,010 model tokens and LeanPowers used 1,874,386. The ratio of sums is therefore 79.0877%, which means LeanPowers used 20.9123% fewer total model tokens in this matrix.

That is a real aggregate reduction, but the preregistered target required LeanPowers to use at most 60% of Superpowers' total—approximately 40% fewer. The target was therefore missed. The 26.0% median paired reduction answers a different question: it is the median of six per-pair percentage reductions, not the ratio of the two workflow totals. Neither statistic may replace the frozen aggregate decision rule.

The category split explains the gap. DEBUG saved 464,055 tokens and weighted BUILD saved 157,008, while structured redaction added 125,439. The result is lighter overall, but not light enough for LeanPowers' own declared target.

## What the frozen conformance result means

Task outcome and workflow conformance are separate. Task PASS is workflow-neutral and requires visible and hidden acceptance plus every case-owned semantic fault-family policy. LeanPowers conformance additionally checks LeanPowers' preregistered routing, evidence order, bounded recovery, review, validation, and stop conditions. The Superpowers conformance column checks explicit activation, so the two conformance columns are not equivalent process scores.

The canonical report records the exact per-run reasons. At a category level:

- Weighted interleave did not consistently produce the required ordered test-only patch, assertion-level RED evidence, later product patch, and supported final validation. One repetition also declared `lean` instead of the frozen `standard` risk.
- Strict structured redaction did not establish the complete BUILD evidence order and current independent-review boundary. Its Task failures independently remain even if workflow evidence is considered separately.
- Both bidirectional-index implementations passed all executable quality gates, but the frozen evaluator recorded missing mutation-window, bounded-recovery, supported-validation, and final-stop evidence in both traces.

A post-run trace audit found two different DEBUG stories. In the first repetition, product and regression edits were adjacent, the exact combined validation command exited successfully, and no later tool ran; however, retained command telemetry contained the test tail but not the leading resolved-reproduction JSON. Restoring that already-expected JSON in a diagnostic parser replay removes all four conformance reasons. In the second repetition, the agent made another test edit after its first successful validation and ran a third validation, which is a genuine bounded-recovery and first-green-stop violation. These observations improve the prospective evaluator and workflow design, but they do not reclassify the frozen 0/6 result.

## Isolation-preflight provenance

Before the successful matrix, two attempted executions failed closed during read-isolation preflight. Both stopped before any `START` event or model invocation, and both left their selected result directories empty. They are preflight setup failures, not benchmark runs, retries, or selectively discarded model outputs.

The successful preflight used three exact verifier-sentinel overlays, one for each frozen case. The overlays were byte-identical to their corresponding frozen verifier sentinels and existed only to prove that candidate code could not read the blocked verifier locations. They were not scoring inputs. Actual hidden verification and scoring used the verifier snapshots already frozen into the suite contract.

The tracked runner and evaluator revisions remained unchanged throughout the failed preflights and the successful 12-run matrix. No task, workspace, verifier, fault family, scoring rule, retry rule, renderer, runner, or evaluator was changed to obtain the published result.

## Freeze boundary and next step

The canonical v4 report is published byte-for-byte from the result gate's renderer output. V4 remains frozen and is not reinterpreted after inspecting its outcomes. The companion analysis distinguishes executable failures, workflow gaps, and telemetry limitations, but it does not produce a corrected verdict or authorize a selective rerun.

Prospective changes should make the high-value BUILD evidence order, DEBUG recovery boundary, validation observability, and first-green stop condition more reliable without adding a heavy workflow chain. Their effect must be evaluated on a newly frozen suite of unseen tasks. V4 is calibration evidence from this point forward.

## Bounded conclusion

V4 does not meet LeanPowers' target of complete quality at no more than 60% aggregate model tokens. It does show a meaningful 20.9123% total-token reduction, strong executable DEBUG results, and sharply different category behavior. The appropriate conclusion is mixed and bounded: LeanPowers remains structurally lighter, but this matrix did not preserve the required quality and workflow evidence reliably enough.

The upstream relationship remains central. Superpowers supplied the principal engineering foundation being compressed and adapted here. This benchmark evaluates LeanPowers' own tradeoff target; it is not an attempt to rank above, replace, or diminish Superpowers.
