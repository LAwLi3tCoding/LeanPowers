import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { compareRuns, validateBenchmarkRun } from "../scripts/lib/benchmark.mjs";
import { compareFiles } from "../scripts/benchmark.mjs";

async function fixture(name) {
  return JSON.parse(
    await readFile(new URL(`../evals/fixtures/${name}.json`, import.meta.url), "utf8"),
  );
}

const baseline = await fixture("baseline-pass");
const passing = await fixture("leanpowers-pass");

test("benchmark fixtures satisfy the executable result contract", async () => {
  for (const name of [
    "baseline-pass",
    "leanpowers-pass",
    "quality-regression",
    "critical-escape",
  ]) {
    assert.deepEqual(validateBenchmarkRun(await fixture(name)), [], name);
  }
});

test("a comparable non-inferior and materially leaner run passes", () => {
  const result = compareRuns(baseline, passing);
  assert.equal(result.decision, "PASS");
  assert.ok(result.efficiency.standard_tokens_reduction >= 0.5);
  assert.deepEqual(result.hard_failures, []);
});

test("quality regression blocks even when efficiency improves", async () => {
  const result = compareRuns(baseline, await fixture("quality-regression"));
  assert.equal(result.decision, "BLOCK");
  assert.ok(result.reasons.some((reason) => reason.includes("composite quality")));
});

test("critical escape dominates aggregate scores", async () => {
  const result = compareRuns(baseline, await fixture("critical-escape"));
  assert.equal(result.decision, "BLOCK");
  assert.ok(result.hard_failures.some((failure) => failure.includes("critical")));
});

test("simulated or incomplete runs are diagnostic only", () => {
  const simulated = { ...passing, provenance: "simulated" };
  const incomplete = { ...passing, completion: "incomplete" };
  assert.equal(compareRuns(baseline, simulated).decision, "DIAGNOSTIC_ONLY");
  assert.equal(compareRuns(baseline, incomplete).decision, "DIAGNOSTIC_ONLY");
});

test("mismatched pairing conditions are diagnostic only", () => {
  const mismatched = {
    ...passing,
    conditions: { ...passing.conditions, model: "different-model" },
  };
  assert.equal(compareRuns(baseline, mismatched).decision, "DIAGNOSTIC_ONLY");
});

test("all non-inferiority boundaries pass exactly and fail beyond the margin", () => {
  const boundary = structuredClone(passing);
  boundary.quality.task_success.passed = 89;
  boundary.quality.composite_quality = baseline.quality.composite_quality * 0.95;
  boundary.quality.introduced_regressions.count = 4;
  boundary.quality.scope_violations.count = 3;
  boundary.efficiency.standard.median_tokens = 5000;
  boundary.efficiency.standard.median_wall_seconds = 60;
  boundary.efficiency.standard.median_agent_calls = 2;
  assert.equal(compareRuns(baseline, boundary).decision, "PASS");

  boundary.quality.task_success.passed = 88;
  assert.equal(compareRuns(baseline, boundary).decision, "BLOCK");
});

test("regressing categories require an explicit strict fallback", () => {
  const candidate = structuredClone(passing);
  candidate.categories[0].task_success.passed = 18;
  candidate.categories[0].strict_fallback = false;
  assert.equal(compareRuns(baseline, candidate).decision, "BLOCK");

  candidate.categories[0].strict_fallback = true;
  assert.equal(compareRuns(baseline, candidate).decision, "PASS");
});

test("diagnostic runs preserve observed hard failures without granting a release verdict", async () => {
  const candidate = await fixture("critical-escape");
  candidate.provenance = "simulated";
  const result = compareRuns(baseline, candidate);
  assert.equal(result.decision, "DIAGNOSTIC_ONLY");
  assert.ok(result.hard_failures.length > 0);
});

test("invalid counts and unusable baselines cannot produce PASS", () => {
  const invalid = structuredClone(passing);
  invalid.quality.task_success.total = 0;
  assert.equal(compareRuns(baseline, invalid).decision, "DIAGNOSTIC_ONLY");

  const unusableBaseline = structuredClone(baseline);
  unusableBaseline.quality.composite_quality = 0;
  assert.equal(compareRuns(unusableBaseline, passing).decision, "DIAGNOSTIC_ONLY");
});

test("benchmark CLI writer emits stable JSON and Markdown reports", async (context) => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), "leanpowers-benchmark-"));
  context.after(() => rm(outputDirectory, { force: true, recursive: true }));
  const result = await compareFiles({
    baselinePath: new URL("../evals/fixtures/baseline-pass.json", import.meta.url),
    candidatePath: new URL("../evals/fixtures/leanpowers-pass.json", import.meta.url),
    outputDirectory,
  });
  assert.equal(result.decision, "PASS");
  const markdown = await readFile(path.join(outputDirectory, "comparison.md"), "utf8");
  const json = JSON.parse(
    await readFile(path.join(outputDirectory, "comparison.json"), "utf8"),
  );
  assert.match(markdown, /Quality deltas/);
  assert.match(markdown, /Efficiency deltas/);
  assert.equal(json.decision, "PASS");
});
