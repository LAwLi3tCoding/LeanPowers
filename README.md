# LeanPowers

**Lightweight, high-rigor engineering workflows for Codex and Claude Code.**

*Essential workflows. Less ceremony.*

[简体中文](README.zh-CN.md) · [Superpowers comparison](docs/comparison-superpowers.md) · [Benchmark protocol](docs/benchmark.md) · [Migration guide](docs/migration.md)

LeanPowers keeps the safeguards that matter—bounded requirements, regression evidence, root-cause debugging, independent review, current verification, and safe delivery—while selecting the smallest workflow justified by risk. It is a workflow microkernel, not a large always-on prompt or orchestration service.

> **Release status:** `0.1.0` is a technical preview. The deterministic scorer and fixtures are implemented, but a paired live LeanPowers-versus-Superpowers benchmark has not yet been run. Efficiency and non-inferiority thresholds below are gates for the stable `1.0.0` release, not measured product claims.

## Why LeanPowers

- Six focused skills instead of a long mandatory chain.
- `lean`, `standard`, and `strict` paths selected by observable risk.
- Single-agent execution by default; bounded subagents only for independent work.
- Current evidence required before completion or delivery claims.
- Static, dependency-free installed packages with no MCP server or daemon.
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
$leanpowers:build mode=lean Add the missing validation and its regression test.
$leanpowers:debug The integration test is intermittently returning an empty result.
$leanpowers:verify Prove this branch is ready to deliver.

# Claude Code
/leanpowers:shape mode=standard Design a backward-compatible pagination change.
/leanpowers:review Review this diff against the stated acceptance criteria.
/leanpowers:ship Push the verified branch and open the requested pull request.
```

`mode=auto` is the default. `mode=lean`, `mode=standard`, and `mode=strict` request a workflow preference; safety, authorization, scope, and evidence gates can still raise the rigor.

## The six skills

| Skill | Use it for | Primary output |
| --- | --- | --- |
| `shape` | Material ambiguity, scope, architecture, acceptance criteria | Executable brief with 1–5 delivery slices |
| `build` | Features, known-cause fixes, refactors, config, docs | Implemented slices with targeted evidence |
| `debug` | Unknown, intermittent, or disputed failures | Reproduction, falsifiable hypothesis, root cause, repair proof |
| `review` | Independent correctness and risk assessment | Findings-first verdict with evidence and severity |
| `verify` | Completion, safety, installability, or readiness claims | Claim-to-command evidence and explicit gaps |
| `ship` | Commit, push, PR, package, release, or handoff | Destination readback for the delivered revision |

## Routing and modes

LeanPowers starts with one workflow and transitions only when evidence requires it.

| Mode | Typical signals | Default path |
| --- | --- | --- |
| `lean` | Clear, local, reversible, established validation | `build → verify` |
| `standard` | Normal feature, multi-file behavior, bounded uncertainty | `shape(light) → build/debug → verify` |
| `strict` | Security, authorization, payment, privacy, migration, concurrency, production, irreversible change | `shape(full) → build/debug → review → verify → ship` |

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
| Six shared skills | Yes | Yes | Yes |
| Startup injection | None | Compact routing charter | None assumed |
| Optional reviewer/verifier agents | Runtime-native task prompts | Packaged agents | Single-agent execution; strict review must come from an external perspective |
| Core quality gates | Yes | Yes | Yes |

LeanPowers does not require Node.js, an MCP server, a daemon, network access, or repository-local runtime state after installation. Node.js 20+ is required only to develop, validate, benchmark, or build this repository.

## Privacy and security

- No telemetry or analytics.
- No repository scan or network access from the Claude startup hook.
- No secrets, environment variables, or full logs are stored by the workflow.
- Evidence is ephemeral by default; only strict cross-session work may use runtime plugin data, never repository-local state by default.
- Full command output stays local; bounded summaries enter the model context.

Agent instructions are not a security boundary. Review commands and diffs before authorizing destructive, production, or credential-sensitive actions. See [SECURITY.md](SECURITY.md).

## Compared with Superpowers 6.1.1

LeanPowers consolidates 14 Superpowers skills into six workflows and moves repeated process into five short shared policies. The checked-in V1 skills contain 2,196 words versus 18,516 words across Superpowers 6.1.1 primary `SKILL.md` files, measured with the same `wc -w` method. Structural reduction is verified; equal real-world quality and the targeted efficiency gains are not yet established by a live paired run.

The retained safeguards and intentional differences are documented in [docs/comparison-superpowers.md](docs/comparison-superpowers.md). If you are migrating, read [docs/migration.md](docs/migration.md)—do not enable both systems as automatic workflow routers in the same session.

## Benchmark

The comparator accepts paired result documents conforming to [schemas/benchmark-result.schema.json](schemas/benchmark-result.schema.json):

```bash
node scripts/benchmark.mjs compare \
  --baseline path/to/superpowers-live.json \
  --candidate path/to/leanpowers-live.json \
  --out path/to/report
```

A release-eligible result must use complete, live, blind, identically paired runs. Simulated or incomplete input produces `DIAGNOSTIC_ONLY`; any hard failure blocks release. See [docs/benchmark.md](docs/benchmark.md) for scenarios, metrics, thresholds, and the current evidence gap.

## Development

Prerequisites: Git and Node.js 20 or 22. The installed plugin itself has no runtime dependencies.

```bash
npm run generate         # rebuild both committed runtime packages
npm run generate:check   # fail if generated packages drift
npm test                 # run the Node test suite
npm run validate         # package sync, structure, budgets, and tests
npm run build            # create validated release artifacts in dist/
```

Canonical sources live in `metadata/`, `skills/`, `references/`, `agent-specs/`, and `adapters/`. Do not edit `plugins/` by hand; regenerate it. Contribution rules are in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
