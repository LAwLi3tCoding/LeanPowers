import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const oracle = JSON.parse(
  await readFile(new URL("../evals/learning-cases.json", import.meta.url), "utf8"),
);
const kinds = ["preference", "correction", "outcome", "confirmation"];
const scopeKeys = ["path_prefixes", "tags", "workflows"];

test("learning cases are a fixed oracle fixture, not model-behavior evidence", () => {
  assert.equal(oracle.schema_version, 1);
  assert.equal(oracle.artifact_type, "oracle_fixture");
  assert.equal(oracle.proves_model_behavior, false);
  assert.ok(Array.isArray(oracle.cases));
  assert.ok(oracle.cases.length >= 14);
});

test("every oracle case has the complete decision contract and a unique ID", () => {
  const ids = new Set();

  for (const entry of oracle.cases) {
    assert.deepEqual(Object.keys(entry).sort(), [
      "category",
      "context",
      "enabled",
      "existing_lessons",
      "expected",
      "id",
      "later_user_utterance",
      "prior_result_summary",
    ]);
    assert.equal(typeof entry.id, "string");
    assert.equal(ids.has(entry.id), false, entry.id);
    ids.add(entry.id);
    assert.equal(typeof entry.prior_result_summary, "string", entry.id);
    assert.equal(typeof entry.later_user_utterance, "string", entry.id);
    assert.equal(typeof entry.enabled, "boolean", entry.id);
    assert.deepEqual(Object.keys(entry.context).sort(), ["paths", "tags", "workflow"], entry.id);
    assert.equal(typeof entry.context.workflow, "string", entry.id);
    assert.ok(Array.isArray(entry.context.paths), entry.id);
    assert.ok(Array.isArray(entry.context.tags), entry.id);
    assert.ok(Array.isArray(entry.existing_lessons), entry.id);
    assert.deepEqual(Object.keys(entry.expected).sort(), [
      "action",
      "decision",
      "kind",
      "normalized_rule",
      "normalized_scope",
      "reason",
      "retrieved_lesson_ids",
      "safety_decision",
    ], entry.id);
    assert.equal(typeof entry.expected.decision, "string", entry.id);
    assert.equal(typeof entry.expected.action, "string", entry.id);
    assert.equal(typeof entry.expected.reason, "string", entry.id);
    assert.ok(entry.expected.kind === null || kinds.includes(entry.expected.kind), entry.id);
    assert.ok(
      entry.expected.normalized_rule === null ||
        typeof entry.expected.normalized_rule === "string",
      entry.id,
    );
    if (entry.expected.normalized_scope !== null) {
      assert.deepEqual(Object.keys(entry.expected.normalized_scope).sort(), scopeKeys, entry.id);
      for (const key of scopeKeys) assert.ok(Array.isArray(entry.expected.normalized_scope[key]), entry.id);
    }
    assert.ok(Array.isArray(entry.expected.retrieved_lesson_ids), entry.id);
    assert.ok(entry.expected.retrieved_lesson_ids.length <= 3, entry.id);
    assert.equal(typeof entry.expected.safety_decision, "string", entry.id);
  }
});

test("oracle covers all four supported feedback kinds and maintenance paths", () => {
  assert.deepEqual(
    [...new Set(oracle.cases.map((entry) => entry.expected.kind).filter(Boolean))].sort(),
    [...kinds].sort(),
  );
  const actions = new Set(oracle.cases.map((entry) => entry.expected.action));
  for (const action of ["enable", "disable", "inspect", "forget", "clear", "delete"]) {
    assert.equal(actions.has(action), true, action);
  }
  assert.equal(actions.has("supersede"), true);
});

test("weak signals and unsafe content are rejected instead of becoming lessons", () => {
  const weakSignals = new Set([
    "weak-signal-thanks",
    "weak-signal-silence",
    "weak-signal-continuation",
    "weak-signal-approval",
    "weak-signal-self-assessment",
    "one-time-authorization",
  ]);
  for (const entry of oracle.cases.filter((candidate) => weakSignals.has(candidate.category))) {
    assert.equal(entry.expected.decision, "skip", entry.id);
    assert.equal(entry.expected.action, "none", entry.id);
    assert.equal(entry.expected.kind, null, entry.id);
  }

  const sensitive = oracle.cases.find((entry) => entry.category === "sensitive-content");
  assert.ok(sensitive);
  assert.equal(sensitive.expected.decision, "skip");
  assert.equal(sensitive.expected.safety_decision, "reject_sensitive");
});

test("strict safety precedence beats a conflicting stored preference", () => {
  const entry = oracle.cases.find((candidate) => candidate.category === "strict-risk-conflict");
  assert.ok(entry);
  assert.equal(entry.expected.decision, "query");
  assert.equal(entry.expected.safety_decision, "safety_overrides");
  assert.deepEqual(entry.expected.retrieved_lesson_ids, [
    "55555555-5555-4555-8555-555555555555",
  ]);
  assert.match(entry.expected.reason, /authorization|security|safety/i);
});

test("explicit feedback still records nothing before project opt-in", () => {
  const entry = oracle.cases.find((candidate) => candidate.category === "disabled-feedback");
  assert.ok(entry);
  assert.equal(entry.enabled, false);
  assert.equal(entry.expected.decision, "skip");
  assert.equal(entry.expected.action, "none");
  assert.equal(entry.expected.safety_decision, "learning_disabled");
});

test("retrieval suppresses unrelated lessons and never returns more than three", () => {
  const relevant = oracle.cases.find((entry) => entry.category === "relevant-retrieval");
  const unrelated = oracle.cases.find((entry) => entry.category === "unrelated-retrieval");
  assert.ok(relevant);
  assert.ok(unrelated);
  assert.equal(relevant.expected.retrieved_lesson_ids.length, 3);
  assert.deepEqual(unrelated.expected.retrieved_lesson_ids, []);
  assert.ok(oracle.cases.every((entry) => entry.expected.retrieved_lesson_ids.length <= 3));
});

test("destructive maintenance requires explicit project root and scope confirmation", () => {
  for (const category of ["clear-disable", "permanent-delete"]) {
    const entry = oracle.cases.find((candidate) => candidate.category === category);
    assert.ok(entry, category);
    assert.equal(entry.expected.decision, "confirm", category);
    assert.equal(entry.expected.safety_decision, "confirm_root_and_scope", category);
  }
  const ambiguous = oracle.cases.find((entry) => entry.category === "ambiguous-forget");
  assert.ok(ambiguous);
  assert.equal(ambiguous.expected.decision, "clarify");
  assert.equal(ambiguous.expected.action, "none");
});
