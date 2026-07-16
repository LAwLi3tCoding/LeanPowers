# Performance confirmatory v3 preregistration

Date frozen: 2026-07-15, before any live model run against this suite.

Status: **task text, snapshots, hidden acceptance, mutants, execution revisions, reporting categories, retry policy, and decision rules are frozen; no live output has been inspected**.

[Superpowers](https://github.com/obra/superpowers) 6.1.1 is the upstream reference workflow and the principal inspiration for LeanPowers. LeanPowers is testing whether it can preserve the engineering safeguards learned from that work with a smaller control surface. This comparison evaluates LeanPowers against its own lightweight-design target; it is not a winner-ranking exercise and does not claim that either project is generally superior.

The priority order is fixed: **quality > aggregate model tokens > wall time**. Lower Token use or faster completion never compensates for a correctness failure, missing necessary test or debugging work, skipped risk-appropriate review, false completion claim, or invalid comparison.

## Frozen execution contract

| Field | Frozen value |
| --- | --- |
| Suite | `development-effects-performance-confirmatory-v3-2026-07-15` |
| Suite file | `evals/development-effects/performance-confirmatory-v3-suite.json` |
| Suite SHA-256 | `cbace9b1542ad9e6f2d65d1b63a25e1f3e2f9f26621db64fb7c00caf02b08b40` |
| Report contract | `categorized-exact-render-v1` |
| Runtime | Codex CLI |
| Model | `gpt-5.3-codex-spark` |
| Reasoning effort | `low` |
| Repetitions | `2` |
| Matrix | `3 cases × 2 repetitions × 2 workflows = 12 runs` |
| Pairing | identical task, snapshot, verifier, model, effort, evaluator, isolation, and counterbalanced order |
| Order | repetition 1: Superpowers then LeanPowers; repetition 2: LeanPowers then Superpowers |
| Superpowers revision | `d884ae04edebef577e82ff7c4e143debd0bbec99` (`v6.1.1`) |
| LeanPowers revision | `94c491a14e61c931dfa1261fb75c92d42ac66a49` |
| Evaluator revision | `94c491a14e61c931dfa1261fb75c92d42ac66a49` |
| Runner revision | `94c491a14e61c931dfa1261fb75c92d42ac66a49` |
| Agent read isolation | `codex-minimal-workspace-plugin-toolchain-read-v1` |
| Network | disabled inside every agent run |

The suite JSON is the canonical source for exact task wording, workspace and verifier snapshots, reproduction outputs, commands, allowed paths, and mutant manifests. Its digest freezes all of those inputs together. A revision mismatch, changed suite digest, failed isolation preflight, duplicate or missing run, changed report renderer, or post-freeze evaluator change makes the result ineligible.

## Frozen tasks and reporting categories

| Reporting category | Case | Owner | Risk | Pairs | Acceptance focus |
| --- | --- | --- | --- | ---: | --- |
| atomic migration build | `atomic-config-migrations` | build | strict | 2 | contiguous ordered migrations, atomic commit or rollback, validation, input immutability, and fresh snapshots |
| stable priority build | `stable-priority-merge` | build | lean | 2 | highest-priority duplicate selection, encounter-order tie stability, exact validation, immutability, and fresh records |
| generation-guarded cache debug | `generation-guarded-refresh-cache` | debug | strict | 2 | per-key in-flight sharing, generation-guarded writes, stale fulfillment and rejection isolation, and exact reproduction resolution |

The final report must show each category separately and also aggregate owner views for build (`4` pairs) and debug (`2` pairs). Categories are diagnostic partitions fixed before execution; the aggregate over all valid matched pairs remains the primary Token decision.

The fixtures contain `19` independent mutants: seven for atomic migrations, seven for stable priority merge, and five for the generation-guarded cache. Before the live matrix, the committed static audit must prove that:

1. every pristine workspace passes its visible tests and fails hidden acceptance;
2. the debug reproduction emits the exact frozen first-incorrect-transition output;
3. the reference debug repair emits the exact frozen resolved output;
4. every reference repair passes visible and hidden acceptance;
5. every mutant survives the baseline visible tests and is killed by the ideal candidate-test delta; and
6. verifier and mutation execution restore the workspace fingerprint.

These deterministic checks establish fixture and gate reachability. They are not live comparative evidence and do not replace the hidden verifier.

## Quality decision

Quality passes only when:

- Superpowers passes all `6/6` task runs and LeanPowers passes all `6/6` task runs;
- every run passes visible tests, hidden acceptance, all case-owned mutant families, changed-path scope checks, and repository-integrity checks;
- LeanPowers passes workflow conformance `6/6`, including pre-change evidence, the required BUILD or DEBUG protocol, bounded DEBUG recovery when exercised, current validation, risk-appropriate independent review, and final stop behavior;
- Superpowers reports activation `6/6`;
- no run has a known correctness error, critical boundary omission, false completion claim, scope violation, unauthorized action, or unresolved infrastructure outcome; and
- the per-category evidence shows no obvious or systematic LeanPowers quality degradation.

Superpowers activation and LeanPowers conformance are workflow-specific validity checks, not like-for-like discipline scores. Necessary tests, debugging, validation, or strict-case review may not be skipped to improve Tokens or time.

## Aggregate model-token decision

The primary statistic is:

`sum(LeanPowers model tokens across all valid matched pairs) / sum(Superpowers model tokens across the same valid matched pairs)`

Its interpretation is frozen:

- `<=60%`: Token target met.
- `>60%` and `<=65%`: preregistered near-target band. The machine gate returns `REVIEW`, never `PASS`. It is acceptable only if every quality gate passes and the categorized report explains the overage through the frozen task distribution, observed pair variation, or necessary correctness work that cannot safely be removed.
- `>65%`: Token target missed.

This is an aggregate target, not a per-case, per-category, or per-owner threshold. A pair remains in the Token population when task or conformance evaluation fails but both final attempts have valid telemetry; quality failure is not a license to discard an expensive run. Per-pair shares, cached and fresh input, output and reasoning tokens, tool calls, attempts, and workflow reads are diagnostic only.

## Wall-time decision

Wall time is secondary to quality and aggregate Tokens. The report must include each category's workflow medians and the median of paired LeanPowers acceleration or slowdown.

- A positive six-pair median reduction is a speed improvement.
- A median change from `0%` through `-20%` is reported as not improved and requires a category-level explanation, but does not override a valid quality and Token result.
- A median reduction below `-20%` is a material regression and fails the gate.

Capacity-retry overhead is disclosed separately and is not included in the paired wall statistic.

## Capacity, telemetry, and exclusion policy

Only the exact terminal error `Selected model is at capacity. Please try a different model.` may retry. It may retry once, only when the failed attempt has no complete Token telemetry, and must use a fresh disposable workspace and home. The final attempt supplies primary Token and wall measurements; failed-attempt capacity time is retained only as infrastructure retry time.

A second exact capacity failure is recorded as infrastructure `INCOMPLETE`, with primary Token and wall values set to null. Its pair is excluded from valid-pair efficiency aggregates, disclosed in the report, and prevents the complete quality target from passing. Agent, task, verifier, conformance, timeout, or ordinary command failures never receive this infrastructure retry.

Every included run must have complete positive model-token telemetry, internally consistent token arithmetic, and complete final-attempt wall telemetry. Missing, non-positive, malformed, or arithmetically inconsistent telemetry excludes the affected pair from valid-pair aggregates, appears under validity exclusions, and makes the confirmatory result ineligible for PASS. The gate must recompute aggregates from raw runs rather than trust stored summaries.

## Exact report contract

The publication artifact must be the byte-for-byte canonical report rendered from the raw result by the frozen evaluator. The result gate receives the result, frozen suite, and report together and rejects any report that differs from that canonical rendering.

The report must include:

- quality, Token, and wall evidence for each frozen category;
- aggregate build and debug owner views;
- the six-pair aggregate over valid matched pairs;
- LeanPowers, Superpowers, evaluator, and runner revisions;
- capacity attempts and infrastructure failures;
- telemetry gaps, malformed runs, and every invalid or excluded pair;
- main Token and time sources by category;
- remaining quality, validity, and small-sample risks; and
- an explicit explanation of any `60–65%` REVIEW decision.

The report must preserve the upstream relationship: Superpowers is the reference and inspiration, while the measured question is whether this LeanPowers revision met its own frozen tradeoff target. Descriptive differences are not project rankings.

## One-matrix and no-tuning rule

Exactly one complete live matrix is authorized for confirmatory interpretation. The selected output directory must be empty before the first agent call, and the runner must produce exactly the 12 frozen runs in the counterbalanced order. Partial runs, selective reruns, replacement runs, or a second execution chosen after inspecting results cannot supplement or improve the confirmatory score.

After any live output is inspected, no workflow, task, task wording, workspace, reproduction, oracle, mutant, scoring rule, retry rule, renderer, or evaluator may be edited in response and then rerun as if it were the same confirmation. Any later run is calibration evidence and requires a new unseen suite and preregistration for a new confirmatory claim.

## Evidence boundary

This remains a small paired sample: three tasks, two repetitions, one model, one reasoning effort, one runtime, and six matched pairs. A passing result would be bounded evidence for this task mix, not proof of universal equivalence, general superiority, or project ranking. Raw transcripts and disposable workspaces remain local; only sanitized aggregates and repository-relative findings may be published.

The v2 suite has already informed the present workflow and evaluator changes and is calibration-only. This v3 suite uses new unseen tasks and the frozen baseline revisions above so that its single live matrix can answer the prospective quality-first question without result-driven task edits.
