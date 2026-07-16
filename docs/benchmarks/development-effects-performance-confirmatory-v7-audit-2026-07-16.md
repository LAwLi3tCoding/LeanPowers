# Performance confirmatory v7 post-run audit

This audit interprets the frozen v7 result without changing it. The canonical report remains the only scored result artifact, with SHA-256 `f190fc2851e543042029bac892726a4d77b2e5630236f38bb19896e18619cb11`. The result JSON has SHA-256 `942bbdf8a1185ae266eb62e1148fc614e000a99e87bf45e346126d0d39233ae7`, and the stored gate verdict has SHA-256 `c1f3646a8f06215b97c3659562b5081b062dd7008ae534e7bbb1d2abb7822064`. The suite, evaluator, runner, workflow revisions, cases, gates, retry policy, and decision rules are those declared in the [v7 preregistration](development-effects-performance-confirmatory-v7-preregistration-2026-07-16.md).

[Superpowers](https://github.com/obra/superpowers) 6.1.1 is the upstream reference and principal engineering inspiration for LeanPowers. This comparison asks whether LeanPowers reached its own quality-first lightweight target under the frozen conditions. It is not a project ranking.

## Frozen result

The machine decision is **FAIL**. Its exact reasons are `run-integrity`, `lean-conformance`, `lean-task-outcome`, `superpowers-activation`, `token-telemetry`, `token-summary`, `token-target`, and `wall-telemetry`.

- The full declared matrix ran: `5 cases × 2 repetitions × 2 workflows = 20 runs`.
- LeanPowers Task PASS: `2/10`.
- LeanPowers quality-bearing conformance: `1/10`.
- Superpowers Task PASS: `3/10`, reported as a same-condition reference diagnostic under the candidate-centered policy.
- Superpowers activation: `9/10`.
- Valid matched pairs with complete Token telemetry: `7/10`.
- Valid-pair outcome quadrants: `both_pass=1`, `superpowers_pass_lean_fail=1`, `lean_pass_superpowers_fail=1`, and `both_fail=4`.
- Quality-policy population: `0/10`. Neither LeanPowers Task PASS also satisfied LeanPowers conformance and Superpowers activation.
- The formal aggregate Token target is **INELIGIBLE**, not passed or reviewable, because three pairs lack complete Token telemetry.
- Across the seven valid pairs, the diagnostic totals are `2,836,379` Superpowers tokens and `2,364,687` LeanPowers tokens. LeanPowers' diagnostic share is `83.36992341291484%`, a `16.630076587085156%` reduction and above both the `60%` target and `65%` review boundary.
- The valid-pair median wall-time reduction is `15.5%`. It is diagnostic because the complete ten-pair efficiency population is unavailable and quality failed.

The raw `3/10` and `2/10` Task PASS counts include runs that never reached agent work. Within the seven valid matched pairs, each workflow passed `2/7`. The equal valid-pair counts do not establish parity: there is one directional result each way, four pairs where both failed, only one pair where both passed, and only five independent task clusters.

## Protocol integrity and validity exclusions

The suite digest, all five workspace/verifier/mutant snapshots, model, effort, execution order, four revision pins, isolation preflight, and 20 unique run IDs match the frozen contract. All runs preserved the candidate HEAD and verifier workspace. There were no exact model-capacity failures and therefore no capacity retries. A fresh deterministic gate evaluation reproduced the stored FAIL reasons.

Three runs ended before any agent or task tool work with the same HTTP 400 model/tool compatibility response: the request advertised an image-generation tool that the selected Spark endpoint did not support. The affected runs were one Superpowers run and two LeanPowers runs. Each had one attempt, zero tool calls, no workspace changes, and no Token telemetry.

The preregistered retry policy allowed one retry only for the exact terminal model-capacity error. These ordinary invalid-request failures were therefore not retried. The canonical validity ledger classifies the three affected pairs as Token-telemetry exclusions:

- `record-data-delta`, repetition 1;
- `forward-header-sanitization`, repetition 2; and
- `stable-unique-tokens`, repetition 2.

Those three runs are runtime compatibility failures, not evidence that either workflow implemented the task incorrectly. They still prevent a complete quality or efficiency decision, remain visible in the canonical raw-run table, and are not retrospectively replaced. The canonical report's `7/10` valid-pair efficiency population is the only publishable paired population.

The stored gate evidence also contains a `20.6%` wall figure computed over all ten attempt walls. That population includes the three invalid pairs and is not the preregistered valid-pair efficiency statistic. The canonical report correctly gives `15.5%` over seven valid pairs; this audit uses that value and does not rescore the frozen verdict. The current result-gate code now reports the shared adjudicator's valid-pair wall statistic prospectively, while the frozen stored gate artifact and v7 decision remain unchanged.

## Candidate-centered quality interpretation

Seventeen agent turns completed. All `17/17` passed visible tests. LeanPowers passed hidden acceptance in `8/8` completed turns, while Superpowers passed it in `8/9`; the one completed hidden failure was the first Superpowers strict-header run. Candidate-authored artifact-regression evidence passed only `2/8` completed LeanPowers turns and `3/9` completed Superpowers turns.

Two LeanPowers runs therefore passed the full executable task contract, but both failed workflow conformance. Six other LeanPowers runs reached task work and failed because their candidate-authored tests did not kill every preregistered semantic fault member. The remaining two LeanPowers runs were the pre-agent compatibility failures above. Thus v7 does not show a hidden implementation error in the six completed Lean task failures; it shows insufficient regression-test discrimination, which is intentionally part of Task PASS because a superficially correct implementation without boundary-proving tests does not meet this quality target.

LeanPowers conformance failed in nine runs:

1. All eight completed LeanPowers turns emitted the same `workflow=debug | risk=standard` route pair. Consequently, all four completed BUILD-expected cases misrouted to DEBUG and lost the required test-only patch, meaningful RED, and product-patch order; the strict case also failed to upgrade risk. The repeated exact pair suggests example anchoring in the route prompt, which is a product hypothesis for future repair rather than a retrospective scoring change.
2. Two DEBUG runs did not preserve the bounded recovery protocol after failed validation.
3. One DEBUG run did not preserve the required initial uninterrupted test-and-product mutation window.
4. The two pre-agent compatibility failures emitted no usable route or workflow evidence.
5. The completed strict BUILD run also downgraded risk, missed the BUILD evidence sequence, and did not produce the required current independent PASS review.

Only the second queued-task DEBUG run satisfied LeanPowers conformance, but its task still failed mutation evidence. The result therefore supports neither “correct but merely formatted differently” nor “the process passed despite task variance.” The optimized runtime remains unable to make its small set of safeguards reliably executable under this model and suite.

Superpowers' task outcomes are reference diagnostics rather than a LeanPowers quality gate in v7. Its three raw passes and the shared failures remain important context: the task set was difficult for both workflows. They do not relax LeanPowers' declared `10/10` task and `10/10` conformance goal, and they do not support a winner conclusion.

## Results by category

The canonical category table deliberately mixes two labeled populations: quality counts show both repetitions, while `Pairs`, Token, and wall columns include only telemetry-valid pairs. The following interpretation preserves that distinction.

| Category | Valid pairs | Superpowers Task PASS | LeanPowers Task PASS | Diagnostic Lean Token share | Diagnostic Lean wall change |
| --- | ---: | ---: | ---: | ---: | ---: |
| Stable token dedup BUILD | `1/2` | `2/2` | `1/2` | `79.4532%` | `8.1%` slower |
| Task limiter DEBUG | `2/2` | `0/2` | `0/2` | `101.7864%` | `50.1%` faster median |
| Record delta BUILD | `1/2` | `0/2` | `0/2` | `59.5037%` | `15.5%` faster |
| Undo history DEBUG | `2/2` | `1/2` | `1/2` | `68.3441%` | `9.5%` slower median |
| Hop-by-hop header strict BUILD | `1/2` | `0/2` | `0/2` | `96.4733%` | `507.0%` slower |

Only two of seven valid individual pairs were at or below `60%`, and both were failed tasks. The sole `both_pass` pair used `79.45319333721405%` as many LeanPowers tokens and was `8.1%` slower; its LeanPowers run also failed workflow conformance. There is therefore no quality-equivalent efficiency population in v7.

Category totals show the same gap. Valid BUILD pairs used `80.2136%` as many LeanPowers tokens, and valid DEBUG pairs used `85.3641%`. Cached-context reduction supplied almost all apparent saving: across the valid BUILD population LeanPowers fresh tokens were slightly higher, while cached tokens were lower. This supports keeping the smaller instruction surface, but it does not show that the current workflow execution is reliable.

## What v7 establishes

V7 used the latest optimized LeanPowers runtime revision `1e59e068e48070f30ebd6b74efbb31e479445a34`. Its six engineering Skill files contain `3,039` words versus `18,516` across the 14-file Superpowers 6.1.1 comparison set, an `83.6%` structural reduction. Including LeanPowers `route` and `adapt`, all eight Skill files total `3,867` words, still `79.1%` smaller by the same method. Static package validation, build, privacy checks, and GitHub CI prove that this smaller product artifact is internally consistent and distributable.

The live result does not establish that the smaller artifact preserved the requested engineering effect. The complete quality target failed, the formal Token target was ineligible, the seven-pair diagnostic Token share missed the target by a wide margin, and the only both-pass pair was neither conformant nor faster. The valid-pair wall median is encouraging but too heterogeneous to generalize: DEBUG had a faster median while lean and strict BUILD were slower, including one large strict-case tail.

The main prospective gaps are narrow and observable:

1. Make explicit BUILD requests route to BUILD instead of DEBUG without adding a longer universal sequence.
2. Keep mutation-discriminating candidate tests as a hard quality invariant, especially for ordinary surfaces, identity, freshness, and asynchronous release paths.
3. Make the DEBUG recovery window and resolved reproduction easier to preserve after one failed validation.
4. Prevent strict-risk downgrade and make the post-green independent review an unmistakable exit condition.
5. Remove unsupported tool declarations from future Spark benchmark requests, or preflight exact model/tool compatibility before a new suite freeze. This is a runner/runtime compatibility improvement, not a v7 rescore.

These are future directions only. V7 will not be rerun, rescored, or reinterpreted after live output.

## Bounded conclusion

V7 did not meet LeanPowers' own quality-first lightweight target. LeanPowers produced `2/10` Task PASS and `1/10` workflow conformance; Superpowers produced `3/10` Task PASS as a same-condition reference diagnostic. Three pairs were invalid because model/tool compatibility failures prevented complete Token telemetry, so the formal Token and wall targets are ineligible. Across the seven valid pairs, LeanPowers used `83.37%` as many model tokens and had a `15.5%` median wall-time reduction, but both figures are diagnostic and cannot compensate for quality failure.

The result supports a narrower statement: LeanPowers has a substantially smaller control surface and showed some resource reduction on the valid-pair aggregate, but this revision did not reliably preserve the measured engineering safeguards. It does not support general parity, non-inferiority, superiority, or a claim that the target has been reached.

Superpowers remains the upstream reference and major engineering inspiration for this work. The value of v7 is not a ranking; it is a precise account of which safeguards the lightweight design still needs to make dependable.
