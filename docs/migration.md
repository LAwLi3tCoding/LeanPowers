# Migrating from Superpowers to LeanPowers

LeanPowers changes workflow shape, not the requirement for engineering evidence. Migrate by choosing one workflow authority, mapping familiar commands, and validating the new path on representative work before removing Superpowers.

## Critical coexistence warning

> **Do not enable automatic routing from both LeanPowers and Superpowers in the same agent session.**

Both products use skill descriptions or startup guidance to select workflows. Enabling both routers can duplicate planning, trigger conflicting gates, or make it unclear which system owns transitions and completion evidence.

Safe evaluation options:

1. Use separate Codex/Claude profiles or sessions, with only one plugin enabled in each.
2. Keep one plugin enabled as the primary workflow and disable the other.
3. If your runtime supports invoking a disabled plugin's files manually, use only explicit one-off skills and keep a single automatic router.

Do not treat command namespaces alone as isolation; automatic skill discovery can still activate overlapping workflows.

## Concept mapping

| Superpowers 6.1.1 | LeanPowers | Migration note |
| --- | --- | --- |
| `using-superpowers` | automatic risk routing or explicit skill | Starts one lowest-safe workflow instead of checking a full chain |
| `brainstorming` | `shape mode=standard|strict` | Use only for material ambiguity or risk; clear tasks may skip it |
| `writing-plans` | `shape` delivery slices | Slices are outcomes with evidence, not 2–5 minute micro-steps |
| `executing-plans` | `build` | Execute one independently useful slice at a time |
| `test-driven-development` | `build` hard gate | Regression/TDD remains required where behavior changes |
| `systematic-debugging` | `debug` | Reproduction, one falsifiable hypothesis, root cause, proof |
| `requesting-code-review` | `review` | Use for an independent findings-first verdict |
| `receiving-code-review` | `review → build/debug` | Validate findings before accepting repairs |
| `verification-before-completion` | `verify` | Current evidence is still mandatory; scope-keyed evidence may be reused |
| `using-git-worktrees` | `ship` preflight | Isolation becomes risk-triggered rather than universal |
| `finishing-a-development-branch` | `ship` | Follows the user's requested target and reads it back |
| `dispatching-parallel-agents` | shared subagent policy | Delegate only independent, independently verifiable boundaries |
| `subagent-driven-development` | `build` plus strict `review` | Default is one agent; high-risk review stays independent |
| `writing-skills` | no V1 equivalent | Continue using a dedicated skill-authoring workflow when creating skills |

## Invocation mapping

| Intent | Codex | Claude Code |
| --- | --- | --- |
| Clarify and bound work | `$leanpowers:shape` | `/leanpowers:shape` |
| Implement scoped work | `$leanpowers:build` | `/leanpowers:build` |
| Diagnose unknown failure | `$leanpowers:debug` | `/leanpowers:debug` |
| Independent assessment | `$leanpowers:review` | `/leanpowers:review` |
| Prove completion | `$leanpowers:verify` | `/leanpowers:verify` |
| Deliver verified work | `$leanpowers:ship` | `/leanpowers:ship` |

Append `mode=lean`, `mode=standard`, or `mode=strict` when you want to request a level. Leave `mode=auto` for normal risk-based routing.

## Recommended migration sequence

1. **Capture your current baseline.** Record the Superpowers version, runtimes, normal prompts, task outcomes, tokens, elapsed time, agent calls, and known failure categories.
2. **Install LeanPowers in an isolated profile or session.** Keep Superpowers available elsewhere for rollback, but do not activate both routers together.
3. **Start with low-risk tasks.** Compare `build → verify` against your existing process and inspect completion evidence, not just speed.
4. **Exercise unknown-failure work.** Confirm `debug` reproduces the issue, tests one hypothesis at a time, and covers the real failure path.
5. **Exercise strict tasks.** Verify security, authorization, migration, or production-shaped scenarios still receive independent review and authorization gates.
6. **Test delivery.** Confirm `ship` preserves unrelated work and reads back the actual branch, commit, PR, or package target.
7. **Run the paired benchmark.** Follow [benchmark.md](benchmark.md) under identical live conditions. Fixture data is not migration evidence.
8. **Cut over one runtime or team at a time.** Disable Superpowers routing only after representative quality results and rollback criteria are accepted.

## Behavioral changes to expect

- A clear task may begin implementation without a brainstorming round.
- One consolidated clarification may replace several approval turns.
- Plans contain fewer implementation details and more boundaries and acceptance evidence.
- Lean and ordinary standard work usually stay single-agent.
- Full-suite evidence may be reused for the same unaffected revision scope.
- Worktrees are created when isolation is needed, not by default.
- If you already requested a PR or package, `ship` executes that path instead of showing a generic completion menu.

These changes are intentional. They must not remove root-cause diagnosis, regression coverage, independent strict-risk review, current verification, or authorization gates.

## Rollback

If a scenario shows a quality regression:

1. Stop using LeanPowers automatic routing for that scope.
2. Record the prompt, runtime, repository revision, mode, evidence, and failure category.
3. Re-run the scenario under `mode=strict`.
4. If strict mode still regresses, return that team or runtime to Superpowers and treat the category as release-blocking.
5. Add the case to the benchmark suite before changing routing or workflow policy.

Do not “fix” migration results by relaxing evaluator criteria or treating missing evidence as a pass.
