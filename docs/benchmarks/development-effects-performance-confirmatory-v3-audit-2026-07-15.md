# Performance confirmatory v3: post-run audit

This companion audit explains the frozen v3 result without changing it. The [canonical report](development-effects-performance-confirmatory-v3-2026-07-15.md), [preregistration](development-effects-performance-confirmatory-v3-preregistration-2026-07-15.md), and [frozen suite](../../evals/development-effects/performance-confirmatory-v3-suite.json) remain the primary artifacts.

Superpowers 6.1.1 is LeanPowers' upstream reference and engineering foundation. This matrix asks whether LeanPowers met its own quality-first lightweight-workflow target under three bounded tasks. It is not a product ranking.

## Frozen decision

The matrix completed all 12 planned runs. There were no scope violations, telemetry gaps, infrastructure failures, or excluded pairs. One Superpowers run used the preregistered single capacity retry; its 28.9 seconds of infrastructure retry time stayed outside workflow wall-time comparisons.

Metric | Frozen result | Required result | Decision
--- | ---: | ---: | ---
Superpowers Task PASS | 1/6 | reported reference | —
LeanPowers Task PASS | 2/6 | 6/6 | FAIL
LeanPowers quality-bearing conformance | 0/6 | 6/6 | FAIL
Aggregate model tokens | 2,890,860 / 2,582,929 = 111.9% | at most 60% | FAIL
Median paired wall reduction | 8.6% | secondary guardrail | PASS overall; DEBUG regressed

The frozen result gate returned:

```text
status=FAIL reasons=outcome-consistency,task-outcome,lean-conformance,token-target advisories=none token_assessment=miss token_share=111.92177562759178 median_wall_reduction=8.6
```

The overall decision is **FAIL**. Quality did not pass, and the aggregate Token target was missed.

## What the quality result means

LeanPowers' candidate implementations passed the visible and hidden behavior verifiers in all 6 runs. That is useful product-behavior evidence, but it is not Task PASS: the frozen contract also requires candidate-authored tests to kill every preregistered semantic fault family.

- Atomic migration BUILD, both repetitions: implementation behavior passed, but tests did not distinguish all valid flat primitive kinds from an implementation that accepts only string, number, boolean, and null.
- Stable priority BUILD, both repetitions: implementation behavior passed, but tests did not reliably detect input mutation. The first repetition also used an ineffective fresh-record identity assertion.
- Generation-guarded cache DEBUG, both repetitions: visible, hidden, resolved repro, and all five fault-family gates passed.

Superpowers' failures had a different distribution:

- Atomic migration BUILD, both repetitions: the missing-step path used the wrong error class in hidden verification, while the candidate tests passed every fault-family gate.
- Stable priority BUILD, both repetitions: candidate tests missed input mutation; one repetition also missed fresh output records.
- Generation-guarded cache DEBUG: the first repetition passed. In the second, two candidate-test counterfactuals timed out.

These are three small fixtures. They show distinct failure modes, not a general success-rate ordering.

## Why LeanPowers conformance was 0/6

Task outcome and workflow conformance are separate. Task PASS is workflow-neutral. The Superpowers conformance column checks explicit activation; the LeanPowers column checks LeanPowers' preregistered capsule protocol and strict review gates, so those columns are not equivalent process scores.

Observed LeanPowers gaps were systematic:

- Strict atomic BUILD did not preserve the required test-only patch → assertion-level RED → product patch order, and did not reach current validation plus independent review and final stop evidence.
- Stable priority BUILD did not produce one accepted protocol cycle: one run edited product before tests, while the other restarted the RED cycle more than the frozen allowance.
- Strict DEBUG reached correct repairs, but raw traces used multiple correction passes rather than one bounded recovery and then omitted independent review and final stop.

The result therefore exposes a real implementation problem in the workflow instructions: they described the intended discipline, but did not make the highest-value test-design and recovery constraints executable enough for this model/runtime.

## Why the Token target was missed

Owner | Superpowers tokens | LeanPowers tokens | Lean share | Lean quality
--- | ---: | ---: | ---: | ---:
BUILD | 1,215,890 | 831,780 | 68.4% | 0/4
DEBUG | 1,367,039 | 2,059,080 | 150.6% | 2/2
All | 2,582,929 | 2,890,860 | 111.9% | 2/6

BUILD saved 384,110 model tokens, although its 68.4% share still missed the 60% target and its candidate tests were inadequate. DEBUG added 692,041 tokens, more than erasing the BUILD savings.

Five of six matched LeanPowers runs used fewer model tokens than their Superpowers counterpart. The first LeanPowers DEBUG run was the decisive long tail: 1,335,383 tokens versus 400,393, an excess of 934,990. It alone accounted for 46.2% of all LeanPowers tokens. Repeated tool turns multiplied cached context; 96.1% of that pair's excess came from cached-input growth, not from reading workflow files.

The overall paired wall median was 8.6% lower for LeanPowers because the four BUILD pairs were generally faster. DEBUG was much slower in both repetitions, with a category median of 230.1 seconds versus 69.9 seconds. The next optimization target is therefore bounded DEBUG convergence, not fewer necessary checks.

## Evaluator consistency defect

The frozen runner computed each Task outcome from complete mutation-member evidence, then published a privacy-minimized summary containing counts and a hash. The result gate later recomputed Task outcome from that summary using a validator that still required the removed `members` field. All 12 persisted outcomes therefore differed from gate recomputation; three genuine PASS outcomes were incorrectly recomputed as FAIL for evidence-shape reasons.

This defect does not change the frozen Task outcomes, which agree 12/12 with the complete local verifier evidence. It also does not change the overall FAIL: the stored Task result, LeanPowers conformance 0/6, and 111.9% aggregate Token share each independently fail their gates.

The canonical report remains byte-for-byte unchanged. A prospective evaluator fix now validates both complete runtime evidence and the exact published summary representation. A diagnostic replay over the same result artifact, with no model calls and no result edits, returns:

```text
status=FAIL reasons=task-outcome,lean-conformance,token-target advisories=none token_assessment=miss token_share=111.92177562759178 median_wall_reduction=8.6
```

This replay only confirms that `outcome-consistency` was an evaluator defect. It is not a corrected frozen verdict or a new benchmark run.

## Implemented follow-up

The post-run changes are prospective and task-independent:

- Public mutation summaries now round-trip through Task-outcome evaluation with exact field, count, path, reason, and hash-shape validation.
- The 500-word `route` capsule now tells BUILD to derive positive, adjacent-negative, preservation, identity/side-effect, and interacting-failure assertions from the request while omitting inapplicable categories.
- When the contract is asynchronous, tests must name each applicable promise settlement before awaiting, reducing brittle shared-index and unresolved-promise loops.
- A BUILD failure after product mutation enters full DEBUG or stops incomplete. DEBUG alone may apply one already-grounded, regression-preserving correction and one identical rerun; a second failure stops incomplete instead of opening a diagnostic tail.

These changes require a new unseen matrix before any effectiveness or efficiency claim. V3 must not be rerun or reclassified after seeing its results.

## Bounded conclusion

V3 does not establish the target of near-parity at roughly 60% aggregate model tokens. It does show that LeanPowers' implementation behavior can be stronger than its final Task PASS count suggests, while its test design, strict-flow completion, and DEBUG convergence remain unreliable. The appropriate response is to improve those generic workflow boundaries and test them on new unseen work—not to lower the quality gate or reinterpret the frozen matrix.
