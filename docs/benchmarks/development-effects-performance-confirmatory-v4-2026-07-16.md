# Frozen held-out development-effects comparison

Evidence level: **paired-development-heldout**. This is frozen confirmatory coding evidence for the listed cases and revisions, but it is not the full 11-scenario release benchmark.

Frozen run contract: **verified**. Confirmatory eligibility: **yes**.

Run matrix: **complete**. Token-target conclusions are unavailable unless the declared matrix and target population are complete.

Runtime: codex-cli 0.142.5; model: gpt-5.3-codex-spark; effort: low.

Agent read isolation: codex-minimal-workspace-plugin-toolchain-read-v1; permission profile: benchmark; preflight: PASS.

Revisions: Superpowers d884ae04edebef577e82ff7c4e143debd0bbec99; LeanPowers 25170785dcab7b776dcd79e8eec1b75c8591cf8d; evaluator 25170785dcab7b776dcd79e8eec1b75c8591cf8d; runner 25170785dcab7b776dcd79e8eec1b75c8591cf8d.

Suite manifest: ef756d2a5f55c35366a1692c001d6789ef0dde5f0fb5616119b83572448f765c.

Case | Workspace snapshot | Hidden verifier snapshot | Fault-family snapshot
--- | --- | --- | ---
weighted-round-robin-interleave | 173fcb5e076debd15132861ff58f1eaec75609f45c4595c1ce2e6b8cb3c835fc | f6e668130d1e7e08ffd40adcb45b3d9d2953acfcc277d77db83e7b78675144eb | 1eeb54b2e6b3bdba51c227b227aacb7460422a73d5e28c46d9a586c395311b5c
structured-log-redaction | 82855490663f9146bcaf7b2d382b9710c405b2c0dca52ab2672142eef2528bc1 | be33ed47215db6eb31827a7bff0b1ba21af8af29cac11bcf3b79fff020791fa8 | 54706d1603d5d0401ca841d50b293a3f8dc559a8cbc4578275a0671c27804c6a
bidirectional-tag-index | 2a95c76ccc09d4186f00d0286b738ab3e52ff2fa804751f85b315b3d7a461ac8 | ec09bd39e8b10a2ca4f2c61eaf9714f43aa3f8f67f6e6b2ed792389a2105559b | 1bb9178cf07f01f05f5c10b759e49866704fcf2a93b972d213c385021140d4f7

Activation: explicit-entrypoint. Each run explicitly invokes its installed top-level workflow entrypoint and must name it in the first agent progress message before the identical engineering task.

Superpowers 6.1.1 is the upstream baseline and inspiration for LeanPowers. This report measures a bounded tradeoff under the listed conditions; it is not a winner ranking.

## Machine decision

Status: **FAIL**

Reasons: task-outcome, lean-conformance, token-target.

Advisories: none.

## Aggregate

Workflow | Task PASS | Median model tokens | Median fresh tokens | Median wall seconds | Median tool calls | Median workflow reads | Declaration failures | Conformance failures | Scope violations
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
superpowers-6.1.1 | 5/6 | 396385 | 56069.5 | 49.2 | 17 | 2 | 0 | 0 | 0
leanpowers-0.2.0 | 3/6 | 271541 | 41286.5 | 43.9 | 12.5 | 0 | 0 | 6 | 0

## Results by task category

Category | Pairs | Superpowers quality | LeanPowers quality | Superpowers total tokens | LeanPowers total tokens | Lean token share | Superpowers median tokens | LeanPowers median tokens | Superpowers median wall | LeanPowers median wall | Lean wall reduction
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
weighted interleave build | 2 | 2/2 | 1/2 | 581725 | 424717 | 73.00992737118054% | 290862.5 | 212358.5 | 60.6 | 36.9 | 33.8%
structured redaction build | 2 | 1/2 | 0/2 | 887291 | 1012730 | 114.13730106582847% | 443645.5 | 506365 | 51.1 | 57 | -11.5%
bidirectional index debug | 2 | 2/2 | 2/2 | 900994 | 436939 | 48.49521750422311% | 450497 | 218469.5 | 45.1 | 43.9 | 2%
build owner aggregate | 4 | 3/4 | 1/4 | 1469016 | 1437447 | 97.85101047231616% | 388485.5 | 342203.5 | 51.1 | 48.5 | 3.7%
debug owner aggregate | 2 | 2/2 | 2/2 | 900994 | 436939 | 48.49521750422311% | 450497 | 218469.5 | 45.1 | 43.9 | 2%

## Category source diagnostics

Category | Workflow | Median fresh tokens | Median output tokens | Median tool calls | Median workflow reads | Capacity retries | Infrastructure retry wall
--- | --- | ---: | ---: | ---: | ---: | ---: | ---:
weighted interleave build | superpowers-6.1.1 | 51502.5 | 9967 | 13.5 | 2 | 0 | 0
weighted interleave build | leanpowers-0.2.0 | 41286.5 | 9062 | 10 | 0 | 1 | 44.3
structured redaction build | superpowers-6.1.1 | 57597.5 | 14333.5 | 18 | 2.5 | 0 | 0
structured redaction build | leanpowers-0.2.0 | 56125 | 19362.5 | 15 | 0.5 | 0 | 0
bidirectional index debug | superpowers-6.1.1 | 55105 | 9767.5 | 18 | 2.5 | 0 | 0
bidirectional index debug | leanpowers-0.2.0 | 29669.5 | 8922 | 9.5 | 0 | 0 | 0
build owner aggregate | superpowers-6.1.1 | 56069.5 | 11802 | 16 | 2 | 0 | 0
build owner aggregate | leanpowers-0.2.0 | 48520 | 13190 | 13 | 0 | 1 | 44.3
debug owner aggregate | superpowers-6.1.1 | 55105 | 9767.5 | 18 | 2.5 | 0 | 0
debug owner aggregate | leanpowers-0.2.0 | 29669.5 | 8922 | 9.5 | 0 | 0 | 0

## Category token sources

Category | Superpowers total | LeanPowers total | Total excess | Target excess | Superpowers cached | LeanPowers cached | Cached excess | Superpowers fresh | LeanPowers fresh | Fresh excess | Superpowers tool calls | LeanPowers tool calls | Superpowers tool types | LeanPowers tool types | Superpowers agent messages | LeanPowers agent messages
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---:
weighted interleave build | 581725 | 424717 | -157008 | 13% | 478720 | 342144 | -136576 | 103005 | 82573 | -20432 | 27 | 20 | command_execution:19, file_change:8 | command_execution:17, file_change:3 | n/a | n/a
structured redaction build | 887291 | 1012730 | 125439 | 54.1% | 772096 | 900480 | 128384 | 115195 | 112250 | -2945 | 36 | 30 | command_execution:25, file_change:11 | command_execution:16, file_change:14 | n/a | n/a
bidirectional index debug | 900994 | 436939 | -464055 | -11.5% | 790784 | 377600 | -413184 | 110210 | 59339 | -50871 | 36 | 19 | command_execution:28, file_change:8 | command_execution:12, file_change:7 | n/a | n/a
build owner aggregate | 1469016 | 1437447 | -31569 | 37.9% | 1250816 | 1242624 | -8192 | 218200 | 194823 | -23377 | 63 | 50 | command_execution:44, file_change:19 | command_execution:33, file_change:17 | n/a | n/a
debug owner aggregate | 900994 | 436939 | -464055 | -11.5% | 790784 | 377600 | -413184 | 110210 | 59339 | -50871 | 36 | 19 | command_execution:28, file_change:8 | command_execution:12, file_change:7 | n/a | n/a

## Pair token excess

Case | Rep | Superpowers total | LeanPowers total | Lean token share | Target excess | Total excess | Superpowers cached | LeanPowers cached | Cached excess | Superpowers fresh | LeanPowers fresh | Fresh excess | Superpowers tool calls | LeanPowers tool calls | Superpowers tool types | LeanPowers tool types | Superpowers agent messages | LeanPowers agent messages
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---:
bidirectional-tag-index | 1 | 354599 | 123399 | 34.8% | -25.2% | -231200 | 303232 | 95616 | -207616 | 51367 | 27783 | -23584 | 16 | 6 | command_execution:13, file_change:3 | command_execution:4, file_change:2 | n/a | n/a
structured-log-redaction | 1 | 438171 | 454865 | 103.8% | 43.8% | 16694 | 380928 | 396544 | 15616 | 57243 | 58321 | 1078 | 18 | 14 | command_execution:12, file_change:6 | command_execution:9, file_change:5 | n/a | n/a
weighted-round-robin-interleave | 1 | 338800 | 229542 | 67.8% | 7.8% | -109258 | 283904 | 190080 | -93824 | 54896 | 39462 | -15434 | 14 | 12 | command_execution:10, file_change:4 | command_execution:12 | n/a | n/a
bidirectional-tag-index | 2 | 546395 | 313540 | 57.4% | -2.6% | -232855 | 487552 | 281984 | -205568 | 58843 | 31556 | -27287 | 20 | 13 | command_execution:15, file_change:5 | command_execution:8, file_change:5 | n/a | n/a
structured-log-redaction | 2 | 449120 | 557865 | 124.2% | 64.2% | 108745 | 391168 | 503936 | 112768 | 57952 | 53929 | -4023 | 18 | 16 | command_execution:13, file_change:5 | command_execution:7, file_change:9 | n/a | n/a
weighted-round-robin-interleave | 2 | 242925 | 195175 | 80.3% | 20.3% | -47750 | 194816 | 152064 | -42752 | 48109 | 43111 | -4998 | 13 | 8 | command_execution:9, file_change:4 | command_execution:5, file_change:3 | n/a | n/a

## Token target

Metric: **aggregate-model-token-share** across **all-matched-pairs**; LeanPowers target: at most **60%** of Superpowers model tokens.

Status: **FAIL**; eligible pairs: 6/6; observed share: 79.1%.

Performance-goal assessment: **FAIL — target missed**. The 60–65% band never bypasses quality gates and is not an automatic PASS.

Wall time is secondary: complete pair telemetry is mandatory; 0% through -20% is an advisory non-improvement, while a slowdown greater than 20% is a material regression.

## Paired reductions

Population | Eligible/required pairs | Aggregate Lean token share | Median model-token reduction | Median Lean token share | Max Lean token share | Lean ≤60% pairs | Median fresh-token reduction | Median wall reduction | Median tool-call reduction | Median workflow-read reduction
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
Both Task PASS + Lean quality-bearing conformance + Superpowers activation (primary) | 0/6 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/6 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
Primary: lean | 0/0 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/0 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
Primary: standard | 0/4 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/4 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
Primary: strict | 0/2 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/2 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
Both workflows PASS | 3/6 | 55.25863282277853% (n=3) | 42.6% (n=3) | 57.38339479680451% (n=3) | 80.34372748790778% (n=3) | 2/6 | 45.9% (n=3) | 9.6% (n=3) | 38.5% (n=3) | n/a (n=0)
All matched runs | 6/6 | 79.0876831743326% (n=6) | 26% (n=6) | 74.04760164241907% (n=6) | 124.21290523690773% (n=6) | 2/6 | 19.3% (n=6) | 2% (n=6) | 28.6% (n=6) | 50% (n=1)

## Paired runs

Case | Risk | Rep | Workflow | Task | Conformance | Declared | Artifact regression | Model tokens | Fresh tokens | Wall seconds | Attempts | Capacity retry wall | Tool calls | Workflow reads | Product files | Workflow artifacts | Scope violations
--- | --- | ---: | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
weighted-round-robin-interleave | standard | 1 | superpowers-6.1.1 | PASS | PASS | yes | PASS | 338800 | 54896 | 81.7 | 1 | 0 | 14 | 2 | 2 | 0 | 0
weighted-round-robin-interleave | standard | 1 | leanpowers-0.2.0 | FAIL | FAIL | yes | PASS | 229542 | 39462 | 41.5 | 2 | 44.3 | 12 | 0 | 2 | 0 | 0
structured-log-redaction | strict | 1 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | 438171 | 57243 | 49.9 | 1 | 0 | 18 | 2 | 2 | 0 | 0
structured-log-redaction | strict | 1 | leanpowers-0.2.0 | FAIL | FAIL | yes | FAIL | 454865 | 58321 | 55.4 | 1 | 0 | 14 | 1 | 2 | 0 | 0
bidirectional-tag-index | standard | 1 | superpowers-6.1.1 | PASS | PASS | yes | PASS | 354599 | 51367 | 41.7 | 1 | 0 | 16 | 2 | 2 | 0 | 0
bidirectional-tag-index | standard | 1 | leanpowers-0.2.0 | PASS | FAIL | yes | PASS | 123399 | 27783 | 44 | 1 | 0 | 6 | 0 | 2 | 0 | 0
weighted-round-robin-interleave | standard | 2 | leanpowers-0.2.0 | PASS | FAIL | yes | PASS | 195175 | 43111 | 32.3 | 1 | 0 | 8 | 0 | 2 | 0 | 0
weighted-round-robin-interleave | standard | 2 | superpowers-6.1.1 | PASS | PASS | yes | PASS | 242925 | 48109 | 39.5 | 1 | 0 | 13 | 2 | 2 | 0 | 0
structured-log-redaction | strict | 2 | leanpowers-0.2.0 | FAIL | FAIL | yes | FAIL | 557865 | 53929 | 58.6 | 1 | 0 | 16 | 0 | 2 | 0 | 0
structured-log-redaction | strict | 2 | superpowers-6.1.1 | PASS | PASS | yes | PASS | 449120 | 57952 | 52.4 | 1 | 0 | 18 | 3 | 2 | 0 | 0
bidirectional-tag-index | standard | 2 | leanpowers-0.2.0 | PASS | FAIL | yes | PASS | 313540 | 31556 | 43.8 | 1 | 0 | 13 | 0 | 2 | 0 | 0
bidirectional-tag-index | standard | 2 | superpowers-6.1.1 | PASS | PASS | yes | PASS | 546395 | 58843 | 48.5 | 1 | 0 | 20 | 3 | 2 | 0 | 0

## Failed-run reasons

- r1-weighted-round-robin-interleave-leanpowers-0.2.0: hidden verifier failed
- r1-structured-log-redaction-superpowers-6.1.1: artifact regression evidence did not pass; artifact regression gate sensitive-value-short-circuit: candidate visible tests did not kill every semantic fault member
- r1-structured-log-redaction-leanpowers-0.2.0: hidden verifier failed; artifact regression evidence did not pass; artifact regression gate input-immutability: candidate visible tests did not kill every semantic fault member
- r2-structured-log-redaction-leanpowers-0.2.0: artifact regression evidence did not pass; artifact regression gate sensitive-value-short-circuit: candidate visible tests did not kill every semantic fault member

## Workflow conformance reasons

- r1-weighted-round-robin-interleave-leanpowers-0.2.0: declared lean risk instead of standard; ordered pre-product source and failing RED evidence was not observed; ordered TEST-PATCH, RED, and CODE-PATCH protocol was not observed; supported successful post-edit validation was not observed
- r1-structured-log-redaction-leanpowers-0.2.0: ordered pre-product source and failing RED evidence was not observed; pre-change source READ evidence was not observed; READ omitted discovered files that were later changed; ordered TEST-PATCH, RED, and CODE-PATCH protocol was not observed; current passing independent review was not observed; passing independent review lacked current validation context; reviewer workspace mutation check was not observed; strict workflow did not stop after the final passing review
- r1-bidirectional-tag-index-leanpowers-0.2.0: uninterrupted code-and-test mutation window was not observed; bounded DEBUG recovery protocol was not observed; supported successful post-edit validation was not observed; DEBUG did not stop after final successful validation
- r2-weighted-round-robin-interleave-leanpowers-0.2.0: ordered pre-product source and failing RED evidence was not observed; pre-change source READ evidence was not observed; READ omitted discovered files that were later changed; ordered TEST-PATCH, RED, and CODE-PATCH protocol was not observed; supported successful post-edit validation was not observed
- r2-structured-log-redaction-leanpowers-0.2.0: ordered pre-product source and failing RED evidence was not observed; READ omitted discovered files that were later changed; ordered TEST-PATCH, RED, and CODE-PATCH protocol was not observed; current passing independent review was not observed; passing independent review lacked current validation context; reviewer workspace mutation check was not observed; strict workflow did not stop after the final passing review
- r2-bidirectional-tag-index-leanpowers-0.2.0: uninterrupted code-and-test mutation window was not observed; bounded DEBUG recovery protocol was not observed; supported successful post-edit validation was not observed; DEBUG did not stop after final successful validation

## Validity exclusions

Infrastructure failures: **0**; telemetry-gap runs: **0**; Invalid or excluded pairs: **0**. Invalid pairs are excluded from token and wall-time conclusions.

## Interpretation boundary

- Task PASS requires successful agent completion, no timeout, both visible and hidden test success, every case-owned semantic fault family policy to pass, and no changed-path scope violation. Workflow declaration and risk-routing conformance are reported separately.
- LeanPowers quality-bearing conformance requires an unambiguous semantic route declaration before any task tool, rejects conflicting declarations, and forbids risk downgrade after an upgrade. Build/debug traces must show each later-edited existing file was successfully read before its own first edit and supported successful validation after the final edit. Build additionally requires a test-only patch, exactly one nonfatal failing supported test command before product edits, preservation of those RED test paths, and a later product patch; one invalidated test cycle may restart before the final conformant cycle. Debug requires fixture-owned structured pre-edit reproduction and an initial uninterrupted code-and-test mutation window. A failed combined validation may open exactly one bounded recovery patch only when no other tool intervenes, every recovery path was already read and remains in scope, and the final rerun uses the identical command; a second failure or recovery is incomplete. When the fixture declares resolved output, the successful reproduction replay must emit that exact JSON. Lean and standard runs stop after successful validation; strict runs stop after the final passing review. Discovery syntax, extra grounded-file reads, split versus batched reads, validation-manifest reads, Skill/reference reloads, exact pre-validation command/call budgets, clause-ledger shape, repeated route or ledger presentation, and one-call versus two-call validation remain efficiency or ceremony diagnostics rather than quality gates. Representation-boundary adequacy is measured workflow-neutrally in Task PASS: every pre-registered fault-family member must preserve baseline tests, every candidate counterfactual must complete, and every member must be killed by the candidate test delta. Reproduction telemetry proves the exact command and, when declared, resolved structured output; it is not universal semantic proof. These observable checks are scoped to the 3 reported fixtures, not universal semantic proof. Strict quality additionally requires a current independent PASS review with the complete task and current validation context, proof the reviewer did not mutate the workspace, and no subsequent tool call; exact Skill invocation, prompt/verdict surface, reviewer count, wait targeting, and cycle choreography remain diagnostics.
- Codex JSONL does not expose raw spawn arguments such as `fork_context`; observable spawn/wait behavior is checked dynamically, while exact argument shape is covered by static workflow tests and remains a runtime telemetry gap.
- Model tokens sum Codex input and output tokens. Fresh tokens are uncached input plus output. Reasoning output is already included in output and is never double-counted. Missing or impossible telemetry is shown as n/a, never zero.
- Workflow reads are exact observed Skill/reference file reads from command traces. They are an attribution proxy, not workflow-only token telemetry.
- Paired reductions and Lean token shares are computed within each identical case and repetition. The declared token target uses the ratio of summed LeanPowers tokens to summed Superpowers tokens across all-matched-pairs; every-pair and median shares remain distribution diagnostics rather than substitute quality gates. Complete telemetry and the full target population are required. Failing faster or skipping workflow gates never counts as an improvement.
- Codex CLI does not expose a deterministic seed, so paired repetitions reduce noise but do not eliminate it.
- Exact terminal model-capacity failures without complete token telemetry may retry once from a fresh disposable workspace. Capacity retries are isolated from workflow wall-time comparisons, remain visible as separate attempt time, and never apply to agent, test, verifier, or conformance failures.
- The reported cases cover only these scenario classes: small-explicit-feature, unknown-cause-defect. They do not establish universal non-inferiority.
- Raw transcripts remain local and are written only after every run finishes. Disposable workspaces are destroyed after each run and are not publication artifacts.
