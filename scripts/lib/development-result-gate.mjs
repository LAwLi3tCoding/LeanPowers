import { isDeepStrictEqual } from "node:util";

import {
  caseSnapshotContract,
  evaluateRunOutcome,
  evaluateWorkflowConformance,
  renderDevelopmentReport,
} from "./development-benchmark.mjs";

const LEAN_WORKFLOW = "leanpowers-0.2.0";
const SUPERPOWERS_WORKFLOW = "superpowers-6.1.1";
const WORKFLOWS = [SUPERPOWERS_WORKFLOW, LEAN_WORKFLOW];
const TARGET_TOKEN_SHARE_PCT = 60;
const NEAR_TARGET_MAX_TOKEN_SHARE_PCT = 65;
const MAX_MEDIAN_WALL_SLOWDOWN_PCT = 20;
const SHA1 = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

const LEGACY_SUITE = {
  schema_version: 2,
  suite_id: "development-effects-performance-confirmatory-v2-2026-07-15",
  suite_sha256: "b0f721408de7bfbe04521d5df68c4d1bf2f5ff57ca5233aae61729a234b6f540",
  evidence_level: "paired-development-heldout",
  activation_mode: "explicit-entrypoint",
  model_default: "gpt-5.3-codex-spark",
  effort: "low",
  repetitions: 2,
  workflow_order: [
    [SUPERPOWERS_WORKFLOW, LEAN_WORKFLOW],
    [LEAN_WORKFLOW, SUPERPOWERS_WORKFLOW],
  ],
  token_target: {
    metric: "aggregate-model-token-share",
    population: "all-matched-pairs",
    max_share_pct: TARGET_TOKEN_SHARE_PCT,
  },
  freeze_contract: {
    agent_read_isolation: "codex-minimal-workspace-plugin-toolchain-read-v1",
    superpowers_revision: "d884ae04edebef577e82ff7c4e143debd0bbec99",
  },
  cases: [
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
  ],
};

export function evaluateDevelopmentResultGate(result, { report, suite } = {}) {
  const reasons = new Set();
  const advisories = new Set();
  const object = plainObject(result) ? result : {};
  const contract = normalizeSuiteContract(suite ?? LEGACY_SUITE, reasons);
  const cases = Array.isArray(object.cases) ? object.cases : [];
  const runs = Array.isArray(object.runs) ? object.runs : [];
  const pairs = object.paired?.all_pairs;
  const tokenResult = object.token_target_result;
  const requiredPairCount = contract.cases.length * contract.repetitions;

  if (object.schema_version !== contract.schema_version) reasons.add("schema-version");
  if (object.suite_id !== contract.suite_id) reasons.add("suite-id");
  if (object.suite_sha256 !== contract.suite_sha256) reasons.add("suite-sha");
  if (object.evidence_level !== contract.evidence_level) reasons.add("evidence-level");
  if (object.activation_mode !== contract.activation_mode) reasons.add("activation-mode");
  if (object.completion !== "complete") reasons.add("completion");
  if (object.frozen_run_contract_verified !== true) reasons.add("frozen-contract");
  if (object.confirmatory_eligible !== true) reasons.add("confirmatory-eligibility");
  if (
    contract.report_contract === "categorized-exact-render-v1" &&
    !matchesCanonicalReport(object, report)
  ) {
    reasons.add("report-artifact");
  }

  const expectedCases = contract.cases.map(({ snapshot: _snapshot, ...metadata }) => metadata);
  if (!isDeepStrictEqual(cases, expectedCases)) {
    const observedIds = cases.map((entry) => entry?.id);
    const expectedIds = expectedCases.map((entry) => entry.id);
    if (
      cases.length !== expectedCases.length ||
      new Set(observedIds).size !== expectedCases.length ||
      !isDeepStrictEqual([...observedIds].sort(), [...expectedIds].sort())
    ) {
      reasons.add("case-set");
    } else {
      reasons.add("case-metadata");
    }
  }
  const expectedSnapshots = contract.cases.map(({ id, snapshot }) => ({ id, ...snapshot }));
  if (!isDeepStrictEqual(object.case_snapshots, expectedSnapshots)) {
    reasons.add("case-snapshots");
  }

  validateRuntime(object.runtime, contract, reasons);
  validateMatrix(runs, contract, object.repetitions, reasons);

  if (runs.some((run) => {
    const expected = contract.casesById.get(run?.case_id);
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
  if (runs.some(hasInfrastructureFailure)) reasons.add("infrastructure-failure");

  for (const run of runs) {
    if (!plainObject(run)) {
      reasons.add("run-shape");
      reasons.add("task-outcome");
      continue;
    }
    let recomputedOutcome;
    try {
      recomputedOutcome = evaluateRunOutcome(run);
    } catch {
      reasons.add("run-shape");
      reasons.add("task-outcome");
      continue;
    }
    if (!isDeepStrictEqual(run?.outcome, recomputedOutcome)) {
      reasons.add("outcome-consistency");
    }
    if (run?.outcome?.status !== "PASS" || recomputedOutcome.status !== "PASS") {
      reasons.add("task-outcome");
    }
    if (run?.workflow === LEAN_WORKFLOW) {
      let recomputedConformance;
      try {
        recomputedConformance = evaluateWorkflowConformance(run);
      } catch {
        reasons.add("run-shape");
        reasons.add("lean-conformance");
        continue;
      }
      if (!isDeepStrictEqual(run?.workflow_conformance, recomputedConformance)) {
        reasons.add("lean-conformance-consistency");
      }
      if (
        run?.workflow_conformance?.status !== "PASS" ||
        recomputedConformance.status !== "PASS"
      ) {
        reasons.add("lean-conformance");
      }
    }
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

  const telemetryValid = runs.length === requiredPairCount * 2 &&
    runs.every((run) => validTokenTelemetry(run?.telemetry?.tokens));
  if (!telemetryValid) reasons.add("token-telemetry");
  const recomputedTokens = telemetryValid ? aggregateTokenTelemetry(runs) : null;
  const observedTokenShare = finiteNumber(tokenResult?.observed_share_pct);
  const pairedTokenShare = finiteNumber(pairs?.aggregate_model_token_share_pct);
  const expectedTokenShare = recomputedTokens?.share_pct ?? null;
  const expectedTokenStatus = expectedTokenShare !== null &&
      expectedTokenShare <= contract.token_target.max_share_pct
    ? "PASS"
    : "FAIL";
  const tokenSummaryValid = recomputedTokens !== null &&
    isDeepStrictEqual(pairs?.aggregate_model_tokens, {
      baseline: recomputedTokens.baseline,
      candidate: recomputedTokens.candidate,
    }) &&
    nearlyEqual(pairedTokenShare, expectedTokenShare) &&
    nearlyEqual(observedTokenShare, expectedTokenShare);
  if (!tokenSummaryValid) reasons.add("token-summary");
  const tokenTargetContractValid = tokenSummaryValid &&
    isDeepStrictEqual(object.token_target, contract.token_target) &&
    tokenResult?.eligible === true &&
    tokenResult?.eligible_pair_count === requiredPairCount &&
    tokenResult?.required_pair_count === requiredPairCount &&
    tokenResult?.metric === contract.token_target.metric &&
    tokenResult?.population === contract.token_target.population &&
    tokenResult?.threshold_pct === contract.token_target.max_share_pct &&
    tokenResult?.status === expectedTokenStatus &&
    pairs?.count === requiredPairCount &&
    pairs?.required_pair_count === requiredPairCount &&
    pairs?.token_pairs === requiredPairCount;
  let tokenTargetAssessment = "miss";
  if (
    tokenTargetContractValid &&
    expectedTokenShare <= contract.token_target.max_share_pct
  ) {
    tokenTargetAssessment = "met";
  } else if (
    tokenTargetContractValid &&
    expectedTokenShare <= NEAR_TARGET_MAX_TOKEN_SHARE_PCT
  ) {
    tokenTargetAssessment = "near-target";
    advisories.add("token-near-target");
  } else {
    reasons.add("token-target");
  }

  const reportedWallReduction = finiteNumber(pairs?.median_wall_reduction_pct);
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
  const recomputedWallReduction = runWallTelemetryValid
    ? aggregateMedianWallReduction(runs, contract)
    : null;
  if (
    reportedWallReduction === null ||
    recomputedWallReduction === null ||
    pairs?.wall_pairs !== requiredPairCount ||
    !runWallTelemetryValid
  ) {
    reasons.add("wall-telemetry");
  } else if (!nearlyEqual(reportedWallReduction, recomputedWallReduction)) {
    reasons.add("wall-summary");
  } else if (recomputedWallReduction < -MAX_MEDIAN_WALL_SLOWDOWN_PCT) {
    reasons.add("wall-regression");
  } else if (recomputedWallReduction <= 0) {
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
      aggregate_model_token_share_pct: expectedTokenShare,
      token_target_assessment: tokenTargetAssessment,
      median_wall_reduction_pct: recomputedWallReduction,
    },
  };
}

function normalizeSuiteContract(source, reasons) {
  const cases = Array.isArray(source?.cases) ? source.cases.flatMap((entry) => {
    let snapshot = entry?.snapshot;
    if (snapshot === undefined) {
      try {
        snapshot = caseSnapshotContract(entry);
      } catch {
        return [];
      }
    }
    return [{
      id: entry?.id,
      expected_workflow: entry?.expected_workflow,
      risk_level: entry?.risk_level,
      scenario_class: entry?.scenario_class,
      ...(entry?.reporting_category === undefined
        ? {}
        : { reporting_category: entry.reporting_category }),
      snapshot,
    }];
  }) : [];
  const contract = {
    schema_version: source?.schema_version,
    suite_id: source?.suite_id,
    suite_sha256: source?.suite_sha256,
    evidence_level: source?.evidence_level,
    activation_mode: source?.activation_mode,
    report_contract: source?.report_contract,
    model_default: source?.model_default,
    effort: source?.effort,
    repetitions: source?.repetitions,
    workflow_order: source?.workflow_order,
    token_target: source?.token_target,
    freeze_contract: source?.freeze_contract ?? {},
    cases,
    casesById: new Map(cases.map((entry) => [entry.id, entry])),
  };
  const pinnedRevisions = [
    contract.freeze_contract?.leanpowers_revision,
    contract.freeze_contract?.evaluator_revision,
    contract.freeze_contract?.runner_revision,
  ];
  const pinnedRevisionContractValid =
    pinnedRevisions.every((value) => value === undefined) ||
    pinnedRevisions.every((value) => SHA1.test(String(value)));
  if (
    contract.schema_version !== 2 ||
    typeof contract.suite_id !== "string" ||
    !SHA256.test(String(contract.suite_sha256 ?? "")) ||
    contract.evidence_level !== "paired-development-heldout" ||
    contract.activation_mode !== "explicit-entrypoint" ||
    ![undefined, "categorized-exact-render-v1"].includes(contract.report_contract) ||
    typeof contract.model_default !== "string" ||
    typeof contract.effort !== "string" ||
    !Number.isSafeInteger(contract.repetitions) ||
    contract.repetitions < 1 ||
    cases.length === 0 ||
    cases.length !== source?.cases?.length ||
    new Set(cases.map(({ id }) => id)).size !== cases.length ||
    !Array.isArray(contract.workflow_order) ||
    contract.workflow_order.length !== contract.repetitions ||
    contract.workflow_order.some((order) =>
      !Array.isArray(order) ||
      !isDeepStrictEqual([...order].sort(), [...WORKFLOWS].sort())
    ) ||
    !isDeepStrictEqual(contract.token_target, {
      metric: "aggregate-model-token-share",
      population: "all-matched-pairs",
      max_share_pct: TARGET_TOKEN_SHARE_PCT,
    }) ||
    !SHA1.test(String(contract.freeze_contract?.superpowers_revision ?? "")) ||
    typeof contract.freeze_contract?.agent_read_isolation !== "string" ||
    !pinnedRevisionContractValid
  ) {
    reasons.add("suite-contract");
  }
  return contract;
}

function validateRuntime(runtime, contract, reasons) {
  if (runtime?.model !== contract.model_default) reasons.add("runtime-model");
  if (runtime?.effort !== contract.effort) reasons.add("runtime-effort");
  if (
    runtime?.sandbox !== "permissions-profile" ||
    runtime?.permission_profile !== "benchmark" ||
    runtime?.agent_read_isolation !== contract.freeze_contract.agent_read_isolation ||
    runtime?.agent_read_isolation_preflight !== "PASS"
  ) {
    reasons.add("runtime-isolation");
  }
  if (runtime?.approval !== "never") reasons.add("runtime-approval");
  if (runtime?.user_plugins !== "isolated") reasons.add("runtime-plugin-isolation");

  const revisions = runtime?.workflow_revisions;
  let revisionsValid = plainObject(revisions) &&
    revisions[SUPERPOWERS_WORKFLOW] === contract.freeze_contract.superpowers_revision &&
    SHA1.test(String(revisions[LEAN_WORKFLOW] ?? "")) &&
    SHA1.test(String(runtime?.evaluator_revision ?? ""));
  if (contract.freeze_contract.leanpowers_revision !== undefined) {
    revisionsValid &&= revisions[LEAN_WORKFLOW] ===
      contract.freeze_contract.leanpowers_revision;
  }
  if (contract.freeze_contract.evaluator_revision !== undefined) {
    revisionsValid &&= runtime.evaluator_revision ===
      contract.freeze_contract.evaluator_revision;
  }
  if (contract.freeze_contract.runner_revision !== undefined) {
    revisionsValid &&= runtime?.runner_revision === contract.freeze_contract.runner_revision;
  }
  if (
    contract.freeze_contract.leanpowers_revision === undefined &&
    contract.freeze_contract.evaluator_revision === undefined
  ) {
    revisionsValid &&= runtime?.evaluator_revision === revisions?.[LEAN_WORKFLOW];
  }
  if (!revisionsValid) reasons.add("workflow-revisions");
}

function validateMatrix(runs, contract, repetitions, reasons) {
  const expected = [];
  for (let repetition = 1; repetition <= contract.repetitions; repetition += 1) {
    for (const benchmarkCase of contract.cases) {
      for (const workflow of contract.workflow_order[repetition - 1]) {
        expected.push(`${repetition}\0${benchmarkCase.id}\0${workflow}`);
      }
    }
  }
  const observed = runs.map((run) =>
    `${run?.repetition}\0${run?.case_id}\0${run?.workflow}`
  );
  if (
    repetitions !== contract.repetitions ||
    runs.length !== expected.length ||
    new Set(observed).size !== observed.length ||
    observed.some((key) => !expected.includes(key))
  ) {
    reasons.add("matrix-shape");
  } else if (!isDeepStrictEqual(observed, expected)) {
    reasons.add("run-order");
  }
}

function validTokenTelemetry(tokens) {
  return plainObject(tokens) &&
    tokens.telemetry_complete === true &&
    nonNegativeSafeInteger(tokens.input) &&
    nonNegativeSafeInteger(tokens.cached_input) &&
    tokens.cached_input <= tokens.input &&
    nonNegativeSafeInteger(tokens.output) &&
    Number.isSafeInteger(tokens.total) &&
    tokens.total > 0 &&
    tokens.total === tokens.input + tokens.output &&
    Number.isSafeInteger(tokens.uncached_plus_output) &&
    tokens.uncached_plus_output ===
      tokens.input - tokens.cached_input + tokens.output &&
    (tokens.reasoning_output === null || tokens.reasoning_output === undefined ||
      nonNegativeSafeInteger(tokens.reasoning_output));
}

function aggregateTokenTelemetry(runs) {
  const baseline = safeTokenSum(runs, SUPERPOWERS_WORKFLOW);
  const candidate = safeTokenSum(runs, LEAN_WORKFLOW);
  if (baseline === null || candidate === null || baseline <= 0 || candidate <= 0) return null;
  return { baseline, candidate, share_pct: candidate / baseline * 100 };
}

function safeTokenSum(runs, workflow) {
  let total = 0;
  for (const run of runs.filter((entry) => entry.workflow === workflow)) {
    total += run.telemetry.tokens.total;
    if (!Number.isSafeInteger(total)) return null;
  }
  return total;
}

function aggregateMedianWallReduction(runs, contract) {
  const reductions = [];
  for (let repetition = 1; repetition <= contract.repetitions; repetition += 1) {
    for (const benchmarkCase of contract.cases) {
      const pair = Object.fromEntries(WORKFLOWS.map((workflow) => [
        workflow,
        runs.find((run) =>
          run?.repetition === repetition &&
          run?.case_id === benchmarkCase.id &&
          run?.workflow === workflow
        ),
      ]));
      const baseline = pair[SUPERPOWERS_WORKFLOW]?.wall_seconds;
      const candidate = pair[LEAN_WORKFLOW]?.wall_seconds;
      if (
        !Number.isFinite(baseline) ||
        !Number.isFinite(candidate) ||
        baseline <= 0 ||
        candidate <= 0
      ) {
        return null;
      }
      reductions.push((1 - candidate / baseline) * 100);
    }
  }
  reductions.sort((left, right) => left - right);
  const middle = Math.floor(reductions.length / 2);
  const value = reductions.length % 2 === 0
    ? (reductions[middle - 1] + reductions[middle]) / 2
    : reductions[middle];
  return Math.round(value * 10) / 10;
}

function hasInfrastructureFailure(run) {
  return run?.capacity_retry_exhausted === true ||
    markedFailure(run?.capacity_failure) ||
    markedFailure(run?.infrastructure_failure) ||
    ["capacity", "capacity-failure", "infrastructure-failure"].includes(
      run?.final_attempt_failure_kind,
    ) ||
    ["capacity-failure", "infrastructure-failure", "failed"].includes(
      run?.final_attempt_status,
    ) ||
    ["capacity-failure", "infrastructure-failure", "failed"].includes(
      run?.infrastructure_status,
    );
}

function markedFailure(value) {
  return value !== undefined && value !== null && value !== false;
}

function nonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function nearlyEqual(left, right) {
  return finiteNumber(left) !== null && finiteNumber(right) !== null &&
    Math.abs(left - right) < 1e-9;
}

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function matchesCanonicalReport(result, report) {
  if (typeof report !== "string") return false;
  try {
    return report === renderDevelopmentReport(result);
  } catch {
    return false;
  }
}
