# Follow-up confirmatory development-effects result

Status: **the frozen engineering-effect decision failed; the frozen aggregate-token decision failed; the combined target was not met**.

The frozen run contract was verified, the complete 12-run matrix finished, and the result was confirmatory-eligible under the preregistered runner. Superpowers 6.1.1 remains the respected upstream engineering reference and the source of many disciplines LeanPowers is trying to preserve. This comparison measures a bounded implementation tradeoff; it is not a winner ranking.

## Frozen decision summary

| Question | Frozen requirement | Observed result | Decision |
| --- | --- | --- | --- |
| Executable task outcome | Visible tests, hidden acceptance, every fault family, artifact checks, and scope checks pass | Superpowers 4/6 PASS; LeanPowers 4/6 PASS | Equal pass count; neither reached 6/6 |
| Engineering effect | Both workflows 6/6; LeanPowers conformance 6/6; Superpowers activation 6/6 | LeanPowers conformance 0/6; Superpowers activation 5/6; no scope violations | **FAIL** |
| Aggregate model tokens | `sum(LeanPowers) / sum(Superpowers) <= 60%` across all six pairs | `1,076,675 / 1,373,698 = 78.38%` | **FAIL** |
| Combined target | Engineering effect and aggregate tokens both PASS | Both decisions failed | **NOT MET** |

The engineering decision cannot be rescued by lower token use, and the token decision cannot be replaced by a more favorable median. Both rules were frozen before the live run.

## Run-level result

| Case | Rep | Superpowers | LeanPowers | Lean token share |
| --- | ---: | --- | --- | ---: |
| `canonical-query-entries` | 1 | PASS | PASS | 161.77% |
| `stable-task-batches` | 1 | FAIL | FAIL | 111.98% |
| `per-key-expiry-cache` | 1 | PASS | PASS | 64.42% |
| `canonical-query-entries` | 2 | PASS | PASS | 71.17% |
| `stable-task-batches` | 2 | FAIL | FAIL | 58.06% |
| `per-key-expiry-cache` | 2 | PASS | PASS | 36.25% |

Both workflows passed every canonical-query and cache-expiry run and failed both task-batching runs. Every run stayed inside the declared changed-path scope.

## Efficiency result

LeanPowers used 21.62% fewer summed model tokens than Superpowers, but the preregistered target required at least a 40% reduction, so the aggregate decision is FAIL.

| Metric | Observed value |
| --- | ---: |
| Aggregate Lean model-token share | 78.38% |
| Median paired model-token reduction | 32.2% |
| Pairs at or below 60% | 2/6 |
| Maximum Lean token share | 161.77% |
| Median fresh-token reduction | 16.4% |
| Median wall-time reduction | 11.6% |
| Median tool-call reduction | 34.5% |

The largest outlier was the first canonical-query run, where repeated patch and RED-cycle recovery made LeanPowers more expensive than Superpowers. The result still shows a smaller median tool surface, but it does not reproduce the first confirmatory suite's aggregate token target.

## Shared task failure and specification boundary

All four `stable-task-batches` runs failed hidden acceptance and at least the `plain-record-validation` fault family. Three implementations rejected a null-prototype record; the fourth accepted a class instance or inherited-field shape that the hidden verifier rejected. Superpowers repetition 2 also failed to independently prove duplicate-ID rejection.

Post-run audit found an important specification limitation. The task said each task must be a “plain record” with own fields, but did not explicitly define whether `Object.create(null)` is valid. The hidden verifier treated both `Object.prototype` and `null` prototypes as valid while rejecting class instances and custom prototypes. That boundary should have been stated directly in the task.

This ambiguity reduces the case's power to explain workflow differences, but it does not change the frozen result: the hidden and mutation gates failed, so all four runs remain FAIL. The task is now calibration evidence. A future confirmatory case must state the accepted prototypes explicitly and test null-prototype acceptance, class-instance rejection, inherited-field rejection, and duplicate IDs independently before freezing.

## LeanPowers workflow evidence

The revised route improved some observable evidence but did not close the quality-bearing sequencing gap.

- All four build runs produced product and regression changes, acceptable read-before-edit evidence, and successful final validation. None established a final accepted `TEST-PATCH -> failing RED -> CODE-PATCH` cycle. Test corrections, combined patches, or cycle restarts occurred without a new final RED before product work. One run also emitted conflicting route declarations.
- Both debug runs produced ordered pre-edit reproduction, read evidence, a post-edit reproduction replay, and successful combined validation. Under the frozen observer, each failed because product and regression edits appeared as separate patch batches.
- A post-run observer audit found that the frozen debug rule treated intervening narration or reasoning as if it were a tool boundary. The prospective evaluator now treats adjacent file edits as one mutation window unless a command or another tool intervenes. This removes tool-shape ceremony while preserving the requirement that product and regression changes both precede validation. It does not reclassify these frozen runs.

The build gap is substantive and remains: valid RED evidence must become executable and reliable, not merely present in prose. The debug observer gap was partly representational and has been repaired prospectively. Any claim that these changes improved live behavior requires new, unseen frozen tasks.

## Comparison with the first confirmatory matrix

| Metric | First confirmatory suite | Follow-up suite |
| --- | ---: | ---: |
| Superpowers Task PASS | 5/6 | 4/6 |
| LeanPowers Task PASS | 5/6 | 4/6 |
| LeanPowers conformance | 0/6 | 0/6 |
| Aggregate Lean token share | 50.03% | 78.38% |
| Token decision | PASS | FAIL |
| Engineering-effect decision | FAIL | FAIL |

The first matrix showed that LeanPowers could meet the aggregate token target on one small task mix, but it did not pass the engineering-effect gate. The follow-up did not reproduce that token result and again failed engineering effect. The two frozen studies remain separate; combining or selectively pooling them after inspection would violate their decision boundaries.

## Frozen execution identity

| Field | Value |
| --- | --- |
| Suite | `development-effects-confirmatory-followup-2026-07-15` |
| Suite SHA-256 | `e7bfb6dfbf5da73f5283057dbcb42dab03899fe64dcb6e043f8f3c315e3b9874` |
| Evidence level | `paired-development-heldout` |
| Matrix | 3 cases x 2 repetitions x 2 workflows = 12 complete runs |
| Runtime | Codex CLI 0.142.5 |
| Model | `gpt-5.3-codex-spark` |
| Reasoning effort | `low` |
| Agent read isolation | `codex-minimal-workspace-plugin-toolchain-read-v1` |
| Superpowers revision | `d884ae04edebef577e82ff7c4e143debd0bbec99` (`v6.1.1`) |
| LeanPowers/evaluator revision | `cadbe5b7b78b9f3f02d881a49bffc4ef21909277` |

The frozen contract is in [development-effects-confirmatory-followup-preregistration-2026-07-15.md](development-effects-confirmatory-followup-preregistration-2026-07-15.md), and the executable suite is [confirmatory-followup-suite.json](../../evals/development-effects/confirmatory-followup-suite.json). Raw transcripts and disposable workspaces remain local and are not publication artifacts.

## Limitations

- This is two standard-risk build tasks and one standard-risk debug task, with two repetitions on one model/runtime. It is not the full 11-scenario release benchmark.
- Codex CLI exposes no deterministic seed; counterbalancing reduces but does not remove model variance.
- The null-prototype boundary was under-specified and weakens the shared failing case as comparative evidence.
- Quality conformance is observable trace evidence, not universal semantic proof. The frozen debug patch-batch rule was too sensitive to presentation events.
- The aggregate token result is task-mix dependent. One high-token retry path materially changed the total.
- The frozen result is not post-hoc reclassified. The observed suite may not be reused as new confirmatory evidence after workflow or evaluator tuning.

## Conclusion

The follow-up retained equal executable pass counts between the two workflows, but neither completed every frozen task. LeanPowers also missed both its workflow-conformance requirement and aggregate token target. This result therefore does not support a parity or release-readiness claim.

It does provide a sharper implementation agenda: make build RED recovery reliable, treat adjacent debug edits as one semantic mutation window rather than one tool-call shape, and require every hidden acceptance boundary to be explicit before freeze. LeanPowers continues to build on the engineering disciplines established by Superpowers. The value of this comparison is not a winner label, but a clearer account of which safeguards survived the lighter control surface and which still need work.

## 中文结论

新一轮冻结 follow-up 中，两套工作流的实际任务结果同为 4/6 PASS。LeanPowers 的模型 token 总和为 Superpowers 的 78.38%，没有通过 `<=60%` 综合 token 门槛；质量流程一致性仍为 0/6，因此工程效果与总体目标均为 FAIL。

双方共同失败的 `stable-task-batches` 包含一个未明确说明的 null-prototype 规格边界。该问题降低了这个案例的解释力，但不改变冻结判定。LeanPowers 自身仍有真实的 build RED 顺序缺口；debug 的单次补丁限制则包含工具形状上的仪式性，已前瞻性改为“无命令或其他工具打断的 mutation window”，但不会据此改判本轮结果，也不会用同一套已见任务重新宣称成功。

这说明 LeanPowers 仍然更轻，但“工作效果广泛等效、关键工程纪律可靠保留、token 稳定控制在 60% 以内”尚未得到证明。下一次确认必须使用新的、未参与调优且规格边界更明确的冻结任务。LeanPowers 的方法来自并持续致敬 Superpowers；对比的意义是诚实识别轻量化后保住了什么、还缺什么。
