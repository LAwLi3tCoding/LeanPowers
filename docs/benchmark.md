# LeanPowers benchmark protocol

The benchmark tests the product promise: materially lower workflow overhead without a meaningful engineering-quality regression versus Superpowers 6.1.1.

## Current status

The repository contains the scenario catalog, result schema, deterministic comparator, and scorer fixtures. **A paired live benchmark has not yet been executed.** Files under `evals/fixtures/` are test data for scorer behavior, even when a fixture uses `"provenance": "live"`; they are not observations from real agent runs and must not be cited as product results.

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

Use multiple repositories and languages where practical. Mutations must be planted before the run and hidden from the agent under test.

## Result format

Each run must conform to [schemas/benchmark-result.schema.json](../schemas/benchmark-result.schema.json). The key sections are:

```json
{
  "schema_version": 1,
  "run_id": "unique-run-id",
  "workflow": "superpowers-6.1.1 or leanpowers-x.y.z",
  "provenance": "live",
  "completion": "complete",
  "conditions": {},
  "coverage": {},
  "quality": {},
  "efficiency": {},
  "categories": [],
  "hard_failures": []
}
```

Quality records task success, composite score, critical defect escapes, introduced regressions, scope violations, false completion claims, unauthorized actions, and review severity accuracy. Efficiency records standard-task median tokens, wall seconds, and agent calls.

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

This validates comparator mechanics only.

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

Hard failures dominate aggregate scores. A critical escape, unauthorized high-risk action, known false completion, or equivalent hard failure blocks release. A regressing scenario category must receive a stricter fallback and be rerun before release.

## Comparability rules

The comparator returns `DIAGNOSTIC_ONLY` when either run is simulated or incomplete, evaluation is not blind, pairing conditions differ, planned coverage is incomplete, or scenario/category coverage does not match. A diagnostic result may improve the harness but cannot authorize release.

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
- scorer-generated JSON and Markdown reports.

Do not publish fixture values as measured results. Do not convert `DIAGNOSTIC_ONLY` into a prose claim of success.
