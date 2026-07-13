# LeanPowers V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan in the current session. Track each delivery slice with the plan tool and verify before advancing.

**Goal:** Build and publish a dependency-free dual-runtime LeanPowers plugin whose six risk-adaptive workflows install in Codex and Claude Code and whose quality and efficiency contracts are executable and testable.

**Architecture:** Canonical metadata, skills, policies, and agent briefs live once at the repository root. A dependency-free Node.js generator produces committed Codex and Claude Code plugin packages plus both marketplace manifests. Node's built-in test runner validates skills, routing rules, evidence contracts, package parity, and benchmark scoring; the installed plugin itself consists only of static manifests, Markdown, and shell hooks.

**Tech Stack:** Agent Skills Markdown, JSON manifests and schemas, POSIX shell for the Claude startup hook, Node.js 20+ ESM development scripts, `node:test`, Git, Codex CLI, Claude Code CLI, optional Agent Workflow Benchmark integration.

## Global Constraints

- Plugin ID is exactly `leanpowers`.
- Product copy is `轻量但不降级的 Agent 工程工作流` and `Essential workflows. Less ceremony.`
- Core user-facing skills are exactly `shape`, `build`, `debug`, `review`, `verify`, and `ship`.
- Codex and Claude Code are first-class; other Agent Skills runtimes receive the portable skills only.
- Basic installed use requires no Node.js, MCP server, daemon, or network access.
- Codex receives zero SessionStart injection.
- Claude's SessionStart charter is at most 200 words and uses only a command hook.
- Each `SKILL.md` is at most 800 words and all six total at most 5,000 words.
- Default execution is single-agent; subagents are risk-triggered and one level deep.
- No telemetry and no repository-local runtime state by default.
- Generated plugin packages are committed and package-sync tests must fail on drift.
- Quality comparison uses Superpowers 6.1.1 as the initial baseline.

---

## File map

### Canonical source

- `metadata/plugin.json`: single version, product copy, author, repository, marketplace, and interface metadata source.
- `references/*.md`: risk, quality, evidence, transition, and subagent contracts.
- `skills/{shape,build,debug,review,verify,ship}/SKILL.md`: six portable workflows.
- `agent-specs/{reviewer,verifier}.md`: canonical optional specialist instructions.
- `adapters/claude/session-start`: compact Claude routing charter hook.
- `adapters/codex/*.toml`: optional Codex agent templates.

### Development tooling

- `scripts/lib/project.mjs`: paths, metadata loading, stable JSON, recursive copy, and word-count helpers.
- `scripts/lib/routing.mjs`: executable structured risk and initial-workflow oracle for tests and benchmark fixtures.
- `scripts/lib/evidence.mjs`: evidence schema validation and invalidation decisions.
- `scripts/lib/benchmark.mjs`: paired-result non-inferiority and efficiency scoring.
- `scripts/generate.mjs`: build or check both plugin packages and marketplace manifests.
- `scripts/validate-package.mjs`: validate installable package structure and content budgets.
- `scripts/benchmark.mjs`: score paired benchmark result files and produce JSON/Markdown reports.
- `scripts/build-release.mjs`: copy validated installable packages into `dist/` from any working directory.

### Generated installables

- `plugins/codex/leanpowers/**`: Codex plugin without Claude hooks or agents.
- `plugins/claude/leanpowers/**`: Claude Code plugin with skills, agents, and compact hook.
- `.agents/plugins/marketplace.json`: Codex marketplace pointing at `plugins/codex/leanpowers`.
- `.claude-plugin/marketplace.json`: Claude marketplace pointing at `plugins/claude/leanpowers`.

### Tests and evaluation

- `tests/generator.test.mjs`: metadata and deterministic generated-output tests.
- `tests/skills.test.mjs`: skill names, frontmatter, references, budgets, and hard-invariant coverage.
- `tests/routing.test.mjs`: lean, standard, strict, and escalation fixture coverage.
- `tests/evidence.test.mjs`: evidence validation and revision invalidation.
- `tests/packages.test.mjs`: Codex/Claude structure, isolation, and source-package parity.
- `tests/benchmark.test.mjs`: non-inferiority and hard-failure scoring.
- `evals/routing-cases.json`: deterministic structured routing cases.
- `evals/benchmark-suite.json`: paired workflow scenario catalog.
- `evals/fixtures/*.json`: passing, quality-regression, efficiency-regression, and critical-escape results.
- `evals/awb/leanpowers-target.draft.yaml`: reviewable Agent Workflow Benchmark target draft.

### Documentation

- `README.md`, `README.zh-CN.md`: install, use, workflow, comparison, and development guides.
- `docs/comparison-superpowers.md`: evidence-backed feature and cost comparison.
- `docs/benchmark.md`: paired evaluation method, result schema, commands, and release gates.
- `docs/migration.md`: Superpowers mapping, coexistence, and cutover instructions.
- `SECURITY.md`, `CONTRIBUTING.md`, `LICENSE`: project governance.

---

### Task 1: Canonical metadata and deterministic dual-package generator

**Files:**

- Create: `package.json`
- Create: `metadata/plugin.json`
- Create: `scripts/lib/project.mjs`
- Create: `scripts/generate.mjs`
- Create: `tests/generator.test.mjs`
- Generate: `.agents/plugins/marketplace.json`
- Generate: `.claude-plugin/marketplace.json`
- Generate: `plugins/codex/leanpowers/.codex-plugin/plugin.json`
- Generate: `plugins/claude/leanpowers/.claude-plugin/plugin.json`

**Interfaces:**

- Produces `readMetadata(): Promise<PluginMetadata>`.
- Produces `stableJson(value): string` ending in one newline.
- Produces `buildArtifacts({ check: boolean }): Promise<{ changed: string[] }>`.
- `npm run generate` writes artifacts; `npm run generate:check` exits non-zero when generated files drift.

- [ ] **Step 1: Write failing generator tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readMetadata, stableJson } from "../scripts/lib/project.mjs";

test("canonical metadata uses the LeanPowers identity", async () => {
  const metadata = await readMetadata();
  assert.equal(metadata.id, "leanpowers");
  assert.match(metadata.version, /^\d+\.\d+\.\d+$/);
  assert.equal(metadata.tagline, "Essential workflows. Less ceremony.");
});

test("stableJson is deterministic and newline terminated", () => {
  assert.equal(stableJson({ b: 2, a: 1 }), '{\n  "a": 1,\n  "b": 2\n}\n');
});
```

- [ ] **Step 2: Run the test and confirm the missing-module failure**

Run: `node --test tests/generator.test.mjs`

Expected: FAIL because `scripts/lib/project.mjs` does not exist.

- [ ] **Step 3: Implement the minimal metadata and generator foundation**

`package.json` must expose:

```json
{
  "name": "leanpowers",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "generate": "node scripts/generate.mjs",
    "generate:check": "node scripts/generate.mjs --check",
    "test": "node --test",
    "validate": "npm run generate:check && node scripts/validate-package.mjs && node --test",
    "build": "node scripts/build-release.mjs"
  }
}
```

`metadata/plugin.json` must use `0.1.0`, repository `https://github.com/LAwLi3tCoding/LeanPowers`, marketplace ID `leanpowers`, category `Developer Tools`, and no placeholder fields.

`stableJson` must recursively sort object keys. `buildArtifacts` must generate the two runtime manifests and marketplace entries from metadata without third-party packages.

- [ ] **Step 4: Run tests and generate initial artifacts**

Run: `node --test tests/generator.test.mjs && npm run generate`

Expected: tests PASS and four manifest or marketplace files are written.

- [ ] **Step 5: Verify deterministic generation**

Run: `npm run generate:check`

Expected: exit 0 and `Generated artifacts are current.`

- [ ] **Step 6: Commit the foundation**

```bash
git add package.json metadata scripts tests .agents .claude-plugin plugins
git commit -m "feat: add dual-runtime plugin generator"
```

---

### Task 2: Shared policy core and six portable skills

**Files:**

- Create: `references/risk-policy.md`
- Create: `references/quality-gates.md`
- Create: `references/evidence-protocol.md`
- Create: `references/subagent-policy.md`
- Create: `references/workflow-transitions.md`
- Create: `skills/{shape,build,debug,review,verify,ship}/SKILL.md`
- Create: `tests/skills.test.mjs`

**Interfaces:**

- Each skill frontmatter contains only `name` and `description`; runtime and license metadata belong at plugin level.
- Each workflow declares `Use when`, `Do not use when`, `Inputs`, `Workflow`, `Hard gates`, `Output`, and `Transitions`.
- Shared references are addressed as `../../references/<file>.md` from skill directories.

- [ ] **Step 1: Write failing skill-contract tests**

The tests must assert:

```js
const expected = ["build", "debug", "review", "shape", "ship", "verify"];
assert.deepEqual(discoveredSkillNames, expected);
assert.ok(eachSkillWords <= 800);
assert.ok(totalSkillWords <= 5000);
assert.ok(allDescriptionsAreDistinct);
assert.ok(noPlaceholders);
assert.ok(allReferencedSharedFilesExist);
```

They must also require coverage of these invariant phrases across the source set: current evidence, root cause, regression evidence, declared scope, independent review, authorization, and validation gap.

- [ ] **Step 2: Run tests and confirm discovery failure**

Run: `node --test tests/skills.test.mjs`

Expected: FAIL because the six skills do not exist.

- [ ] **Step 3: Write shared policies**

The risk policy must define `lean`, `standard`, `strict`, highest-signal-wins behavior, upgrade signals, and strict fallback. The quality policy must contain the eight approved hard invariants. Evidence and subagent policies must implement the approved budgets and invalidation rules without creating repository-local state by default.

- [ ] **Step 4: Write all six skills**

Keep each workflow focused on one responsibility and link shared material rather than copying it. Preserve these primary outputs:

```text
shape  -> goal, scope, acceptance, constraints, risk, slices
build  -> changed files, slice results, targeted evidence, residual risks
debug  -> reproduction, evidence, hypothesis, experiment, root cause, fix proof
review -> pass or changes_required plus evidence-backed findings
verify -> claim-to-command evidence and explicit gaps
ship   -> delivered branch, commit, PR, package, or external target readback
```

- [ ] **Step 5: Run skill tests**

Run: `node --test tests/skills.test.mjs`

Expected: PASS with six skills under all word budgets.

- [ ] **Step 6: Regenerate packages and commit**

Run: `npm run generate && npm run generate:check`

```bash
git add skills tests plugins
git commit -m "feat: add risk-adaptive core workflows"
```

---

### Task 3: Runtime-native adapters, hooks, and optional agents

**Files:**

- Create: `agent-specs/reviewer.md`
- Create: `agent-specs/verifier.md`
- Create: `adapters/claude/session-start`
- Create: `adapters/claude/hooks.json`
- Create: `adapters/codex/agents/reviewer.toml`
- Create: `adapters/codex/agents/verifier.toml`
- Create: `tests/packages.test.mjs`
- Generate: `plugins/claude/leanpowers/agents/*.md`
- Generate: `plugins/claude/leanpowers/hooks/*`
- Generate: `plugins/codex/leanpowers/skills/**`

**Interfaces:**

- Claude hook emits valid SessionStart JSON with no more than 200 words of additional context.
- Codex package contains no `hooks/` or Claude `agents/` directory.
- Claude agents derive from canonical briefs.
- Optional Codex TOML templates contain `name`, `description`, and `developer_instructions` but are not required for plugin operation.

- [ ] **Step 1: Write failing runtime-isolation tests**

Tests must assert:

```js
assert.equal(existsSync("plugins/codex/leanpowers/hooks"), false);
assert.equal(existsSync("plugins/codex/leanpowers/agents"), false);
assert.equal(existsSync("plugins/claude/leanpowers/hooks/hooks.json"), true);
assert.equal(existsSync("plugins/claude/leanpowers/agents/reviewer.md"), true);
assert.ok(sessionCharterWordCount <= 200);
```

The hook execution test must set `CLAUDE_PLUGIN_ROOT` to the generated Claude package, run `hooks/session-start`, parse stdout as JSON, and verify `hookSpecificOutput.hookEventName === "SessionStart"`.

- [ ] **Step 2: Run tests and confirm missing-adapter failure**

Run: `node --test tests/packages.test.mjs`

Expected: FAIL because the runtime-specific assets do not exist.

- [ ] **Step 3: Implement canonical agent briefs and compact hook**

Reviewer must produce findings-first output and reject unsupported claims. Verifier must map each claim to current evidence and never treat unavailable checks as passes. The hook must only inject routing guidance; it must not scan, write, access network, or dispatch agents.

- [ ] **Step 4: Extend generator for runtime-specific packages**

The Codex output includes `.codex-plugin`, skills, README files, and LICENSE. The Claude output includes `.claude-plugin`, skills, agents, hooks, README files, and LICENSE. Generated copies are replaced atomically and deterministic checks compare complete file contents.

- [ ] **Step 5: Run adapter tests and plugin validation**

Run:

```bash
npm run generate
node --test tests/packages.test.mjs
python3 ${HOME}/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/codex/leanpowers
```

Expected: all checks PASS.

- [ ] **Step 6: Commit adapters**

```bash
git add agent-specs adapters tests plugins
git commit -m "feat: add native Codex and Claude adapters"
```

---

### Task 4: Executable routing, evidence, and benchmark contracts

**Files:**

- Create: `scripts/lib/routing.mjs`
- Create: `scripts/lib/evidence.mjs`
- Create: `scripts/lib/benchmark.mjs`
- Create: `scripts/benchmark.mjs`
- Create: `schemas/evidence.schema.json`
- Create: `schemas/benchmark-result.schema.json`
- Create: `evals/routing-cases.json`
- Create: `evals/benchmark-suite.json`
- Create: `evals/fixtures/baseline-pass.json`
- Create: `evals/fixtures/leanpowers-pass.json`
- Create: `evals/fixtures/quality-regression.json`
- Create: `evals/fixtures/critical-escape.json`
- Create: `tests/routing.test.mjs`
- Create: `tests/evidence.test.mjs`
- Create: `tests/benchmark.test.mjs`

**Interfaces:**

- `classifyRisk(signals): "lean" | "standard" | "strict"`.
- `selectInitialWorkflow({ causeKnown, needsShaping, deliveryOnly }): SkillName`.
- `validateEvidence(entry): string[]` returns validation errors.
- `evidenceRemainsValid(entry, revision): boolean`.
- `compareRuns(baseline, candidate): BenchmarkDecision` returns `PASS`, `BLOCK`, or `DIAGNOSTIC_ONLY` with dimension scores and reasons.

- [ ] **Step 1: Write failing routing tests**

Fixtures must cover at least clear local edits, ordinary features, unknown defects, public API changes, security changes, production actions, verification failure, and scope expansion. Highest applicable signal must win.

- [ ] **Step 2: Write failing evidence and benchmark tests**

Required assertions:

```js
assert.equal(evidenceRemainsValid(entry, sameRevision), true);
assert.equal(evidenceRemainsValid(entry, changedRevision), false);
assert.equal(compareRuns(passBaseline, passCandidate).decision, "PASS");
assert.equal(compareRuns(passBaseline, criticalEscape).decision, "BLOCK");
assert.equal(compareRuns(passBaseline, missingLiveEvidence).decision, "DIAGNOSTIC_ONLY");
```

- [ ] **Step 3: Run tests and confirm missing-module failures**

Run: `node --test tests/routing.test.mjs tests/evidence.test.mjs tests/benchmark.test.mjs`

Expected: FAIL because the policy modules do not exist.

- [ ] **Step 4: Implement the smallest deterministic policy oracles**

Routing accepts structured signals rather than pretending to perform natural-language classification. Benchmark hard failures must dominate aggregate scores. Simulated or incomplete runs cannot produce a release PASS.

- [ ] **Step 5: Implement benchmark CLI output**

Command:

```bash
node scripts/benchmark.mjs compare \
  --baseline evals/fixtures/baseline-pass.json \
  --candidate evals/fixtures/leanpowers-pass.json \
  --out reports/benchmark-smoke
```

It must write `comparison.json` and `comparison.md` with decision, quality deltas, efficiency deltas, hard failures, and recommendations.

- [ ] **Step 6: Run policy and benchmark tests**

Run: `node --test tests/routing.test.mjs tests/evidence.test.mjs tests/benchmark.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit executable contracts**

```bash
git add scripts schemas evals tests
git commit -m "feat: add workflow quality and benchmark contracts"
```

---

### Task 5: Package validation, release build, and complete documentation

**Files:**

- Create: `scripts/validate-package.mjs`
- Create: `scripts/build-release.mjs`
- Create: `README.md`
- Create: `README.zh-CN.md`
- Create: `docs/comparison-superpowers.md`
- Create: `docs/benchmark.md`
- Create: `docs/migration.md`
- Create: `SECURITY.md`
- Create: `CONTRIBUTING.md`
- Create: `LICENSE`
- Create: `.github/workflows/ci.yml`
- Create: `evals/awb/leanpowers-target.draft.yaml`

**Interfaces:**

- `npm run validate` checks generated drift, plugin structure, budgets, placeholders, tests, and runtime isolation.
- `npm run build` writes `dist/codex/leanpowers` and `dist/claude/leanpowers` from any current working directory.
- Documentation provides direct GitHub marketplace install commands for both runtimes.

- [ ] **Step 1: Write package validation expectations into tests**

Extend package tests to reject missing README or LICENSE files, absolute paths, placeholder text, version drift, source-only files in packages, and Claude hooks in the Codex package.

- [ ] **Step 2: Implement validator and release builder**

The validator prints one error per line and exits 1 on any error. The release builder runs generation check and validation before replacing `dist/`, then prints both absolute artifact paths.

- [ ] **Step 3: Write complete bilingual documentation**

README documents identity, installation, automatic routing, explicit commands, six skills, modes, examples, comparison summary, privacy, development, and benchmark commands. Migration documentation explicitly warns that automatic LeanPowers and Superpowers routing should not run simultaneously.

- [ ] **Step 4: Create AWB onboarding draft**

Run:

```bash
${HOME}/.codex/plugins/cache/agent-workflow-benchmark/agent-workflow-benchmark/0.1.0+codex.20260706202456/bin/awb \
  init-target --agent-root plugins/codex/leanpowers --target-id leanpowers \
  --name LeanPowers --target-type directory \
  --out evals/awb/leanpowers-target.draft.yaml \
  --gaps-out evals/awb/leanpowers-target.gaps.md
```

Review the generated gaps and refine only repository-owned draft files. Do not modify the installed AWB runtime.

- [ ] **Step 5: Add CI**

CI uses Node 20 and 22, runs `npm run validate`, builds release artifacts, and uploads both artifact directories for inspection.

- [ ] **Step 6: Run the full local verification bundle**

Run:

```bash
npm run validate
npm run build
python3 ${HOME}/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py dist/codex/leanpowers
git diff --check
```

Expected: all commands PASS.

- [ ] **Step 7: Commit documentation and release tooling**

```bash
git add scripts tests README.md README.zh-CN.md docs SECURITY.md CONTRIBUTING.md LICENSE .github evals plugins
git commit -m "docs: complete LeanPowers distribution and evaluation guide"
```

---

### Task 6: Installed-runtime smoke tests, independent review, and GitHub publication

**Files:**

- Modify only files required by smoke-test or review findings.
- Create local-only temporary plugin homes under `/tmp`; do not commit them.

**Interfaces:**

- Codex marketplace install resolves `leanpowers@leanpowers` to the generated Codex package.
- Claude marketplace validation resolves the generated Claude package.
- The remote repository is `LAwLi3tCoding/LeanPowers`.

- [ ] **Step 1: Test Codex installation in an isolated home**

Run with a temporary `CODEX_HOME`:

```bash
codex plugin marketplace add ${HOME}/github-code/LeanPowers --json
codex plugin add leanpowers@leanpowers --json
codex plugin list --json
```

Expected: LeanPowers is installed from `plugins/codex/leanpowers` and all six skills are present in the cached package.

- [ ] **Step 2: Validate Claude package when the CLI is available**

Run: `claude plugin validate plugins/claude/leanpowers`

Expected: PASS. If the installed Claude CLI lacks this command, record the exact gap and rely on structure plus hook execution tests.

- [ ] **Step 3: Run an independent code and workflow review**

Review requirements, generated-package drift, runtime isolation, hook safety, route coverage, benchmark hard failures, documentation commands, and actual install paths. Fix high and medium findings and re-run targeted checks.

- [ ] **Step 4: Run final verification on the final revision**

Run:

```bash
npm run validate
npm run build
python3 ${HOME}/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py dist/codex/leanpowers
git status --short
git log --oneline --decorate -8
```

Expected: all validation commands PASS and only intentional untracked or generated artifacts remain.

- [ ] **Step 5: Create the GitHub repository and push**

After confirming an authenticated GitHub path, create a public repository with description `Lightweight, high-rigor engineering workflows for Codex and Claude Code.` Set `origin`, push `main`, and read back the remote default branch and latest commit.

Preferred CLI path when authenticated:

```bash
gh repo create LAwLi3tCoding/LeanPowers --public --source=. --remote=origin --push \
  --description "Lightweight, high-rigor engineering workflows for Codex and Claude Code."
gh repo view LAwLi3tCoding/LeanPowers --json nameWithOwner,url,defaultBranchRef,description
```

- [ ] **Step 6: Report delivery evidence**

Report the repository URL, final commit SHA, validation commands, install paths, benchmark status, and any live-run gap without claiming unexecuted evidence.
