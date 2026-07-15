# Frozen held-out development-effects result

Date: 2026-07-14

Status: **confirmatory run completed against the frozen inputs; both preregistered targets failed**.

This report records one paired held-out coding task comparing LeanPowers 0.2.0 with Superpowers 6.1.1. Superpowers is the upstream inspiration for LeanPowers and the reference workflow used here. The comparison asks whether LeanPowers can retain the outcome-critical safeguards on this task with a smaller workflow; it is not a project ranking.

## Decision summary

| Question | Frozen rule | Result | Decision |
| --- | --- | --- | --- |
| Executable task outcome | Visible tests, hidden acceptance, mutation gates, and scope checks pass in both repetitions | Superpowers 2/2 PASS; LeanPowers 2/2 PASS | Both workflows repaired the task successfully |
| Preregistered engineering effect | Both workflows pass both repetitions, LeanPowers passes workflow conformance, and neither workflow violates scope | LeanPowers conformance 1/2; scope violations 0 for both workflows | **FAIL** |
| Token target | LeanPowers model tokens are at most 60% of Superpowers in every matched pair | Shares were 83.3% and 75.9%; 0/2 pairs met the limit | **FAIL** |

The executable engineering result was equal on this task: every run passed the visible tests, hidden verifier, mutation checks, artifact checks, and changed-path scope checks. The broader preregistered engineering-effect gate still fails because LeanPowers did not satisfy its frozen activation/conformance parser in repetition 2. That failure is retained even though the produced code was correct.

## Complete run table

| Rep | Workflow | Task | Conformance | Model tokens | Fresh tokens | Wall time | Tool calls | Workflow reads |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Superpowers 6.1.1 | PASS | PASS | 225,843 | 22,579 | 36.591 s | 13 | 2 |
| 1 | LeanPowers 0.2.0 | PASS | PASS | 188,142 | 36,718 | 36.501 s | 12 | 0 |
| 2 | LeanPowers 0.2.0 | PASS | FAIL | 167,383 | 34,135 | 36.355 s | 10 | 0 |
| 2 | Superpowers 6.1.1 | PASS | PASS | 220,548 | 39,300 | 37.764 s | 13 | 3 |

All four runs changed only the intended implementation and test files. Each candidate repair passed the two visible tests and five hidden tests, and its added tests killed every registered semantic mutant.

## Efficiency diagnostics

| Diagnostic | Result |
| --- | ---: |
| LeanPowers share of Superpowers model tokens, repetition 1 | 83.3% |
| LeanPowers share of Superpowers model tokens, repetition 2 | 75.9% |
| Median pair token share | 79.6% |
| Pairs meeting the `<= 60%` target | 0/2 |
| Median paired model-token reduction | 20.4% |
| Median paired fresh-token reduction | -24.7% |
| Median paired wall-time reduction | 2.0% |
| Median paired tool-call reduction | 15.4% |

Fresh tokens, wall time, tool calls, and workflow reads were preregistered as diagnostics rather than compensating gates. In particular, the negative fresh-token reduction means LeanPowers used more fresh tokens on the paired median measure despite using fewer total model tokens.

## Frozen conformance decision

LeanPowers repetition 2 began with a natural-language lead-in followed by the route declaration. The frozen parser required the canonical semantic declaration at the start of the first progress message, so it recorded activation/conformance as failed. The final message contained the canonical declaration, but that was too late under the frozen rule.

This is activation-format fragility rather than an executable repair failure, but the result is not reclassified after the fact. Changing the parser or workflow based on this observation would make future runs of this case development calibration, not a continuation of the confirmatory result.

One additional oracle limitation was found after the run. The suite froze this case as `standard`, although the task required overlapping same-profile requests and the LeanPowers risk policy lists concurrency under `strict`. The frozen scorer therefore did not evaluate whether those requirements should have triggered the strict path. This does not rescue either failed target or alter any recorded run; it means the case cannot be used as clean evidence for risk-routing correctness. Future confirmatory suites must resolve the risk label before execution and avoid post-run reinterpretation.

## Why this differs from development calibration

The earlier `localized-template-cache` exercise produced LeanPowers token shares of 52.7% and 34.4%, with a median reduction of 56.5%. That exercise had already informed routing and parser changes, so the preregistration correctly classified it as tuned development calibration rather than held-out confirmation.

The held-out trace supports several reasons that calibration overstated the stable saving:

- Both workflows converged on a similar engineering path. LeanPowers used a median of 11 tool calls versus 13 for Superpowers, only a 15.4% reduction, so cumulative context remained similar.
- LeanPowers reduced cached input but used more fresh tokens on the paired median measure. Its runs included test-correction and validation retries, which reduced the benefit of the shorter workflow surface.
- The calibration task had much larger variation in the Superpowers runs than this held-out task. A stable `<= 60%` claim therefore could not be carried forward from those two calibration pairs.
- Model-token totals accumulate across tool calls and include shared task and runtime context. Reducing skill text alone does not translate linearly into the same percentage reduction in end-to-end tokens.

These observations point to first-pass test correctness and fewer discovery/read round trips as more important next optimizations than further wording reduction alone. They are development hypotheses for new calibration work, not changes to this frozen result.

## Method and evidence boundary

- Runtime: Codex CLI 0.142.5, `gpt-5.3-codex-spark`, low reasoning effort.
- Revisions: Superpowers `d884ae04edebef577e82ff7c4e143debd0bbec99` (`v6.1.1`); LeanPowers `ab35bf4539718ad4a924146cc0fcbb5f38a730e1`.
- Design: one unknown-cause standard-risk debugging task, two repetitions, with counterbalanced workflow order.
- Frozen suite manifest: `c71222bd29e0035b6fbf91a3239b2def89d54c479a367dfa370e7474091bd82f`.
- Workspace snapshot: `22f835d2a6b569ad8091c1690d9a5fe9ed388995d270852c58273ff933b24c8e`.
- Hidden-verifier snapshot: `3037cabd474d64fe7472ca7c0f1be1ddfaaccbee463e086f5c3e2ea1cca24cf2`.
- Fault-family snapshot: `d1af3fa78bd8d9182fece0749bdd0903d7cae650975d9205684be04e65422fb4`.
- Isolation preflight passed before the live matrix: the agent could use the disposable workspace and required toolchain while evaluator inputs, credentials, hidden verification, and command network remained unavailable.
- The matrix completed against the frozen revisions and inputs and was eligible for the preregistered decision rules.

The frozen contract is documented in [development-effects-heldout-preregistration-2026-07-14.md](development-effects-heldout-preregistration-2026-07-14.md). The executable suite is [heldout-suite.json](../../evals/development-effects/heldout-suite.json), and the runner is [development-benchmark.mjs](../../scripts/development-benchmark.mjs).

This is only one standard-risk debugging task on one model and runtime. It cannot establish broad parity, non-inferiority, or a stable efficiency ratio across repositories, task classes, or agent runtimes. Raw operational artifacts are intentionally excluded from the repository; this document contains the sanitized decision evidence.

## Conclusion

On the executable task itself, LeanPowers and Superpowers both achieved 2/2 PASS with the same hidden quality and scope protections. That is encouraging evidence that the lighter workflow retained the important engineering safeguards for this case.

The frozen comparison does not yet meet LeanPowers' stated target. The engineering-effect gate failed on one LeanPowers conformance event, and the `<= 60%` token target failed in both pairs. The honest next step is to improve activation reliability and first-pass execution efficiency, then evaluate those changes on a newly frozen task rather than retuning this result.

LeanPowers builds on disciplines established and popularized by Superpowers, including systematic debugging, test-first repair, verification before completion, and controlled delivery. This benchmark is a way to preserve that foundation while testing a lighter operating surface, with appreciation for the upstream work that made the comparison possible.

## 中文结论

在这一例冻结的标准风险调试任务上，Superpowers 与 LeanPowers 的实际修复结果都是 2/2 PASS，四次运行均通过可见测试、隐藏验收、变异检查和范围检查。就“代码是否修好”而言，两边效果一致。

但预注册目标没有达成：LeanPowers 因第 2 次运行的首行激活格式未满足冻结解析规则，工程效果门槛为 FAIL；两组 token 占比分别为 83.3% 和 75.9%，0/2 达到 `<= 60%`，中位占比为 79.6%。这一格式问题不会在结果产生后被改判，任何据此进行的优化都只能进入后续校准，并应使用新的未见任务再次验证。

因此，当前证据支持“本例实际工程效果相同”，但不支持“已经达到稳定 60% token 目标”或“已经广泛等效”。LeanPowers 来源于 Superpowers 的工程工作流思想；后续目标是在尊重并保留这些关键纪律的基础上，继续减少不必要的交互和 token 消耗。
