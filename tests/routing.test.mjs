import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  classifyRisk,
  requiredGates,
  selectInitialWorkflow,
  selectNextWorkflow,
} from "../scripts/lib/routing.mjs";

const cases = JSON.parse(
  await readFile(new URL("../evals/routing-cases.json", import.meta.url), "utf8"),
);

test("structured risk fixtures use the highest applicable signal", () => {
  for (const fixture of cases) {
    assert.equal(classifyRisk(fixture.signals), fixture.expected, fixture.name);
  }
});

test("user rigor can upgrade but never downgrade a strict signal", () => {
  assert.equal(classifyRisk({ preferredMode: "strict", local: true }), "strict");
  assert.equal(classifyRisk({ preferredMode: "lean", security: true }), "strict");
  assert.equal(classifyRisk({ causeKnown: false, preferredMode: "lean" }), "standard");
  assert.equal(
    classifyRisk({
      clear: true,
      diagnosisRequested: true,
      establishedValidation: true,
      local: true,
      preferredMode: "lean",
      reversible: true,
    }),
    "standard",
  );
});

test("security-boundary signals are always strict", () => {
  for (const signal of [
    "authentication",
    "credentials",
    "cryptography",
    "secrets",
    "signatureVerification",
  ]) {
    assert.equal(classifyRisk({ [signal]: true, local: true, reversible: true }), "strict");
  }
});

test("initial workflow selection covers every workflow owner", () => {
  assert.equal(selectInitialWorkflow({ learningRequest: true }), "adapt");
  assert.equal(selectInitialWorkflow({ reviewRequested: true }), "review");
  assert.equal(selectInitialWorkflow({ verificationRequested: true }), "verify");
  assert.equal(
    selectInitialWorkflow({ deliveryOnly: true, verificationCurrent: true }),
    "ship",
  );
  assert.equal(selectInitialWorkflow({ deliveryOnly: true }), "verify");
  assert.equal(
    selectInitialWorkflow({ causeKnown: false, deliveryOnly: false, needsShaping: false }),
    "debug",
  );
  assert.equal(
    selectInitialWorkflow({ causeKnown: false, deliveryOnly: false, needsShaping: true }),
    "shape",
  );
  assert.equal(
    selectInitialWorkflow({ causeKnown: true, deliveryOnly: false, needsShaping: true }),
    "shape",
  );
  assert.equal(
    selectInitialWorkflow({ causeKnown: true, deliveryOnly: false, needsShaping: false }),
    "build",
  );
  assert.equal(
    selectInitialWorkflow({ causeKnown: true, diagnosisRequested: true }),
    "debug",
  );
  assert.equal(selectInitialWorkflow({ engineeringWork: false }), null);
});

test("routing resolves entry contracts and competing intents one workflow at a time", () => {
  assert.equal(selectInitialWorkflow({ explicitWorkflow: "review" }), "review");
  assert.equal(selectInitialWorkflow({ explicitWorkflow: "ship" }), "verify");
  assert.equal(
    selectInitialWorkflow({ explicitWorkflow: "ship", verificationCurrent: true }),
    "ship",
  );
  assert.equal(
    selectInitialWorkflow({
      explicitWorkflow: "ship",
      verificationCurrent: true,
      risk: "strict",
    }),
    "review",
  );
  assert.equal(
    selectInitialWorkflow({
      deliveryOnly: true,
      verificationCurrent: true,
      risk: "strict",
      independentReview: true,
    }),
    "ship",
  );
  assert.equal(
    selectInitialWorkflow({ reviewRequested: true, deliveryRequested: true }),
    "review",
  );
  assert.equal(
    selectInitialWorkflow({ causeKnown: false, deliveryRequested: true }),
    "debug",
  );
  assert.equal(
    selectInitialWorkflow({ deliveryOnly: true, verificationCurrent: false }),
    "verify",
  );
  assert.equal(
    selectInitialWorkflow({ reviewRequested: true, diagnosisRequested: true }),
    "review",
  );
  assert.equal(
    selectInitialWorkflow({ verificationRequested: true, diagnosisRequested: true }),
    "verify",
  );
  assert.equal(
    selectInitialWorkflow({ needsShaping: true, diagnosisRequested: true }),
    "shape",
  );
  assert.equal(
    selectInitialWorkflow({ learningRequest: true, diagnosisRequested: true }),
    "adapt",
  );
  assert.equal(
    selectInitialWorkflow({
      deliveryOnly: true,
      diagnosisRequested: true,
      verificationCurrent: true,
    }),
    "ship",
  );
});

test("risk becomes a sticky gate ledger across workflow transitions", () => {
  assert.deepEqual(requiredGates("lean"), ["current_evidence"]);
  assert.deepEqual(requiredGates("standard"), ["current_evidence"]);
  assert.deepEqual(requiredGates("strict"), ["independent_review", "current_evidence"]);

  assert.equal(
    selectNextWorkflow({ current: "build", risk: "strict", evidenceCurrent: true }),
    "review",
  );
  assert.equal(
    selectNextWorkflow({ current: "debug", risk: "strict", evidenceCurrent: true }),
    "review",
  );
  assert.equal(
    selectNextWorkflow({ current: "build", risk: "standard", evidenceCurrent: true }),
    null,
  );
  assert.equal(
    selectNextWorkflow({ current: "debug", risk: "lean", evidenceCurrent: true }),
    null,
  );
  assert.equal(
    selectNextWorkflow({
      current: "review",
      risk: "strict",
      evidenceCurrent: true,
      independentReview: true,
      reviewVerdict: "pass",
    }),
    null,
  );
  assert.equal(
    selectNextWorkflow({ current: "review", risk: "strict", independentReview: false }),
    "incomplete",
  );
  assert.equal(
    selectNextWorkflow({
      current: "review",
      risk: "strict",
      independentReview: true,
      reviewVerdict: "changes_required",
      repairOwner: "debug",
    }),
    "debug",
  );
  assert.equal(
    selectNextWorkflow({
      current: "review",
      risk: "standard",
      reviewVerdict: "blocked",
    }),
    "incomplete",
  );
});

test("verification is reserved for stale, explicit, delivery, and cross-artifact evidence", () => {
  for (const input of [
    { current: "build", risk: "standard", evidenceCurrent: false },
    { current: "build", risk: "standard", verificationRequested: true },
    { current: "build", risk: "standard", deliveryRequested: true },
    { current: "build", risk: "standard", crossArtifactClaim: true },
  ]) {
    assert.equal(selectNextWorkflow(input), "verify");
  }
  assert.equal(
    selectNextWorkflow({
      current: "review",
      risk: "strict",
      evidenceCurrent: false,
      independentReview: true,
      reviewVerdict: "pass",
    }),
    "verify",
  );
});
