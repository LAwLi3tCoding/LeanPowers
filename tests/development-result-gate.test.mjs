import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { evaluateDevelopmentResultGate } from "../scripts/lib/development-result-gate.mjs";

const snapshots = {
  "coalesced-half-open-intervals": {
    mutants_sha256: "b6d730105248f9c4dd621c8e90c395e8b7e3cf375a0f41414fc3614adb669937",
    verifier_sha256: "d6601ae710dbcaa7d603b1f432a255cbef1f072b422105c84f70245ea54b5cc8",
    workspace_sha256: "c3656fd00128b0247a2d644262d12e431515fb96ab649cfedd1d171f9d1bf469",
  },
  "escaped-field-parser": {
    mutants_sha256: "b03979d6bc93ece6c3a9cf0e4214116068c58c9bf4f66e77110c98868993d87a",
    verifier_sha256: "2463ff4b071df34a75afba6ffb02988db95bd764d74a1ac08d5f1c478f9de700",
    workspace_sha256: "8e2991981e823e4006dfc76dc74a4dcb81083b8ae77841313967ad6a32dee7f5",
  },
  "transactional-batch-flush": {
    mutants_sha256: "95e25ae14050943ef57e3b7086c1a4c98964f99e6396c1cd172655fef31670b0",
    verifier_sha256: "b79a524e7aae87e6396cbdaaa7a90497c9a59b96ca3a24a768821c45af618f97",
    workspace_sha256: "8ee9a973abfa9274e1988f9d6a694f8a42ab3b7fc9a1d4e7c3794c44f67e9ee3",
  },
};

function passingResult() {
  const cases = [
    {
      id: "coalesced-half-open-intervals",
      expected_workflow: "build",
      risk_level: "standard",
      scenario_class: "small-explicit-feature",
    },
    {
      id: "escaped-field-parser",
      expected_workflow: "build",
      risk_level: "standard",
      scenario_class: "small-explicit-feature",
    },
    {
      id: "transactional-batch-flush",
      expected_workflow: "debug",
      risk_level: "standard",
      scenario_class: "unknown-cause-defect",
    },
  ];
  const runs = [];
  for (let repetition = 1; repetition <= 2; repetition += 1) {
    for (const { id: caseId } of cases) {
      runs.push(
        run(caseId, repetition, "superpowers-6.1.1"),
        run(caseId, repetition, "leanpowers-0.2.0"),
      );
    }
  }
  return {
    schema_version: 2,
    suite_id: "development-effects-performance-confirmatory-v2-2026-07-15",
    suite_sha256: "b0f721408de7bfbe04521d5df68c4d1bf2f5ff57ca5233aae61729a234b6f540",
    evidence_level: "paired-development-heldout",
    completion: "complete",
    frozen_run_contract_verified: true,
    confirmatory_eligible: true,
    repetitions: 2,
    cases,
    case_snapshots: cases.map(({ id }) => ({ id, ...snapshots[id] })),
    runs,
    paired: {
      all_pairs: {
        count: 6,
        required_pair_count: 6,
        token_pairs: 6,
        wall_pairs: 6,
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
    case_snapshot: structuredClone(snapshots[caseId]),
    attempt_count: 1,
    capacity_retry_count: 0,
    final_attempt_wall_seconds: workflow === "superpowers-6.1.1" ? 10 : 9.18,
    infrastructure_retry_wall_seconds: 0,
    wall_seconds: workflow === "superpowers-6.1.1" ? 10 : 9.18,
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
    advisories: [],
    evidence: {
      case_count: 3,
      repetition_count: 2,
      run_count: 12,
      pair_count: 6,
      aggregate_model_token_share_pct: 59.5,
      token_target_assessment: "met",
      median_wall_reduction_pct: 8.2,
    },
  });
});

test("every quality, token, and speed boundary fails closed independently", () => {
  const mutations = [
    ["schema-version", (value) => { value.schema_version = 1; }],
    ["suite-id", (value) => { value.suite_id = "development-effects-seen-suite"; }],
    ["suite-sha", (value) => { value.suite_sha256 = "0".repeat(64); }],
    ["evidence-level", (value) => { value.evidence_level = "paired-development-pilot"; }],
    ["case-set", (value) => { value.cases[0].id = "different-case"; }],
    ["case-metadata", (value) => { value.cases[0].risk_level = "lean"; }],
    ["case-snapshots", (value) => { value.case_snapshots[0].workspace_sha256 = "0".repeat(64); }],
    ["run-case-snapshot", (value) => { value.runs[0].case_snapshot.verifier_sha256 = "0".repeat(64); }],
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
      value.token_target_result.observed_share_pct = 65.1;
      value.paired.all_pairs.aggregate_model_token_share_pct = 65.1;
    }],
    ["wall-telemetry", (value) => { value.paired.all_pairs.median_wall_reduction_pct = null; }],
    ["wall-telemetry", (value) => { value.paired.all_pairs.wall_pairs = 5; }],
    ["wall-telemetry", (value) => { value.runs[0].final_attempt_wall_seconds = 9; }],
    ["wall-regression", (value) => { value.paired.all_pairs.median_wall_reduction_pct = -20.1; }],
  ];

  for (const [expectedReason, mutate] of mutations) {
    const result = passingResult();
    mutate(result);
    const verdict = evaluateDevelopmentResultGate(result);
    assert.equal(verdict.status, "FAIL", expectedReason);
    assert.ok(verdict.reasons.includes(expectedReason), JSON.stringify(verdict));
  }
});

test("aggregate token near-target band is advisory, bounded, and quality-gated", () => {
  const nearTarget = passingResult();
  nearTarget.token_target_result.status = "FAIL";
  nearTarget.token_target_result.observed_share_pct = 62;
  nearTarget.paired.all_pairs.aggregate_model_token_share_pct = 62;
  const accepted = evaluateDevelopmentResultGate(nearTarget);
  assert.equal(accepted.status, "REVIEW");
  assert.deepEqual(accepted.advisories, ["token-near-target"]);
  assert.equal(accepted.evidence.token_target_assessment, "near-target");

  const missed = structuredClone(nearTarget);
  missed.token_target_result.observed_share_pct = 65.1;
  missed.paired.all_pairs.aggregate_model_token_share_pct = 65.1;
  const rejected = evaluateDevelopmentResultGate(missed);
  assert.equal(rejected.status, "FAIL");
  assert.ok(rejected.reasons.includes("token-target"));

  const qualityFailure = structuredClone(nearTarget);
  qualityFailure.runs[1].outcome.status = "FAIL";
  assert.equal(evaluateDevelopmentResultGate(qualityFailure).status, "FAIL");
});

test("CLI uses a distinct non-failure review status for a near-target result", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "leanpowers-result-review-"));
  try {
    const resultPath = path.join(root, "result.json");
    const result = passingResult();
    result.token_target_result.status = "FAIL";
    result.token_target_result.observed_share_pct = 62;
    result.paired.all_pairs.aggregate_model_token_share_pct = 62;
    await writeFile(resultPath, `${JSON.stringify(result)}\n`);
    const execution = spawnSync(
      process.execPath,
      ["scripts/development-result-gate.mjs", "--result", resultPath],
      { cwd: path.resolve(new URL("..", import.meta.url).pathname), encoding: "utf8" },
    );
    assert.equal(execution.status, 2);
    assert.match(execution.stdout, /status=REVIEW/);
    assert.match(execution.stdout, /token-near-target/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("speed is secondary but a large median regression still fails closed", () => {
  const flat = passingResult();
  flat.paired.all_pairs.median_wall_reduction_pct = 0;
  const advisory = evaluateDevelopmentResultGate(flat);
  assert.equal(advisory.status, "PASS");
  assert.deepEqual(advisory.advisories, ["wall-not-improved"]);

  const regression = passingResult();
  regression.paired.all_pairs.median_wall_reduction_pct = -20.1;
  assert.equal(evaluateDevelopmentResultGate(regression).status, "FAIL");
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
    assert.doesNotMatch(execution.stdout, /transactional-batch-flush/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
