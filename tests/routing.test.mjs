import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { classifyRisk, selectInitialWorkflow } from "../scripts/lib/routing.mjs";

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
    selectInitialWorkflow({ causeKnown: true, deliveryOnly: false, needsShaping: true }),
    "shape",
  );
  assert.equal(
    selectInitialWorkflow({ causeKnown: true, deliveryOnly: false, needsShaping: false }),
    "build",
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
});
