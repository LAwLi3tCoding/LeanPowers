# LeanPowers 0.2.0 and Superpowers 6.1.1

Chinese version: [comparison-superpowers.zh-CN.md](comparison-superpowers.zh-CN.md)

## Lineage, acknowledgment, and scope

LeanPowers is an independent project built from the ideas established by [Superpowers](https://github.com/obra/superpowers), its upstream reference and principal engineering foundation: evidence-first engineering, test-driven development, systematic debugging, explicit review, verification before completion, safe branch delivery, and disciplined use of subagents and worktrees. LeanPowers exists because that work demonstrated the value of making engineering discipline executable for coding agents.

We thank Jesse Vincent and the Superpowers contributors for the original project, its open documentation, and the engineering ideas that made this experiment possible. See the repository-wide [Acknowledgments](../ACKNOWLEDGMENTS.md).

This comparison is about lineage and engineering tradeoffs. It asks a narrower design question: how does LeanPowers explore lower workflow overhead while retaining the safeguards most directly connected to engineering outcomes?

A 12-run paired development pilot has now tested three small task shapes. Both workflows passed 5/6 runs; LeanPowers used 19.8% fewer median model tokens and 9.5% less median wall time. This is useful live evidence, but it is too small and narrow to establish general parity or pass the full release benchmark. See the [pilot report](benchmarks/development-effects-pilot-2026-07-14.md).

A separate preregistered, one-case frozen held-out check found 2/2 executable task passes for both workflows. LeanPowers workflow conformance was 1/2, however, so the engineering-effect gate failed. Its paired token shares were 83.3% and 75.9% of Superpowers, a 79.6% median, so 0/2 pairs met the `<=60%` target. See the [held-out report](benchmarks/development-effects-heldout-2026-07-14.md). This result is retained as recorded rather than post-hoc reclassified.

The first preregistered multi-task comparison used three newly frozen standard-risk cases with two counterbalanced repetitions. Both workflows passed 5/6 executable runs and failed the same repetition of the `layered-build-options` mutation gate. LeanPowers used 50.03% of Superpowers' summed model tokens, passing the frozen aggregate token target, but LeanPowers quality-bearing conformance was 0/6. The engineering-effect decision and combined target therefore failed. See the [confirmatory result](benchmarks/development-effects-confirmatory-2026-07-15.md) and [preregistration](benchmarks/development-effects-confirmatory-preregistration-2026-07-15.md).

A newly frozen follow-up used three different standard-risk cases under the same 12-run matrix shape. Both workflows passed 4/6 executable runs. LeanPowers used 78.38% of Superpowers' summed model tokens and had 0/6 quality-bearing conformance, so the aggregate-token, engineering-effect, and combined decisions failed. The shared `stable-task-batches` failures included an under-specified null-prototype boundary; the limitation is recorded without changing the frozen verdict. See the [follow-up result](benchmarks/development-effects-confirmatory-followup-2026-07-15.md) and [preregistration](benchmarks/development-effects-confirmatory-followup-preregistration-2026-07-15.md).

The first quality-first matrix used another three frozen cases. Superpowers passed 2/6 and LeanPowers 3/6; neither reached the required 6/6. LeanPowers used 90.4% of Superpowers' aggregate model tokens, missing the `<=60%` target. The frozen evaluator recorded LeanPowers conformance as 0/6. A disclosed status-handling defect caused two BUILD false negatives; corrected diagnostic replay was still only 2/6 and did not change the overall FAIL. Build used 54.2% of Superpowers tokens, while stateful debug used 132.3%. See the [quality-first result](benchmarks/development-effects-performance-confirmatory-v2-2026-07-15.md) and [preregistration](benchmarks/development-effects-performance-confirmatory-v2-preregistration-2026-07-15.md).

The v3 quality-first matrix froze three new categories. Superpowers produced 1/6 and LeanPowers 2/6 Task PASS. LeanPowers implementations passed every visible and hidden behavior verifier, but four BUILD runs lacked fault-discriminating candidate tests and quality-bearing conformance remained 0/6. LeanPowers used 111.9% of Superpowers aggregate model tokens: BUILD used 68.4%, while DEBUG used 150.6% and erased the savings. A result-summary round-trip defect added a false `outcome-consistency` reason; the prospective fix removes only that reason and leaves the overall FAIL unchanged. See the [canonical v3 result](benchmarks/development-effects-performance-confirmatory-v3-2026-07-15.md), [post-run audit](benchmarks/development-effects-performance-confirmatory-v3-audit-2026-07-15.md), and [preregistration](benchmarks/development-effects-performance-confirmatory-v3-preregistration-2026-07-15.md).

The v4 quality-first matrix froze weighted-interleave BUILD, strict structured-redaction BUILD, and bidirectional-index DEBUG. Superpowers produced 5/6 and LeanPowers 3/6 Task PASS; LeanPowers frozen conformance was 0/6. LeanPowers used 1,874,386 model tokens versus Superpowers' 2,370,010, an aggregate share of 79.0877% and 20.9123% fewer total tokens, but still missed the `<=60%` target. Median paired token and wall reductions were 26.0% and 2.0%. The exact frozen gate reasons were `task-outcome`, `lean-conformance`, and `token-target`. See the [canonical v4 result](benchmarks/development-effects-performance-confirmatory-v4-2026-07-16.md), [post-run audit](benchmarks/development-effects-performance-confirmatory-v4-audit-2026-07-16.md), and [preregistration](benchmarks/development-effects-performance-confirmatory-v4-preregistration-2026-07-16.md).

The comparison set contains all 14 Superpowers 6.1.1 Skills. LeanPowers consolidates the 13 engineering-workflow concerns into six engineering workflows; `writing-skills` remains an external specialist concern. Two compact control Skills sit outside the engineering chain: `route` improves entry discovery, while `adapt` adds project-local feedback learning.

## Evidence basis

Snapshot date: 2026-07-16.

- Baseline: [Superpowers v6.1.1 skill tree](https://github.com/obra/superpowers/tree/v6.1.1/skills).
- Mandatory global routing: [`using-superpowers`](https://github.com/obra/superpowers/blob/v6.1.1/skills/using-superpowers/SKILL.md).
- Design gate: [`brainstorming`](https://github.com/obra/superpowers/blob/v6.1.1/skills/brainstorming/SKILL.md).
- Plan granularity: [`writing-plans`](https://github.com/obra/superpowers/blob/v6.1.1/skills/writing-plans/SKILL.md).
- Per-task agent/review flow: [`subagent-driven-development`](https://github.com/obra/superpowers/blob/v6.1.1/skills/subagent-driven-development/SKILL.md).
- Completion proof: [`verification-before-completion`](https://github.com/obra/superpowers/blob/v6.1.1/skills/verification-before-completion/SKILL.md).
- LeanPowers source: [`skills/`](../skills), [`references/`](../references), the [base design](specs/2026-07-13-leanpowers-design.md), and the [implemented adaptive-learning design](specs/2026-07-13-leanpowers-adaptive-learning-design.md).

The word counts use the same command semantics for both projects and include frontmatter plus Markdown:

```bash
# Inside a checkout of obra/superpowers at tag v6.1.1
find skills -mindepth 2 -maxdepth 2 -name SKILL.md -exec wc -w {} +
# total: 18,516 words across 14 files

# Inside LeanPowers 0.2.0
find skills -mindepth 2 -maxdepth 2 -name SKILL.md -exec wc -w {} +
# six engineering workflows: 2,900 words
# route control Skill: 473 words
# adapt control Skill: 329 words
# all eight Skill files: 3,702 words

wc -w adapters/claude/session-start
# 111 words
```

The six-workflow engineering `SKILL.md` text is 84.3% smaller than the 18,516-word, 14-file Superpowers comparison set. Including the 473-word `route` and 329-word `adapt` control Skills, the eight LeanPowers `SKILL.md` files total 3,702 words, 80.0% less than the baseline set. The baseline total deliberately includes `writing-skills`, even though LeanPowers keeps that concern external. These figures measure primary `SKILL.md` words, not conditionally referenced policies, supporting files, actual model tokens, latency, or task quality.

## Side-by-side design choices

| Dimension | Superpowers 6.1.1 | LeanPowers 0.2.0 | What remains protected |
| --- | --- | --- | --- |
| User-facing core | 14 skills | 6 engineering workflows + 2 control Skills | Full path from requirements to delivery; routing and learning stay outside the chain |
| Primary skill text | 18,516 words | 2,900 engineering words; 3,702 total | Strict-only review policy loads after strict validation |
| Workflow selection | Check relevant skills before any response or action | `route` selects and runs exactly one lowest-safe workflow when no owner is already clear | Explicit routing still upgrades on risk |
| Creative work | `brainstorming` hard-gates implementation until design approval | `shape` only for material ambiguity or risk | Acceptance, scope, constraints, architecture decisions |
| Planning | Detailed 2–5 minute steps, often including code | 1–5 outcome-based delivery slices | Interfaces and proof are still explicit |
| Implementation | Separate TDD and execution skills | Regression/TDD invariant inside `build` | Early evidence and RED-GREEN where appropriate |
| Unknown failures | `systematic-debugging` | Compact falsifiable state machine in `debug` | Reproduction, root cause, regression proof |
| Subagents | Parallel/SDD workflows; SDD dispatches an implementer and combined task review per task, followed by whole-branch review | One agent by default; bounded direct children only for independent boundaries | High-risk review remains independent |
| Review | Request/receive review skills and SDD task gates | One findings-first `review` skill | Severity, evidence, scope, compatibility, security |
| Verification | Fresh command evidence before completion | Current evidence keyed by revision and supported scope | Stale or unavailable evidence cannot pass |
| Worktrees | Dedicated workflow and common execution precondition | Isolation only when branch, dirtiness, or conflict risk requires it | User changes and branch safety are preserved |
| Completion | Structured branch integration menu | Execute explicit delivery intent through `ship` | Destructive actions still require authority; remote state is read back |
| Claude startup | `using-superpowers` bootstrap, 481 source words | 111-word read-only routing hint, restored after startup/clear/compact | Skill discovery, escalation, and explicit-feedback routing |
| Codex startup | Native skill discovery in 6.1.1 | Native discovery of the 473-word `route` entry Skill | No injected startup prompt |
| Skill authoring | `writing-skills` is part of core | Not a core engineering workflow | Product engineering workflow stays smaller; skill authoring remains an external specialist task |
| Feedback learning | No equivalent in the compared 14 core Skills | Optional `adapt` control Skill, disabled by default | Project-local scope, explicit feedback, precedence, privacy, and three-lesson cap |

## Lineage and adaptation map

The first eight rows below account for 13 Superpowers engineering-workflow Skills. The final row records the one compared Skill that LeanPowers does not consolidate into its engineering core.

| Superpowers skill or concern | LeanPowers location |
| --- | --- |
| `using-superpowers` | 473-word `route` with a compact semantic risk declaration and bounded clear-build/debug capsules; strict review policy loads only after green strict validation |
| `brainstorming`, `writing-plans` | `shape` |
| `test-driven-development`, `executing-plans` | `build` |
| `systematic-debugging` | `debug` |
| `requesting-code-review`, `receiving-code-review` | `review`, then `build` or `debug` for accepted repairs |
| `verification-before-completion` | `verify` + evidence protocol |
| `using-git-worktrees`, `finishing-a-development-branch` | `ship` |
| `dispatching-parallel-agents`, `subagent-driven-development` | Shared subagent policy + risk-triggered `build`/`review` |
| `writing-skills` | Deliberately outside the product-engineering core |

`route` is deliberately narrower than `using-superpowers`: clear builds use one compact green-path capsule, while other requests load only the selected owner Skill. It has no 1% threshold, pre-response mandate, anti-rationalization prompt, or preloaded chain. `adapt` has no equivalent in the compared Superpowers 6.1.1 core Skill set. Neither control Skill is an engineering stage.

## What is not downgraded

LeanPowers keeps eight hard invariants in every mode:

1. Current evidence before completion claims.
2. Root-cause diagnosis for unknown failures.
3. Regression evidence for behavior changes.
4. Declared-scope compliance.
5. Independent review for high-risk work.
6. Authorization for destructive, irreversible, credential-gated, or production actions.
7. Re-evaluation after contradictory evidence.
8. Explicit validation gaps.

These are implemented in the shared [quality gates](../references/quality-gates.md), not left as optional recommendations.

When project learning is enabled, lessons remain advisory below current instructions and repository/runtime evidence. They cannot lower any of these invariants, authorize external actions, replace root-cause analysis, self-approve strict-risk work, or substitute historical outcomes for current verification.

## Different optimization choices

Relative to its Superpowers foundation, LeanPowers makes the following practices conditional or moves them outside the engineering core:

- skill invocation before every response and repository inspection;
- mandatory brainstorming and section-by-section approval for clear local work;
- implementation plans that reproduce detailed code or micro-steps;
- an implementer and combined task review for each planned task, followed by whole-branch review;
- isolated-workspace setup as a common plan-execution precondition; Superpowers retains user-consent and fallback paths when isolation is declined or unavailable;
- repeated full verification for an unchanged revision;
- a fixed completion menu when the user already requested a delivery target;
- skill-authoring methodology and visual brainstorming as core engineering features;
- global or cross-project learning; `adapt` is explicitly enabled per project and has no background or network activity.

These choices are intended to reduce context, turns, and dispatch count. Whether they do so in live runs without materially reducing outcomes must be tested, not inferred from architecture.

These choices are not universal recommendations. Superpowers' more explicit and comprehensive process can be valuable for teaching a disciplined method, standardizing team behavior, handling unfamiliar work, or preferring consistent ceremony over dynamic routing. LeanPowers is aimed at environments where the same outcome protections are desired but workflow selection should scale with observed risk.

## Current evidence and open gap

Verified now:

- Six engineering workflows, `route` and `adapt` control Skills, and six shared policy documents exist.
- Source budgets are exactly 2,900 engineering words, 473 `route` words, 329 `adapt` words, 3,702 total Skill words, and a 111-word Claude startup script.
- Codex has zero startup injection; Claude has one static, read-only command hook.
- Learning is disabled by default; when enabled it stores normalized rules and bounded evidence summaries in project-local `.leanpowers/`, excluded through local Git metadata.
- The learning helper has no background activity, network access, telemetry, global profile, or cross-project sharing, and requires Node.js 20+ only while learning is enabled.
- Routing, evidence validation, package parity, and benchmark scoring have deterministic tests.
- Checked-in scorer fixtures declare simulated provenance; simulated or incomplete inputs cannot produce a release-eligible result.
- The 2026-07-14 live pilot produced equal 5/6 run success, zero activation failures, zero scope violations, and lower median tokens and wall time for LeanPowers across three task classes.
- The separate frozen held-out task produced equal 2/2 executable success and zero scope violations. Its preregistered engineering-effect gate still failed because LeanPowers conformance was 1/2; its `<=60%` pairwise token target failed 0/2, with a 79.6% median share.
- The 2026-07-15 multi-task confirmatory matrix completed all 12 frozen runs. Both workflows passed 5/6 executable runs and failed the same `layered-build-options` repetition. The aggregate LeanPowers token share was 50.03%, so the token decision passed; LeanPowers quality-bearing conformance was 0/6, so the engineering-effect and combined decisions failed.
- The follow-up confirmatory matrix also completed all 12 frozen runs. Both workflows passed 4/6 executable runs. The aggregate LeanPowers token share was 78.38% and quality-bearing conformance was 0/6, so the token, engineering-effect, and combined decisions all failed. Its under-specified null-prototype boundary is reported as a limitation without changing the result.
- The first quality-first matrix completed all 12 frozen runs with no capacity retry or telemetry gap. Superpowers passed 2/6 and LeanPowers 3/6. LeanPowers used 90.4% of Superpowers aggregate model tokens. Its frozen 0/6 conformance was affected by two evaluator false negatives, but corrected diagnostic replay was still only 2/6; task outcome and aggregate tokens independently kept the overall decision at FAIL.
- The v3 quality-first matrix completed all 12 frozen runs with no infrastructure failure, telemetry gap, scope violation, or excluded pair. Superpowers produced 1/6 and LeanPowers 2/6 Task PASS. LeanPowers used 111.9% of Superpowers aggregate model tokens and had 0/6 conformance. Its published-evidence round-trip defect is disclosed separately and does not change the three independent failure reasons.
- The v4 quality-first matrix completed all 12 frozen runs after a successful isolation preflight. Superpowers produced 5/6 and LeanPowers 3/6 Task PASS; LeanPowers used 79.0877% of Superpowers aggregate model tokens and had 0/6 conformance. Two earlier attempts stopped before any model call and left empty outputs, so they were preflight failures rather than benchmark runs. The canonical matrix remains frozen despite prospective DEBUG observability findings.

Still not verified:

- Task-success non-inferiority across the full 11-scenario release catalog with a formal uncertainty interval.
- The current full-suite 40% aggregate token, 40% wall-time, and 60% agent-call reduction gates. Only the first multi-task confirmatory run passed its narrower aggregate token rule; the other four did not, and all five failed engineering effect. The pilot did not measure agent calls, and the one-case held-out check retains its older, stricter failed every-pair rule.
- Seeded-defect escape rates across live agents and repositories.
- Cross-runtime behavior under identical live model and evaluator conditions.
- Related-task improvement, zero unrelated-task contamination, zero safety bypass, and bounded retrieval in a paired live four-turn learning run.

Until the full paired suite in [benchmark.md](benchmark.md) passes, describe LeanPowers as structurally lighter with mixed, bounded live evidence. Only the first confirmatory matrix met its aggregate token target; all five missed the complete engineering-effect target. Do not describe LeanPowers as generally equal or faster.

## Balanced conclusion

The source comparison supports three conclusions:

1. **LeanPowers is structurally lighter.** The checked source surface is materially smaller and uses one-owner routing plus shared policies instead of a broadly mandatory sequence.
2. **The critical safeguards are retained by design.** Scope, regression evidence, root-cause diagnosis, independent high-risk review, current verification, authorization, and remote delivery readback remain explicit invariants.
3. **The five bounded matrices did not establish reliable parity or efficiency.** The first produced 5/6 for both workflows and met its aggregate token target but failed engineering effect. The follow-up produced 4/6 for both and failed both decisions. The first quality-first matrix produced 2/6 for Superpowers and 3/6 for LeanPowers at 90.4% Token share. V3 produced 1/6 and 2/6 at 111.9%, with a DEBUG long tail and BUILD test-adequacy gaps. V4 improved to 5/6 and 3/6 at 79.0877%, but still failed Task outcome, conformance, and Token target. Small task sets, shared failures, evaluator limitations, and observed variance prevent a general equivalence or release claim.

The intended relationship is therefore complementary rather than adversarial:

- **Superpowers** is the upstream reference and principal engineering foundation for this work.
- **LeanPowers** is a respectful, independently implemented exploration of a smaller, risk-adaptive workflow surface.
- **The benchmark** asks whether that different optimization point is non-inferior within a predeclared margin while using fewer resources; it does not seek a narrative of defeating Superpowers.

Users should choose based on their preferred process shape and validate on representative work. The current pilot, one-case held-out check, and five multi-task confirmatory runs support only their tested conditions. A future newly frozen passing benchmark would support a broader, still bounded claim that LeanPowers preserved outcomes while reducing workflow overhead.
