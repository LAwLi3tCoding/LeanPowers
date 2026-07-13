const STRICT_SIGNALS = [
  "authorization",
  "concurrency",
  "credentialGated",
  "dataRisk",
  "destructive",
  "irreversible",
  "largeRefactor",
  "migration",
  "payment",
  "privacy",
  "production",
  "reviewHighRisk",
  "security",
];

const STANDARD_SIGNALS = [
  "behaviorChange",
  "boundedUncertainty",
  "dataModelChange",
  "defect",
  "dependencyChange",
  "externalSystem",
  "multiFile",
  "publicBoundaryChange",
  "scopeExpanded",
  "validationFailed",
];

export function classifyRisk(signals = {}) {
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) {
    return "standard";
  }

  if (
    signals.preferredMode === "strict" ||
    STRICT_SIGNALS.some((signal) => signals[signal] === true)
  ) {
    return "strict";
  }

  if (
    signals.preferredMode === "standard" ||
    signals.causeKnown === false ||
    STANDARD_SIGNALS.some((signal) => signals[signal] === true)
  ) {
    return "standard";
  }

  const leanEligible =
    signals.clear === true &&
    signals.local === true &&
    signals.reversible === true &&
    signals.establishedValidation === true;
  return leanEligible ? "lean" : "standard";
}

export function selectInitialWorkflow({
  causeKnown = true,
  deliveryOnly = false,
  needsShaping = false,
} = {}) {
  if (deliveryOnly) {
    return "ship";
  }
  if (causeKnown === false) {
    return "debug";
  }
  if (needsShaping) {
    return "shape";
  }
  return "build";
}
