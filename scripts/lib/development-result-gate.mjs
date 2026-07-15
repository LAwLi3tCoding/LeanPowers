import { isDeepStrictEqual } from "node:util";

const LEAN_WORKFLOW = "leanpowers-0.2.0";
const SUPERPOWERS_WORKFLOW = "superpowers-6.1.1";
const EXPECTED_SUITE_ID = "development-effects-performance-confirmatory-v2-2026-07-15";
const EXPECTED_SUITE_SHA256 =
  "b0f721408de7bfbe04521d5df68c4d1bf2f5ff57ca5233aae61729a234b6f540";
const EXPECTED_EVIDENCE_LEVEL = "paired-development-heldout";
const REQUIRED_REPETITIONS = 2;
const TARGET_TOKEN_SHARE_PCT = 60;
const NEAR_TARGET_MAX_TOKEN_SHARE_PCT = 65;
const MAX_MEDIAN_WALL_SLOWDOWN_PCT = 20;
const EXPECTED_CASES = [
  {
    id: "coalesced-half-open-intervals",
    expected_workflow: "build",
    risk_level: "standard",
    scenario_class: "small-explicit-feature",
    snapshot: {
      mutants_sha256: "b6d730105248f9c4dd621c8e90c395e8b7e3cf375a0f41414fc3614adb669937",
      verifier_sha256: "d6601ae710dbcaa7d603b1f432a255cbef1f072b422105c84f70245ea54b5cc8",
      workspace_sha256: "c3656fd00128b0247a2d644262d12e431515fb96ab649cfedd1d171f9d1bf469",
    },
  },
  {
    id: "escaped-field-parser",
    expected_workflow: "build",
    risk_level: "standard",
    scenario_class: "small-explicit-feature",
    snapshot: {
      mutants_sha256: "b03979d6bc93ece6c3a9cf0e4214116068c58c9bf4f66e77110c98868993d87a",
      verifier_sha256: "2463ff4b071df34a75afba6ffb02988db95bd764d74a1ac08d5f1c478f9de700",
      workspace_sha256: "8e2991981e823e4006dfc76dc74a4dcb81083b8ae77841313967ad6a32dee7f5",
    },
  },
  {
    id: "transactional-batch-flush",
    expected_workflow: "debug",
    risk_level: "standard",
    scenario_class: "unknown-cause-defect",
    snapshot: {
      mutants_sha256: "95e25ae14050943ef57e3b7086c1a4c98964f99e6396c1cd172655fef31670b0",
      verifier_sha256: "b79a524e7aae87e6396cbdaaa7a90497c9a59b96ca3a24a768821c45af618f97",
      workspace_sha256: "8ee9a973abfa9274e1988f9d6a694f8a42ab3b7fc9a1d4e7c3794c44f67e9ee3",
    },
  },
];
const EXPECTED_CASE_IDS = EXPECTED_CASES.map(({ id }) => id);
const EXPECTED_CASES_BY_ID = new Map(EXPECTED_CASES.map((entry) => [entry.id, entry]));
const REQUIRED_PAIR_COUNT = EXPECTED_CASES.length * REQUIRED_REPETITIONS;

export function evaluateDevelopmentResultGate(result) {
  const reasons = new Set();
  const advisories = new Set();
  const object = result !== null && typeof result === "object" && !Array.isArray(result)
    ? result
    : {};
  const cases = Array.isArray(object.cases) ? object.cases : [];
  const runs = Array.isArray(object.runs) ? object.runs : [];
  const pairs = object.paired?.all_pairs;
  const tokenResult = object.token_target_result;

  if (object.schema_version !== 2) reasons.add("schema-version");
  if (object.suite_id !== EXPECTED_SUITE_ID) reasons.add("suite-id");
  if (object.suite_sha256 !== EXPECTED_SUITE_SHA256) reasons.add("suite-sha");
  if (object.evidence_level !== EXPECTED_EVIDENCE_LEVEL) reasons.add("evidence-level");
  if (object.completion !== "complete") reasons.add("completion");
  if (object.frozen_run_contract_verified !== true) reasons.add("frozen-contract");
  if (object.confirmatory_eligible !== true) reasons.add("confirmatory-eligibility");

  const caseIds = cases.map((entry) => entry?.id);
  const caseSetValid =
    cases.length === EXPECTED_CASES.length &&
    new Set(caseIds).size === EXPECTED_CASES.length &&
    isDeepStrictEqual([...caseIds].sort(), [...EXPECTED_CASE_IDS].sort());
  if (!caseSetValid) reasons.add("case-set");
  if (caseSetValid && cases.some((entry) => {
    const expected = EXPECTED_CASES_BY_ID.get(entry.id);
    return !isDeepStrictEqual(entry, {
      id: expected.id,
      expected_workflow: expected.expected_workflow,
      risk_level: expected.risk_level,
      scenario_class: expected.scenario_class,
    });
  })) {
    reasons.add("case-metadata");
  }

  const resultSnapshots = Array.isArray(object.case_snapshots)
    ? object.case_snapshots
    : [];
  const caseSnapshotsValid =
    resultSnapshots.length === EXPECTED_CASES.length &&
    new Set(resultSnapshots.map(({ id }) => id)).size === EXPECTED_CASES.length &&
    resultSnapshots.every((entry) => {
      const expected = EXPECTED_CASES_BY_ID.get(entry?.id);
      return expected !== undefined && isDeepStrictEqual(entry, {
        id: expected.id,
        ...expected.snapshot,
      });
    });
  if (!caseSnapshotsValid) reasons.add("case-snapshots");

  const expectedRunKeys = new Set();
  for (let repetition = 1; repetition <= REQUIRED_REPETITIONS; repetition += 1) {
    for (const caseId of EXPECTED_CASE_IDS) {
      expectedRunKeys.add(`${repetition}\0${caseId}\0${SUPERPOWERS_WORKFLOW}`);
      expectedRunKeys.add(`${repetition}\0${caseId}\0${LEAN_WORKFLOW}`);
    }
  }
  const observedRunKeys = runs.map((run) =>
    `${run?.repetition}\0${run?.case_id}\0${run?.workflow}`
  );
  const matrixShapeValid =
    object.repetitions === REQUIRED_REPETITIONS &&
    runs.length === REQUIRED_PAIR_COUNT * 2 &&
    observedRunKeys.length === new Set(observedRunKeys).size &&
    observedRunKeys.every((key) => expectedRunKeys.has(key));
  if (!matrixShapeValid) reasons.add("matrix-shape");
  if (runs.some((run) => {
    const expected = EXPECTED_CASES_BY_ID.get(run?.case_id);
    return expected === undefined || !isDeepStrictEqual(run?.case_snapshot, expected.snapshot);
  })) {
    reasons.add("run-case-snapshot");
  }

  if (runs.some((run) =>
    run?.agent_completed !== true ||
    run?.head_unchanged !== true ||
    run?.verifier_workspace_unchanged !== true
  )) {
    reasons.add("run-integrity");
  }
  if (runs.some((run) => run?.outcome?.status !== "PASS")) {
    reasons.add("task-outcome");
  }

  const leanRuns = runs.filter((run) => run?.workflow === LEAN_WORKFLOW);
  if (
    leanRuns.length !== REQUIRED_PAIR_COUNT ||
    leanRuns.some((run) => run?.workflow_conformance?.status !== "PASS")
  ) {
    reasons.add("lean-conformance");
  }
  const superpowersRuns = runs.filter((run) => run?.workflow === SUPERPOWERS_WORKFLOW);
  if (
    superpowersRuns.length !== REQUIRED_PAIR_COUNT ||
    superpowersRuns.some((run) => run?.activation_reported !== true)
  ) {
    reasons.add("superpowers-activation");
  }
  if (runs.some((run) =>
    !Array.isArray(run?.changes?.violations) || run.changes.violations.length > 0
  )) {
    reasons.add("scope");
  }

  const observedTokenShare = finiteNumber(tokenResult?.observed_share_pct);
  const pairedTokenShare = finiteNumber(pairs?.aggregate_model_token_share_pct);
  const expectedTokenStatus = observedTokenShare !== null &&
    observedTokenShare <= TARGET_TOKEN_SHARE_PCT
    ? "PASS"
    : "FAIL";
  const tokenTargetContractValid =
    object.token_target?.metric === "aggregate-model-token-share" &&
    object.token_target?.population === "all-matched-pairs" &&
    object.token_target?.max_share_pct === TARGET_TOKEN_SHARE_PCT &&
    tokenResult?.eligible === true &&
    tokenResult?.eligible_pair_count === REQUIRED_PAIR_COUNT &&
    tokenResult?.required_pair_count === REQUIRED_PAIR_COUNT &&
    tokenResult?.metric === "aggregate-model-token-share" &&
    tokenResult?.population === "all-matched-pairs" &&
    tokenResult?.threshold_pct === TARGET_TOKEN_SHARE_PCT &&
    tokenResult?.status === expectedTokenStatus &&
    observedTokenShare !== null &&
    pairs?.count === REQUIRED_PAIR_COUNT &&
    pairs?.required_pair_count === REQUIRED_PAIR_COUNT &&
    pairs?.token_pairs === REQUIRED_PAIR_COUNT &&
    pairedTokenShare !== null &&
    Math.abs(pairedTokenShare - observedTokenShare) < 1e-9;
  let tokenTargetAssessment = "miss";
  if (tokenTargetContractValid && observedTokenShare <= TARGET_TOKEN_SHARE_PCT) {
    tokenTargetAssessment = "met";
  } else if (
    tokenTargetContractValid &&
    observedTokenShare <= NEAR_TARGET_MAX_TOKEN_SHARE_PCT
  ) {
    tokenTargetAssessment = "near-target";
    advisories.add("token-near-target");
  } else {
    reasons.add("token-target");
  }

  const wallReduction = finiteNumber(pairs?.median_wall_reduction_pct);
  const runWallTelemetryValid = runs.every((run) =>
    Number.isFinite(run?.wall_seconds) &&
    run.wall_seconds > 0 &&
    Number.isFinite(run?.final_attempt_wall_seconds) &&
    run.final_attempt_wall_seconds === run.wall_seconds &&
    Number.isSafeInteger(run?.attempt_count) &&
    run.attempt_count >= 1 &&
    run.attempt_count <= 2 &&
    Number.isSafeInteger(run?.capacity_retry_count) &&
    run.capacity_retry_count === run.attempt_count - 1 &&
    Number.isFinite(run?.infrastructure_retry_wall_seconds) &&
    run.infrastructure_retry_wall_seconds >= 0 &&
    (run.attempt_count !== 1 || run.infrastructure_retry_wall_seconds === 0)
  );
  if (
    wallReduction === null ||
    pairs?.wall_pairs !== REQUIRED_PAIR_COUNT ||
    !runWallTelemetryValid
  ) {
    reasons.add("wall-telemetry");
  } else if (wallReduction < -MAX_MEDIAN_WALL_SLOWDOWN_PCT) {
    reasons.add("wall-regression");
  } else if (wallReduction <= 0) {
    advisories.add("wall-not-improved");
  }

  return {
    status: reasons.size > 0
      ? "FAIL"
      : tokenTargetAssessment === "near-target" ? "REVIEW" : "PASS",
    reasons: [...reasons],
    advisories: [...advisories],
    evidence: {
      case_count: cases.length,
      repetition_count: Number.isSafeInteger(object.repetitions) ? object.repetitions : null,
      run_count: runs.length,
      pair_count: Number.isSafeInteger(pairs?.count) ? pairs.count : null,
      aggregate_model_token_share_pct: observedTokenShare,
      token_target_assessment: tokenTargetAssessment,
      median_wall_reduction_pct: wallReduction,
    },
  };
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
