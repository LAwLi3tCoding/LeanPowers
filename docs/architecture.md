# LeanPowers architecture

LeanPowers is a static, dual-runtime Agent Skills package. The repository keeps one canonical source tree and generates committed Codex and Claude Code packages from it. Installed runtime use does not require a daemon, MCP server, telemetry service, or Node.js unless project learning is explicitly enabled.

## Source to packages

| Layer | Canonical files | Runtime output |
| --- | --- | --- |
| Product metadata | `metadata/plugin.json` | Marketplace entries and runtime manifests |
| Portable workflow core | `skills/{route,adapt,shape,build,debug,review,verify,ship}/SKILL.md` | Source-identical Skills in both packages |
| Shared contracts | `references/*.md` | Source-identical reference files in both packages |
| Learning helper | `skills/adapt/scripts/*.mjs`, `schemas/learning-*.json`, `schemas/lesson-event.schema.json` | Packaged with both runtimes, used only by `adapt` or enabled learning retrieval |
| Runtime adapters | `adapters/claude/*`, `agent-specs/*.md` | Claude-only hooks and reviewer/verifier agents |
| User docs and license | `README.md`, `LICENSE` | Packaged README links are rewritten to canonical GitHub URLs |

`scripts/generate.mjs` is the only generator. It reads canonical metadata and file manifests, computes expected artifacts, checks drift with `npm run generate:check`, and writes packages atomically when generation is requested. The Codex package adds `.codex-plugin/plugin.json` and no Claude hooks or agents. The Claude package adds `.claude-plugin/plugin.json`, `hooks/session-start`, `hooks/hooks.json`, and `agents/{reviewer,verifier}.md`.

`scripts/validate-package.mjs` enforces exact package inventory, runtime-specific manifest shape, source-package parity, helper import confinement, and static hook behavior. `scripts/build-release.mjs` refuses stale generated artifacts before copying validated Codex and Claude packages into release output.

## Runtime flow

`route` is the entry control Skill when engineering work lacks a clear workflow owner. It selects one workflow owner and one risk level, emits a structured route declaration before task tools, then runs only the selected owner path. Direct invocation of an engineering workflow is still valid when that workflow already owns the task.

The six engineering workflows are:

- `shape`: bound ambiguous scope, constraints, risk, and acceptance evidence.
- `build`: implement known-scope changes with test-first evidence when behavior changes.
- `debug`: reproduce unknown or disputed failures, identify root cause, repair, and replay the reproduction.
- `review`: provide independent read-only assessment and findings-first verdicts.
- `verify`: map completion or delivery claims to current evidence.
- `ship`: deliver verified work and read back the destination.

Workflow transitions are evidence-driven, not a fixed pipeline. Lean and standard work may complete from `build` or `debug` when current applicable evidence supports the declared scope. Strict work must pass an independent review after green validation. `verify` is reserved for stale evidence, explicit verification requests, delivery requests, or cross-artifact/runtime claims. `ship` requires current verification evidence and an explicit delivery target.

## Risk and evidence gates

Risk is highest-signal-wins:

- `lean`: clear, local, reversible work with established validation and no higher signal.
- `standard`: behavior changes, defects, bounded uncertainty, dependencies, multi-file work, public boundaries, external systems, failed validation, or unknown cause.
- `strict`: security, authentication, credentials, cryptography, authorization, payment, privacy, migration, concurrency, production, irreversible operations, large refactors, or high-risk review signals.

The quality gates never disappear:

1. Completion requires current evidence for the exact revision and declared scope.
2. Unknown failures require root-cause diagnosis before a repair claim.
3. Behavior changes require regression evidence.
4. Material scope expansion returns to shaping.
5. Strict work requires an independent review.
6. Destructive, irreversible, credential-gated, or production actions require authorization.
7. Contradictory evidence triggers re-evaluation.
8. Material validation gaps are reported explicitly.

Evidence is scoped by revision fingerprint, relevant files, generated artifacts, dependencies, configuration, environment inputs, and the claim being made. Code, configuration, package, dependency, generated-output, or environment changes invalidate affected evidence.

## Learning boundary

`adapt` is a control-plane Skill, not a seventh engineering workflow. It handles explicit project learning enablement, explicit feedback, correction, outcome, confirmation, inspection, forgetting, clearing, and permanent deletion requests.

Learning is disabled by default. When enabled for one project, the helper stores normalized lessons under project-local `.leanpowers/`, excludes that directory through local Git `info/exclude`, and writes append-only event data with bounded evidence summaries. It does not store raw chats, full command logs, credentials, secrets, unrelated repository content, or global user profiles.

Learning data is advisory. Retrieved lessons can adjust LeanPowers defaults only; they cannot lower risk, widen scope, authorize actions, replace root-cause work, replace regression evidence, satisfy independent review, or make verification pass. Lesson scopes use only the six engineering workflows: `shape`, `build`, `debug`, `review`, `verify`, and `ship`; `route` and `adapt` are control-plane surfaces and are not persisted as lesson workflow scopes.

## Validation layers

| Layer | Purpose |
| --- | --- |
| Unit and contract tests | Validate routing, evidence, learning, generator, package, release, and benchmark scorer behavior |
| `npm run generate:check` | Prove committed runtime packages match canonical source |
| `node scripts/validate-package.mjs` | Prove package inventory, manifests, helper confinement, and hook behavior |
| `npm run validate:quick` | Fast local gate for generated artifacts, package validation, and core regressions |
| `npm run validate` | Full repository validation gate |
| Benchmark reports | Frozen live evidence for workflow effect; failed or diagnostic runs are retained, not rescored |

Benchmark evidence is bounded. The latest v7 audit is a frozen FAIL: it identifies concrete routing, conformance, mutation-test, strict-review, telemetry, and runner compatibility gaps, but it does not prove release-gate success or general non-inferiority.

## Current risks

- Canonical source and generated packages can drift until `npm run generate:check` passes.
- Route wording must avoid example anchoring while still producing exactly one concrete owner and risk.
- Candidate-authored tests must kill semantic fault-family members, not merely pass visible behavior.
- DEBUG repair recovery and final reproduction attribution remain easy to violate.
- Strict work cannot pass without a fresh independent read-only review.
- Learning storage must remain local, bounded, schema-valid, and confined even under worktrees or concurrent writes.
- Future benchmark claims require newly frozen unseen cases; old failed runs are calibration evidence, not proof of success.
