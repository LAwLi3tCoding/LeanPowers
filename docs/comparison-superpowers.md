# LeanPowers and Superpowers 6.1.1

This comparison answers a narrow question: how does LeanPowers reduce workflow overhead while retaining the engineering safeguards that affect outcomes?

It does **not** claim that LeanPowers has already matched Superpowers on live tasks. The paired live benchmark has not yet been run. Structural facts are verified from source; quality and efficiency values remain release targets until live evidence exists.

## Evidence basis

Snapshot date: 2026-07-13.

- Baseline: [Superpowers v6.1.1 skill tree](https://github.com/obra/superpowers/tree/v6.1.1/skills).
- Mandatory global routing: [`using-superpowers`](https://github.com/obra/superpowers/blob/v6.1.1/skills/using-superpowers/SKILL.md).
- Design gate: [`brainstorming`](https://github.com/obra/superpowers/blob/v6.1.1/skills/brainstorming/SKILL.md).
- Plan granularity: [`writing-plans`](https://github.com/obra/superpowers/blob/v6.1.1/skills/writing-plans/SKILL.md).
- Per-task agent/review flow: [`subagent-driven-development`](https://github.com/obra/superpowers/blob/v6.1.1/skills/subagent-driven-development/SKILL.md).
- Completion proof: [`verification-before-completion`](https://github.com/obra/superpowers/blob/v6.1.1/skills/verification-before-completion/SKILL.md).
- LeanPowers source: [`skills/`](../skills), [`references/`](../references), and the [approved design](specs/2026-07-13-leanpowers-design.md).

The word counts use the same command semantics for both projects and include frontmatter plus Markdown:

```bash
# Inside a checkout of obra/superpowers at tag v6.1.1
find skills -mindepth 2 -maxdepth 2 -name SKILL.md -exec wc -w {} +
# total: 18,516 words across 14 files

# Inside LeanPowers V1
find skills -mindepth 2 -maxdepth 2 -name SKILL.md -exec wc -w {} +
# total: 2,196 words across 6 files
```

This is an 88.1% reduction in primary `SKILL.md` words. It measures instruction surface, not actual model tokens, latency, or task quality.

## Side-by-side design

| Dimension | Superpowers 6.1.1 | LeanPowers V1 | What remains protected |
| --- | --- | --- | --- |
| User-facing core | 14 skills | 6 skills | Full path from requirements to delivery |
| Primary skill text | 18,516 words | 2,196 words | Shared policies avoid repeating gates |
| Workflow selection | Check relevant skills before any response or action | Start one skill on the lowest safe risk path | Explicit routing still upgrades on risk |
| Creative work | `brainstorming` hard-gates implementation until design approval | `shape` only for material ambiguity or risk | Acceptance, scope, constraints, architecture decisions |
| Planning | Detailed 2–5 minute steps, often including code | 1–5 outcome-based delivery slices | Interfaces and proof are still explicit |
| Implementation | Separate TDD and execution skills | Regression/TDD invariant inside `build` | Early evidence and RED-GREEN where appropriate |
| Unknown failures | `systematic-debugging` | Compact falsifiable state machine in `debug` | Reproduction, root cause, regression proof |
| Subagents | Parallel/SDD workflows; SDD dispatches implementer plus two review stages per task | One agent by default; bounded direct children only for independent boundaries | High-risk review remains independent |
| Review | Request/receive review skills and SDD task gates | One findings-first `review` skill | Severity, evidence, scope, compatibility, security |
| Verification | Fresh command evidence before completion | Current evidence keyed by revision and supported scope | Stale or unavailable evidence cannot pass |
| Worktrees | Dedicated workflow and common execution precondition | Isolation only when branch, dirtiness, or conflict risk requires it | User changes and branch safety are preserved |
| Completion | Structured branch integration menu | Execute explicit delivery intent through `ship` | Destructive actions still require authority; remote state is read back |
| Claude startup | `using-superpowers` bootstrap, 481 source words | 89-word routing charter | Skill discovery and escalation rules |
| Codex startup | Native skill discovery in 6.1.1 | Native skill discovery | No injected startup prompt |
| Skill authoring | `writing-skills` is part of core | Not a V1 core workflow | Product engineering workflow stays smaller; skill authoring remains an external specialist task |

## What LeanPowers consolidates

| Superpowers skill or concern | LeanPowers location |
| --- | --- |
| `using-superpowers` | Skill descriptions + [`risk-policy.md`](../references/risk-policy.md) + workflow transitions |
| `brainstorming`, `writing-plans` | `shape` |
| `test-driven-development`, `executing-plans` | `build` |
| `systematic-debugging` | `debug` |
| `requesting-code-review`, `receiving-code-review` | `review`, then `build` or `debug` for accepted repairs |
| `verification-before-completion` | `verify` + evidence protocol |
| `using-git-worktrees`, `finishing-a-development-branch` | `ship` |
| `dispatching-parallel-agents`, `subagent-driven-development` | Shared subagent policy + risk-triggered `build`/`review` |
| `writing-skills` | Deliberately outside the V1 product-engineering core |

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

## Intentional differences

LeanPowers intentionally removes or makes conditional:

- skill invocation before every response and repository inspection;
- mandatory brainstorming and section-by-section approval for clear local work;
- implementation plans that reproduce detailed code or micro-steps;
- an implementer and multiple reviewers for every delivery micro-task;
- a worktree for every feature;
- repeated full verification for an unchanged revision;
- a fixed completion menu when the user already requested a delivery target;
- skill-authoring methodology and visual brainstorming as V1 core features.

These differences reduce context, turns, and dispatch count. The claim that they reduce cost without materially reducing outcomes must be tested, not inferred from architecture.

## Current evidence and open gap

Verified now:

- Six LeanPowers skills and five shared policy documents exist.
- Source budgets are 2,196 skill words and an 89-word Claude startup script.
- Codex has no startup hook; Claude has one static command hook.
- Routing, evidence validation, package parity, and benchmark scoring have deterministic tests.
- Simulated or incomplete benchmark inputs cannot produce a release-eligible result.

Not yet verified:

- Real task-success non-inferiority against Superpowers 6.1.1.
- Real token, wall-time, and agent-call reductions.
- Seeded-defect escape rates across live agents and repositories.
- Cross-runtime behavior under identical live model and evaluator conditions.

Until the paired live suite in [benchmark.md](benchmark.md) passes, describe LeanPowers as structurally lighter with retained safeguards—not as empirically equal or faster.
