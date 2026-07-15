import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { evaluateDevelopmentResultGate } from "../scripts/lib/development-result-gate.mjs";

function passingResult() {
  const cases = ["bounded-header-merge", "stable-window-groups", "stale-alias-cache"];
  const runs = [];
  for (let repetition = 1; repetition <= 2; repetition += 1) {
    for (const caseId of cases) {
      runs.push(
        run(caseId, repetition, "superpowers-6.1.1"),
        run(caseId, repetition, "leanpowers-0.2.0"),
      );
    }
  }
  return {
    schema_version: 2,
    suite_id: "development-effects-performance-confirmatory-2026-07-15",
    completion: "complete",
    frozen_run_contract_verified: true,
    confirmatory_eligible: true,
    repetitions: 2,
    cases: cases.map((id, index) => ({
      id,
      expected_workflow: index === 2 ? "debug" : "build",
      risk_level: "standard",
      scenario_class: index === 2 ? "unknown-cause-defect" : "small-explicit-feature",
    })),
    runs,
    paired: {
      all_pairs: {
        count: 6,
        required_pair_count: 6,
        token_pairs: 6,
        aggregate_model_token_share_pct: 59.5,
        median_wall_reduction_pct: 8.2,
      },
    },
    token_target: {
      metric: "aggregate-model-token-share",
      population: "all-matched-pairs",
      max_share_pct: 60,
    },
    token_target_result: {
      eligible: true,
      eligible_pair_count: 6,
      required_pair_count: 6,
      metric: "aggregate-model-token-share",
      population: "all-matched-pairs",
      observed_share_pct: 59.5,
      threshold_pct: 60,
      status: "PASS",
    },
  };
}

function run(caseId, repetition, workflow) {
  return {
    run_id: `r${repetition}-${caseId}-${workflow}`,
    case_id: caseId,
    repetition,
    workflow,
    agent_completed: true,
    head_unchanged: true,
    verifier_workspace_unchanged: true,
    activation_reported: workflow === "superpowers-6.1.1" ? true : null,
    changes: { product: ["src/index.mjs"], workflow: [], violations: [] },
    outcome: { status: "PASS", reasons: [] },
    workflow_conformance: { status: "PASS", reasons: [] },
  };
}

test("development performance gate passes only the complete quality-first target", () => {
  assert.deepEqual(evaluateDevelopmentResultGate(passingResult()), {
    status: "PASS",
    reasons: [],
    evidence: {
      case_count: 3,
      repetition_count: 2,
      run_count: 12,
      pair_count: 6,
      aggregate_model_token_share_pct: 59.5,
      median_wall_reduction_pct: 8.2,
    },
  });
});

test("every quality, token, and speed boundary fails closed independently", () => {
  const mutations = [
    ["schema-version", (value) => { value.schema_version = 1; }],
    ["suite-id", (value) => { value.suite_id = "development-effects-seen-suite"; }],
    ["completion", (value) => { value.completion = "incomplete"; }],
    ["frozen-contract", (value) => { value.frozen_run_contract_verified = false; }],
    ["confirmatory-eligibility", (value) => { value.confirmatory_eligible = false; }],
    ["matrix-shape", (value) => { value.runs.pop(); }],
    ["run-integrity", (value) => { value.runs[0].head_unchanged = false; }],
    ["task-outcome", (value) => { value.runs[0].outcome.status = "FAIL"; }],
    ["lean-conformance", (value) => { value.runs[1].workflow_conformance.status = "FAIL"; }],
    ["superpowers-activation", (value) => { value.runs[0].activation_reported = false; }],
    ["scope", (value) => { value.runs[1].changes.violations.push("private.txt"); }],
    ["token-target", (value) => {
      value.token_target_result.status = "FAIL";
      value.token_target_result.observed_share_pct = 60.1;
      value.paired.all_pairs.aggregate_model_token_share_pct = 60.1;
    }],
    ["wall-improvement", (value) => { value.paired.all_pairs.median_wall_reduction_pct = 0; }],
  ];

  for (const [expectedReason, mutate] of mutations) {
    const result = passingResult();
    mutate(result);
    const verdict = evaluateDevelopmentResultGate(result);
    assert.equal(verdict.status, "FAIL", expectedReason);
    assert.ok(verdict.reasons.includes(expectedReason), JSON.stringify(verdict));
  }
});

test("CLI exits nonzero for a failed result and emits only gate categories", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "leanpowers-result-gate-"));
  try {
    const resultPath = path.join(root, "result.json");
    const result = passingResult();
    result.runs[1].workflow_conformance.status = "FAIL";
    await writeFile(resultPath, `${JSON.stringify(result)}\n`);
    const execution = spawnSync(
      process.execPath,
      ["scripts/development-result-gate.mjs", "--result", resultPath],
      { cwd: path.resolve(new URL("..", import.meta.url).pathname), encoding: "utf8" },
    );
    assert.equal(execution.status, 1);
    assert.match(execution.stdout, /status=FAIL/);
    assert.match(execution.stdout, /lean-conformance/);
    assert.doesNotMatch(execution.stdout, /stale-alias-cache/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
