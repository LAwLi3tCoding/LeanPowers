# Performance confirmatory v5 preregistration

Date frozen: 2026-07-16, before any live model run against this suite.

Status: **task text, semantic families, snapshots, hidden acceptance, mutants, execution revisions, reporting categories, retry policy, report renderer, and decision rules are frozen; no live output has been inspected**.

[Superpowers](https://github.com/obra/superpowers) 6.1.1 is the upstream reference and principal inspiration for LeanPowers. LeanPowers is evaluating whether the engineering safeguards learned from that work can be preserved with a smaller runtime control surface. This is a test of LeanPowers against its own lightweight-design target, not a project ranking or a claim that either project is generally superior.

The fixed priority is **quality > aggregate model tokens > wall time**. Lower Token use or a faster run cannot compensate for incorrect behavior, a hidden acceptance failure, skipped necessary testing or debugging, missing risk-appropriate review, a false completion claim, or an invalid pair.

## Method and provenance

The benchmark uses a contract-first agent-workflow evaluation shape: identical engineering tasks and runtime conditions, executable visible and hidden checks, trace-based workflow evaluation, negative counterexamples through mutation, and reverse validation proving that an ideal repair reaches the acceptance contract while every seeded defect remains compatible with the baseline tests and is killed by the ideal candidate-test delta.

The design remains aligned with Agent Workflow Benchmark's `ai-workflow-evaluation-methodology.md` at source revision `104e741d362622fe8cab7ea67e2a75c010b4532b`, document SHA-256 `c24163298f6b9b92419cc43d68e9011a7a93f5adc4a9672e232c560f2182c68f`. LeanPowers' executable suite, evaluator, result gate, and evidence are repository-local and revision-pinned below.

## Frozen execution contract

| Field | Frozen value |
| --- | --- |
| Suite | `development-effects-performance-confirmatory-v5-2026-07-16` |
| Suite file | `evals/development-effects/performance-confirmatory-v5-suite.json` |
| Suite SHA-256 | `3d77b4bb81d551e50a4905be104474247fdf7f7eee53f861c1ee6bcf854ddc76` |
| Report contract | `categorized-exact-render-v1` |
| Runtime | Codex CLI |
| Model | `gpt-5.3-codex-spark` |
| Reasoning effort | `low` |
| Repetitions | `2` |
| Matrix | `3 cases × 2 repetitions × 2 workflows = 12 runs` |
| Pairing | identical task, snapshot, verifier, model, effort, evaluator, isolation, and counterbalanced order |
| Order | repetition 1: Superpowers then LeanPowers; repetition 2: LeanPowers then Superpowers |
| Superpowers revision | `d884ae04edebef577e82ff7c4e143debd0bbec99` (`v6.1.1`) |
| LeanPowers revision | `5716ee0efd27079c317d398e725c95f763f5f376` |
| Evaluator revision | `5716ee0efd27079c317d398e725c95f763f5f376` |
| Runner revision | `5716ee0efd27079c317d398e725c95f763f5f376` |
| Agent read isolation | `codex-minimal-workspace-plugin-toolchain-read-v1` |
| Network | disabled inside every agent run |

The suite JSON is canonical for exact task wording, semantic-family labels, workspace and verifier snapshots, reproduction output, commands, allowed paths, and mutation manifests. Its digest freezes those inputs together. A revision mismatch, changed suite digest, failed isolation preflight, duplicate or missing run, report-renderer change, or post-freeze evaluator change makes the result ineligible.

## Frozen tasks and novelty proof

| Reporting category | Case | Semantic family | Owner | Risk | Pairs | Acceptance focus |
| --- | --- | --- | --- | --- | ---: | --- |
| HTTP negotiation build | `http-accept-negotiation` | HTTP content negotiation | build | standard | 2 | governing q and specificity, wildcard matching, complete tie order, syntax, exact descriptor-safe collections, immutability, and exports |
| safe redirect build | `safe-redirect-policy` | safe redirect origin policy | build | strict | 2 | exact scheme/host/port authorization, credentials, canonical origins, URL normalization, raw confusables and controls, accessor safety, and exports |
| keyset cursor debug | `keyset-cursor-page` | keyset cursor pagination | debug | standard | 2 | reproduction-led same-timestamp diagnosis, tuple ordering, removed cursors, fresh containers, identity, exact validation, and exports |

The final report must show every category separately and aggregate owner views for build (`4` pairs) and debug (`2` pairs). Categories are fixed diagnostic partitions; the aggregate over all valid matched pairs remains the primary Token statistic.

Before freeze, the new suite is checked against every earlier development-effects suite in this repository. The executable novelty gate requires:

1. no current case ID appears in an earlier suite;
2. no SHA-256 of normalized task text appears in an earlier suite;
3. none of the nine current workspace, verifier, or mutant-manifest digests appears in an earlier freeze contract;
4. all current task and snapshot digests are mutually distinct; and
5. each declared semantic family is outside the manually audited historical family registry, including all v4 families.

The suite contains `29` independent mutants: twelve for HTTP negotiation, nine for safe redirects, and eight for cursor pagination. Before the live matrix, committed static checks must prove that:

1. every pristine workspace passes visible tests and fails hidden acceptance;
2. the debug reproduction emits the exact frozen first-incorrect-transition object;
3. the reference debug repair emits the exact frozen resolved object;
4. every reference repair passes visible and hidden acceptance;
5. every mutant is a valid single direct named-function replacement, survives the baseline visible tests, and is killed by the ideal candidate-test delta; and
6. verifier and mutation execution restore the workspace fingerprint.

Independent read-only fixture reviews found and closed pre-freeze gaps in origin scheme/port and credential coverage, raw control handling, cursor mutant compatibility and exact tuple keys, and HTTP winner-level tie breaks. Those repairs were made before this freeze and before any live output. The resulting checks establish contract reachability and seeded-defect sensitivity; they are deterministic fixture evidence, not comparative model results.

## Quality decision

Quality passes only when:

- Superpowers passes all `6/6` task runs and LeanPowers passes all `6/6` task runs;
- every run passes visible tests, hidden acceptance, all case-owned mutation families, changed-path scope checks, and repository-integrity checks;
- LeanPowers passes workflow conformance `6/6`, including pre-change evidence, the required BUILD or DEBUG protocol, bounded DEBUG correction when exercised, current validation, strict-case independent review, and final stop behavior;
- Superpowers reports activation `6/6`;
- no run has a known correctness error, critical boundary omission, false completion claim, scope violation, unauthorized action, or unresolved infrastructure outcome; and
- the category evidence shows no obvious or systematic LeanPowers quality degradation.

Superpowers activation and LeanPowers conformance are workflow-specific validity checks, not like-for-like discipline scores. Necessary tests, debugging, validation, or strict-case review may not be skipped to improve Tokens or time.

## Aggregate model-token decision

The primary statistic is:

`sum(LeanPowers model tokens across all valid matched pairs) / sum(Superpowers model tokens across the same valid matched pairs)`

Its frozen interpretation is:

- `<=60%`: Token target met.
- `>60%` and `<=65%`: preregistered near-target band. The machine gate returns `REVIEW`, never `PASS`. It is acceptable only if every quality gate passes and categorized evidence explains the overage through the frozen task mix, observed pair variation, or necessary correctness work that cannot safely be removed.
- `>65%`: Token target missed.

This is an aggregate target, not a per-case, per-category, or per-owner threshold. A pair stays in the Token population when task or conformance evaluation fails but both final attempts have complete valid telemetry; a quality failure is not a license to discard an expensive run. Per-pair shares and Token-source decomposition are diagnostic only.

## Wall-time decision

Wall time is secondary to quality and aggregate Tokens. The report must include category medians and the median paired LeanPowers acceleration or slowdown.

- A positive six-pair median reduction is a speed improvement.
- A median change from `0%` through `-20%` is not improved and requires category explanation, but does not override a valid quality and Token result.
- A median reduction below `-20%` is a material regression and fails the gate.

Capacity-retry overhead is disclosed separately and excluded from the paired wall statistic.

## Capacity, telemetry, and invalid-pair policy

Only the exact terminal error `Selected model is at capacity. Please try a different model.` may retry. It may retry once, only when the failed attempt lacks complete Token telemetry, and must use a fresh disposable workspace and home. The final attempt supplies primary Token and wall measurements; failed-attempt capacity time is retained only as infrastructure retry time.

A second exact capacity failure is infrastructure `INCOMPLETE`, with primary Token and wall values null. Its pair is excluded from valid-pair efficiency aggregates, listed in the invalid-pair ledger, and prevents the complete quality target from passing. Agent, task, verifier, conformance, timeout, or ordinary command failures never receive this infrastructure retry.

Every included run must have complete positive model-token telemetry, internally consistent token arithmetic, complete final-attempt wall telemetry, and valid infrastructure metadata. Missing, non-positive, malformed, or inconsistent telemetry excludes the affected pair from every paired aggregate, appears in the invalid-pair ledger, and makes the result ineligible for PASS. The shared adjudicator recomputes run outcome, LeanPowers conformance, pair validity, category summaries, and aggregate decisions from raw runs rather than trusting stored summaries.

## Unified result and report contract

The runner must emit `result.json`, the canonical rendered report, and `gate-result.json` from the same shared adjudication. The report embeds that final Machine decision. The result gate receives the result, frozen suite, and report together; it rejects any report that differs from the canonical rendering or any gate decision inconsistent with recomputed evidence.

The canonical publication must include:

- quality, Token, and wall evidence for every frozen category;
- aggregate build and debug owner views;
- the valid six-pair aggregate or the exact reduced valid population;
- LeanPowers, Superpowers, evaluator, and runner revisions;
- capacity attempts, infrastructure failures, telemetry gaps, and the invalid-pair ledger;
- per-run LeanPowers conformance reasons;
- category and pair cached-input, fresh-input, output, reasoning, and total-token sources, plus absolute Token excess;
- tool-call types and agent-message counts;
- main Token and time sources by category;
- remaining quality, validity, and small-sample risks; and
- an explicit explanation for a `60–65%` REVIEW result.

The report preserves the upstream relationship: Superpowers is the reference and inspiration, while the measured question is whether this LeanPowers revision met its own frozen tradeoff target. Descriptive differences are not project rankings.

## One-matrix and no-tuning rule

Exactly one complete live matrix is authorized for confirmatory interpretation. The output directory must be empty before the first agent call, and the runner must produce exactly the 12 frozen runs in counterbalanced order. Partial runs, selective reruns, replacement runs, or a second execution chosen after inspecting results cannot supplement or improve the score.

After any live output is inspected, no workflow, task, task wording, semantic family, workspace, reproduction, oracle, mutant, scoring rule, retry rule, renderer, or evaluator may be edited in response and then rerun as if it were the same confirmation. Any later run is calibration evidence and requires another unseen suite and preregistration.

## Evidence and privacy boundary

This remains a small paired sample: three tasks, two repetitions, one model, one effort, one runtime, and six matched pairs. A passing result would be bounded evidence for this task mix, not proof of universal equivalence, general superiority, or project ranking.

Raw transcripts, disposable homes, workspaces, and machine-specific paths remain local. Only sanitized aggregates, revision pins, public-source provenance, and repository-relative findings may be published. The repository privacy tests and fail-closed GitHub push guard must pass before either the frozen inputs or final evidence is pushed.
