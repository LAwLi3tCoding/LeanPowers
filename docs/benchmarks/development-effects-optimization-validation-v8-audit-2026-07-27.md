# Optimization validation v8 unscored audit

This audit records the unique authorized v8 live attempt without converting it into a scored result. The frozen suite remains `development-effects-optimization-validation-v8-2026-07-26` with SHA-256 `6a02130910b6051a06f398ebe0036b708b374185c38e0ef829644be89391aa01`. The suite, model, effort, closed tool policy, revisions, case snapshots, and decision rules are those declared in the [v8 preregistration](development-effects-optimization-validation-v8-preregistration-2026-07-26.md).

## Result status

Status: **UNSCORED pre-task infrastructure failure**.

Comparative decision: **INELIGIBLE**.

On 2026-07-27, the authorized live attempt failed before any `START` event or task run. The exact terminal error was:

```text
Codex model/tool preflight requires exactly one command_execution tool call
```

The output directory was empty. No `pilot-result.json`, `pilot-report.md`, `gate-result.json`, or equivalent scored artifact was produced.

## Interpretation

The failure occurred in the live runner's model/tool preflight, before any workflow saw a benchmark task. It therefore provides no task outcome, conformance, semantic-mutation, Token, wall-time, or paired-efficiency metric.

Do not cite this attempt as a zero-run model-quality result, a workflow-quality result, or a measured efficiency result. The standalone prefreeze calibration had passed with the same intended model/tool policy, but that calibration is compatibility evidence only. It is not live task evidence and does not rescue the failed live attempt.

## Frozen-record policy

V8 is not rerun, repaired, or rescored after this failure. The frozen suite is now observed and cannot be used for a future positive claim. Any future effectiveness, quality, Token, wall-time, or conformance claim must use a newly frozen unseen suite.

## Current evidence boundary

The latest scored development-effects result remains V7. The V8 attempt adds only a pre-task infrastructure failure record and a harness hardening target: the live preflight must distinguish standalone calibration from workflow-home preflight execution before any future freeze is used for a comparative claim.

The prospective runner hardening added after this observed attempt does not alter or backfill the V8 record. For a future newly frozen suite, `preflight-workflows` prepares and checks both installed workflow homes before live authorization, persists the complete runner, evaluator, and workflow revision provenance, and the live runner repeats those checks. A known live pre-task failure now writes only a sanitized `preflight-failure.json` with `matrix_status: INCOMPLETE` and `comparative_decision: INELIGIBLE`; it cannot create `pilot-result.json`, `pilot-report.md`, or `gate-result.json`. V8 itself remains empty-output and `UNSCORED`.
