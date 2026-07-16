# Frozen held-out development-effects comparison

Evidence level: **paired-development-heldout**. This is frozen confirmatory coding evidence for the listed cases and revisions, but it is not the full 11-scenario release benchmark.

Frozen run contract: **verified**. Confirmatory eligibility: **yes**.

Run matrix: **complete**. Token-target conclusions are unavailable unless the declared matrix and target population are complete.

Runtime: codex-cli 0.142.5; model: gpt-5.3-codex-spark; effort: medium.

Agent read isolation: codex-minimal-workspace-plugin-toolchain-read-v1; permission profile: benchmark; preflight: PASS.

Revisions: Superpowers d884ae04edebef577e82ff7c4e143debd0bbec99; LeanPowers 1a88de222685f420ebb14a84b8bab405ec2e33a6; evaluator b82812c91f46f708475cac285847ed84b70e441a; runner b82812c91f46f708475cac285847ed84b70e441a.

Suite manifest: aa6cf77ac1ed7b2d3aeab2ab0d8484fbcf2a9199940a4adf46d6fb43f8332bdb.

Case | Workspace snapshot | Hidden verifier snapshot | Fault-family snapshot
--- | --- | --- | ---
cyclic-sequence-rotation | 2643779c8506acb7495e61d190191d36855ec06bcd1ee1605174be9b43908803 | aaefcfd98c1f058374528277bd4785b7cc91407d6277b8c743859b6c9876dbc2 | b2588b25b3284c2580abaa85bacdb0d611577d464d4a6ee5a8e92c8b373d5206
version-vector-relation | 5af0e494a3a55764bbf6f19e180144e13a60261f66bec6af689f35b6c5760cc7 | 4ceef552651da383dd4a43b6231e5857f233d07d19297dc21d07d464e2062d3a | afd77b6a88d5836a80787c2fc7ba1231dd2bf8a1be374ffdc91d4b8d769637a2
json-merge-patch | 07d4ea0ba1a01e28b4e83b11db16fe484d243bc75eda87d6a3d8d86bacb78c1d | d2e67af87c9f20765adde8612b4ed61ad073c8ded019cc9a52c9e9b7cbb35357 | f670dc36ab6c88f70474c8b3f44ed392f0d57154d392f2e180c08fbd545b475c
ring-buffer-wraparound | 7de83c2c55530c029c161a37d05ddac413959f580b87509cf6a45654ca96c13d | 6b2efb9fe5e3dea7ae4bb5455fa67eaeb58a4a26f7c40a55cf84c45dc3bb8018 | 94520a2a7396e02667ef7c3a35ffd340532fb33ac01052b9749a164936aa8dad
capability-scope-decision | 12dba20809438414d2c74bfc952101d6f6d8b715cfe565ee082f260fcc15adae | 8a6931177ee02e8c4c8df3ad855d9618d5736524a6de7383c364145c54fcda11 | 895797c39b1481cf3a44d2ec805f61a180c1a8379a3e0edaaba4b03b86657bd6

Activation: explicit-entrypoint. Each run explicitly invokes its installed top-level workflow entrypoint and must name it in the first agent progress message before the identical engineering task.

Superpowers 6.1.1 is the upstream baseline and inspiration for LeanPowers. This report measures a bounded tradeoff under the listed conditions; it is not a winner ranking.

## Machine decision

Status: **FAIL**

Reasons: lean-conformance, task-outcome, token-target.

Advisories: none.

## Aggregate

Workflow | Task PASS | Median model tokens | Median fresh tokens | Median wall seconds | Median tool calls | Median workflow reads | Declaration failures | Conformance failures | Scope violations
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
superpowers-6.1.1 | 4/10 | 283855.5 | 49657 | 31.5 | 14.5 | 2 | 0 | 0 | 0
leanpowers-0.2.0 | 4/10 | 188865.5 | 39269 | 29.5 | 11 | 0 | 4 | 9 | 0

## Layered quality diagnostics

Population: **complete valid matched pairs**; interpretation eligibility: **yes** (10/10).

Paired outcome quadrant | Count
--- | ---:
both_pass | 4
superpowers_pass_lean_fail | 0
lean_pass_superpowers_fail | 0
both_fail | 6

Workflow | Task PASS | Task PASS rate
--- | ---: | ---:
superpowers-6.1.1 | 4/10 | 40%
leanpowers-0.2.0 | 4/10 | 40%

Shared floor (both Task PASS rates <20%): **no**.

Shared ceiling (both Task PASS rates >80%): **no**.

Directional asymmetry: **no**; Superpowers PASS / LeanPowers FAIL: **0**; LeanPowers PASS / Superpowers FAIL: **0**.

## Results by task category

Category | Pairs | Superpowers quality | LeanPowers quality | Superpowers total tokens | LeanPowers total tokens | Lean token share | Superpowers median tokens | LeanPowers median tokens | Superpowers median wall | LeanPowers median wall | Lean wall reduction
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
cyclic rotation build | 2 | 2/2 | 2/2 | 478016 | 490076 | 102.52292810282502% | 239008 | 245038 | 29.4 | 28.5 | 2.2%
version vector debug | 2 | 2/2 | 2/2 | 453236 | 375867 | 82.92964371762173% | 226618 | 187933.5 | 28.5 | 26.4 | 7.3%
JSON merge patch build | 2 | 0/2 | 0/2 | 876991 | 825751 | 94.1572946586681% | 438495.5 | 412875.5 | 56.8 | 44.2 | 10.2%
ring buffer debug | 2 | 0/2 | 0/2 | 607526 | 320764 | 52.79839875165836% | 303763 | 160382 | 30.3 | 29.3 | 2.6%
capability scope strict build | 2 | 0/2 | 0/2 | 611631 | 262689 | 42.948934897021246% | 305815.5 | 131344.5 | 31.8 | 29.1 | 8.4%
build owner aggregate | 6 | 2/6 | 2/6 | 1966638 | 1578516 | 80.26469538369543% | 305815.5 | 245038 | 32.8 | 31.3 | 4.6%
debug owner aggregate | 4 | 2/4 | 2/4 | 1060762 | 696631 | 65.6726956659458% | 260849 | 182900 | 28.8 | 27.3 | 7.3%

## Category source diagnostics

Category | Workflow | Median fresh tokens | Median output tokens | Median tool calls | Median workflow reads | Capacity retries | Infrastructure retry wall
--- | --- | ---: | ---: | ---: | ---: | ---: | ---:
cyclic rotation build | superpowers-6.1.1 | 42016 | 8320 | 12.5 | 1.5 | 0 | 0
cyclic rotation build | leanpowers-0.2.0 | 36270 | 8299.5 | 12.5 | 0 | 0 | 0
version vector debug | superpowers-6.1.1 | 42746 | 7780.5 | 14 | 1.5 | 0 | 0
version vector debug | leanpowers-0.2.0 | 39837.5 | 6296 | 10.5 | 0 | 0 | 0
JSON merge patch build | superpowers-6.1.1 | 67295.5 | 18946.5 | 16 | 2 | 0 | 0
JSON merge patch build | leanpowers-0.2.0 | 69387.5 | 21795.5 | 15 | 0 | 0 | 0
ring buffer debug | superpowers-6.1.1 | 41875 | 6870.5 | 17 | 3 | 0 | 0
ring buffer debug | leanpowers-0.2.0 | 32830 | 6408.5 | 11 | 0 | 0 | 0
capability scope strict build | superpowers-6.1.1 | 54423.5 | 11737 | 13 | 2.5 | 0 | 0
capability scope strict build | leanpowers-0.2.0 | 36048.5 | 9734.5 | 8.5 | 0 | 0 | 0
build owner aggregate | superpowers-6.1.1 | 57056 | 11737 | 13 | 2 | 0 | 0
build owner aggregate | leanpowers-0.2.0 | 41185 | 9958.5 | 11.5 | 0 | 0 | 0
debug owner aggregate | superpowers-6.1.1 | 41875 | 7207 | 16 | 2.5 | 0 | 0
debug owner aggregate | leanpowers-0.2.0 | 37287.5 | 6296 | 11 | 0 | 0 | 0

## Category token sources

Category | Superpowers total | LeanPowers total | Total excess | Target excess | Superpowers cached | LeanPowers cached | Cached excess | Superpowers fresh | LeanPowers fresh | Fresh excess | Superpowers tool calls | LeanPowers tool calls | Superpowers tool types | LeanPowers tool types | Superpowers agent messages | LeanPowers agent messages
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---:
cyclic rotation build | 478016 | 490076 | 12060 | 42.5% | 393984 | 417536 | 23552 | 84032 | 72540 | -11492 | 25 | 25 | command_execution:19, file_change:6 | command_execution:17, file_change:8 | n/a | n/a
version vector debug | 453236 | 375867 | -77369 | 22.9% | 367744 | 296192 | -71552 | 85492 | 79675 | -5817 | 28 | 21 | command_execution:23, file_change:5 | command_execution:16, file_change:5 | n/a | n/a
JSON merge patch build | 876991 | 825751 | -51240 | 34.2% | 742400 | 686976 | -55424 | 134591 | 138775 | 4184 | 32 | 30 | command_execution:24, file_change:8 | command_execution:19, file_change:11 | n/a | n/a
ring buffer debug | 607526 | 320764 | -286762 | -7.2% | 523776 | 255104 | -268672 | 83750 | 65660 | -18090 | 34 | 22 | command_execution:28, file_change:6 | command_execution:18, file_change:4 | n/a | n/a
capability scope strict build | 611631 | 262689 | -348942 | -17.1% | 502784 | 190592 | -312192 | 108847 | 72097 | -36750 | 26 | 17 | command_execution:21, file_change:5 | command_execution:13, file_change:4 | n/a | n/a
build owner aggregate | 1966638 | 1578516 | -388122 | 20.3% | 1639168 | 1295104 | -344064 | 327470 | 283412 | -44058 | 83 | 72 | command_execution:64, file_change:19 | command_execution:49, file_change:23 | n/a | n/a
debug owner aggregate | 1060762 | 696631 | -364131 | 5.7% | 891520 | 551296 | -340224 | 169242 | 145335 | -23907 | 62 | 43 | command_execution:51, file_change:11 | command_execution:34, file_change:9 | n/a | n/a

## Pair token excess

Case | Rep | Superpowers total | LeanPowers total | Lean token share | Target excess | Total excess | Superpowers cached | LeanPowers cached | Cached excess | Superpowers fresh | LeanPowers fresh | Fresh excess | Superpowers tool calls | LeanPowers tool calls | Superpowers tool types | LeanPowers tool types | Superpowers agent messages | LeanPowers agent messages
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---:
capability-scope-decision | 1 | 298673 | 142435 | 47.7% | -12.3% | -156238 | 237312 | 100352 | -136960 | 61361 | 42083 | -19278 | 12 | 9 | command_execution:11, file_change:1 | command_execution:7, file_change:2 | n/a | n/a
cyclic-sequence-rotation | 1 | 335695 | 269693 | 80.3% | 20.3% | -66002 | 279808 | 237440 | -42368 | 55887 | 32253 | -23634 | 15 | 14 | command_execution:11, file_change:4 | command_execution:8, file_change:6 | n/a | n/a
json-merge-patch | 1 | 657870 | 496476 | 75.5% | 15.5% | -161394 | 581504 | 423680 | -157824 | 76366 | 72796 | -3570 | 21 | 18 | command_execution:16, file_change:5 | command_execution:11, file_change:7 | n/a | n/a
ring-buffer-wraparound | 1 | 269038 | 136932 | 50.9% | -9.1% | -132106 | 230400 | 100608 | -129792 | 38638 | 36324 | -2314 | 17 | 11 | command_execution:14, file_change:3 | command_execution:9, file_change:2 | n/a | n/a
version-vector-relation | 1 | 252660 | 181968 | 72% | 12% | -70692 | 200832 | 140544 | -60288 | 51828 | 41424 | -10404 | 15 | 12 | command_execution:12, file_change:3 | command_execution:10, file_change:2 | n/a | n/a
capability-scope-decision | 2 | 312958 | 120254 | 38.4% | -21.6% | -192704 | 265472 | 90240 | -175232 | 47486 | 30014 | -17472 | 14 | 8 | command_execution:10, file_change:4 | command_execution:6, file_change:2 | n/a | n/a
cyclic-sequence-rotation | 2 | 142321 | 220383 | 154.8% | 94.8% | 78062 | 114176 | 180096 | 65920 | 28145 | 40287 | 12142 | 10 | 11 | command_execution:8, file_change:2 | command_execution:9, file_change:2 | n/a | n/a
json-merge-patch | 2 | 219121 | 329275 | 150.3% | 90.3% | 110154 | 160896 | 263296 | 102400 | 58225 | 65979 | 7754 | 11 | 12 | command_execution:8, file_change:3 | command_execution:8, file_change:4 | n/a | n/a
ring-buffer-wraparound | 2 | 338488 | 183832 | 54.3% | -5.7% | -154656 | 293376 | 154496 | -138880 | 45112 | 29336 | -15776 | 17 | 11 | command_execution:14, file_change:3 | command_execution:9, file_change:2 | n/a | n/a
version-vector-relation | 2 | 200576 | 193899 | 96.7% | 36.7% | -6677 | 166912 | 155648 | -11264 | 33664 | 38251 | 4587 | 13 | 9 | command_execution:11, file_change:2 | command_execution:6, file_change:3 | n/a | n/a

## Token target

Metric: **aggregate-model-token-share** across **all-matched-pairs**; LeanPowers target: at most **60%** of Superpowers model tokens.

Status: **FAIL**; eligible pairs: 10/10; observed share: 75.2%.

Performance-goal assessment: **FAIL — target missed**. The 60–65% band never bypasses quality gates and is not an automatic PASS.

Wall time is secondary: complete pair telemetry is mandatory; 0% through -20% is an advisory non-improvement, while a slowdown greater than 20% is a material regression.

## Paired reductions

Population | Eligible/required pairs | Aggregate Lean token share | Median model-token reduction | Median Lean token share | Max Lean token share | Lean ≤60% pairs | Median fresh-token reduction | Median wall reduction | Median tool-call reduction | Median workflow-read reduction
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
Both Task PASS + Lean quality-bearing conformance + Superpowers activation (primary) | 0/10 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/10 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
Primary: lean | 0/2 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/2 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
Primary: standard | 0/6 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/6 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
Primary: strict | 0/2 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0) | 0/2 | n/a (n=0) | n/a (n=0) | n/a (n=0) | n/a (n=0)
Both workflows PASS | 4/10 | 92.9869680816793% (n=4) | 11.5% (n=4) | 88.5048937884909% (n=4) | 154.8492492323691% (n=4) | 0/10 | 3.2% (n=4) | 4.2% (n=4) | 13.3% (n=4) | n/a (n=0)
All matched runs | 10/10 | 75.15184646891723% (n=10) | 26.3% (n=10) | 73.7440436076711% (n=10) | 154.8492492323691% (n=10) | 4/10 | 13% (n=10) | 4.6% (n=10) | 22.5% (n=10) | n/a (n=0)

## Paired runs

Case | Risk | Rep | Workflow | Task | Conformance | Declared | Artifact regression | Model tokens | Fresh tokens | Wall seconds | Attempts | Capacity retry wall | Tool calls | Workflow reads | Product files | Workflow artifacts | Scope violations
--- | --- | ---: | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
cyclic-sequence-rotation | lean | 1 | superpowers-6.1.1 | PASS | PASS | yes | PASS | 335695 | 55887 | 33.5 | 1 | 0 | 15 | 2 | 2 | 0 | 0
cyclic-sequence-rotation | lean | 1 | leanpowers-0.2.0 | PASS | FAIL | no | PASS | 269693 | 32253 | 30.4 | 1 | 0 | 14 | 0 | 2 | 0 | 0
version-vector-relation | standard | 1 | superpowers-6.1.1 | PASS | PASS | yes | PASS | 252660 | 51828 | 28.5 | 1 | 0 | 15 | 2 | 2 | 0 | 0
version-vector-relation | standard | 1 | leanpowers-0.2.0 | PASS | FAIL | yes | PASS | 181968 | 41424 | 28.7 | 1 | 0 | 12 | 0 | 2 | 0 | 0
json-merge-patch | standard | 1 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | 657870 | 76366 | 77.6 | 1 | 0 | 21 | 2 | 2 | 0 | 0
json-merge-patch | standard | 1 | leanpowers-0.2.0 | FAIL | FAIL | no | PASS | 496476 | 72796 | 44.4 | 1 | 0 | 18 | 0 | 2 | 0 | 0
ring-buffer-wraparound | standard | 1 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | 269038 | 38638 | 31.5 | 1 | 0 | 17 | 3 | 2 | 0 | 0
ring-buffer-wraparound | standard | 1 | leanpowers-0.2.0 | FAIL | FAIL | yes | FAIL | 136932 | 36324 | 25.8 | 1 | 0 | 11 | 0 | 2 | 0 | 0
capability-scope-decision | strict | 1 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | 298673 | 61361 | 32.1 | 1 | 0 | 12 | 3 | 2 | 0 | 0
capability-scope-decision | strict | 1 | leanpowers-0.2.0 | FAIL | FAIL | yes | FAIL | 142435 | 42083 | 32.1 | 1 | 0 | 9 | 0 | 2 | 0 | 0
capability-scope-decision | strict | 2 | leanpowers-0.2.0 | FAIL | FAIL | no | FAIL | 120254 | 30014 | 26.1 | 1 | 0 | 8 | 0 | 2 | 0 | 0
capability-scope-decision | strict | 2 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | 312958 | 47486 | 31.5 | 1 | 0 | 14 | 2 | 2 | 0 | 0
ring-buffer-wraparound | standard | 2 | leanpowers-0.2.0 | FAIL | PASS | yes | FAIL | 183832 | 29336 | 32.8 | 1 | 0 | 11 | 0 | 2 | 0 | 0
ring-buffer-wraparound | standard | 2 | superpowers-6.1.1 | FAIL | PASS | yes | FAIL | 338488 | 45112 | 29 | 1 | 0 | 17 | 3 | 2 | 0 | 0
json-merge-patch | standard | 2 | leanpowers-0.2.0 | FAIL | FAIL | yes | FAIL | 329275 | 65979 | 44 | 1 | 0 | 12 | 0 | 2 | 0 | 0
json-merge-patch | standard | 2 | superpowers-6.1.1 | FAIL | PASS | yes | PASS | 219121 | 58225 | 36 | 1 | 0 | 11 | 2 | 2 | 0 | 0
version-vector-relation | standard | 2 | leanpowers-0.2.0 | PASS | FAIL | yes | PASS | 193899 | 38251 | 24.1 | 1 | 0 | 9 | 0 | 2 | 0 | 0
version-vector-relation | standard | 2 | superpowers-6.1.1 | PASS | PASS | yes | PASS | 200576 | 33664 | 28.5 | 1 | 0 | 13 | 1 | 2 | 0 | 0
cyclic-sequence-rotation | lean | 2 | leanpowers-0.2.0 | PASS | FAIL | no | PASS | 220383 | 40287 | 26.5 | 1 | 0 | 11 | 0 | 2 | 0 | 0
cyclic-sequence-rotation | lean | 2 | superpowers-6.1.1 | PASS | PASS | yes | PASS | 142321 | 28145 | 25.3 | 1 | 0 | 10 | 1 | 2 | 0 | 0

## Failed-run reasons

- r1-json-merge-patch-superpowers-6.1.1: artifact regression evidence did not pass; artifact regression gate fresh-input-isolation: candidate visible tests did not kill every semantic fault member; artifact regression gate new-branch-deep-isolation: candidate visible tests did not kill every semantic fault member
- r1-json-merge-patch-leanpowers-0.2.0: hidden verifier failed
- r1-ring-buffer-wraparound-superpowers-6.1.1: artifact regression evidence did not pass; artifact regression gate fresh-values-snapshot: candidate visible tests did not kill every semantic fault member
- r1-ring-buffer-wraparound-leanpowers-0.2.0: artifact regression evidence did not pass; artifact regression gate ordinary-buffer-surface: candidate visible tests did not kill every semantic fault member
- r1-capability-scope-decision-superpowers-6.1.1: artifact regression evidence did not pass; artifact regression gate order-independent-deny-precedence: candidate visible tests did not kill every semantic fault member; artifact regression gate case-sensitive-scope-boundaries: candidate visible tests did not kill every semantic fault member; artifact regression gate request-accessor-safe-validation: candidate visible tests did not kill every semantic fault member
- r1-capability-scope-decision-leanpowers-0.2.0: artifact regression evidence did not pass; artifact regression gate order-independent-deny-precedence: candidate visible tests did not kill every semantic fault member; artifact regression gate case-sensitive-scope-boundaries: candidate visible tests did not kill every semantic fault member; artifact regression gate request-accessor-safe-validation: candidate visible tests did not kill every semantic fault member
- r2-capability-scope-decision-leanpowers-0.2.0: artifact regression evidence did not pass; artifact regression gate order-independent-deny-precedence: candidate visible tests did not kill every semantic fault member; artifact regression gate case-sensitive-scope-boundaries: candidate visible tests did not kill every semantic fault member; artifact regression gate request-accessor-safe-validation: candidate visible tests did not kill every semantic fault member
- r2-capability-scope-decision-superpowers-6.1.1: artifact regression evidence did not pass; artifact regression gate order-independent-deny-precedence: candidate visible tests did not kill every semantic fault member; artifact regression gate case-sensitive-scope-boundaries: candidate visible tests did not kill every semantic fault member; artifact regression gate request-accessor-safe-validation: candidate visible tests did not kill every semantic fault member
- r2-ring-buffer-wraparound-leanpowers-0.2.0: artifact regression evidence did not pass; artifact regression gate fresh-values-snapshot: candidate visible tests did not kill every semantic fault member
- r2-ring-buffer-wraparound-superpowers-6.1.1: artifact regression evidence did not pass; artifact regression gate ordinary-buffer-surface: candidate visible tests did not kill every semantic fault member
- r2-json-merge-patch-leanpowers-0.2.0: hidden verifier failed; artifact regression evidence did not pass; artifact regression gate new-branch-deep-isolation: candidate visible tests did not kill every semantic fault member
- r2-json-merge-patch-superpowers-6.1.1: hidden verifier failed

## Workflow conformance reasons

- r1-cyclic-sequence-rotation-leanpowers-0.2.0: top-level workflow declaration was not reported; structured LeanPowers route declaration was not reported; declared no workflow instead of build; route declarations were missing or conflicting; route ledger was not emitted before task tools; ordered pre-product source and failing RED evidence was not observed; ordered TEST-PATCH, RED, and CODE-PATCH protocol was not observed
- r1-version-vector-relation-leanpowers-0.2.0: uninterrupted code-and-test mutation window was not observed
- r1-json-merge-patch-leanpowers-0.2.0: top-level workflow declaration was not reported; structured LeanPowers route declaration was not reported; declared no workflow instead of build; route declarations were missing or conflicting; route ledger was not emitted before task tools; ordered pre-product source and failing RED evidence was not observed; ordered TEST-PATCH, RED, and CODE-PATCH protocol was not observed
- r1-ring-buffer-wraparound-leanpowers-0.2.0: ordered pre-change source and reproduction evidence was not observed; pre-change source READ evidence was not observed; READ omitted discovered files that were later changed; pre-edit executable REPRODUCE was not observed; supported successful post-edit validation was not observed
- r1-capability-scope-decision-leanpowers-0.2.0: current passing independent review was not observed
- r2-capability-scope-decision-leanpowers-0.2.0: top-level workflow declaration was not reported; structured LeanPowers route declaration was not reported; declared no workflow instead of build; route declarations were missing or conflicting; route ledger was not emitted before task tools; ordered pre-product source and failing RED evidence was not observed; ordered TEST-PATCH, RED, and CODE-PATCH protocol was not observed; current passing independent review was not observed
- r2-json-merge-patch-leanpowers-0.2.0: ordered pre-product source and failing RED evidence was not observed; ordered TEST-PATCH, RED, and CODE-PATCH protocol was not observed
- r2-version-vector-relation-leanpowers-0.2.0: ordered pre-change source and reproduction evidence was not observed; READ omitted discovered files that were later changed
- r2-cyclic-sequence-rotation-leanpowers-0.2.0: top-level workflow declaration was not reported; structured LeanPowers route declaration was not reported; declared no workflow instead of build; route declarations were missing or conflicting; route ledger was not emitted before task tools; ordered pre-product source and failing RED evidence was not observed; ordered TEST-PATCH, RED, and CODE-PATCH protocol was not observed

## Validity exclusions

Infrastructure failures: **0**; telemetry-gap runs: **0**; Invalid or excluded pairs: **0**. Invalid pairs are excluded from token and wall-time conclusions.

## Interpretation boundary

- Task PASS requires successful agent completion, no timeout, both visible and hidden test success, every case-owned semantic fault family policy to pass, and no changed-path scope violation. Workflow declaration and risk-routing conformance are reported separately.
- LeanPowers quality-bearing conformance requires an unambiguous semantic route declaration before any task tool, rejects conflicting declarations, and forbids risk downgrade after an upgrade. Build/debug traces must show each later-edited existing file was successfully read before its own first edit and supported successful validation after the final edit. Build additionally requires test-only edits before the first product edit, one or more meaningful focused RED results after the final test correction, preservation of those RED test paths, and product-only edits thereafter. Every pre-product evidence window may contain only proven reads, narrow Git reporting, and completed nonfatal canonical test attempts; the final window's last test attempt must be a meaningful RED. Evidence-driven invalid test-design corrections and repeated RED confirmation are allowed, while exact counts remain diagnostics rather than fixed gates. Debug requires fixture-owned structured pre-edit reproduction and an initial uninterrupted code-and-test mutation window. One failed supported validation may open exactly one bounded recovery patch only when no other tool intervenes, every recovery path was already read and remains in scope, and the final rerun uses the identical validation command; the resolved reproduction then runs separately. A second failure or recovery is incomplete. Canonical DEBUG completion runs validation before reproduction. When the fixture declares resolved output, only a standalone reproduction can supply quality-bearing evidence and its final nonblank output line must be that exact JSON; combined validation and reproduction remains eligible only for contracts without structured resolved output. Lean and standard runs preserve the first successful validation after the first product edit or initial DEBUG mutation; only proven relative-file reads and the narrow Git reporting allowlist may follow. Strict runs require the same freshness from validation through reviewer spawn and wait, preserve the final passing review under the same read-only boundary, and separately prove the designated reviewer did not mutate the workspace. Discovery syntax, extra grounded-file reads, split versus batched reads, validation-manifest reads, Skill/reference reloads, exact pre-validation command/call budgets, clause-ledger shape, repeated route or ledger presentation, and one-call versus two-call validation remain efficiency or ceremony diagnostics rather than quality gates. Representation-boundary adequacy is measured workflow-neutrally in Task PASS: every pre-registered fault-family member must preserve baseline tests, every candidate counterfactual must complete, and every member must be killed by the candidate test delta. Reproduction telemetry proves the exact command and, when declared, resolved structured output; it is not universal semantic proof. These observable checks are scoped to the 5 reported fixtures, not universal semantic proof. Strict quality additionally requires a current independent PASS review with the complete task and current validation context; exact Skill invocation, prompt/verdict surface, reviewer count, wait targeting, and cycle choreography remain diagnostics.
- Async/blocking review adapter mechanics are runtime-specific diagnostics. The quality gate is one fresh read-only independent review effect; Codex JSONL does not expose every raw adapter argument.
- Model tokens sum Codex input and output tokens. Fresh tokens are uncached input plus output. Reasoning output is already included in output and is never double-counted. Missing or impossible telemetry is shown as n/a, never zero.
- Workflow reads are exact observed Skill/reference file reads from command traces. They are an attribution proxy, not workflow-only token telemetry.
- Paired reductions and Lean token shares are computed within each identical case and repetition. The declared token target uses the ratio of summed LeanPowers tokens to summed Superpowers tokens across all-matched-pairs; every-pair and median shares remain distribution diagnostics rather than substitute quality gates. Complete telemetry and the full target population are required. Failing faster or skipping workflow gates never counts as an improvement.
- Codex CLI does not expose a deterministic seed, so paired repetitions reduce noise but do not eliminate it.
- Exact terminal model-capacity failures without complete token telemetry may retry once from a fresh disposable workspace. Capacity retries are isolated from workflow wall-time comparisons, remain visible as separate attempt time, and never apply to agent, test, verifier, or conformance failures.
- The reported cases cover only these scenario classes: small-explicit-feature, unknown-cause-defect, medium-explicit-feature. They do not establish universal non-inferiority.
- Raw transcripts remain local and are written only after every run finishes. Disposable workspaces are destroyed after each run and are not publication artifacts.
