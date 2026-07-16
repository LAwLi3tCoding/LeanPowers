# Frozen held-out development-effects comparison

Evidence level: **paired-development-heldout**. This is frozen confirmatory coding evidence for the listed cases and revisions, but it is not the full 11-scenario release benchmark.

Frozen run contract: **verified**. Confirmatory eligibility: **yes**.

Run matrix: **complete**. Token-target conclusions are unavailable unless the declared matrix and target population are complete.

Runtime: codex-cli 0.142.5; model: gpt-5.3-codex-spark; effort: medium.

Agent read isolation: codex-minimal-workspace-plugin-toolchain-read-v1; permission profile: benchmark; preflight: PASS.

Revisions: Superpowers d884ae04edebef577e82ff7c4e143debd0bbec99; LeanPowers 1e59e068e48070f30ebd6b74efbb31e479445a34; evaluator 7295033839683084f63869460b4d026272c7e566; runner 7295033839683084f63869460b4d026272c7e566.

Suite manifest: fe9c8f26c54d922aa998b7e51ef22a6edfee608351836de99285cc105f778d41.

Case | Workspace snapshot | Hidden verifier snapshot | Fault-family snapshot
--- | --- | --- | ---
stable-unique-tokens | 9e7044d0cc37294f74610ff83de09d667cdfbb8ea1434eff359e96b46cc1a64c | 6c145936ed7d9168d9d3a9be447bd44fe8736a3321b6e50921e3aa99a64040d4 | ef9e9d7951f896157a79e0168e2b525d1d60b25b28eb56a09819bae01d6efbf5
queued-task-permit-release | e92a2e48f77f7731e6e741f1171319892d980f457f276c5c924820d02fc5e3e2 | 138f813a97f4b269bd5c47f6d98c2295d33e033b727ada18393b253527b8bc4a | d6a5d9103563cdd238d35bcf4d4d0e0ffb9f0f74cf6315fa3fc8e0155f15d538
record-data-delta | 5e189a0f637b5115ce119d064136ffa35e48b5204f7276b333e6847bb59fa927 | 606c9826895a8a37b9d6345fb337bdbad731999e3effcd47deb1cb16ceef715a | 52714ba914e1c9e7447740df58a18dfcd1cbcd1053b070a7c51736326b380ec1
branching-undo-history | 69fbced2fa2e55bfc81f037399d5bc53560e7d276499f5b1161ca49927881e5c | 7768b7ef95ae3806eded63708d0ebe1ddd768db4100e5a6d65ec13656d464dca | 536a49ffc42f8addca290f726a0c83efb8734c46bc798b11534058163504796d
forward-header-sanitization | ad9d2bfde404b9f31e4ca6b25ff4892762a39b4023727d0240a99c1278fe2a9e | c1818f94cf3eea4f8a6c406eac46ffa7c7b7551998ed17d668e0e2c9ca33f19f | 7c5a5bc196f6f4d2401543ef53935eb4da2cd7bcfad23d713c925969e3a809b5

Activation: explicit-entrypoint. Each run explicitly invokes its installed top-level workflow entrypoint and must name it in the first agent progress message before the identical engineering task.

Quality policy: every LeanPowers task outcome and LeanPowers quality-bearing conformance check must pass; every Superpowers run must activate and is evaluated with the identical acceptance contract, while its task outcome remains a reported reference diagnostic rather than a LeanPowers goal gate.

Superpowers 6.1.1 is the upstream baseline and inspiration for LeanPowers. This report measures a bounded tradeoff under the listed conditions; it is not a winner ranking.

## Machine decision

Status: **FAIL**

Reasons: run-integrity, lean-conformance, lean-task-outcome, superpowers-activation, token-telemetry, token-summary, token-target, wall-telemetry.

Advisories: none.

## Aggregate

Workflow | Task PASS | Median model tokens | Median fresh tokens | Median wall seconds | Median tool calls | Median workflow reads | Declaration failures | Conformance failures | Scope violations
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
superpowers-6.1.1 | 3/10 | 413898 | 49253 | 66 | 18 | 2.5 | 1 | 1 | 0
leanpowers-0.2.0 | 2/10 | 263874.5 | 33314.5 | 52.1 | 11.5 | 0 | 2 | 9 | 0

## Layered quality diagnostics

Population: **complete valid matched pairs**; interpretation eligibility: **no** (7/10).

Paired outcome quadrant | Count
--- | ---:
both_pass | 1
superpowers_pass_lean_fail | 1
lean_pass_superpowers_fail | 1
both_fail | 4

Workflow | Task PASS | Task PASS rate
--- | ---: | ---:
superpowers-6.1.1 | 2/7 | 28.6%
leanpowers-0.2.0 | 2/7 | 28.6%

Shared floor (both Task PASS rates <20%): **ineligible**.

Shared ceiling (both Task PASS rates >80%): **ineligible**.

Directional asymmetry: **yes**; Superpowers PASS / LeanPowers FAIL: **1**; LeanPowers PASS / Superpowers FAIL: **1**.

## Results by task category

Category | Pairs | Superpowers quality | LeanPowers quality | Superpowers total tokens | LeanPowers total tokens | Lean token share | Superpowers median tokens | LeanPowers median tokens | Superpowers median wall | LeanPowers median wall | Lean wall reduction
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
stable token dedup build | 1 | 2/2 | 1/2 | 321247 | 255241 | 79.45319333721405% | 321247 | 255241 | 50.3 | 54.3 | -8.1%
task limiter debug | 2 | 0/2 | 0/2 | 884619 | 900422 | 101.78641878594061% | 442309.5 | 450211 | 152.2 | 65.3 | 50.1%
record delta build | 1 | 0/2 | 0/2 | 335110 | 199403 | 59.503745038942434% | 335110 | 199403 | 74.1 | 62.7 | 15.5%
undo history debug | 2 | 1/2 | 1/2 | 853551 | 583352 | 68.34412940761595% | 426775.5 | 291676 | 62.3 | 64.1 | -9.5%
hop-by-hop header strict build | 1 | 0/2 | 0/2 | 441852 | 426269 | 96.47325348759314% | 441852 | 426269 | 60.4 | 366.3 | -507%
build owner aggregate | 3 | 2/6 | 1/6 | 1098209 | 880913 | 80.21360232888274% | 335110 | 255241 | 60.4 | 62.7 | -8.1%
debug owner aggregate | 4 | 1/4 | 1/4 | 1738170 | 1483774 | 85.36414735037424% | 426775.5 | 291676 | 90.3 | 65.3 | 29.8%

## Category source diagnostics

Category | Workflow | Median fresh tokens | Median output tokens | Median tool calls | Median workflow reads | Capacity retries | Infrastructure retry wall
--- | --- | ---: | ---: | ---: | ---: | ---: | ---:
stable token dedup build | superpowers-6.1.1 | 41951 | 12502 | 13 | 3 | 0 | 0
stable token dedup build | leanpowers-0.2.0 | 33161 | 11059 | 12 | 0 | 0 | 0
task limiter debug | superpowers-6.1.1 | 53445.5 | 11617.5 | 17 | 3.5 | 0 | 0
task limiter debug | leanpowers-0.2.0 | 49763 | 12201 | 17.5 | 0 | 0 | 0
record delta build | superpowers-6.1.1 | 33798 | 9972 | 16 | 3 | 0 | 0
record delta build | leanpowers-0.2.0 | 32875 | 10002 | 10 | 0 | 0 | 0
undo history debug | superpowers-6.1.1 | 42135.5 | 8973.5 | 18.5 | 2.5 | 0 | 0
undo history debug | leanpowers-0.2.0 | 30748 | 8621 | 15 | 0.5 | 0 | 0
hop-by-hop header strict build | superpowers-6.1.1 | 65532 | 19161 | 18 | 1 | 0 | 0
hop-by-hop header strict build | leanpowers-0.2.0 | 76317 | 27173 | 14 | 0 | 0 | 0
build owner aggregate | superpowers-6.1.1 | 41951 | 12502 | 16 | 3 | 0 | 0
build owner aggregate | leanpowers-0.2.0 | 33161 | 11059 | 12 | 0 | 0 | 0
debug owner aggregate | superpowers-6.1.1 | 47358.5 | 10032.5 | 18.5 | 3 | 0 | 0
debug owner aggregate | leanpowers-0.2.0 | 35173.5 | 8621 | 15 | 0 | 0 | 0

## Category token sources

Category | Superpowers total | LeanPowers total | Total excess | Target excess | Superpowers cached | LeanPowers cached | Cached excess | Superpowers fresh | LeanPowers fresh | Fresh excess | Superpowers tool calls | LeanPowers tool calls | Superpowers tool types | LeanPowers tool types | Superpowers agent messages | LeanPowers agent messages
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---:
stable token dedup build | 321247 | 255241 | -66006 | 19.5% | 279296 | 222080 | -57216 | 41951 | 33161 | -8790 | 13 | 12 | command_execution:9, file_change:3, todo_list:1 | command_execution:10, file_change:2 | n/a | n/a
task limiter debug | 884619 | 900422 | 15803 | 41.8% | 777728 | 800896 | 23168 | 106891 | 99526 | -7365 | 34 | 35 | command_execution:28, file_change:6 | command_execution:24, file_change:11 | n/a | n/a
record delta build | 335110 | 199403 | -135707 | -0.5% | 301312 | 166528 | -134784 | 33798 | 32875 | -923 | 16 | 10 | command_execution:12, file_change:4 | command_execution:7, file_change:3 | n/a | n/a
undo history debug | 853551 | 583352 | -270199 | 8.3% | 769280 | 521856 | -247424 | 84271 | 61496 | -22775 | 37 | 30 | command_execution:27, file_change:10 | command_execution:23, file_change:7 | n/a | n/a
hop-by-hop header strict build | 441852 | 426269 | -15583 | 36.5% | 376320 | 349952 | -26368 | 65532 | 76317 | 10785 | 18 | 14 | command_execution:12, file_change:6 | command_execution:7, file_change:7 | n/a | n/a
build owner aggregate | 1098209 | 880913 | -217296 | 20.2% | 956928 | 738560 | -218368 | 141281 | 142353 | 1072 | 47 | 36 | command_execution:33, file_change:13, todo_list:1 | command_execution:24, file_change:12 | n/a | n/a
debug owner aggregate | 1738170 | 1483774 | -254396 | 25.4% | 1547008 | 1322752 | -224256 | 191162 | 161022 | -30140 | 71 | 65 | command_execution:55, file_change:16 | command_execution:47, file_change:18 | n/a | n/a

## Pair token excess

Case | Rep | Superpowers total | LeanPowers total | Lean token share | Target excess | Total excess | Superpowers cached | LeanPowers cached | Cached excess | Superpowers fresh | LeanPowers fresh | Fresh excess | Superpowers tool calls | LeanPowers tool calls | Superpowers tool types | LeanPowers tool types | Superpowers agent messages | LeanPowers agent messages
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---:
branching-undo-history | 1 | 439653 | 310844 | 70.7% | 10.7% | -128809 | 390400 | 277376 | -113024 | 49253 | 33468 | -15785 | 18 | 16 | command_execution:13, file_change:5 | command_execution:12, file_change:4 | n/a | n/a
forward-header-sanitization | 1 | 441852 | 426269 | 96.5% | 36.5% | -15583 | 376320 | 349952 | -26368 | 65532 | 76317 | 10785 | 18 | 14 | command_execution:12, file_change:6 | command_execution:7, file_change:7 | n/a | n/a
queued-task-permit-release | 1 | 530328 | 741303 | 139.8% | 79.8% | 210975 | 484864 | 678656 | 193792 | 45464 | 62647 | 17183 | 20 | 26 | command_execution:16, file_change:4 | command_execution:17, file_change:9 | n/a | n/a
stable-unique-tokens | 1 | 321247 | 255241 | 79.5% | 19.5% | -66006 | 279296 | 222080 | -57216 | 41951 | 33161 | -8790 | 13 | 12 | command_execution:9, file_change:3, todo_list:1 | command_execution:10, file_change:2 | n/a | n/a
branching-undo-history | 2 | 413898 | 272508 | 65.8% | 5.8% | -141390 | 378880 | 244480 | -134400 | 35018 | 28028 | -6990 | 19 | 14 | command_execution:14, file_change:5 | command_execution:11, file_change:3 | n/a | n/a
queued-task-permit-release | 2 | 354291 | 159119 | 44.9% | -15.1% | -195172 | 292864 | 122240 | -170624 | 61427 | 36879 | -24548 | 14 | 9 | command_execution:12, file_change:2 | command_execution:7, file_change:2 | n/a | n/a
record-data-delta | 2 | 335110 | 199403 | 59.5% | -0.5% | -135707 | 301312 | 166528 | -134784 | 33798 | 32875 | -923 | 16 | 10 | command_execution:12, file_change:4 | command_execution:7, file_change:3 | n/a | n/a

## Token target

Metric: **aggregate-model-token-share** across **all-matched-pairs**; LeanPowers target: at most **60%** of Superpowers model tokens.

Status: **INELIGIBLE**; eligible pairs: 7/10; observed share: n/a.

## Paired reductions

Population | Eligible/required pairs | Aggregate Lean token share | Median model-token reduction | Median Lean token share | Max Lean token share | Lean ≤60% pairs | Median fresh-token reduction | Median wall reduction | Median tool-call reduction | Median workflow-read reduction
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
Lean Task PASS + Lean quality-bearing conformance + Superpowers activation (quality-policy population) | 0/10 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/10 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
Quality-policy population: lean risk | 0/2 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/2 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
Quality-policy population: standard risk | 0/6 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/6 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
Quality-policy population: strict risk | 0/2 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/2 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
Both workflows PASS | 1/10 | 79.45319333721405% (n=1) | 20.5% (n=1) | 79.45319333721405% (n=1) | 79.45319333721405% (n=1) | 0/10 | 21% (n=1) | -8.1% (n=1) | 7.7% (n=1) | n/a (n=0)
All matched runs | 7/10 | 83.36992341291484% (n=7) | 29.3% (n=7) | 70.70212190068077% (n=7) | 139.78198397972577% (n=7) | 2/10 | 20% (n=7) | 15.5% (n=7) | 22.2% (n=7) | 50% (n=1)

## Paired runs

Case | Risk | Rep | Workflow | Task | Conformance | Declared | Artifact regression | Model tokens | Fresh tokens | Wall seconds | Attempts | Capacity retry wall | Tool calls | Workflow reads | Product files | Workflow artifacts | Scope violations
--- | --- | ---: | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
stable-unique-tokens | lean | 1 | superpowers-6.1.1 | PASS | PASS | yes | PASS | 321247 | 41951 | 50.3 | 1 | 0 | 13 | 3 | 2 | 0 | 0
stable-unique-tokens | lean | 1 | leanpowers-0.2.0 | PASS | FAIL | yes | PASS | 255241 | 33161 | 54.3 | 1 | 0 | 12 | 0 | 2 | 0 | 0
queued-task-permit-release | standard | 1 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | 530328 | 45464 | 108.9 | 1 | 0 | 20 | 3 | 2 | 0 | 0
queued-task-permit-release | standard | 1 | leanpowers-0.2.0 | FAIL | FAIL | yes | FAIL | 741303 | 62647 | 80.8 | 1 | 0 | 26 | 0 | 2 | 0 | 0
record-data-delta | standard | 1 | superpowers-6.1.1 | FAIL | FAIL | no | FAIL | n/a | n/a | 19.4 | 1 | 0 | 0 | 0 | 0 | 0 | 0
record-data-delta | standard | 1 | leanpowers-0.2.0 | FAIL | FAIL | yes | FAIL | 198605 | 28749 | 46.5 | 1 | 0 | 11 | 1 | 2 | 0 | 0
branching-undo-history | standard | 1 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | 439653 | 49253 | 52.9 | 1 | 0 | 18 | 3 | 2 | 0 | 0
branching-undo-history | standard | 1 | leanpowers-0.2.0 | PASS | FAIL | yes | PASS | 310844 | 33468 | 80.8 | 1 | 0 | 16 | 0 | 2 | 0 | 0
forward-header-sanitization | strict | 1 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | 441852 | 65532 | 60.4 | 1 | 0 | 18 | 1 | 2 | 0 | 0
forward-header-sanitization | strict | 1 | leanpowers-0.2.0 | FAIL | FAIL | yes | FAIL | 426269 | 76317 | 366.3 | 1 | 0 | 14 | 0 | 2 | 0 | 0
forward-header-sanitization | strict | 2 | leanpowers-0.2.0 | FAIL | FAIL | no | FAIL | n/a | n/a | 30.5 | 1 | 0 | 0 | 0 | 0 | 0 | 0
forward-header-sanitization | strict | 2 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | 1015109 | 77893 | 90.8 | 1 | 0 | 28 | 2 | 2 | 0 | 0
branching-undo-history | standard | 2 | leanpowers-0.2.0 | FAIL | FAIL | yes | FAIL | 272508 | 28028 | 47.4 | 1 | 0 | 14 | 1 | 2 | 0 | 0
branching-undo-history | standard | 2 | superpowers-6.1.1 | PASS | PASS | yes | PASS | 413898 | 35018 | 71.7 | 1 | 0 | 19 | 2 | 2 | 0 | 0
record-data-delta | standard | 2 | leanpowers-0.2.0 | FAIL | FAIL | yes | FAIL | 199403 | 32875 | 62.7 | 1 | 0 | 10 | 0 | 2 | 0 | 0
record-data-delta | standard | 2 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | 335110 | 33798 | 74.1 | 1 | 0 | 16 | 3 | 2 | 0 | 0
queued-task-permit-release | standard | 2 | leanpowers-0.2.0 | FAIL | PASS | yes | FAIL | 159119 | 36879 | 49.9 | 1 | 0 | 9 | 0 | 2 | 0 | 0
queued-task-permit-release | standard | 2 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | 354291 | 61427 | 195.4 | 1 | 0 | 14 | 4 | 2 | 0 | 0
stable-unique-tokens | lean | 2 | leanpowers-0.2.0 | FAIL | FAIL | no | FAIL | n/a | n/a | 24 | 1 | 0 | 0 | 0 | 0 | 0 | 0
stable-unique-tokens | lean | 2 | superpowers-6.1.1 | PASS | PASS | yes | PASS | 408259 | 66499 | 56 | 1 | 0 | 19 | 2 | 2 | 0 | 0

## Failed-run reasons

- r1-queued-task-permit-release-superpowers-6.1.1: artifact regression evidence did not pass; artifact regression gate fifo-queued-admission: candidate visible tests did not kill every semantic fault member; artifact regression gate bounded-settlement-drain: candidate visible tests did not kill every semantic fault member; artifact regression gate fresh-stats-snapshot: candidate visible tests did not kill every semantic fault member
- r1-queued-task-permit-release-leanpowers-0.2.0: artifact regression evidence did not pass; artifact regression gate bounded-settlement-drain: candidate visible tests did not kill every semantic fault member
- r1-record-data-delta-superpowers-6.1.1: agent exited non-zero; agent did not complete a turn; hidden verifier failed; artifact regression evidence did not pass; artifact regression gate object-is-value-boundary: no candidate visible test delta; artifact regression gate object-identity-no-traversal: no candidate visible test delta; artifact regression gate opaque-value-metadata: no candidate visible test delta; artifact regression gate stable-value-opacity: no candidate visible test delta; artifact regression gate source-specific-key-order: no candidate visible test delta; artifact regression gate own-undefined-presence: no candidate visible test delta; artifact regression gate exact-accessor-safe-validation: no candidate visible test delta; artifact regression gate exact-output-data-descriptors: no candidate visible test delta; artifact regression gate fresh-result-isolation: no candidate visible test delta
- r1-record-data-delta-leanpowers-0.2.0: artifact regression evidence did not pass; artifact regression gate object-identity-no-traversal: candidate visible tests did not kill every semantic fault member; artifact regression gate opaque-value-metadata: candidate visible tests did not kill every semantic fault member; artifact regression gate stable-value-opacity: candidate visible tests did not kill every semantic fault member; artifact regression gate source-specific-key-order: candidate visible tests did not kill every semantic fault member
- r1-branching-undo-history-superpowers-6.1.1: artifact regression evidence did not pass; artifact regression gate independent-duplicate-commit: candidate visible tests did not kill every semantic fault member
- r1-forward-header-sanitization-superpowers-6.1.1: hidden verifier failed; artifact regression evidence did not pass; artifact regression gate exact-token-boundary: candidate visible tests did not kill every semantic fault member; artifact regression gate complete-connection-token-boundary: candidate visible tests did not kill every semantic fault member; artifact regression gate exact-array-surface: candidate visible tests did not kill every semantic fault member; artifact regression gate exact-record-surface: candidate visible tests did not kill every semantic fault member
- r1-forward-header-sanitization-leanpowers-0.2.0: artifact regression evidence did not pass; artifact regression gate exact-token-boundary: candidate visible tests did not kill every semantic fault member; artifact regression gate complete-connection-token-boundary: candidate visible tests did not kill every semantic fault member; artifact regression gate exact-array-surface: candidate visible tests did not kill every semantic fault member; artifact regression gate exact-record-surface: candidate visible tests did not kill every semantic fault member
- r2-forward-header-sanitization-leanpowers-0.2.0: agent exited non-zero; agent did not complete a turn; hidden verifier failed; artifact regression evidence did not pass; artifact regression gate connection-nominated-removal: no candidate visible test delta; artifact regression gate case-insensitive-name-matching: no candidate visible test delta; artifact regression gate exact-token-boundary: no candidate visible test delta; artifact regression gate complete-connection-token-boundary: no candidate visible test delta; artifact regression gate complete-name-byte-boundary: no candidate visible test delta; artifact regression gate complete-value-byte-boundary: no candidate visible test delta; artifact regression gate exact-array-surface: no candidate visible test delta; artifact regression gate exact-record-surface: no candidate visible test delta; artifact regression gate accessor-safe-field-validation: no candidate visible test delta; artifact regression gate primitive-field-no-coercion: no candidate visible test delta; artifact regression gate deep-output-freshness: no candidate visible test delta
- r2-forward-header-sanitization-superpowers-6.1.1: artifact regression evidence did not pass; artifact regression gate exact-token-boundary: candidate visible tests did not kill every semantic fault member; artifact regression gate complete-connection-token-boundary: candidate visible tests did not kill every semantic fault member; artifact regression gate exact-array-surface: candidate visible tests did not kill every semantic fault member
- r2-branching-undo-history-leanpowers-0.2.0: artifact regression evidence did not pass; artifact regression gate fresh-snapshot-isolation: candidate visible tests did not kill every semantic fault member
- r2-record-data-delta-leanpowers-0.2.0: artifact regression evidence did not pass; artifact regression gate opaque-value-metadata: candidate visible tests did not kill every semantic fault member; artifact regression gate stable-value-opacity: candidate visible tests did not kill every semantic fault member; artifact regression gate fresh-result-isolation: candidate visible tests did not kill every semantic fault member
- r2-record-data-delta-superpowers-6.1.1: artifact regression evidence did not pass; artifact regression gate opaque-value-metadata: candidate visible tests did not kill every semantic fault member; artifact regression gate stable-value-opacity: candidate visible tests did not kill every semantic fault member; artifact regression gate source-specific-key-order: candidate visible tests did not kill every semantic fault member
- r2-queued-task-permit-release-leanpowers-0.2.0: artifact regression evidence did not pass; artifact regression gate synchronous-throw-release: candidate-test semantic fault run timed out; artifact regression gate asynchronous-rejection-release: candidate visible tests did not kill every semantic fault member; artifact regression gate bounded-settlement-drain: candidate visible tests did not kill every semantic fault member; artifact regression gate fresh-stats-snapshot: candidate visible tests did not kill every semantic fault member
- r2-queued-task-permit-release-superpowers-6.1.1: artifact regression evidence did not pass; artifact regression gate synchronous-throw-release: candidate-test semantic fault run timed out; artifact regression gate asynchronous-rejection-release: candidate-test semantic fault run timed out; artifact regression gate fresh-stats-snapshot: candidate visible tests did not kill every semantic fault member
- r2-stable-unique-tokens-leanpowers-0.2.0: agent exited non-zero; agent did not complete a turn; hidden verifier failed; artifact regression evidence did not pass; artifact regression gate first-occurrence-selection: no candidate visible test delta; artifact regression gate stable-encounter-order: no candidate visible test delta; artifact regression gate case-sensitive-identity: no candidate visible test delta; artifact regression gate primitive-no-coercion: no candidate visible test delta; artifact regression gate fresh-input-preservation: no candidate visible test delta

## Workflow conformance reasons

- r1-stable-unique-tokens-leanpowers-0.2.0: declared debug workflow instead of build; ordered pre-product source and failing RED evidence was not observed; ordered TEST-PATCH, RED, and CODE-PATCH protocol was not observed
- r1-queued-task-permit-release-leanpowers-0.2.0: bounded DEBUG recovery protocol was not observed
- r1-record-data-delta-leanpowers-0.2.0: declared debug workflow instead of build; ordered pre-product source and failing RED evidence was not observed; ordered TEST-PATCH, RED, and CODE-PATCH protocol was not observed
- r1-branching-undo-history-leanpowers-0.2.0: bounded DEBUG recovery protocol was not observed
- r1-forward-header-sanitization-leanpowers-0.2.0: declared debug workflow instead of build; declared standard risk instead of strict; ordered pre-product source and failing RED evidence was not observed; ordered TEST-PATCH, RED, and CODE-PATCH protocol was not observed; current passing independent review was not observed
- r2-forward-header-sanitization-leanpowers-0.2.0: top-level workflow declaration was not reported; structured LeanPowers route declaration was not reported; declared no workflow instead of build; risk declaration was not reported; route declarations were missing or conflicting; route risk was downgraded after an upgrade; route ledger was not emitted before task tools; ordered pre-product source and failing RED evidence was not observed; pre-change source READ evidence was not observed; ordered TEST-PATCH, RED, and CODE-PATCH protocol was not observed; supported successful post-edit validation was not observed; current passing independent review was not observed
- r2-branching-undo-history-leanpowers-0.2.0: uninterrupted code-and-test mutation window was not observed
- r2-record-data-delta-leanpowers-0.2.0: declared debug workflow instead of build; ordered pre-product source and failing RED evidence was not observed; ordered TEST-PATCH, RED, and CODE-PATCH protocol was not observed
- r2-stable-unique-tokens-leanpowers-0.2.0: top-level workflow declaration was not reported; structured LeanPowers route declaration was not reported; declared no workflow instead of build; risk declaration was not reported; route declarations were missing or conflicting; route risk was downgraded after an upgrade; route ledger was not emitted before task tools; ordered pre-product source and failing RED evidence was not observed; pre-change source READ evidence was not observed; ordered TEST-PATCH, RED, and CODE-PATCH protocol was not observed; supported successful post-edit validation was not observed

## Validity exclusions

Infrastructure failures: **0**; telemetry-gap runs: **3**; Invalid or excluded pairs: **3**. Invalid pairs are excluded from token and wall-time conclusions.

- record-data-delta r1: token-telemetry
- stable-unique-tokens r2: token-telemetry
- forward-header-sanitization r2: token-telemetry

## Interpretation boundary

- Task PASS requires successful agent completion, no timeout, both visible and hidden test success, every case-owned semantic fault family policy to pass, and no changed-path scope violation. Workflow declaration and risk-routing conformance are reported separately.
- LeanPowers quality-bearing conformance requires an unambiguous semantic route declaration before any task tool, rejects conflicting declarations, and forbids risk downgrade after an upgrade. Build/debug traces must show each later-edited existing file was successfully read before its own first edit and supported successful validation after the final edit. Build additionally requires test-only edits before the first product edit, one or more meaningful focused RED results after the final test correction, preservation of those RED test paths, and product-only edits thereafter. Every pre-product evidence window may contain only proven reads, narrow Git reporting, and completed nonfatal canonical test attempts; the final window's last test attempt must be a meaningful RED. Evidence-driven invalid test-design corrections and repeated RED confirmation are allowed, while exact counts remain diagnostics rather than fixed gates. Debug requires fixture-owned structured pre-edit reproduction and an initial uninterrupted code-and-test mutation window. One failed supported validation may open exactly one bounded recovery patch only when no other tool intervenes, every recovery path was already read and remains in scope, and the final rerun uses the identical validation command; the resolved reproduction then runs separately. A second failure or recovery is incomplete. Canonical DEBUG completion runs validation before reproduction. When the fixture declares resolved output, only a standalone reproduction can supply quality-bearing evidence and its final nonblank output line must be that exact JSON; combined validation and reproduction remains eligible only for contracts without structured resolved output. Lean and standard runs preserve the first successful validation after the first product edit or initial DEBUG mutation; only proven relative-file reads and the narrow Git reporting allowlist may follow. Strict runs require the same freshness from validation through reviewer spawn and wait, preserve the final passing review under the same read-only boundary, and separately prove the designated reviewer did not mutate the workspace. Discovery syntax, extra grounded-file reads, split versus batched reads, validation-manifest reads, Skill/reference reloads, exact pre-validation command/call budgets, clause-ledger shape, repeated route or ledger presentation, and one-call versus two-call validation remain efficiency or ceremony diagnostics rather than quality gates. Representation-boundary adequacy is measured workflow-neutrally in Task PASS: every pre-registered fault-family member must preserve baseline tests, every candidate counterfactual must complete, and every member must be killed by the candidate test delta. Reproduction telemetry proves the exact command and, when declared, resolved structured output; it is not universal semantic proof. These observable checks are scoped to the 5 reported fixtures, not universal semantic proof. Strict quality additionally requires a current independent PASS review with the complete task and current validation context; exact Skill invocation, prompt/verdict surface, reviewer count, wait targeting, and cycle choreography remain diagnostics.
- Async/blocking review adapter mechanics are runtime-specific diagnostics. The quality gate is one fresh read-only independent review effect; Codex JSONL does not expose every raw adapter argument.
- Model tokens sum Codex input and output tokens. Fresh tokens are uncached input plus output. Reasoning output is already included in output and is never double-counted. Missing or impossible telemetry is shown as n/a, never zero.
- Workflow reads are exact observed Skill/reference file reads from command traces. They are an attribution proxy, not workflow-only token telemetry.
- Paired reductions and Lean token shares are computed within each identical case and repetition. The declared token target uses the ratio of summed LeanPowers tokens to summed Superpowers tokens across all-matched-pairs; every-pair and median shares remain distribution diagnostics rather than substitute quality gates. Complete telemetry and the full target population are required. Failing faster or skipping workflow gates never counts as an improvement.
- Codex CLI does not expose a deterministic seed, so paired repetitions reduce noise but do not eliminate it.
- Exact terminal model-capacity failures without complete token telemetry may retry once from a fresh disposable workspace. Capacity retries are isolated from workflow wall-time comparisons, remain visible as separate attempt time, and never apply to agent, test, verifier, or conformance failures.
- The reported cases cover only these scenario classes: small-explicit-feature, unknown-cause-defect, medium-explicit-feature, security-sensitive-feature. They do not establish universal non-inferiority.
- Raw transcripts remain local and are written only after every run finishes. Disposable workspaces are destroyed after each run and are not publication artifacts.
