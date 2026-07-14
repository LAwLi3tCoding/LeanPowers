# LeanPowers

**Lightweight, high-rigor engineering workflows for Codex and Claude Code.**

*Essential workflows. Less ceremony.*

[简体中文](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/README.zh-CN.md) · [Superpowers comparison](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/comparison-superpowers.md) · [Benchmark protocol](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/benchmark.md) · [Acknowledgments](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/ACKNOWLEDGMENTS.md) · [Migration guide](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/migration.md)

LeanPowers keeps the safeguards that matter—bounded requirements, regression evidence, root-cause debugging, independent review, current verification, and safe delivery—while selecting the smallest workflow justified by risk. It is a workflow microkernel, not a large always-on prompt or orchestration service.

> **Release status:** `0.2.0` is a technical preview. It adds opt-in project learning from explicit feedback. A 12-run paired development pilot observed 5/6 passing runs for both LeanPowers and Superpowers, with 19.8% lower median model tokens and 9.5% lower median wall time for LeanPowers. This is bounded pilot evidence, not the full release benchmark or a general non-inferiority claim. See the [pilot report](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/docs/benchmarks/development-effects-pilot-2026-07-14.md).

> **Lineage and thanks:** LeanPowers is an independent project inspired by [Superpowers](https://github.com/obra/superpowers). Its evidence-first engineering discipline, TDD, systematic debugging, review, verification, and safe-delivery ideas provided the foundation for this work. LeanPowers explores a different optimization point—more selective ceremony with risk-triggered rigor. It is not presented as a defeat, replacement verdict, or criticism of Superpowers. See [Acknowledgments](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/ACKNOWLEDGMENTS.md).

## Why LeanPowers

- Six focused engineering workflows instead of a long mandatory chain.
- A 234-word `route` entry Skill improves discovery but activates only one workflow.
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

`route` is a 234-word control-plane entry Skill. It raises automatic discovery—especially in Codex—by matching the start of engineering work, then activates exactly one lowest-safe workflow. It exits when a specific workflow already owns the task and never preloads the full chain.

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
| `strict` | Security, authorization, payment, privacy, migration, concurrency, production, irreversible change | `shape(full, if unclear) → build/debug → independent review → verify → ship(if requested)` |

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

Codex retains zero startup injection and discovers the 234-word `route` Skill through native metadata. Claude Code receives one 111-word, read-only routing hint that is restored after startup, clear, or compaction; it does not inspect `.leanpowers/`, scan or write the repository, access the network, or dispatch agents. The six engineering workflows require no Node.js runtime. The optional learning helper requires Node.js 20+ only when learning is explicitly enabled.

## Privacy and security

- No telemetry or analytics.
- No repository scan or network access from the Claude startup hook.
- Learning is off by default and state never leaves the current project.
- Enabled learning stores normalized rules and bounded evidence summaries, never raw chats, secrets, environment values, or full logs.
- Full command output stays local; bounded summaries enter the model context.

Agent instructions are not a security boundary. Review commands and diffs before authorizing destructive, production, or credential-sensitive actions. See [SECURITY.md](https://github.com/LAwLi3tCoding/LeanPowers/blob/main/SECURITY.md).

## Compared with Superpowers 6.1.1

LeanPowers compares against all 14 Superpowers 6.1.1 Skills. It consolidates the 13 engineering-workflow concerns into six engineering workflows and keeps `writing-skills` as an external specialist concern. The six engineering `SKILL.md` files contain exactly 2,819 words, an 84.8% reduction from all 18,516 words in the 14-file Superpowers comparison set. The `route` and `adapt` control Skills add 234 and 329 words, so all eight LeanPowers Skill files total 3,382 words—still 81.7% less. Counts use the same `wc -w` method; comparing against all 14 baseline files deliberately includes the external authoring Skill. Structural reduction is verified. A small live pilot found equal 5/6 run success and lower median token use for LeanPowers, while broader quality non-inferiority remains unproven.

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
