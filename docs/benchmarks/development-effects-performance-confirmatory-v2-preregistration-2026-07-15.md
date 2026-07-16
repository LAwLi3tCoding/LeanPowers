# Performance confirmatory v2 preregistration

Date frozen: 2026-07-15, before any live model run against this suite.

Status: **tasks, hidden acceptance, fault families, execution contract, retry policy, and decision rules frozen; no live output inspected**.

Superpowers 6.1.1 is the upstream reference workflow and the principal inspiration for LeanPowers. This study measures a bounded lightweight design tradeoff; it is not a ranking of the projects or a claim of general superiority.

The priority order is fixed: **quality > aggregate model tokens > wall time**. Token or speed improvements never compensate for a correctness error, hidden-acceptance failure, missing necessary test/debug/verification work, or invalid comparison.

## Frozen execution contract

| Field | Frozen value |
| --- | --- |
| Suite | `development-effects-performance-confirmatory-v2-2026-07-15` |
| Suite SHA-256 | `b0f721408de7bfbe04521d5df68c4d1bf2f5ff57ca5233aae61729a234b6f540` |
| Runtime | Codex CLI |
| Model | `gpt-5.3-codex-spark` |
| Reasoning effort | `low` |
| Repetitions | `2` |
| Matrix | `3 cases × 2 repetitions × 2 workflows = 12 runs` |
| Pairing | identical task, snapshot, verifier, model, effort, evaluator, isolation, and counterbalanced order |
| Order | repetition 1: Superpowers then LeanPowers; repetition 2: LeanPowers then Superpowers |
| Superpowers revision | `d884ae04edebef577e82ff7c4e143debd0bbec99` (`v6.1.1`) |
| LeanPowers/evaluator revision | one clean revision committed after this freeze and before the first live run |
| Agent read isolation | `codex-minimal-workspace-plugin-toolchain-read-v1` |
| Network | disabled inside every agent run |

A partial matrix, changed suite SHA, changed case snapshot, revision mismatch, failed isolation preflight, missing positive telemetry, duplicate/missing run, or post-freeze evaluator change makes the result ineligible. The selected output directory must be empty before any live call; summary and raw artifacts are created exclusively. Once live output has been inspected, any workflow, task, oracle, mutant, scoring, or retry-policy change turns later executions of this suite into calibration rather than confirmatory evidence.

## Frozen tasks and reporting categories

| Reporting category | Case | Owner | Pairs | Workspace SHA-256 | Hidden verifier SHA-256 | Mutants SHA-256 |
| --- | --- | --- | ---: | --- | --- | --- |
| collection-transform build | `coalesced-half-open-intervals` | build | 2 | `c3656fd00128b0247a2d644262d12e431515fb96ab649cfedd1d171f9d1bf469` | `d6601ae710dbcaa7d603b1f432a255cbef1f072b422105c84f70245ea54b5cc8` | `b6d730105248f9c4dd621c8e90c395e8b7e3cf375a0f41414fc3614adb669937` |
| Unicode parser build | `escaped-field-parser` | build | 2 | `8e2991981e823e4006dfc76dc74a4dcb81083b8ae77841313967ad6a32dee7f5` | `2463ff4b071df34a75afba6ffb02988db95bd764d74a1ac08d5f1c478f9de700` | `b03979d6bc93ece6c3a9cf0e4214116068c58c9bf4f66e77110c98868993d87a` |
| transactional-state debug | `transactional-batch-flush` | debug | 2 | `8ee9a973abfa9274e1988f9d6a694f8a42ab3b7fc9a1d4e7c3794c44f67e9ee3` | `b79a524e7aae87e6396cbdaaa7a90497c9a59b96ca3a24a768821c45af618f97` | `95e25ae14050943ef57e3b7086c1a4c98964f99e6396c1cd172655fef31670b0` |

The final report must show each category separately and also aggregate owner views for build (`4` pairs) and debug (`2` pairs). Categories are diagnostic partitions fixed before execution; the six-pair aggregate remains the primary Token decision.

The fixtures contain `20` semantic fault families and `24` independent mutants. The committed static audit must prove before live execution that every pristine workspace passes visible tests and fails hidden acceptance, the debug reproduction exactly matches its frozen structured transition, reference repairs pass visible and hidden acceptance, every mutant survives baseline visible tests, the ideal candidate delta kills every mutant, and verifier/mutation execution restores the workspace fingerprint. Copying hidden assertions into the ideal delta is only a deterministic gate-reachability check, not an independent second oracle.

## Quality decision

The quality gate passes only when:

- both workflows pass all `6/6` task runs (`12/12` total runs);
- every run passes visible tests, hidden acceptance, all case-owned fault families, changed-path scope checks, and repository-integrity checks;
- LeanPowers passes workflow conformance `6/6`;
- Superpowers reports activation `6/6`;
- no run has a known correctness error, critical boundary omission, false completion claim, scope violation, or unauthorized action; and
- the per-category results show no obvious or systematic quality degradation.

Necessary tests, debugging, validation, or risk-appropriate review may not be skipped to improve tokens or time.

## Aggregate Token decision

The primary statistic is:

`sum(LeanPowers model tokens across all six valid runs) / sum(Superpowers model tokens across all six matched runs)`

Interpretation is frozen as follows:

- `<=60%`: target met.
- `>60%` and `<=65%`: preregistered near-target band. The machine gate returns `REVIEW`, not `PASS`; it is acceptable only after every quality gate passes and the final categorized report explains the overage using task distribution, observed pair variation, or necessary correctness work that cannot safely be removed.
- `>65%`: target missed.

This is an aggregate target, never a per-case or per-category hard threshold. Complex/debug work may exceed 60%, while simple explicit work may be substantially below it. All six pairs require complete positive model-token telemetry. Cached/fresh/output tokens, per-pair shares, tool calls, attempts, and workflow reads remain diagnostics used to identify the main Token sources by category.

## Wall-time decision

Wall time is secondary. Every valid pair must have complete final-attempt wall telemetry, and the final report must include each category's workflow medians and LeanPowers acceleration/slowdown.

- A positive six-pair median reduction is a speed improvement.
- A median change from `0%` through `-20%` is reported as not improved and requires category-level explanation, but it does not override a valid quality/Token result.
- A median reduction below `-20%` is a material regression and fails the gate.

No Token or wall statistic includes capacity-retry overhead.

## Capacity and invalid-run policy

Only the exact terminal error `Selected model is at capacity. Please try a different model.` may retry, and only when the failed attempt has no complete token telemetry. The retry limit is one and it must use a fresh disposable workspace and home.

The final attempt supplies the primary token and wall measurements. Failed capacity time is retained separately as infrastructure retry wall time. A second capacity failure remains failed/incomplete. Capacity retry counts must be disclosed by workflow. Agent, task, verifier, conformance, or ordinary command failures never receive this infrastructure retry. Raw transcripts and workspaces remain local.

## Final report contract

For every frozen category, report:

- category and sample count;
- LeanPowers and Superpowers quality results;
- Token totals and medians;
- LeanPowers Token share of Superpowers;
- median wall time for both workflows and acceleration/slowdown;
- main Token and time sources; and
- remaining quality and statistical risks.

Also report the six-pair aggregate, build/debug owner aggregates, capacity failures, telemetry gaps, invalid pairs, and why any near-target Token result is or is not acceptable.

The earlier `development-effects-performance-confirmatory-2026-07-15` suite informed workflow calibration and cannot serve as confirmation for this optimization. This v2 matrix is intentionally small and bounded to one model/runtime; even a passing result is evidence for this task mix, not universal equivalence or superiority.
