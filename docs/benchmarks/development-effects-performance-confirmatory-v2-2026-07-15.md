# Quality-first token confirmatory result

Status: **the frozen task-outcome requirement, LeanPowers conformance requirement, and aggregate-token target all failed. The performance goal was not met.**

LeanPowers directly builds on and credits the engineering disciplines established and popularized by [Superpowers](https://github.com/obra/superpowers). Superpowers 6.1.1 is the upstream reference because LeanPowers is trying to preserve those safeguards with a smaller control surface. This benchmark asks whether this LeanPowers revision met its own frozen tradeoff target; it is not a ranking of the projects.

We thank the Superpowers maintainers and contributors for publishing the workflow model that made LeanPowers and this study possible.

## Frozen decision summary

| Question | Frozen requirement | Observed result | Decision |
| --- | --- | --- | --- |
| Task outcome | Both workflows pass all six runs | Superpowers 2/6; LeanPowers 3/6 | **FAIL** |
| LeanPowers stage conformance | 6/6 | Frozen evaluator: 0/6 | **FAIL** |
| Superpowers activation | 6/6 | 6/6 | PASS |
| Aggregate model tokens | LeanPowers uses at most 60% of Superpowers across all six pairs | `1,927,925 / 2,132,709 = 90.4%` | **FAIL** |
| Median paired wall-time change | Secondary; a slowdown greater than 20% is a hard failure | LeanPowers 16.7% faster | Diagnostic only |
| Run integrity | Six complete pairs with complete telemetry | 6/6; no capacity retry or invalid pair | PASS |

The 60–65% near-target band does not apply: 90.4% is above it. The wall-time result cannot offset either quality failure or the aggregate-token failure.

`3/6` versus `2/6` is descriptive only. Neither workflow reached the required 6/6, and the sample is too small to support a comparative quality claim.

## Results by task category

“Task PASS” means the agent completed, visible and hidden acceptance passed, every registered semantic fault family was killed by the candidate test delta, and changed paths stayed in scope.

| Category | Pairs | Superpowers Task PASS | LeanPowers Task PASS | Superpowers total tokens | LeanPowers total tokens | Lean/SP | Superpowers / Lean median tokens | Superpowers / Lean median wall | Median paired wall change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Collection-transform build | 2 | 0/2 | 0/2 | 674,798 | 307,873 | 45.6% | 337,399 / 153,936.5 | 57.1s / 34.9s | Lean 35.1% faster |
| Unicode parser build | 2 | 2/2 | 2/2 | 469,402 | 312,047 | 66.5% | 234,701 / 156,023.5 | 41.9s / 42.7s | Lean 6.0% slower |
| Transactional-state debug | 2 | 0/2 | 1/2 | 988,509 | 1,308,005 | 132.3% | 494,254.5 / 654,002.5 | 68.4s / 72.6s | Lean 2.4% slower |
| Build owner aggregate | 4 | 2/4 | 2/4 | 1,144,200 | 619,920 | 54.2% | 262,230.5 / 156,023.5 | 46.9s / 38.7s | Lean 16.7% faster |
| Debug owner aggregate | 2 | 0/2 | 1/2 | 988,509 | 1,308,005 | 132.3% | 494,254.5 / 654,002.5 | 68.4s / 72.6s | Lean 2.4% slower |

The last column is the median of pairwise changes; it is not derived by dividing the two workflow medians.

## What the categories show

### Collection-transform build

Both workflows failed both repetitions. LeanPowers implementations passed hidden behavioral acceptance, but their added tests did not distinguish every preregistered semantic fault:

- one test used a wide positive gap and did not expose a shortcut that bridges a one-unit gap;
- both immutability tests supplied already sorted input, so an implementation that sorted the input array in place remained observationally equivalent;
- one repetition corrected a test expectation after the product edit, invalidating the frozen BUILD RED cycle.

The category used only 45.6% of the Superpowers tokens, but failing faster or proving fewer boundaries is not a quality-preserving efficiency result.

### Unicode parser build

Both workflows passed both repetitions. LeanPowers used 66.5% of the Superpowers tokens: slightly above the target, but not a per-task failure because the frozen token rule is aggregate.

One LeanPowers repetition had a conformant final RED cycle; the other changed a test after the product edit and therefore did not preserve the BUILD test freeze. This distinction is part of the post-run evaluator audit below.

### Transactional-state debug

Superpowers passed 0/2 and LeanPowers passed 1/2. Three implementations restored the same array that had been exposed to the delivery callback. A hidden interaction—callback mutation followed by a throw and reentrant addition—therefore polluted rollback state. The passing LeanPowers repetition kept a separate pre-callback rollback copy.

That correct result came through an uncontrolled repair tail: 30 tool calls, 18 commands, 12 file changes, nine failed commands, and repeated test rewrites. It used 1,067,432 model tokens, 238.5% of its paired Superpowers run and 55.4% of all LeanPowers tokens in the matrix.

## Token-source analysis

| Metric | Superpowers | LeanPowers |
| --- | ---: | ---: |
| Total model tokens | 2,132,709 | 1,927,925 |
| Median model tokens per run | 365,225.5 | 166,192.5 |
| Fresh tokens total | 289,893 | 248,053 |
| Output tokens total | 49,623 | 50,309 |
| Tool calls total | 93 | 71 |
| Wall time total | 334.8s | 300.3s |

The build aggregate reached 54.2% with 30 LeanPowers tool calls versus 52 Superpowers calls. The debug aggregate reached 132.3% with 41 calls on each side. The debug problem was therefore not fixed workflow ceremony; it was the long edit-test-rewrite loop.

In the expensive LeanPowers debug repetition, 988,544 of 1,067,432 model tokens were cached input. Compared with its paired Superpowers run, 599,808 of the 619,795-token excess—96.8%—was cached input. Repeated failure output and an expanding context were replayed after each command. Fresh-token use rose much less than total-token use.

For diagnosis only, the other five pairs used 51.1% of Superpowers aggregate tokens. This is not the frozen score and cannot replace 90.4%; the expensive run was valid, had complete telemetry, and must remain in the target population.

## Frozen conformance result and post-run evaluator audit

The frozen evaluator recorded LeanPowers stage conformance as 0/6, and that frozen result is preserved. A post-run audit found an evaluator defect: Codex CLI 0.142.5 records an intentional nonzero RED command with `item.status = "failed"`, while the frozen evaluator accepted only `"completed"`.

The corrected evaluator was replayed over the same local raw events without rerunning agents. It recognizes 2/4 BUILD traces as conformant. The other two BUILD traces changed tests after product edits and remain nonconformant; both DEBUG traces also remain nonconformant. The diagnostic replay is therefore 2/6 overall, with only one run combining stage conformance and Task PASS.

This replay validates and narrows the evaluator defect. It is not new confirmatory evidence, does not retroactively change the frozen 0/6, and does not change the overall FAIL: task outcome and aggregate tokens independently missed their frozen requirements. A positive conformance claim requires a corrected, newly frozen evaluator and new unseen live tasks.

Superpowers activation and LeanPowers stage conformance are intentionally different checks. The former proves that the upstream entry workflow was activated; the latter additionally observes LeanPowers routing, read-before-edit, RED or reproduction, patch ordering, validation, and strict review when applicable. Their counts must not be presented as like-for-like workflow-discipline scores.

## Prospective remediation

The observed suite is now calibration evidence. It must not be reused for a new confirmatory claim after tuning.

Prospective changes made after the frozen run:

- accept the live Codex nonzero-command status when recognizing an otherwise valid RED, while retaining timeout, empty-output, fatal-shell, command-shape, and exit-code checks;
- separate BUILD and DEBUG capsule instructions so DEBUG cannot inherit a test-only RED loop;
- require discriminating tests to use the nearest boundary, observable mutation, and composed failure interactions;
- distinguish synchronous reentrancy from actual concurrency risk;
- require one combined DEBUG product-and-regression patch and one `reproduction && validation` call;
- prohibit repeated whole-file delete/recreate loops; a failed combined validation exits the capsule and escalates with evidence into full debugging, which alone may establish a blocker.

The next confirmation must freeze new unseen tasks. It should preserve the current priority order: task quality first, aggregate model tokens second, wall time third.

## Frozen execution identity

| Field | Value |
| --- | --- |
| Suite | `development-effects-performance-confirmatory-v2-2026-07-15` |
| Suite SHA-256 | `b0f721408de7bfbe04521d5df68c4d1bf2f5ff57ca5233aae61729a234b6f540` |
| Evidence level | `paired-development-heldout` |
| Matrix | 3 cases × 2 repetitions × 2 workflows = 12 complete runs |
| Runtime | Codex CLI 0.142.5 |
| Model | `gpt-5.3-codex-spark` |
| Reasoning effort | `low` |
| Superpowers revision | `d884ae04edebef577e82ff7c4e143debd0bbec99` (`v6.1.1`) |
| LeanPowers/evaluator revision | `dc6a22218b65a5f8c08f74301ccbfd4f670cc90a` |

The frozen contract is in [development-effects-performance-confirmatory-v2-preregistration-2026-07-15.md](development-effects-performance-confirmatory-v2-preregistration-2026-07-15.md), and the executable suite is [performance-confirmatory-v2-suite.json](../../evals/development-effects/performance-confirmatory-v2-suite.json). Raw transcripts and disposable workspaces remain local and are not publication artifacts.

## Evidence limits

- The matrix contains three tasks, two repetitions, and six pairs on one model, runtime, and reasoning effort.
- It covers two small standard-risk builds and one stateful debugging task, not the full release catalog.
- Codex CLI exposes no deterministic seed. Counterbalancing reduces but cannot eliminate model variance.
- Only 2/6 pairs had Task PASS on both sides; the frozen conformant-pass population was empty.
- One debug run created a heavy token tail, so aggregate efficiency is sensitive to the task mix and tail frequency.
- The post-run evaluator replay is diagnostic, not confirmatory.
- Wall time, tool calls, and structural prompt size cannot compensate for failed quality or token gates.
- No capacity retry, telemetry gap, output-boundary violation, or changed-path violation explains the failure.

## Conclusion

On this frozen matrix, LeanPowers did not meet its own preregistered target. Neither workflow reached the required 6/6 task outcome, and LeanPowers used 90.4% of Superpowers aggregate model tokens against a target of at most 60%. The 16.7% median paired wall-time reduction is useful diagnostic evidence, but it cannot offset those failures.

This result does not support a broad parity or general-efficiency claim. It does identify a focused next agenda: retain the build path that already reached 54.2%, make semantic counterexamples more discriminating, make DEBUG conformance reliable, and control the heavy stateful-debugging token tail without discarding the rollback correctness that the expensive run eventually achieved.

Superpowers remains the comprehensive upstream reference from which LeanPowers learns. Publishing this failed result and the evaluator defect is part of applying that evidence-first engineering discipline honestly.

## 中文结论

在这组冻结矩阵中，LeanPowers 没有达到自己的预注册目标。两套工作流都没有达到要求的 6/6 实际任务结果：Superpowers 为 2/6，LeanPowers 为 3/6。LeanPowers 的综合模型 Token 为 Superpowers 的 90.4%，高于不超过 60% 的目标；16.7% 的配对中位耗时下降不能抵消质量和 Token 门禁失败。

冻结评估器把 LeanPowers 流程一致性记录为 0/6。运行后发现，Codex 会把预期失败的 RED 命令标记为 `status=failed`，而旧评估器只接受 `completed`。修正后对同一原始事件做诊断回放，2/4 条 BUILD trace 符合，另两条 BUILD 和两条 DEBUG 仍不符合，整体为 2/6；其中只有一条同时满足流程一致性与 Task PASS。这个回放不追溯修改冻结结论，总体仍然是 FAIL。

主要问题集中在两个地方：一是测试没有稳定构造出能区分“看起来合理但错误”的最小反例；二是状态型调试出现了长尾 edit-test-rewrite 循环。下一轮会保留已达到 54.2% Token 占比的 build 路径，重点加强最近边界、可观察 mutation 和组合失败路径，并把 DEBUG 固定为一次联合补丁和一次组合验证。v2 已经用于定位问题，后续只能作为 calibration；新的正向结论必须使用修正后的评估器和全新的未见任务。

LeanPowers 的工程思想来自并持续致敬 Superpowers。公开这次未通过的结果、评估器缺陷和后续修复方向，不是为了给项目排胜负，而是为了诚实检验轻量化以后保住了什么、还缺什么。
