const LEAN_WORKFLOW = "leanpowers-0.2.0";
const SUPERPOWERS_WORKFLOW = "superpowers-6.1.1";
const EXPECTED_SUITE_ID = "development-effects-performance-confirmatory-2026-07-15";

export function evaluateDevelopmentResultGate(result, {
  maxTokenSharePct = 60,
  requiredCaseCount = 3,
  requiredPairCount = 6,
  requiredRepetitions = 2,
} = {}) {
  const reasons = new Set();
  const object = result !== null && typeof result === "object" && !Array.isArray(result)
    ? result
    : {};
  const cases = Array.isArray(object.cases) ? object.cases : [];
  const runs = Array.isArray(object.runs) ? object.runs : [];
  const pairs = object.paired?.all_pairs;
  const tokenResult = object.token_target_result;

  if (object.schema_version !== 2) reasons.add("schema-version");
  if (object.suite_id !== EXPECTED_SUITE_ID) reasons.add("suite-id");
  if (object.completion !== "complete") reasons.add("completion");
  if (object.frozen_run_contract_verified !== true) reasons.add("frozen-contract");
  if (object.confirmatory_eligible !== true) reasons.add("confirmatory-eligibility");

  const caseIds = cases.map((entry) => entry?.id).filter((id) => typeof id === "string");
  const expectedRunKeys = new Set();
  for (let repetition = 1; repetition <= requiredRepetitions; repetition += 1) {
    for (const caseId of caseIds) {
      expectedRunKeys.add(`${repetition}\0${caseId}\0${SUPERPOWERS_WORKFLOW}`);
      expectedRunKeys.add(`${repetition}\0${caseId}\0${LEAN_WORKFLOW}`);
    }
  }
  const observedRunKeys = runs.map((run) =>
    `${run?.repetition}\0${run?.case_id}\0${run?.workflow}`
  );
  const matrixShapeValid =
    cases.length === requiredCaseCount &&
    new Set(caseIds).size === requiredCaseCount &&
    object.repetitions === requiredRepetitions &&
    runs.length === requiredPairCount * 2 &&
    expectedRunKeys.size === requiredPairCount * 2 &&
    observedRunKeys.length === new Set(observedRunKeys).size &&
    observedRunKeys.every((key) => expectedRunKeys.has(key));
  if (!matrixShapeValid) reasons.add("matrix-shape");

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
    leanRuns.length !== requiredPairCount ||
    leanRuns.some((run) => run?.workflow_conformance?.status !== "PASS")
  ) {
    reasons.add("lean-conformance");
  }
  const superpowersRuns = runs.filter((run) => run?.workflow === SUPERPOWERS_WORKFLOW);
  if (
    superpowersRuns.length !== requiredPairCount ||
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
  const tokenTargetValid =
    object.token_target?.metric === "aggregate-model-token-share" &&
    object.token_target?.population === "all-matched-pairs" &&
    object.token_target?.max_share_pct === maxTokenSharePct &&
    tokenResult?.eligible === true &&
    tokenResult?.eligible_pair_count === requiredPairCount &&
    tokenResult?.required_pair_count === requiredPairCount &&
    tokenResult?.metric === "aggregate-model-token-share" &&
    tokenResult?.population === "all-matched-pairs" &&
    tokenResult?.threshold_pct === maxTokenSharePct &&
    tokenResult?.status === "PASS" &&
    observedTokenShare !== null &&
    observedTokenShare <= maxTokenSharePct &&
    pairs?.count === requiredPairCount &&
    pairs?.required_pair_count === requiredPairCount &&
    pairs?.token_pairs === requiredPairCount &&
    pairedTokenShare !== null &&
    Math.abs(pairedTokenShare - observedTokenShare) < 1e-9;
  if (!tokenTargetValid) reasons.add("token-target");

  const wallReduction = finiteNumber(pairs?.median_wall_reduction_pct);
  if (wallReduction === null || wallReduction <= 0) reasons.add("wall-improvement");

  return {
    status: reasons.size === 0 ? "PASS" : "FAIL",
    reasons: [...reasons],
    evidence: {
      case_count: cases.length,
      repetition_count: Number.isSafeInteger(object.repetitions) ? object.repetitions : null,
      run_count: runs.length,
      pair_count: Number.isSafeInteger(pairs?.count) ? pairs.count : null,
      aggregate_model_token_share_pct: observedTokenShare,
      median_wall_reduction_pct: wallReduction,
    },
  };
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
