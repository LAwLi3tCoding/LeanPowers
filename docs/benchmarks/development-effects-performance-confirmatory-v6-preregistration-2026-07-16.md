# Performance confirmatory v6 preregistration

Date frozen: 2026-07-16, before any live model run against this suite.

Status: **task text, semantic families, snapshots, hidden acceptance, mutants, execution revisions, case order, workflow order, reporting categories, retry policy, report renderer, layered diagnostics, and decision rules are frozen; no live output has been inspected**.

[Superpowers](https://github.com/obra/superpowers) 6.1.1 is the upstream reference and principal inspiration for LeanPowers. LeanPowers is evaluating whether the engineering safeguards learned from that work can be preserved with a smaller runtime control surface. This is a test of LeanPowers against its own lightweight-design target, not a project ranking or a claim that either project is generally superior.

The fixed priority is **quality > aggregate model tokens > wall time**. Lower Token use or a faster run cannot compensate for incorrect behavior, a hidden acceptance failure, weak candidate-authored regressions, skipped necessary testing or debugging, missing risk-appropriate review, a false completion claim, or an invalid pair.

## Prior evidence remains frozen

This v6 suite does not change, rerun, rescore, or reinterpret any earlier result:

- v4 remains a frozen **FAIL**: Superpowers Task PASS `5/6`, LeanPowers Task PASS `3/6`, LeanPowers conformance `0/6`, and aggregate Lean Token share `79.0877%`.
- v5 remains a frozen **FAIL**: Superpowers Task PASS `0/6`, LeanPowers Task PASS `0/6`, and LeanPowers conformance `0/6`. Its five telemetry-complete pairs had diagnostic aggregate Lean Token share `102.3742%`; one Superpowers run lacked complete telemetry. The shared floor supports neither parity, non-inferiority, nor a winner conclusion.

V6 is a new prospective test prompted by the frozen v5 audit. It distributes critical semantics across five narrower cases, limits each case to four or five predeclared semantic gates, raises reasoning effort from low to medium, and counterbalances both workflow and case order. Those changes address measurement floor risk; they do not revise prior evidence.

## Method and provenance

The benchmark uses a contract-first agent-workflow evaluation shape: identical engineering tasks and runtime conditions, executable visible and hidden checks, trace-based workflow evaluation, negative counterexamples through mutation, and reverse validation proving that an ideal repair reaches the acceptance contract while every seeded defect remains compatible with baseline tests and is killed by the ideal candidate-test delta.

The design remains aligned with Agent Workflow Benchmark's `ai-workflow-evaluation-methodology.md` at source revision `104e741d362622fe8cab7ea67e2a75c010b4532b`, document SHA-256 `c24163298f6b9b92419cc43d68e9011a7a93f5adc4a9672e232c560f2182c68f`. LeanPowers' executable suite, evaluator, result gate, and evidence remain repository-local and revision-pinned below.

## Frozen execution contract

| Field | Frozen value |
| --- | --- |
| Suite | `development-effects-performance-confirmatory-v6-2026-07-16` |
| Suite file | `evals/development-effects/performance-confirmatory-v6-suite.json` |
| Suite SHA-256 | `aa6cf77ac1ed7b2d3aeab2ab0d8484fbcf2a9199940a4adf46d6fb43f8332bdb` |
| Report contract | `categorized-exact-render-v1` |
| Runtime | Codex CLI |
| Model | `gpt-5.3-codex-spark` |
| Reasoning effort | `medium` |
| Repetitions | `2` |
| Matrix | `5 cases × 2 repetitions × 2 workflows = 20 runs` |
| Independent task clusters | `5`; repetitions are paired repeats, not independent tasks |
| Pairing | identical task, snapshot, verifier, model, effort, evaluator, isolation, and counterbalanced order |
| Workflow order | repetition 1: Superpowers then LeanPowers; repetition 2: LeanPowers then Superpowers |
| Case order | repetition 1: suite order; repetition 2: exact reverse suite order |
| Superpowers revision | `d884ae04edebef577e82ff7c4e143debd0bbec99` (`v6.1.1`) |
| LeanPowers revision | `1a88de222685f420ebb14a84b8bab405ec2e33a6` |
| Evaluator revision | `b82812c91f46f708475cac285847ed84b70e441a` |
| Runner revision | `b82812c91f46f708475cac285847ed84b70e441a` |
| Agent read isolation | `codex-minimal-workspace-plugin-toolchain-read-v1` |
| Network | disabled inside every agent run |

The suite JSON is canonical for exact task wording, semantic-family labels, workspace and verifier snapshots, reproduction output, commands, allowed paths, mutation manifests, and both orders. Its digest freezes those inputs together. A revision mismatch, changed suite digest, failed isolation preflight, duplicate or missing run, order mismatch, report-renderer change, or post-freeze evaluator change makes the result ineligible.

## Frozen tasks and novelty proof

| Reporting category | Case | Semantic family | Owner | Risk | Pairs | Acceptance focus |
| --- | --- | --- | --- | --- | ---: | --- |
| cyclic rotation build | `cyclic-sequence-rotation` | cyclic sequence normalization | build | lean | 2 | left rotation, mathematical modulo, exact accessor-safe arrays, freshness, identity, and immutability |
| version vector debug | `version-vector-relation` | version-vector causality | debug | standard | 2 | reproduction-led union diagnosis, componentwise partial order, concurrency, exact records, accessor safety, and immutability |
| JSON merge patch build | `json-merge-patch` | JSON merge-patch application | build | standard | 2 | null deletion, recursive records, atomic arrays, full deep freshness, restricted JSON validation, and special own keys |
| ring buffer debug | `ring-buffer-wraparound` | ring-buffer wraparound ordering | debug | standard | 2 | reproduction-led chronological order, repeated wrapping, complete reset, fresh snapshots, identity, and capacity validation |
| capability scope strict build | `capability-scope-decision` | capability-scope authorization | build | strict | 2 | deny precedence, action/resource wildcards, slash-segment isolation, default deny, complete accessor-safe validation, and immutability |

The final report must show every category separately and aggregate owner views for build (`6` pairs) and debug (`4` pairs). Categories are fixed diagnostic partitions; the aggregate over all valid matched pairs remains the primary Token statistic.

Before freeze, the suite is checked against every earlier development-effects suite in this repository. The executable novelty gate requires:

1. no current case ID appears in an earlier suite;
2. no SHA-256 of normalized task text appears in an earlier suite;
3. none of the fifteen current workspace, verifier, or mutant-manifest digests appears in an earlier freeze contract;
4. all current task and snapshot digests are mutually distinct; and
5. each declared semantic family is outside the manually audited historical family registry, including every v5 family.

The suite contains `25` independent mutants: four for cyclic rotation, four for version vectors, five for JSON merge patch, five for ring-buffer wraparound, and seven for capability authorization. They are grouped into four or five critical semantic gates per case. Before the live matrix, committed static checks must prove that:

1. every pristine workspace passes visible tests and fails hidden acceptance;
2. each debug reproduction emits its exact frozen first-incorrect-transition object;
3. each reference debug repair emits its exact frozen resolved object;
4. every reference repair passes visible and hidden acceptance;
5. every mutant is a valid single direct named-function replacement, survives baseline visible tests, and is killed by the ideal candidate-test delta; and
6. verifier and mutation execution restore the workspace fingerprint.

Independent read-only reviews found and closed pre-freeze gaps in mutant replacement format, patch-only deep isolation, ordinary buffer surfaces, request accessor safety, wildcard-deny precedence, and case-sensitive authorization matching. Fresh follow-up reviews passed after those corrections. These checks establish contract reachability and seeded-defect sensitivity; they are deterministic fixture evidence, not comparative model results.

## Primary quality decision

Quality passes only when:

- Superpowers passes all `10/10` task runs and LeanPowers passes all `10/10` task runs;
- every run passes visible tests, hidden acceptance, all case-owned mutation families, changed-path scope checks, and repository-integrity checks;
- LeanPowers passes workflow conformance `10/10`, including pre-change evidence, the required BUILD or DEBUG protocol, bounded DEBUG correction when exercised, current validation, strict-case independent review, and final stop behavior;
- Superpowers reports activation `10/10`;
- no run has a known correctness error, critical boundary omission, false completion claim, scope violation, unauthorized action, or unresolved infrastructure outcome; and
- categorized evidence shows no obvious or systematic LeanPowers quality degradation.

Superpowers activation and LeanPowers conformance are workflow-specific validity checks, not like-for-like discipline scores. Necessary tests, debugging, validation, or strict-case review may not be skipped to improve Tokens or time.

## Layered quality diagnostics

The all-or-nothing Task PASS endpoint remains authoritative. To prevent a floor or ceiling from hiding the direction of failures, the report and audit must also publish the four paired outcome cells:

- `both_pass`;
- `superpowers_pass_lean_fail`;
- `lean_pass_superpowers_fail`; and
- `both_fail`.

Per-workflow pass counts must be stated separately. Pooled pass rates may not erase an asymmetry.

The frozen interpretation is:

- **shared floor**: both workflows individually pass strictly less than `20%` of their ten runs, which here means at most `1/10` each. Absolute quality fails and comparative quality retention is unsupported.
- **shared ceiling**: both workflows individually pass strictly more than `80%`, which here means at least `9/10` each. No superiority ranking is made. If both are `10/10`, the strongest allowed wording is bounded contract parity on this fixed suite.
- exactly `20%` or `80%` does not trigger either rule;
- any directional asymmetry must be reported even when a shared floor or shared ceiling applies; and
- repetition-level variation is diagnostic because the sample has five independent task clusters, not ten independent tasks.

These interpretation rules do not relax the `10/10` primary quality gate.

## Aggregate model-token decision

The primary statistic is:

`sum(LeanPowers model tokens across all valid matched pairs) / sum(Superpowers model tokens across the same valid matched pairs)`

Its frozen interpretation is:

- `<=60%`: Token target met.
- `>60%` and `<=65%`: preregistered near-target band. The machine gate returns `REVIEW`, never automatic PASS. It is acceptable only if every quality gate passes and categorized evidence explains necessary correctness work.
- `>65%`: Token target missed.

This is an aggregate target, not a per-case, per-category, or per-owner threshold. A pair stays in the Token population when task or conformance evaluation fails but both final attempts have complete valid telemetry; a quality failure is not a license to discard an expensive run. Per-pair shares and Token-source decomposition are diagnostic only. When quality fails, Token and wall results remain diagnostic and the overall result remains **FAIL**.

## Wall-time decision

Wall time is secondary to quality and aggregate Tokens. The report must include category medians and the median paired LeanPowers acceleration or slowdown.

- A positive ten-pair median reduction is a speed improvement.
- A median change from `0%` through `-20%` is not improved and requires category explanation, but does not override a valid quality and Token result.
- A median reduction below `-20%` is a material regression and fails the gate.

Capacity-retry overhead is disclosed separately and excluded from the paired wall statistic.

## Capacity, telemetry, and invalid-pair policy

Only the exact terminal error `Selected model is at capacity. Please try a different model.` may retry. It may retry once, only when the failed attempt lacks complete Token telemetry, and must use a fresh disposable workspace and home. The final attempt supplies primary Token and wall measurements; failed-attempt capacity time is retained only as infrastructure retry time.

A second exact capacity failure is infrastructure `INCOMPLETE`, with primary Token and wall values null. Its pair is excluded from valid-pair efficiency aggregates, listed in the invalid-pair ledger, and prevents the complete quality target from passing. Agent, task, verifier, conformance, timeout, or ordinary command failures never receive this infrastructure retry.

Every included run must have complete positive model-token telemetry, internally consistent token arithmetic, complete final-attempt wall telemetry, and valid infrastructure metadata. Missing, non-positive, malformed, or inconsistent telemetry excludes the affected pair from every paired aggregate, appears in the invalid-pair ledger, and makes the result ineligible for PASS. The shared adjudicator recomputes run outcome, LeanPowers conformance, pair validity, category summaries, and aggregate decisions from raw runs rather than trusting stored summaries.

## Unified result and report contract

The runner must emit `result.json`, the canonical rendered report, and `gate-result.json` from the same shared adjudication. The report embeds that final Machine decision. The result gate receives the result, frozen suite, and report together; it rejects any report that differs from the canonical rendering or any gate decision inconsistent with recomputed evidence.

The canonical publication and audit together must include category quality, Token, time, telemetry, conformance, retry, source-decomposition, paired-quadrant, floor/ceiling, asymmetry, validity, and small-sample evidence. The audit may explain frozen evidence but may not change the machine result.

The report preserves the upstream relationship: Superpowers is the reference and inspiration, while the measured question is whether this LeanPowers revision met its own frozen tradeoff target. Descriptive differences are not project rankings.

## One-matrix and no-tuning rule

Exactly one complete live matrix is authorized for confirmatory interpretation. The output directory must be empty before the first agent call, and the runner must produce exactly the `20` frozen runs in the frozen workflow and case order. Partial runs, selective reruns, replacement runs, or a second execution chosen after inspecting results cannot supplement or improve the score.

After any live output is inspected, no workflow, task, task wording, semantic family, workspace, reproduction, oracle, mutant, scoring rule, retry rule, renderer, or evaluator may be edited in response and then rerun as if it were the same confirmation. Any later run is calibration evidence and requires another unseen suite and preregistration.

No low-effort lane is part of this primary matrix. Any later low-effort run must be separately labeled exploratory stress evidence and may not be pooled with or used to tune this confirmation.

## Evidence and privacy boundary

This remains a small paired sample: five independent tasks, two paired repetitions, one model, one effort, one runtime, and ten matched pairs. A passing result would be bounded evidence for this task mix, not proof of universal equivalence, general superiority, or project ranking.

Raw transcripts, disposable homes, workspaces, and machine-specific paths remain local. Only sanitized aggregates, revision pins, public-source provenance, and repository-relative findings may be published. The repository privacy tests and fail-closed GitHub push guard must pass before either the frozen inputs or final evidence is pushed.
