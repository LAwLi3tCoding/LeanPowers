# LeanPowers 0.2.0 and Superpowers 6.1.1

This comparison answers a narrow question: how does LeanPowers reduce workflow overhead while retaining the engineering safeguards that affect outcomes?

It does **not** claim that LeanPowers has already matched Superpowers on live tasks. The paired live benchmark has not yet been run. Structural facts are verified from source; quality and efficiency values remain release targets until live evidence exists.

The comparison set contains all 14 Superpowers 6.1.1 Skills. LeanPowers consolidates the 13 engineering-workflow concerns into six engineering workflows; `writing-skills` remains an external specialist concern. Two compact control Skills sit outside the engineering chain: `route` improves entry discovery, while `adapt` adds project-local feedback learning.

## Evidence basis

Snapshot date: 2026-07-13.

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
# six engineering workflows: 2,561 words
# route control Skill: 219 words
# adapt control Skill: 329 words
# all eight Skill files: 3,109 words

wc -w adapters/claude/session-start
# 111 words
```

The six-workflow engineering surface is 86.2% smaller than the 18,516-word, 14-file Superpowers comparison set. Including the 219-word `route` and 329-word `adapt` control Skills, the complete 3,109-word LeanPowers Skill surface is 83.2% smaller. The baseline total deliberately includes `writing-skills`, even though LeanPowers keeps that concern external. These figures measure source instruction words, not actual model tokens, latency, or task quality.

## Side-by-side design

| Dimension | Superpowers 6.1.1 | LeanPowers 0.2.0 | What remains protected |
| --- | --- | --- | --- |
| User-facing core | 14 skills | 6 engineering workflows + 2 control Skills | Full path from requirements to delivery; routing and learning stay outside the chain |
| Primary skill text | 18,516 words | 2,561 engineering words; 3,109 total | Shared policies avoid repeating gates |
| Workflow selection | Check relevant skills before any response or action | `route` selects exactly one lowest-safe workflow when no owner is already clear | Explicit routing still upgrades on risk |
| Creative work | `brainstorming` hard-gates implementation until design approval | `shape` only for material ambiguity or risk | Acceptance, scope, constraints, architecture decisions |
| Planning | Detailed 2–5 minute steps, often including code | 1–5 outcome-based delivery slices | Interfaces and proof are still explicit |
| Implementation | Separate TDD and execution skills | Regression/TDD invariant inside `build` | Early evidence and RED-GREEN where appropriate |
| Unknown failures | `systematic-debugging` | Compact falsifiable state machine in `debug` | Reproduction, root cause, regression proof |
| Subagents | Parallel/SDD workflows; SDD dispatches implementer plus two review stages per task | One agent by default; bounded direct children only for independent boundaries | High-risk review remains independent |
| Review | Request/receive review skills and SDD task gates | One findings-first `review` skill | Severity, evidence, scope, compatibility, security |
| Verification | Fresh command evidence before completion | Current evidence keyed by revision and supported scope | Stale or unavailable evidence cannot pass |
| Worktrees | Dedicated workflow and common execution precondition | Isolation only when branch, dirtiness, or conflict risk requires it | User changes and branch safety are preserved |
| Completion | Structured branch integration menu | Execute explicit delivery intent through `ship` | Destructive actions still require authority; remote state is read back |
| Claude startup | `using-superpowers` bootstrap, 481 source words | 111-word read-only routing hint, restored after startup/clear/compact | Skill discovery, escalation, and explicit-feedback routing |
| Codex startup | Native skill discovery in 6.1.1 | Native discovery of the 219-word `route` entry Skill | No injected startup prompt |
| Skill authoring | `writing-skills` is part of core | Not a core engineering workflow | Product engineering workflow stays smaller; skill authoring remains an external specialist task |
| Feedback learning | No equivalent in the compared 14 core Skills | Optional `adapt` control Skill, disabled by default | Project-local scope, explicit feedback, precedence, privacy, and three-lesson cap |

## What LeanPowers consolidates

The first eight rows below account for 13 Superpowers engineering-workflow Skills. The final row records the one compared Skill that LeanPowers does not consolidate into its engineering core.

| Superpowers skill or concern | LeanPowers location |
| --- | --- |
| `using-superpowers` | 219-word `route` + Skill descriptions + [`risk-policy.md`](../references/risk-policy.md) + workflow transitions |
| `brainstorming`, `writing-plans` | `shape` |
| `test-driven-development`, `executing-plans` | `build` |
| `systematic-debugging` | `debug` |
| `requesting-code-review`, `receiving-code-review` | `review`, then `build` or `debug` for accepted repairs |
| `verification-before-completion` | `verify` + evidence protocol |
| `using-git-worktrees`, `finishing-a-development-branch` | `ship` |
| `dispatching-parallel-agents`, `subagent-driven-development` | Shared subagent policy + risk-triggered `build`/`review` |
| `writing-skills` | Deliberately outside the product-engineering core |

`route` is deliberately narrower than `using-superpowers`: it activates one owner and exits, without a 1% threshold, pre-response mandate, anti-rationalization prompt, or preloaded chain. `adapt` has no equivalent in the compared Superpowers 6.1.1 core Skill set. Neither control Skill is an engineering stage.

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

## Intentional differences

LeanPowers intentionally removes or makes conditional:

- skill invocation before every response and repository inspection;
- mandatory brainstorming and section-by-section approval for clear local work;
- implementation plans that reproduce detailed code or micro-steps;
- an implementer and multiple reviewers for every delivery micro-task;
- a worktree for every feature;
- repeated full verification for an unchanged revision;
- a fixed completion menu when the user already requested a delivery target;
- skill-authoring methodology and visual brainstorming as core engineering features;
- global or cross-project learning; `adapt` is explicitly enabled per project and has no background or network activity.

These differences reduce context, turns, and dispatch count. The claim that they reduce cost without materially reducing outcomes must be tested, not inferred from architecture.

## Current evidence and open gap

Verified now:

- Six engineering workflows, `route` and `adapt` control Skills, and six shared policy documents exist.
- Source budgets are exactly 2,561 engineering words, 219 `route` words, 329 `adapt` words, 3,109 total Skill words, and a 111-word Claude startup script.
- Codex has zero startup injection; Claude has one static, read-only command hook.
- Learning is disabled by default; when enabled it stores normalized rules and bounded evidence summaries in project-local `.leanpowers/`, excluded through local Git metadata.
- The learning helper has no background activity, network access, telemetry, global profile, or cross-project sharing, and requires Node.js 20+ only while learning is enabled.
- Routing, evidence validation, package parity, and benchmark scoring have deterministic tests.
- Checked-in scorer fixtures declare simulated provenance; simulated or incomplete inputs cannot produce a release-eligible result.

Not yet verified:

- Real task-success non-inferiority against Superpowers 6.1.1.
- Real token, wall-time, and agent-call reductions.
- Seeded-defect escape rates across live agents and repositories.
- Cross-runtime behavior under identical live model and evaluator conditions.
- Related-task improvement, zero unrelated-task contamination, zero safety bypass, and bounded retrieval in a paired live four-turn learning run.

Until the paired live suite in [benchmark.md](benchmark.md) passes, describe LeanPowers as structurally lighter with retained safeguards—not as empirically equal or faster.
