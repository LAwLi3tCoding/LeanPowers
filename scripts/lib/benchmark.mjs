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
  requireInteger(run, "schema_version", errors, { minimum: 1 });
  requireText(run, "run_id", errors);
  requireText(run, "workflow", errors);
  requireEnum(run, "provenance", ["live", "simulated"], errors);
  requireEnum(run, "completion", ["complete", "incomplete"], errors);
  validateConditions(run.conditions, errors);
  validateCoverage(run.coverage, errors);
  validateQuality(run.quality, errors);
  validateEfficiency(run.efficiency, errors);
  validateCategories(run.categories, errors);
  validateHardFailures(run.hard_failures, errors);
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
  const diagnosticReasons = comparabilityReasons(baseline, candidate);
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

  for (const reason of categoryFallbackFailures(baseline, candidate)) {
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

function validateCategories(categories, errors) {
  if (!Array.isArray(categories) || categories.length === 0) {
    errors.push("categories must be a non-empty array");
    return;
  }
  const names = new Set();
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
    validateRate(category.composite_quality, `${prefix}.composite_quality`, errors);
    if (typeof category.strict_fallback !== "boolean") {
      errors.push(`${prefix}.strict_fallback must be boolean`);
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

function categoryFallbackFailures(baseline, candidate) {
  const baselineByName = new Map(
    baseline.categories.map((category) => [category.name, category]),
  );
  const failures = [];
  for (const category of candidate.categories) {
    const reference = baselineByName.get(category.name);
    const regressed =
      ratio(category.task_success, "passed") <
        ratio(reference.task_success, "passed") ||
      category.composite_quality < reference.composite_quality;
    if (regressed && !category.strict_fallback) {
      failures.push(
        `category ${category.name} regressed without a strict fallback`,
      );
    }
  }
  return failures;
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

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function atLeast(value, threshold) {
  return value + EPSILON >= threshold;
}

function atMost(value, threshold) {
  return value <= threshold + EPSILON;
}
