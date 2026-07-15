# Multi-task confirmatory development-effects result

Date: 2026-07-15

Status: **the aggregate token target passed; the preregistered engineering-effect decision failed; the combined outcome target was not met**.

This report records a frozen 12-run coding comparison between LeanPowers 0.2.0 and Superpowers 6.1.1. Superpowers is the upstream inspiration and reference workflow for LeanPowers. The comparison tests a bounded tradeoff—whether LeanPowers can retain outcome-critical safeguards with less workflow overhead—not a project ranking or a claim that one project should replace the other.

## Decision summary

| Question | Frozen rule | Result | Decision |
| --- | --- | --- | --- |
| Executable task outcome | Visible tests, hidden acceptance, semantic fault families, artifact checks, and changed-path scope checks pass | Superpowers 5/6 PASS; LeanPowers 5/6 PASS | Equal pass count; both failed the same repetition of one case |
| Engineering effect | Both workflows pass all 6 runs; all 6 LeanPowers runs conform; all Superpowers runs activate; no scope or integrity failure | Both workflows were 5/6; LeanPowers conformance was 0/6; Superpowers activation/conformance was 6/6; scope violations were 0 | **FAIL** |
| Aggregate model-token target | Sum of LeanPowers model tokens across all 6 matched runs is at most 60% of the Superpowers total | 749,588 / 1,498,136 = **50.03%** | **PASS** |
| Combined outcome target | Engineering-effect and aggregate-token decisions both pass | Token PASS; engineering effect FAIL | **NOT MET** |

The executable pass counts were equal. The sole failed run for each workflow was repetition 1 of `layered-build-options`: both candidates failed the same `override-presence` artifact-regression gate because their visible test delta did not kill every registered semantic fault member. Repetition 2 of that case passed for both workflows.

The engineering-effect decision has two independent failed conditions: neither workflow reached the required 6/6 executable passes, and none of the six LeanPowers traces passed the frozen quality-bearing workflow conformance checks. Lower token use does not compensate for either quality failure under the preregistration.

## Complete run table

| Rep | Case | Workflow | Task | Conformance | Model tokens | Fresh tokens | Wall time | Tool calls | Workflow reads |
| ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | `integer-range-labels` | Superpowers 6.1.1 | PASS | PASS | 267,450 | 38,458 | 48.6 s | 13 | 3 |
| 1 | `integer-range-labels` | LeanPowers 0.2.0 | PASS | FAIL | 151,141 | 20,581 | 25.9 s | 11 | 0 |
| 1 | `layered-build-options` | Superpowers 6.1.1 | FAIL | PASS | 183,173 | 29,189 | 29.8 s | 11 | 2 |
| 1 | `layered-build-options` | LeanPowers 0.2.0 | FAIL | FAIL | 133,767 | 32,135 | 27.2 s | 8 | 0 |
| 1 | `chunked-ndjson-decoder` | Superpowers 6.1.1 | PASS | PASS | 381,085 | 42,653 | 53.2 s | 20 | 2 |
| 1 | `chunked-ndjson-decoder` | LeanPowers 0.2.0 | PASS | FAIL | 153,055 | 23,263 | 45.7 s | 8 | 0 |
| 2 | `integer-range-labels` | LeanPowers 0.2.0 | PASS | FAIL | 90,215 | 15,591 | 22.6 s | 5 | 0 |
| 2 | `integer-range-labels` | Superpowers 6.1.1 | PASS | PASS | 141,184 | 25,216 | 35.4 s | 8 | 2 |
| 2 | `layered-build-options` | LeanPowers 0.2.0 | PASS | FAIL | 110,620 | 21,148 | 26.2 s | 6 | 0 |
| 2 | `layered-build-options` | Superpowers 6.1.1 | PASS | PASS | 236,434 | 40,722 | 40.2 s | 11 | 3 |
| 2 | `chunked-ndjson-decoder` | LeanPowers 0.2.0 | PASS | FAIL | 110,790 | 31,302 | 25.1 s | 6 | 0 |
| 2 | `chunked-ndjson-decoder` | Superpowers 6.1.1 | PASS | PASS | 288,810 | 22,826 | 33.8 s | 15 | 3 |

Every run declared the expected top-level workflow before task tools, and neither workflow changed a path outside the case boundary. Superpowers activation and conformance passed 6/6. LeanPowers activation declarations passed 6/6, but its quality-bearing workflow conformance passed 0/6.

## Efficiency diagnostics

| Diagnostic | Result |
| --- | ---: |
| Aggregate LeanPowers model-token share, all matched pairs | **50.03%** |
| Aggregate model-token reduction | 49.97% |
| Median paired model-token reduction | 48.4% |
| Median pair token share | 51.65% |
| Maximum pair token share | 73.03% |
| Individual pairs at or below 60% | 4/6 |
| Aggregate token share among the 5 both-PASS pairs | 46.83% |
| Median fresh-token reduction | 41.8% |
| Median wall-time reduction | 30.4% |
| Median tool-call reduction | 41.5% |

The preregistered token statistic is the ratio of summed model tokens across the complete six-pair matrix. It passed at 50.03%, even though two individual pairs exceeded 60%; individual shares were frozen as diagnostics, not gates. The same preregistration keeps quality separate, so this efficiency result cannot authorize a positive overall engineering claim.

## Frozen conformance result

The frozen scorer recorded these LeanPowers conformance failures:

- All four build traces lacked a conformant final `TEST-PATCH -> failing RED -> CODE-PATCH` cycle. Three also lacked accepted pre-product source/read evidence, and one lacked accepted successful final validation.
- Debug repetition 1 lacked a contiguous code-and-test patch and accepted successful post-edit validation.
- Debug repetition 2 lacked accepted ordered pre-change source/read evidence, although its executable repair passed.

Post-run trace inspection separates two development concerns without changing the frozen decision. Some misses were substantive workflow-sequencing problems—for example, product code was edited without a final observed failing regression, or tests were corrected after product edits without re-establishing RED. Others exposed a brittle instruction/observer boundary: semicolon-separated full-file reads could provide equivalent source evidence but did not match the frozen accepted batch-read form. These are inputs to future workflow and evaluator improvement, not grounds for reclassifying any run in this result.

The next formal claim must use a newly frozen suite after those improvements. Reusing these observed cases for a new positive confirmatory claim would turn them into development calibration.

## Frozen execution identity

| Field | Value |
| --- | --- |
| Suite | `development-effects-confirmatory-2026-07-15` |
| Suite SHA-256 | `bed220c33b40871ce4550085f0f3f763a56da0d8af3bd71ae33b2299ec1fbf8c` |
| Evidence level | `paired-development-heldout` |
| Matrix | 3 cases x 2 repetitions x 2 workflows = 12 complete runs |
| Runtime | Codex CLI 0.142.5 |
| Model | `gpt-5.3-codex-spark` |
| Reasoning effort | `low` |
| Permission profile | `benchmark`; network disabled inside agent runs |
| Agent read isolation | `codex-minimal-workspace-plugin-toolchain-read-v1` (preflight PASS) |
| Superpowers revision | `d884ae04edebef577e82ff7c4e143debd0bbec99` (`v6.1.1`) |
| LeanPowers/evaluator revision | `66453094d8f08fa18f9fb27984f884a7be480d96` |

| Case | Workspace SHA-256 | Hidden-verifier SHA-256 | Fault-family SHA-256 |
| --- | --- | --- | --- |
| `integer-range-labels` | `1db0e45fb08791c590bfa0e007c90004ad9d2f7f6490d3c456a3df15ecd9bcff` | `3635f87a75e15b605b4bbedb737f4d12ef8615ff31e532bb302ab746084fee03` | `6df4b9d8b747037fd129b6c3c4ceca5e63f3a162692c0d97c50dee03032e2f87` |
| `layered-build-options` | `73e38bf7c1bb94d6aafbd75579243ee602331f018a54d30841d61191c67f3503` | `f21ae4ded8eabd940fd31d90098ee3cae8fa44b7fc92c9c95eb862f36b1a07ae` | `a3ef7d1c138108667abcb5e0416b37b998bca5639bcb17b542dd3a4a4dd39f07` |
| `chunked-ndjson-decoder` | `cd1e071d38c98fc0f8861c4c8446f33ef09ccab2bb2e5ff04acf49d68df351b2` | `4070b2e4e540c19cb6c24c3f0d10308652ee2b55ba4f25da7447f6dff6374f70` | `2f78054f5c1c3f04cd6f84ecfbb1bfcbd54fbb6c2a87a7a30b72df29e850984c` |

The frozen contract is documented in [development-effects-confirmatory-preregistration-2026-07-15.md](development-effects-confirmatory-preregistration-2026-07-15.md). The executable suite is [confirmatory-suite.json](../../evals/development-effects/confirmatory-suite.json), and the runner is [development-benchmark.mjs](../../scripts/development-benchmark.mjs).

## Limitations

- This sample covers two standard-risk build tasks and one standard-risk debug task, with two repetitions on one model/runtime. It does not establish general parity, non-inferiority, or a stable efficiency ratio across repositories, models, runtimes, or risk levels.
- The matrix is not the full 11-scenario release benchmark. It contains no lean- or strict-risk case and does not measure all release gates.
- Codex CLI exposes no deterministic seed. Counterbalanced paired repetitions reduce order effects but do not eliminate model variance.
- Model tokens include input and output tokens across the full run. Workflow reads are an attribution proxy, not isolated workflow-only token telemetry.
- Conformance is observable trace evidence under a frozen parser, not universal semantic proof. Equivalent shell behavior outside the accepted syntax can be missed, while an observed sequence cannot prove unobserved intent.
- Raw transcripts and disposable workspaces remain local. They are not committed or published; this report contains only sanitized decision evidence.
- The frozen result is not post-hoc reclassified. Any workflow or scorer change informed by these runs requires newly frozen evidence for another confirmatory decision.

## Conclusion

The run met the aggregate efficiency objective under its frozen conditions: LeanPowers used 50.03% of Superpowers' summed model tokens, with equal executable pass counts of 5/6. It did not meet the combined target because the preregistered engineering-effect decision failed—both workflows missed the same one artifact-regression run, and LeanPowers quality-bearing conformance was 0/6.

This is useful but mixed evidence. It shows that the smaller workflow can materially reduce aggregate token use while matching the executable pass count on this small matrix. It does not yet show that LeanPowers preserves the required engineering process reliably enough, or that either workflow passed every frozen task. The appropriate next step is to improve test-first sequencing and trace-observation robustness, then evaluate those changes on new frozen tasks.

LeanPowers builds directly on the engineering disciplines established and popularized by Superpowers, including test-driven development, systematic debugging, review, verification, and safe delivery. This benchmark preserves that lineage: its purpose is to test a lighter implementation of those ideas honestly, not to diminish the upstream project.

## 中文结论

这次冻结的 12-run 对比中，Superpowers 与 LeanPowers 的实际任务结果同为 5/6 PASS；双方唯一失败的都是第 1 次 `layered-build-options`，原因也相同：新增测试没有杀死 `override-presence` 语义故障族中的全部成员。

LeanPowers 的模型 token 总和为 Superpowers 的 **50.03%**，通过了预注册的 `<=60%` 综合 token 门槛。但总体目标仍未达成：预注册工程效果门槛为 **FAIL**，因为双方都没有达到要求的 6/6，而且 LeanPowers 的质量流程一致性是 0/6。token 更少不能抵消质量门槛失败。

因此，当前可以说“在这组小规模任务中，LeanPowers 的实际通过数相同且综合 token 明显更少”，但不能说“已经证明广泛等效”或“已经达到完整目标”。后续应修复测试优先顺序与流程观测的脆弱点，再用新冻结、未参与调优的任务确认。LeanPowers 的工程原则来自并致敬 Superpowers；这项对比是对更轻实现路径的诚实验证，不是胜负排名。
