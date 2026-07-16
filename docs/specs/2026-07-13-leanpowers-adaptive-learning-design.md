# LeanPowers Adaptive Learning Design

**Date:** 2026-07-13
**Status:** Implemented in 0.2.0
**Target release:** 0.2.0

## 1. Summary

LeanPowers will add a project-local learning loop that turns explicit user feedback and observed outcomes into scoped, auditable lessons. Later workflows may retrieve a small number of relevant lessons and adjust their choices without weakening current instructions, project policy, authorization, review independence, or evidence gates.

The capability is event-driven and disabled until the user explicitly enables it for one project. It does not add a daemon, telemetry, network access, a global memory store, or an always-on repository scan. The six engineering workflows remain unchanged as the workflow surface. A small control-plane skill named `adapt` handles enablement, explicit feedback events, and maintenance requests through a bundled deterministic helper.

## 2. Goals

1. Detect explicit downstream feedback about a prior LeanPowers result.
2. Distinguish correction, confirmation, outcome, and durable preference from weak conversational signals.
3. Persist only normalized, project-scoped lessons in a private local ledger.
4. Retrieve at most three relevant active lessons for a later workflow.
5. Strengthen, supersede, inspect, forget, and clear lessons without hidden state.
6. Preserve LeanPowers safety and quality invariants regardless of learned content.
7. Keep the six engineering workflows dependency-free; require Node.js 20+ only when project learning is explicitly enabled.

## 3. Non-goals

- Background learning while no Agent turn is running.
- Cross-project or global user profiling.
- Uploading feedback, analytics, or telemetry.
- Storing complete prompts, transcripts, logs, credentials, or secrets.
- Training or fine-tuning a model.
- Allowing learned preferences to authorize external, destructive, production, or credential-sensitive actions.
- Treating Agent self-evaluation, user silence, or politeness as proof of success.
- Replacing regression tests, current verification, or independent review with historical lessons.
- Writing or reading learning state before project-level opt-in.

## 4. Product Shape

LeanPowers retains six engineering workflows:

```text
shape? -> build/debug -> review? -> verify? -> ship?
```

It adds one event-driven control-plane skill:

```text
explicit feedback -> adapt -> local lesson ledger
                                  |
next workflow -> bounded retrieval-+
```

`adapt` is not a seventh engineering workflow and is never inserted into ordinary workflow chains. Its description must trigger only when a user reports a prior outcome, corrects a conclusion, rejects an approach, confirms a result, states a durable project-specific preference, or asks to inspect or remove learned lessons.

The name `adapt` means “change future behavior from verified feedback.” It avoids the broad discovery ambiguity of `learn`, which could trigger for educational requests.

## 5. Enablement Contract

Learning is off by default. Installation, SessionStart, and ordinary workflow use do not create `.leanpowers/` or read a ledger.

The user enables it with an explicit project-scoped instruction such as “enable LeanPowers learning for this project.” `adapt` then:

1. resolves and displays the project root;
2. states that normalized feedback will be stored locally and excluded from Git;
3. writes `.leanpowers/config.json` with `schema_version`, `enabled: true`, `project_id`, and `enabled_at`;
4. initializes the ledger and local Git exclusion through the helper.

Designing, implementing, installing, or discussing the feature is not opt-in. Only an explicit project-scoped enable request that successfully writes the enabled config activates learning for that project.

“Disable project learning” atomically sets `enabled: false`. Disabled projects neither record nor retrieve lessons, but retain data for later inspection or deletion. “Clear and disable project learning” requires confirmation because it permanently removes project learning data.

## 6. Storage Boundary

### 6.1 Location

The canonical ledger is:

```text
<project-root>/.leanpowers/lessons.jsonl
```

For a Git task, the project root is `git rev-parse --show-toplevel` from the active working directory. Otherwise it is the runtime-provided workspace root, falling back to the active working directory only when no workspace root exists. Lessons never fall back to a global home-directory store.

When the root is a Git repository, the first write adds `.leanpowers/` to the path returned by `git rev-parse --git-path info/exclude` if it is not already ignored. This works for ordinary repositories and linked worktrees while avoiding edits to the repository's tracked `.gitignore`. In a non-Git workspace, `.leanpowers/` remains a local hidden directory and the Agent must disclose that no Git exclusion is available.

### 6.2 Project identity

The helper computes `project_id` without storing a raw local path:

- Git with `origin`: SHA-256 of `git\0<normalized-origin-url>`;
- Git without `origin`: SHA-256 of `git-path\0<realpath-project-root>`;
- non-Git workspace: SHA-256 of `workspace\0<realpath-workspace-root>`.

Normalization removes credentials, converts SSH and HTTPS GitHub forms to the same host/path identity, removes a trailing `.git`, and preserves the repository owner and name. Every config and event contains the computed `project_id`; mismatches stop retrieval and writing.

### 6.3 Privacy

Records contain normalized rules and bounded evidence summaries. They must not contain:

- raw prompts or complete user quotations;
- complete command output or stack traces;
- secrets, tokens, credentials, cookies, or environment-variable values;
- personal, financial, medical, or other sensitive identifiers;
- unrelated repository content.

If safe normalization is not possible, `adapt` reports that the feedback was not persisted.

### 6.4 Failure behavior

Learning is advisory. If storage is unavailable, malformed, or unwritable, the active engineering task continues and the Agent reports a bounded learning gap. A storage failure cannot make `verify` pass or block a user-requested safe repair.

## 7. Event Model

The ledger is append-only JSON Lines. Each line conforms to `schemas/lesson-event.schema.json`.

```json
{
  "schema_version": 1,
  "event_id": "9dc8a861-35bc-4fc7-9316-51a207f23ad8",
  "recorded_at": "2026-07-13T00:00:00.000Z",
  "action": "activate",
  "lesson_id": "293eddb8-b94d-4246-9f8c-29cdebfc4538",
  "project_id": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "kind": "correction",
  "scope": {
    "workflows": ["debug"],
    "path_prefixes": ["src/pricing/"],
    "tags": ["coupon", "tenant-filter"]
  },
  "rule": "When diagnosing empty coupon results, verify tenant and organization filters before changing query logic.",
  "evidence": {
    "source": "explicit_user_feedback",
    "summary": "The user supplied the production tenant mismatch that explained the empty result.",
    "revision": "git:abc123:dirty"
  },
  "confidence": 0.9,
  "supersedes": [],
  "expires_at": null
}
```

### 7.1 Actions

| Action | Meaning |
| --- | --- |
| `activate` | Create a new active lesson. |
| `reinforce` | Add supporting outcome evidence to an existing lesson. |
| `supersede` | Replace one or more contradictory or over-broad lessons. |
| `forget` | Deactivate one lesson at the user's request. |
| `clear` | Deactivate every lesson in this project at the user's request. |

History remains auditable. Retrieval derives current state by applying events in file order. `forget` and `clear` do not physically erase prior lines; an explicit privacy deletion request rewrites the ledger atomically to remove the requested content.

The leader Agent is the only caller allowed to write. Child Agents return candidate feedback events to the leader instead of writing the ledger. The bundled helper reads the current fingerprint, writes the complete next ledger to a sibling temporary file, validates every JSON line against the packaged schema, checks that the source fingerprint is unchanged, and atomically renames the temporary file. A concurrent change triggers one fresh read and retry; a second conflict returns a nonzero conflict result and is reported as a persistence gap.

When the active ledger exceeds 256 events or 256 KiB, the helper compacts it before retrieval or the next write. Superseded and inactive history moves to `.leanpowers/archive/<timestamp>.jsonl`; the active ledger retains one canonical activation event and the latest bounded evidence summary per active lesson. Archives are read only for explicit inspection or permanent deletion.

### 7.2 Feedback kinds

| Kind | Minimum signal | Initial confidence |
| --- | --- | --- |
| `preference` | Explicit durable project-specific instruction | `1.0` |
| `correction` | Explicit correction with a replacement fact or rule | `0.9` |
| `outcome` | Explicit real result such as worked, failed, regressed, or deployed | `0.85` |
| `confirmation` | Explicit confirmation tied to a specific prior result | `0.75` |

Confidence is bounded to `[0, 1]`. Reinforcement may increase it by at most `0.05` per independent outcome. Contradiction does not decrement in place; it creates a superseding event so the reason remains visible.

The helper generates UUID v4 `event_id` and `lesson_id` values and rejects duplicates within the active ledger and archives. A Git revision fingerprint is `git:<HEAD>:<clean|dirty>`; a non-Git fingerprint is `workspace:<SHA-256 of the normalized relevant-file manifest>`. Revision is nullable only when the feedback is a pure durable preference unrelated to repository state.

## 8. Learning Decision

`adapt` evaluates feedback in this order:

1. Identify the prior result or decision the feedback refers to.
2. Require an explicit signal. Silence, continued conversation, thanks, approval to proceed, and Agent self-assessment are insufficient.
3. Classify the event as preference, correction, outcome, or confirmation.
4. Reject one-time authorization, session-only formatting requests, unsafe instructions, and facts outside the current project.
5. Normalize one reusable rule with the narrowest defensible scope.
6. Search active lessons for the same rule or a contradiction.
7. Append `activate`, `reinforce`, or `supersede` using an atomic write strategy.
8. Tell the user in one short sentence what was learned, reinforced, replaced, or intentionally not stored.

Feedback classification and normalization are bounded Agent judgments defined by the Skill and tested with fixed forward-test fixtures. The helper, not the Agent, owns project identity, schema validation, forbidden-pattern checks, state reduction, relevance scoring, conflict detection, compaction, and atomic persistence.

Automatic recording is allowed only after the project config records explicit opt-in. The user does not need to approve each ordinary record. Any record containing sensitive or materially ambiguous content is skipped rather than guessed. The helper's forbidden-pattern checks are a defense-in-depth minimum, not a claim that regex can identify every sensitive value; `adapt` must omit any content it cannot safely normalize.

## 9. Retrieval and Application

Each engineering skill adds one conditional entry step:

1. If `.leanpowers/config.json` is absent or disabled, continue with zero additional work.
2. If enabled, invoke the bundled helper with the declared workflow, affected path prefixes, and normalized task tags.
3. The helper returns at most three active lessons whose confidence is at least `0.70` and whose scope materially overlaps the task.
4. State only behavior-changing lessons in the task brief; do not dump the ledger into context.

Ranking is deterministic:

```text
exact path + workflow + tag > path + workflow > workflow + tag > workflow > tag
```

Ties use confidence, then most recent supporting event. A lesson with no material overlap is not loaded.

### 9.1 Precedence

LeanPowers does not redefine the host runtime's instruction hierarchy. System, developer, runtime, project, and user instructions retain their native precedence. Current repository and runtime evidence remains authoritative for factual claims. A lesson is advisory data, never an instruction, and is considered only after all currently applicable instructions and evidence; it may override only a LeanPowers default.

A lesson may change a default, search order, known project convention, or preferred verification path. It may not:

- lower the selected risk below the highest observable signal;
- bypass authorization or scope boundaries;
- replace root-cause diagnosis with an old guess;
- replace regression or completion evidence;
- self-approve a strict-risk change;
- cause an external write that the current user did not request.

## 10. Runtime Integration

### 10.1 Portable source

Add:

```text
skills/adapt/SKILL.md
skills/adapt/agents/openai.yaml
skills/adapt/scripts/learning.mjs
references/learning-policy.md
schemas/learning-config.schema.json
schemas/lesson-event.schema.json
```

The generator copies the complete `adapt` tree, learning policy, and both learning schemas into both installable packages. The helper resolves them under `<package-root>/schemas/`. Package tests assert the script, schemas, Skill, and policy are all present and source-identical.

The helper exposes a stable JSON interface:

```text
node learning.mjs enable|disable|query|record|inspect|forget|clear|delete|doctor
```

It reads request JSON from stdin and writes one result JSON object to stdout. It never accepts lesson text as a shell argument. Exit codes distinguish invalid input, disabled learning, project mismatch, write conflict, and storage failure. `--help` documents the request and response fields.

The six engineering workflows remain static and dependency-free while learning is disabled. Enabling learning requires Node.js 20+ for deterministic storage and retrieval; if Node is unavailable, `adapt` reports a capability gap and does not create best-effort state.

### 10.2 Codex

Codex continues to have no startup injection. Native skill discovery loads `adapt` from its explicit feedback-oriented description. The six engineering skills invoke the helper only when they are invoked and project learning is enabled.

### 10.3 Claude Code

The read-only `SessionStart` charter adds one sentence directing explicit downstream feedback to `adapt`. The hook still does not scan or write the repository, access the network, or dispatch an Agent. Its total additional context remains below 200 words.

### 10.4 Other Agent Skills runtimes

The portable skill and reference define the behavior. If a runtime cannot execute Node.js 20+ or write files, learning cannot be enabled; `adapt` returns the normalized candidate and a persistence capability gap rather than claiming it was recorded.

## 11. Maintenance Commands

Natural-language requests route to `adapt`:

- “What has LeanPowers learned in this project?” returns active lesson summaries only.
- “Forget the tenant-filter lesson” appends `forget` after resolving one exact lesson.
- “Clear project learning” appends `clear` after confirming the request targets only `.leanpowers/` learning data.
- “Delete that learning permanently” atomically rewrites the ledger without the targeted records.

Ambiguous forget or deletion requests do not guess which lesson to remove.

Permanent deletion computes a reference closure across the active ledger and archives. It removes every event whose `lesson_id` is targeted, removes the target from other events' `supersedes` arrays, and discards evidence summaries whose only source was a removed event. Remaining events are revalidated and reduced before a temporary replacement tree is atomically swapped into place. Any validation, conflict, or rename failure preserves the complete old tree and returns a deletion failure; partial deletion is never reported as success.

## 12. Token and Complexity Budget

- `adapt/SKILL.md`: target below 400 words.
- `learning-policy.md`: target below 180 words.
- Each engineering skill: no more than two short learning integration lines.
- Claude startup charter: below 120 words target and 200 words hard limit.
- Retrieval: at most three normalized rules, not raw events.
- Disabled learning: no helper execution, repository read, or context injection.
- Enabled learning: one bounded helper query per engineering workflow entry; target under 100 ms for a compacted local ledger.
- Installed package: one dependency-free Node.js helper; no package installation, MCP, daemon, telemetry, or network access.

The README will describe the product as six engineering workflows plus one event-driven learning control skill. Existing Superpowers comparison word counts will be recalculated from the canonical source.

## 13. Validation Strategy

### 13.1 Deterministic unit tests

Add pure development-time helpers and tests for:

- learning disabled by default and explicit enable/disable state transitions;
- canonical Git, worktree, multi-root, and non-Git project resolution and `project_id` matching;
- schema-valid activate, reinforce, supersede, forget, and clear events;
- rejection of malformed confidence, scope, action, and unsafe raw content;
- active-state reduction in append order;
- exact precedence of clear, forget, and supersede;
- atomic rewrite behavior, concurrent-change retry, and leader-only writes;
- compaction that preserves active semantics and archives inactive history;
- deterministic relevance ranking and the three-lesson cap;
- confidence threshold and expiration;
- current user and safety policy precedence over lessons;
- contradiction replacing rather than silently mutating a lesson.
- permanent-deletion reference closure and all-or-nothing recovery.

The packaged runtime helper owns the same state and validation primitives exercised by these tests. Benchmark scoring and fixture orchestration remain development-only.

### 13.2 Skill pressure tests

Forward-test at least these scenarios:

1. User says only “thanks”; no lesson is stored.
2. User reports that a fix still fails; an outcome or correction is stored.
3. User provides a durable project convention; a scoped preference is stored.
4. A relevant lesson changes the next diagnostic search order.
5. An unrelated lesson is not loaded.
6. A learned shortcut conflicts with strict risk; strict gates win.
7. A later correction supersedes an earlier lesson.
8. A user asks to inspect, forget, clear, and permanently delete learning.

`evals/learning-cases.json` is the oracle. Every case contains the prior-result summary, later user utterance, enabled state, workflow/path/tag context, expected classification or rejection reason, expected normalized event fields, expected retrieved lesson IDs, and expected safety decision. Terms such as “explicit,” “safe,” and “materially relevant” are release claims only through these fixed inputs and expected outputs plus live benchmark evidence.

### 13.3 Package and release tests

- Both packages contain source-identical `adapt` and learning policy files.
- Both packages contain source-identical helper and learning schema files at their documented paths.
- Existing package isolation and no-placeholder checks still pass.
- The standalone validator accepts the new skill and schema.
- The Claude hook remains executable, valid JSON, read-only, and under budget.
- Repository validation, build, official Codex validation, Claude validation, and isolated remote-install smoke tests pass.
- README, security guidance, migration documentation, comparison counts, and install-time dependency claims reflect opt-in project state and the enabled-learning Node.js requirement.

## 14. Benchmark Extension

Add a learning category with paired multi-turn scenarios:

1. First attempt produces a plausible but wrong project-specific assumption.
2. User supplies explicit corrective feedback.
3. A later related task tests whether the workflow applies the scoped correction.
4. An unrelated task tests whether the correction is improperly generalized.

Quality gates require improved related-task accuracy with no cross-scope contamination, no safety-gate bypass, and bounded retrieval cost. Fixtures remain diagnostic; parity claims still require live, blind, identically paired runs.

## 15. Acceptance Criteria

The feature is complete only when:

1. Learning is off after installation and cannot read or write state before explicit project opt-in.
2. After opt-in, explicit feedback automatically produces a safe project-local event without per-event confirmation.
3. Weak signals do not produce events.
4. `.leanpowers/` is excluded locally from Git without changing tracked ignore files, including in linked worktrees.
5. Project identity mismatches stop reads and writes.
6. Only the leader calls the helper for writes; concurrent changes are retried without silently losing events.
7. Later workflows retrieve no more than three materially relevant active lessons through the deterministic helper.
8. Contradictory feedback supersedes prior learning with an auditable event.
9. Ledger compaction preserves active behavior and moves inactive history out of the retrieval path.
10. Users can inspect, forget, clear, disable, and permanently delete learning with all-or-nothing failure behavior.
11. Lessons cannot lower authorization, safety, risk, review, regression, or verification gates.
12. Codex remains zero-injection and Claude remains below the startup budget.
13. Both generated packages and remote install paths contain the complete Skill, helper, schema, and policy.
14. README, security, migration, comparison, and dependency claims are internally consistent.
15. All deterministic, package, validator, forward, and remote smoke tests pass.

## 16. Open Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| False learning from ambiguous conversation | Require explicit signals and skip ambiguity. |
| Cross-task overgeneralization | Narrow scope, confidence threshold, deterministic ranking, three-rule cap. |
| Sensitive data persistence | Normalize summaries, scan forbidden content, skip unsafe records. |
| Stale or contradictory lessons | Append-only supersede/forget/clear events and expiration support. |
| Hidden behavior changes | One-line disclosure after writes and inspect/forget/delete commands. |
| Token growth | Conditional retrieval, active-state reduction, bounded summaries. |
| Runtime inconsistency | Portable Skill contract plus generated-package parity tests. |
| Unintended profiling after install | Default-off config and explicit project-level opt-in. |
| Node.js unavailable | Keep core workflows unaffected and refuse learning enablement with a clear capability gap. |
