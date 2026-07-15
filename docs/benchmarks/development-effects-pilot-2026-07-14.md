# Development-effects pilot: LeanPowers 0.2.0 and Superpowers 6.1.1

Date: 2026-07-14

> Historical target note: this report preserves the 50% token-reduction gate that was in force when the pilot was run. The current project target is an aggregate 40% reduction—about 60% of Superpowers token use—and does not require every individual task pair to meet that ratio.

This report compares actual coding outcomes under a small paired pilot. It is evidence about three tested task shapes, not a winner ranking and not the full LeanPowers release benchmark. Superpowers is both the upstream inspiration for LeanPowers and the reference workflow used here.

## Result

| Workflow | Passed runs | Median model tokens | Median wall time | Activation failures | Scope violations |
| --- | ---: | ---: | ---: | ---: | ---: |
| Superpowers 6.1.1 | 5/6 | 222,548 | 91.3 s | 0 | 0 |
| LeanPowers 0.2.0 | 5/6 | 178,529 | 82.6 s | 0 | 0 |

Under these conditions, task success was equal. LeanPowers used 19.8% fewer median model tokens and 9.5% less median wall time. Across all six runs per workflow, the corresponding totals were 1,625,833 versus 1,280,081 model tokens and 589.9 versus 534.7 wall seconds.

These efficiency differences do not meet LeanPowers' predeclared release targets of 50% lower median tokens and 40% lower median wall time. The pilot also did not measure agent-call reduction. It therefore does not pass or replace the full release benchmark.

## Results by task

| Task | Superpowers pass | LeanPowers pass | Superpowers median tokens | LeanPowers median tokens | Superpowers median time | LeanPowers median time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Small explicit feature: duration parser | 2/2 | 2/2 | 278,725.5 | 188,070 | 95.7 s | 82.6 s |
| Unknown-cause defect: localized cache key | 2/2 | 2/2 | 218,372.5 | 167,251 | 78.0 s | 81.1 s |
| Security-compatible API: webhook secret rotation | 1/2 | 1/2 | 315,818.5 | 284,719.5 | 121.2 s | 103.7 s |

The security task was the only unstable case. In the first repetition, both workflows preserved the fixture's case-insensitive regular expression and incorrectly accepted an uppercase `SHA256=` prefix. The hidden verifier rejected both results. In the second repetition, both workflows made the prefix check case-sensitive and passed. This symmetric failure is evidence of model-run variance on a strict compatibility detail, not evidence that either workflow alone owns the defect.

## Complete run table

| Task | Rep | Workflow | Outcome | Model tokens | Wall time |
| --- | ---: | --- | --- | ---: | ---: |
| duration parser | 1 | Superpowers 6.1.1 | PASS | 216,107 | 79.6 s |
| duration parser | 1 | LeanPowers 0.2.0 | PASS | 178,337 | 80.1 s |
| localized cache key | 1 | Superpowers 6.1.1 | PASS | 228,989 | 81.2 s |
| localized cache key | 1 | LeanPowers 0.2.0 | PASS | 178,721 | 66.3 s |
| webhook secret rotation | 1 | Superpowers 6.1.1 | FAIL | 200,113 | 101.4 s |
| webhook secret rotation | 1 | LeanPowers 0.2.0 | FAIL | 158,549 | 73.3 s |
| duration parser | 2 | LeanPowers 0.2.0 | PASS | 197,803 | 85.1 s |
| duration parser | 2 | Superpowers 6.1.1 | PASS | 341,344 | 111.9 s |
| localized cache key | 2 | LeanPowers 0.2.0 | PASS | 155,781 | 95.9 s |
| localized cache key | 2 | Superpowers 6.1.1 | PASS | 207,756 | 74.8 s |
| webhook secret rotation | 2 | LeanPowers 0.2.0 | PASS | 410,890 | 134.0 s |
| webhook secret rotation | 2 | Superpowers 6.1.1 | PASS | 431,524 | 141.0 s |

## Method

- Runtime: Codex CLI 0.142.5, `gpt-5.5`, low reasoning effort.
- Fixed revisions: Superpowers commit `d884ae04edebef577e82ff7c4e143debd0bbec99`, verified as the official `obra/superpowers` `v6.1.1` tag; LeanPowers commit `616efbece81c031ef4280b7a10ce0f17261e511b`.
- Design: three tasks, two repetitions, and both workflows for each repetition, producing 12 real coding runs.
- Order: repetition one ran Superpowers first; repetition two reversed the order.
- Activation: each isolated Codex home contained only the workflow under test. The prompt explicitly invoked `$superpowers:using-superpowers` or `$leanpowers:route`, and the first agent progress message had to name the activated workflow.
- Verification: visible tests passed in the pristine fixture, while independent hidden tests initially failed. Hidden tests were injected only after the Agent exited.
- Isolation: every run used a fresh random workspace and fresh copied Codex home. The workspace was deleted after the run. Logs and patches were held in memory and written only after all 12 runs completed, preventing later runs from reading earlier solutions.
- Outcome gate: PASS required successful workflow activation, a completed Agent turn, unchanged Git HEAD, no timeout, passing visible and hidden tests, and no changed-path scope violation.
- Telemetry: model tokens are Codex input plus output tokens. Cached input is recorded separately in local raw evidence and is not double-counted.

The executable suite is [pilot-suite.json](../../evals/development-effects/pilot-suite.json), the runner is [development-benchmark.mjs](../../scripts/development-benchmark.mjs), and harness regression tests are in [development-benchmark.test.mjs](../../tests/development-benchmark.test.mjs).

## Evidence boundary

- The pilot covers three small JavaScript tasks on one model and one runtime. It does not cover the full 11-scenario catalog, long-running repository work, review-only work, dirty-worktree delivery, multi-agent execution, or project feedback learning.
- Codex CLI did not expose a deterministic seed. Counterbalanced repetitions reduce order bias but do not remove model variance.
- Six runs per workflow are too few for a formal uncertainty interval or a broad non-inferiority claim.
- Claude Code was not included, so this report makes no cross-runtime claim.
- Raw transcripts, verifier logs, and patches remain local because they contain machine paths and operational details. The checked-in report contains only sanitized aggregate and task-level evidence.

## Conclusion

This pilot supports a narrow, useful conclusion: on the three tested task shapes, LeanPowers matched Superpowers' run success while using fewer median model tokens and slightly less median wall time. The security case also shows why a larger benchmark is still necessary: both workflows failed the same strict detail once, passed it once, and showed large token and latency variation.

The result is encouraging for LeanPowers' lighter control surface, but it is not evidence that Superpowers' fuller process is unnecessary or that LeanPowers is generally equivalent. Many of the disciplines exercised by this benchmark—TDD, systematic debugging, verification before completion, and safe scope control—come directly from Superpowers. The next step is to expand coverage and repetitions, not to turn this pilot into a claim that one project has defeated the other.

## 中文结论

本次试验包含 3 类真实编码任务、2 次重复和两套工作流，共 12 次运行。两边都是 5/6 PASS；LeanPowers 的模型 token 中位数低 19.8%，耗时中位数低 9.5%。轻量化方向已经出现实际信号，但还没有达到正式发布预设的 50% token 和 40% 耗时降幅，也不足以证明广泛非劣。

安全兼容任务中，两边第 1 次都漏掉了 `sha256=` 前缀必须小写的细节，第 2 次都通过。这更像模型运行波动，而不是某一套工作流特有的问题。Superpowers 是 LeanPowers 的思想来源和对照基线；这份结果用于验证“能否在更小流程下保留关键效果”，不是为了给两个项目排胜负。
