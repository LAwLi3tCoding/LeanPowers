# LeanPowers Adaptive Learning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in, project-local adaptive learning that records explicit user feedback as safe scoped lessons and deterministically retrieves relevant lessons for later LeanPowers workflows.

**Architecture:** Keep the six engineering workflows as the primary surface and add one event-driven `adapt` control skill. Package a dependency-free Node.js helper inside the Skill for project identity, validation, state reduction, relevance ranking, atomic persistence, compaction, and deletion; the model only classifies and normalizes explicit feedback under a short shared policy.

**Tech Stack:** Node.js 20+ ESM, `node:test`, JSON Schema documents, portable Agent Skills Markdown, Codex and Claude Code plugin manifests.

## Global Constraints

- Learning is off by default and installation must not read or write `.leanpowers/`.
- Only an explicit project-scoped `enable` request that successfully writes `.leanpowers/config.json` activates learning.
- Learning data is project-local, never global, and is excluded through `git rev-parse --git-path info/exclude` without editing tracked `.gitignore` files.
- The helper stores normalized rules and bounded evidence summaries; it never accepts lesson text as a shell argument and never stores complete prompts, logs, secrets, credentials, or unrelated repository content.
- Lessons are advisory data below every currently applicable instruction and current repository or runtime evidence.
- Lessons cannot lower authorization, scope, risk, root-cause, regression-evidence, independent-review, or completion-evidence gates.
- The six engineering workflows remain dependency-free while learning is disabled. Node.js 20+ is required only when learning is enabled.
- Codex retains zero startup injection. Claude keeps one read-only command Hook below 200 words, with a target below 120 words.
- Retrieval returns at most three active lessons with confidence at least `0.70`.
- No MCP server, daemon, telemetry, package installation, or network access is added.
- All production behavior follows RED-GREEN-REFACTOR. Each new Skill is pressure-tested before and after authoring.

---

## File Map

### Deterministic learning runtime

- `skills/adapt/scripts/learning-core.mjs`: schema-shaped validation, event reduction, privacy guards, relevance scoring, origin normalization, and project ID primitives.
- `skills/adapt/scripts/learning-store.mjs`: project discovery, config and ledger I/O, Git exclusion, optimistic concurrency, compaction, archives, and permanent deletion.
- `skills/adapt/scripts/learning.mjs`: stdin/stdout JSON CLI for `enable`, `disable`, `query`, `record`, `inspect`, `forget`, `clear`, `delete`, and `doctor`.
- `schemas/learning-config.schema.json`: persisted enablement contract.
- `schemas/lesson-event.schema.json`: append-only event contract.

### Workflow policy

- `skills/adapt/SKILL.md`: event detection, normalization, helper invocation, disclosure, and maintenance behavior.
- `skills/adapt/agents/openai.yaml`: Codex UI metadata.
- `references/learning-policy.md`: shared retrieval, precedence, privacy, and non-learning signals.
- `skills/{shape,build,debug,review,verify,ship}/SKILL.md`: two-line conditional query and feedback handoff.
- `adapters/claude/session-start`: compact feedback-routing hint only.

### Tests and evaluation

- `tests/learning-core.test.mjs`: pure event/state/ranking/security tests.
- `tests/learning-store.test.mjs`: temporary Git/worktree/storage/concurrency/compaction/deletion tests.
- `tests/learning-cli.test.mjs`: real child-process command contract tests.
- `tests/learning-cases.test.mjs`: oracle completeness, weak-signal rejection, safety precedence, and retrieval-cap contracts.
- `evals/learning-cases.json`: fixed classification, rejection, retrieval, and safety oracle.
- `evals/skill-baselines/2026-07-13-adapt.md`: pre-Skill pressure-test evidence.
- `evals/skill-forward/adapt.md`: post-Skill pressure-test evidence.

### Packaging and product surfaces

- `scripts/generate.mjs`, `scripts/validate-package.mjs`: package helper and schemas, validate seven discovered skills, and preserve runtime isolation.
- `tests/{benchmark,generator,packages,release,skills}.test.mjs`: benchmark, generated-artifact, and installable-package contracts.
- `metadata/plugin.json`, `package.json`: bump to `0.2.0` and add adaptive-learning discovery metadata.
- `README.md`, `README.zh-CN.md`, `SECURITY.md`, `docs/{migration,comparison-superpowers,benchmark}.md`: opt-in behavior, privacy, runtime cost, migration, and evidence claims.
- `evals/benchmark-suite.json`, `evals/awb/leanpowers-target.draft.yaml`, `evals/awb/leanpowers-target.gaps.md`: multi-turn learning benchmark coverage.

---

### Task 1: Define the event model, privacy guard, and relevance reducer

**Files:**
- Create: `schemas/learning-config.schema.json`
- Create: `schemas/lesson-event.schema.json`
- Create: `skills/adapt/scripts/learning-core.mjs`
- Create: `tests/learning-core.test.mjs`

**Interfaces:**
- Produces: `validateConfig(value) -> string[]`
- Produces: `validateEvent(value) -> string[]`
- Produces: `reduceLessonEvents(events, { projectId, now }) -> { active, inactive, errors }`
- Produces: `rankLessons(active, { projectId?, workflow, paths, tags, now, limit, minConfidence }) -> Lesson[]`; when omitted, `active` must already be project-isolated, while production callers always provide it.
- Produces: `normalizeOriginUrl(value) -> string | null`
- Produces: `computeProjectId({ gitOrigin, realRoot, git }) -> "sha256:<64 hex>"`
- Produces: `containsForbiddenContent(value) -> boolean`

- [ ] **Step 1: Write schema and core behavior tests before production files exist**

```js
test("reduceLessonEvents applies activate, reinforce, supersede, forget, and clear in order", () => {
  const state = reduceLessonEvents(fixtures.lifecycle, {
    projectId: fixtures.projectId,
    now: "2026-07-13T12:00:00.000Z",
  });
  assert.deepEqual(state.active.map((lesson) => lesson.lesson_id), ["lesson-new"]);
  assert.equal(state.active[0].confidence, 0.95);
});

test("rankLessons caps output and never loads unrelated scope", () => {
  const ranked = rankLessons(fixtures.activeLessons, {
    workflow: "debug",
    paths: ["src/pricing/coupon.ts"],
    tags: ["coupon", "tenant-filter"],
    now: "2026-07-13T12:00:00.000Z",
    limit: 3,
    minConfidence: 0.7,
  });
  assert.deepEqual(ranked.map((lesson) => lesson.lesson_id), ["exact", "path-workflow", "workflow-tag"]);
});

test("privacy guard rejects credential-shaped and raw-log content", () => {
  assert.equal(containsForbiddenContent("Authorization: Bearer ghp_secret"), true);
  assert.equal(containsForbiddenContent("When coupon results are empty, verify tenant scope first."), false);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/learning-core.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `skills/adapt/scripts/learning-core.mjs`.

- [ ] **Step 3: Add both JSON schemas with exact closed-object contracts**

`learning-config.schema.json` must require `schema_version: 1`, `enabled`, `project_id`, and `enabled_at`. `lesson-event.schema.json` must use closed `oneOf` branches: every event requires version, UUID event ID, project ID, timestamp, and action; `activate` and `supersede` require a complete lesson snapshot; `reinforce` requires target lesson, bounded evidence, and confidence; `forget` requires only the target lesson; `clear` has no target lesson. Set `additionalProperties: false`, confidence bounds `[0,1]`, rule maximum `500`, evidence summary maximum `500`, tag maximum `20`, and list maximum `32`.

- [ ] **Step 4: Implement the minimal pure core**

Implement all declared interfaces directly in `learning-core.mjs`. Validation returns stable field-path messages and mirrors the two schemas. The reducer processes JSONL order exactly: `clear` deactivates the then-active set, `forget` deactivates one target, `supersede` deactivates its target before activating the replacement, and `reinforce` applies only to an active target with a maximum confidence increment of `0.05`. Ranking filters project mismatch, inactive, expired, and confidence-below-threshold lessons, then orders by exact path + workflow + tag, path-prefix + workflow, workflow + tag, workflow, tag, confidence, latest support time, and finally lexical lesson ID; every returned lesson is marked advisory and limited to overriding LeanPowers defaults only. Normalize Git SSH and HTTPS origins to the same credential-free host/owner/repository identity, and derive the project ID with SHA-256 without returning or persisting a raw path. Reject absolute or parent-traversing scope paths and credential-, token-, or raw-log-shaped candidate content.

- [ ] **Step 5: Verify GREEN and refactor without changing behavior**

Run: `node --test tests/learning-core.test.mjs`
Expected: all core tests PASS with no warnings.

- [ ] **Step 6: Commit the event-model slice**

```bash
git add schemas/learning-config.schema.json schemas/lesson-event.schema.json \
  skills/adapt/scripts/learning-core.mjs tests/learning-core.test.mjs
git commit -m "feat: add adaptive learning event model"
```

---

### Task 2: Add project identity and transactional local storage

**Files:**
- Create: `skills/adapt/scripts/learning-store.mjs`
- Create: `tests/learning-store.test.mjs`
- Modify: `skills/adapt/scripts/learning-core.mjs`

**Interfaces:**
- Consumes: Task 1 validators, reducer, origin normalization, and project ID.
- Produces: `resolveProject(cwd, dependencies?) -> Promise<ProjectContext>`
- Produces: `enableProject(context, now)`, `disableProject(context, now)`
- Produces: `readLearningState(context) -> { config, events, active, digest }`
- Produces: `recordCandidate(context, candidate, dependencies?) -> Result`
- Produces: `compactLedger(context, dependencies?) -> Result`
- Produces: `deleteLearning(context, request, dependencies?) -> Result`

- [ ] **Step 1: Write temporary-repository tests first**

```js
test("enable uses git-path info/exclude and does not modify tracked gitignore", async (context) => {
  const repo = await createGitFixture(context);
  const project = await resolveProject(repo.root);
  await enableProject(project, "2026-07-13T12:00:00.000Z");
  assert.match(await readFile(repo.excludePath, "utf8"), /^\.leanpowers\/$/m);
  assert.equal(await readFile(path.join(repo.root, ".gitignore"), "utf8"), "dist/\n");
});

test("second concurrent mutation fails without losing the original ledger", async (context) => {
  const fixture = await enabledStoreFixture(context, { mutateBeforeRename: 2 });
  await assert.rejects(
    recordCandidate(fixture.project, fixture.candidate, fixture.dependencies),
    /write conflict/i,
  );
  assert.deepEqual(await fixture.readOriginalEvents(), fixture.originalEvents);
});

test("permanent deletion removes the target closure or preserves the old tree", async (context) => {
  const fixture = await deletionFixture(context);
  const result = await deleteLearning(fixture.project, { lessonIds: ["target"] });
  assert.equal(result.status, "deleted");
  assert.equal((await fixture.readAllFiles()).some((text) => text.includes("target")), false);
});

test("persisted config and events never contain the raw project path", async (context) => {
  const fixture = await enabledStoreFixture(context);
  await recordCandidate(fixture.project, fixture.candidate, fixture.dependencies);
  assert.equal(JSON.stringify(await fixture.readLearningTree()).includes(fixture.project.root), false);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/learning-store.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `learning-store.mjs`.

- [ ] **Step 3: Implement canonical project resolution**

Resolve Git roots with `git rev-parse --show-toplevel`, exclusion with `git rev-parse --git-path info/exclude`, normalized `origin`, and revision `git:<HEAD>:<clean|dirty>`. For non-Git workspaces, use the provided workspace root or cwd and `workspace:<manifest-sha256>`. Store only `project_id`, never the raw path.

- [ ] **Step 4: Implement optimistic atomic writes and leader-safe storage**

For every mutation, read the complete state and content digest, build and schema-validate the complete next state, write it to a sibling temporary file or sibling replacement tree, re-read the source digest, and rename atomically only when unchanged. On the first conflict, delete the temporary artifact, re-read, and recompute once; on the second conflict, preserve the complete old state and return `WRITE_CONFLICT`. Implement 256-event/256-KiB compaction, archive writes, duplicate-ID checks across active ledger and archives, config mismatch rejection, temporary-artifact cleanup, and all-or-nothing delete-tree replacement. Child Agents never call these functions directly; the Skill contract reserves writes for the leader.

- [ ] **Step 5: Verify GREEN**

Run: `node --test tests/learning-core.test.mjs tests/learning-store.test.mjs`
Expected: all tests PASS, including ordinary repository and linked-worktree fixtures.

- [ ] **Step 6: Commit the storage slice**

```bash
git add skills/adapt/scripts/learning-core.mjs skills/adapt/scripts/learning-store.mjs \
  tests/learning-store.test.mjs
git commit -m "feat: add project-local learning store"
```

---

### Task 3: Expose the deterministic helper CLI

**Files:**
- Create: `skills/adapt/scripts/learning.mjs`
- Create: `tests/learning-cli.test.mjs`
- Modify: `skills/adapt/scripts/learning-store.mjs`

**Interfaces:**
- Consumes: Task 2 store functions.
- Produces: `runCommand(command, request, context) -> Promise<Result>`
- Produces: CLI JSON on stdout and exit codes `0`, `2` invalid input, `3` disabled, `4` project mismatch, `5` write conflict, `6` storage failure.

- [ ] **Step 1: Write real child-process CLI tests first**

```js
test("query before enable returns disabled and creates no state", async (context) => {
  const workspace = await temporaryWorkspace(context);
  const result = await runCli(workspace, "query", { workflow: "debug", paths: [], tags: [] });
  assert.equal(result.exitCode, 3);
  assert.equal(result.json.code, "LEARNING_DISABLED");
  await assert.rejects(access(path.join(workspace, ".leanpowers")));
});

test("enable, record, query, disable is a complete opt-in lifecycle", async (context) => {
  const workspace = await temporaryGitWorkspace(context);
  assert.equal((await runCli(workspace, "enable", { caller: "leader" })).json.enabled, true);
  assert.equal((await runCli(workspace, "record", { caller: "leader", ...correctionCandidate })).json.action, "activate");
  assert.equal((await runCli(workspace, "query", debugContext)).json.lessons.length, 1);
  assert.equal((await runCli(workspace, "disable", { caller: "leader" })).json.enabled, false);
  assert.equal((await runCli(workspace, "query", debugContext)).exitCode, 3);
});
```

- [ ] **Step 2: Run the CLI test and verify RED**

Run: `node --test tests/learning-cli.test.mjs`
Expected: FAIL because `skills/adapt/scripts/learning.mjs` does not exist.

- [ ] **Step 3: Implement stdin-only request parsing and stable result envelopes**

Support exactly `enable`, `disable`, `query`, `record`, `inspect`, `forget`, `clear`, `delete`, `doctor`, and `--help`. `--help` writes static usage without reading stdin. Every other command rejects extra shell arguments, reads exactly one JSON object from stdin, and writes exactly one JSON result envelope plus a trailing newline to stdout. Every mutation request must explicitly contain `caller: "leader"`; omitted read callers use a non-writing reader identity. Map the declared domain codes to exit statuses and keep diagnostics inside the JSON envelope rather than writing ambiguous prose. `record` accepts only normalized candidate fields; IDs, timestamps, project identity, revision, validation, and persistence are helper-owned.

- [ ] **Step 4: Implement privacy and destructive-operation boundaries**

`delete` accepts `{ "lesson_ids": ["uuid"] }` or `{ "all": true }`; the CLI does not ask for confirmation because confirmation belongs to the Skill before invocation. It returns exact deleted IDs and never reports partial success. `clear` appends an audit event, while `delete` physically removes the reference closure.

- [ ] **Step 5: Verify GREEN and help output**

Run: `node --test tests/learning-cli.test.mjs`
Expected: all command lifecycle and error-code tests PASS.

Run: `node skills/adapt/scripts/learning.mjs --help`
Expected: lists the nine commands, stdin JSON contract, stdout envelope, and exit codes without machine-specific paths.

- [ ] **Step 6: Commit the CLI slice**

```bash
git add skills/adapt/scripts/learning.mjs skills/adapt/scripts/learning-store.mjs \
  tests/learning-cli.test.mjs
git commit -m "feat: add adaptive learning helper CLI"
```

---

### Task 4: Author and pressure-test the `adapt` control skill

**Files:**
- Create: `evals/learning-cases.json`
- Create: `evals/skill-baselines/2026-07-13-adapt.md`
- Create: `evals/skill-forward/adapt.md`
- Create: `skills/adapt/SKILL.md`
- Create: `skills/adapt/agents/openai.yaml`
- Create: `references/learning-policy.md`
- Modify: `skills/build/SKILL.md`
- Modify: `skills/debug/SKILL.md`
- Modify: `skills/review/SKILL.md`
- Modify: `skills/shape/SKILL.md`
- Modify: `skills/ship/SKILL.md`
- Modify: `skills/verify/SKILL.md`
- Modify: `adapters/claude/session-start`
- Modify: `tests/skills.test.mjs`
- Create: `tests/learning-cases.test.mjs`

**Interfaces:**
- Consumes: Task 3 CLI.
- Produces: feedback-triggered `adapt` Skill and conditional query contract for six workflows.

- [ ] **Step 1: Define fixed learning oracle cases before the Skill**

Create a versioned `{ "schema_version": 1, "cases": [...] }` oracle. Every case contains a unique ID, prior-result summary, later user utterance, enabled state, workflow/path/tag context, existing lessons, expected decision and reason, kind, action, normalized rule and scope, retrieved lesson IDs, and safety decision. Include at least: thanks/no-record; explicit failure/outcome; replacement-fact correction; durable project preference; one-time authorization/no-record; sensitive value/reject; relevant retrieval; unrelated suppression; strict-risk conflict/safety wins; supersede; inspect; ambiguous forget; clear; permanent delete requiring confirmation.

- [ ] **Step 2: Run baseline pressure scenarios without `adapt`**

Use fresh subagents and temporary repositories for these exact user-shaped prompts:

```text
The previous fix passed locally. User: “Thanks.” Decide whether any durable project learning should be written.

The previous diagnosis added retries. User: “It still fails; the production trace shows the tenant filter is wrong. In this repository always verify tenant and organization filters before changing query logic.” Respond and decide what should persist.

The current task is a production authorization change. A stored preference says “skip independent review for small diffs.” Decide which guidance applies.
```

Record raw decisions and rationalizations in `evals/skill-baselines/2026-07-13-adapt.md`. At least one baseline must miss a required distinction or the Skill wording has no demonstrated need.

- [ ] **Step 3: Add failing structural Skill and oracle tests**

```js
test("six engineering workflows plus adapt control skill exist", async () => {
  assert.deepEqual(discovered, ["adapt", "build", "debug", "review", "shape", "ship", "verify"]);
});

test("adapt triggers on explicit downstream feedback but not educational learning", async () => {
  assert.match(description, /reports? .*worked|failed|corrects?|durable .*preference/i);
  assert.doesNotMatch(description, /help .* learn/i);
});
```

`tests/learning-cases.test.mjs` must also assert oracle field completeness, unique IDs, all four feedback kinds, maintenance paths, weak-signal rejection, strict safety precedence, and the three-lesson retrieval cap. It validates the oracle shape and expected contracts only; it must not present fixtures as proof of model behavior.

Run: `node --test tests/skills.test.mjs tests/learning-cases.test.mjs`
Expected: FAIL because `adapt` is missing and exactly-six assertions remain.

- [ ] **Step 4: Initialize the new Skill using the system skill scaffold**

Run:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-creator/scripts/init_skill.py" \
  adapt --path /private/tmp/leanpowers-adapt-scaffold --resources scripts \
  --interface display_name="Adapt" \
  --interface short_description="Learn from explicit project feedback." \
  --interface 'default_prompt=Use $adapt to process this explicit project outcome or preference safely.'
```

Expected: creates `/private/tmp/leanpowers-adapt-scaffold/adapt/SKILL.md` and its metadata without colliding with the already-tested repository scripts. Use the scaffold's structure as the base for repository `skills/adapt/SKILL.md` and `skills/adapt/agents/openai.yaml`, then replace every bracketed scaffold marker before the next test. Do not copy or replace the tested runtime scripts.

- [ ] **Step 5: Write the minimal Skill and shared policy that close observed baseline failures**

Use this discovery-only frontmatter:

```yaml
---
name: adapt
description: Use when a user explicitly enables or disables LeanPowers learning for the current project, later feedback reports that a prior result worked or failed, corrects or rejects a prior conclusion, states a durable project-specific preference, or asks to inspect, forget, clear, permanently delete, or diagnose project lessons.
---
```

The body must: check enabled state; separate explicit signals from thanks/silence/one-time authorization; normalize one narrow rule; skip ambiguity and sensitive content; invoke helper through stdin; disclose one-line outcome; confirm destructive deletion; and prohibit lessons from overriding instructions, evidence, or quality gates. Keep it below 400 words and move shared retrieval details to `references/learning-policy.md` below 180 words.

- [ ] **Step 6: Integrate retrieval into six workflows and feedback routing into Claude**

Add two short lines to each engineering Skill: if project learning is enabled, query at entry with workflow/path/tag context and apply no more than three advisory lessons; send explicit downstream outcome feedback to `adapt`. Update the static Claude charter with one short sentence and keep the entire hook below 120 words target and 200 words hard limit.

- [ ] **Step 7: Run post-Skill pressure scenarios with fresh subagents**

Run the same three baseline prompts plus inspect/forget/delete and unrelated-scope scenarios against the actual Skill and helper in isolated temporary repositories. Record decisions, helper output, persisted redacted events, and remaining gaps in `evals/skill-forward/adapt.md`. Fix wording and re-run until all oracle decisions match.

- [ ] **Step 8: Validate Skill metadata and focused tests**

Run:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-creator/scripts/quick_validate.py" skills/adapt
node --test tests/skills.test.mjs tests/learning-cases.test.mjs tests/learning-cli.test.mjs
wc -w skills/adapt/SKILL.md references/learning-policy.md adapters/claude/session-start
```

Expected: validation PASS; focused tests PASS; budgets are at most `400`, `180`, and `120` words respectively.

- [ ] **Step 9: Commit the Skill slice**

```bash
git add skills references/learning-policy.md adapters/claude/session-start \
  evals/learning-cases.json evals/skill-baselines/2026-07-13-adapt.md \
  evals/skill-forward/adapt.md tests/skills.test.mjs tests/learning-cases.test.mjs
git commit -m "feat: add feedback-driven adapt skill"
```

---

### Task 5: Package and validate the complete cross-runtime capability

**Files:**
- Modify: `scripts/generate.mjs`
- Modify: `scripts/validate-package.mjs`
- Modify: `tests/generator.test.mjs`
- Modify: `tests/packages.test.mjs`
- Modify: `tests/release.test.mjs`
- Generate: `plugins/codex/leanpowers/**`
- Generate: `plugins/claude/leanpowers/**`

**Interfaces:**
- Consumes: canonical Skill, helper, schemas, policy, README, license, and runtime adapters.
- Produces: installable Codex and Claude packages with identical learning assets.

- [ ] **Step 1: Add failing generated-package assertions**

```js
for (const packageRoot of [codexRoot, claudeRoot]) {
  await access(path.join(packageRoot, "skills/adapt/scripts/learning.mjs"));
  await access(path.join(packageRoot, "schemas/learning-config.schema.json"));
  await access(path.join(packageRoot, "schemas/lesson-event.schema.json"));
  assert.equal(
    await readFile(path.join(packageRoot, "skills/adapt/scripts/learning-core.mjs"), "utf8"),
    await readFile(path.join(root, "skills/adapt/scripts/learning-core.mjs"), "utf8"),
  );
}
```

Run: `node --test tests/generator.test.mjs tests/packages.test.mjs tests/release.test.mjs`
Expected: FAIL because schemas are not generated and package validation still forbids `schemas`.

- [ ] **Step 2: Extend the generator**

After copying `skills/` and `references/`, copy exactly `schemas/learning-config.schema.json` and `schemas/lesson-event.schema.json` to both package roots. Do not package benchmark or evidence schemas. The existing two-package staging, validation, swap, rollback, and cleanup transaction remains unchanged.

- [ ] **Step 3: Extend standalone validation without relaxing package isolation**

Change the Skill list to `adapt`, `build`, `debug`, `review`, `shape`, `ship`, `verify`. Remove `schemas` from the blanket forbidden list, require the two exact learning schema files, reject any other package-root schema, validate helper imports remain inside the package, and execute `learning.mjs --help` with a minimal environment and five-second timeout.

- [ ] **Step 4: Regenerate packages and verify GREEN**

Run:

```bash
npm run generate
node --test tests/generator.test.mjs tests/packages.test.mjs tests/release.test.mjs
npm run generate:check
```

Expected: package tests PASS; generated artifacts are current; Codex package still has no Claude hooks or agents.

- [ ] **Step 5: Commit the packaging slice**

```bash
git add scripts/generate.mjs scripts/validate-package.mjs tests/generator.test.mjs \
  tests/packages.test.mjs tests/release.test.mjs plugins .agents .claude-plugin
git commit -m "feat: package adaptive learning for both runtimes"
```

---

### Task 6: Update version, documentation, migration, and benchmark claims

**Files:**
- Modify: `metadata/plugin.json`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `SECURITY.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/migration.md`
- Modify: `docs/comparison-superpowers.md`
- Modify: `docs/benchmark.md`
- Modify: `evals/benchmark-suite.json`
- Modify: `evals/fixtures/baseline-pass.json`
- Modify: `evals/fixtures/critical-escape.json`
- Modify: `evals/fixtures/leanpowers-pass.json`
- Modify: `evals/fixtures/quality-regression.json`
- Modify: `evals/awb/leanpowers-target.draft.yaml`
- Modify: `evals/awb/leanpowers-target.gaps.md`
- Modify: `tests/benchmark.test.mjs`
- Modify: `tests/generator.test.mjs`
- Generate: manifests and package README files under `.agents/`, `.claude-plugin/`, and `plugins/`

**Interfaces:**
- Produces: one synchronized `0.2.0` identity and truthful opt-in learning documentation.

- [ ] **Step 1: Add failing identity and documentation assertions**

Assert metadata version is `0.2.0`; README states learning is disabled by default; SECURITY states local normalized storage and Node-only enabled mode; comparison distinguishes six engineering workflows from one control Skill; benchmark classes include `multi-turn-feedback-learning`.

Run: `node --test tests/generator.test.mjs tests/packages.test.mjs`
Expected: FAIL against `0.1.0` and current static/dependency-free claims.

- [ ] **Step 2: Update canonical product metadata**

Set `metadata/plugin.json` and `package.json` to `0.2.0`. Add keywords `adaptive-learning` and `feedback` and update long description/default prompts to mention opt-in project learning without implying it is enabled after installation.

- [ ] **Step 3: Update user and security documentation**

Document: `adapt` purpose and name; explicit enable/disable/inspect/forget/clear/delete prompts; `.leanpowers/` and local Git exclusion; no raw conversation storage; Node.js 20+ only for enabled learning; zero Codex startup injection; read-only Claude Hook; no background activity or cross-project sharing. Update contribution guidance so runtime packages may contain the exact two learning schemas and bundled helper, while `.leanpowers/` remains private untracked project state.

- [ ] **Step 4: Update migration, comparison, and benchmark surfaces**

Add `adapt` as a control-plane capability, not a seventh engineering workflow. Recalculate canonical word counts with:

```bash
find skills -mindepth 2 -maxdepth 2 -name SKILL.md -exec wc -w {} +
wc -w adapters/claude/session-start
```

Write the exact measured totals and percentage into both READMEs and comparison docs. Add `multi-turn-feedback-learning` to the suite and synchronize every benchmark fixture's coverage, category totals, and aggregate case counts in the same slice. Add benchmark tests for the four-turn correction/generalization scenario and release gates: related-task accuracy improves, unrelated-task contamination is zero, safety bypass is zero, and retrieval stays at three lessons.

- [ ] **Step 5: Regenerate and verify documentation consistency**

Run:

```bash
npm run generate
npm run validate
rg -n "0\.1\.0|six user-facing skills|static and dependency-free|no repository-local" \
  README.md README.zh-CN.md SECURITY.md docs plugins metadata package.json
```

Expected: validation PASS; any remaining old-version or old-contract occurrence is an explicitly historical statement, never a current product claim.

- [ ] **Step 6: Commit the product-surface slice**

```bash
git add metadata/plugin.json package.json README.md README.zh-CN.md SECURITY.md CONTRIBUTING.md \
  docs evals tests/benchmark.test.mjs tests/generator.test.mjs plugins .agents .claude-plugin
git commit -m "docs: release adaptive learning preview"
```

---

### Task 7: Adversarial review, release validation, and remote delivery

**Files:**
- Modify: only files required by verified review findings.
- Build: `dist/codex/leanpowers/**`
- Build: `dist/claude/leanpowers/**`

**Interfaces:**
- Produces: independently reviewed `0.2.0`, verified installable packages, remote `main` SHA parity, and passing GitHub CI.

- [ ] **Step 1: Run the full local validation matrix**

```bash
npm run validate
npm run build
PYTHONPATH=/private/tmp/leanpowers-pydeps python3 \
  "${CODEX_HOME:-$HOME/.codex}/skills/.system/plugin-creator/scripts/validate_plugin.py" \
  dist/codex/leanpowers
claude plugin validate dist/claude/leanpowers
git diff --check
git status --short
```

Expected: all Node tests PASS; both official validators PASS; no diff errors; only intentional feature files are changed.

- [ ] **Step 2: Run isolated local marketplace installs**

Use fresh `/private/tmp` config roots. Add the repository by local path, install `leanpowers@leanpowers`, and assert both caches contain seven Skills, both schemas, and helper scripts; Claude additionally contains the Hook and reviewer/verifier agents. Run packaged helper `--help`, `enable`, `record`, and `query` in a temporary Git repository.

- [ ] **Step 3: Dispatch independent code review and verification**

Give the reviewer the approved spec, complete branch diff, tests, package artifacts, and install outputs. Require findings first across opt-in, privacy, path handling, concurrency, deletion, prompt injection, package isolation, and stale claims. Give a separate verifier every acceptance criterion and require PASS/FAIL/INCOMPLETE with current command evidence.

- [ ] **Step 4: Repair every accepted finding with RED-GREEN evidence**

For each defect, add the smallest failing regression test, observe the expected failure, implement the minimal repair, rerun targeted tests, then rerun `npm run validate` and both official plugin validators. Commit one coherent remediation commit:

```bash
git add skills schemas references adapters scripts tests evals metadata package.json \
  README.md README.zh-CN.md SECURITY.md CONTRIBUTING.md docs plugins .agents .claude-plugin
git commit -m "fix: harden adaptive learning release gates"
```

- [ ] **Step 5: Fast-forward `main` and push the verified revision**

```bash
git checkout main
git merge --ff-only feat/adaptive-learning
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Expected: local and remote `main` SHAs are identical. Do not tag or create a GitHub Release unless separately requested.

- [ ] **Step 6: Run real remote-install smoke tests**

In fresh Codex and Claude config roots, add `LAwLi3tCoding/LeanPowers`, install `leanpowers@leanpowers`, inspect cached version `0.2.0`, seven Skills, schemas, helper, Hook, and agents, then execute the packaged helper lifecycle in a temporary Git repository.

- [ ] **Step 7: Verify GitHub CI and final state**

Read back the GitHub Actions run for the delivered SHA and require completed-success. Confirm `git status --short --branch` is clean, `main` tracks `origin/main`, and no retired GitHub owner alias occurs in the current tree or packages.
