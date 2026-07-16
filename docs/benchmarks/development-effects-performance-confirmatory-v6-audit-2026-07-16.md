# Performance confirmatory v6 post-run audit

This audit interprets the frozen v6 result without changing it. The canonical report remains the only result artifact, with SHA-256 `959c9f9f3889efc90cd3fc129b070caed266e373e082f57c13ce6104ba8c2a94`. The suite, evaluator, runner, workflow revisions, cases, gates, and decision rules are exactly those declared in the [v6 preregistration](development-effects-performance-confirmatory-v6-preregistration-2026-07-16.md).

Superpowers 6.1.1 is the upstream reference and principal engineering foundation for LeanPowers. This audit examines a bounded optimization tradeoff under the frozen conditions. It is not a project ranking, and no observation below is evidence that either project is generally superior.

## Frozen result

The machine decision is **FAIL** for three independent reasons: `lean-conformance`, `task-outcome`, and `token-target`.

- Superpowers Task PASS: `4/10`.
- LeanPowers Task PASS: `4/10`.
- Paired quadrants: `both_pass=4`, `superpowers_pass_lean_fail=0`, `lean_pass_superpowers_fail=0`, `both_fail=6`.
- LeanPowers workflow declaration failures: `4/10`.
- LeanPowers conformance failures: `9/10`.
- Superpowers activation: `10/10`.
- Complete matched pairs with valid Token telemetry: `10/10`.
- Superpowers total model tokens: `3,027,400`.
- LeanPowers total model tokens: `2,275,147`.
- LeanPowers aggregate Token share: `75.15184646891723%`, above the `60%` target and the preregistered `65%` review boundary.
- Median all-matched wall-time reduction: `4.6%`.

Both workflows had a 40% observed pass rate. That is neither the preregistered shared floor nor shared ceiling, and the two directional asymmetry cells are empty. Those facts describe this matrix; they do not prove parity or non-inferiority. The absolute quality rule required `10/10` for each workflow, LeanPowers conformance `10/10`, and Superpowers activation `10/10`.

## Protocol integrity

Before the live matrix, one launch invocation stopped at the held-out filesystem-isolation probe because the runner itself was placed inside an allowed temporary root. It stopped before the runner emitted `START`, made zero model calls, and wrote no result artifacts. Only the runner location was changed; no frozen suite, evaluator, workflow, case, or decision-rule byte changed. Under the preregistered boundary, this was a preflight-only launch failure, not a benchmark run.

The one authorized live matrix then ran all 20 agent executions to natural completion. It produced ten valid matched pairs, no infrastructure failures, no telemetry gaps, no excluded pairs, and no capacity retries. A fresh evaluation of the stored result independently returned the same `FAIL` status, the same three reasons, the same `75.15184646891723%` aggregate Token share, and the same `4.6%` median wall-time reduction.

V6 is now frozen calibration evidence. It will not be rerun, rescored, or tuned. Any prospective product claim must use different, newly frozen unseen tasks.

## Layered quality interpretation

The four `both_pass` pairs came from cyclic rotation BUILD and version-vector DEBUG. They demonstrate that both workflows can solve those two bounded cases in both repetitions. They do not form an efficiency-eligible primary population, because every one of those four LeanPowers runs failed quality-bearing conformance. The only LeanPowers conformance PASS occurred on a ring-buffer run whose Task result failed. The preregistered primary population is therefore `0/10`.

The six `both_fail` pairs came from three categories:

| Category | Paired outcome | Main executable evidence | Interpretation |
| --- | ---: | --- | --- |
| JSON merge patch BUILD | `both_fail` in `2/2` pairs | Superpowers had one hidden failure and one mutation-adequacy failure; LeanPowers had two hidden failures and one additional mutation-adequacy failure | A shared hard boundary with different implementation mistakes; not evidence of equivalence |
| Ring buffer DEBUG | `both_fail` in `2/2` pairs | Implementations passed hidden behavior, but each workflow's candidate tests failed a frozen semantic fault member in each repetition | Shared regression-test discrimination gap |
| Capability scope strict BUILD | `both_fail` in `2/2` pairs | Both implementations passed hidden behavior but neither test delta killed the deny-precedence, case-sensitive scope, or safe-accessor fault families | Shared test-design gap on a security-sensitive boundary; LeanPowers also missed mandatory independent strict review |

Across these six focus pairs, each workflow was `0/6`. Superpowers had one hidden-verifier failure and LeanPowers had two; both had five artifact-regression failures. The symmetric outcome table is therefore real, but it is dominated by shared unsuccessful work rather than successful non-inferiority evidence.

## LeanPowers workflow findings

LeanPowers activated the expected top-level owner inconsistently even though every prompt explicitly named the entrypoint. Four runs emitted an invalid declaration. The source-level cause is deterministic: `skills/route/SKILL.md` presented `workflow=OWNER | risk=RISK` as the exact first line, while the evaluator correctly required concrete lowercase workflow and risk values. Existing Skill tests also treated that literal placeholder as valid. This is a LeanPowers contract defect, not random model formatting.

The frozen evaluator recorded conformance failure in nine runs. A post-run trace audit classifies seven as real workflow-execution gaps and two as observer limitations. In one version-vector run, the required pre-edit reads and reproduction occurred inside a safe chained read command that the observer did not decompose. In one ring-buffer run, the ordered read, reproduction, validation, and replay commands used a redundant same-workspace `cd` prefix that the observer did not normalize. These two limitations do not change or rescore the frozen `1/10` result; they are prospective evaluator fixes.

The real workflow gaps cluster into a few small controls rather than a need for a larger ceremony layer:

1. **Route receipt used an unsafe literal template.** Four runs copied `OWNER` instead of reporting the selected workflow, and two of those also copied `RISK` or omitted the structured declaration.
2. **BUILD did not consistently preserve TEST-PATCH → meaningful RED → CODE-PATCH.** Five of six BUILD runs violated the frozen trace. Product code sometimes changed before the test, or a test changed after RED without re-establishing RED before product code.
3. **Clause-to-test ledgers were too broad.** Phrases such as fresh, exact, regardless of order, case-sensitive, or without coercion were grouped rather than mapped to the smallest neighboring implementation they needed to reject. Ring and capability implementations passed hidden behavior while their tests failed exactly these discrimination checks.
4. **One DEBUG run imported BUILD's RED stop into the DEBUG repair window.** DEBUG needs pre-edit reproduction, then a compact test-and-product repair window, validation, and an independent replay; it should not stop between regression and product repair to run the BUILD RED gate.
5. **Strict BUILD did not perform the required independent post-green review.** Both capability-scope repetitions missed it, so the risk-adaptive promise was not demonstrated where it mattered most.

These are LeanPowers product findings, not defects attributed to Superpowers. Superpowers reported activation in all ten runs and satisfied its frozen workflow-conformance checks.

## Efficiency interpretation

The all-pair aggregate saved `752,253` model tokens relative to Superpowers, but most of that difference came from unsuccessful work:

| Population | Superpowers tokens | LeanPowers tokens | Lean share | Absolute saving |
| --- | ---: | ---: | ---: | ---: |
| Both Task PASS (`4` pairs) | `931,252` | `865,943` | `92.9869680816793%` | `65,309` |
| Both Task FAIL (`6` pairs) | `2,096,148` | `1,409,204` | `67.2283%` | `686,944` |
| All matched (`10` pairs) | `3,027,400` | `2,275,147` | `75.15184646891723%` | `752,253` |

The both-fail population supplied `91.3%` of the total Token saving. All four individual pairs at or below the `60%` target were failed tasks. On the four both-pass pairs, LeanPowers saved only `7.0130%` in aggregate and still had no conformant primary run. The observed `75.1518%` share therefore cannot be described as quality-equivalent efficiency.

The Token profile still gives useful prospective direction. LeanPowers used fewer tool calls and fewer fresh tokens in most categories, while repeated cached-context exposure remained the largest source of volume. Safe optimization should compress repeated context, combine related read-only checks, and carry one compact evidence ledger forward. It must not obtain savings by skipping RED evidence, fault-discriminating tests, reproduction, strict review, or final verification.

## Prospective changes

The next LeanPowers revision should make the existing safeguards easier to execute, not add a long mandatory sequence:

1. Replace the route template with concrete syntax: `workflow=<selected-lowercase-owner>` and `risk=<selected-lowercase-risk>`. State that angle-bracket placeholders must be replaced and literal meta-values are invalid. Add parser-accepted examples for the supported owners and risks, plus a negative test that rejects `OWNER` and `RISK`.
2. Make BUILD's existing gate unskippable in four short rules: the first behavioral edit is test-only; product files remain locked until a focused meaningful RED; changing the test after RED invalidates that RED and requires another run; implementation and tests are never patched together before valid RED.
3. Make the clause ledger atomic and discriminating. Each high-information qualifier must name one neighboring wrong implementation its test rejects. Expand only qualifiers actually present in the task: for example, fresh checks two returned identities, order-independent checks both orders, case-sensitive changes one character's case, and no-coercion/no-access checks an observable trap.
4. For DEBUG, preserve one compact ordered ledger: observed failure, falsifiable cause, a continuous regression-plus-product repair window, validation, and re-run of the original reproducer. Explicitly keep BUILD's RED command out of that repair window.
5. For strict work, treat `green != completion`: independent post-green review is a hard exit condition, and its focused packet carries the task, atomic ledger, changed paths, and current validation. Findings require repair, revalidation, and a fresh reviewer.
6. Prospectively normalize safe same-workspace `cd && command` forms and proven read-only command chains in the observer while continuing to reject workspace escape, substitution, redirection, pipes, and mixed write commands. This fixes measurement sensitivity; it does not change v6.
7. Reduce Token overhead only around those invariants: avoid rereading unchanged workflow text, batch independent inspections, limit tool output to relevant regions and failure summaries, and carry one compact evidence ledger into verification and strict review.

These changes are prospective. They do not authorize a v6 rerun or a corrected v6 verdict. Their effectiveness must first be checked with local contract tests and then, if a new confirmatory claim is desired, with an independently calibrated v7 suite of unseen cases.

## Bounded conclusion

V6 does not establish LeanPowers' target. The two workflows had the same observed Task PASS count, but absolute quality was only `4/10` for each, LeanPowers conformance was `1/10`, the quality-equivalent Token population was empty, and the aggregate Token share missed the target at `75.1518%`. The correct result is the frozen **FAIL**.

The result also does not establish a winner. Superpowers remains the upstream reference whose engineering discipline LeanPowers is trying to preserve with a smaller control surface. V6 narrows the next engineering work: make activation observable, strengthen boundary-focused regression tests, preserve the minimal DEBUG evidence chain, enforce strict review, and reduce repeated context without removing safeguards. Whether those changes close the gap is a question for new evidence, not retrospective reinterpretation.
