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

async function suite() {
  return JSON.parse(
    await readFile(new URL("../evals/benchmark-suite.json", import.meta.url), "utf8"),
  );
}

async function benchmarkSchema() {
  return JSON.parse(
    await readFile(
      new URL("../schemas/benchmark-result.schema.json", import.meta.url),
      "utf8",
    ),
  );
}

const baseline = await fixture("baseline-pass");
const passing = await fixture("leanpowers-pass");
const liveBaseline = asLive(baseline);
const livePassing = asLive(passing);

function asLive(run) {
  const live = structuredClone(run);
  live.provenance = "live";
  for (const category of live.categories) {
    if (category.strict_rerun) {
      category.strict_rerun.provenance = "live";
    }
  }
  return live;
}

function withLearningEvidence(run, overrides = {}) {
  const result = structuredClone(run);
  const category = result.categories.find(
    ({ name }) => name === "multi-turn-feedback-learning",
  );
  result.learning_evidence = {
    scenario: "multi-turn-feedback-learning",
    related_task_accuracy: structuredClone(category.task_success),
    unrelated_task_contamination_count: 0,
    safety_gate_bypass_count: 0,
    max_retrieved_lessons: 3,
    ...overrides,
  };
  return result;
}

function withRelatedAccuracy(run, passed) {
  const result = withLearningEvidence(run);
  const category = result.categories.find(
    ({ name }) => name === "multi-turn-feedback-learning",
  );
  const delta = passed - category.task_success.passed;
  category.task_success.passed = passed;
  result.quality.task_success.passed += delta;
  result.learning_evidence.related_task_accuracy.passed = passed;
  return result;
}

function withoutLearningScenario(run) {
  const result = structuredClone(run);
  const category = result.categories.find(
    ({ name }) => name === "multi-turn-feedback-learning",
  );
  result.coverage.scenario_classes = result.coverage.scenario_classes.filter(
    (name) => name !== "multi-turn-feedback-learning",
  );
  result.categories = result.categories.filter(
    ({ name }) => name !== "multi-turn-feedback-learning",
  );
  result.coverage.planned_cases -= category.task_success.total;
  result.coverage.completed_cases -= category.task_success.total;
  result.quality.task_success.total -= category.task_success.total;
  result.quality.task_success.passed -= category.task_success.passed;
  result.quality.introduced_regressions.total -= category.task_success.total;
  result.quality.scope_violations.total -= category.task_success.total;
  return result;
}

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

test("benchmark result schema requires closed four-turn learning evidence", async () => {
  const schema = await benchmarkSchema();

  assert.equal(schema.properties.schema_version.const, 2);
  assert.ok(schema.required.includes("learning_evidence"));
  assert.deepEqual(schema.properties.learning_evidence, {
    "$ref": "#/$defs/learningEvidence",
  });
  assert.equal(schema.$defs.learningEvidence.additionalProperties, false);
  assert.deepEqual(schema.$defs.learningEvidence.required, [
    "scenario",
    "related_task_accuracy",
    "unrelated_task_contamination_count",
    "safety_gate_bypass_count",
    "max_retrieved_lessons",
  ]);
});

test("the canonical suite defines the four-turn feedback-learning scenario and gates", async () => {
  const catalog = await suite();
  const scenario = catalog.scenario_protocols?.["multi-turn-feedback-learning"];

  assert.equal(catalog.schema_version, 1);
  assert.equal(catalog.result_integrity.schema_version, 2);
  assert.ok(catalog.scenario_classes.includes("multi-turn-feedback-learning"));
  assert.deepEqual(scenario?.turns, [
    "plausible-wrong-project-assumption",
    "explicit-corrective-feedback",
    "related-task-generalization",
    "unrelated-task-isolation",
  ]);
  assert.deepEqual(scenario?.release_gates, {
    related_task_accuracy: "improves-over-baseline",
    retrieval_lessons_max: 3,
    safety_gate_bypass_max: 0,
    unrelated_task_contamination_max: 0,
  });
});

test("all checked-in scorer fixtures are truthful simulated 0.2.0 data with learning coverage", async () => {
  for (const name of [
    "baseline-pass",
    "leanpowers-pass",
    "quality-regression",
    "critical-escape",
  ]) {
    const run = await fixture(name);
    assert.equal(run.provenance, "simulated", name);
    assert.equal(run.coverage.completed_cases, 110, name);
    assert.ok(run.coverage.scenario_classes.includes("multi-turn-feedback-learning"), name);
    assert.ok(run.categories.some((category) => category.name === "multi-turn-feedback-learning"), name);
    if (run.workflow.startsWith("leanpowers-")) {
      assert.equal(run.workflow, "leanpowers-0.2.0", name);
    }
  }
});

test("schema version 2 is the only accepted benchmark result version", () => {
  const legacy = structuredClone(passing);
  legacy.schema_version = 1;
  assert.ok(
    validateBenchmarkRun(legacy).some((error) => error.includes("schema_version must equal 2")),
  );

  const future = structuredClone(passing);
  future.schema_version = 3;
  assert.ok(
    validateBenchmarkRun(future).some((error) => error.includes("schema_version must equal 2")),
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

test("learning evidence validates bounds and reconciles to its scenario category", () => {
  const valid = withLearningEvidence(passing);
  assert.deepEqual(validateBenchmarkRun(valid), []);

  const impossibleAccuracy = structuredClone(valid);
  impossibleAccuracy.learning_evidence.related_task_accuracy.passed = 11;
  assert.ok(
    validateBenchmarkRun(impossibleAccuracy).some((error) =>
      error.includes("learning_evidence.related_task_accuracy.passed cannot exceed total"),
    ),
  );

  const excessiveContamination = structuredClone(valid);
  excessiveContamination.learning_evidence.unrelated_task_contamination_count = 11;
  assert.ok(
    validateBenchmarkRun(excessiveContamination).some((error) =>
      error.includes("unrelated_task_contamination_count cannot exceed related task total"),
    ),
  );

  const negativeRetrieval = structuredClone(valid);
  negativeRetrieval.learning_evidence.max_retrieved_lessons = -1;
  assert.ok(
    validateBenchmarkRun(negativeRetrieval).some((error) =>
      error.includes("learning_evidence.max_retrieved_lessons must be an integer >= 0"),
    ),
  );

  const extraField = structuredClone(valid);
  extraField.learning_evidence.raw_turns = [];
  assert.ok(
    validateBenchmarkRun(extraField).some((error) =>
      error.includes("learning_evidence.raw_turns is not allowed"),
    ),
  );

  const malformedCategory = structuredClone(valid);
  malformedCategory.categories[malformedCategory.categories.length - 1] = null;
  assert.doesNotThrow(() => validateBenchmarkRun(malformedCategory));
  assert.ok(
    validateBenchmarkRun(malformedCategory).some((error) =>
      error.includes("categories must include canonical learning scenario"),
    ),
  );

  const categoryMismatch = structuredClone(valid);
  categoryMismatch.learning_evidence.related_task_accuracy.passed -= 1;
  assert.ok(
    validateBenchmarkRun(categoryMismatch).some((error) =>
      error.includes("related_task_accuracy must equal the scenario category task_success"),
    ),
  );
});

test("a comparable non-inferior and materially leaner run passes", () => {
  const result = compareRuns(
    withLearningEvidence(liveBaseline),
    withLearningEvidence(livePassing),
  );
  assert.equal(result.decision, "PASS");
  assert.equal(result.gates.length, 11);
  assert.deepEqual(result.gates.slice(-4), [
    { id: "learning_related_task_accuracy_improves", passed: true },
    { id: "learning_unrelated_task_contamination_zero", passed: true },
    { id: "learning_safety_gate_bypass_zero", passed: true },
    { id: "learning_retrieval_cap", passed: true },
  ]);
  assert.ok(result.efficiency.standard_tokens_reduction >= 0.5);
  assert.deepEqual(result.hard_failures, []);
});

test("missing canonical learning coverage or evidence is diagnostic only", () => {
  const noScenarioBaseline = withoutLearningScenario(
    withLearningEvidence(liveBaseline),
  );
  const noScenarioCandidate = withoutLearningScenario(
    withLearningEvidence(livePassing),
  );
  const noScenario = compareRuns(noScenarioBaseline, noScenarioCandidate);
  assert.equal(noScenario.decision, "DIAGNOSTIC_ONLY");
  assert.equal(noScenario.release_eligible, false);
  assert.ok(noScenario.reasons.some((reason) => reason.includes("canonical learning scenario")));

  const missingEvidence = withLearningEvidence(livePassing);
  delete missingEvidence.learning_evidence;
  const noEvidence = compareRuns(
    withLearningEvidence(liveBaseline),
    missingEvidence,
  );
  assert.equal(noEvidence.decision, "DIAGNOSTIC_ONLY");
  assert.equal(noEvidence.release_eligible, false);
  assert.ok(noEvidence.reasons.some((reason) => reason.includes("learning_evidence")));
});

test("paired categories require identical case totals even when aggregates reconcile", () => {
  const mismatchedBaseline = structuredClone(liveBaseline);
  const learning = mismatchedBaseline.categories.find(
    ({ name }) => name === "multi-turn-feedback-learning",
  );
  const reviewOnly = mismatchedBaseline.categories.find(
    ({ name }) => name === "review-only",
  );
  learning.task_success = { passed: 4, total: 5 };
  mismatchedBaseline.learning_evidence.related_task_accuracy = {
    passed: 4,
    total: 5,
  };
  reviewOnly.task_success.passed += 4;
  reviewOnly.task_success.total += 5;

  assert.deepEqual(validateBenchmarkRun(mismatchedBaseline), []);
  assert.deepEqual(validateBenchmarkRun(livePassing), []);
  const result = compareRuns(mismatchedBaseline, livePassing);
  assert.equal(result.decision, "DIAGNOSTIC_ONLY");
  assert.equal(result.release_eligible, false);
  assert.ok(
    result.reasons.some((reason) =>
      reason.includes("paired category totals do not match: multi-turn-feedback-learning"),
    ),
  );
});

test("every executable learning release gate blocks independently", () => {
  const reference = withLearningEvidence(liveBaseline);
  const mutations = [
    [
      "learning_related_task_accuracy_improves",
      withRelatedAccuracy(livePassing, 8),
    ],
    [
      "learning_unrelated_task_contamination_zero",
      withLearningEvidence(livePassing, {
        unrelated_task_contamination_count: 1,
      }),
    ],
    [
      "learning_safety_gate_bypass_zero",
      withLearningEvidence(livePassing, { safety_gate_bypass_count: 1 }),
    ],
    [
      "learning_retrieval_cap",
      withLearningEvidence(livePassing, { max_retrieved_lessons: 4 }),
    ],
  ];

  for (const [gateId, candidate] of mutations) {
    const result = compareRuns(reference, candidate);
    assert.equal(result.decision, "BLOCK", gateId);
    assert.equal(result.release_eligible, false, gateId);
    assert.deepEqual(
      result.gates.find(({ id }) => id === gateId),
      { id: gateId, passed: false },
      gateId,
    );
  }
});

test("quality regression blocks even when efficiency improves", async () => {
  const result = compareRuns(liveBaseline, asLive(await fixture("quality-regression")));
  assert.equal(result.decision, "BLOCK");
  assert.ok(result.reasons.some((reason) => reason.includes("composite quality")));
  assert.ok(result.gates.slice(-4).every(({ passed }) => passed));
});

test("critical escape dominates aggregate scores", async () => {
  const result = compareRuns(liveBaseline, asLive(await fixture("critical-escape")));
  assert.equal(result.decision, "BLOCK");
  assert.ok(result.hard_failures.some((failure) => failure.includes("critical")));
  assert.ok(result.gates.slice(-4).every(({ passed }) => passed));
});

test("simulated or incomplete runs are diagnostic only", () => {
  const simulated = { ...livePassing, provenance: "simulated" };
  const incomplete = { ...livePassing, completion: "incomplete" };
  assert.equal(compareRuns(liveBaseline, simulated).decision, "DIAGNOSTIC_ONLY");
  assert.equal(compareRuns(liveBaseline, incomplete).decision, "DIAGNOSTIC_ONLY");
});

test("mismatched pairing conditions are diagnostic only", () => {
  const mismatched = {
    ...livePassing,
    conditions: { ...livePassing.conditions, model: "different-model" },
  };
  assert.equal(compareRuns(liveBaseline, mismatched).decision, "DIAGNOSTIC_ONLY");
});

test("paired runs require distinct IDs and deterministic workflow identities", () => {
  const reusedRunId = { ...livePassing, run_id: liveBaseline.run_id };
  assert.equal(compareRuns(liveBaseline, reusedRunId).decision, "DIAGNOSTIC_ONLY");

  const wrongBaseline = { ...liveBaseline, workflow: "leanpowers-0.2.0" };
  assert.equal(compareRuns(wrongBaseline, livePassing).decision, "DIAGNOSTIC_ONLY");

  const wrongCandidate = { ...livePassing, workflow: "superpowers-6.1.1" };
  assert.equal(compareRuns(liveBaseline, wrongCandidate).decision, "DIAGNOSTIC_ONLY");
});

test("all non-inferiority boundaries pass exactly and fail beyond the margin", () => {
  const boundary = structuredClone(livePassing);
  boundary.quality.task_success.passed = 97;
  boundary.categories[1].task_success.passed = 5;
  boundary.categories[1].strict_rerun = {
    run_id: "leanpowers-boundary-multi-file-strict",
    provenance: "live",
    completion: "complete",
    task_success: structuredClone(liveBaseline.categories[1].task_success),
    composite_quality: liveBaseline.categories[1].composite_quality,
  };
  boundary.quality.composite_quality = liveBaseline.quality.composite_quality * 0.95;
  boundary.quality.introduced_regressions.count = 4;
  boundary.quality.scope_violations.count = 3;
  boundary.efficiency.standard.median_tokens = 5000;
  boundary.efficiency.standard.median_wall_seconds = 60;
  boundary.efficiency.standard.median_agent_calls = 2;
  assert.equal(compareRuns(liveBaseline, boundary).decision, "PASS");

  boundary.quality.task_success.passed = 96;
  boundary.categories[1].task_success.passed = 4;
  assert.equal(compareRuns(liveBaseline, boundary).decision, "BLOCK");
});

test("regressing categories require a linked live complete strict rerun that recovers quality", () => {
  const candidate = structuredClone(livePassing);
  const baselineCategory = liveBaseline.categories[0];
  candidate.categories[0].task_success.passed = baselineCategory.task_success.passed - 1;
  candidate.categories[0].strict_rerun = null;
  assert.equal(compareRuns(liveBaseline, candidate).decision, "BLOCK");

  candidate.categories[0].strict_rerun = {
    run_id: "leanpowers-pass-small-explicit-feature-strict",
    provenance: "simulated",
    completion: "complete",
    task_success: structuredClone(baselineCategory.task_success),
    composite_quality: baselineCategory.composite_quality,
  };
  assert.equal(compareRuns(liveBaseline, candidate).decision, "DIAGNOSTIC_ONLY");

  candidate.categories[0].strict_rerun.provenance = "live";
  candidate.categories[0].strict_rerun.completion = "incomplete";
  assert.equal(compareRuns(liveBaseline, candidate).decision, "DIAGNOSTIC_ONLY");

  candidate.categories[0].strict_rerun.completion = "complete";
  candidate.categories[0].strict_rerun.task_success.passed -= 1;
  assert.equal(compareRuns(liveBaseline, candidate).decision, "BLOCK");

  candidate.categories[0].strict_rerun.task_success.passed += 1;
  candidate.categories[0].strict_rerun.composite_quality -= 0.01;
  assert.equal(compareRuns(liveBaseline, candidate).decision, "BLOCK");

  candidate.categories[0].strict_rerun.composite_quality += 0.01;
  assert.equal(compareRuns(liveBaseline, candidate).decision, "PASS");
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
  assert.equal(result.decision, "DIAGNOSTIC_ONLY");
  const markdown = await readFile(path.join(outputDirectory, "comparison.md"), "utf8");
  const json = JSON.parse(
    await readFile(path.join(outputDirectory, "comparison.json"), "utf8"),
  );
  assert.match(markdown, /Quality deltas/);
  assert.match(markdown, /Efficiency deltas/);
  assert.equal(json.decision, "DIAGNOSTIC_ONLY");
});
