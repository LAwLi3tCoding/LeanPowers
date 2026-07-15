import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  caseSnapshotContract,
  evaluateRunOutcome,
  evaluateWorkflowConformance,
  loadDevelopmentSuite,
  renderDevelopmentReport,
  summarizeArtifactRegressionEvidence,
} from "../scripts/lib/development-benchmark.mjs";
import { evaluateDevelopmentResultGate } from "../scripts/lib/development-result-gate.mjs";

const suitePath = new URL(
  "../evals/development-effects/performance-confirmatory-v2-suite.json",
  import.meta.url,
);
const frozenSuite = await loadDevelopmentSuite(suitePath);
const evaluatorRevision = "a".repeat(40);

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
  const cases = frozenSuite.cases.map(
    ({ id, expected_workflow, risk_level, scenario_class }) => ({
      id,
      expected_workflow,
      risk_level,
      scenario_class,
    }),
  );
  const runs = [];
  for (let repetition = 1; repetition <= 2; repetition += 1) {
    for (const benchmarkCase of frozenSuite.cases) {
      for (const workflow of frozenSuite.workflow_order[repetition - 1]) {
        runs.push(run(benchmarkCase, repetition, workflow));
      }
    }
  }
  const baselineTokens = runs
    .filter(({ workflow }) => workflow === "superpowers-6.1.1")
    .reduce((sum, item) => sum + item.telemetry.tokens.total, 0);
  const candidateTokens = runs
    .filter(({ workflow }) => workflow === "leanpowers-0.2.0")
    .reduce((sum, item) => sum + item.telemetry.tokens.total, 0);
  const tokenShare = candidateTokens / baselineTokens * 100;
  return {
    schema_version: 2,
    suite_id: "development-effects-performance-confirmatory-v2-2026-07-15",
    suite_sha256: "b0f721408de7bfbe04521d5df68c4d1bf2f5ff57ca5233aae61729a234b6f540",
    evidence_level: "paired-development-heldout",
    completion: "complete",
    frozen_run_contract_verified: true,
    confirmatory_eligible: true,
    activation_mode: "explicit-entrypoint",
    runtime: {
      model: "gpt-5.3-codex-spark",
      effort: "low",
      sandbox: "permissions-profile",
      permission_profile: "benchmark",
      agent_read_isolation: "codex-minimal-workspace-plugin-toolchain-read-v1",
      agent_read_isolation_preflight: "PASS",
      approval: "never",
      user_plugins: "isolated",
      evaluator_revision: evaluatorRevision,
      workflow_revisions: {
        "leanpowers-0.2.0": evaluatorRevision,
        "superpowers-6.1.1": "d884ae04edebef577e82ff7c4e143debd0bbec99",
      },
    },
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
        aggregate_model_tokens: {
          baseline: baselineTokens,
          candidate: candidateTokens,
        },
        aggregate_model_token_share_pct: tokenShare,
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
      observed_share_pct: tokenShare,
      threshold_pct: 60,
      status: "PASS",
    },
  };
}

function run(benchmarkCase, repetition, workflow) {
  const tokenShape = workflow === "superpowers-6.1.1"
    ? { input: 1800, cached_input: 1000, output: 200 }
    : { input: 1000, cached_input: 500, output: 190 };
  const commandEvidence = (exitCode = 0) => ({
    exit_code: exitCode,
    output: exitCode === 0 ? "ok" : "expected mutant failure",
    output_limited: false,
    sandbox: "macos-seatbelt-hermetic-v2",
    signal: null,
    timed_out: false,
  });
  const requiredGates = benchmarkCase.artifact_regression_gates.map((gate) => ({
    id: gate.id,
    policy: gate.policy,
    target: gate.target,
    export_name: gate.export_name,
    member_count: gate.mutations.length,
    mutation_manifest_sha256: gate.mutation_manifest_sha256,
  }));
  const artifactRegression = {
    status: "PASS",
    required_gate_ids: requiredGates.map(({ id }) => id),
    gates: benchmarkCase.artifact_regression_gates.map((gate) => ({
      candidate_visible_test_paths: ["test/gate.test.mjs"],
      changed_visible_test_paths: ["test/gate.test.mjs"],
      export_name: gate.export_name,
      id: gate.id,
      member_count: gate.mutations.length,
      members: gate.mutations.map((mutation, index) => ({
        baseline_tests_mutant_visible: commandEvidence(0),
        candidate_tests_mutant_visible: commandEvidence(1),
        index: index + 1,
        killed: true,
        replacement_sha256: mutation.replacement_sha256,
      })),
      mutation_manifest_sha256: gate.mutation_manifest_sha256,
      policy: gate.policy,
      reasons: [],
      status: "PASS",
      target: gate.target,
    })),
  };
  const value = {
    run_id: `r${repetition}-${benchmarkCase.id}-${workflow}`,
    case_id: benchmarkCase.id,
    repetition,
    workflow,
    scenario_class: benchmarkCase.scenario_class,
    risk_level: benchmarkCase.risk_level,
    expected_workflow: benchmarkCase.expected_workflow,
    declared_workflow: benchmarkCase.expected_workflow,
    declared_risk: benchmarkCase.risk_level,
    route_ledger_reported: workflow === "leanpowers-0.2.0" ? true : null,
    case_snapshot: caseSnapshotContract(benchmarkCase),
    attempt_count: 1,
    capacity_retry_count: 0,
    final_attempt_wall_seconds: workflow === "superpowers-6.1.1" ? 10 : 9.18,
    infrastructure_retry_wall_seconds: 0,
    wall_seconds: workflow === "superpowers-6.1.1" ? 10 : 9.18,
    agent_exit_code: 0,
    agent_timed_out: false,
    agent_completed: true,
    head_unchanged: true,
    verifier_workspace_unchanged: true,
    activation_reported: true,
    telemetry: {
      tokens: {
        ...tokenShape,
        reasoning_output: 0,
        total: tokenShape.input + tokenShape.output,
        uncached_plus_output:
          tokenShape.input - tokenShape.cached_input + tokenShape.output,
        telemetry_complete: true,
      },
      workflow_trace: {
        capsule_stage: {
          route_declarations_consistent: true,
          risk_monotonic_observed: true,
          ledger_before_tools_observed: true,
          quality_pre_change_evidence_observed: true,
          quality_read_observed: true,
          quality_patch_targets_read_observed: true,
          reproduce_observed: benchmarkCase.expected_workflow === "debug",
          patch_protocol_observed: true,
          debug_recovery_count: 0,
          debug_recovery_protocol_observed: true,
          quality_validation_observed: true,
          final_stop_observed: true,
          highest_presented_risk: benchmarkCase.risk_level,
        },
      },
    },
    changes: { product: ["src/index.mjs"], workflow: [], violations: [] },
    required_artifact_regression_gate_ids: requiredGates.map(({ id }) => id),
    required_artifact_regression_gates: requiredGates,
    verifier: {
      visible: commandEvidence(0),
      hidden: commandEvidence(0),
      artifact_regression: artifactRegression,
    },
  };
  value.outcome = evaluateRunOutcome(value);
  value.workflow_conformance = evaluateWorkflowConformance(value);
  return value;
}

function setCandidateTokenShare(result, sharePct) {
  const candidateTotal = Math.round(2000 * sharePct / 100);
  for (const run of result.runs.filter(
    ({ workflow }) => workflow === "leanpowers-0.2.0",
  )) {
    const tokens = run.telemetry.tokens;
    tokens.input = candidateTotal - tokens.output;
    tokens.total = candidateTotal;
    tokens.uncached_plus_output = tokens.input - tokens.cached_input + tokens.output;
  }
  const baseline = result.runs
    .filter(({ workflow }) => workflow === "superpowers-6.1.1")
    .reduce((sum, run) => sum + run.telemetry.tokens.total, 0);
  const candidate = result.runs
    .filter(({ workflow }) => workflow === "leanpowers-0.2.0")
    .reduce((sum, run) => sum + run.telemetry.tokens.total, 0);
  result.paired.all_pairs.aggregate_model_tokens = { baseline, candidate };
  result.paired.all_pairs.aggregate_model_token_share_pct = candidate / baseline * 100;
  result.token_target_result.observed_share_pct = candidate / baseline * 100;
  result.token_target_result.status = sharePct <= 60 ? "PASS" : "FAIL";
}

test("development performance gate passes only the complete quality-first target", () => {
  const result = passingResult();
  assert.deepEqual(
    result.runs.filter(({ workflow }) => workflow === "leanpowers-0.2.0")
      .map(({ workflow_conformance }) => workflow_conformance),
    Array.from({ length: 6 }, () => ({ status: "PASS", reasons: [] })),
  );
  assert.deepEqual(evaluateDevelopmentResultGate(result), {
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

test("gate requires complete positive per-run token telemetry and consistent arithmetic", () => {
  for (const mutate of [
    (value) => { delete value.runs[0].telemetry.tokens; },
    (value) => { value.runs[0].telemetry.tokens.telemetry_complete = false; },
    (value) => { value.runs[0].telemetry.tokens.input += 1; },
    (value) => { value.runs[0].telemetry.tokens.total = 0; },
  ]) {
    const result = passingResult();
    mutate(result);
    const verdict = evaluateDevelopmentResultGate(result);
    assert.equal(verdict.status, "FAIL", JSON.stringify(verdict));
    assert.ok(verdict.reasons.includes("token-telemetry"), JSON.stringify(verdict));
  }
});

test("gate recomputes aggregate token totals and share from exact run telemetry", () => {
  const result = passingResult();
  result.paired.all_pairs.aggregate_model_tokens.candidate = 7000;
  const tamperedShare = 7000 / result.paired.all_pairs.aggregate_model_tokens.baseline * 100;
  result.paired.all_pairs.aggregate_model_token_share_pct = tamperedShare;
  result.token_target_result.observed_share_pct = tamperedShare;

  const verdict = evaluateDevelopmentResultGate(result);
  assert.equal(verdict.status, "FAIL");
  assert.ok(verdict.reasons.includes("token-summary"), JSON.stringify(verdict));
});

test("gate validates frozen runtime, exact order, and workflow revisions", () => {
  const mutations = [
    ["runtime-model", (value) => { value.runtime.model = "different-model"; }],
    ["runtime-effort", (value) => { value.runtime.effort = "medium"; }],
    ["runtime-isolation", (value) => {
      value.runtime.agent_read_isolation = "different-isolation";
    }],
    ["runtime-isolation", (value) => {
      value.runtime.agent_read_isolation_preflight = "FAIL";
    }],
    ["runtime-approval", (value) => { value.runtime.approval = "on-request"; }],
    ["runtime-plugin-isolation", (value) => { value.runtime.user_plugins = "inherited"; }],
    ["workflow-revisions", (value) => {
      value.runtime.workflow_revisions["superpowers-6.1.1"] = "b".repeat(40);
    }],
    ["workflow-revisions", (value) => {
      value.runtime.workflow_revisions["leanpowers-0.2.0"] = "b".repeat(40);
    }],
    ["run-order", (value) => {
      [value.runs[0], value.runs[1]] = [value.runs[1], value.runs[0]];
    }],
  ];
  for (const [reason, mutate] of mutations) {
    const result = passingResult();
    mutate(result);
    const verdict = evaluateDevelopmentResultGate(result);
    assert.equal(verdict.status, "FAIL", reason);
    assert.ok(verdict.reasons.includes(reason), JSON.stringify(verdict));
  }
});

test("gate recomputes task outcome and Lean conformance instead of trusting PASS summaries", () => {
  const outcomeTamper = passingResult();
  outcomeTamper.runs[0].verifier.visible.exit_code = 1;
  let verdict = evaluateDevelopmentResultGate(outcomeTamper);
  assert.equal(verdict.status, "FAIL");
  assert.ok(verdict.reasons.includes("outcome-consistency"), JSON.stringify(verdict));

  const conformanceTamper = passingResult();
  const lean = conformanceTamper.runs.find(({ workflow }) => workflow === "leanpowers-0.2.0");
  lean.telemetry.workflow_trace.capsule_stage.patch_protocol_observed = false;
  verdict = evaluateDevelopmentResultGate(conformanceTamper);
  assert.equal(verdict.status, "FAIL");
  assert.ok(
    verdict.reasons.includes("lean-conformance-consistency"),
    JSON.stringify(verdict),
  );
});

test("gate accepts the exact published artifact summary without outcome drift", () => {
  const result = passingResult();
  for (const run of result.runs) {
    run.verifier.artifact_regression = summarizeArtifactRegressionEvidence(
      run.verifier.artifact_regression,
    );
  }

  const verdict = evaluateDevelopmentResultGate(result);
  assert.equal(verdict.status, "PASS", JSON.stringify(verdict));
  assert.ok(!verdict.reasons.includes("outcome-consistency"));
});

test("gate rejects an exhausted capacity retry even when summaries claim success", () => {
  const result = passingResult();
  Object.assign(result.runs[0], {
    attempt_count: 2,
    capacity_retry_count: 1,
    capacity_retry_exhausted: true,
    infrastructure_retry_wall_seconds: 1,
  });
  const verdict = evaluateDevelopmentResultGate(result);
  assert.equal(verdict.status, "FAIL");
  assert.ok(verdict.reasons.includes("infrastructure-failure"), JSON.stringify(verdict));

  const marked = passingResult();
  marked.runs[0].infrastructure_failure = { kind: "capacity", exhausted: true };
  const markedVerdict = evaluateDevelopmentResultGate(marked);
  assert.equal(markedVerdict.status, "FAIL");
  assert.ok(
    markedVerdict.reasons.includes("infrastructure-failure"),
    JSON.stringify(markedVerdict),
  );
});

test("explicit suite contract supports new pinned Lean, evaluator, and runner revisions", () => {
  const suite = structuredClone(frozenSuite);
  suite.suite_id = "development-effects-performance-confirmatory-v3-test";
  suite.suite_sha256 = "c".repeat(64);
  suite.freeze_contract.leanpowers_revision = evaluatorRevision;
  suite.freeze_contract.evaluator_revision = "b".repeat(40);
  suite.freeze_contract.runner_revision = "d".repeat(40);
  const result = passingResult();
  result.suite_id = suite.suite_id;
  result.suite_sha256 = suite.suite_sha256;
  result.runtime.evaluator_revision = suite.freeze_contract.evaluator_revision;
  result.runtime.runner_revision = suite.freeze_contract.runner_revision;

  assert.equal(evaluateDevelopmentResultGate(result, { suite }).status, "PASS");
  for (const field of ["leanpowers_revision", "evaluator_revision", "runner_revision"]) {
    const tampered = structuredClone(result);
    if (field === "leanpowers_revision") {
      tampered.runtime.workflow_revisions["leanpowers-0.2.0"] = "e".repeat(40);
    } else {
      tampered.runtime[field] = "e".repeat(40);
    }
    const verdict = evaluateDevelopmentResultGate(tampered, { suite });
    assert.equal(verdict.status, "FAIL", field);
    assert.ok(verdict.reasons.includes("workflow-revisions"), JSON.stringify(verdict));
  }

  const partialSuite = structuredClone(frozenSuite);
  partialSuite.freeze_contract.leanpowers_revision = evaluatorRevision;
  const partialVerdict = evaluateDevelopmentResultGate(passingResult(), {
    suite: partialSuite,
  });
  assert.equal(partialVerdict.status, "FAIL");
  assert.ok(
    partialVerdict.reasons.includes("suite-contract"),
    JSON.stringify(partialVerdict),
  );
});

test("categorized exact report contract requires the canonical rendered artifact", () => {
  const suite = structuredClone(frozenSuite);
  suite.suite_id = "development-effects-categorized-report-test";
  suite.suite_sha256 = "f".repeat(64);
  suite.report_contract = "categorized-exact-render-v1";
  const result = passingResult();
  result.suite_id = suite.suite_id;
  result.suite_sha256 = suite.suite_sha256;
  const report = renderDevelopmentReport(result);

  assert.equal(
    evaluateDevelopmentResultGate(result, { report, suite }).status,
    "PASS",
  );
  for (const candidate of [undefined, `${report}\nchanged`]) {
    const verdict = evaluateDevelopmentResultGate(result, {
      report: candidate,
      suite,
    });
    assert.equal(verdict.status, "FAIL");
    assert.ok(verdict.reasons.includes("report-artifact"), JSON.stringify(verdict));
  }
  assert.doesNotThrow(() =>
    evaluateDevelopmentResultGate({}, { report: "", suite })
  );
});

test("explicit current v2 suite preserves the legacy no-suite verdict", () => {
  const passing = passingResult();
  assert.deepEqual(
    evaluateDevelopmentResultGate(passing, { suite: frozenSuite }),
    evaluateDevelopmentResultGate(passing),
  );
  passing.runs[0].telemetry.tokens.telemetry_complete = false;
  assert.deepEqual(
    evaluateDevelopmentResultGate(passing, { suite: frozenSuite }),
    evaluateDevelopmentResultGate(passing),
  );
});

test("malformed run entries fail closed without throwing", () => {
  const result = passingResult();
  result.runs[0] = null;
  let verdict;
  assert.doesNotThrow(() => {
    verdict = evaluateDevelopmentResultGate(result);
  });
  assert.equal(verdict.status, "FAIL");
  assert.ok(verdict.reasons.includes("run-shape"), JSON.stringify(verdict));
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
    ["wall-summary", (value) => { value.paired.all_pairs.median_wall_reduction_pct = -20.1; }],
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
  setCandidateTokenShare(nearTarget, 62);
  const accepted = evaluateDevelopmentResultGate(nearTarget);
  assert.equal(accepted.status, "REVIEW");
  assert.deepEqual(accepted.advisories, ["token-near-target"]);
  assert.equal(accepted.evidence.token_target_assessment, "near-target");

  const missed = structuredClone(nearTarget);
  setCandidateTokenShare(missed, 65.1);
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
    setCandidateTokenShare(result, 62);
    await writeFile(resultPath, `${JSON.stringify(result)}\n`);
    const execution = spawnSync(
      process.execPath,
      [
        "scripts/development-result-gate.mjs",
        "--result",
        resultPath,
        "--suite",
        fileURLToPath(suitePath),
      ],
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
  for (const run of flat.runs.filter(({ workflow }) => workflow === "leanpowers-0.2.0")) {
    run.wall_seconds = 10;
    run.final_attempt_wall_seconds = 10;
  }
  flat.paired.all_pairs.median_wall_reduction_pct = 0;
  const advisory = evaluateDevelopmentResultGate(flat);
  assert.equal(advisory.status, "PASS");
  assert.deepEqual(advisory.advisories, ["wall-not-improved"]);

  const regression = passingResult();
  for (const run of regression.runs.filter(
    ({ workflow }) => workflow === "leanpowers-0.2.0",
  )) {
    run.wall_seconds = 12.01;
    run.final_attempt_wall_seconds = 12.01;
  }
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
