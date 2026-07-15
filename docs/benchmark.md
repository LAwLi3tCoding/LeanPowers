# LeanPowers benchmark protocol

The benchmark tests the product promise: materially lower workflow overhead without a meaningful engineering-quality regression versus Superpowers 6.1.1.

This is a non-inferiority and efficiency study, not a competition narrative. Superpowers is the upstream inspiration and active baseline because LeanPowers derives many of its engineering principles from it. A passing result would mean that LeanPowers stayed within predeclared quality bounds under the tested conditions while using fewer resources. It would not establish that LeanPowers is universally better, or diminish the value of Superpowers' more comprehensive workflow.

## Current status

The repository contains the scenario catalog, result schema, deterministic comparator, and scorer fixtures. A **12-run paired development-effects pilot** has now been executed on three task classes. Both workflows passed 5/6 runs; LeanPowers used 19.8% fewer median model tokens and 9.5% less median wall time. The complete sanitized result is in the [2026-07-14 pilot report](benchmarks/development-effects-pilot-2026-07-14.md).

A separate **one-case preregistered frozen held-out check** produced 2/2 executable task passes for both workflows. LeanPowers conformance was 1/2, so the frozen engineering-effect gate failed. Its paired model-token shares were 83.3% and 75.9% of Superpowers, a 79.6% median, so 0/2 pairs met the `<=60%` target. The complete sanitized result is in the [2026-07-14 held-out report](benchmarks/development-effects-heldout-2026-07-14.md).

A later **preregistered three-case confirmatory matrix** completed all 12 frozen runs. Both workflows passed 5/6 executable runs and failed the same repetition of one mutation gate. LeanPowers used 50.03% of Superpowers' summed model tokens, passing the aggregate token decision, but its quality-bearing conformance was 0/6. The engineering-effect decision and combined target therefore failed. The complete sanitized result is in the [2026-07-15 confirmatory report](benchmarks/development-effects-confirmatory-2026-07-15.md).

A **newly frozen three-case follow-up matrix** also completed all 12 runs. Both workflows passed 4/6 executable runs. LeanPowers used 78.38% of Superpowers' summed model tokens and had 0/6 quality-bearing conformance, so the aggregate-token, engineering-effect, and combined decisions failed. A post-run audit found that the shared `stable-task-batches` failure included an under-specified null-prototype boundary; the limitation is recorded without changing the frozen verdict. The complete sanitized result is in the [2026-07-15 follow-up report](benchmarks/development-effects-confirmatory-followup-2026-07-15.md).

A **quality-first token matrix** completed another 12 frozen runs. Superpowers passed 2/6 and LeanPowers 3/6; neither reached the required 6/6. LeanPowers used 90.4% of Superpowers aggregate model tokens, missing the `<=60%` target. A post-run evaluator audit found two BUILD false negatives in the frozen 0/6 conformance result, but corrected diagnostic replay was still only 2/6 and did not change the overall FAIL. The complete sanitized result is in the [2026-07-15 quality-first report](benchmarks/development-effects-performance-confirmatory-v2-2026-07-15.md).

These five live checks are real coding evidence, but none is the full 11-scenario release benchmark. They lack the required coverage, repetitions for formal uncertainty, deterministic seeds, feedback-learning scenario, and full agent-call evidence. The pilot falls short of the current aggregate model-token share and wall-time efficiency targets; the held-out check fails its separate frozen engineering-effect and pairwise token rules; only the first confirmatory matrix passes its narrower aggregate token rule; all three multi-task matrices fail engineering effect. Current releases may cite these exact bounded observations, but may not claim general non-inferiority or release-gate success.

Files under `evals/fixtures/` explicitly use `"provenance": "simulated"`; they are test data for scorer behavior, not observations from real agent runs, and must not be cited as product results.

### Development-effects pilot

The executable pilot lives in [evals/development-effects/](../evals/development-effects/). It uses disposable repositories, explicit workflow activation, load-time workspace/verifier/fault-family snapshots, immutable Git baselines, per-run temporary homes, and delayed raw-artifact writes so later runs cannot read earlier solutions. Every run in a pair is materialized from the same in-memory workspace snapshot; the result records SHA-256 manifests for the suite, workspace tree, hidden verifier, and pre-registered semantic fault families, and an input-manifest mismatch makes the run matrix incomplete. Every candidate test run is fail-closed inside a no-network OS sandbox: macOS Seatbelt or Linux Bubblewrap. The workspace is read-only and only its disposable HOME is writable. Visible and hidden phases rebuild isolated copies at the same opaque path, so candidate code cannot infer the phase from `cwd`; hidden verifier source is executed from an in-memory snapshot instead of being copied into candidate-readable files. Artifact baseline/candidate counterfactuals likewise reuse one opaque path sequentially. The sandbox exposes an explicit runtime allowlist, blocks host user/volume/temp reads, bounds output, and redacts paths before persistence. Unsupported hosts or missing sandbox executables fail verification instead of running candidate code unsandboxed.

Cases may also declare workflow-neutral semantic fault families. Every member must preserve the immutable baseline tests, and every candidate-test counterfactual must complete. An `all-kill` family requires the candidate test delta to kill every member. The `replace-callable-export` operator rewrites exactly one registered direct named function or single-binding variable export in place. It adds no phase-only files, preserves all other module text and exports (including `default`), syntax-checks the transformed module before tests, and fails closed if the target or replacement does not match that explicit shape. The localized-cache case checks both name/locale inclusion directions and uses an empty-concatenation boundary-erasure representative (`name + locale`). Its explicit acceptance criterion requires distinct identities with identical concatenated text but different component boundaries, so the representative is killed without guessing a delimiter and without erasing order inside either component. It is a test instrument for boundary loss, not a claim that this exact implementation is a likely production bug. Family ID, policy, target, named export, member count/order, and hashes of the exact applied function fragments are bound into the case snapshot manifest. Public results expose only family-level counts and an evidence hash; detailed per-member commands remain in local raw artifacts. Missing test changes, byte-identical applied fragments, incomplete evidence, timeouts, signals, unsafe targets, baseline-invalid members, and unmet all-kill policies fail closed. Pilot suite/result schema version `2` intentionally rejects the earlier single-mutation shape. The checked-in 2026-07-14 pilot report predates this stronger gate and is not retroactively rescored.

```bash
node scripts/development-benchmark.mjs run \
  --suite evals/development-effects/pilot-suite.json \
  --superpowers-marketplace path/to/official-superpowers-v6.1.1 \
  --model gpt-5.5 \
  --out /tmp/leanpowers-development-pilot
```

The runner verifies that the Superpowers checkout is clean, uses the official `obra/superpowers` origin, and has `HEAD` exactly at `v6.1.1`. It also requires the LeanPowers checkout to be clean so every report records immutable commit SHAs.

### Frozen held-out check

The separate [held-out suite](../evals/development-effects/heldout-suite.json) froze its task, workflow revisions, counterbalanced order, hidden verifier, semantic fault families, decision rules, and agent read isolation before the first live run. All four executable repairs passed visible and hidden acceptance, mutation gates, artifact checks, and scope checks. The result still fails its preregistered engineering-effect rule because one LeanPowers run missed the frozen first-message conformance format, and it fails the `<=60%` token rule in both pairs. The parser result is retained rather than changed after observing the run. A post-run audit also found that the suite's frozen `standard` label did not resolve the route policy's `strict` treatment of concurrency, so this case is not clean risk-routing evidence; that limitation is likewise retained rather than reinterpreted. This single task cannot establish broad parity; workflow changes informed by it require a newly frozen task for future confirmation.

### Multi-task confirmatory checks

The [confirmatory matrix](../evals/development-effects/confirmatory-suite.json) and [its preregistration](benchmarks/development-effects-confirmatory-preregistration-2026-07-15.md) froze three task shapes, two counterbalanced repetitions, independent quality gates, and the aggregate token rule before execution. All 12 runs completed against the exact frozen revision and inputs. The [sanitized result](benchmarks/development-effects-confirmatory-2026-07-15.md) records equal executable pass counts of 5/6 and an aggregate LeanPowers token share of 50.03%, but the combined target remains unmet because the engineering-effect decision failed and LeanPowers conformance was 0/6. The frozen decision is not reclassified after workflow or evaluator changes. Any next confirmatory claim must use newly frozen tasks not used to tune those changes.

The [follow-up matrix](../evals/development-effects/confirmatory-followup-suite.json) and [its preregistration](benchmarks/development-effects-confirmatory-followup-preregistration-2026-07-15.md) froze three different task shapes under the same matrix size. The [sanitized result](benchmarks/development-effects-confirmatory-followup-2026-07-15.md) records equal executable pass counts of 4/6, a 78.38% aggregate LeanPowers token share, and 0/6 LeanPowers conformance. Both frozen decisions therefore failed. The shared task-batching failure is retained despite its under-specified null-prototype boundary. A prospective evaluator fix now treats narration between adjacent product and regression edits as presentation rather than a mutation-window boundary, while commands and other tools still split the window. This does not change the frozen result. The observed tasks are now calibration evidence; another confirmatory claim requires new unseen tasks.

The [quality-first matrix](../evals/development-effects/performance-confirmatory-v2-suite.json) and [its preregistration](benchmarks/development-effects-performance-confirmatory-v2-preregistration-2026-07-15.md) froze quality before aggregate model tokens and wall time. The [sanitized result](benchmarks/development-effects-performance-confirmatory-v2-2026-07-15.md) records Superpowers 2/6 and LeanPowers 3/6 Task PASS, a 90.4% aggregate LeanPowers token share, and frozen LeanPowers conformance of 0/6. A live-event status mismatch caused two BUILD false negatives; corrected diagnostic replay recognizes 2/6 overall, still below the requirement. The frozen decision is preserved because task outcome and aggregate tokens independently failed. These observed tasks are calibration evidence, and a future positive claim requires a corrected frozen evaluator plus new unseen cases.

The current [Agent Workflow Benchmark target](../evals/awb/leanpowers-target.draft.yaml) has a different role: it checks workflow contracts, routing, and expected behavioral responses. It does not edit disposable repositories or run independent hidden code tests, so it must not be cited as evidence of implementation quality, token efficiency, or development success. The development-effects pilot was added specifically to close that evidence gap.

## Public methodological foundations

`Agent Workflow Benchmark` is this project's implementation name. Its evaluation design is grounded in public methods rather than treated as a self-validating private standard:

- [Stanford HELM](https://crfm.stanford.edu/2022/11/17/helm.html) supplies the broad-coverage, multi-metric, standardized-comparison principles. The catalog must state both what it covers and what it omits.
- The [SWE-bench evaluation protocol](https://www.swebench.com/SWE-bench/api/harness/) supplies the executable distinction between fixing the target behavior (`FAIL_TO_PASS`) and preserving existing behavior (`PASS_TO_PASS`). LeanPowers adopts the protocol idea, not an assumption that any public dataset is permanently authoritative.
- [METR Task-Completion Time Horizons](https://metr.org/time-horizons/) supplies the reliability view across tasks calibrated by human expert completion time. This is useful for detecting whether a lighter workflow loses reliability as task length increases.
- The UK AI Security Institute's [Inspect AI](https://inspect.aisi.org.uk/) and the [Harbor task protocol](https://www.harborframework.com/docs/tasks) provide public implementation patterns for sandboxed agents, repeated trials, isolated verifiers, full trajectories, limits, and structured scoring.
- OpenAI's [playbook for trustworthy third-party evaluations](https://openai.com/index/trustworthy-third-party-evaluations-foundations/) supplies the claim-first validity audit: report harness effects and check reward hacking, refusals, contamination, broken problems, and evaluation awareness.
- The statistical framing adapts established non-inferiority design principles: choose the margin before observing results, report effect size and uncertainty, and distinguish non-inferiority from superiority. The [FDA guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/non-inferiority-clinical-trials) and [CONSORT extension](https://www.equator-network.org/reporting-guidelines/consort-non-inferiority/) are methodological references, not endorsements of this software benchmark.

As of the 2026-07-14 methodology snapshot, we are not aware of a widely adopted public standard specifically for comparing coding-workflow plugins. This protocol therefore combines established evaluation principles, executable correctness checks, reproducible agent harnesses, and paired statistical analysis. Public task sets may supply cases, but repository-specific workflow tasks remain necessary for delivery safety, dirty worktrees, false completion claims, authorization, and project-local feedback learning.

Public benchmark data also needs continuous validity review. OpenAI reported in February 2026 that SWE-bench Verified had become unsuitable for frontier capability claims because of flawed tests and contamination, then reported in July 2026 that roughly 30% of audited SWE-bench Pro tasks were broken and withdrew its earlier recommendation. See the [SWE-bench Verified audit](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/) and [SWE-bench Pro audit](https://openai.com/index/separating-signal-from-noise-coding-evaluations/). These findings reinforce the protocol's requirement for task-level audits, independent verification, and explicit broken-problem reporting; they do not invalidate executable paired testing as a method.

## Experimental design

For every pre-registered `scenario × seed/repetition` pairing unit, run once with Superpowers 6.1.1 and once with the candidate LeanPowers release. Use the same seed within each baseline/candidate pair and at least two paired repetitions per scenario; the final repetition count must be fixed by the pre-registered analysis plan. Hold these fields identical within each pair:

- model and reasoning configuration;
- repository snapshot and dirty-worktree state;
- prompt set and acceptance criteria;
- evaluator and evaluator rubric;
- paired random seed;
- tool permissions and runtime version;
- blind evaluation status.

Pre-register the baseline and candidate commits, non-inferiority margin, efficiency thresholds, scenario inventory, exclusions, repetitions, randomization method, scorer version, and analysis plan before inspecting results. Randomize or counterbalance workflow run order within each task. Report task-level paired outcomes and uncertainty, not only aggregate means.

The evaluator must not know which workflow produced an artifact. Record raw transcripts and command output outside the result summary so audits can reproduce each score.

The machine-readable workflow identity is deterministic: the baseline `workflow` must begin with `superpowers-`, the candidate must begin with `leanpowers-`, and their `run_id` values must differ. Benchmark result schema version `3` is the only accepted result format; version `2` predates complete aggregate model-token telemetry and is intentionally rejected. The catalog's own `schema_version: 1` and the development-effects suite/result `schema_version: 2` are separate format versions.

## Scenario coverage

The canonical catalog is [evals/benchmark-suite.json](../evals/benchmark-suite.json):

1. Small explicit feature.
2. Multi-file feature.
3. Known-cause defect.
4. Unknown-cause defect.
5. Configuration or build change.
6. API compatibility change.
7. Security, authorization, or data-risk work.
8. Review-only request.
9. Dirty-worktree and delivery task.
10. Seeded-defect mutation.
11. Multi-turn feedback learning.

Use multiple repositories and languages where practical. Mutations must be planted before the run and hidden from the agent under test.

### Multi-turn feedback-learning protocol

`multi-turn-feedback-learning` is one four-turn scenario executed under both workflows and identical pairing conditions:

1. The first task elicits a plausible but wrong project-specific assumption.
2. The user supplies an explicit corrective fact or reusable project rule.
3. A later related task tests whether the scoped correction improves accuracy.
4. An unrelated task tests whether the correction contaminates another scope.

The category is release-eligible only when related-task accuracy improves over its paired baseline, unrelated-task contamination is exactly zero, safety-gate bypass is exactly zero, and retrieval never exceeds three lessons. Learned content remains advisory: a gain achieved by bypassing authorization, risk, root-cause, regression, review, or verification gates is a hard failure, not an improvement.

## Result format

Each run must conform to [schemas/benchmark-result.schema.json](../schemas/benchmark-result.schema.json). The key sections are:

```json
{
  "schema_version": 3,
  "run_id": "unique-run-id",
  "workflow": "superpowers-6.1.1 or leanpowers-x.y.z",
  "provenance": "live",
  "completion": "complete",
  "conditions": {},
  "coverage": {},
  "quality": {},
  "learning_evidence": {
    "scenario": "multi-turn-feedback-learning",
    "related_task_accuracy": { "passed": 0, "total": 1 },
    "unrelated_task_contamination_count": 0,
    "safety_gate_bypass_count": 0,
    "max_retrieved_lessons": 0
  },
  "efficiency": {
    "overall": {
      "total_model_tokens": 1,
      "token_observations": 1
    },
    "standard": {
      "median_tokens": 1,
      "median_wall_seconds": 1,
      "median_agent_calls": 1
    }
  },
  "categories": [],
  "hard_failures": []
}
```

Quality records task success, composite score, critical defect escapes, introduced regressions, scope violations, false completion claims, unauthorized actions, and review severity accuracy. Efficiency records the total model tokens and number of token observations across all completed cases, plus standard-task median tokens, wall seconds, and agent calls. The positive values above are placeholders; a comparable run's observation count must equal its completed-case count.

`learning_evidence` is required on both runs. It is a closed object for the canonical four-turn scenario. Its related-task numerator and denominator must exactly match the `multi-turn-feedback-learning` category's task-success count; contamination and safety-bypass counts must be non-negative and cannot exceed that denominator; the maximum retrieved lesson count must be non-negative. Missing scenario coverage, missing evidence, invalid bounds, or mismatched category evidence makes the comparison `DIAGNOSTIC_ONLY`.

Every aggregate denominator (`task_success.total`, `introduced_regressions.total`, and `scope_violations.total`) must equal `coverage.completed_cases`. Category names must be a one-to-one partition of `coverage.scenario_classes`; category task totals and passed counts must reconcile to the aggregate task-success counts. These rules prevent partial or double-counted coverage from receiving a release verdict.

Each category includes nullable `strict_rerun` evidence. When present it records a distinct `run_id`, `live` or `simulated` provenance, `complete` or `incomplete` status, task-success counts, and composite quality. A regressing category is cleared only by a live, complete rerun whose task-success rate and composite quality both meet or exceed that baseline category. Missing or insufficient live evidence blocks; simulated or incomplete evidence makes the comparison `DIAGNOSTIC_ONLY`.

## Compare two runs

```bash
node scripts/benchmark.mjs compare \
  --baseline path/to/superpowers-live.json \
  --candidate path/to/leanpowers-live.json \
  --out path/to/report
```

The command writes `comparison.json` and `comparison.md`. Exit behavior:

- exit `0`: `PASS` or `DIAGNOSTIC_ONLY` output was produced;
- exit `2`: a comparable live pair was evaluated and blocked;
- exit `1`: usage, input, or runtime error.

Automation must inspect both the process status and the report's `decision` and `release_eligible` fields. `DIAGNOSTIC_ONLY` is not a pass.

To exercise the scorer without making product claims:

```bash
node scripts/benchmark.mjs compare \
  --baseline evals/fixtures/baseline-pass.json \
  --candidate evals/fixtures/leanpowers-pass.json \
  --out /tmp/leanpowers-fixture-report
```

This validates comparator mechanics only and returns `DIAGNOSTIC_ONLY` because both checked-in inputs are simulated.

## Release gates

All gates must pass:

| Gate | Threshold |
| --- | ---: |
| Overall task-success delta | at least `-3` percentage points |
| Composite quality ratio | at least `0.95` of baseline |
| Additional critical seeded-defect escapes | `0` |
| Introduced-regression rate delta | no more than `+2` percentage points |
| Scope-violation rate delta | no more than `+2` percentage points |
| Overall model-token share | at most `60%` (`Σ LeanPowers / Σ Superpowers` across all completed cases) |
| Standard-task median wall-time reduction | at least `40%` |
| Standard-task median agent-call reduction | at least `60%` |
| Related-task learning accuracy | improve over paired baseline |
| Unrelated-task lesson contamination | exactly `0` |
| Safety-gate bypass attributed to learning | exactly `0` |
| Retrieved lessons per task | at most `3` |

Hard failures dominate aggregate scores. A critical escape, unauthorized high-risk action, known false completion, or equivalent hard failure blocks release. A regressing scenario category must be rerun through strict mode and meet its baseline before release.

The `-3` percentage-point task-success gate is the predeclared non-inferiority margin for this project. The current deterministic comparator treats it as a mechanical point-estimate screen. A formal published non-inferiority claim must additionally report a paired uncertainty interval that remains on the acceptable side of the margin; until that analysis is encoded in the result schema, it is an explicit external reporting requirement and validation gap. Efficiency metrics are separate superiority targets and must not compensate for a quality or safety gate failure. The token target is the ratio of summed LeanPowers model tokens to summed Superpowers model tokens across the complete matched matrix, not a requirement that every individual pair stay below 60%. Quality remains an independent hard gate, while paired medians, maxima, and missing telemetry must still be reported so the aggregate cannot hide where the workflow is expensive.

The comparator executes all four learning gates from each run's validated `learning_evidence`. Candidate related-task accuracy must be strictly greater than baseline, while contamination and safety bypass must both be zero and maximum retrieval must be at most three. A valid comparable live pair that fails any learning gate is `BLOCK`; simulated evidence remains `DIAGNOSTIC_ONLY` regardless of its values.

## Comparability rules

The comparator returns `DIAGNOSTIC_ONLY` when either run is simulated or incomplete, evaluation is not blind, pairing conditions differ, planned coverage is incomplete, scenario/category coverage does not match, the paired runs use different `task_success.total` values for any category, aggregate token telemetry does not cover every completed case, or the two runs report different token-observation counts. Per-category case totals must be identical so a rate cannot improve by silently changing the denominator; per-category passed counts may differ. Missing aggregate token fields are invalid schema-v3 input and likewise cannot produce a release verdict. A diagnostic result may improve the harness but cannot authorize release.

Strict-risk scenarios prioritize quality. Their efficiency savings may be smaller, but they still contribute to hard-failure and non-inferiority gates.

## Reporting checklist

A published benchmark report must include:

- LeanPowers and Superpowers versions or commit SHAs;
- model/runtime versions and reasoning configuration;
- repository revisions, prompts, seeds, and evaluator rubric;
- complete scenario and mutation inventory;
- raw-run artifact location and redaction policy;
- aggregate and per-category results with uncertainty;
- every hard failure and validation gap;
- scorer-generated JSON and Markdown reports;
- turn-level feedback-learning judgments: correction capture, related result, unrelated result, safety decision, and retrieved lesson count.

Do not publish fixture values as measured results. Do not convert `DIAGNOSTIC_ONLY` into a prose claim of success.
