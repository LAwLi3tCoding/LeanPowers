# Frozen held-out development-effects comparison

Evidence level: **paired-development-heldout**. This is frozen confirmatory coding evidence for the listed cases and revisions, but it is not the full 11-scenario release benchmark.

Frozen run contract: **verified**. Confirmatory eligibility: **yes**.

Run matrix: **complete**. Token-target conclusions are unavailable unless the declared matrix and target population are complete.

Runtime: codex-cli 0.142.5; model: gpt-5.3-codex-spark; effort: low.

Agent read isolation: codex-minimal-workspace-plugin-toolchain-read-v1; permission profile: benchmark; preflight: PASS.

Revisions: Superpowers d884ae04edebef577e82ff7c4e143debd0bbec99; LeanPowers 94c491a14e61c931dfa1261fb75c92d42ac66a49; evaluator 94c491a14e61c931dfa1261fb75c92d42ac66a49; runner 94c491a14e61c931dfa1261fb75c92d42ac66a49.

Suite manifest: cbace9b1542ad9e6f2d65d1b63a25e1f3e2f9f26621db64fb7c00caf02b08b40.

Case | Workspace snapshot | Hidden verifier snapshot | Fault-family snapshot
--- | --- | --- | ---
atomic-config-migrations | 5ab5b8cc16323b52147caaca0fecfc909b4f1aa39b4b85d50023a00eebe90ef6 | e8692c047e76a2e18d96dd35a83515114ad489bb1b9feda733ba8440384ae3c4 | 0e025be841e27f1b3ea06ba8fec22aadd03cf891439a023e80e9e42e6a301290
stable-priority-merge | eb1de002fe723014e929aae1c3bcb03472cba7da573b025dc8b23f13dde7e35d | 5441beb649c0f228c120aa5beb502bbb734a51bc36397f0ca9da673d54a91560 | 749a43751d9647f56d24bb7f180c67bb1009ff1ac090ac3471b4e65975767305
generation-guarded-refresh-cache | b99490d67bd3b496da034bbb8821fd4951923cb94b4e163081dc05ff5b3b0fb4 | 89b585b23ac5161c576ced949a968fbe6a316f35bf38a51a6aa3d712c7680791 | e45f1d2409e385f9154fceafb637716ede1d5dbce063976a69de70a29183c097

Activation: explicit-entrypoint. Each run explicitly invokes its installed top-level workflow entrypoint and must name it in the first agent progress message before the identical engineering task.

Superpowers 6.1.1 is the upstream baseline and inspiration for LeanPowers. This report measures a bounded tradeoff under the listed conditions; it is not a winner ranking.

## Aggregate

Workflow | Task PASS | Median model tokens | Median fresh tokens | Median wall seconds | Median tool calls | Median workflow reads | Declaration failures | Conformance failures | Scope violations
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
superpowers-6.1.1 | 1/6 | 333885.5 | 48857 | 43.8 | 14.5 | 3 | 0 | 0 | 0
leanpowers-0.2.0 | 2/6 | 245415.5 | 49328 | 39.8 | 10 | 0 | 0 | 6 | 0

## Results by task category

Category | Pairs | Superpowers quality | LeanPowers quality | Superpowers total tokens | LeanPowers total tokens | Lean token share | Superpowers median tokens | LeanPowers median tokens | Superpowers median wall | LeanPowers median wall | Lean wall reduction
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
atomic migration build | 2 | 0/2 | 0/2 | 597197 | 340949 | 57.091546005756896% | 298598.5 | 170474.5 | 41.7 | 37.1 | 10.1%
stable priority build | 2 | 0/2 | 0/2 | 618693 | 490831 | 79.33353052321588% | 309346.5 | 245415.5 | 61.8 | 37.2 | 35.1%
generation-guarded cache debug | 2 | 1/2 | 2/2 | 1367039 | 2059080 | 150.62335456413462% | 683519.5 | 1029540 | 69.9 | 230.1 | -309.4%
build owner aggregate | 4 | 0/4 | 0/4 | 1215890 | 831780 | 68.40914885392593% | 298598.5 | 188770 | 43.8 | 37.2 | 21.2%
debug owner aggregate | 2 | 1/2 | 2/2 | 1367039 | 2059080 | 150.62335456413462% | 683519.5 | 1029540 | 69.9 | 230.1 | -309.4%

## Category source diagnostics

Category | Workflow | Median fresh tokens | Median output tokens | Median tool calls | Median workflow reads | Capacity retries | Infrastructure retry wall
--- | --- | ---: | ---: | ---: | ---: | ---: | ---:
atomic migration build | superpowers-6.1.1 | 52326.5 | 8498.5 | 13 | 1 | 1 | 28.9
atomic migration build | leanpowers-0.2.0 | 41514.5 | 10658.5 | 6.5 | 0 | 0 | 0
stable priority build | superpowers-6.1.1 | 36258.5 | 10929.5 | 12 | 3 | 0 | 0
stable priority build | leanpowers-0.2.0 | 48615.5 | 9150 | 10 | 0 | 0 | 0
generation-guarded cache debug | superpowers-6.1.1 | 61311.5 | 14110 | 19.5 | 3 | 0 | 0
generation-guarded cache debug | leanpowers-0.2.0 | 76516 | 20652.5 | 23 | 0 | 0 | 0
build owner aggregate | superpowers-6.1.1 | 40704 | 9831.5 | 13 | 2.5 | 1 | 28.9
build owner aggregate | leanpowers-0.2.0 | 43986.5 | 9255.5 | 8 | 0 | 0 | 0
debug owner aggregate | superpowers-6.1.1 | 61311.5 | 14110 | 19.5 | 3 | 0 | 0
debug owner aggregate | leanpowers-0.2.0 | 76516 | 20652.5 | 23 | 0 | 0 | 0

## Token target

Metric: **aggregate-model-token-share** across **all-matched-pairs**; LeanPowers target: at most **60%** of Superpowers model tokens.

Status: **FAIL**; eligible pairs: 6/6; observed share: 111.9%.

Performance-goal assessment: **FAIL — target missed**. The 60–65% band never bypasses quality gates and is not an automatic PASS.

Wall time is secondary: complete pair telemetry is mandatory; 0% through -20% is an advisory non-improvement, while a slowdown greater than 20% is a material regression.

## Paired reductions

Population | Eligible/required pairs | Aggregate Lean token share | Median model-token reduction | Median Lean token share | Max Lean token share | Lean ≤60% pairs | Median fresh-token reduction | Median wall reduction | Median tool-call reduction | Median workflow-read reduction
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
Both Task PASS + Lean quality-bearing conformance + Superpowers activation (primary) | 0/6 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/6 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
Primary: lean | 0/2 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/2 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
Primary: standard | 0/0 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/0 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
Primary: strict | 0/4 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/4 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
Both workflows PASS | 1/6 | 333.518068497701% (n=1) | -233.5% (n=1) | 333.518068497701% (n=1) | 333.518068497701% (n=1) | 0/6 | -68.4% (n=1) | -501.7% (n=1) | -58.8% (n=1) | n/a (n=0)
All matched runs | 6/6 | 111.92177562759178% (n=6) | 26% (n=6) | 73.97527125227495% (n=6) | 333.518068497701% (n=6) | 1/6 | -6.5% (n=6) | 8.6% (n=6) | 20.2% (n=6) | n/a (n=0)

## Paired runs

Case | Risk | Rep | Workflow | Task | Conformance | Declared | Artifact regression | Model tokens | Fresh tokens | Wall seconds | Attempts | Capacity retry wall | Tool calls | Workflow reads | Product files | Workflow artifacts | Scope violations
--- | --- | ---: | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
atomic-config-migrations | strict | 1 | superpowers-6.1.1 | FAIL | PASS | yes | PASS | 280489 | 44457 | 44.5 | 1 | 0 | 12 | 0 | 2 | 0 | 0
atomic-config-migrations | strict | 1 | leanpowers-0.2.0 | FAIL | FAIL | yes | FAIL | 181946 | 38330 | 34.4 | 1 | 0 | 6 | 0 | 2 | 0 | 0
stable-priority-merge | lean | 1 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | 267630 | 35566 | 43.2 | 1 | 0 | 9 | 3 | 2 | 0 | 0
stable-priority-merge | lean | 1 | leanpowers-0.2.0 | FAIL | FAIL | yes | FAIL | 195594 | 43274 | 34.7 | 1 | 0 | 9 | 0 | 2 | 0 | 0
generation-guarded-refresh-cache | strict | 1 | superpowers-6.1.1 | PASS | PASS | yes | PASS | 400393 | 53257 | 40.8 | 1 | 0 | 17 | 3 | 2 | 0 | 0
generation-guarded-refresh-cache | strict | 1 | leanpowers-0.2.0 | PASS | FAIL | yes | PASS | 1335383 | 89687 | 245.4 | 1 | 0 | 27 | 0 | 2 | 0 | 0
atomic-config-migrations | strict | 2 | leanpowers-0.2.0 | FAIL | FAIL | yes | FAIL | 159003 | 44699 | 39.9 | 1 | 0 | 7 | 0 | 2 | 0 | 0
atomic-config-migrations | strict | 2 | superpowers-6.1.1 | FAIL | PASS | yes | PASS | 316708 | 60196 | 39 | 2 | 28.9 | 14 | 2 | 2 | 0 | 0
stable-priority-merge | lean | 2 | leanpowers-0.2.0 | FAIL | FAIL | yes | FAIL | 295237 | 53957 | 39.7 | 1 | 0 | 11 | 0 | 2 | 0 | 0
stable-priority-merge | lean | 2 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | 351063 | 36951 | 80.3 | 1 | 0 | 15 | 3 | 2 | 0 | 0
generation-guarded-refresh-cache | strict | 2 | leanpowers-0.2.0 | PASS | FAIL | yes | PASS | 723697 | 63345 | 214.9 | 1 | 0 | 19 | 0 | 2 | 0 | 0
generation-guarded-refresh-cache | strict | 2 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | 966646 | 69366 | 99 | 1 | 0 | 22 | 3 | 2 | 0 | 0

## Failed-run reasons

- r1-atomic-config-migrations-superpowers-6.1.1: hidden verifier failed
- r1-atomic-config-migrations-leanpowers-0.2.0: artifact regression evidence did not pass; artifact regression gate extended-flat-primitive-acceptance: candidate visible tests did not kill every semantic fault member
- r1-stable-priority-merge-superpowers-6.1.1: artifact regression evidence did not pass; artifact regression gate input-immutability: candidate visible tests did not kill every semantic fault member
- r1-stable-priority-merge-leanpowers-0.2.0: artifact regression evidence did not pass; artifact regression gate input-immutability: candidate visible tests did not kill every semantic fault member; artifact regression gate fresh-output-records: candidate visible tests did not kill every semantic fault member
- r2-atomic-config-migrations-leanpowers-0.2.0: artifact regression evidence did not pass; artifact regression gate extended-flat-primitive-acceptance: candidate visible tests did not kill every semantic fault member
- r2-atomic-config-migrations-superpowers-6.1.1: hidden verifier failed
- r2-stable-priority-merge-leanpowers-0.2.0: artifact regression evidence did not pass; artifact regression gate input-immutability: candidate visible tests did not kill every semantic fault member
- r2-stable-priority-merge-superpowers-6.1.1: artifact regression evidence did not pass; artifact regression gate input-immutability: candidate visible tests did not kill every semantic fault member; artifact regression gate fresh-output-records: candidate visible tests did not kill every semantic fault member
- r2-generation-guarded-refresh-cache-superpowers-6.1.1: artifact regression evidence did not pass; artifact regression gate stale-rejection-generation-guard: candidate-test semantic fault run timed out; artifact regression gate full-settlement-generation-guard: candidate-test semantic fault run timed out

## Validity exclusions

Infrastructure failures: **0**; telemetry-gap runs: **0**; invalid or excluded pairs: **0**. These observations are excluded from Token and wall-time conclusions.

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
