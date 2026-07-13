# LeanPowers benchmark protocol

The benchmark tests the product promise: materially lower workflow overhead without a meaningful engineering-quality regression versus Superpowers 6.1.1.

## Current status

The repository contains the scenario catalog, result schema, deterministic comparator, and scorer fixtures. **A paired live benchmark has not yet been executed.** Files under `evals/fixtures/` explicitly use `"provenance": "simulated"`; they are test data for scorer behavior, not observations from real agent runs, and must not be cited as product results.

Therefore, no current release may claim measured non-inferiority, token reduction, wall-time reduction, or agent-call reduction from these fixtures.

## Experimental design

Run each scenario twice: once with Superpowers 6.1.1 and once with the candidate LeanPowers release. Hold these fields identical:

- model and reasoning configuration;
- repository snapshot and dirty-worktree state;
- prompt set and acceptance criteria;
- evaluator and evaluator rubric;
- unique random seeds, with at least two seeds;
- tool permissions and runtime version;
- blind evaluation status.

The evaluator must not know which workflow produced an artifact. Record raw transcripts and command output outside the result summary so audits can reproduce each score.

The machine-readable workflow identity is deterministic: the baseline `workflow` must begin with `superpowers-`, the candidate must begin with `leanpowers-`, and their `run_id` values must differ. Benchmark result schema version `2` is the only accepted result format; version `1` predates required learning evidence and is intentionally rejected. The catalog's own `schema_version: 1` is a separate format version.

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
  "schema_version": 2,
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
  "efficiency": {},
  "categories": [],
  "hard_failures": []
}
```

Quality records task success, composite score, critical defect escapes, introduced regressions, scope violations, false completion claims, unauthorized actions, and review severity accuracy. Efficiency records standard-task median tokens, wall seconds, and agent calls.

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
| Standard-task median token reduction | at least `50%` |
| Standard-task median wall-time reduction | at least `40%` |
| Standard-task median agent-call reduction | at least `60%` |
| Related-task learning accuracy | improve over paired baseline |
| Unrelated-task lesson contamination | exactly `0` |
| Safety-gate bypass attributed to learning | exactly `0` |
| Retrieved lessons per task | at most `3` |

Hard failures dominate aggregate scores. A critical escape, unauthorized high-risk action, known false completion, or equivalent hard failure blocks release. A regressing scenario category must be rerun through strict mode and meet its baseline before release.

The comparator executes all four learning gates from each run's validated `learning_evidence`. Candidate related-task accuracy must be strictly greater than baseline, while contamination and safety bypass must both be zero and maximum retrieval must be at most three. A valid comparable live pair that fails any learning gate is `BLOCK`; simulated evidence remains `DIAGNOSTIC_ONLY` regardless of its values.

## Comparability rules

The comparator returns `DIAGNOSTIC_ONLY` when either run is simulated or incomplete, evaluation is not blind, pairing conditions differ, planned coverage is incomplete, scenario/category coverage does not match, or the paired runs use different `task_success.total` values for any category. Per-category case totals must be identical so a rate cannot improve by silently changing the denominator; per-category passed counts may differ. A diagnostic result may improve the harness but cannot authorize release.

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
