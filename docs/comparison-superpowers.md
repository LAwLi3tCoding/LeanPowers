# LeanPowers 0.2.0 and Superpowers 6.1.1

Chinese version: [comparison-superpowers.zh-CN.md](comparison-superpowers.zh-CN.md)

## Lineage, acknowledgment, and scope

LeanPowers is an independent project inspired by [Superpowers](https://github.com/obra/superpowers). Superpowers established the practical foundation this project builds on: evidence-first engineering, test-driven development, systematic debugging, explicit review, verification before completion, safe branch delivery, and disciplined use of subagents and worktrees. LeanPowers exists because that work demonstrated the value of making engineering discipline executable for coding agents.

We thank Jesse Vincent and the Superpowers contributors for the original project, its open documentation, and the engineering ideas that made this experiment possible. See the repository-wide [Acknowledgments](../ACKNOWLEDGMENTS.md).

This comparison is about lineage and engineering tradeoffs. It asks a narrower design question: how does LeanPowers explore lower workflow overhead while retaining the safeguards most directly connected to engineering outcomes?

A 12-run paired development pilot has now tested three small task shapes. Both workflows passed 5/6 runs; LeanPowers used 19.8% fewer median model tokens and 9.5% less median wall time. This is useful live evidence, but it is too small and narrow to establish general parity or pass the full release benchmark. See the [pilot report](benchmarks/development-effects-pilot-2026-07-14.md).

The comparison set contains all 14 Superpowers 6.1.1 Skills. LeanPowers consolidates the 13 engineering-workflow concerns into six engineering workflows; `writing-skills` remains an external specialist concern. Two compact control Skills sit outside the engineering chain: `route` improves entry discovery, while `adapt` adds project-local feedback learning.

## Evidence basis

Snapshot date: 2026-07-14.

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
# six engineering workflows: 2,882 words
# route control Skill: 444 words
# adapt control Skill: 329 words
# all eight Skill files: 3,655 words

wc -w adapters/claude/session-start
# 111 words
```

The six-workflow engineering `SKILL.md` text is 84.4% smaller than the 18,516-word, 14-file Superpowers comparison set. Including the 444-word `route` and 329-word `adapt` control Skills, the eight LeanPowers `SKILL.md` files total 3,655 words, 80.3% less than the baseline set. The baseline total deliberately includes `writing-skills`, even though LeanPowers keeps that concern external. These figures measure primary `SKILL.md` words, not conditionally referenced policies, supporting files, actual model tokens, latency, or task quality.

## Side-by-side design choices

| Dimension | Superpowers 6.1.1 | LeanPowers 0.2.0 | What remains protected |
| --- | --- | --- | --- |
| User-facing core | 14 skills | 6 engineering workflows + 2 control Skills | Full path from requirements to delivery; routing and learning stay outside the chain |
| Primary skill text | 18,516 words | 2,882 engineering words; 3,655 total | Strict-only review policy loads after strict validation |
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
| Codex startup | Native skill discovery in 6.1.1 | Native discovery of the 444-word `route` entry Skill | No injected startup prompt |
| Skill authoring | `writing-skills` is part of core | Not a core engineering workflow | Product engineering workflow stays smaller; skill authoring remains an external specialist task |
| Feedback learning | No equivalent in the compared 14 core Skills | Optional `adapt` control Skill, disabled by default | Project-local scope, explicit feedback, precedence, privacy, and three-lesson cap |

## Lineage and adaptation map

The first eight rows below account for 13 Superpowers engineering-workflow Skills. The final row records the one compared Skill that LeanPowers does not consolidate into its engineering core.

| Superpowers skill or concern | LeanPowers location |
| --- | --- |
| `using-superpowers` | 444-word `route` with a compact semantic risk declaration and bounded clear-build/debug capsules; strict review policy loads only after green strict validation |
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
- Source budgets are exactly 2,882 engineering words, 444 `route` words, 329 `adapt` words, 3,655 total Skill words, and a 111-word Claude startup script.
- Codex has zero startup injection; Claude has one static, read-only command hook.
- Learning is disabled by default; when enabled it stores normalized rules and bounded evidence summaries in project-local `.leanpowers/`, excluded through local Git metadata.
- The learning helper has no background activity, network access, telemetry, global profile, or cross-project sharing, and requires Node.js 20+ only while learning is enabled.
- Routing, evidence validation, package parity, and benchmark scoring have deterministic tests.
- Checked-in scorer fixtures declare simulated provenance; simulated or incomplete inputs cannot produce a release-eligible result.
- The 2026-07-14 live pilot produced equal 5/6 run success, zero activation failures, zero scope violations, and lower median tokens and wall time for LeanPowers across three task classes.

Still not verified:

- Task-success non-inferiority across the full 11-scenario release catalog with a formal uncertainty interval.
- The predeclared 50% token, 40% wall-time, and 60% agent-call reduction gates. The pilot observed smaller token and wall-time differences and did not measure agent calls.
- Seeded-defect escape rates across live agents and repositories.
- Cross-runtime behavior under identical live model and evaluator conditions.
- Related-task improvement, zero unrelated-task contamination, zero safety bypass, and bounded retrieval in a paired live four-turn learning run.

Until the full paired suite in [benchmark.md](benchmark.md) passes, describe LeanPowers as structurally lighter with promising bounded pilot results, not as generally equal or faster.

## Balanced conclusion

The source comparison supports three conclusions:

1. **LeanPowers is structurally lighter.** The checked source surface is materially smaller and uses one-owner routing plus shared policies instead of a broadly mandatory sequence.
2. **The critical safeguards are retained by design.** Scope, regression evidence, root-cause diagnosis, independent high-risk review, current verification, authorization, and remote delivery readback remain explicit invariants.
3. **The pilot is encouraging, but outcome parity remains open.** The tested runs had equal success and LeanPowers used fewer median tokens, while the small task set, shared security-case failure, and observed variance prevent a general equivalence or release claim.

The intended relationship is therefore complementary rather than adversarial:

- **Superpowers** is the upstream inspiration and comprehensive reference workflow.
- **LeanPowers** is a respectful, independently implemented exploration of a smaller, risk-adaptive workflow surface.
- **The benchmark** asks whether that different optimization point is non-inferior within a predeclared margin while using fewer resources; it does not seek a narrative of defeating Superpowers.

Users should choose based on their preferred process shape and validate on representative work. The current pilot supports only its tested conditions; a future full passing benchmark would support a broader, still bounded claim that LeanPowers preserved outcomes while reducing workflow overhead.
