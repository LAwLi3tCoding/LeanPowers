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

test("schema version 1 is the only accepted benchmark result version", () => {
  const future = structuredClone(passing);
  future.schema_version = 2;
  assert.ok(
    validateBenchmarkRun(future).some((error) => error.includes("schema_version must equal 1")),
  );
});

test("aggregate denominators and category coverage must reconcile to completed cases", () => {
  const aggregateMismatch = structuredClone(passing);
  aggregateMismatch.quality.task_success.total -= 1;
  assert.ok(
    validateBenchmarkRun(aggregateMismatch).some((error) =>
      error.includes("quality.task_success.total must equal coverage.completed_cases"),
    ),
  );

  const missingCategory = structuredClone(passing);
  missingCategory.categories.pop();
  assert.ok(
    validateBenchmarkRun(missingCategory).some((error) =>
      error.includes("categories must exactly partition coverage.scenario_classes"),
    ),
  );

  const categoryTotalMismatch = structuredClone(passing);
  categoryTotalMismatch.categories[0].task_success.total -= 1;
  assert.ok(
    validateBenchmarkRun(categoryTotalMismatch).some((error) =>
      error.includes("category task_success totals must equal coverage.completed_cases"),
    ),
  );

  const categoryPassedMismatch = structuredClone(passing);
  categoryPassedMismatch.categories[0].task_success.passed -= 1;
  assert.ok(
    validateBenchmarkRun(categoryPassedMismatch).some((error) =>
      error.includes("category task_success passed counts must equal quality.task_success.passed"),
    ),
  );
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

test("paired runs require distinct IDs and deterministic workflow identities", () => {
  const reusedRunId = { ...passing, run_id: baseline.run_id };
  assert.equal(compareRuns(baseline, reusedRunId).decision, "DIAGNOSTIC_ONLY");

  const wrongBaseline = { ...baseline, workflow: "leanpowers-0.1.0" };
  assert.equal(compareRuns(wrongBaseline, passing).decision, "DIAGNOSTIC_ONLY");

  const wrongCandidate = { ...passing, workflow: "superpowers-6.1.1" };
  assert.equal(compareRuns(baseline, wrongCandidate).decision, "DIAGNOSTIC_ONLY");
});

test("all non-inferiority boundaries pass exactly and fail beyond the margin", () => {
  const boundary = structuredClone(passing);
  boundary.quality.task_success.passed = 89;
  boundary.categories[1].task_success.passed = 7;
  boundary.categories[1].strict_rerun = {
    run_id: "leanpowers-boundary-multi-file-strict",
    provenance: "live",
    completion: "complete",
    task_success: structuredClone(baseline.categories[1].task_success),
    composite_quality: baseline.categories[1].composite_quality,
  };
  boundary.quality.composite_quality = baseline.quality.composite_quality * 0.95;
  boundary.quality.introduced_regressions.count = 4;
  boundary.quality.scope_violations.count = 3;
  boundary.efficiency.standard.median_tokens = 5000;
  boundary.efficiency.standard.median_wall_seconds = 60;
  boundary.efficiency.standard.median_agent_calls = 2;
  assert.equal(compareRuns(baseline, boundary).decision, "PASS");

  boundary.quality.task_success.passed = 88;
  boundary.categories[1].task_success.passed = 6;
  assert.equal(compareRuns(baseline, boundary).decision, "BLOCK");
});

test("regressing categories require a linked live complete strict rerun that recovers quality", () => {
  const candidate = structuredClone(passing);
  const baselineCategory = baseline.categories[0];
  candidate.categories[0].task_success.passed = baselineCategory.task_success.passed - 1;
  candidate.categories[0].strict_rerun = null;
  assert.equal(compareRuns(baseline, candidate).decision, "BLOCK");

  candidate.categories[0].strict_rerun = {
    run_id: "leanpowers-pass-small-explicit-feature-strict",
    provenance: "simulated",
    completion: "complete",
    task_success: structuredClone(baselineCategory.task_success),
    composite_quality: baselineCategory.composite_quality,
  };
  assert.equal(compareRuns(baseline, candidate).decision, "DIAGNOSTIC_ONLY");

  candidate.categories[0].strict_rerun.provenance = "live";
  candidate.categories[0].strict_rerun.completion = "incomplete";
  assert.equal(compareRuns(baseline, candidate).decision, "DIAGNOSTIC_ONLY");

  candidate.categories[0].strict_rerun.completion = "complete";
  candidate.categories[0].strict_rerun.task_success.passed -= 1;
  assert.equal(compareRuns(baseline, candidate).decision, "BLOCK");

  candidate.categories[0].strict_rerun.task_success.passed += 1;
  candidate.categories[0].strict_rerun.composite_quality -= 0.01;
  assert.equal(compareRuns(baseline, candidate).decision, "BLOCK");

  candidate.categories[0].strict_rerun.composite_quality += 0.01;
  assert.equal(compareRuns(baseline, candidate).decision, "PASS");
});

test("strict rerun evidence requires IDs distinct from the parent and other evidence", () => {
  const candidate = structuredClone(passing);
  candidate.categories[0].strict_rerun = {
    run_id: candidate.run_id,
    provenance: "live",
    completion: "complete",
    task_success: structuredClone(candidate.categories[0].task_success),
    composite_quality: candidate.categories[0].composite_quality,
  };
  assert.ok(
    validateBenchmarkRun(candidate).some((error) => error.includes("run_id must be distinct")),
  );

  const duplicate = structuredClone(passing);
  duplicate.categories[1].strict_rerun = {
    ...structuredClone(duplicate.categories[0].strict_rerun),
    task_success: structuredClone(duplicate.categories[1].task_success),
  };
  assert.ok(
    validateBenchmarkRun(duplicate).some((error) => error.includes("run_id must be distinct")),
  );
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
