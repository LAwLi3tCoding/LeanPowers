# Frozen held-out development-effects comparison

Evidence level: **paired-development-heldout**. This is frozen confirmatory coding evidence for the listed cases and revisions, but it is not the full 11-scenario release benchmark.

Frozen run contract: **verified**. Confirmatory eligibility: **yes**.

Run matrix: **complete**. Token-target conclusions are unavailable unless the declared matrix and target population are complete.

Runtime: codex-cli 0.142.5; model: gpt-5.3-codex-spark; effort: low.

Agent read isolation: codex-minimal-workspace-plugin-toolchain-read-v1; permission profile: benchmark; preflight: PASS.

Revisions: Superpowers d884ae04edebef577e82ff7c4e143debd0bbec99; LeanPowers 5716ee0efd27079c317d398e725c95f763f5f376; evaluator 5716ee0efd27079c317d398e725c95f763f5f376; runner 5716ee0efd27079c317d398e725c95f763f5f376.

Suite manifest: 3d77b4bb81d551e50a4905be104474247fdf7f7eee53f861c1ee6bcf854ddc76.

Case | Workspace snapshot | Hidden verifier snapshot | Fault-family snapshot
--- | --- | --- | ---
http-accept-negotiation | bf33257e741993c67f07488511421514fb47396a4876b6550e6e04d51d4c46a6 | a877f9aca988299af4ab894751991050221d2eb6c7a1bfbac2d9ef04840eea7e | bf4dc9608dff66878f5bdce32e0e6d2bc43c88fc9faf28b7440f2938eae19d58
safe-redirect-policy | 5d9fa07362620e00a9b2e003b842ebbd9d4af9e010df0ac59e412269305ae79d | b8f34155d73843c293201539b7f064151477afb2a8d2c17f3cd79f02837a7bc0 | bbc0b4fa186168c83ef33ee7bfe7bf7f1a004c01dc6b93f9e54eb04ea51b8642
keyset-cursor-page | ad5d1c7f9d4d822c452ec4b96e98bb13396cfeba1fadf267f9dea78a62feb5ce | 5213039d904bb4c84a7e3b4761c26a3ad76dbac28bed4597237f6133eda6ac09 | 0fd8718643f3ddeef00dd20e838d441564d040385c31575cb2c790bef1900448

Activation: explicit-entrypoint. Each run explicitly invokes its installed top-level workflow entrypoint and must name it in the first agent progress message before the identical engineering task.

Superpowers 6.1.1 is the upstream baseline and inspiration for LeanPowers. This report measures a bounded tradeoff under the listed conditions; it is not a winner ranking.

## Machine decision

Status: **FAIL**

Reasons: run-integrity, task-outcome, lean-conformance, token-telemetry, token-summary, token-target.

Advisories: none.

## Aggregate

Workflow | Task PASS | Median model tokens | Median fresh tokens | Median wall seconds | Median tool calls | Median workflow reads | Declaration failures | Conformance failures | Scope violations
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
superpowers-6.1.1 | 0/6 | 349387 | 50124 | 42 | 16 | 2 | 0 | 0 | 0
leanpowers-0.2.0 | 0/6 | 330707.5 | 55976 | 41.3 | 15.5 | 0 | 1 | 6 | 0

## Results by task category

Category | Pairs | Superpowers quality | LeanPowers quality | Superpowers total tokens | LeanPowers total tokens | Lean token share | Superpowers median tokens | LeanPowers median tokens | Superpowers median wall | LeanPowers median wall | Lean wall reduction
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
HTTP negotiation build | 2 | 0/2 | 0/2 | 832504 | 582096 | 69.92110548417786% | 416252 | 291048 | 41.4 | 41.3 | -1.9%
safe redirect build | 1 | 0/2 | 0/2 | 288460 | 786702 | 272.72481453234417% | 288460 | 786702 | 37.7 | 54.6 | -45%
keyset cursor debug | 2 | 0/2 | 0/2 | 818213 | 616419 | 75.33722881450184% | 409106.5 | 308209.5 | 41.7 | 36.3 | 11.8%
build owner aggregate | 3 | 0/4 | 0/4 | 1120964 | 1368798 | 122.10900617682638% | 335215 | 332890 | 37.7 | 43.1 | -18.6%
debug owner aggregate | 2 | 0/2 | 0/2 | 818213 | 616419 | 75.33722881450184% | 409106.5 | 308209.5 | 41.7 | 36.3 | 11.8%

## Category source diagnostics

Category | Workflow | Median fresh tokens | Median output tokens | Median tool calls | Median workflow reads | Capacity retries | Infrastructure retry wall
--- | --- | ---: | ---: | ---: | ---: | ---: | ---:
HTTP negotiation build | superpowers-6.1.1 | 51900 | 13237 | 17 | 1.5 | 0 | 0
HTTP negotiation build | leanpowers-0.2.0 | 55976 | 14190 | 12.5 | 0 | 0 | 0
safe redirect build | superpowers-6.1.1 | 50124 | 11985 | 14 | 1 | 0 | 0
safe redirect build | leanpowers-0.2.0 | 65422 | 15208 | 25 | 0 | 0 | 0
keyset cursor debug | superpowers-6.1.1 | 45266.5 | 9169 | 18.5 | 2 | 0 | 0
keyset cursor debug | leanpowers-0.2.0 | 46897.5 | 10046 | 15 | 0 | 0 | 0
build owner aggregate | superpowers-6.1.1 | 50124 | 12589 | 14 | 1 | 0 | 0
build owner aggregate | leanpowers-0.2.0 | 61786 | 14619 | 15 | 0 | 0 | 0
debug owner aggregate | superpowers-6.1.1 | 45266.5 | 9169 | 18.5 | 2 | 0 | 0
debug owner aggregate | leanpowers-0.2.0 | 46897.5 | 10046 | 15 | 0 | 0 | 0

## Category token sources

Category | Superpowers total | LeanPowers total | Total excess | Target excess | Superpowers cached | LeanPowers cached | Cached excess | Superpowers fresh | LeanPowers fresh | Fresh excess | Superpowers tool calls | LeanPowers tool calls | Superpowers tool types | LeanPowers tool types | Superpowers agent messages | LeanPowers agent messages
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---:
HTTP negotiation build | 832504 | 582096 | -250408 | 9.9% | 728704 | 470144 | -258560 | 103800 | 111952 | 8152 | 34 | 25 | command_execution:19, file_change:15 | command_execution:16, file_change:9 | n/a | n/a
safe redirect build | 288460 | 786702 | 498242 | 212.7% | 238336 | 721280 | 482944 | 50124 | 65422 | 15298 | 14 | 25 | command_execution:9, file_change:5 | command_execution:16, file_change:9 | n/a | n/a
keyset cursor debug | 818213 | 616419 | -201794 | 15.3% | 727680 | 522624 | -205056 | 90533 | 93795 | 3262 | 37 | 30 | command_execution:27, file_change:10 | command_execution:20, file_change:10 | n/a | n/a
build owner aggregate | 1120964 | 1368798 | 247834 | 62.1% | 967040 | 1191424 | 224384 | 153924 | 177374 | 23450 | 48 | 50 | command_execution:28, file_change:20 | command_execution:32, file_change:18 | n/a | n/a
debug owner aggregate | 818213 | 616419 | -201794 | 15.3% | 727680 | 522624 | -205056 | 90533 | 93795 | 3262 | 37 | 30 | command_execution:27, file_change:10 | command_execution:20, file_change:10 | n/a | n/a

## Pair token excess

Case | Rep | Superpowers total | LeanPowers total | Lean token share | Target excess | Total excess | Superpowers cached | LeanPowers cached | Cached excess | Superpowers fresh | LeanPowers fresh | Fresh excess | Superpowers tool calls | LeanPowers tool calls | Superpowers tool types | LeanPowers tool types | Superpowers agent messages | LeanPowers agent messages
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---:
http-accept-negotiation | 1 | 335215 | 249206 | 74.3% | 14.3% | -86009 | 269952 | 199040 | -70912 | 65263 | 50166 | -15097 | 13 | 10 | command_execution:7, file_change:6 | command_execution:5, file_change:5 | n/a | n/a
keyset-cursor-page | 1 | 349387 | 287894 | 82.4% | 22.4% | -61493 | 309376 | 241920 | -67456 | 40011 | 45974 | 5963 | 18 | 14 | command_execution:13, file_change:5 | command_execution:9, file_change:5 | n/a | n/a
http-accept-negotiation | 2 | 497289 | 332890 | 66.9% | 6.9% | -164399 | 458752 | 271104 | -187648 | 38537 | 61786 | 23249 | 21 | 15 | command_execution:12, file_change:9 | command_execution:11, file_change:4 | n/a | n/a
keyset-cursor-page | 2 | 468826 | 328525 | 70.1% | 10.1% | -140301 | 418304 | 280704 | -137600 | 50522 | 47821 | -2701 | 19 | 16 | command_execution:14, file_change:5 | command_execution:11, file_change:5 | n/a | n/a
safe-redirect-policy | 2 | 288460 | 786702 | 272.7% | 212.7% | 498242 | 238336 | 721280 | 482944 | 50124 | 65422 | 15298 | 14 | 25 | command_execution:9, file_change:5 | command_execution:16, file_change:9 | n/a | n/a

## Token target

Metric: **aggregate-model-token-share** across **all-matched-pairs**; LeanPowers target: at most **60%** of Superpowers model tokens.

Status: **INELIGIBLE**; eligible pairs: 5/6; observed share: n/a.

## Paired reductions

Population | Eligible/required pairs | Aggregate Lean token share | Median model-token reduction | Median Lean token share | Max Lean token share | Lean ≤60% pairs | Median fresh-token reduction | Median wall reduction | Median tool-call reduction | Median workflow-read reduction
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
Both Task PASS + Lean quality-bearing conformance + Superpowers activation (primary) | 0/6 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/6 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
Primary: lean | 0/0 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/0 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
Primary: standard | 0/4 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/4 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
Primary: strict | 0/2 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/2 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
Both workflows PASS | 0/6 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/6 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
All matched runs | 5/6 | 102.3742030768723% (n=5) | 25.7% (n=5) | 74.34213862744805% (n=5) | 272.72481453234417% (n=5) | 0/6 | -14.9% (n=5) | 2.4% (n=5) | 22.2% (n=5) | n/a (n=0)

## Paired runs

Case | Risk | Rep | Workflow | Task | Conformance | Declared | Artifact regression | Model tokens | Fresh tokens | Wall seconds | Attempts | Capacity retry wall | Tool calls | Workflow reads | Product files | Workflow artifacts | Scope violations
--- | --- | ---: | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
http-accept-negotiation | standard | 1 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | 335215 | 65263 | 36.3 | 1 | 0 | 13 | 1 | 2 | 0 | 0
http-accept-negotiation | standard | 1 | leanpowers-0.2.0 | FAIL | FAIL | yes | FAIL | 249206 | 50166 | 43.1 | 1 | 0 | 10 | 0 | 2 | 0 | 0
safe-redirect-policy | strict | 1 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | n/a | n/a | 140.3 | 1 | 0 | 10 | 2 | 2 | 0 | 0
safe-redirect-policy | strict | 1 | leanpowers-0.2.0 | FAIL | FAIL | yes | FAIL | 1820106 | 102858 | 104.3 | 1 | 0 | 40 | 0 | 2 | 0 | 0
keyset-cursor-page | standard | 1 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | 349387 | 40011 | 36.2 | 1 | 0 | 18 | 2 | 2 | 0 | 0
keyset-cursor-page | standard | 1 | leanpowers-0.2.0 | FAIL | FAIL | yes | FAIL | 287894 | 45974 | 35.3 | 1 | 0 | 14 | 0 | 2 | 0 | 0
http-accept-negotiation | standard | 2 | leanpowers-0.2.0 | FAIL | FAIL | no | FAIL | 332890 | 61786 | 39.6 | 1 | 0 | 15 | 0 | 2 | 0 | 0
http-accept-negotiation | standard | 2 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | 497289 | 38537 | 46.4 | 1 | 0 | 21 | 2 | 2 | 0 | 0
safe-redirect-policy | strict | 2 | leanpowers-0.2.0 | FAIL | FAIL | yes | FAIL | 786702 | 65422 | 54.6 | 1 | 0 | 25 | 0 | 2 | 0 | 0
safe-redirect-policy | strict | 2 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | 288460 | 50124 | 37.7 | 1 | 0 | 14 | 1 | 2 | 0 | 0
keyset-cursor-page | standard | 2 | leanpowers-0.2.0 | FAIL | FAIL | yes | FAIL | 328525 | 47821 | 37.3 | 1 | 0 | 16 | 0 | 2 | 0 | 0
keyset-cursor-page | standard | 2 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | 468826 | 50522 | 47.3 | 1 | 0 | 19 | 2 | 2 | 0 | 0

## Failed-run reasons

- r1-http-accept-negotiation-superpowers-6.1.1: artifact regression evidence did not pass; artifact regression gate complete-own-key-validation: candidate visible tests did not kill every semantic fault member; artifact regression gate winner-specificity: candidate visible tests did not kill every semantic fault member; artifact regression gate governing-range-header-order: candidate visible tests did not kill every semantic fault member
- r1-http-accept-negotiation-leanpowers-0.2.0: hidden verifier failed; artifact regression evidence did not pass; artifact regression gate complete-own-key-validation: candidate visible tests did not kill every semantic fault member; artifact regression gate winner-header-order: candidate visible tests did not kill every semantic fault member; artifact regression gate governing-range-header-order: candidate visible tests did not kill every semantic fault member
- r1-safe-redirect-policy-superpowers-6.1.1: agent exited non-zero; agent did not complete a turn; artifact regression evidence did not pass; artifact regression gate default-port-canonical-origin: no candidate visible test delta; artifact regression gate credential-rejection: no candidate visible test delta; artifact regression gate web-protocol-only: no candidate visible test delta; artifact regression gate host-boundary-isolation: no candidate visible test delta; artifact regression gate exact-origin-isolation: no candidate visible test delta; artifact regression gate raw-confusable-rejection: no candidate visible test delta; artifact regression gate accessor-safe-allowlist: no candidate visible test delta; artifact regression gate dot-segment-normalization: no candidate visible test delta; artifact regression gate scheme-relative-resolution: no candidate visible test delta
- r1-safe-redirect-policy-leanpowers-0.2.0: artifact regression evidence did not pass; artifact regression gate web-protocol-only: candidate visible tests did not kill every semantic fault member
- r1-keyset-cursor-page-superpowers-6.1.1: artifact regression evidence did not pass; artifact regression gate exact-array-keys: candidate visible tests did not kill every semantic fault member; artifact regression gate exact-tuple-keys: candidate visible tests did not kill every semantic fault member; artifact regression gate fresh-terminal-items: candidate visible tests did not kill every semantic fault member; artifact regression gate fresh-next-cursor: candidate visible tests did not kill every semantic fault member
- r1-keyset-cursor-page-leanpowers-0.2.0: artifact regression evidence did not pass; artifact regression gate exact-array-keys: candidate visible tests did not kill every semantic fault member; artifact regression gate exact-tuple-keys: candidate visible tests did not kill every semantic fault member; artifact regression gate fresh-terminal-items: candidate visible tests did not kill every semantic fault member; artifact regression gate fresh-next-cursor: candidate visible tests did not kill every semantic fault member
- r2-http-accept-negotiation-leanpowers-0.2.0: hidden verifier failed; artifact regression evidence did not pass; artifact regression gate complete-own-key-validation: candidate visible tests did not kill every semantic fault member; artifact regression gate governing-range-specificity: candidate visible tests did not kill every semantic fault member; artifact regression gate governing-range-header-order: candidate visible tests did not kill every semantic fault member
- r2-http-accept-negotiation-superpowers-6.1.1: hidden verifier failed; artifact regression evidence did not pass; artifact regression gate complete-own-key-validation: candidate visible tests did not kill every semantic fault member; artifact regression gate governing-range-specificity: candidate visible tests did not kill every semantic fault member; artifact regression gate quality-weighting: candidate visible tests did not kill every semantic fault member; artifact regression gate winner-header-order: candidate visible tests did not kill every semantic fault member; artifact regression gate governing-range-header-order: candidate visible tests did not kill every semantic fault member; artifact regression gate zero-quality-exclusion: candidate visible tests did not kill every semantic fault member
- r2-safe-redirect-policy-leanpowers-0.2.0: hidden verifier failed; artifact regression evidence did not pass; artifact regression gate default-port-canonical-origin: candidate visible tests did not kill every semantic fault member; artifact regression gate web-protocol-only: candidate visible tests did not kill every semantic fault member
- r2-safe-redirect-policy-superpowers-6.1.1: artifact regression evidence did not pass; artifact regression gate web-protocol-only: candidate visible tests did not kill every semantic fault member; artifact regression gate host-boundary-isolation: candidate visible tests did not kill every semantic fault member
- r2-keyset-cursor-page-leanpowers-0.2.0: artifact regression evidence did not pass; artifact regression gate exact-array-keys: candidate visible tests did not kill every semantic fault member; artifact regression gate fresh-terminal-items: candidate visible tests did not kill every semantic fault member
- r2-keyset-cursor-page-superpowers-6.1.1: artifact regression evidence did not pass; artifact regression gate exact-array-keys: candidate visible tests did not kill every semantic fault member; artifact regression gate fresh-terminal-items: candidate visible tests did not kill every semantic fault member

## Workflow conformance reasons

- r1-http-accept-negotiation-leanpowers-0.2.0: ordered pre-product source and failing RED evidence was not observed; READ omitted discovered files that were later changed; ordered TEST-PATCH, RED, and CODE-PATCH protocol was not observed
- r1-safe-redirect-policy-leanpowers-0.2.0: ordered pre-product source and failing RED evidence was not observed; READ omitted discovered files that were later changed; ordered TEST-PATCH, RED, and CODE-PATCH protocol was not observed; current passing independent review was not observed
- r1-keyset-cursor-page-leanpowers-0.2.0: bounded DEBUG recovery protocol was not observed
- r2-http-accept-negotiation-leanpowers-0.2.0: top-level workflow declaration was not reported; structured LeanPowers route declaration was not reported; declared no workflow instead of build; route ledger was not emitted before task tools; ordered pre-product source and failing RED evidence was not observed; ordered TEST-PATCH, RED, and CODE-PATCH protocol was not observed
- r2-safe-redirect-policy-leanpowers-0.2.0: ordered pre-product source and failing RED evidence was not observed; READ omitted discovered files that were later changed; ordered TEST-PATCH, RED, and CODE-PATCH protocol was not observed; current passing independent review was not observed
- r2-keyset-cursor-page-leanpowers-0.2.0: bounded DEBUG recovery protocol was not observed

## Validity exclusions

Infrastructure failures: **0**; telemetry-gap runs: **1**; Invalid or excluded pairs: **1**. Invalid pairs are excluded from token and wall-time conclusions.

- safe-redirect-policy r1: token-telemetry

## Interpretation boundary

- Task PASS requires successful agent completion, no timeout, both visible and hidden test success, every case-owned semantic fault family policy to pass, and no changed-path scope violation. Workflow declaration and risk-routing conformance are reported separately.
- LeanPowers quality-bearing conformance requires an unambiguous semantic route declaration before any task tool, rejects conflicting declarations, and forbids risk downgrade after an upgrade. Build/debug traces must show each later-edited existing file was successfully read before its own first edit and supported successful validation after the final edit. Build additionally requires test-only edits before the first product edit, one or more meaningful focused RED results after the final test correction, preservation of those RED test paths, and product-only edits thereafter. Every pre-product evidence window may contain only proven reads, narrow Git reporting, and completed nonfatal canonical test attempts; the final window's last test attempt must be a meaningful RED. Evidence-driven invalid test-design corrections and repeated RED confirmation are allowed, while exact counts remain diagnostics rather than fixed gates. Debug requires fixture-owned structured pre-edit reproduction and an initial uninterrupted code-and-test mutation window. One failed supported validation may open exactly one bounded recovery patch only when no other tool intervenes, every recovery path was already read and remains in scope, and the final rerun uses the identical validation command; the resolved reproduction then runs separately. A second failure or recovery is incomplete. Canonical DEBUG completion runs validation before reproduction. When the fixture declares resolved output, only a standalone reproduction can supply quality-bearing evidence and its final nonblank output line must be that exact JSON; combined validation and reproduction remains eligible only for contracts without structured resolved output. Lean and standard runs preserve the first successful validation after the first product edit or initial DEBUG mutation; only proven relative-file reads and the narrow Git reporting allowlist may follow. Strict runs require the same freshness from validation through reviewer spawn and wait, preserve the final passing review under the same read-only boundary, and separately prove the designated reviewer did not mutate the workspace. Discovery syntax, extra grounded-file reads, split versus batched reads, validation-manifest reads, Skill/reference reloads, exact pre-validation command/call budgets, clause-ledger shape, repeated route or ledger presentation, and one-call versus two-call validation remain efficiency or ceremony diagnostics rather than quality gates. Representation-boundary adequacy is measured workflow-neutrally in Task PASS: every pre-registered fault-family member must preserve baseline tests, every candidate counterfactual must complete, and every member must be killed by the candidate test delta. Reproduction telemetry proves the exact command and, when declared, resolved structured output; it is not universal semantic proof. These observable checks are scoped to the 3 reported fixtures, not universal semantic proof. Strict quality additionally requires a current independent PASS review with the complete task and current validation context; exact Skill invocation, prompt/verdict surface, reviewer count, wait targeting, and cycle choreography remain diagnostics.
- Async/blocking review adapter mechanics are runtime-specific diagnostics. The quality gate is one fresh read-only independent review effect; Codex JSONL does not expose every raw adapter argument.
- Model tokens sum Codex input and output tokens. Fresh tokens are uncached input plus output. Reasoning output is already included in output and is never double-counted. Missing or impossible telemetry is shown as n/a, never zero.
- Workflow reads are exact observed Skill/reference file reads from command traces. They are an attribution proxy, not workflow-only token telemetry.
- Paired reductions and Lean token shares are computed within each identical case and repetition. The declared token target uses the ratio of summed LeanPowers tokens to summed Superpowers tokens across all-matched-pairs; every-pair and median shares remain distribution diagnostics rather than substitute quality gates. Complete telemetry and the full target population are required. Failing faster or skipping workflow gates never counts as an improvement.
- Codex CLI does not expose a deterministic seed, so paired repetitions reduce noise but do not eliminate it.
- Exact terminal model-capacity failures without complete token telemetry may retry once from a fresh disposable workspace. Capacity retries are isolated from workflow wall-time comparisons, remain visible as separate attempt time, and never apply to agent, test, verifier, or conformance failures.
- The reported cases cover only these scenario classes: small-explicit-feature, unknown-cause-defect. They do not establish universal non-inferiority.
- Raw transcripts remain local and are written only after every run finishes. Disposable workspaces are destroyed after each run and are not publication artifacts.
