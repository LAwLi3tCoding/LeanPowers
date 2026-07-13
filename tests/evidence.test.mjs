import assert from "node:assert/strict";
import test from "node:test";

import {
  evidenceRemainsValid,
  evidenceSupportsCompletion,
  validateEvidence,
} from "../scripts/lib/evidence.mjs";

const entry = {
  revision_fingerprint: "abc123:clean",
  command: "node --test tests/evidence.test.mjs",
  scope: "evidence contract",
  result: "pass",
  exit_code: 0,
  timestamp: "2026-07-13T10:00:00.000Z",
  summary: "Evidence tests passed.",
  provenance: "live",
};

test("valid evidence has no schema errors", () => {
  assert.deepEqual(validateEvidence(entry), []);
});

test("evidence validation rejects unavailable-as-pass and malformed fields", () => {
  const errors = validateEvidence({
    ...entry,
    result: "unavailable",
    exit_code: 0,
    summary: "",
  });
  assert.ok(errors.some((error) => error.includes("exit_code")));
  assert.ok(errors.some((error) => error.includes("summary")));
});

test("evidence remains valid only for the same revision fingerprint", () => {
  assert.equal(evidenceRemainsValid(entry, "abc123:clean"), true);
  assert.equal(evidenceRemainsValid(entry, "def456:dirty"), false);
  assert.equal(evidenceRemainsValid(entry, { fingerprint: "abc123:clean" }), true);
  assert.equal(
    evidenceRemainsValid(
      { ...entry, result: "fail", exit_code: 1 },
      "abc123:clean",
    ),
    true,
  );
});

test("simulated and unavailable evidence cannot support completion", () => {
  assert.equal(
    evidenceSupportsCompletion({ ...entry, provenance: "simulated" }, "abc123:clean"),
    false,
  );
  assert.equal(
    evidenceSupportsCompletion(
      { ...entry, result: "unavailable", exit_code: null },
      "abc123:clean",
    ),
    false,
  );
});
