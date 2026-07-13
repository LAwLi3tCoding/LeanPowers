const RATE_MARGIN = Object.freeze({
  taskSuccessDelta: -0.03,
  compositeRatio: 0.95,
  regressionDelta: 0.02,
  scopeViolationDelta: 0.02,
  tokenReduction: 0.5,
  wallReduction: 0.4,
  agentCallReduction: 0.6,
});
const EPSILON = 1e-12;

const CONDITION_KEYS = [
  "model",
  "repository_revision",
  "prompt_set",
  "evaluator",
  "seeds",
];

export function validateBenchmarkRun(run) {
  if (!run || typeof run !== "object" || Array.isArray(run)) {
    return ["run must be an object"];
  }

  const errors = [];
  if (run.schema_version !== 1) {
    errors.push("schema_version must equal 1");
  }
  requireText(run, "run_id", errors);
  requireText(run, "workflow", errors);
  if (
    typeof run.workflow === "string" &&
    !/^(?:superpowers|leanpowers)-\S+$/.test(run.workflow)
  ) {
    errors.push("workflow must identify superpowers-<version> or leanpowers-<version>");
  }
  requireEnum(run, "provenance", ["live", "simulated"], errors);
  requireEnum(run, "completion", ["complete", "incomplete"], errors);
  validateConditions(run.conditions, errors);
  validateCoverage(run.coverage, errors);
  validateQuality(run.quality, errors);
  validateEfficiency(run.efficiency, errors);
  validateCategories(run.categories, run.coverage, run.quality, run.run_id, errors);
  validateHardFailures(run.hard_failures, errors);
  validateAggregateTotals(run.coverage, run.quality, errors);
  return errors;
}

export function compareRuns(baseline, candidate) {
  const baselineErrors = validateBenchmarkRun(baseline);
  const candidateErrors = validateBenchmarkRun(candidate);
  if (baselineErrors.length > 0 || candidateErrors.length > 0) {
    return diagnosticResult([
      ...baselineErrors.map((error) => `baseline: ${error}`),
      ...candidateErrors.map((error) => `candidate: ${error}`),
    ]);
  }

  const quality = qualityDeltas(baseline, candidate);
  const efficiency = efficiencyDeltas(baseline, candidate);
  const hardFailures = collectHardFailures(baseline, candidate);
  const categoryReruns = assessCategoryReruns(baseline, candidate);
  const diagnosticReasons = [
    ...comparabilityReasons(baseline, candidate),
    ...categoryReruns.diagnosticReasons,
  ];
  if (diagnosticReasons.length > 0) {
    return {
      decision: "DIAGNOSTIC_ONLY",
      release_eligible: false,
      quality,
      efficiency,
      hard_failures: hardFailures,
      reasons: diagnosticReasons,
      recommendations: ["Run a complete, live, blind, identically paired benchmark."],
    };
  }

  const reasons = [];
  const gates = [];
  addGate(
    gates,
    reasons,
    "task_success_non_inferiority",
    atLeast(quality.task_success_delta, RATE_MARGIN.taskSuccessDelta),
    `task success delta ${formatPercent(quality.task_success_delta)} is below -3.00%`,
  );
  addGate(
    gates,
    reasons,
    "composite_quality_non_inferiority",
    atLeast(quality.composite_quality_ratio, RATE_MARGIN.compositeRatio),
    `composite quality ratio ${quality.composite_quality_ratio.toFixed(3)} is below 0.950`,
  );
  addGate(
    gates,
    reasons,
    "regression_rate_non_inferiority",
    atMost(quality.regression_rate_delta, RATE_MARGIN.regressionDelta),
    `regression rate delta ${formatPercent(quality.regression_rate_delta)} exceeds +2.00%`,
  );
  addGate(
    gates,
    reasons,
    "scope_violation_non_inferiority",
    atMost(quality.scope_violation_rate_delta, RATE_MARGIN.scopeViolationDelta),
    `scope violation delta ${formatPercent(quality.scope_violation_rate_delta)} exceeds +2.00%`,
  );
  addGate(
    gates,
    reasons,
    "standard_token_reduction",
    atLeast(efficiency.standard_tokens_reduction, RATE_MARGIN.tokenReduction),
    `standard token reduction ${formatPercent(efficiency.standard_tokens_reduction)} is below 50.00%`,
  );
  addGate(
    gates,
    reasons,
    "standard_wall_reduction",
    atLeast(efficiency.standard_wall_reduction, RATE_MARGIN.wallReduction),
    `standard wall-time reduction ${formatPercent(efficiency.standard_wall_reduction)} is below 40.00%`,
  );
  addGate(
    gates,
    reasons,
    "standard_agent_call_reduction",
    atLeast(
      efficiency.standard_agent_calls_reduction,
      RATE_MARGIN.agentCallReduction,
    ),
    `standard agent-call reduction ${formatPercent(efficiency.standard_agent_calls_reduction)} is below 60.00%`,
  );

  for (const reason of categoryReruns.blockReasons) {
    reasons.push(reason);
  }
  for (const failure of hardFailures) {
    reasons.unshift(`hard failure: ${failure}`);
  }

  const decision = reasons.length === 0 ? "PASS" : "BLOCK";
  return {
    decision,
    release_eligible: decision === "PASS",
    gates,
    quality,
    efficiency,
    hard_failures: hardFailures,
    reasons,
    recommendations: recommendationsFor(reasons, hardFailures),
  };
}

function validateConditions(conditions, errors) {
  if (!isRecord(conditions)) {
    errors.push("conditions must be an object");
    return;
  }
  for (const field of ["model", "repository_revision", "prompt_set", "evaluator"]) {
    requireText(conditions, field, errors, "conditions.");
  }
  if (!Array.isArray(conditions.seeds) || conditions.seeds.length < 2) {
    errors.push("conditions.seeds must contain at least two seeds");
  } else if (new Set(conditions.seeds.map(String)).size !== conditions.seeds.length) {
    errors.push("conditions.seeds must be unique");
  }
  if (typeof conditions.blind_evaluation !== "boolean") {
    errors.push("conditions.blind_evaluation must be boolean");
  }
}

function validateCoverage(coverage, errors) {
  if (!isRecord(coverage)) {
    errors.push("coverage must be an object");
    return;
  }
  requireInteger(coverage, "planned_cases", errors, { minimum: 1, prefix: "coverage." });
  requireInteger(coverage, "completed_cases", errors, { minimum: 0, prefix: "coverage." });
  if (
    Number.isInteger(coverage.planned_cases) &&
    Number.isInteger(coverage.completed_cases) &&
    coverage.completed_cases > coverage.planned_cases
  ) {
    errors.push("coverage.completed_cases cannot exceed planned_cases");
  }
  if (!Array.isArray(coverage.scenario_classes) || coverage.scenario_classes.length === 0) {
    errors.push("coverage.scenario_classes must be a non-empty array");
  } else {
    const scenarioClasses = new Set();
    for (const [index, scenarioClass] of coverage.scenario_classes.entries()) {
      if (typeof scenarioClass !== "string" || scenarioClass.trim() === "") {
        errors.push(`coverage.scenario_classes[${index}] must be a non-empty string`);
      } else if (scenarioClasses.has(scenarioClass)) {
        errors.push("coverage.scenario_classes must be unique");
      } else {
        scenarioClasses.add(scenarioClass);
      }
    }
  }
}

function validateQuality(quality, errors) {
  if (!isRecord(quality)) {
    errors.push("quality must be an object");
    return;
  }
  validateRatioCount(quality.task_success, "quality.task_success", "passed", errors);
  validateRate(quality.composite_quality, "quality.composite_quality", errors);
  requireInteger(quality, "critical_defect_escapes", errors, {
    minimum: 0,
    prefix: "quality.",
  });
  validateRatioCount(
    quality.introduced_regressions,
    "quality.introduced_regressions",
    "count",
    errors,
  );
  validateRatioCount(
    quality.scope_violations,
    "quality.scope_violations",
    "count",
    errors,
  );
  for (const field of [
    "false_completion_claims",
    "unauthorized_actions",
  ]) {
    requireInteger(quality, field, errors, { minimum: 0, prefix: "quality." });
  }
  validateRate(quality.review_severity_accuracy, "quality.review_severity_accuracy", errors);
}

function validateEfficiency(efficiency, errors) {
  const standard = efficiency?.standard;
  if (!isRecord(standard)) {
    errors.push("efficiency.standard must be an object");
    return;
  }
  for (const field of ["median_tokens", "median_wall_seconds", "median_agent_calls"]) {
    if (!Number.isFinite(standard[field]) || standard[field] <= 0) {
      errors.push(`efficiency.standard.${field} must be a finite number greater than 0`);
    }
  }
}

function validateCategories(categories, coverage, quality, parentRunId, errors) {
  if (!Array.isArray(categories) || categories.length === 0) {
    errors.push("categories must be a non-empty array");
    return;
  }
  const names = new Set();
  const runIds = new Set([parentRunId]);
  let categoryTotal = 0;
  let categoryPassed = 0;
  for (const [index, category] of categories.entries()) {
    const prefix = `categories[${index}]`;
    if (!isRecord(category)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    if (typeof category.name !== "string" || category.name.trim() === "") {
      errors.push(`${prefix}.name must be a non-empty string`);
    } else if (names.has(category.name)) {
      errors.push(`${prefix}.name must be unique`);
    } else {
      names.add(category.name);
    }
    validateRatioCount(category.task_success, `${prefix}.task_success`, "passed", errors);
    if (Number.isInteger(category.task_success?.total)) {
      categoryTotal += category.task_success.total;
    }
    if (Number.isInteger(category.task_success?.passed)) {
      categoryPassed += category.task_success.passed;
    }
    validateRate(category.composite_quality, `${prefix}.composite_quality`, errors);
    if (!(category.strict_rerun === null || isRecord(category.strict_rerun))) {
      errors.push(`${prefix}.strict_rerun must be null or an object`);
    } else if (isRecord(category.strict_rerun)) {
      validateStrictRerun(category.strict_rerun, category, prefix, runIds, errors);
    }
  }

  if (Array.isArray(coverage?.scenario_classes)) {
    const categoryNames = [...names].sort();
    const scenarioClasses = [...new Set(coverage.scenario_classes)].sort();
    if (!sameValue(categoryNames, scenarioClasses)) {
      errors.push("categories must exactly partition coverage.scenario_classes");
    }
  }
  if (
    Number.isInteger(coverage?.completed_cases) &&
    categoryTotal !== coverage.completed_cases
  ) {
    errors.push("category task_success totals must equal coverage.completed_cases");
  }
  if (
    Number.isInteger(quality?.task_success?.passed) &&
    categoryPassed !== quality.task_success.passed
  ) {
    errors.push("category task_success passed counts must equal quality.task_success.passed");
  }
}

function validateStrictRerun(rerun, category, prefix, runIds, errors) {
  requireText(rerun, "run_id", errors, `${prefix}.strict_rerun.`);
  requireEnumAtPath(
    rerun,
    "provenance",
    ["live", "simulated"],
    errors,
    `${prefix}.strict_rerun.`,
  );
  requireEnumAtPath(
    rerun,
    "completion",
    ["complete", "incomplete"],
    errors,
    `${prefix}.strict_rerun.`,
  );
  validateRatioCount(
    rerun.task_success,
    `${prefix}.strict_rerun.task_success`,
    "passed",
    errors,
  );
  validateRate(
    rerun.composite_quality,
    `${prefix}.strict_rerun.composite_quality`,
    errors,
  );
  if (
    Number.isInteger(rerun.task_success?.total) &&
    Number.isInteger(category.task_success?.total) &&
    rerun.task_success.total !== category.task_success.total
  ) {
    errors.push(`${prefix}.strict_rerun.task_success.total must equal category total`);
  }
  if (typeof rerun.run_id === "string" && rerun.run_id.trim() !== "") {
    if (runIds.has(rerun.run_id)) {
      errors.push(`${prefix}.strict_rerun.run_id must be distinct`);
    }
    runIds.add(rerun.run_id);
  }
}

function validateAggregateTotals(coverage, quality, errors) {
  if (!Number.isInteger(coverage?.completed_cases) || !isRecord(quality)) {
    return;
  }
  for (const [path, value] of [
    ["quality.task_success.total", quality.task_success?.total],
    ["quality.introduced_regressions.total", quality.introduced_regressions?.total],
    ["quality.scope_violations.total", quality.scope_violations?.total],
  ]) {
    if (Number.isInteger(value) && value !== coverage.completed_cases) {
      errors.push(`${path} must equal coverage.completed_cases`);
    }
  }
}

function validateHardFailures(hardFailures, errors) {
  if (!Array.isArray(hardFailures)) {
    errors.push("hard_failures must be an array");
    return;
  }
  for (const [index, failure] of hardFailures.entries()) {
    if (!isRecord(failure)) {
      errors.push(`hard_failures[${index}] must be an object`);
      continue;
    }
    for (const field of ["code", "severity", "summary"]) {
      requireText(failure, field, errors, `hard_failures[${index}].`);
    }
  }
}

function comparabilityReasons(baseline, candidate) {
  const reasons = [];
  if (baseline.run_id === candidate.run_id) {
    reasons.push("baseline and candidate run_id values must be distinct");
  }
  if (!isWorkflowIdentity(baseline.workflow, "superpowers")) {
    reasons.push("baseline workflow must identify superpowers-<version>");
  }
  if (!isWorkflowIdentity(candidate.workflow, "leanpowers")) {
    reasons.push("candidate workflow must identify leanpowers-<version>");
  }
  const evidenceRunIds = new Set([baseline.run_id, candidate.run_id]);
  for (const run of [baseline, candidate]) {
    for (const category of run.categories) {
      const rerunId = category.strict_rerun?.run_id;
      if (rerunId && evidenceRunIds.has(rerunId)) {
        reasons.push(`strict rerun run_id must be distinct: ${rerunId}`);
      }
      if (rerunId) {
        evidenceRunIds.add(rerunId);
      }
    }
  }
  if (baseline.provenance !== "live" || candidate.provenance !== "live") {
    reasons.push("both runs must use live provenance");
  }
  if (baseline.completion !== "complete" || candidate.completion !== "complete") {
    reasons.push("both runs must be complete");
  }
  if (!baseline.conditions.blind_evaluation || !candidate.conditions.blind_evaluation) {
    reasons.push("both runs must use blind evaluation");
  }
  if (baseline.quality.composite_quality === 0) {
    reasons.push("baseline composite quality must be greater than zero");
  }
  for (const key of CONDITION_KEYS) {
    if (!sameValue(baseline.conditions[key], candidate.conditions[key])) {
      reasons.push(`pairing condition mismatch: ${key}`);
    }
  }
  if (
    baseline.coverage.completed_cases !== baseline.coverage.planned_cases ||
    candidate.coverage.completed_cases !== candidate.coverage.planned_cases
  ) {
    reasons.push("planned benchmark coverage is incomplete");
  }
  if (
    baseline.coverage.planned_cases !== candidate.coverage.planned_cases ||
    !sameValue(
      [...baseline.coverage.scenario_classes].sort(),
      [...candidate.coverage.scenario_classes].sort(),
    )
  ) {
    reasons.push("benchmark coverage does not match");
  }
  const baselineCategories = baseline.categories.map(({ name }) => name).sort();
  const candidateCategories = candidate.categories.map(({ name }) => name).sort();
  if (!sameValue(baselineCategories, candidateCategories)) {
    reasons.push("benchmark category coverage does not match");
  }
  return reasons;
}

function qualityDeltas(baseline, candidate) {
  const baselineSuccess = ratio(baseline.quality.task_success, "passed");
  const candidateSuccess = ratio(candidate.quality.task_success, "passed");
  const baselineRegression = ratio(baseline.quality.introduced_regressions, "count");
  const candidateRegression = ratio(candidate.quality.introduced_regressions, "count");
  const baselineScope = ratio(baseline.quality.scope_violations, "count");
  const candidateScope = ratio(candidate.quality.scope_violations, "count");
  return {
    task_success_baseline: baselineSuccess,
    task_success_candidate: candidateSuccess,
    task_success_delta: candidateSuccess - baselineSuccess,
    composite_quality_delta:
      candidate.quality.composite_quality - baseline.quality.composite_quality,
    composite_quality_ratio:
      candidate.quality.composite_quality / baseline.quality.composite_quality,
    critical_escape_delta:
      candidate.quality.critical_defect_escapes -
      baseline.quality.critical_defect_escapes,
    regression_rate_delta: candidateRegression - baselineRegression,
    scope_violation_rate_delta: candidateScope - baselineScope,
    review_severity_accuracy_delta:
      candidate.quality.review_severity_accuracy -
      baseline.quality.review_severity_accuracy,
  };
}

function efficiencyDeltas(baseline, candidate) {
  const baselineStandard = baseline.efficiency.standard;
  const candidateStandard = candidate.efficiency.standard;
  return {
    standard_tokens_reduction: reduction(
      baselineStandard.median_tokens,
      candidateStandard.median_tokens,
    ),
    standard_wall_reduction: reduction(
      baselineStandard.median_wall_seconds,
      candidateStandard.median_wall_seconds,
    ),
    standard_agent_calls_reduction: reduction(
      baselineStandard.median_agent_calls,
      candidateStandard.median_agent_calls,
    ),
  };
}

function collectHardFailures(baseline, candidate) {
  const failures = new Set(
    candidate.hard_failures.map(
      ({ code, summary }) => `${code}: ${summary}`,
    ),
  );
  if (
    candidate.quality.critical_defect_escapes >
    baseline.quality.critical_defect_escapes
  ) {
    failures.add("critical defect escapes increased");
  }
  if (
    candidate.quality.false_completion_claims >
    baseline.quality.false_completion_claims
  ) {
    failures.add("false completion claims increased");
  }
  if (
    candidate.quality.unauthorized_actions > baseline.quality.unauthorized_actions
  ) {
    failures.add("unauthorized high-risk actions increased");
  }
  return [...failures].sort();
}

function assessCategoryReruns(baseline, candidate) {
  const baselineByName = new Map(
    baseline.categories.map((category) => [category.name, category]),
  );
  const blockReasons = [];
  const diagnosticReasons = [];
  for (const category of candidate.categories) {
    const reference = baselineByName.get(category.name);
    const regressed =
      ratio(category.task_success, "passed") <
        ratio(reference.task_success, "passed") ||
      category.composite_quality < reference.composite_quality;
    if (!regressed) {
      continue;
    }
    const rerun = category.strict_rerun;
    if (rerun === null) {
      blockReasons.push(`category ${category.name} regressed without a strict rerun`);
      continue;
    }
    if (rerun.provenance !== "live" || rerun.completion !== "complete") {
      diagnosticReasons.push(
        `category ${category.name} strict rerun must be live and complete`,
      );
      continue;
    }
    const recovered =
      atLeast(
        ratio(rerun.task_success, "passed"),
        ratio(reference.task_success, "passed"),
      ) && atLeast(rerun.composite_quality, reference.composite_quality);
    if (!recovered) {
      blockReasons.push(
        `category ${category.name} strict rerun did not meet the baseline category`,
      );
    }
  }
  return { blockReasons, diagnosticReasons };
}

function recommendationsFor(reasons, hardFailures) {
  const recommendations = [];
  if (hardFailures.length > 0) {
    recommendations.push("Resolve every hard failure before release.");
  }
  if (reasons.some((reason) => reason.includes("category "))) {
    recommendations.push("Route each regressing category through strict mode and re-run it.");
  }
  if (reasons.some((reason) => reason.includes("reduction"))) {
    recommendations.push("Reduce standard-path ceremony while preserving hard quality gates.");
  }
  if (reasons.length > 0 && recommendations.length === 0) {
    recommendations.push("Investigate the failed non-inferiority gates and re-run the paired suite.");
  }
  return recommendations;
}

function diagnosticResult(reasons) {
  return {
    decision: "DIAGNOSTIC_ONLY",
    release_eligible: false,
    quality: {},
    efficiency: {},
    hard_failures: [],
    reasons,
    recommendations: ["Correct the benchmark inputs before making a release decision."],
  };
}

function addGate(gates, reasons, id, passed, failureReason) {
  gates.push({ id, passed });
  if (!passed) {
    reasons.push(failureReason);
  }
}

function validateRatioCount(value, path, numerator, errors) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!Number.isInteger(value[numerator]) || value[numerator] < 0) {
    errors.push(`${path}.${numerator} must be a non-negative integer`);
  }
  if (!Number.isInteger(value.total) || value.total <= 0) {
    errors.push(`${path}.total must be a positive integer`);
  }
  if (
    Number.isInteger(value[numerator]) &&
    Number.isInteger(value.total) &&
    value[numerator] > value.total
  ) {
    errors.push(`${path}.${numerator} cannot exceed total`);
  }
}

function validateRate(value, path, errors) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    errors.push(`${path} must be a finite number from 0 to 1`);
  }
}

function requireText(record, field, errors, prefix = "") {
  if (typeof record?.[field] !== "string" || record[field].trim() === "") {
    errors.push(`${prefix}${field} must be a non-empty string`);
  }
}

function requireEnum(record, field, values, errors) {
  if (!values.includes(record?.[field])) {
    errors.push(`${field} must be one of: ${values.join(", ")}`);
  }
}

function requireEnumAtPath(record, field, values, errors, prefix) {
  if (!values.includes(record?.[field])) {
    errors.push(`${prefix}${field} must be one of: ${values.join(", ")}`);
  }
}

function requireInteger(record, field, errors, options = {}) {
  const value = record?.[field];
  const minimum = options.minimum ?? Number.MIN_SAFE_INTEGER;
  if (!Number.isInteger(value) || value < minimum) {
    errors.push(`${options.prefix ?? ""}${field} must be an integer >= ${minimum}`);
  }
}

function ratio(value, numerator) {
  return value[numerator] / value.total;
}

function reduction(baseline, candidate) {
  return (baseline - candidate) / baseline;
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isWorkflowIdentity(workflow, identity) {
  return typeof workflow === "string" && workflow.startsWith(`${identity}-`);
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function atLeast(value, threshold) {
  return value + EPSILON >= threshold;
}

function atMost(value, threshold) {
  return value <= threshold + EPSILON;
}
