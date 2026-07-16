# LeanPowers

**Lightweight, high-rigor engineering workflows for Codex and Claude Code.**

*Essential workflows. Less ceremony.*

[简体中文](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/README.zh-CN.md) · [Superpowers comparison](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/comparison-superpowers.md) · [Benchmark protocol](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/benchmark.md) · [Acknowledgments](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/ACKNOWLEDGMENTS.md) · [Migration guide](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/migration.md)

LeanPowers keeps the safeguards that matter—bounded requirements, regression evidence, root-cause debugging, independent review, current verification, and safe delivery—while selecting the smallest workflow justified by risk. It is a workflow microkernel, not a large always-on prompt or orchestration service.

> **Release status:** `0.2.0` is a technical preview with opt-in project learning. Nine live checks, including six frozen 12-run confirmatory matrices and the new 20-run v6 matrix, provide mixed evidence. In v6, both workflows produced 4/10 Task PASS with four `both_pass`, six `both_fail`, and no directional asymmetry. LeanPowers conformance was 1/10. All ten pairs had valid telemetry; LeanPowers used 2,275,147 model tokens versus Superpowers' 3,027,400, a 75.1518% aggregate share that missed the `<=60%` target. Equal observed pass counts on this small suite do not establish parity or non-inferiority, and the combined result remains FAIL. See the [latest result](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/benchmarks/development-effects-performance-confirmatory-v6-2026-07-16.md), its [post-run audit](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/benchmarks/development-effects-performance-confirmatory-v6-audit-2026-07-16.md), and [preregistration](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/benchmarks/development-effects-performance-confirmatory-v6-preregistration-2026-07-16.md).

> **Lineage and thanks:** [Superpowers](https://github.com/obra/superpowers) is the upstream reference and principal engineering foundation for this independent project. Its evidence-first engineering discipline, TDD, systematic debugging, review, verification, and safe-delivery ideas made LeanPowers possible. LeanPowers carries those principles into a smaller, risk-adaptive control surface; the comparison is a lineage-and-tradeoff study. See [Acknowledgments](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/ACKNOWLEDGMENTS.md).

## Why LeanPowers

- Six focused engineering workflows instead of a long mandatory chain.
- A 500-word `route` entry Skill improves discovery and runs one lowest-safe workflow.
- An event-driven `adapt` control Skill provides optional project learning; neither control Skill is an engineering stage.
- `lean`, `standard`, and `strict` paths selected by observable risk.
- Single-agent execution by default; bounded subagents only for independent work.
- Current evidence required before completion or delivery claims.
- Static installed packages with no MCP server, daemon, telemetry, or third-party dependency installation.
- Native packages for both Codex and Claude Code, plus portable Agent Skills.

## Install from GitHub

The repository is its own marketplace. Install it directly—no clone is required.

### Codex

```bash
codex plugin marketplace add LAwLi3tCoding/LeanPowers
codex plugin add leanpowers@leanpowers
```

Codex uses native skill discovery and receives no startup prompt injection.

### Claude Code

```bash
claude plugin marketplace add LAwLi3tCoding/LeanPowers
claude plugin install leanpowers@leanpowers
```

The equivalent commands inside an interactive Claude Code session are:

```text
/plugin marketplace add LAwLi3tCoding/LeanPowers
/plugin install leanpowers@leanpowers
```

Claude Code receives one compact, read-only `SessionStart` routing charter. The hook does not scan or write the repository, access the network, or dispatch agents.

## Quick start

LeanPowers can route from the task, or you can invoke a skill explicitly.

```text
# Codex
$leanpowers:route Choose the lightest safe workflow for this engineering task.
$leanpowers:build mode=lean Add the missing validation and its regression test.
$leanpowers:debug The integration test is intermittently returning an empty result.
$leanpowers:verify Prove this branch is ready to deliver.
$leanpowers:adapt Enable LeanPowers learning for this project.

# Claude Code
/leanpowers:route Choose the lightest safe workflow for this engineering task.
/leanpowers:shape mode=standard Design a backward-compatible pagination change.
/leanpowers:review Review this diff against the stated acceptance criteria.
/leanpowers:ship Push the verified branch and open the requested pull request.
/leanpowers:adapt What has LeanPowers learned in this project?
```

`mode=auto` is the default. `mode=lean`, `mode=standard`, and `mode=strict` request a workflow preference; safety, authorization, scope, and evidence gates can still raise the rigor.

## The six engineering workflows

| Skill | Use it for | Primary output |
| --- | --- | --- |
| `shape` | Material ambiguity, scope, architecture, acceptance criteria | Executable brief with 1–5 delivery slices |
| `build` | Features, known-cause fixes, refactors, config, docs | Implemented slices with targeted evidence |
| `debug` | Unknown, intermittent, or disputed failures | Reproduction, falsifiable hypothesis, root cause, repair proof |
| `review` | Independent correctness and risk assessment | Findings-first verdict with evidence and severity |
| `verify` | Completion, safety, installability, or readiness claims | Claim-to-command evidence and explicit gaps |
| `ship` | Commit, push, PR, package, release, or handoff | Destination readback for the delivered revision |

`route` is a 500-word control-plane entry Skill. It raises automatic discovery—especially in Codex—by matching the start of engineering work, then runs exactly one lowest-safe workflow. Its owner capsule locks BUILD test-first, DEBUG bounded-recovery, and STRICT completed-review effects before task tools; selected Skills add reasoning and output without taking over the order. It never preloads the full chain. Strict-only review instructions are loaded only after a green strict validation.

`adapt` is the other control-plane Skill, not a seventh engineering workflow. Its name means “change future behavior from verified feedback.” It handles explicit outcome feedback and learning maintenance without inserting another mandatory stage into `shape? → build/debug → review? → verify? → ship?`.

## Optional project learning

Learning is disabled by default. Installation, Codex startup, Claude `SessionStart`, and ordinary workflow use do not read or create learning state. Enable it only with an explicit project-scoped request such as:

```text
Enable LeanPowers learning for this project.
Disable LeanPowers learning for this project.
What has LeanPowers learned in this project?
Forget the tenant-filter lesson.
Clear this project's learned lessons.
Permanently delete this project's LeanPowers learning data.
```

When enabled, the bundled Node.js helper stores a project-local `.leanpowers/` ledger and adds `.leanpowers/` to Git's local `info/exclude`; it never edits the tracked `.gitignore`. It records only normalized rules and bounded evidence summaries derived from explicit correction, confirmation, outcome, or durable project preference. It does not store raw chats, full prompts, command logs, stack traces, secrets, credentials, or unrelated repository content.

Retrieval is advisory, project-scoped, and capped at three relevant lessons. Lessons cannot lower authorization, scope, risk, root-cause, regression-evidence, independent-review, or completion-evidence gates. There is no background activity, network access, telemetry, global user profile, or cross-project sharing. Node.js 20+ is required only after project learning is explicitly enabled; the six engineering workflows remain dependency-free while it is disabled.

Disabling learning retains the local ledger for later inspection or deletion. Forget and clear preserve auditable event history; permanent deletion physically rewrites the local learning tree and, like clear-and-disable, requires explicit destructive confirmation.

## Routing and modes

LeanPowers starts with one workflow and transitions only when evidence requires it.

| Mode | Typical signals | Default path |
| --- | --- | --- |
| `lean` | Clear, local, reversible, established validation | `build → complete` with current applicable evidence; otherwise `verify` |
| `standard` | Normal feature, multi-file behavior, bounded uncertainty | `shape(light, if unclear) → build/debug → complete` with current applicable evidence; otherwise `verify` |
| `strict` | Security—including authentication, credentials/secrets, cryptography, or signature verification—authorization, payment, privacy, migration, concurrency, production, irreversible change | `shape(full, if unclear) → build/debug → independent review → complete` with unchanged current evidence; otherwise `verify → ship(if requested)` |

When signals disagree, the highest-risk signal wins. Unknown classification falls back to `standard`. A failed check, widened scope, unknown cause, public boundary change, or high-severity review finding upgrades the workflow.

Examples:

- Rename a private helper with an existing test path: `lean`.
- Add a normal multi-file feature: `standard`, with review when the boundary warrants it.
- Fix an unexplained production authorization failure: `strict`, starting in `debug`.
- Review only: start and stop in `review` unless the user requests repairs.
- Deliver a pull request: current `verify` evidence, then `ship` and remote readback.

## Quality without ritual

These gates never disappear, regardless of mode:

1. No completion claim without current evidence.
2. Unknown failures require root-cause diagnosis before a repair claim.
3. Behavior changes require appropriate regression evidence.
4. Work stays inside the declared scope.
5. High-risk changes receive an independent review.
6. Destructive, irreversible, credential-gated, or production actions require authorization.
7. New contradictory evidence triggers re-evaluation.
8. Material validation gaps are reported explicitly.

Evidence is keyed to the relevant revision and scope. Unchanged evidence may be reused; affected evidence is invalidated after code, configuration, dependency, generated-output, or environment changes.

## Runtime behavior

| Capability | Codex | Claude Code | Generic Agent Skills runtime |
| --- | --- | --- | --- |
| Six engineering workflows + `route`/`adapt` control Skills | Yes | Yes | Yes |
| Startup injection | None | Compact routing charter | None assumed |
| Optional reviewer/verifier agents | Runtime-native task prompts | Packaged agents | Single-agent execution; strict review must come from an external perspective |
| Core quality gates | Yes | Yes | Yes |

Codex retains zero startup injection and discovers the 500-word `route` Skill through native metadata. Claude Code receives one 111-word, read-only routing hint that is restored after startup, clear, or compaction; it does not inspect `.leanpowers/`, scan or write the repository, access the network, or dispatch agents. The six engineering workflows require no Node.js runtime. The optional learning helper requires Node.js 20+ only when learning is explicitly enabled.

## Privacy and security

- No telemetry or analytics.
- No repository scan or network access from the Claude startup hook.
- Learning is off by default and state never leaves the current project.
- Enabled learning stores normalized rules and bounded evidence summaries, never raw chats, secrets, environment values, or full logs.
- Full command output stays local; bounded summaries enter the model context.

Agent instructions are not a security boundary. Review commands and diffs before authorizing destructive, production, or credential-sensitive actions. See [SECURITY.md](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/SECURITY.md).

## Compared with Superpowers 6.1.1

LeanPowers compares against all 14 Superpowers 6.1.1 Skills. It consolidates the 13 engineering-workflow concerns into six engineering workflows and keeps `writing-skills` as an external specialist concern. The six engineering `SKILL.md` files contain exactly 3,037 words, an 83.6% reduction from all 18,516 words in the 14-file Superpowers comparison set. The `route` and `adapt` control Skills add 500 and 329 words, so all eight LeanPowers Skill files total 3,866 words—still 79.1% less. Counts use the same `wc -w` method; comparing against all 14 baseline files deliberately includes the external authoring Skill. Structural reduction is verified. Across seven frozen confirmatory matrices, only the first met its aggregate token target, and none met the complete engineering-effect target. LeanPowers remains structurally lighter, but broad outcome parity and reliable workflow-discipline preservation remain unproven.

This is a lineage-and-tradeoff comparison, not a winner ranking. Superpowers remains the upstream inspiration and a comprehensive workflow reference; LeanPowers tests whether the outcome-critical safeguards can be retained with a smaller, risk-adaptive control surface. The retained safeguards, different optimization choices, evidence limits, and balanced conclusion are documented in [docs/comparison-superpowers.md](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/comparison-superpowers.md). If you are migrating, read [docs/migration.md](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/migration.md)—do not enable both systems as automatic workflow routers in the same session.

## Benchmark

The comparator accepts paired result documents conforming to [schemas/benchmark-result.schema.json](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/schemas/benchmark-result.schema.json):

```bash
node scripts/benchmark.mjs compare \
  --baseline path/to/superpowers-live.json \
  --candidate path/to/leanpowers-live.json \
  --out path/to/report
```

A release-eligible result must use complete, live, blind, identically paired runs. Simulated or incomplete input produces `DIAGNOSTIC_ONLY`; any hard failure blocks release. See [docs/benchmark.md](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/benchmark.md) for scenarios, metrics, thresholds, and the current evidence gap.

For actual coding evidence, see the [2026-07-14 paired development-effects pilot](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/benchmarks/development-effects-pilot-2026-07-14.md): 3 task classes × 2 repetitions × 2 workflows. Both workflows passed 5/6 runs; LeanPowers used 19.8% fewer median model tokens and 9.5% less median wall time. The result is diagnostic pilot evidence and does not meet the full release benchmark's coverage or efficiency gates.

The separate [frozen held-out check](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/benchmarks/development-effects-heldout-2026-07-14.md) covered one standard-risk debugging task. Both workflows passed the executable task 2/2, but LeanPowers conformance was 1/2, so the preregistered engineering-effect gate failed. LeanPowers used a median 79.6% of Superpowers model tokens, and neither pair met the `<=60%` target. This single case does not establish broad equivalence.

The first [multi-task confirmatory result](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/benchmarks/development-effects-confirmatory-2026-07-15.md) used three newly frozen standard-risk cases with two counterbalanced repetitions. Both workflows passed 5/6 executable runs, and both failed the same repetition of the build-options mutation gate. LeanPowers met the aggregate token objective at 50.03% of Superpowers' summed model tokens, but its quality-bearing conformance was 0/6. The engineering-effect decision and combined target therefore failed.

The [follow-up confirmatory result](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/benchmarks/development-effects-confirmatory-followup-2026-07-15.md) used three different frozen cases under the same matrix shape. Both workflows passed 4/6 executable runs. LeanPowers used 78.38% of Superpowers' summed model tokens and had 0/6 quality-bearing conformance, so the aggregate-token, engineering-effect, and combined decisions failed. The shared task-batching failures exposed an under-specified null-prototype boundary; the limitation is documented without post-hoc reclassification.

The first [quality-first token result](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/benchmarks/development-effects-performance-confirmatory-v2-2026-07-15.md) used another three frozen cases. Superpowers passed 2/6 and LeanPowers 3/6; neither reached the required 6/6. LeanPowers used 90.4% of Superpowers aggregate model tokens. A post-run audit found that the frozen evaluator rejected the live Codex status used for intentional RED failures; corrected diagnostic replay raised LeanPowers conformance from the frozen 0/6 to 2/6, still below the requirement and without changing the overall FAIL. The result isolates build at 54.2% token share and stateful debug at 132.3%, making the debug tail the next optimization target.

The newer [v3 quality-first result](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/benchmarks/development-effects-performance-confirmatory-v3-2026-07-15.md) used atomic migration BUILD, stable-priority BUILD, and generation-guarded DEBUG cases. Superpowers produced 1/6 and LeanPowers 2/6 Task PASS. LeanPowers implementations passed all visible and hidden behavior verifiers, but four BUILD runs lacked fault-discriminating tests; quality-bearing conformance remained 0/6. Aggregate LeanPowers model tokens were 111.9% of Superpowers: BUILD used 68.4%, while DEBUG used 150.6% and erased the savings. The [post-run audit](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/benchmarks/development-effects-performance-confirmatory-v3-audit-2026-07-15.md) discloses a frozen result-gate summary defect; fixing it prospectively removes only `outcome-consistency`, not the overall FAIL.

The [v4 quality-first result](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/benchmarks/development-effects-performance-confirmatory-v4-2026-07-16.md) used weighted-interleave BUILD, strict structured-redaction BUILD, and bidirectional-index DEBUG cases. Superpowers produced 5/6 and LeanPowers 3/6 Task PASS; LeanPowers conformance was 0/6. LeanPowers used 1,874,386 model tokens versus Superpowers' 2,370,010, a 79.0877% aggregate share and 20.9123% reduction, but still missed the `<=60%` target. Median paired token and wall reductions were 26.0% and 2.0%. The [post-run audit](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/benchmarks/development-effects-performance-confirmatory-v4-audit-2026-07-16.md) separates executable failures, workflow gaps, and DEBUG telemetry limitations without changing the frozen FAIL. Any prospective change requires newly frozen unseen tasks.

The subsequent [v5 quality-first result](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/benchmarks/development-effects-performance-confirmatory-v5-2026-07-16.md) used HTTP negotiation BUILD, strict safe-redirect BUILD, and keyset-cursor DEBUG cases. Both workflows produced 0/6 Task PASS, and LeanPowers conformance was 0/6. One Superpowers run ended without a complete turn or Token telemetry, so the six-pair aggregate target was ineligible; the five valid pairs give a diagnostic LeanPowers share of 102.3742%, not a substitute decision. The [post-run audit](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/benchmarks/development-effects-performance-confirmatory-v5-audit-2026-07-16.md) records the floor effect, partial quality diagnostics, telemetry gap, and prospective calibration changes without altering v4 or the frozen v5 FAIL. V5 is useful stress evidence but cannot support a comparative quality conclusion.

The latest [v6 quality-first result](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/benchmarks/development-effects-performance-confirmatory-v6-2026-07-16.md) used five narrower unseen cases, two counterbalanced repetitions, medium reasoning effort, and a 20-run matrix. Both workflows produced 4/10 Task PASS: four pairs were `both_pass`, six were `both_fail`, and neither directional asymmetry cell was populated. The result is neither a shared floor nor a shared ceiling, but the absolute 10/10 quality requirement failed and equal counts do not prove parity. LeanPowers conformance was 1/10. With complete telemetry in all ten pairs, LeanPowers used 2,275,147 model tokens versus Superpowers' 3,027,400, an aggregate share of 75.1518%; the all-matched wall reduction median was 4.6%. The exact machine reasons were `lean-conformance`, `task-outcome`, and `token-target`. The [post-run audit](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/benchmarks/development-effects-performance-confirmatory-v6-audit-2026-07-16.md) separates shared task difficulty, LeanPowers workflow gaps, and efficiency evidence without changing v4, v5, or the frozen v6 FAIL.

For multi-task evaluations, the token objective is aggregate: across the complete matched matrix, summed LeanPowers model tokens should be about 60% or less of summed Superpowers tokens. Quality remains a separate hard gate. Individual pair shares stay visible diagnostics, but each pair is not required to remain below 60%. The older held-out result keeps its stricter frozen rule unchanged.

## Development

Development prerequisites: Git and Node.js 20 or 22. Installed engineering workflows have no runtime dependencies; Node.js 20+ is used only by explicitly enabled project learning.

```bash
npm run generate         # rebuild both committed runtime packages
npm run generate:check   # fail if generated packages drift
npm test                 # run the Node test suite
npm run validate         # package sync, structure, budgets, and tests
npm run build            # create validated release artifacts in dist/
```

Canonical sources live in `metadata/`, `skills/`, `references/`, `agent-specs/`, and `adapters/`. Do not edit `plugins/` by hand; regenerate it. Contribution rules are in [CONTRIBUTING.md](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/CONTRIBUTING.md).

## License

[MIT](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/LICENSE)
