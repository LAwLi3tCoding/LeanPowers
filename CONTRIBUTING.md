# Contributing to LeanPowers

LeanPowers values small, evidence-backed changes that preserve its core promise: less ceremony without weaker engineering gates.

## Before opening a change

- Search existing issues and pull requests.
- State the user-visible problem and the smallest affected boundary.
- Avoid new runtime dependencies, services, telemetry, or tracked repository-local state. `.leanpowers/` is the one opt-in private project state boundary and must remain untracked.
- Do not weaken scope, authorization, root-cause, regression, review, or verification gates to improve benchmark cost.
- For workflow changes, identify which benchmark scenario or regression case proves the need.

## Development setup

Requirements: Git and Node.js 20 or 22.

```bash
git clone https://github.com/LAwLi3tCoding/LeanPowers.git
cd LeanPowers
npm run validate
```

The project has no third-party Node dependencies. Installed runtime packages contain static manifests and Markdown, the exact two learning schemas, a bundled dependency-free Node.js learning helper, and the Claude POSIX shell hook. The six engineering workflows do not require Node.js; Node.js 20+ is required only after project learning is explicitly enabled.

## Source of truth

Edit canonical files only:

- `metadata/plugin.json` for identity and version metadata;
- `skills/` for the six portable engineering workflows and the `adapt` control Skill;
- `references/` for shared policies;
- `agent-specs/` for optional specialist semantics;
- `adapters/` for runtime-specific integration;
- `scripts/`, `schemas/`, `evals/`, and `tests/` for development tooling.

Do not hand-edit `plugins/codex/leanpowers`, `plugins/claude/leanpowers`, `.agents/plugins/marketplace.json`, or `.claude-plugin/marketplace.json`. Run:

```bash
npm run generate
```

Generated packages are committed so users can install the repository directly. Package-sync tests must remain green.

Runtime packages have an exact allowlisted file manifest. The learning capability includes only `schemas/learning-config.schema.json`, `schemas/lesson-event.schema.json`, and the three bundled helper modules under `skills/adapt/scripts/`. Do not add package files through broad directory copies. Validator probes are defense-in-depth for trusted local and build artifacts, not an OS sandbox for untrusted packages.

## Change workflow

1. Add or update a focused test or evaluation case before changing behavior.
2. Observe the expected failure where practical.
3. Make the smallest canonical-source change.
4. Run targeted tests immediately.
5. Regenerate packages if canonical plugin content changed.
6. Run the full validation and release build once on the final revision.

```bash
npm run generate
npm run generate:check
npm test
npm run validate
npm run build
```

Do not commit `dist/`, `.leanpowers/`, local benchmark transcripts, credentials, or runtime state. The helper excludes `.leanpowers/` through local Git `info/exclude`; contributors must not add it to tracked fixtures or examples.

## Skill changes

LeanPowers has exactly six engineering workflows: `shape`, `build`, `debug`, `review`, `verify`, and `ship`, plus one event-driven `adapt` control Skill. `adapt` is not a seventh engineering workflow. Prefer refining these boundaries or shared references over adding another engineering workflow or control plane.

Each `SKILL.md` must:

- use only `name` and `description` frontmatter;
- keep its trigger description distinct;
- stay at or below 800 words for engineering workflows; keep `adapt` at or below 400 words;
- preserve the six-workflow total at or below 5,000 words;
- link shared policy instead of copying it;
- define observable output and transitions;
- include a forward test showing the intended judgment.

## Benchmark changes

Comparator, routing, and learning-policy changes need deterministic fixtures, including a negative or hard-failure case. All checked-in scorer fixtures use simulated provenance and are diagnostic only. Do not relabel fixture results as live evidence. Release claims require the complete, paired, blind protocol in [docs/benchmark.md](docs/benchmark.md), including the four-turn feedback-learning scenario.

Never tune the scorer or evaluator to hide a candidate regression. Hard failures must dominate aggregate efficiency.

## Pull request checklist

- [ ] The change is scoped and has a clear acceptance condition.
- [ ] Canonical source was edited; generated packages were regenerated.
- [ ] `npm run validate` passes on the final revision.
- [ ] `npm run build` succeeds and artifacts were inspected.
- [ ] New behavior has regression or evaluation evidence.
- [ ] Documentation and examples match actual CLI commands.
- [ ] No credentials, private data, local state, or unrelated files are included.
- [ ] Validation gaps and remaining risks are stated explicitly.

By contributing, you agree that your contribution is licensed under the MIT License.
