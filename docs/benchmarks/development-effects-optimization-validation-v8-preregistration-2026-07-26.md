# Optimization validation v8 preregistration

Date frozen: 2026-07-26, before any live model run against this suite.

Status: **task text, hidden acceptance, semantic fault families, workspace and verifier snapshots, model, reasoning effort, closed tool policy, workflow and case order, execution revisions, isolation policy, quality policy, Token target, and decision rules are frozen; no live task output has been inspected**.

This matrix evaluates the usage-driven LeanPowers optimization implemented after the frozen v7 failure analysis. It does not rerun, rescore, or reinterpret v7. Superpowers 6.1.1 remains the upstream reference and principal engineering inspiration. The measured question is whether the pinned LeanPowers revision satisfies its own quality-first lightweight-workflow target on three newly calibrated tasks under identical runtime conditions.

## Frozen execution contract

| Field | Frozen value |
| --- | --- |
| Suite | `development-effects-optimization-validation-v8-2026-07-26` |
| Suite file | `evals/development-effects/optimization-validation-v8-suite.json` |
| Suite SHA-256 | `6a02130910b6051a06f398ebe0036b708b374185c38e0ef829644be89391aa01` |
| Evidence level | `paired-development-heldout` |
| Runtime | Codex CLI |
| Model | `gpt-5.5` |
| Reasoning effort | `medium` |
| Disabled feature | `image_generation` |
| Required tool event | `command_execution` |
| Repetitions | `2` |
| Matrix | `3 cases × 2 repetitions × 2 workflows = 12 runs` |
| Independent task clusters | `3`; repetitions are paired repeats, not independent tasks |
| Workflow order | repetition 1: Superpowers then LeanPowers; repetition 2: LeanPowers then Superpowers |
| Case order | repetition 1: suite order; repetition 2: exact reverse suite order |
| Superpowers revision | `d884ae04edebef577e82ff7c4e143debd0bbec99` (`v6.1.1`) |
| LeanPowers revision | `3106f9d0081fb90e7dbab25227ab56351e1318e8` |
| Evaluator revision | `3106f9d0081fb90e7dbab25227ab56351e1318e8` |
| Runner revision | `3106f9d0081fb90e7dbab25227ab56351e1318e8` |
| Agent read isolation | `codex-minimal-workspace-plugin-toolchain-read-v1` |
| Quality policy | `lean-all-pass-reference-diagnostic-v1` |
| Token target | aggregate LeanPowers model tokens at most `60%` of Superpowers across all matched pairs |
| Network | disabled inside every agent task run |

The suite JSON is canonical for exact task wording, change policy, hidden verifier source, semantic mutants, reproduction contract, case snapshots, and both matrix orders. Any mismatch in those inputs, the frozen revisions, model, effort, tool policy, isolation preflight, run population, or canonical report makes the result ineligible for PASS.

## Model and tool compatibility freeze

Before suite freeze, the exact pinned implementation ran the standalone compatibility preflight with Codex CLI `0.142.5`, model `gpt-5.5`, effort `medium`, and `image_generation` disabled. The preflight passed with exactly one successful `command_execution`, no other tool event, complete Token telemetry, and an unchanged disposable workspace:

| Metric | Frozen calibration evidence |
| --- | ---: |
| Input tokens | `23,673` |
| Cached input tokens | `13,056` |
| Output tokens | `89` |
| Reasoning output tokens | `0` |
| Total tokens | `23,762` |
| Uncached input plus output | `10,706` |
| Tool calls | `1` |
| Wall seconds | `21.194048125000002` |
| Evidence SHA-256 | `8b8ee4f0abcfc34dad5d4ad822b24c5d6cf23852329fbfc673b5dd2ecf8c560c` |

The live runner must repeat the same preflight independently for both workflow homes before creating the first task run. The result gate rejects a missing policy, a policy mismatch, incomplete Token arithmetic, a tool count other than one, a non-positive wall time, or a changed disposable workspace. This is a compatibility gate only; it does not count as task-quality or efficiency evidence.

## Frozen tasks and novelty

| Category | Case | Owner | Risk | Pairs | Acceptance focus |
| --- | --- | --- | --- | ---: | --- |
| stable multiset subtraction build | `stable-multiset-subtract` | `build` | lean | 2 | counted exact-token removal, left-to-right stability, accessor-safe validation, freshness, and immutability |
| retry budget reset debug | `retry-budget-success-reset` | `debug` | standard | 2 | reproduction-led success reset, strict boundary, reason identity, snapshot isolation, and final reproduction attribution |
| bearer credential strict build | `bearer-credential-boundary` | `build` | strict | 2 | exact case-insensitive scheme, whitespace and prefix boundaries, token charset and length, no coercion, and independent strict review |

The committed calibration test proves before the live run that:

1. no v8 case ID or normalized task digest appears in an earlier suite;
2. every task family is outside the manually audited historical family registry;
3. the nine workspace, verifier, and aggregate-mutant snapshot digests are new and mutually distinct;
4. every pristine workspace passes visible tests and fails hidden acceptance;
5. the DEBUG reproduction emits the frozen first-incorrect-transition object;
6. every reference repair passes visible and hidden acceptance;
7. the resolved DEBUG reproduction matches its frozen object;
8. all twelve semantic mutants survive the baseline visible tests and are killed by the ideal candidate-test delta; and
9. verifier and mutation execution leave the workspace fingerprint unchanged.

These are deterministic fixture-validity checks, not observations of model performance.

## Decision rules

Quality is primary. LeanPowers quality passes only if all `6/6` LeanPowers runs pass visible tests, hidden acceptance, every case-owned semantic mutation gate, changed-path scope checks, repository-integrity checks, and the frozen workflow-conformance contract. The strict authentication case additionally requires a fresh independent read-only PASS review after green validation with no later mutation. Superpowers outcomes remain same-condition reference diagnostics and are reported separately.

The aggregate Token statistic is:

`sum(LeanPowers model tokens across all telemetry-valid matched pairs) / sum(Superpowers model tokens across the same pairs)`

- `<=60%`: Token target met.
- `>60%` and `<=65%`: near-target `REVIEW`, never automatic PASS.
- `>65%`: Token target missed.

Every run must have complete positive Token and final-attempt wall telemetry with consistent arithmetic. Missing or malformed telemetry invalidates the affected pair and prevents overall PASS. Task or conformance failure does not remove an otherwise telemetry-valid pair from the aggregate.

Wall time is secondary. A positive paired median reduction is an improvement. A median change from `0%` through `-20%` requires explanation but does not override valid quality and Token evidence. A reduction below `-20%` is a material regression and fails the gate. Infrastructure retry time is disclosed separately.

The canonical machine result is produced once from the raw run matrix and frozen suite. `result.json`, `report.md`, and `gate-result.json` must agree under the shared adjudicator. A post-run audit may explain the result but may not alter it.

## One-matrix rule and bounded claims

This suite is executed once after this freeze. It will not be rerun, repaired, or rescored after output is inspected. Infrastructure failures, agent failures, fixture discoveries, unexpected costs, or negative results remain part of the frozen record. Any prospective repair requires a different unseen suite.

Three independent task clusters are too small for a general parity, non-inferiority, superiority, speed, or cost claim. Even an overall PASS would support only a bounded statement about this exact matrix, revisions, model, effort, and harness. A FAIL or diagnostic result remains useful evidence about the optimization and is published without reinterpretation.
